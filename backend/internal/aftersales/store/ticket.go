package store

import (
	"enjoysa-backend/internal/aftersales/model"
	ordermodel "enjoysa-backend/internal/order/model"

	"gorm.io/gorm"
)

type TicketStore struct {
	db *gorm.DB
}

func NewTicketStore(db *gorm.DB) *TicketStore {
	return &TicketStore{db: db}
}

// Create 创建工单
func (s *TicketStore) Create(ticket *model.Ticket) error {
	return s.db.Create(ticket).Error
}

// GetByID 按 ID 查询工单
func (s *TicketStore) GetByID(id uint) (*model.Ticket, error) {
	var ticket model.Ticket
	if err := s.db.First(&ticket, id).Error; err != nil {
		return nil, err
	}
	return &ticket, nil
}

// GetByTicketNo 按工单号查询
func (s *TicketStore) GetByTicketNo(ticketNo string) (*model.Ticket, error) {
	var ticket model.Ticket
	if err := s.db.Where("ticket_no = ?", ticketNo).First(&ticket).Error; err != nil {
		return nil, err
	}
	return &ticket, nil
}

// Update 更新工单
func (s *TicketStore) Update(ticket *model.Ticket) error {
	return s.db.Save(ticket).Error
}

// TicketFilter 工单过滤条件
type TicketFilter struct {
	Status   string
	Type     string
	Source   string
	UserID   uint
	OrderID  uint
	Keyword  string
	Page     int
	PageSize int
}

// List 列表查询
func (s *TicketStore) List(filter TicketFilter) ([]model.Ticket, int64, error) {
	var tickets []model.Ticket
	var total int64

	query := s.db.Model(&model.Ticket{})

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}
	if filter.Source != "" {
		query = query.Where("source = ?", filter.Source)
	}
	if filter.UserID > 0 {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.OrderID > 0 {
		query = query.Where("order_id = ?", filter.OrderID)
	}
	if filter.Keyword != "" {
		kw := "%" + filter.Keyword + "%"
		query = query.Where("subject LIKE ? OR description LIKE ? OR ticket_no LIKE ?", kw, kw, kw)
	}

	query.Count(&total)

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	if err := query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&tickets).Error; err != nil {
		return nil, 0, err
	}

	return tickets, total, nil
}

// AddNote 添加工单备注
func (s *TicketStore) AddNote(note *model.TicketNote) error {
	return s.db.Create(note).Error
}

// GetNotes 获取工单备注
func (s *TicketStore) GetNotes(ticketID uint) ([]model.TicketNote, error) {
	var notes []model.TicketNote
	if err := s.db.Where("ticket_id = ?", ticketID).Order("id ASC").Find(&notes).Error; err != nil {
		return nil, err
	}
	return notes, nil
}

// === 订单查询（复用 order 表） ===

// OrderSummary 订单摘要（脱敏）
type OrderSummary struct {
	ID          uint                 `json:"id"`
	OrderNo     string               `json:"order_no"`
	Status      ordermodel.OrderStatus `json:"status"`
	ProductName string               `json:"product_name"`
	BookingDate string               `json:"booking_date"`
	Quantity    int                  `json:"quantity"`
	TotalPrice  float64              `json:"total_price"`
	Currency    string               `json:"currency"`
	CreatedAt   string               `json:"created_at"`
}

// GetOrderByID 查询订单摘要
func (s *TicketStore) GetOrderByID(orderID uint) (*OrderSummary, error) {
	var order ordermodel.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		return nil, err
	}
	return &OrderSummary{
		ID:          order.ID,
		OrderNo:     order.OrderNo,
		Status:      order.Status,
		ProductName: order.ProductName,
		BookingDate: order.BookingDate.Format("2006-01-02"),
		Quantity:    order.Quantity,
		TotalPrice:  order.TotalPrice,
		Currency:    order.Currency,
		CreatedAt:   order.CreatedAt.Format("2006-01-02 15:04:05"),
	}, nil
}

// SearchOrders 按条件搜索订单
func (s *TicketStore) SearchOrders(email, phone string, page, pageSize int) ([]OrderSummary, int64, error) {
	var orders []ordermodel.Order
	var total int64

	query := s.db.Model(&ordermodel.Order{})

	if email != "" {
		query = query.Where("user_email = ?", email)
	}
	if phone != "" {
		query = query.Where("user_phone = ?", phone)
	}

	query.Count(&total)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	if err := query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	summaries := make([]OrderSummary, len(orders))
	for i, o := range orders {
		summaries[i] = OrderSummary{
			ID:          o.ID,
			OrderNo:     o.OrderNo,
			Status:      o.Status,
			ProductName: o.ProductName,
			BookingDate: o.BookingDate.Format("2006-01-02"),
			Quantity:    o.Quantity,
			TotalPrice:  o.TotalPrice,
			Currency:    o.Currency,
			CreatedAt:   o.CreatedAt.Format("2006-01-02 15:04:05"),
		}
	}

	return summaries, total, nil
}

// === FAQ ===

// ListFAQs 查询 FAQ 列表
func (s *TicketStore) ListFAQs(category string) ([]model.FAQ, error) {
	var faqs []model.FAQ
	query := s.db.Where("is_active = ?", true)
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if err := query.Order("sort_order ASC, id ASC").Find(&faqs).Error; err != nil {
		return nil, err
	}
	return faqs, nil
}
