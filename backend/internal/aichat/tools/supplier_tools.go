package tools

import (
	"fmt"
	"time"

	"enjoysa-backend/internal/aichat/model"

	"gorm.io/gorm"
)

// ---------- Tool 1: get_order_stats ----------

// RegisterGetOrderStats returns order statistics for a supplier.
func RegisterGetOrderStats() model.ToolDef {
	return model.ToolDef{
		Name:        "get_order_stats",
		Description: "获取供应商订单统计：今日/本周/本月的订单数、收入、取消率",
		Category:    "query",
		RequiresAuth: true,
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"period": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"today", "week", "month"},
					"description": "统计周期：today=今天, week=本周, month=本月，默认 today",
				},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			if ctx.UserID == nil {
				return nil, fmt.Errorf("supplier not authenticated")
			}
			db := ctx.DB.(*gorm.DB)
			supplierID := *ctx.UserID

			period := "today"
			if p, ok := args["period"].(string); ok && (p == "today" || p == "week" || p == "month") {
				period = p
			}

			periodStart := periodStartTime(period)

			type statsRow struct {
				TotalOrders     int64   `json:"total_orders"`
				Revenue         float64 `json:"revenue"`
				CancelledOrders int64   `json:"cancelled_orders"`
			}
			var row statsRow

			err := db.Raw(`
				SELECT
					COUNT(*)                                             AS total_orders,
					COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_price ELSE 0 END), 0) AS revenue,
					COUNT(CASE WHEN status = 'cancelled' THEN 1 END)     AS cancelled_orders
				FROM orders
				WHERE supplier_id = ?
				  AND created_at >= ?
				  AND deleted_at IS NULL
			`, supplierID, periodStart).Scan(&row).Error
			if err != nil {
				return nil, fmt.Errorf("query order stats: %w", err)
			}

			var cancelRate float64
			if row.TotalOrders > 0 {
				cancelRate = float64(row.CancelledOrders) / float64(row.TotalOrders) * 100
			}

			return map[string]interface{}{
				"period":           period,
				"total_orders":     row.TotalOrders,
				"revenue":          row.Revenue,
				"cancelled_orders": row.CancelledOrders,
				"cancel_rate":      fmt.Sprintf("%.1f%%", cancelRate),
			}, nil
		},
	}
}

// ---------- Tool 2: list_pending_orders ----------

// RegisterListPendingOrders lists orders awaiting supplier confirmation.
func RegisterListPendingOrders() model.ToolDef {
	return model.ToolDef{
		Name:         "list_pending_orders",
		Description:  "列出待确认的订单（状态为 paid，等待供应商确认）",
		Category:     "query",
		RequiresAuth: true,
		Parameters: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			if ctx.UserID == nil {
				return nil, fmt.Errorf("supplier not authenticated")
			}
			db := ctx.DB.(*gorm.DB)
			supplierID := *ctx.UserID

			type orderRow struct {
				OrderNo     string    `json:"order_no"`
				ProductName string    `json:"product_name"`
				Quantity    int       `json:"quantity"`
				TotalPrice  float64   `json:"total_price"`
				Currency    string    `json:"currency"`
				BookingDate time.Time `json:"booking_date"`
				CreatedAt   time.Time `json:"created_at"`
			}

			var rows []orderRow
			err := db.Raw(`
				SELECT order_no, product_name, quantity, total_price, currency, booking_date, created_at
				FROM orders
				WHERE supplier_id = ?
				  AND status = 'paid'
				  AND deleted_at IS NULL
				ORDER BY created_at DESC
				LIMIT 10
			`, supplierID).Scan(&rows).Error
			if err != nil {
				return nil, fmt.Errorf("query pending orders: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(rows))
			for _, r := range rows {
				items = append(items, map[string]interface{}{
					"order_no":     r.OrderNo,
					"product_name": r.ProductName,
					"quantity":     r.Quantity,
					"total_price":  r.TotalPrice,
					"currency":     r.Currency,
					"booking_date": r.BookingDate.Format("2006-01-02"),
					"created_at":   r.CreatedAt.Format("2006-01-02 15:04"),
				})
			}

			return map[string]interface{}{
				"pending_orders": items,
				"count":          len(items),
			}, nil
		},
	}
}

// ---------- Tool 3: get_review_stats ----------

// RegisterGetReviewStats returns review statistics for a supplier.
func RegisterGetReviewStats() model.ToolDef {
	return model.ToolDef{
		Name:         "get_review_stats",
		Description:  "获取供应商评价统计：总评价数、平均评分、各星级分布、回复率",
		Category:     "query",
		RequiresAuth: true,
		Parameters: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			if ctx.UserID == nil {
				return nil, fmt.Errorf("supplier not authenticated")
			}
			db := ctx.DB.(*gorm.DB)
			supplierID := *ctx.UserID

			// Overall stats
			type overallRow struct {
				TotalReviews int64   `json:"total_reviews"`
				AvgRating    float64 `json:"avg_rating"`
				RepliedCount int64   `json:"replied_count"`
			}
			var overall overallRow
			err := db.Raw(`
				SELECT
					COUNT(*)                          AS total_reviews,
					COALESCE(AVG(r.rating), 0)        AS avg_rating,
					COUNT(CASE WHEN r.reply IS NOT NULL AND r.reply != '' THEN 1 END) AS replied_count
				FROM reviews r
				JOIN orders o ON o.id = r.order_id
				WHERE o.supplier_id = ?
				  AND r.deleted_at IS NULL
				  AND o.deleted_at IS NULL
			`, supplierID).Scan(&overall).Error
			if err != nil {
				return nil, fmt.Errorf("query review stats: %w", err)
			}

			// Star distribution
			type starRow struct {
				Rating int   `json:"rating"`
				Count  int64 `json:"count"`
			}
			var stars []starRow
			err = db.Raw(`
				SELECT r.rating, COUNT(*) AS count
				FROM reviews r
				JOIN orders o ON o.id = r.order_id
				WHERE o.supplier_id = ?
				  AND r.deleted_at IS NULL
				  AND o.deleted_at IS NULL
				GROUP BY r.rating
				ORDER BY r.rating DESC
			`, supplierID).Scan(&stars).Error
			if err != nil {
				return nil, fmt.Errorf("query star distribution: %w", err)
			}

			// Build a complete 5→1 distribution map
			dist := map[int]int64{5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
			for _, s := range stars {
				dist[s.Rating] = s.Count
			}

			var replyRate float64
			if overall.TotalReviews > 0 {
				replyRate = float64(overall.RepliedCount) / float64(overall.TotalReviews) * 100
			}

			return map[string]interface{}{
				"total_reviews": overall.TotalReviews,
				"avg_rating":    fmt.Sprintf("%.1f", overall.AvgRating),
				"reply_rate":    fmt.Sprintf("%.1f%%", replyRate),
				"star_distribution": map[string]int64{
					"5_star": dist[5],
					"4_star": dist[4],
					"3_star": dist[3],
					"2_star": dist[2],
					"1_star": dist[1],
				},
			}, nil
		},
	}
}

// ---------- Tool 4: get_revenue_trend ----------

// RegisterGetRevenueTrend returns daily revenue trend for the last N days.
func RegisterGetRevenueTrend() model.ToolDef {
	return model.ToolDef{
		Name:        "get_revenue_trend",
		Description: "获取最近N天的每日收入趋势",
		Category:    "query",
		RequiresAuth: true,
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"days": map[string]interface{}{
					"type":        "integer",
					"description": "查询天数，默认7，最大30",
				},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			if ctx.UserID == nil {
				return nil, fmt.Errorf("supplier not authenticated")
			}
			db := ctx.DB.(*gorm.DB)
			supplierID := *ctx.UserID

			days := 7
			if d, ok := args["days"].(float64); ok {
				days = int(d)
				if days < 1 {
					days = 7
				}
				if days > 30 {
					days = 30
				}
			}

			startDate := time.Now().AddDate(0, 0, -days).Truncate(24 * time.Hour)

			type trendRow struct {
				Date       string  `json:"date"`
				Revenue    float64 `json:"revenue"`
				OrderCount int64   `json:"order_count"`
			}

			var rows []trendRow
			err := db.Raw(`
				SELECT
					TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
					COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_price ELSE 0 END), 0) AS revenue,
					COUNT(*) AS order_count
				FROM orders
				WHERE supplier_id = ?
				  AND created_at >= ?
				  AND deleted_at IS NULL
				GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
				ORDER BY date ASC
			`, supplierID, startDate).Scan(&rows).Error
			if err != nil {
				return nil, fmt.Errorf("query revenue trend: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(rows))
			for _, r := range rows {
				items = append(items, map[string]interface{}{
					"date":        r.Date,
					"revenue":     r.Revenue,
					"order_count": r.OrderCount,
				})
			}

			return map[string]interface{}{
				"days":  days,
				"trend": items,
			}, nil
		},
	}
}

// ---------- Helpers ----------

// periodStartTime returns the start time for the given period string.
func periodStartTime(period string) time.Time {
	now := time.Now()
	switch period {
	case "week":
		// Go back to Monday 00:00 of the current week
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7 // Sunday → 7
		}
		return time.Date(now.Year(), now.Month(), now.Day()-(weekday-1), 0, 0, 0, 0, now.Location())
	case "month":
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	default: // "today"
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	}
}
