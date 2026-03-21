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

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
)

// AIService handles communication with AI providers (DeepSeek / OpenAI compatible).
type AIService struct {
	cfg    config.AIConfig
	client *http.Client
}

func NewAIService(cfg config.AIConfig) *AIService {
	return &AIService{
		cfg: cfg,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// StreamCallback is called for each token chunk. Return false to stop.
type StreamCallback func(chunk string) bool

// ChatStream sends messages to the AI provider and streams the response via callback.
// The context allows cancellation when the client disconnects.
func (s *AIService) ChatStream(ctx context.Context, messages []Message, cb StreamCallback) error {
	reqBody := map[string]interface{}{
		"model":    s.cfg.Model,
		"messages": messages,
		"stream":   true,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.cfg.BaseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		logger.Errorf("[AIService] provider returned %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("provider returned status %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			if !cb(chunk.Choices[0].Delta.Content) {
				break
			}
		}
	}

	return scanner.Err()
}

// SystemPrompt builds the system prompt for the C-end travel assistant.
func SystemPrompt(lang, pageContext string) string {
	var sb strings.Builder

	if lang == "zh" || strings.HasPrefix(lang, "zh") {
		sb.WriteString(`你是"畅游南澳 EnjoySA"的 AI 旅游助手。你的职责是帮助用户了解南澳大利亚的旅游产品、景点、行程规划和预订流程。

规则：
- 友好、专业地回答与南澳旅游相关的问题
- 如果用户询问非旅游话题，礼貌地引导回旅游主题
- 回答简洁明了，避免过长的段落
- 如果不确定具体产品信息，建议用户查看产品详情页或联系客服
- 使用中文回答
`)
	} else {
		sb.WriteString(`You are the AI travel assistant for "EnjoySA - Explore South Australia". Your role is to help users learn about South Australia's tourism products, attractions, itinerary planning, and booking process.

Rules:
- Answer travel-related questions about South Australia in a friendly, professional manner
- If users ask about non-travel topics, politely guide them back to travel
- Keep answers concise and clear
- If unsure about specific product details, suggest checking the product page or contacting support
- Reply in English
`)
	}

	if pageContext != "" {
		sb.WriteString("\nCurrent page context:\n")
		sb.WriteString(pageContext)
	}

	return sb.String()
}
