package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/core/logger"
	productstore "enjoysa-backend/internal/product/store"
	"github.com/gin-gonic/gin"
)

// ProductQAHandler handles AI-powered product Q&A.
type ProductQAHandler struct {
	llm      *service.LLMClient
	registry *service.ToolRegistry
	cache    *store.AICacheStore
	ps       *productstore.ProductStore
}

func NewProductQAHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore, ps *productstore.ProductStore) *ProductQAHandler {
	return &ProductQAHandler{llm: llm, registry: registry, cache: cache, ps: ps}
}

type ProductQARequest struct {
	ProductID uint   `json:"product_id" binding:"required"`
	Question  string `json:"question" binding:"required"`
	Language  string `json:"language"`
}

// Ask handles POST /api/v1/ai/product-qa
func (h *ProductQAHandler) Ask(c *gin.Context) {
	var req ProductQARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id and question are required"})
		return
	}
	if req.Language == "" {
		req.Language = "zh"
	}

	start := time.Now()

	// Fetch product data via tool
	tctx := model.ToolContext{Language: req.Language}
	productData, _, err := h.registry.Execute("get_product_detail", fmt.Sprintf(`{"product_id":%d}`, req.ProductID), tctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	// Also get reviews for context
	reviewData, _, _ := h.registry.Execute("get_reviews", fmt.Sprintf(`{"product_id":%d,"limit":10}`, req.ProductID), tctx)

	// Build product context string
	productJSON, _ := json.Marshal(productData)
	reviewJSON, _ := json.Marshal(reviewData)
	productContext := fmt.Sprintf("产品数据:\n%s\n\n用户评价:\n%s", string(productJSON), string(reviewJSON))

	// Build LLM messages
	systemPrompt := service.BuildPrompt("product_qa", productContext, service.CurrentTimeStr())
	messages := []service.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: req.Question},
	}

	// Call LLM (no tools needed, product data already in context)
	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Product QA LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("product_qa", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("product_qa", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"answer":  content,
			"sources": []string{"product_detail", "reviews"},
		},
	})
}

// Feedback handles POST /api/v1/ai/product-qa/feedback
func (h *ProductQAHandler) Feedback(c *gin.Context) {
	var req struct {
		ProductID uint   `json:"product_id" binding:"required"`
		Question  string `json:"question" binding:"required"`
		Answer    string `json:"answer" binding:"required"`
		Helpful   bool   `json:"helpful"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := h.cache.SaveFaqFeedback(req.ProductID, req.Question, req.Answer, req.Helpful); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save feedback"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
