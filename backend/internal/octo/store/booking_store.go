package store

import (
	"time"

	"enjoysa-backend/internal/octo/model"

	"gorm.io/gorm"
)

type BookingStore struct {
	db *gorm.DB
}

func NewBookingStore(db *gorm.DB) *BookingStore {
	return &BookingStore{db: db}
}

func (s *BookingStore) DB() *gorm.DB {
	return s.db
}

// Create 创建预订
func (s *BookingStore) Create(booking *model.OctoBooking) error {
	return s.db.Create(booking).Error
}

// CreateInTx 在事务中创建预订
func (s *BookingStore) CreateInTx(tx *gorm.DB, booking *model.OctoBooking) error {
	return tx.Create(booking).Error
}

// GetByUUID 通过 UUID 获取预订
func (s *BookingStore) GetByUUID(uuid string) (*model.OctoBooking, error) {
	var booking model.OctoBooking
	err := s.db.Where("uuid = ?", uuid).First(&booking).Error
	if err != nil {
		return nil, err
	}
	return &booking, nil
}

// Update 更新预订
func (s *BookingStore) Update(booking *model.OctoBooking) error {
	return s.db.Save(booking).Error
}

// UpdateInTx 在事务中更新预订
func (s *BookingStore) UpdateInTx(tx *gorm.DB, booking *model.OctoBooking) error {
	return tx.Save(booking).Error
}

// List 查询预订列表
func (s *BookingStore) List(resellerID uint, productID *uint, status *string, limit int) ([]model.OctoBooking, error) {
	var bookings []model.OctoBooking
	query := s.db.Where("reseller_id = ?", resellerID)
	if productID != nil {
		query = query.Where("product_id = ?", *productID)
	}
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	if limit <= 0 {
		limit = 100
	}
	err := query.Order("created_at DESC").Limit(limit).Find(&bookings).Error
	return bookings, err
}

// ExpireHoldBookings 将过期的 ON_HOLD 预订标记为 EXPIRED
func (s *BookingStore) ExpireHoldBookings() ([]model.OctoBooking, error) {
	var expired []model.OctoBooking
	err := s.db.Where("status = ? AND expires_at < ?", model.OctoBookingOnHold, time.Now()).
		Find(&expired).Error
	if err != nil {
		return nil, err
	}
	if len(expired) > 0 {
		now := time.Now()
		for i := range expired {
			expired[i].Status = model.OctoBookingExpired
			expired[i].CancelledAt = &now
			s.db.Save(&expired[i])
		}
	}
	return expired, nil
}
