package tools

import (
	"fmt"
	"strings"

	"enjoysa-backend/internal/aichat/model"
	"gorm.io/gorm"
)

// RegisterSearchKnowledge registers the search_knowledge tool for querying the platform knowledge base.
func RegisterSearchKnowledge() model.ToolDef {
	return model.ToolDef{
		Name:        "search_knowledge",
		Description: "搜索平台知识库，查找政策规则、FAQ、操作指南等信息。当用户询问平台规则、操作方法、结算政策等问题时使用。",
		Category:    "query",
		RequiresAuth: true,
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query": map[string]interface{}{
					"type":        "string",
					"description": "搜索关键词，如「结算规则」「退款流程」「如何创建商品」",
				},
				"category": map[string]interface{}{
					"type":        "string",
					"description": "知识分类筛选：policy(政策)/faq(常见问题)/guide(指南)/rule(规则)，不填则搜全部",
					"enum":        []string{"policy", "faq", "guide", "rule"},
				},
			},
			"required": []string{"query"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			db := ctx.DB.(*gorm.DB)

			query, _ := args["query"].(string)
			if query == "" {
				return nil, fmt.Errorf("query is required")
			}

			// Determine audience based on user role context
			audience := "all"
			// ToolContext doesn't carry role directly, but we search both 'all' and role-specific

			// Build search query using keyword matching
			keywords := strings.Fields(query)
			conditions := []string{"deleted_at IS NULL", "is_active = true"}
			params := []interface{}{}

			// Audience filter: show 'all' + role-specific
			conditions = append(conditions, "(audience = 'all' OR audience = ?)")
			params = append(params, audience)

			if cat, ok := args["category"].(string); ok && cat != "" {
				conditions = append(conditions, "category = ?")
				params = append(params, cat)
			}

			// Keyword matching: title ILIKE or keywords ILIKE or content ILIKE
			if len(keywords) > 0 {
				var kwConditions []string
				for _, kw := range keywords {
					pattern := "%" + kw + "%"
					kwConditions = append(kwConditions, "(title ILIKE ? OR keywords ILIKE ? OR content ILIKE ?)")
					params = append(params, pattern, pattern, pattern)
				}
				conditions = append(conditions, "("+strings.Join(kwConditions, " OR ")+")")
			}

			whereClause := strings.Join(conditions, " AND ")

			type KBItem struct {
				ID       uint   `json:"id"`
				Category string `json:"category"`
				Title    string `json:"title"`
				Content  string `json:"content"`
			}

			var items []KBItem
			err := db.Raw(
				"SELECT id, category, title, content FROM ai_knowledge_base WHERE "+whereClause+" ORDER BY sort_order ASC, id ASC LIMIT 5",
				params...,
			).Scan(&items).Error
			if err != nil {
				return nil, fmt.Errorf("knowledge search failed: %w", err)
			}

			if len(items) == 0 {
				return map[string]interface{}{
					"found":   false,
					"message": "未找到相关知识库内容",
				}, nil
			}

			results := make([]map[string]interface{}, len(items))
			for i, item := range items {
				results[i] = map[string]interface{}{
					"category": item.Category,
					"title":    item.Title,
					"content":  item.Content,
				}
			}

			return map[string]interface{}{
				"found":   true,
				"count":   len(results),
				"results": results,
			}, nil
		},
	}
}
