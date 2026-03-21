package store

import (
	"time"

	"enjoysa-backend/internal/order/model"

	"gorm.io/gorm"
)

type OrderStore struct {
	db *gorm.DB
}

func NewOrderStore(db *gorm.DB) *OrderStore {
	return &OrderStore{db: db}
}

type OrderFilter struct {
	UserID     uint
	SupplierID uint
	Status     string
	Channel    string
	Keyword    string
	StartDate  string
	EndDate    string
	Page       int
	PageSize   int
}

func (s *OrderStore) Create(order *model.Order) error {
	return s.db.Create(order).Error
}

func (s *OrderStore) Update(order *model.Order) error {
	return s.db.Save(order).Error
}

func (s *OrderStore) GetByID(id uint) (*model.Order, error) {
	var order model.Order
	if err := s.db.Preload("User").Preload("Supplier").First(&order, id).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

func (s *OrderStore) List(filter OrderFilter) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64

	query := s.db.Model(&model.Order{})

	if filter.UserID > 0 {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.SupplierID > 0 {
		query = query.Where("supplier_id = ?", filter.SupplierID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Channel != "" {
		query = query.Where("channel = ?", filter.Channel)
	}
	if filter.Keyword != "" {
		kw := "%" + filter.Keyword + "%"
		query = query.Where("order_no ILIKE ? OR product_name ILIKE ? OR user_name ILIKE ?", kw, kw, kw)
	}
	if filter.StartDate != "" {
		query = query.Where("created_at >= ?", filter.StartDate)
	}
	if filter.EndDate != "" {
		query = query.Where("created_at <= ?", filter.EndDate+" 23:59:59")
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
	if err := query.
		Preload("User").Preload("Supplier").
		Offset(offset).Limit(pageSize).
		Order("id DESC").
		Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (s *OrderStore) AddHistory(history *model.OrderStatusHistory) error {
	return s.db.Create(history).Error
}

func (s *OrderStore) GetHistory(orderID uint) ([]model.OrderStatusHistory, error) {
	var history []model.OrderStatusHistory
	if err := s.db.Where("order_id = ?", orderID).Order("id ASC").Find(&history).Error; err != nil {
		return nil, err
	}
	return history, nil
}

type OrderStats struct {
	Total       int64   `json:"total"`
	Pending     int64   `json:"pending"`
	Paid        int64   `json:"paid"`
	Accepted    int64   `json:"accepted"`
	Completed   int64   `json:"completed"`
	Cancelled   int64   `json:"cancelled"`
	TotalAmount float64 `json:"total_amount"`
}

func (s *OrderStore) GetStats(supplierID uint) (*OrderStats, error) {
	var stats OrderStats

	base := s.db.Model(&model.Order{}).Where("supplier_id = ?", supplierID)

	base.Count(&stats.Total)
	base.Where("status = ?", "pending").Count(&stats.Pending)
	s.db.Model(&model.Order{}).Where("supplier_id = ? AND status = ?", supplierID, "paid").Count(&stats.Paid)
	s.db.Model(&model.Order{}).Where("supplier_id = ? AND status = ?", supplierID, "accepted").Count(&stats.Accepted)
	s.db.Model(&model.Order{}).Where("supplier_id = ? AND status = ?", supplierID, "completed").Count(&stats.Completed)
	s.db.Model(&model.Order{}).Where("supplier_id = ? AND status = ?", supplierID, "cancelled").Count(&stats.Cancelled)

	s.db.Model(&model.Order{}).
		Where("supplier_id = ? AND status = ?", supplierID, "completed").
		Select("COALESCE(SUM(total_price), 0)").
		Scan(&stats.TotalAmount)

	return &stats, nil
}

func (s *OrderStore) CancelExpired() (int64, error) {
	now := time.Now()
	result := s.db.Model(&model.Order{}).
		Where("status = ? AND expires_at IS NOT NULL AND expires_at < ?", model.OrderStatusPending, now).
		Update("status", model.OrderStatusCancelled)
	return result.RowsAffected, result.Error
}

func (s *OrderStore) GetByStripeSessionID(sessionID string) (*model.Order, error) {
	var order model.Order
	if err := s.db.Where("stripe_session_id = ?", sessionID).First(&order).Error; err != nil {
		return nil, err
	}
	return &order, nil
}
