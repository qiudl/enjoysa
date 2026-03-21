package store

import (
	"time"

	"enjoysa-backend/internal/product/model"

	"gorm.io/gorm"
)

type ScheduleStore struct {
	db *gorm.DB
}

func NewScheduleStore(db *gorm.DB) *ScheduleStore {
	return &ScheduleStore{db: db}
}

func (s *ScheduleStore) ListByProduct(productID uint, from, to time.Time) ([]model.ProductSchedule, error) {
	var schedules []model.ProductSchedule
	query := s.db.Where("product_id = ?", productID)
	if !from.IsZero() {
		query = query.Where("date >= ?", from)
	}
	if !to.IsZero() {
		query = query.Where("date <= ?", to)
	}
	if err := query.Order("date ASC, time_slot ASC").Find(&schedules).Error; err != nil {
		return nil, err
	}
	return schedules, nil
}

func (s *ScheduleStore) GetByID(id uint) (*model.ProductSchedule, error) {
	var schedule model.ProductSchedule
	if err := s.db.First(&schedule, id).Error; err != nil {
		return nil, err
	}
	return &schedule, nil
}

func (s *ScheduleStore) Create(schedule *model.ProductSchedule) error {
	return s.db.Create(schedule).Error
}

func (s *ScheduleStore) BatchCreate(schedules []model.ProductSchedule) error {
	return s.db.Create(&schedules).Error
}

func (s *ScheduleStore) Update(schedule *model.ProductSchedule) error {
	return s.db.Save(schedule).Error
}

func (s *ScheduleStore) Delete(id uint) error {
	return s.db.Delete(&model.ProductSchedule{}, id).Error
}

func (s *ScheduleStore) DecrementSlot(id uint, quantity int) error {
	err := s.db.Model(&model.ProductSchedule{}).
		Where("id = ? AND (total_slots - booked_slots) >= ?", id, quantity).
		Update("booked_slots", gorm.Expr("booked_slots + ?", quantity)).Error
	if err != nil {
		return err
	}
	// Auto-set status to full when sold out
	s.db.Model(&model.ProductSchedule{}).
		Where("id = ? AND booked_slots >= total_slots AND status = 'available'", id).
		Update("status", "full")
	return nil
}

func (s *ScheduleStore) IncrementSlot(id uint, quantity int) error {
	err := s.db.Model(&model.ProductSchedule{}).
		Where("id = ?", id).
		Update("booked_slots", gorm.Expr("booked_slots - ?", quantity)).Error
	if err != nil {
		return err
	}
	// Auto-restore status when slots become available
	s.db.Model(&model.ProductSchedule{}).
		Where("id = ? AND booked_slots < total_slots AND status = 'full'", id).
		Update("status", "available")
	return nil
}

// ScheduleAlertItem 库存预警条目
type ScheduleAlertItem struct {
	ScheduleID  uint    `json:"schedule_id"`
	ProductID   uint    `json:"product_id"`
	ProductName string  `json:"product_name"`
	Date        string  `json:"date"`
	TimeSlot    string  `json:"time_slot"`
	TotalSlots  int     `json:"total_slots"`
	BookedSlots int     `json:"booked_slots"`
	Remaining   int     `json:"remaining"`
	Price       float64 `json:"price"`
}

func (s *ScheduleStore) GetAlerts(supplierID uint) (lowStock []ScheduleAlertItem, soldOut []ScheduleAlertItem, err error) {
	sevenDaysLater := time.Now().AddDate(0, 0, 7)

	// Low stock: remaining <= 20% and > 0
	s.db.Raw(`
		SELECT ps.id as schedule_id, ps.product_id, p.name_zh as product_name,
		       TO_CHAR(ps.date, 'YYYY-MM-DD') as date, ps.time_slot,
		       ps.total_slots, ps.booked_slots,
		       (ps.total_slots - ps.booked_slots) as remaining,
		       COALESCE(ps.price, 0) as price
		FROM product_schedules ps
		JOIN products p ON p.id = ps.product_id
		WHERE p.supplier_id = ? AND ps.date >= CURRENT_DATE AND ps.date <= ?
		  AND ps.status = 'available'
		  AND ps.total_slots > 0
		  AND (ps.total_slots - ps.booked_slots) > 0
		  AND (ps.total_slots - ps.booked_slots)::float / ps.total_slots <= 0.2
		ORDER BY ps.date ASC
	`, supplierID, sevenDaysLater).Scan(&lowStock)

	// Sold out
	s.db.Raw(`
		SELECT ps.id as schedule_id, ps.product_id, p.name_zh as product_name,
		       TO_CHAR(ps.date, 'YYYY-MM-DD') as date, ps.time_slot,
		       ps.total_slots, ps.booked_slots, 0 as remaining,
		       COALESCE(ps.price, 0) as price
		FROM product_schedules ps
		JOIN products p ON p.id = ps.product_id
		WHERE p.supplier_id = ? AND ps.date >= CURRENT_DATE AND ps.date <= ?
		  AND (ps.status = 'full' OR ps.booked_slots >= ps.total_slots)
		ORDER BY ps.date ASC
	`, supplierID, sevenDaysLater).Scan(&soldOut)

	return
}

// CalendarSummaryItem 日历日摘要
type CalendarSummaryItem struct {
	Date         string  `json:"date"`
	ScheduleCount int    `json:"schedule_count"`
	TotalSlots   int     `json:"total_slots"`
	BookedSlots  int     `json:"booked_slots"`
	Revenue      float64 `json:"revenue"`
}

func (s *ScheduleStore) CalendarSummary(productID uint, month string) ([]CalendarSummaryItem, error) {
	var items []CalendarSummaryItem
	err := s.db.Raw(`
		SELECT TO_CHAR(date, 'YYYY-MM-DD') as date,
		       COUNT(*) as schedule_count,
		       COALESCE(SUM(total_slots), 0) as total_slots,
		       COALESCE(SUM(booked_slots), 0) as booked_slots,
		       COALESCE(SUM(booked_slots * COALESCE(price, 0)), 0) as revenue
		FROM product_schedules
		WHERE product_id = ? AND TO_CHAR(date, 'YYYY-MM') = ?
		GROUP BY TO_CHAR(date, 'YYYY-MM-DD')
		ORDER BY date ASC
	`, productID, month).Scan(&items).Error
	return items, err
}

// BatchDelete 批量删除排期
func (s *ScheduleStore) BatchDelete(ids []uint) (deleted int64, hasBookings []uint, err error) {
	// Find schedules with bookings
	s.db.Raw(`
		SELECT id FROM product_schedules
		WHERE id IN ? AND booked_slots > 0
	`, ids).Scan(&hasBookings)

	// Delete only those without bookings
	deleteIDs := make([]uint, 0)
	bookedSet := make(map[uint]bool)
	for _, id := range hasBookings {
		bookedSet[id] = true
	}
	for _, id := range ids {
		if !bookedSet[id] {
			deleteIDs = append(deleteIDs, id)
		}
	}

	if len(deleteIDs) > 0 {
		result := s.db.Delete(&model.ProductSchedule{}, deleteIDs)
		deleted = result.RowsAffected
		err = result.Error
	}
	return
}

// ListByProductAndPackage 按产品和套餐查询日期范围内的排期
func (s *ScheduleStore) ListByProductAndPackage(productID, packageID uint, from, to time.Time) ([]model.ProductSchedule, error) {
	var schedules []model.ProductSchedule
	query := s.db.Where("product_id = ? AND package_id = ?", productID, packageID)
	if !from.IsZero() {
		query = query.Where("date >= ?", from)
	}
	if !to.IsZero() {
		query = query.Where("date <= ?", to)
	}
	if err := query.Order("date ASC, time_slot ASC").Find(&schedules).Error; err != nil {
		return nil, err
	}
	return schedules, nil
}
