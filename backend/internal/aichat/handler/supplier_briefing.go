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

// SupplierBriefingHandler generates daily AI briefing for suppliers.
type SupplierBriefingHandler struct {
	llm   *service.LLMClient
	cache *store.AICacheStore
}

func NewSupplierBriefingHandler(llm *service.LLMClient, cache *store.AICacheStore) *SupplierBriefingHandler {
	return &SupplierBriefingHandler{llm: llm, cache: cache}
}

const supplierBriefingPrompt = `你是供应商运营助手。根据以下数据生成每日简报。

当前日期：%s

任务：输出 JSON 格式：
{
  "stats": [
    {"icon": "📈", "text": "关键数据点", "trend": "up|down|warn", "change": "+18%%"}
  ],
  "suggestion": "运营建议（1-2句话，具体可执行）"
}

规则：
1. stats 包含 3-5 个关键数据点
2. 每个 stat 标注趋势方向
3. suggestion 要具体、可执行
4. 只输出 JSON
5. 如果没有真实数据，基于南澳旅游行业常规给出示例建议`

// Get handles GET /api/v1/ai/supplier-briefing
func (h *SupplierBriefingHandler) Get(c *gin.Context) {
	supplierID, exists := c.Get("supplierID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "supplier auth required"})
		return
	}

	today := time.Now().Format("2006-01-02")
	cacheKey := fmt.Sprintf("supplier_briefing:%v:%s", supplierID, today)

	var cached map[string]interface{}
	if err := h.cache.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, gin.H{"data": cached})
		return
	}

	start := time.Now()

	prompt := fmt.Sprintf(supplierBriefingPrompt, today)
	messages := []service.ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: "请生成今日运营简报"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Supplier briefing LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("supplier_briefing", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		result = map[string]interface{}{"raw": content}
	}

	go h.cache.Set(cacheKey, "supplier_briefing", result, 24*time.Hour)

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("supplier_briefing", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
