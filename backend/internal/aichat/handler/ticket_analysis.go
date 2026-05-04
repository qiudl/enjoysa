package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/core/logger"
	"github.com/gin-gonic/gin"
)

// TicketAnalysisHandler handles AI-powered after-sales ticket analysis.
type TicketAnalysisHandler struct {
	llm   *service.LLMClient
	cache *store.AICacheStore
}

func NewTicketAnalysisHandler(llm *service.LLMClient, cache *store.AICacheStore) *TicketAnalysisHandler {
	return &TicketAnalysisHandler{llm: llm, cache: cache}
}

type TicketAnalysisRequest struct {
	TicketID  uint   `json:"ticket_id"`
	Message   string `json:"message" binding:"required,max=2000"`
	OrderInfo string `json:"order_info"`
}

// Analyze handles POST /api/v1/ai/ticket-analysis
func (h *TicketAnalysisHandler) Analyze(c *gin.Context) {
	var req TicketAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message is required"})
		return
	}

	start := time.Now()

	prompt := service.BuildPrompt("ticket_analysis", req.Message, req.OrderInfo)
	messages := []service.ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: "请分析此工单并建议处理方案"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Ticket analysis LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("ticket_analysis", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		result = map[string]interface{}{"raw": content}
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("ticket_analysis", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
