package tools

import (
	"fmt"

	"enjoysa-backend/internal/aichat/model"

	"gorm.io/gorm"
)

// RegisterGetPlatformStats registers the get_platform_stats tool.
func RegisterGetPlatformStats() model.ToolDef {
	return model.ToolDef{
		Name:         "get_platform_stats",
		Description:  "获取平台概览统计：总用户数、供应商数、商品数、订单数、总收入",
		Category:     "query",
		RequiresAuth: true,
		Audience:     "admin",
		Parameters: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			db, ok := ctx.DB.(*gorm.DB)
			if !ok {
				return nil, fmt.Errorf("invalid database connection")
			}

			var usersCount int64
			if err := db.Raw("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&usersCount).Error; err != nil {
				return nil, fmt.Errorf("count users failed: %w", err)
			}

			var suppliersCount int64
			if err := db.Raw("SELECT COUNT(*) FROM suppliers WHERE deleted_at IS NULL").Scan(&suppliersCount).Error; err != nil {
				return nil, fmt.Errorf("count suppliers failed: %w", err)
			}

			var productsCount int64
			if err := db.Raw("SELECT COUNT(*) FROM products WHERE status = 'approved' AND deleted_at IS NULL").Scan(&productsCount).Error; err != nil {
				return nil, fmt.Errorf("count products failed: %w", err)
			}

			var ordersCount int64
			if err := db.Raw("SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL").Scan(&ordersCount).Error; err != nil {
				return nil, fmt.Errorf("count orders failed: %w", err)
			}

			var totalRevenue float64
			if err := db.Raw("SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE deleted_at IS NULL").Scan(&totalRevenue).Error; err != nil {
				return nil, fmt.Errorf("sum revenue failed: %w", err)
			}

			var pendingSuppliers int64
			if err := db.Raw("SELECT COUNT(*) FROM suppliers WHERE status = 'pending' AND deleted_at IS NULL").Scan(&pendingSuppliers).Error; err != nil {
				return nil, fmt.Errorf("count pending suppliers failed: %w", err)
			}

			var pendingProducts int64
			if err := db.Raw("SELECT COUNT(*) FROM products WHERE status = 'pending' AND deleted_at IS NULL").Scan(&pendingProducts).Error; err != nil {
				return nil, fmt.Errorf("count pending products failed: %w", err)
			}

			return map[string]interface{}{
				"users_count":      usersCount,
				"suppliers_count":  suppliersCount,
				"products_count":   productsCount,
				"orders_count":     ordersCount,
				"total_revenue":    totalRevenue,
				"pending_suppliers": pendingSuppliers,
				"pending_products": pendingProducts,
			}, nil
		},
	}
}

// RegisterSearchSuppliers registers the search_suppliers tool.
func RegisterSearchSuppliers() model.ToolDef {
	return model.ToolDef{
		Name:         "search_suppliers",
		Description:  "搜索供应商列表，含订单数、收入、评分等统计",
		Category:     "query",
		RequiresAuth: true,
		Audience:     "admin",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"keyword": map[string]interface{}{"type": "string", "description": "按供应商名称模糊搜索"},
				"status":  map[string]interface{}{"type": "string", "description": "供应商状态筛选：pending/approved/rejected", "enum": []string{"pending", "approved", "rejected"}},
				"limit":   map[string]interface{}{"type": "integer", "description": "返回数量，默认10，最大50"},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			db, ok := ctx.DB.(*gorm.DB)
			if !ok {
				return nil, fmt.Errorf("invalid database connection")
			}

			limit := 10
			if lim, ok := args["limit"].(float64); ok {
				limit = int(lim)
				if limit > 50 {
					limit = 50
				}
				if limit < 1 {
					limit = 10
				}
			}

			query := `
				SELECT
					s.id,
					s.name,
					s.status,
					s.type,
					COALESCE(pc.product_count, 0) AS product_count,
					COALESCE(oc.order_count, 0) AS order_count,
					COALESCE(oc.total_revenue, 0) AS total_revenue
				FROM suppliers s
				LEFT JOIN (
					SELECT supplier_id, COUNT(*) AS product_count
					FROM products WHERE deleted_at IS NULL
					GROUP BY supplier_id
				) pc ON pc.supplier_id = s.id
				LEFT JOIN (
					SELECT supplier_id, COUNT(*) AS order_count, SUM(total_price) AS total_revenue
					FROM orders WHERE deleted_at IS NULL
					GROUP BY supplier_id
				) oc ON oc.supplier_id = s.id
				WHERE s.deleted_at IS NULL
			`

			queryArgs := []interface{}{}

			if keyword, ok := args["keyword"].(string); ok && keyword != "" {
				query += " AND s.name ILIKE ?"
				queryArgs = append(queryArgs, "%"+keyword+"%")
			}

			if status, ok := args["status"].(string); ok && status != "" {
				query += " AND s.status = ?"
				queryArgs = append(queryArgs, status)
			}

			query += " ORDER BY s.created_at DESC LIMIT ?"
			queryArgs = append(queryArgs, limit)

			type supplierRow struct {
				ID           uint    `json:"id"`
				Name         string  `json:"name"`
				Status       string  `json:"status"`
				Type         string  `json:"type"`
				ProductCount int     `json:"product_count"`
				OrderCount   int     `json:"order_count"`
				TotalRevenue float64 `json:"total_revenue"`
			}

			var rows []supplierRow
			if err := db.Raw(query, queryArgs...).Scan(&rows).Error; err != nil {
				return nil, fmt.Errorf("search suppliers failed: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(rows))
			for _, r := range rows {
				items = append(items, map[string]interface{}{
					"id":            r.ID,
					"name":          r.Name,
					"status":        r.Status,
					"type":          r.Type,
					"product_count": r.ProductCount,
					"order_count":   r.OrderCount,
					"total_revenue": r.TotalRevenue,
				})
			}

			return map[string]interface{}{
				"suppliers": items,
				"total":     len(items),
			}, nil
		},
	}
}

// RegisterListPendingProducts registers the list_pending_products tool.
func RegisterListPendingProducts() model.ToolDef {
	return model.ToolDef{
		Name:         "list_pending_products",
		Description:  "列出待审核的商品",
		Category:     "query",
		RequiresAuth: true,
		Audience:     "admin",
		Parameters: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			db, ok := ctx.DB.(*gorm.DB)
			if !ok {
				return nil, fmt.Errorf("invalid database connection")
			}

			query := `
				SELECT
					p.id,
					p.name_zh,
					s.name AS supplier_name,
					p.price_from,
					p.created_at
				FROM products p
				LEFT JOIN suppliers s ON s.id = p.supplier_id
				WHERE p.status = 'pending' AND p.deleted_at IS NULL
				ORDER BY p.created_at DESC
			`

			type pendingRow struct {
				ID           uint    `json:"id"`
				NameZh       string  `json:"name_zh"`
				SupplierName string  `json:"supplier_name"`
				PriceFrom    float64 `json:"price_from"`
				CreatedAt    string  `json:"created_at"`
			}

			var rows []pendingRow
			if err := db.Raw(query).Scan(&rows).Error; err != nil {
				return nil, fmt.Errorf("list pending products failed: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(rows))
			for _, r := range rows {
				items = append(items, map[string]interface{}{
					"id":            r.ID,
					"name_zh":       r.NameZh,
					"supplier_name": r.SupplierName,
					"price_from":    r.PriceFrom,
					"created_at":    r.CreatedAt,
				})
			}

			return map[string]interface{}{
				"pending_products": items,
				"total":            len(items),
			}, nil
		},
	}
}

// RegisterApproveProduct registers the approve_product tool.
func RegisterApproveProduct() model.ToolDef {
	return model.ToolDef{
		Name:         "approve_product",
		Description:  "审核通过商品（写操作，将 pending 状态改为 approved）。⚠️ 调用前必须：(1) 管理员【显式同意】通过该商品——仅查看商品详情或讨论审核流程不是审核信号，应先文字询问\"是否确认通过？\"；(2) 同一轮回复内禁止多次调用本工具，服务端会拒绝重复执行。",
		Category:     "action",
		RequiresAuth: true,
		Audience:     "admin",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"product_id": map[string]interface{}{"type": "integer", "description": "商品ID"},
			},
			"required": []string{"product_id"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			db, ok := ctx.DB.(*gorm.DB)
			if !ok {
				return nil, fmt.Errorf("invalid database connection")
			}

			productID, ok := args["product_id"].(float64)
			if !ok {
				return nil, fmt.Errorf("product_id is required")
			}

			// Check product exists and status is pending
			var productName string
			err := db.Raw("SELECT name_zh FROM products WHERE id = ? AND deleted_at IS NULL", int(productID)).Scan(&productName).Error
			if err != nil {
				return nil, fmt.Errorf("query product failed: %w", err)
			}
			if productName == "" {
				return map[string]interface{}{
					"success": false,
					"message": fmt.Sprintf("商品 ID=%d 不存在", int(productID)),
				}, nil
			}

			var status string
			if err := db.Raw("SELECT status FROM products WHERE id = ? AND deleted_at IS NULL", int(productID)).Scan(&status).Error; err != nil {
				return nil, fmt.Errorf("query product status failed: %w", err)
			}
			if status != "pending" {
				return map[string]interface{}{
					"success": false,
					"message": fmt.Sprintf("商品「%s」当前状态为 %s，只有 pending 状态才能审核通过", productName, status),
				}, nil
			}

			// Update status to approved
			result := db.Raw("UPDATE products SET status = 'approved', updated_at = NOW() WHERE id = ? AND status = 'pending'", int(productID))
			if result.Error != nil {
				return nil, fmt.Errorf("approve product failed: %w", result.Error)
			}

			return map[string]interface{}{
				"success":      true,
				"product_name": productName,
				"message":      "商品已审核通过",
			}, nil
		},
	}
}

// RegisterOfflineProduct registers the offline_product tool.
func RegisterOfflineProduct() model.ToolDef {
	return model.ToolDef{
		Name:         "offline_product",
		Description:  "下架商品（写操作，将 approved 状态改为 offline）。⚠️ 调用前必须：(1) 管理员【显式同意】下架该商品并提供具体下架原因——仅讨论商品问题不是下架信号；(2) 同一轮回复内禁止多次调用本工具，服务端会拒绝重复执行。",
		Category:     "action",
		RequiresAuth: true,
		Audience:     "admin",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"product_id": map[string]interface{}{"type": "integer", "description": "商品ID"},
				"reason":     map[string]interface{}{"type": "string", "description": "下架原因"},
			},
			"required": []string{"product_id", "reason"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			db, ok := ctx.DB.(*gorm.DB)
			if !ok {
				return nil, fmt.Errorf("invalid database connection")
			}

			productID, ok := args["product_id"].(float64)
			if !ok {
				return nil, fmt.Errorf("product_id is required")
			}

			reason, _ := args["reason"].(string)
			if reason == "" {
				return nil, fmt.Errorf("reason is required")
			}

			// Check product exists and status is approved
			var productName string
			err := db.Raw("SELECT name_zh FROM products WHERE id = ? AND deleted_at IS NULL", int(productID)).Scan(&productName).Error
			if err != nil {
				return nil, fmt.Errorf("query product failed: %w", err)
			}
			if productName == "" {
				return map[string]interface{}{
					"success": false,
					"message": fmt.Sprintf("商品 ID=%d 不存在", int(productID)),
				}, nil
			}

			var status string
			if err := db.Raw("SELECT status FROM products WHERE id = ? AND deleted_at IS NULL", int(productID)).Scan(&status).Error; err != nil {
				return nil, fmt.Errorf("query product status failed: %w", err)
			}
			if status != "approved" {
				return map[string]interface{}{
					"success": false,
					"message": fmt.Sprintf("商品「%s」当前状态为 %s，只有 approved 状态才能下架", productName, status),
				}, nil
			}

			// Update status to offline
			result := db.Raw("UPDATE products SET status = 'offline', updated_at = NOW() WHERE id = ? AND status = 'approved'", int(productID))
			if result.Error != nil {
				return nil, fmt.Errorf("offline product failed: %w", result.Error)
			}

			return map[string]interface{}{
				"success":      true,
				"product_name": productName,
				"reason":       reason,
				"message":      "商品已下架",
			}, nil
		},
	}
}
