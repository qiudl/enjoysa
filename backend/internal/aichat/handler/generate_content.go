package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/core/logger"
	"github.com/gin-gonic/gin"
)

// GenerateContentHandler handles AI-powered product content generation.
type GenerateContentHandler struct {
	llm   *service.LLMClient
	cache *store.AICacheStore
}

func NewGenerateContentHandler(llm *service.LLMClient, cache *store.AICacheStore) *GenerateContentHandler {
	return &GenerateContentHandler{llm: llm, cache: cache}
}

type GenerateContentRequest struct {
	NameZh   string `json:"name_zh" binding:"required,max=200"`
	Keywords string `json:"keywords" binding:"required,max=500"`
}

// Generate handles POST /api/v1/ai/generate-product-content
func (h *GenerateContentHandler) Generate(c *gin.Context) {
	var req GenerateContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name_zh and keywords are required"})
		return
	}

	start := time.Now()

	prompt := service.BuildPrompt("generate_content", req.NameZh, req.Keywords)
	messages := []service.ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: fmt.Sprintf("请为产品「%s」生成完整内容", req.NameZh)},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Generate content LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("generate_content", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		result = map[string]interface{}{"raw": content}
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("generate_content", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
