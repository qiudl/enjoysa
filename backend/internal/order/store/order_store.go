package store

import (
	"errors"
	"time"

	"enjoysa-backend/internal/order/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Refund-claim sentinel errors, returned by ClaimRefundIntent.
var (
	// ErrRefundInProgress means a refund was already claimed (processing or
	// completed) — the concurrent/duplicate caller must be rejected.
	ErrRefundInProgress = errors.New("refund already in progress or completed")
	// ErrOrderNotRefundable means the order is not in a refundable status.
	ErrOrderNotRefundable = errors.New("order is not in a refundable status")
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

// ClaimRefundIntent atomically reserves the right to refund an order. Inside a
// single transaction it takes a SELECT ... FOR UPDATE row lock on the order,
// re-checks the refundability invariants under that lock, and marks
// RefundStatus=processing. Only the first concurrent caller wins; any other
// caller racing on the same order gets ErrRefundInProgress. This closes the
// check-then-act window that previously allowed concurrent double-refunds.
//
// It returns the locked order snapshot (so callers have the authoritative
// OrderNo / StripePaymentIntentID) on success.
func (s *OrderStore) ClaimRefundIntent(orderID uint, refundType string, refundAmount float64) (*model.Order, error) {
	var order model.Order
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
			return err
		}
		if order.Status != model.OrderStatusPaid && order.Status != model.OrderStatusAccepted {
			return ErrOrderNotRefundable
		}
		if order.RefundStatus == "processing" || order.RefundStatus == "completed" {
			return ErrRefundInProgress
		}
		order.RefundStatus = "processing"
		order.RefundType = refundType
		order.RefundAmount = refundAmount
		return tx.Model(&order).
			Select("refund_status", "refund_type", "refund_amount").
			Updates(&order).Error
	})
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// UpdateWithStatus optimistic lock: only updates if current DB status matches expectedStatus
func (s *OrderStore) UpdateWithStatus(order *model.Order, expectedStatus model.OrderStatus) error {
	result := s.db.Model(order).Where("id = ? AND status = ?", order.ID, expectedStatus).Updates(order)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound // status already changed by another request
	}
	return nil
}

func (s *OrderStore) GetByID(id uint) (*model.Order, error) {
	var order model.Order
	if err := s.db.Preload("User").Preload("Supplier").First(&order, id).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

func (s *OrderStore) GetByOrderNo(orderNo string) (*model.Order, error) {
	var order model.Order
	if err := s.db.Preload("User").Preload("Supplier").Where("order_no = ?", orderNo).First(&order).Error; err != nil {
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

func (s *OrderStore) DB() *gorm.DB {
	return s.db
}

// RevenueTrendItem 每日收入趋势数据点
type RevenueTrendItem struct {
	Date       string  `json:"date"`
	Revenue    float64 `json:"revenue"`
	OrderCount int64   `json:"order_count"`
}

func (s *OrderStore) GetRevenueTrend(supplierID uint, days int) ([]RevenueTrendItem, error) {
	var items []RevenueTrendItem
	err := s.db.Raw(`
		SELECT TO_CHAR(completed_at, 'YYYY-MM-DD') as date,
		       COALESCE(SUM(total_price), 0) as revenue,
		       COUNT(*) as order_count
		FROM orders
		WHERE supplier_id = ? AND status = 'completed'
		  AND completed_at >= NOW() - INTERVAL '1 day' * ?
		  AND deleted_at IS NULL
		GROUP BY TO_CHAR(completed_at, 'YYYY-MM-DD')
		ORDER BY date ASC
	`, supplierID, days).Scan(&items).Error
	return items, err
}

// TopProductItem 产品销量排行
type TopProductItem struct {
	ProductID   uint    `json:"product_id"`
	ProductName string  `json:"product_name"`
	OrderCount  int64   `json:"order_count"`
	Revenue     float64 `json:"revenue"`
	GuestCount  int64   `json:"guest_count"`
}

func (s *OrderStore) GetTopProducts(supplierID uint, days int, limit int) ([]TopProductItem, error) {
	var items []TopProductItem
	err := s.db.Raw(`
		SELECT product_id, product_name,
		       COUNT(*) as order_count,
		       COALESCE(SUM(total_price), 0) as revenue,
		       COALESCE(SUM(guest_count), 0) as guest_count
		FROM orders
		WHERE supplier_id = ? AND status = 'completed'
		  AND completed_at >= NOW() - INTERVAL '1 day' * ?
		  AND deleted_at IS NULL
		GROUP BY product_id, product_name
		ORDER BY revenue DESC
		LIMIT ?
	`, supplierID, days, limit).Scan(&items).Error
	return items, err
}

// ChannelStatsItem 渠道统计
type ChannelStatsItem struct {
	Channel    string  `json:"channel"`
	OrderCount int64   `json:"order_count"`
	Revenue    float64 `json:"revenue"`
}

func (s *OrderStore) GetChannelStats(supplierID uint, days int) ([]ChannelStatsItem, error) {
	var items []ChannelStatsItem
	err := s.db.Raw(`
		SELECT COALESCE(channel, 'direct') as channel,
		       COUNT(*) as order_count,
		       COALESCE(SUM(total_price), 0) as revenue
		FROM orders
		WHERE supplier_id = ? AND status = 'completed'
		  AND completed_at >= NOW() - INTERVAL '1 day' * ?
		  AND deleted_at IS NULL
		GROUP BY COALESCE(channel, 'direct')
		ORDER BY revenue DESC
	`, supplierID, days).Scan(&items).Error
	return items, err
}

// EnhancedStats 增强型仪表盘统计
type EnhancedStats struct {
	TodayRevenue   float64 `json:"today_revenue"`
	WeekRevenue    float64 `json:"week_revenue"`
	MonthRevenue   float64 `json:"month_revenue"`
	TodayOrders    int64   `json:"today_orders"`
	MonthTotal     int64   `json:"month_total"`
	MonthCancelled int64   `json:"month_cancelled"`
	AvgOrderValue  float64 `json:"avg_order_value"`
}

func (s *OrderStore) GetEnhancedStats(supplierID uint) (*EnhancedStats, error) {
	var stats EnhancedStats
	base := "supplier_id = ? AND status = 'completed' AND deleted_at IS NULL"

	s.db.Raw("SELECT COALESCE(SUM(total_price),0) FROM orders WHERE "+base+" AND completed_at::date = CURRENT_DATE", supplierID).Scan(&stats.TodayRevenue)
	s.db.Raw("SELECT COALESCE(SUM(total_price),0) FROM orders WHERE "+base+" AND completed_at >= DATE_TRUNC('week', CURRENT_DATE)", supplierID).Scan(&stats.WeekRevenue)
	s.db.Raw("SELECT COALESCE(SUM(total_price),0) FROM orders WHERE "+base+" AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)", supplierID).Scan(&stats.MonthRevenue)
	s.db.Raw("SELECT COUNT(*) FROM orders WHERE supplier_id = ? AND deleted_at IS NULL AND created_at::date = CURRENT_DATE", supplierID).Scan(&stats.TodayOrders)
	s.db.Raw("SELECT COUNT(*) FROM orders WHERE supplier_id = ? AND deleted_at IS NULL AND created_at >= DATE_TRUNC('month', CURRENT_DATE)", supplierID).Scan(&stats.MonthTotal)
	s.db.Raw("SELECT COUNT(*) FROM orders WHERE supplier_id = ? AND status = 'cancelled' AND deleted_at IS NULL AND created_at >= DATE_TRUNC('month', CURRENT_DATE)", supplierID).Scan(&stats.MonthCancelled)
	s.db.Raw("SELECT COALESCE(AVG(total_price),0) FROM orders WHERE "+base+" AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)", supplierID).Scan(&stats.AvgOrderValue)

	return &stats, nil
}
