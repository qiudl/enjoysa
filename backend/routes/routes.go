package routes

import (
	"enjoysa-backend/handlers"
	"enjoysa-backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRouter 配置路由
func SetupRouter(r *gin.Engine) {
	// 订单处理器
	orderHandler := handlers.NewOrderHandler()

	// API v1
	v1 := r.Group("/api/v1")
	{
		// C端订单 API (需要用户认证)
		orders := v1.Group("/orders")
		orders.Use(middleware.UserAuth())
		{
			orders.POST("", orderHandler.CreateOrder)          // 创建订单
			orders.GET("", orderHandler.ListUserOrders)        // 获取订单列表
			orders.GET("/:id", orderHandler.GetOrder)          // 获取订单详情
			orders.POST("/:id/cancel", orderHandler.CancelOrder) // 取消订单
			orders.GET("/:id/history", orderHandler.GetOrderHistory) // 获取状态历史
		}

		// B端供应商订单 API (需要供应商认证)
		supplierOrders := v1.Group("/supplier/orders")
		supplierOrders.Use(middleware.SupplierAuth())
		{
			supplierOrders.GET("", orderHandler.ListSupplierOrders)       // 获取订单列表
			supplierOrders.GET("/stats", orderHandler.GetOrderStats)     // 获取订单统计
			supplierOrders.GET("/:id", orderHandler.GetSupplierOrder)    // 获取订单详情
			supplierOrders.POST("/:id/accept", orderHandler.AcceptOrder) // 接单
			supplierOrders.POST("/:id/reject", orderHandler.RejectOrder) // 拒绝订单
			supplierOrders.POST("/:id/complete", orderHandler.CompleteOrder) // 完成订单
			supplierOrders.POST("/:id/remark", orderHandler.AddRemark)   // 添加备注
			supplierOrders.GET("/:id/history", orderHandler.GetOrderHistory) // 获取状态历史
		}
	}
}
