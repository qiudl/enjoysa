package llmprovider

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

	"golang.org/x/time/rate"

	"enjoysa-backend/internal/core/logger"
)

// openAICompatClient is the shared streaming + JSON impl that both
// DeepSeek and GLM build on. They differ only in baseURL, apiKey,
// model default, and the `code` they advertise.
type openAICompatClient struct {
	code     string
	baseURL  string
	apiKey   string
	model    string
	client   *http.Client
	limiter  *rate.Limiter
}

func newOpenAICompatClient(code, baseURL, apiKey, model string) *openAICompatClient {
	return &openAICompatClient{
		code:    code,
		baseURL: baseURL,
		apiKey:  apiKey,
		model:   model,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
		limiter: rate.NewLimiter(rate.Limit(10), 20),
	}
}

func (c *openAICompatClient) chatStream(ctx context.Context, req Request, onEvent func(StreamEvent) bool) error {
	if err := c.limiter.Wait(ctx); err != nil {
		return fmt.Errorf("%s rate limited: %w", c.code, err)
	}

	model := req.Model
	if model == "" {
		model = c.model
	}
	body := map[string]any{
		"model":    model,
		"messages": req.Messages,
		"stream":   true,
	}
	if len(req.Tools) > 0 {
		body["tools"] = req.Tools
	}

	resp, err := c.do(ctx, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s returned %d: %s", c.code, resp.StatusCode, truncate(string(raw), 200))
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)

	toolCallArgs := make(map[int]*strings.Builder)
	toolCallMeta := make(map[int]ToolCall)

	flushToolCalls := func(reason string) bool {
		if len(toolCallMeta) == 0 {
			return true
		}
		var tcs []ToolCall
		for idx, tc := range toolCallMeta {
			if sb, ok := toolCallArgs[idx]; ok {
				tc.Function.Arguments = sb.String()
			}
			tcs = append(tcs, tc)
		}
		cont := onEvent(StreamEvent{
			Type:         "tool_calls",
			ToolCalls:    tcs,
			FinishReason: reason,
		})
		toolCallArgs = make(map[int]*strings.Builder)
		toolCallMeta = make(map[int]ToolCall)
		return cont
	}

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
			if !flushToolCalls("") {
				return nil
			}
			onEvent(StreamEvent{Type: "done"})
			return nil
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			logger.Warnf("[%s] bad SSE chunk: %v", c.code, err)
			continue
		}
		if len(chunk.Choices) == 0 {
			continue
		}

		choice := chunk.Choices[0]

		if choice.Delta.Content != "" {
			if !onEvent(StreamEvent{Type: "content", Content: choice.Delta.Content}) {
				return nil
			}
		}

		for _, tc := range choice.Delta.ToolCalls {
			if tc.ID != "" {
				toolCallMeta[tc.Index] = ToolCall{
					ID:   tc.ID,
					Type: "function",
					Function: FunctionCall{Name: tc.Function.Name},
				}
				toolCallArgs[tc.Index] = &strings.Builder{}
			}
			if tc.Function.Arguments != "" {
				if sb, ok := toolCallArgs[tc.Index]; ok {
					sb.WriteString(tc.Function.Arguments)
				}
			}
		}

		if choice.FinishReason != nil {
			switch *choice.FinishReason {
			case "tool_calls":
				if !flushToolCalls("tool_calls") {
					return nil
				}
			case "stop":
				totalTokens := 0
				if chunk.Usage != nil {
					totalTokens = chunk.Usage.TotalTokens
				}
				onEvent(StreamEvent{Type: "done", TotalTokens: totalTokens})
				return nil
			}
		}
	}

	return scanner.Err()
}

func (c *openAICompatClient) chatJSON(ctx context.Context, req Request) (string, []ToolCall, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return "", nil, fmt.Errorf("%s rate limited: %w", c.code, err)
	}

	model := req.Model
	if model == "" {
		model = c.model
	}
	body := map[string]any{
		"model":    model,
		"messages": req.Messages,
		"stream":   false,
	}
	if len(req.Tools) > 0 {
		body["tools"] = req.Tools
	}

	resp, err := c.do(ctx, body)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return "", nil, fmt.Errorf("%s returned %d: %s", c.code, resp.StatusCode, truncate(string(raw), 200))
	}

	msg, err := decodeChatJSONMessage(resp.Body, c.code)
	if err != nil {
		return "", nil, err
	}
	return msg.Content, msg.ToolCalls, nil
}

// chatJSONMessage is the same call but returns the full Message (incl
// ReasoningContent). Used by tool-loop callers that must echo the assistant
// turn verbatim on subsequent requests (DeepSeek thinking-mode requirement).
func (c *openAICompatClient) chatJSONMessage(ctx context.Context, req Request) (Message, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return Message{}, fmt.Errorf("%s rate limited: %w", c.code, err)
	}

	model := req.Model
	if model == "" {
		model = c.model
	}
	body := map[string]any{
		"model":    model,
		"messages": req.Messages,
		"stream":   false,
	}
	if len(req.Tools) > 0 {
		body["tools"] = req.Tools
	}

	resp, err := c.do(ctx, body)
	if err != nil {
		return Message{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return Message{}, fmt.Errorf("%s returned %d: %s", c.code, resp.StatusCode, truncate(string(raw), 200))
	}

	return decodeChatJSONMessage(resp.Body, c.code)
}

// decodeChatJSONMessage parses the OpenAI-shape choices[0].message into our
// Message type, capturing reasoning_content alongside content + tool_calls.
func decodeChatJSONMessage(body io.Reader, code string) (Message, error) {
	var result struct {
		Choices []struct {
			Message struct {
				Role             string     `json:"role"`
				Content          string     `json:"content"`
				ReasoningContent string     `json:"reasoning_content"`
				ToolCalls        []ToolCall `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return Message{}, fmt.Errorf("%s decode: %w", code, err)
	}
	if len(result.Choices) == 0 {
		return Message{}, fmt.Errorf("%s empty choices", code)
	}
	m := result.Choices[0].Message
	role := m.Role
	if role == "" {
		role = "assistant"
	}
	return Message{
		Role:             role,
		Content:          m.Content,
		ReasoningContent: m.ReasoningContent,
		ToolCalls:        m.ToolCalls,
	}, nil
}

func (c *openAICompatClient) do(ctx context.Context, body map[string]any) (*http.Response, error) {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("%s marshal: %w", c.code, err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("%s build request: %w", c.code, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s request: %w", c.code, err)
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		resp.Body.Close()
		time.Sleep(time.Second)
		resp, err = c.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("%s retry: %w", c.code, err)
		}
	}
	return resp, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "...[truncated]"
}

// streamChunk mirrors the OpenAI SSE shape (also matches DeepSeek + GLM).
type streamChunk struct {
	Choices []struct {
		Delta struct {
			Content   string `json:"content"`
			ToolCalls []struct {
				Index    int    `json:"index"`
				ID       string `json:"id,omitempty"`
				Type     string `json:"type,omitempty"`
				Function struct {
					Name      string `json:"name,omitempty"`
					Arguments string `json:"arguments,omitempty"`
				} `json:"function,omitempty"`
			} `json:"tool_calls,omitempty"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
}
