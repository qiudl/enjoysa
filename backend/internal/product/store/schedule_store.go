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
	return s.db.Model(&model.ProductSchedule{}).
		Where("id = ? AND (total_slots - booked_slots) >= ?", id, quantity).
		Update("booked_slots", gorm.Expr("booked_slots + ?", quantity)).Error
}

func (s *ScheduleStore) IncrementSlot(id uint, quantity int) error {
	return s.db.Model(&model.ProductSchedule{}).
		Where("id = ?", id).
		Update("booked_slots", gorm.Expr("booked_slots - ?", quantity)).Error
}
