package store

import (
	"enjoysa-backend/internal/octo/model"

	"gorm.io/gorm"
)

type ResellerStore struct {
	db *gorm.DB
}

func NewResellerStore(db *gorm.DB) *ResellerStore {
	return &ResellerStore{db: db}
}

// FindByAPIKey 通过 API Key 查找活跃的分销商
func (s *ResellerStore) FindByAPIKey(apiKey string) (*model.OctoReseller, error) {
	var reseller model.OctoReseller
	err := s.db.Where("api_key = ? AND status = ?", apiKey, "active").First(&reseller).Error
	if err != nil {
		return nil, err
	}
	return &reseller, nil
}

// GetByID 通过 ID 查找分销商
func (s *ResellerStore) GetByID(id uint) (*model.OctoReseller, error) {
	var reseller model.OctoReseller
	err := s.db.First(&reseller, id).Error
	if err != nil {
		return nil, err
	}
	return &reseller, nil
}
