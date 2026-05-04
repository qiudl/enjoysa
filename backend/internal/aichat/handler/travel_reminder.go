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

// TravelReminderHandler generates pre-trip reminders.
type TravelReminderHandler struct {
	llm      *service.LLMClient
	registry *service.ToolRegistry
	cache    *store.AICacheStore
}

func NewTravelReminderHandler(llm *service.LLMClient, registry *service.ToolRegistry, cache *store.AICacheStore) *TravelReminderHandler {
	return &TravelReminderHandler{llm: llm, registry: registry, cache: cache}
}

const travelReminderPrompt = `你是旅行出行助手。根据产品信息生成出行提醒。

产品数据：
%s

出行日期：%s

输出 JSON 格式：
{
  "weather": "天气建议（如没有真实天气数据，给出该季节一般建议）",
  "clothing": "穿着建议",
  "meeting_point": "集合点信息（从产品地址提取）",
  "items": ["建议携带物品1","物品2","物品3"],
  "highlight": "当日亮点/期待（基于产品描述生成一句话）",
  "voucher_tip": "电子凭证提示"
}

规则：
1. 只输出 JSON
2. 建议要具体实用
3. 穿着建议考虑南澳季节特点`

// Get handles GET /api/v1/ai/travel-reminder?order_id=X
func (h *TravelReminderHandler) Get(c *gin.Context) {
	orderIDStr := c.Query("order_id")
	if orderIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id is required"})
		return
	}
	orderID, err := strconv.ParseUint(orderIDStr, 10, 64)
	if err != nil || orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order_id"})
		return
	}

	language := c.DefaultQuery("language", "zh")
	productIDStr := c.Query("product_id")
	bookingDate := c.Query("booking_date")

	cacheKey := fmt.Sprintf("travel_reminder:%d", orderID)
	var cached map[string]interface{}
	if err := h.cache.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, gin.H{"data": cached})
		return
	}

	start := time.Now()

	// Fetch product detail
	tctx := model.ToolContext{Language: language}
	var productJSON []byte
	if productIDStr != "" {
		data, _, err := h.registry.Execute("get_product_detail", fmt.Sprintf(`{"product_id":%s}`, productIDStr), tctx)
		if err == nil {
			productJSON, _ = json.Marshal(data)
		}
	}
	if productJSON == nil {
		productJSON = []byte("{}")
	}

	if bookingDate == "" {
		bookingDate = time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	}

	prompt := fmt.Sprintf(travelReminderPrompt, string(productJSON), bookingDate)
	messages := []service.ChatMessage{
		{Role: "system", Content: prompt},
		{Role: "user", Content: "请生成出行提醒"},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Travel reminder LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("travel_reminder", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		result = map[string]interface{}{"raw": content}
	}

	go h.cache.Set(cacheKey, "travel_reminder", result, 12*time.Hour)

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("travel_reminder", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
