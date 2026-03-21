package store

import (
	"time"

	"enjoysa-backend/internal/octo/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AvailabilityStore struct {
	db *gorm.DB
}

func NewAvailabilityStore(db *gorm.DB) *AvailabilityStore {
	return &AvailabilityStore{db: db}
}

// Cache 缓存 availability ID → schedule 映射（upsert）
func (s *AvailabilityStore) Cache(entry *model.OctoAvailabilityCache) error {
	entry.CreatedAt = time.Now()
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"expires_at"}),
	}).Create(entry).Error
}

// Get 通过 availabilityId 获取缓存条目
func (s *AvailabilityStore) Get(availabilityID string) (*model.OctoAvailabilityCache, error) {
	var entry model.OctoAvailabilityCache
	err := s.db.Where("id = ? AND expires_at > ?", availabilityID, time.Now()).First(&entry).Error
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// CleanExpired 清理过期缓存
func (s *AvailabilityStore) CleanExpired() (int64, error) {
	result := s.db.Where("expires_at < ?", time.Now()).Delete(&model.OctoAvailabilityCache{})
	return result.RowsAffected, result.Error
}
