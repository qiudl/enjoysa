package store

import (
	"enjoysa-backend/internal/chat/model"

	"gorm.io/gorm"
)

type ShareStore struct {
	db *gorm.DB
}

func NewShareStore(db *gorm.DB) *ShareStore {
	return &ShareStore{db: db}
}

func (s *ShareStore) Create(share *model.ChatMessageShare) error {
	return s.db.Create(share).Error
}

func (s *ShareStore) Update(share *model.ChatMessageShare) error {
	return s.db.Save(share).Error
}

// ListByUser returns the user's shares ordered newest first.
// For supplier users this naturally scopes to their account; if all members of
// a supplier should see each other's shares, callers can use ListBySupplier.
func (s *ShareStore) ListByUser(userID uint, userType string, page, pageSize int) ([]model.ChatMessageShare, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	q := s.db.Model(&model.ChatMessageShare{}).
		Where("user_id = ? AND user_type = ?", userID, userType)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []model.ChatMessageShare
	if err := q.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ListBySupplier returns shares from any member of the same supplier, useful
// for the "company-wide share history" Tab on the supplier settings page.
func (s *ShareStore) ListBySupplier(supplierID uint, page, pageSize int) ([]model.ChatMessageShare, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	q := s.db.Model(&model.ChatMessageShare{}).
		Where("supplier_id = ?", supplierID)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []model.ChatMessageShare
	if err := q.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
