package tools

import (
	"fmt"
	"time"

	"enjoysa-backend/internal/aichat/model"
	productstore "enjoysa-backend/internal/product/store"
)

// RegisterCheckAvailability registers the check_availability tool.
func RegisterCheckAvailability(ss *productstore.ScheduleStore) model.ToolDef {
	return model.ToolDef{
		Name:        "check_availability",
		Description: "查询产品在指定日期范围内的可用时段和剩余名额。用于确认用户想预订的日期是否有空位。",
		Category:    "query",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"product_id": map[string]interface{}{"type": "integer", "description": "产品ID（必填）"},
				"date_from":  map[string]interface{}{"type": "string", "description": "起始日期，格式 YYYY-MM-DD（可选，默认今天）"},
				"date_to":    map[string]interface{}{"type": "string", "description": "结束日期，格式 YYYY-MM-DD（可选，默认起始日期+7天）"},
			},
			"required": []string{"product_id"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			pidFloat, ok := args["product_id"].(float64)
			if !ok {
				return nil, fmt.Errorf("product_id is required")
			}
			pid := uint(pidFloat)

			now := time.Now()
			from := now
			to := now.AddDate(0, 0, 7)

			if df, ok := args["date_from"].(string); ok && df != "" {
				if parsed, err := time.Parse("2006-01-02", df); err == nil {
					from = parsed
				}
			}
			if dt, ok := args["date_to"].(string); ok && dt != "" {
				if parsed, err := time.Parse("2006-01-02", dt); err == nil {
					to = parsed
				}
			}

			schedules, err := ss.ListByProduct(pid, from, to)
			if err != nil {
				return nil, fmt.Errorf("check availability failed: %w", err)
			}

			slots := make([]map[string]interface{}, 0)
			for _, s := range schedules {
				available := s.TotalSlots - s.BookedSlots
				if available < 0 {
					available = 0
				}
				slots = append(slots, map[string]interface{}{
					"date":       s.Date.Format("2006-01-02"),
					"time_slot":  s.TimeSlot,
					"available":  available,
					"total":      s.TotalSlots,
					"status":     s.Status,
					"price":      s.Price,
				})
			}

			return map[string]interface{}{
				"product_id": pid,
				"date_range": map[string]string{
					"from": from.Format("2006-01-02"),
					"to":   to.Format("2006-01-02"),
				},
				"slots": slots,
				"total": len(slots),
			}, nil
		},
	}
}
