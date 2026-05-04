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

// ReviewReplyHandler handles AI-generated review reply suggestions.
type ReviewReplyHandler struct {
	llm   *service.LLMClient
	cache *store.AICacheStore
}

func NewReviewReplyHandler(llm *service.LLMClient, cache *store.AICacheStore) *ReviewReplyHandler {
	return &ReviewReplyHandler{llm: llm, cache: cache}
}

type ReviewReplyRequest struct {
	ReviewID    uint   `json:"review_id"`
	ReviewText  string `json:"review_text" binding:"required,max=2000"`
	Rating      int    `json:"rating" binding:"required,min=1,max=5"`
	ProductName string `json:"product_name" binding:"required,max=200"`
}

// Suggest handles POST /api/v1/ai/review-reply
func (h *ReviewReplyHandler) Suggest(c *gin.Context) {
	var req ReviewReplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "review_text, rating, and product_name are required"})
		return
	}

	start := time.Now()

	prompt := service.BuildPrompt("review_reply", req.ProductName, req.ReviewText, req.Rating)
	messages := []service.ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: "请生成回复建议"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Review reply LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("review_reply", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	// Try to extract clean reply (LLM may wrap in JSON or return plain text)
	reply := content
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(content), &parsed); err == nil {
		if r, ok := parsed["reply"].(string); ok {
			reply = r
		}
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("review_reply", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"reply":      reply,
			"review_id":  req.ReviewID,
		},
	})
}
