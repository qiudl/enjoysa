package handlers

import (
	"net/http"
	"strconv"
	"time"

	"enjoysa-backend/models"
	"enjoysa-backend/services"

	"github.com/gin-gonic/gin"
)

// OrderHandler 订单处理器
type OrderHandler struct {
	orderService *services.OrderService
}

// NewOrderHandler 创建订单处理器实例
func NewOrderHandler() *OrderHandler {
	return &OrderHandler{
		orderService: services.NewOrderService(),
	}
}

// Response 通用响应结构
type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// ==================== C端 API ====================

// CreateOrder 创建订单 (C端)
// POST /api/v1/orders
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	// 从上下文获取当前用户
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}
	currentUser := user.(*models.User)

	var input services.CreateOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误: " + err.Error()})
		return
	}

	input.UserID = currentUser.ID

	order, err := h.orderService.Create(&input, currentUser)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, Response{Success: true, Message: "订单创建成功", Data: order})
}

// GetOrder 获取订单详情 (C端)
// GET /api/v1/orders/:id
func (h *OrderHandler) GetOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	// 获取当前用户
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}
	currentUser := user.(*models.User)

	order, err := h.orderService.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Success: false, Error: err.Error()})
		return
	}

	// 验证订单属于当前用户
	if order.UserID != currentUser.ID {
		c.JSON(http.StatusForbidden, Response{Success: false, Error: "无权访问此订单"})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: order})
}

// ListUserOrders 获取用户订单列表 (C端)
// GET /api/v1/orders
func (h *OrderHandler) ListUserOrders(c *gin.Context) {
	// 获取当前用户
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}
	currentUser := user.(*models.User)

	filter := h.parseListFilter(c)
	result, err := h.orderService.ListByUser(currentUser.ID, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: result})
}

// CancelOrder 取消订单 (C端)
// POST /api/v1/orders/:id/cancel
func (h *OrderHandler) CancelOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	// 获取当前用户
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}
	currentUser := user.(*models.User)

	var input struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&input)

	if err := h.orderService.Cancel(uint(id), currentUser.ID, input.Reason); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Message: "订单已取消"})
}

// ==================== B端 API ====================

// ListSupplierOrders 获取供应商订单列表 (B端)
// GET /api/v1/supplier/orders
func (h *OrderHandler) ListSupplierOrders(c *gin.Context) {
	// 从上下文获取供应商ID
	supplierID, exists := c.Get("supplier_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}

	filter := h.parseListFilter(c)
	result, err := h.orderService.ListBySupplier(supplierID.(uint), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: result})
}

// GetSupplierOrder 获取供应商订单详情 (B端)
// GET /api/v1/supplier/orders/:id
func (h *OrderHandler) GetSupplierOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	// 获取供应商ID
	supplierID, exists := c.Get("supplier_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}

	order, err := h.orderService.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Success: false, Error: err.Error()})
		return
	}

	// 验证订单属于当前供应商
	if order.SupplierID != supplierID.(uint) {
		c.JSON(http.StatusForbidden, Response{Success: false, Error: "无权访问此订单"})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: order})
}

// AcceptOrder 接单 (B端)
// POST /api/v1/supplier/orders/:id/accept
func (h *OrderHandler) AcceptOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	// 获取供应商用户ID
	supplierUserID, exists := c.Get("supplier_user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}

	if err := h.orderService.Accept(uint(id), supplierUserID.(uint)); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Message: "接单成功"})
}

// RejectOrder 拒绝订单 (B端)
// POST /api/v1/supplier/orders/:id/reject
func (h *OrderHandler) RejectOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	// 获取供应商用户ID
	supplierUserID, exists := c.Get("supplier_user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "请提供拒绝原因"})
		return
	}

	if err := h.orderService.Reject(uint(id), supplierUserID.(uint), input.Reason); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Message: "订单已拒绝"})
}

// CompleteOrder 完成订单 (B端)
// POST /api/v1/supplier/orders/:id/complete
func (h *OrderHandler) CompleteOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	// 获取供应商用户ID
	supplierUserID, exists := c.Get("supplier_user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}

	if err := h.orderService.Complete(uint(id), supplierUserID.(uint)); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Message: "订单已完成"})
}

// AddRemark 添加备注 (B端)
// POST /api/v1/supplier/orders/:id/remark
func (h *OrderHandler) AddRemark(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	var input struct {
		Remark string `json:"remark" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "请提供备注内容"})
		return
	}

	if err := h.orderService.AddSupplierRemark(uint(id), input.Remark); err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Message: "备注已添加"})
}

// GetOrderStats 获取订单统计 (B端)
// GET /api/v1/supplier/orders/stats
func (h *OrderHandler) GetOrderStats(c *gin.Context) {
	// 获取供应商ID
	supplierID, exists := c.Get("supplier_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, Response{Success: false, Error: "未登录"})
		return
	}

	sid := supplierID.(uint)
	stats, err := h.orderService.GetStats(&sid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: stats})
}

// GetOrderHistory 获取订单状态历史
// GET /api/v1/orders/:id/history 或 /api/v1/supplier/orders/:id/history
func (h *OrderHandler) GetOrderHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的订单ID"})
		return
	}

	histories, err := h.orderService.GetStatusHistory(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: histories})
}

// parseListFilter 解析列表过滤参数
func (h *OrderHandler) parseListFilter(c *gin.Context) *services.ListFilter {
	filter := &services.ListFilter{
		Page:     1,
		PageSize: 20,
	}

	if page, err := strconv.Atoi(c.Query("page")); err == nil && page > 0 {
		filter.Page = page
	}
	if pageSize, err := strconv.Atoi(c.Query("page_size")); err == nil && pageSize > 0 {
		filter.PageSize = pageSize
	}

	if status := c.Query("status"); status != "" {
		s := models.OrderStatus(status)
		filter.Status = &s
	}
	if orderType := c.Query("order_type"); orderType != "" {
		t := models.OrderType(orderType)
		filter.OrderType = &t
	}

	if startDate := c.Query("start_date"); startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			filter.StartDate = &t
		}
	}
	if endDate := c.Query("end_date"); endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			filter.EndDate = &t
		}
	}

	filter.Keyword = c.Query("keyword")

	return filter
}
