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
	"github.com/gin-gonic/gin"
)

// ProductFitHandler handles "Is this right for me?" analysis.
type ProductFitHandler struct {
	llm      *service.LLMClient
	registry *service.ToolRegistry
	cache    *store.AICacheStore
}

func NewProductFitHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore) *ProductFitHandler {
	return &ProductFitHandler{llm: llm, registry: registry, cache: cache}
}

type ProductFitRequest struct {
	ProductID uint       `json:"product_id" binding:"required"`
	Profile   FitProfile `json:"profile" binding:"required"`
	Language  string     `json:"language"`
}

type FitProfile struct {
	Adults   int   `json:"adults"`
	Children []int `json:"children"` // ages
}

type FitItem struct {
	Icon string `json:"icon"`
	Text string `json:"text"`
}

type ProductFitResponse struct {
	FitItems       []FitItem `json:"fit_items"`
	Recommendation string    `json:"recommendation"`
}

// Check handles POST /api/v1/ai/product-fit
func (h *ProductFitHandler) Check(c *gin.Context) {
	var req ProductFitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product_id and profile are required"})
		return
	}
	if req.Language == "" {
		req.Language = "zh"
	}

	// Validate children ages (#7 fix)
	if len(req.Profile.Children) > 10 {
		req.Profile.Children = req.Profile.Children[:10]
	}
	for i, age := range req.Profile.Children {
		if age < 0 {
			req.Profile.Children[i] = 0
		} else if age > 17 {
			req.Profile.Children[i] = 17
		}
	}

	start := time.Now()

	// Check cache
	cacheKey := fmt.Sprintf("product_fit:%d:%d:%v", req.ProductID, req.Profile.Adults, req.Profile.Children)
	var cached ProductFitResponse
	if err := h.cache.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, gin.H{"data": cached})
		return
	}

	// Fetch product data
	tctx := model.ToolContext{Language: req.Language}
	productData, _, err := h.registry.Execute("get_product_detail", fmt.Sprintf(`{"product_id":%d}`, req.ProductID), tctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	productJSON, _ := json.Marshal(productData)
	profileJSON, _ := json.Marshal(req.Profile)

	// Build LLM prompt
	systemPrompt := service.BuildPrompt("product_fit", string(productJSON), string(profileJSON))
	messages := []service.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: "请分析这个产品是否适合我"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Product fit LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("product_fit", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	// Parse structured response
	var result ProductFitResponse
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		// Fallback: wrap raw content
		result = ProductFitResponse{
			FitItems:       []FitItem{{Icon: "💡", Text: content}},
			Recommendation: "",
		}
	}

	// Cache for 1 hour
	go h.cache.Set(cacheKey, "product_fit", result, 1*time.Hour)

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("product_fit", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
