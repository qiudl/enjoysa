package services

import (
	"errors"
	"time"

	"enjoysa-backend/database"
	"enjoysa-backend/models"

	"gorm.io/gorm"
)

// OrderService 订单服务
type OrderService struct{}

// NewOrderService 创建订单服务实例
func NewOrderService() *OrderService {
	return &OrderService{}
}

// CreateOrderInput 创建订单输入
type CreateOrderInput struct {
	UserID       uint              `json:"user_id"`
	SupplierID   uint              `json:"supplier_id"`
	ProductID    uint              `json:"product_id"`
	ProductName  string            `json:"product_name"`
	ProductSKU   string            `json:"product_sku"`
	OrderType    models.OrderType  `json:"order_type"`
	BookingDate  time.Time         `json:"booking_date"`
	CheckInDate  *time.Time        `json:"check_in_date,omitempty"`
	CheckOutDate *time.Time        `json:"check_out_date,omitempty"`
	Quantity     int               `json:"quantity"`
	GuestCount   int               `json:"guest_count"`
	UnitPrice    float64           `json:"unit_price"`
	TotalPrice   float64           `json:"total_price"`
	Currency     string            `json:"currency"`
	ContactName  string            `json:"contact_name"`
	ContactPhone string            `json:"contact_phone"`
	ContactEmail string            `json:"contact_email"`
	UserRemark   string            `json:"user_remark"`
}

// Create 创建订单 (C端)
func (s *OrderService) Create(input *CreateOrderInput, user *models.User) (*models.Order, error) {
	// 获取供应商信息
	var supplier models.Supplier
	if err := database.DB.First(&supplier, input.SupplierID).Error; err != nil {
		return nil, errors.New("供应商不存在")
	}

	order := &models.Order{
		OrderType:    input.OrderType,
		Status:       models.OrderStatusPending,
		UserID:       user.ID,
		UserName:     user.Name,
		UserPhone:    user.Phone,
		UserEmail:    user.Email,
		SupplierID:   input.SupplierID,
		SupplierName: supplier.Name,
		ProductID:    input.ProductID,
		ProductName:  input.ProductName,
		ProductSKU:   input.ProductSKU,
		BookingDate:  input.BookingDate,
		CheckInDate:  input.CheckInDate,
		CheckOutDate: input.CheckOutDate,
		Quantity:     input.Quantity,
		GuestCount:   input.GuestCount,
		UnitPrice:    input.UnitPrice,
		TotalPrice:   input.TotalPrice,
		Currency:     input.Currency,
		ContactName:  input.ContactName,
		ContactPhone: input.ContactPhone,
		ContactEmail: input.ContactEmail,
		UserRemark:   input.UserRemark,
	}

	if err := database.DB.Create(order).Error; err != nil {
		return nil, err
	}

	// 记录状态变更历史
	s.recordStatusHistory(order.ID, "", models.OrderStatusPending, &user.ID, "user", "订单创建")

	return order, nil
}

// GetByID 根据ID获取订单
func (s *OrderService) GetByID(id uint) (*models.Order, error) {
	var order models.Order
	if err := database.DB.Preload("User").Preload("Supplier").First(&order, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, err
	}
	return &order, nil
}

// GetByOrderNo 根据订单号获取订单
func (s *OrderService) GetByOrderNo(orderNo string) (*models.Order, error) {
	var order models.Order
	if err := database.DB.Where("order_no = ?", orderNo).Preload("User").Preload("Supplier").First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, err
	}
	return &order, nil
}

// ListFilter 订单列表过滤条件
type ListFilter struct {
	UserID     *uint
	SupplierID *uint
	Status     *models.OrderStatus
	OrderType  *models.OrderType
	StartDate  *time.Time
	EndDate    *time.Time
	Keyword    string
	Page       int
	PageSize   int
}

// ListResult 订单列表结果
type ListResult struct {
	Orders     []models.Order `json:"orders"`
	Total      int64          `json:"total"`
	Page       int            `json:"page"`
	PageSize   int            `json:"page_size"`
	TotalPages int            `json:"total_pages"`
}

// List 获取订单列表
func (s *OrderService) List(filter *ListFilter) (*ListResult, error) {
	query := database.DB.Model(&models.Order{})

	// 应用过滤条件
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}
	if filter.SupplierID != nil {
		query = query.Where("supplier_id = ?", *filter.SupplierID)
	}
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}
	if filter.OrderType != nil {
		query = query.Where("order_type = ?", *filter.OrderType)
	}
	if filter.StartDate != nil {
		query = query.Where("created_at >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("created_at <= ?", *filter.EndDate)
	}
	if filter.Keyword != "" {
		keyword := "%" + filter.Keyword + "%"
		query = query.Where("order_no LIKE ? OR product_name LIKE ? OR user_name LIKE ?", keyword, keyword, keyword)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// 获取数据
	var orders []models.Order
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, err
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &ListResult{
		Orders:     orders,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// ListByUser 获取用户订单列表 (C端)
func (s *OrderService) ListByUser(userID uint, filter *ListFilter) (*ListResult, error) {
	filter.UserID = &userID
	return s.List(filter)
}

// ListBySupplier 获取供应商订单列表 (B端)
func (s *OrderService) ListBySupplier(supplierID uint, filter *ListFilter) (*ListResult, error) {
	filter.SupplierID = &supplierID
	return s.List(filter)
}

// Cancel 取消订单 (C端用户取消)
func (s *OrderService) Cancel(orderID uint, userID uint, reason string) error {
	order, err := s.GetByID(orderID)
	if err != nil {
		return err
	}

	// 验证订单属于该用户
	if order.UserID != userID {
		return errors.New("无权操作此订单")
	}

	// 只有待支付和已支付的订单可以取消
	if order.Status != models.OrderStatusPending && order.Status != models.OrderStatusPaid {
		return errors.New("当前状态不允许取消")
	}

	now := time.Now()
	oldStatus := order.Status

	updates := map[string]interface{}{
		"status":        models.OrderStatusCancelled,
		"cancelled_at":  now,
		"cancel_reason": reason,
	}

	if err := database.DB.Model(order).Updates(updates).Error; err != nil {
		return err
	}

	s.recordStatusHistory(orderID, oldStatus, models.OrderStatusCancelled, &userID, "user", reason)

	return nil
}

// Accept 接单 (B端供应商接单)
func (s *OrderService) Accept(orderID uint, supplierUserID uint) error {
	order, err := s.GetByID(orderID)
	if err != nil {
		return err
	}

	// 只有已支付的订单可以接单
	if order.Status != models.OrderStatusPaid {
		return errors.New("当前状态不允许接单")
	}

	now := time.Now()
	oldStatus := order.Status

	updates := map[string]interface{}{
		"status":      models.OrderStatusAccepted,
		"accepted_at": now,
		"accepted_by": supplierUserID,
	}

	if err := database.DB.Model(order).Updates(updates).Error; err != nil {
		return err
	}

	s.recordStatusHistory(orderID, oldStatus, models.OrderStatusAccepted, &supplierUserID, "supplier", "供应商接单")

	return nil
}

// Reject 拒绝订单 (B端供应商拒绝)
func (s *OrderService) Reject(orderID uint, supplierUserID uint, reason string) error {
	order, err := s.GetByID(orderID)
	if err != nil {
		return err
	}

	// 只有已支付的订单可以拒绝
	if order.Status != models.OrderStatusPaid {
		return errors.New("当前状态不允许拒绝")
	}

	now := time.Now()
	oldStatus := order.Status

	updates := map[string]interface{}{
		"status":        models.OrderStatusCancelled,
		"rejected_at":   now,
		"reject_reason": reason,
	}

	if err := database.DB.Model(order).Updates(updates).Error; err != nil {
		return err
	}

	s.recordStatusHistory(orderID, oldStatus, models.OrderStatusCancelled, &supplierUserID, "supplier", "供应商拒绝: "+reason)

	// TODO: 触发退款流程

	return nil
}

// Complete 完成订单 (B端供应商完成)
func (s *OrderService) Complete(orderID uint, supplierUserID uint) error {
	order, err := s.GetByID(orderID)
	if err != nil {
		return err
	}

	// 只有已接单或处理中的订单可以完成
	if order.Status != models.OrderStatusAccepted && order.Status != models.OrderStatusProcessing {
		return errors.New("当前状态不允许完成")
	}

	now := time.Now()
	oldStatus := order.Status

	updates := map[string]interface{}{
		"status":       models.OrderStatusCompleted,
		"completed_at": now,
	}

	if err := database.DB.Model(order).Updates(updates).Error; err != nil {
		return err
	}

	s.recordStatusHistory(orderID, oldStatus, models.OrderStatusCompleted, &supplierUserID, "supplier", "订单完成")

	return nil
}

// AddSupplierRemark 添加供应商备注 (B端)
func (s *OrderService) AddSupplierRemark(orderID uint, remark string) error {
	return database.DB.Model(&models.Order{}).Where("id = ?", orderID).Update("supplier_remark", remark).Error
}

// recordStatusHistory 记录状态变更历史
func (s *OrderService) recordStatusHistory(orderID uint, fromStatus models.OrderStatus, toStatus models.OrderStatus, operatorID *uint, operatorType string, remark string) {
	history := &models.OrderStatusHistory{
		OrderID:      orderID,
		FromStatus:   fromStatus,
		ToStatus:     toStatus,
		OperatorID:   operatorID,
		OperatorType: operatorType,
		Remark:       remark,
	}
	database.DB.Create(history)
}

// GetStatusHistory 获取订单状态变更历史
func (s *OrderService) GetStatusHistory(orderID uint) ([]models.OrderStatusHistory, error) {
	var histories []models.OrderStatusHistory
	if err := database.DB.Where("order_id = ?", orderID).Order("created_at ASC").Find(&histories).Error; err != nil {
		return nil, err
	}
	return histories, nil
}

// GetStats 获取订单统计 (供应商或平台)
type OrderStats struct {
	Total      int64   `json:"total"`
	Pending    int64   `json:"pending"`
	Paid       int64   `json:"paid"`
	Accepted   int64   `json:"accepted"`
	Completed  int64   `json:"completed"`
	Cancelled  int64   `json:"cancelled"`
	TotalAmount float64 `json:"total_amount"`
}

func (s *OrderService) GetStats(supplierID *uint) (*OrderStats, error) {
	stats := &OrderStats{}
	query := database.DB.Model(&models.Order{})

	if supplierID != nil {
		query = query.Where("supplier_id = ?", *supplierID)
	}

	// 总数
	query.Count(&stats.Total)

	// 各状态数量
	database.DB.Model(&models.Order{}).Where("supplier_id = ? AND status = ?", supplierID, models.OrderStatusPending).Count(&stats.Pending)
	database.DB.Model(&models.Order{}).Where("supplier_id = ? AND status = ?", supplierID, models.OrderStatusPaid).Count(&stats.Paid)
	database.DB.Model(&models.Order{}).Where("supplier_id = ? AND status = ?", supplierID, models.OrderStatusAccepted).Count(&stats.Accepted)
	database.DB.Model(&models.Order{}).Where("supplier_id = ? AND status = ?", supplierID, models.OrderStatusCompleted).Count(&stats.Completed)
	database.DB.Model(&models.Order{}).Where("supplier_id = ? AND status = ?", supplierID, models.OrderStatusCancelled).Count(&stats.Cancelled)

	// 总金额（已完成订单）
	database.DB.Model(&models.Order{}).Where("supplier_id = ? AND status = ?", supplierID, models.OrderStatusCompleted).Select("COALESCE(SUM(total_price), 0)").Scan(&stats.TotalAmount)

	return stats, nil
}
