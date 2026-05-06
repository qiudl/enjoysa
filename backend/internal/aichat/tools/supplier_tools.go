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
		Audience:     "supplier",
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
		Audience:     "supplier",
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
		Audience:     "supplier",
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
		Audience:     "supplier",
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

// ---------- Tool 5: get_inventory_alerts ----------

// RegisterGetInventoryAlerts returns low-stock and sold-out schedule alerts.
func RegisterGetInventoryAlerts() model.ToolDef {
	return model.ToolDef{
		Name:         "get_inventory_alerts",
		Description:  "获取库存预警：低库存和已售罄的排期",
		Category:     "query",
		RequiresAuth: true,
		Audience:     "supplier",
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

			type alertRow struct {
				ID          uint    `json:"id"`
				ProductName string  `json:"product_name"`
				Date        time.Time `json:"date"`
				TimeSlot    string  `json:"time_slot"`
				TotalSlots  int     `json:"total_slots"`
				BookedSlots int     `json:"booked_slots"`
				Remaining   int     `json:"remaining"`
			}

			var rows []alertRow
			err := db.Raw(`
				SELECT ps.id, p.name_zh as product_name, ps.date, ps.time_slot,
					ps.total_slots, ps.booked_slots, (ps.total_slots - ps.booked_slots) as remaining
				FROM product_schedules ps
				JOIN products p ON p.id = ps.product_id
				WHERE p.supplier_id = ? AND ps.deleted_at IS NULL AND p.deleted_at IS NULL
				AND ps.date >= CURRENT_DATE AND ps.status = 'available'
				AND (ps.total_slots - ps.booked_slots) < 3
				ORDER BY remaining ASC, ps.date ASC LIMIT 20
			`, supplierID).Scan(&rows).Error
			if err != nil {
				return nil, fmt.Errorf("query inventory alerts: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(rows))
			for _, r := range rows {
				items = append(items, map[string]interface{}{
					"product_name": r.ProductName,
					"date":         r.Date.Format("2006-01-02"),
					"time_slot":    r.TimeSlot,
					"total_slots":  r.TotalSlots,
					"booked_slots": r.BookedSlots,
					"remaining":    r.Remaining,
				})
			}

			return map[string]interface{}{
				"alerts": items,
				"count":  len(items),
			}, nil
		},
	}
}

// ---------- Tool 6: get_settlement_detail ----------

// RegisterGetSettlementDetail returns settlement summary for a supplier.
func RegisterGetSettlementDetail() model.ToolDef {
	return model.ToolDef{
		Name:        "get_settlement_detail",
		Description: "获取结算详情：待结算和已结算金额",
		Category:    "query",
		RequiresAuth: true,
		Audience:     "supplier",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"status": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"pending", "completed"},
					"description": "筛选结算状态：pending=待结算, completed=已结算，默认返回全部",
				},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			if ctx.UserID == nil {
				return nil, fmt.Errorf("supplier not authenticated")
			}
			db := ctx.DB.(*gorm.DB)
			supplierID := *ctx.UserID

			type settlementRow struct {
				Status      string  `json:"status"`
				Count       int64   `json:"count"`
				TotalAmount float64 `json:"total_amount"`
			}

			query := `
				SELECT status, COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total_amount
				FROM settlements WHERE supplier_id = ? AND deleted_at IS NULL
			`
			queryArgs := []interface{}{supplierID}

			if status, ok := args["status"].(string); ok && (status == "pending" || status == "completed") {
				query += " AND status = ?"
				queryArgs = append(queryArgs, status)
			}

			query += " GROUP BY status"

			var rows []settlementRow
			err := db.Raw(query, queryArgs...).Scan(&rows).Error
			if err != nil {
				return nil, fmt.Errorf("query settlement detail: %w", err)
			}

			result := map[string]interface{}{
				"pending_count":    int64(0),
				"pending_amount":   float64(0),
				"completed_count":  int64(0),
				"completed_amount": float64(0),
			}
			for _, r := range rows {
				switch r.Status {
				case "pending":
					result["pending_count"] = r.Count
					result["pending_amount"] = r.TotalAmount
				case "completed":
					result["completed_count"] = r.Count
					result["completed_amount"] = r.TotalAmount
				}
			}

			return result, nil
		},
	}
}

// ---------- Tool 7: confirm_order ----------

// RegisterConfirmOrder confirms a paid order (changes status to accepted).
func RegisterConfirmOrder() model.ToolDef {
	return model.ToolDef{
		Name:        "confirm_order",
		Description: "确认订单（写操作，将 paid 状态改为 accepted）。⚠️ 调用前必须：(1) 供应商【显式同意】确认该订单——仅查看订单详情或讨论物流不是确认信号，应先文字询问\"是否确认接单？\"；(2) 同一轮回复内禁止多次调用本工具，服务端会拒绝重复执行。",
		Category:    "action",
		RequiresAuth: true,
		Audience:     "supplier",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"order_id": map[string]interface{}{
					"type":        "integer",
					"description": "要确认的订单ID",
				},
			},
			"required": []string{"order_id"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			if ctx.UserID == nil {
				return nil, fmt.Errorf("supplier not authenticated")
			}
			db := ctx.DB.(*gorm.DB)
			supplierID := *ctx.UserID

			orderIDFloat, ok := args["order_id"].(float64)
			if !ok {
				return nil, fmt.Errorf("order_id is required")
			}
			orderID := int64(orderIDFloat)

			// Check order exists, belongs to supplier, and is in 'paid' status
			type orderCheck struct {
				ID      int64  `json:"id"`
				OrderNo string `json:"order_no"`
				Status  string `json:"status"`
			}
			var order orderCheck
			err := db.Raw(`
				SELECT id, order_no, status FROM orders
				WHERE id = ? AND supplier_id = ? AND deleted_at IS NULL
			`, orderID, supplierID).Scan(&order).Error
			if err != nil {
				return nil, fmt.Errorf("query order: %w", err)
			}
			if order.ID == 0 {
				return nil, fmt.Errorf("订单不存在或不属于当前供应商")
			}
			if order.Status != "paid" {
				return nil, fmt.Errorf("订单状态为 %s，只有 paid 状态的订单才能确认", order.Status)
			}

			// Update order status
			result := db.Exec(`
				UPDATE orders SET status = 'accepted', updated_at = NOW()
				WHERE id = ? AND supplier_id = ? AND status = 'paid'
			`, orderID, supplierID)
			if result.Error != nil {
				return nil, fmt.Errorf("update order: %w", result.Error)
			}
			if result.RowsAffected == 0 {
				return nil, fmt.Errorf("订单确认失败，可能状态已变更")
			}

			return map[string]interface{}{
				"success":  true,
				"order_no": order.OrderNo,
				"message":  "订单已确认",
			}, nil
		},
	}
}

// ---------- Tool 8: search_orders ----------

// RegisterSearchOrders searches orders with keyword, status, and date filters.
func RegisterSearchOrders() model.ToolDef {
	return model.ToolDef{
		Name:        "search_orders",
		Description: "搜索订单，支持按订单号、商品名、日期范围筛选",
		Category:    "query",
		RequiresAuth: true,
		Audience:     "supplier",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"keyword": map[string]interface{}{
					"type":        "string",
					"description": "搜索关键词，匹配订单号或商品名",
				},
				"status": map[string]interface{}{
					"type":        "string",
					"description": "订单状态筛选，如 paid, accepted, completed, cancelled 等",
				},
				"start_date": map[string]interface{}{
					"type":        "string",
					"description": "开始日期，格式 YYYY-MM-DD",
				},
				"end_date": map[string]interface{}{
					"type":        "string",
					"description": "结束日期，格式 YYYY-MM-DD",
				},
				"limit": map[string]interface{}{
					"type":        "integer",
					"description": "返回条数，默认10，最大50",
				},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			if ctx.UserID == nil {
				return nil, fmt.Errorf("supplier not authenticated")
			}
			db := ctx.DB.(*gorm.DB)
			supplierID := *ctx.UserID

			limit := 10
			if l, ok := args["limit"].(float64); ok {
				limit = int(l)
				if limit < 1 {
					limit = 10
				}
				if limit > 50 {
					limit = 50
				}
			}

			query := `
				SELECT order_no, product_name, status, quantity, total_price, booking_date, created_at
				FROM orders
				WHERE supplier_id = ? AND deleted_at IS NULL
			`
			queryArgs := []interface{}{supplierID}

			if keyword, ok := args["keyword"].(string); ok && keyword != "" {
				query += " AND (order_no ILIKE ? OR product_name ILIKE ?)"
				kw := "%" + keyword + "%"
				queryArgs = append(queryArgs, kw, kw)
			}

			if status, ok := args["status"].(string); ok && status != "" {
				query += " AND status = ?"
				queryArgs = append(queryArgs, status)
			}

			if startDate, ok := args["start_date"].(string); ok && startDate != "" {
				query += " AND created_at >= ?"
				queryArgs = append(queryArgs, startDate)
			}

			if endDate, ok := args["end_date"].(string); ok && endDate != "" {
				query += " AND created_at < ? + INTERVAL '1 day'"
				queryArgs = append(queryArgs, endDate)
			}

			query += " ORDER BY created_at DESC LIMIT ?"
			queryArgs = append(queryArgs, limit)

			type orderRow struct {
				OrderNo     string    `json:"order_no"`
				ProductName string    `json:"product_name"`
				Status      string    `json:"status"`
				Quantity    int       `json:"quantity"`
				TotalPrice  float64   `json:"total_price"`
				BookingDate time.Time `json:"booking_date"`
				CreatedAt   time.Time `json:"created_at"`
			}

			var rows []orderRow
			err := db.Raw(query, queryArgs...).Scan(&rows).Error
			if err != nil {
				return nil, fmt.Errorf("search orders: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(rows))
			for _, r := range rows {
				items = append(items, map[string]interface{}{
					"order_no":     r.OrderNo,
					"product_name": r.ProductName,
					"status":       r.Status,
					"quantity":     r.Quantity,
					"total_price":  r.TotalPrice,
					"booking_date": r.BookingDate.Format("2006-01-02"),
					"created_at":   r.CreatedAt.Format("2006-01-02 15:04"),
				})
			}

			return map[string]interface{}{
				"orders": items,
				"count":  len(items),
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
