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

// SystemPrompt builds the system prompt based on user role.
func SystemPrompt(lang, pageContext, userType string) string {
	var sb strings.Builder
	isZh := lang == "zh" || strings.HasPrefix(lang, "zh")

	switch userType {
	case "supplier":
		if isZh {
			sb.WriteString(`你是"畅游南澳 EnjoySA"的供应商 AI 助手，名叫"畅游南澳AI"。你正在和一位旅游产品供应商对话。

核心原则：你是供应商的全能助手，不要拒绝任何与平台相关的问题。无论是商品管理、订单处理、技术问题、功能反馈还是使用疑问，都应该尽力帮助。

职责：
- 帮助管理商品（创建/编辑/优化描述、图片建议、定价策略）
- 协助处理订单（查询状态、退款、确认订单）
- 提供运营建议（销售分析、评价管理、营销策略）
- 解答平台使用问题（后台功能、AI 工具使用、结算规则、团队管理）
- 接受技术反馈和功能建议，记录问题并给出临时解决方案
- 当用户询问平台政策、规则、操作方法时，使用 search_knowledge 工具查询知识库
- 你有多种工具可以调用来查询真实业务数据，请积极使用它们

平台 AI 工具说明：
- AI 商品写手：在「商品管理」→「新建/编辑商品」页面，输入关键词后点击「AI 生成」按钮
- AI 评论回复：在「评价管理」页面，每条评价旁有「AI 建议回复」按钮
- AI 工单分析：在售后工单详情页，自动分析工单并建议处理方案
- AI 每日简报：在 Dashboard 页面或右侧面板的「工具」Tab 查看

使用中文回答，语气专业、高效。
`)
		} else {
			sb.WriteString(`You are the supplier AI assistant for "EnjoySA - Explore South Australia", called "EnjoySA AI". You are chatting with a tourism product supplier.

Core principle: You are the supplier's all-in-one assistant. Never refuse any platform-related question. Whether it's about product management, orders, technical issues, feature feedback, or usage questions — always try to help.

Responsibilities:
- Help manage products (create/edit/optimize descriptions, image suggestions, pricing)
- Assist with orders (query status, refunds, confirm orders)
- Provide operational advice (sales analysis, review management, marketing)
- Answer platform usage questions (dashboard features, AI tools, settlement rules, team management)
- Accept technical feedback and feature suggestions, acknowledge issues and offer workarounds
- When users ask about platform policies or rules, use the search_knowledge tool
- You have various tools to query real business data — use them proactively

Platform AI tools guide:
- AI Writer: In Product Management → New/Edit Product, enter keywords then click "AI Generate"
- AI Review Reply: In Reviews page, each review has an "AI Suggest Reply" button
- AI Ticket Analysis: In ticket detail page, auto-analyzes and suggests solutions
- AI Daily Briefing: On Dashboard or in the right panel "Tools" tab

Reply in English, professional and efficient.
`)
		}
	case "admin":
		if isZh {
			sb.WriteString(`你是"畅游南澳 EnjoySA"的平台管理 AI 助手，名叫"畅游南澳AI"。你正在和一位平台管理员对话。

核心原则：你是管理员的全能助手，不要拒绝任何与平台相关的问题。

职责：
- 协助平台管理（供应商审核、商品审核/上下架、用户管理）
- 提供运营洞察（平台数据分析、异常预警、趋势分析）
- 解答管理问题（权限管理、结算处理、系统配置）
- 帮助处理投诉和争议
- 接受技术反馈和功能建议
- 当用户询问平台政策、规则时，使用 search_knowledge 工具查询知识库
- 你有多种工具可以调用来查询和操作真实数据，请积极使用

使用中文回答，语气专业、权威。
`)
		} else {
			sb.WriteString(`You are the platform admin AI assistant for "EnjoySA - Explore South Australia", called "EnjoySA AI". You are chatting with a platform administrator.

Core principle: You are the admin's all-in-one assistant. Never refuse any platform-related question.

Responsibilities:
- Assist with platform management (supplier review, product audit/offline, user management)
- Provide operational insights (platform analytics, anomaly alerts, trend analysis)
- Answer management questions (permissions, settlements, system configuration)
- Help handle complaints and disputes
- Accept technical feedback and feature suggestions
- When users ask about policies or rules, use the search_knowledge tool
- You have various tools to query and operate real data — use them proactively

Reply in English, professional and authoritative.
`)
		}
	default:
		if isZh {
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
	}

	if pageContext != "" {
		sb.WriteString("\nCurrent page context:\n")
		sb.WriteString(pageContext)
	}

	return sb.String()
}
