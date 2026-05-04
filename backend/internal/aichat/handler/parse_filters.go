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

// ParseFiltersHandler handles AI-powered natural language to filter conversion.
type ParseFiltersHandler struct {
	llm   *service.LLMClient
	cache *store.AICacheStore
}

func NewParseFiltersHandler(llm *service.LLMClient, cache *store.AICacheStore) *ParseFiltersHandler {
	return &ParseFiltersHandler{llm: llm, cache: cache}
}

type ParseFiltersRequest struct {
	Query    string `json:"query" binding:"required,max=500"`
	Language string `json:"language"`
}

type ParsedFilters struct {
	Keyword      string   `json:"keyword,omitempty"`
	RegionID     *uint    `json:"region_id,omitempty"`
	CategoryID   *uint    `json:"category_id,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	MinPrice     *float64 `json:"min_price,omitempty"`
	MaxPrice     *float64 `json:"max_price,omitempty"`
	MinGroupSize *int     `json:"min_group_size,omitempty"`
}

type ParseFiltersResponse struct {
	Filters ParsedFilters `json:"filters"`
	Display string        `json:"display"`
}

const parseFiltersPrompt = `你是搜索过滤器解析器。将用户的自然语言描述转为结构化筛选条件。

输出 JSON 格式：
{
  "filters": {
    "keyword": "关键词（可选）",
    "tags": ["标签1","标签2"],
    "min_price": 数字或null,
    "max_price": 数字或null,
    "min_group_size": 数字或null
  },
  "display": "一行中文摘要，如：标签=浪漫·≤A$500·2人可参加"
}

可用标签：family(亲子), adventure(冒险), nature(自然), food(美食), wine(品酒), culture(文化), romantic(浪漫), beach(海滩), photography(摄影)

规则：
1. 只输出 JSON，不要其他内容
2. 价格单位为 AUD
3. 尽可能提取具体条件，不确定的字段留空
4. display 用中文，简洁明了`

// Parse handles POST /api/v1/ai/parse-filters
func (h *ParseFiltersHandler) Parse(c *gin.Context) {
	var req ParseFiltersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query is required (max 500 chars)"})
		return
	}
	if req.Language == "" {
		req.Language = "zh"
	}

	start := time.Now()

	messages := []service.ChatMessage{
		{Role: "system", Content: parseFiltersPrompt},
		{Role: "user", Content: req.Query},
	}

	content, _, err := h.llm.ChatJSON(c.Request.Context(), messages, nil)
	if err != nil {
		logger.Error("Parse filters LLM failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
		go h.cache.SaveMetric("parse_filters", int(time.Since(start).Milliseconds()), 0, false, err.Error())
		return
	}

	var result ParseFiltersResponse
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		// Fallback: use query as keyword
		result = ParseFiltersResponse{
			Filters: ParsedFilters{Keyword: req.Query},
			Display: req.Query,
		}
	}

	latencyMs := int(time.Since(start).Milliseconds())
	go h.cache.SaveMetric("parse_filters", latencyMs, 0, true, "")

	c.JSON(http.StatusOK, gin.H{"data": result})
}
