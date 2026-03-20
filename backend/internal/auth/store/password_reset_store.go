package store

import (
	"time"

	"enjoysa-backend/internal/auth/model"

	"gorm.io/gorm"
)

type PasswordResetStore struct {
	db *gorm.DB
}

func NewPasswordResetStore(db *gorm.DB) *PasswordResetStore {
	return &PasswordResetStore{db: db}
}

func (s *PasswordResetStore) Create(token *model.PasswordResetToken) error {
	return s.db.Create(token).Error
}

func (s *PasswordResetStore) FindValidToken(tokenStr string) (*model.PasswordResetToken, error) {
	var t model.PasswordResetToken
	err := s.db.Where("token = ? AND used_at IS NULL AND expires_at > ?", tokenStr, time.Now()).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *PasswordResetStore) MarkUsed(id uint) error {
	now := time.Now()
	return s.db.Model(&model.PasswordResetToken{}).Where("id = ?", id).Update("used_at", now).Error
}

func (s *PasswordResetStore) InvalidateUserTokens(userID uint) error {
	return s.db.Where("user_id = ? AND used_at IS NULL", userID).Delete(&model.PasswordResetToken{}).Error
}

func (s *PasswordResetStore) CountRecent(userID uint, window time.Duration) (int64, error) {
	var count int64
	since := time.Now().Add(-window)
	err := s.db.Model(&model.PasswordResetToken{}).
		Where("user_id = ? AND created_at > ?", userID, since).
		Count(&count).Error
	return count, err
}
