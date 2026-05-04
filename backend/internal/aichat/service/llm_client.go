package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
	"golang.org/x/time/rate"
)

// LLMClient communicates with DeepSeek API using native function calling.
type LLMClient struct {
	cfg     config.AIConfig
	client  *http.Client
	limiter *rate.Limiter
}

// NewLLMClient creates a new LLM client with rate limiting.
func NewLLMClient(cfg config.AIConfig) *LLMClient {
	return &LLMClient{
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		limiter: rate.NewLimiter(rate.Limit(10), 20), // 10 QPS, burst 20
	}
}

// ChatRequest represents a request to the LLM.
type ChatRequest struct {
	Messages []model.Message      `json:"messages"`
	Tools    []model.OpenAITool   `json:"tools,omitempty"`
	Stream   bool                 `json:"stream"`
	Model    string               `json:"model"`
}

// ChatMessage for LLM API (extends model.Message with tool fields).
type ChatMessage struct {
	Role       string                `json:"role"`
	Content    string                `json:"content,omitempty"`
	ToolCalls  []model.OpenAIToolCall `json:"tool_calls,omitempty"`
	ToolCallID string                `json:"tool_call_id,omitempty"`
}

// StreamDelta represents a streaming chunk from the LLM.
type StreamDelta struct {
	Content   string                `json:"content,omitempty"`
	ToolCalls []ToolCallDelta       `json:"tool_calls,omitempty"`
}

type ToolCallDelta struct {
	Index    int                    `json:"index"`
	ID       string                `json:"id,omitempty"`
	Type     string                `json:"type,omitempty"`
	Function ToolCallFunctionDelta `json:"function,omitempty"`
}

type ToolCallFunctionDelta struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

type streamChoice struct {
	Delta        StreamDelta `json:"delta"`
	FinishReason *string     `json:"finish_reason"`
}

type streamChunk struct {
	Choices []streamChoice `json:"choices"`
	Usage   *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
}

// StreamEvent is emitted during streaming.
type StreamEvent struct {
	Type         string // "content" | "tool_calls" | "done" | "error"
	Content      string
	ToolCalls    []model.OpenAIToolCall
	FinishReason string
	TotalTokens  int
}

// ChatStreamFunc streams LLM responses, calling onEvent for each chunk.
// Supports context cancellation for client disconnect.
func (c *LLMClient) ChatStreamFunc(ctx context.Context, messages []ChatMessage, tools []model.OpenAITool, onEvent func(StreamEvent)) error {
	if err := c.limiter.Wait(ctx); err != nil {
		return fmt.Errorf("rate limited: %w", err)
	}

	reqBody := map[string]interface{}{
		"model":    c.cfg.Model,
		"messages": messages,
		"stream":   true,
	}
	if len(tools) > 0 {
		reqBody["tools"] = tools
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.cfg.BaseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("LLM request failed: %w", err)
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		// Close first response explicitly before retry (#10 fix)
		resp.Body.Close()
		time.Sleep(1 * time.Second)
		resp, err = c.client.Do(req)
		if err != nil {
			return fmt.Errorf("LLM retry failed: %w", err)
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			return fmt.Errorf("LLM rate limited (429)")
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		// Truncate error body to 200 chars to avoid leaking internals (#4 fix)
		errMsg := string(body)
		if len(errMsg) > 200 {
			errMsg = errMsg[:200] + "...[truncated]"
		}
		return fmt.Errorf("LLM returned %d: %s", resp.StatusCode, errMsg)
	}

	// Parse SSE stream
	scanner := bufio.NewScanner(resp.Body)
	var pendingToolCalls []model.OpenAIToolCall
	// Track accumulated tool call arguments per index
	toolCallArgs := make(map[int]*strings.Builder)
	toolCallMeta := make(map[int]model.OpenAIToolCall)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			// Flush any pending tool calls
			if len(toolCallMeta) > 0 {
				for idx, tc := range toolCallMeta {
					if sb, ok := toolCallArgs[idx]; ok {
						tc.Function.Arguments = sb.String()
					}
					pendingToolCalls = append(pendingToolCalls, tc)
				}
				onEvent(StreamEvent{
					Type:      "tool_calls",
					ToolCalls: pendingToolCalls,
				})
			}
			onEvent(StreamEvent{Type: "done"})
			return nil
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			logger.Warn("Failed to parse SSE chunk: %v", err)
			continue
		}

		if len(chunk.Choices) == 0 {
			continue
		}

		choice := chunk.Choices[0]
		delta := choice.Delta

		// Content delta
		if delta.Content != "" {
			onEvent(StreamEvent{
				Type:    "content",
				Content: delta.Content,
			})
		}

		// Tool call deltas (accumulated)
		for _, tc := range delta.ToolCalls {
			if tc.ID != "" {
				// New tool call
				toolCallMeta[tc.Index] = model.OpenAIToolCall{
					ID:   tc.ID,
					Type: "function",
					Function: model.OpenAIFunctionCall{
						Name: tc.Function.Name,
					},
				}
				toolCallArgs[tc.Index] = &strings.Builder{}
			}
			if tc.Function.Arguments != "" {
				if sb, ok := toolCallArgs[tc.Index]; ok {
					sb.WriteString(tc.Function.Arguments)
				}
			}
		}

		// Finish reason
		if choice.FinishReason != nil {
			if *choice.FinishReason == "tool_calls" {
				// Flush tool calls
				for idx, tc := range toolCallMeta {
					if sb, ok := toolCallArgs[idx]; ok {
						tc.Function.Arguments = sb.String()
					}
					pendingToolCalls = append(pendingToolCalls, tc)
				}
				onEvent(StreamEvent{
					Type:         "tool_calls",
					ToolCalls:    pendingToolCalls,
					FinishReason: "tool_calls",
				})
				pendingToolCalls = nil
				toolCallArgs = make(map[int]*strings.Builder)
				toolCallMeta = make(map[int]model.OpenAIToolCall)
			} else if *choice.FinishReason == "stop" {
				if chunk.Usage != nil {
					onEvent(StreamEvent{
						Type:        "done",
						TotalTokens: chunk.Usage.TotalTokens,
					})
				}
			}
		}
	}

	return scanner.Err()
}

// ChatJSON performs a non-streaming LLM call and returns the full response.
func (c *LLMClient) ChatJSON(ctx context.Context, messages []ChatMessage, tools []model.OpenAITool) (string, []model.OpenAIToolCall, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return "", nil, fmt.Errorf("rate limited: %w", err)
	}

	reqBody := map[string]interface{}{
		"model":    c.cfg.Model,
		"messages": messages,
		"stream":   false,
	}
	if len(tools) > 0 {
		reqBody["tools"] = tools
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", nil, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.cfg.BaseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		errMsg := string(body)
		if len(errMsg) > 200 {
			errMsg = errMsg[:200] + "...[truncated]"
		}
		return "", nil, fmt.Errorf("LLM %d: %s", resp.StatusCode, errMsg)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content   string                 `json:"content"`
				ToolCalls []model.OpenAIToolCall  `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", nil, err
	}

	if len(result.Choices) == 0 {
		return "", nil, fmt.Errorf("empty LLM response")
	}

	msg := result.Choices[0].Message
	return msg.Content, msg.ToolCalls, nil
}
