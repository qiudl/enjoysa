package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/core/logger"
	"github.com/gin-gonic/gin"
)

// ProductPrecheckHandler handles AI-powered product quality pre-check.
type ProductPrecheckHandler struct {
	llm      *service.LLMClient
	registry *service.ToolRegistry
	cache    *store.AICacheStore
}

func NewProductPrecheckHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore) *ProductPrecheckHandler {
	return &ProductPrecheckHandler{llm: llm, registry: registry, cache: cache}
}

// Check handles GET /api/v1/ai/product-precheck?product_id=X
func (h *ProductPrecheckHandler) Check(c *gin.Context) {
	productIDStr := c.Query("product_id")
	pid, err := strconv.ParseUint(productIDStr, 10, 64)
	if err != nil || pid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid product_id is required"})
		return
	}

	cacheKey := fmt.Sprintf("product_precheck:%d", pid)
	var cached map[string]interface{}
	if err := h.cache.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, gin.H{"data": cached})
		return
	}

	start := time.Now()
	tctx := model.ToolContext{Language: "zh"}
	productData, _, err := h.registry.Execute("get_product_detail", fmt.Sprintf(`{"product_id":%d}`, pid), tctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	productJSON, _ := json.Marshal(productData)

	// Rule-based scoring
	score := 100
	risks := []string{}

	pm, _ := productData.(map[string]interface{})
	if desc, ok := pm["description"].(string); ok && len([]rune(desc)) < 50 {
		score -= 30
		risks = append(risks, "描述过短（<50字）")
	}
	if img, ok := pm["image_url"].(string); ok && img == "" {
		score -= 25
		risks = append(risks, "无产品图片")
	}
	if price, ok := pm["price_from"].(float64); ok && price < 5 {
		score -= 20
		risks = append(risks, fmt.Sprintf("价格异常（A$%.0f）", price))
	}
	if highlights, ok := pm["highlights"].([]interface{}); ok && len(highlights) < 2 {
		score -= 10
		risks = append(risks, "亮点不足（<2条）")
	}
	if faqs, ok := pm["faqs"].([]interface{}); ok && len(faqs) < 2 {
		score -= 10
		risks = append(risks, "FAQ 不足（<2条）")
	}

	recommendation := "approve"
	if score < 50 {
		recommendation = "reject"
	} else if score < 70 {
		recommendation = "review"
	}

	result := map[string]interface{}{
		"score":          score,
		"risks":          risks,
		"recommendation": recommendation,
		"product_id":     pid,
	}

	// Only call LLM for borderline cases
	if score >= 40 && score < 80 && len(productJSON) > 0 {
		messages := []service.ChatMessage{
			{Role: "system", Content: "你是产品质量审核员。评估产品内容质量，给出简短建议（50字以内）。产品数据：" + string(productJSON)},
			{Role: "user", Content: "请评估此产品的内容质量"},
		}
		if content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil); err == nil {
			result["ai_comment"] = content
		}
	}

	go h.cache.Set(cacheKey, "product_precheck", result, 1*time.Hour)

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("product_precheck", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// AdminInsightsHandler generates platform-level AI insights.
type AdminInsightsHandler struct {
	llm   *service.LLMClient
	cache *store.AICacheStore
}

func NewAdminInsightsHandler(llm *service.LLMClient, cache *store.AICacheStore) *AdminInsightsHandler {
	return &AdminInsightsHandler{llm: llm, cache: cache}
}

const adminInsightsPrompt = `你是平台运营分析师。生成本周运营洞察。

当前日期：%s

输出 JSON 格式：
{
  "period": "本周",
  "insights": ["洞察1", "洞察2", "洞察3"],
  "alerts": ["异常告警（如有）"]
}

规则：
1. 生成 3-5 条具体洞察
2. 洞察要可执行（不是泛泛而谈）
3. 基于南澳旅游平台特点
4. 只输出 JSON`

// Get handles GET /api/v1/ai/admin-insights
func (h *AdminInsightsHandler) Get(c *gin.Context) {
	today := time.Now().Format("2006-01-02")
	cacheKey := fmt.Sprintf("admin_insights:%s", today)

	var cached map[string]interface{}
	if err := h.cache.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, gin.H{"data": cached})
		return
	}

	start := time.Now()

	prompt := fmt.Sprintf(adminInsightsPrompt, today)
	messages := []service.ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: "请生成本周运营洞察"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Admin insights LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("admin_insights", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		result = map[string]interface{}{"raw": content}
	}

	go h.cache.Set(cacheKey, "admin_insights", result, 24*time.Hour)

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("admin_insights", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
