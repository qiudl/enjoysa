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

// CartSuggestionsHandler handles AI-powered cart recommendations.
type CartSuggestionsHandler struct {
	llm      *service.LLMClient
	registry *service.ToolRegistry
	cache    *store.AICacheStore
}

func NewCartSuggestionsHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore) *CartSuggestionsHandler {
	return &CartSuggestionsHandler{llm: llm, registry: registry, cache: cache}
}

type CartItem struct {
	ProductID uint   `json:"product_id"`
	Date      string `json:"date,omitempty"`
}

type CartSuggestionsRequest struct {
	Items    []CartItem `json:"items" binding:"required,min=1"`
	Language string     `json:"language"`
}

const cartSuggestionsPrompt = `你是旅游行程顾问。分析用户购物车中的产品，给出行程安排建议和搭配推荐。

用户购物车产品数据：
%s

可推荐的其他产品数据：
%s

任务：输出 JSON 格式：
{
  "schedule_analysis": "行程安排分析（地理位置合理性、时间安排建议）",
  "recommendations": [
    {"product_id": 数字, "name": "产品名", "reason": "推荐理由（地理距离/时间互补/主题搭配）", "price": 数字}
  ]
}

规则：
1. 推荐 1-3 个互补产品，不重复购物车中已有的
2. 推荐理由要具体（距离/时间/主题）
3. 只输出 JSON`

// Suggest handles POST /api/v1/ai/cart-suggestions
func (h *CartSuggestionsHandler) Suggest(c *gin.Context) {
	var req CartSuggestionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "items is required"})
		return
	}
	if req.Language == "" {
		req.Language = "zh"
	}

	start := time.Now()
	tctx := model.ToolContext{Language: req.Language}

	// Fetch cart product details
	var cartProducts []interface{}
	cartIDs := map[uint]bool{}
	for _, item := range req.Items {
		cartIDs[item.ProductID] = true
		data, _, err := h.registry.Execute("get_product_detail", fmt.Sprintf(`{"product_id":%d}`, item.ProductID), tctx)
		if err == nil {
			cartProducts = append(cartProducts, data)
		}
	}
	cartJSON, _ := json.Marshal(cartProducts)

	// Fetch other products for recommendations
	otherData, _, _ := h.registry.Execute("search_products", `{"limit":10}`, tctx)
	otherJSON, _ := json.Marshal(otherData)

	// Call LLM
	prompt := fmt.Sprintf(cartSuggestionsPrompt, string(cartJSON), string(otherJSON))
	messages := []service.ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: "请分析我的购物车并推荐搭配产品"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Cart suggestions LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("cart_suggestions", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		result = map[string]interface{}{
			"schedule_analysis": content,
			"recommendations":   []interface{}{},
		}
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("cart_suggestions", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
