package store

import (
	"enjoysa-backend/internal/contact/model"

	"gorm.io/gorm"
)

type ContactStore struct {
	db *gorm.DB
}

func NewContactStore(db *gorm.DB) *ContactStore {
	return &ContactStore{db: db}
}

func (s *ContactStore) Create(msg *model.ContactMessage) error {
	return s.db.Create(msg).Error
}

func (s *ContactStore) List(page, pageSize int) ([]model.ContactMessage, int64, error) {
	var messages []model.ContactMessage
	var total int64

	s.db.Model(&model.ContactMessage{}).Count(&total)

	offset := (page - 1) * pageSize
	err := s.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&messages).Error
	return messages, total, err
}

func (s *ContactStore) UpdateStatus(id uint, status string) error {
	return s.db.Model(&model.ContactMessage{}).Where("id = ?", id).Update("status", status).Error
}
