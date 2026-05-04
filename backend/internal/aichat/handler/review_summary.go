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

// ReviewSummaryHandler handles AI-generated review summaries.
type ReviewSummaryHandler struct {
	llm   *service.LLMClient
	registry *service.ToolRegistry
	cache *store.AICacheStore
	ps    *productstore.ProductStore
}

func NewReviewSummaryHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore, ps *productstore.ProductStore) *ReviewSummaryHandler {
	return &ReviewSummaryHandler{llm: llm, registry: registry, cache: cache, ps: ps}
}

type ReviewSummaryResponse struct {
	PositiveKeywords []string `json:"positive_keywords"`
	NegativeKeywords []string `json:"negative_keywords"`
	BestFor          []string `json:"best_for"`
	Summary          string   `json:"summary"`
}

// Get handles GET /api/v1/ai/review-summary?product_id=X
func (h *ReviewSummaryHandler) Get(c *gin.Context) {
	productID := c.Query("product_id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id is required"})
		return
	}

	language := c.DefaultQuery("language", "zh")
	cacheKey := fmt.Sprintf("review_summary:%s:%s", productID, language)

	// Check cache (24h TTL)
	var cached ReviewSummaryResponse
	if err := h.cache.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, gin.H{"data": cached})
		return
	}

	start := time.Now()

	// Fetch product name
	tctx := model.ToolContext{Language: language}
	productData, _, err := h.registry.Execute("get_product_detail", fmt.Sprintf(`{"product_id":%s}`, productID), tctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	productName := ""
	if pm, ok := productData.(map[string]interface{}); ok {
		if name, ok := pm["name"].(string); ok {
			productName = name
		}
	}

	// Fetch reviews
	reviewData, _, err := h.registry.Execute("get_reviews", fmt.Sprintf(`{"product_id":%s,"limit":50}`, productID), tctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch reviews"})
		return
	}

	reviewJSON, _ := json.Marshal(reviewData)

	// Check if there are enough reviews
	if rm, ok := reviewData.(map[string]interface{}); ok {
		if total, ok := rm["total"].(int); ok && total < 3 {
			// Not enough reviews for meaningful summary
			c.JSON(http.StatusOK, gin.H{
				"data": ReviewSummaryResponse{
					PositiveKeywords: []string{},
					NegativeKeywords: []string{},
					BestFor:          []string{},
					Summary:          "评价数量不足，暂无AI摘要",
				},
			})
			return
		}
	}

	// Build LLM prompt
	systemPrompt := service.BuildPrompt("review_summary", productName, string(reviewJSON))
	messages := []service.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: "请生成评价摘要"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Review summary LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("review_summary", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	// Parse structured response
	var result ReviewSummaryResponse
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		result = ReviewSummaryResponse{
			Summary: content,
		}
	}

	// Cache for 24 hours
	go h.cache.Set(cacheKey, "review_summary", result, 24*time.Hour)

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("review_summary", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
