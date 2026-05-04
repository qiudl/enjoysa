package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/core/logger"
	"github.com/gin-gonic/gin"
)

// ItineraryHandler handles AI-powered itinerary planning with SSE streaming.
type ItineraryHandler struct {
	llm      *service.LLMClient
	registry *service.ToolRegistry
	cache    *store.AICacheStore
}

func NewItineraryHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore) *ItineraryHandler {
	return &ItineraryHandler{llm: llm, registry: registry, cache: cache}
}

type ItineraryRequest struct {
	Travelers struct {
		Adults   int   `json:"adults"`
		Children []int `json:"children"`
	} `json:"travelers"`
	Days        int      `json:"days" binding:"required"`
	Preferences []string `json:"preferences"`
	Budget      float64  `json:"budget"`
	Language    string   `json:"language"`
}

// Plan handles POST /api/v1/ai/plan-itinerary (SSE streaming)
func (h *ItineraryHandler) Plan(c *gin.Context) {
	var req ItineraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "days is required"})
		return
	}
	if req.Language == "" {
		req.Language = "zh"
	}
	if req.Days < 1 || req.Days > 14 {
		req.Days = 3
	}
	if req.Travelers.Adults < 1 {
		req.Travelers.Adults = 2
	}

	start := time.Now()

	// First, gather product data via tools (non-streaming pre-fetch)
	tctx := model.ToolContext{Language: req.Language}
	productsData, _, _ := h.registry.Execute("recommend_attractions", `{"limit":10}`, tctx)
	productsJSON, _ := json.Marshal(productsData)

	// Build user description
	userDesc := fmt.Sprintf("%d天行程，%d大人", req.Days, req.Travelers.Adults)
	if len(req.Travelers.Children) > 0 {
		userDesc += fmt.Sprintf(" + %d小孩（", len(req.Travelers.Children))
		for i, age := range req.Travelers.Children {
			if i > 0 {
				userDesc += "、"
			}
			userDesc += fmt.Sprintf("%d岁", age)
		}
		userDesc += "）"
	}
	if len(req.Preferences) > 0 {
		userDesc += "，偏好："
		for i, p := range req.Preferences {
			if i > 0 {
				userDesc += "、"
			}
			userDesc += p
		}
	}
	if req.Budget > 0 {
		userDesc += fmt.Sprintf("，总预算 A$%.0f", req.Budget)
	}

	// Build LLM messages
	systemPrompt := service.BuildPrompt("itinerary", service.CurrentTimeStr(), req.Language)
	messages := []service.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: fmt.Sprintf("请为我规划行程。\n\n需求：%s\n\n可用产品数据：\n%s", userDesc, string(productsJSON))},
	}

	// Set 120s total timeout for SSE (#9 fix)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer cancel()
	c.Request = c.Request.WithContext(ctx)

	// SSE streaming response
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming not supported"})
		return
	}

	seq := 0
	traceID := fmt.Sprintf("itin-%d", time.Now().UnixMilli())

	writeSSE := func(eventType string, payload interface{}) {
		seq++
		event := model.SSEEvent{
			Type:    eventType,
			TraceID: traceID,
			Seq:     seq,
			Payload: payload,
		}
		data, _ := json.Marshal(event)
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	}

	// Stream LLM response (no tools in streaming phase - data already in context)
	h.llm.ChatStreamFunc(c.Request.Context(), messages, nil, func(evt service.StreamEvent) {
		switch evt.Type {
		case "content":
			writeSSE("content_delta", model.ContentDeltaPayload{Text: evt.Content})
		case "done":
			latencyMs := time.Since(start).Milliseconds()
			writeSSE("done", model.DonePayload{
				ElapsedMs:     latencyMs,
				ContentTokens: evt.TotalTokens,
			})
			go h.cache.SaveMetric("itinerary", int(latencyMs), evt.TotalTokens, true, "")
		case "error":
			writeSSE("error", model.ErrorPayload{Code: "llm_error", Message: "AI service error"})
		}
	})

	// Keepalive handled by stream itself; if context cancelled, stream ends naturally
}

// PlanJSON handles POST /api/v1/ai/plan-itinerary-json (non-streaming fallback)
func (h *ItineraryHandler) PlanJSON(c *gin.Context) {
	var req ItineraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "days is required"})
		return
	}
	if req.Language == "" {
		req.Language = "zh"
	}
	if req.Days < 1 || req.Days > 14 {
		req.Days = 3
	}

	start := time.Now()

	// Pre-fetch products
	tctx := model.ToolContext{Language: req.Language}
	productsData, _, _ := h.registry.Execute("recommend_attractions", `{"limit":10}`, tctx)
	productsJSON, _ := json.Marshal(productsData)

	userDesc := fmt.Sprintf("%d天行程，%d大人", req.Days, req.Travelers.Adults)
	if req.Budget > 0 {
		userDesc += fmt.Sprintf("，总预算 A$%.0f", req.Budget)
	}

	systemPrompt := service.BuildPrompt("itinerary", service.CurrentTimeStr(), req.Language)
	messages := []service.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: fmt.Sprintf("请为我规划行程。\n\n需求：%s\n\n可用产品数据：\n%s", userDesc, string(productsJSON))},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Itinerary LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		return
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("itinerary", latencyMs, 0, true, "")

	// Suppress unused import warning
	_ = io.EOF

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"content":    content,
			"elapsed_ms": latencyMs,
		},
	})
}
