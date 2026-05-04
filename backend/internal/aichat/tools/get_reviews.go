package tools

import (
	"fmt"

	"enjoysa-backend/internal/aichat/model"
	reviewstore "enjoysa-backend/internal/review/store"
)

// RegisterGetReviews registers the get_reviews tool.
func RegisterGetReviews(rs *reviewstore.ReviewStore) model.ToolDef {
	return model.ToolDef{
		Name:        "get_reviews",
		Description: "获取产品的用户评价列表。返回最新的评价内容、评分、用户名。用于 AI 总结评价或回答用户关于评价的问题。",
		Category:    "query",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"product_id": map[string]interface{}{"type": "integer", "description": "产品ID（必填）"},
				"limit":      map[string]interface{}{"type": "integer", "description": "返回数量，默认20，最大50"},
			},
			"required": []string{"product_id"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			pidFloat, ok := args["product_id"].(float64)
			if !ok {
				return nil, fmt.Errorf("product_id is required")
			}
			pid := uint(pidFloat)

			limit := 20
			if lim, ok := args["limit"].(float64); ok {
				limit = int(lim)
				if limit > 50 {
					limit = 50
				}
			}

			reviews, _, err := rs.ListByProduct(pid, 1, limit)
			if err != nil {
				return nil, fmt.Errorf("get reviews failed: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(reviews))
			for _, r := range reviews {
				item := map[string]interface{}{
					"rating":     r.Rating,
					"content":    r.Content,
					"created_at": r.CreatedAt.Format("2006-01-02"),
				}
				if r.User != nil {
					item["user_name"] = r.User.Name
				}
				items = append(items, item)
			}

			return map[string]interface{}{
				"product_id": pid,
				"reviews":    items,
				"total":      len(items),
			}, nil
		},
	}
}
