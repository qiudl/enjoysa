package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/core/logger"
	"github.com/gin-gonic/gin"
)

// SmartSearchHandler handles AI-powered natural language search.
type SmartSearchHandler struct {
	llm      *service.LLMClient
	registry *service.ToolRegistry
	cache    *store.AICacheStore
}

func NewSmartSearchHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore) *SmartSearchHandler {
	return &SmartSearchHandler{llm: llm, registry: registry, cache: cache}
}

type SmartSearchRequest struct {
	Query    string `json:"query" binding:"required"`
	Language string `json:"language"`
}

type SmartSearchResponse struct {
	Intent   SmartSearchIntent        `json:"intent"`
	Products []map[string]interface{} `json:"products"`
	Tip      string                   `json:"tip"`
}

type SmartSearchIntent struct {
	Tags   []string `json:"tags"`
	Parsed string   `json:"parsed"`
}

// Search handles POST /api/v1/ai/smart-search
func (h *SmartSearchHandler) Search(c *gin.Context) {
	var req SmartSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query is required"})
		return
	}
	if req.Language == "" {
		req.Language = "zh"
	}

	start := time.Now()

	// Build messages with system prompt
	systemPrompt := service.BuildPrompt("smart_search", service.CurrentTimeStr(), req.Language)
	userMsg := req.Query

	messages := []service.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userMsg},
	}

	// Get available tools (guest-safe query tools)
	tools := h.registry.GetOpenAITools(false)

	// Call LLM with function calling
	content, toolCalls, err := h.llm.ChatJSON(c.Request.Context(), messages, tools)
	if err != nil {
		logger.Error("Smart search LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("smart_search", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	// Execute tool calls if any
	var products []map[string]interface{}
	tctx := model.ToolContext{Language: req.Language}

	// Get user ID if authenticated
	if userID, exists := c.Get("userID"); exists {
		if uid, ok := userID.(uint); ok {
			tctx.UserID = &uid
		}
	}

	for _, tc := range toolCalls {
		result, _, execErr := h.registry.Execute(tc.Function.Name, tc.Function.Arguments, tctx)
		if execErr != nil {
			logger.Warn("Tool %s failed in smart search: %v", tc.Function.Name, execErr)
			continue
		}

		// Extract products from tool result
		if resultMap, ok := result.(map[string]interface{}); ok {
			if prods, ok := resultMap["products"].([]map[string]interface{}); ok {
				products = prods
			}
		}

		// If LLM needs to see tool result, do a follow-up call
		if content == "" {
			toolResultJSON, _ := json.Marshal(result)
			messages = append(messages,
				service.ChatMessage{
					Role:      "assistant",
					ToolCalls: []model.OpenAIToolCall{tc},
				},
				service.ChatMessage{
					Role:       "tool",
					Content:    string(toolResultJSON),
					ToolCallID: tc.ID,
				},
			)
			content, _, _ = h.llm.ChatJSON(c.Request.Context(), messages, nil)
		}
	}

	// Parse intent tags from content
	intent := parseIntent(content, req.Query)

	// Use content as tip
	tip := content
	if len(tip) > 200 {
		tip = string([]rune(tip)[:200])
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("smart_search", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{
		"data": SmartSearchResponse{
			Intent:   intent,
			Products: products,
			Tip:      tip,
		},
	})
}

func parseIntent(content, query string) SmartSearchIntent {
	// Try to extract structured intent from LLM response
	// Fallback: generate simple tags from query keywords
	tags := []string{}
	parsed := query

	// Common tag keywords mapping
	tagMap := map[string]string{
		"亲子": "亲子", "family": "亲子", "小孩": "亲子", "孩子": "亲子", "儿童": "亲子",
		"一日": "一日游", "一天": "一日游", "day trip": "一日游",
		"周末": "周末", "weekend": "周末",
		"浪漫": "浪漫", "romantic": "浪漫", "双人": "浪漫",
		"冒险": "冒险", "adventure": "冒险",
		"美食": "美食", "food": "美食", "吃": "美食",
		"酒庄": "品酒", "wine": "品酒", "品酒": "品酒",
		"自然": "自然", "nature": "自然", "动物": "动物", "wildlife": "动物",
	}

	seen := map[string]bool{}
	for keyword, tag := range tagMap {
		if containsCI(query, keyword) && !seen[tag] {
			tags = append(tags, tag)
			seen[tag] = true
		}
	}

	if len(tags) > 0 {
		parsed = joinTags(tags)
	}

	return SmartSearchIntent{
		Tags:   tags,
		Parsed: parsed,
	}
}

func containsCI(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 &&
		(indexOf(toLower(s), toLower(substr)) >= 0)
}

func toLower(s string) string {
	runes := []rune(s)
	for i, r := range runes {
		if r >= 'A' && r <= 'Z' {
			runes[i] = r + 32
		}
	}
	return string(runes)
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func joinTags(tags []string) string {
	result := ""
	for i, t := range tags {
		if i > 0 {
			result += " · "
		}
		result += t
	}
	return result
}
