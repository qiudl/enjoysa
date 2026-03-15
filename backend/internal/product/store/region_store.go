package store

import (
	"enjoysa-backend/internal/product/model"

	"gorm.io/gorm"
)

type RegionStore struct {
	db *gorm.DB
}

func NewRegionStore(db *gorm.DB) *RegionStore {
	return &RegionStore{db: db}
}

func (s *RegionStore) List() ([]model.Region, error) {
	var regions []model.Region
	if err := s.db.Order("sort_order ASC, id ASC").Find(&regions).Error; err != nil {
		return nil, err
	}
	return regions, nil
}

func (s *RegionStore) GetBySlug(slug string) (*model.Region, error) {
	var region model.Region
	if err := s.db.Where("slug = ?", slug).First(&region).Error; err != nil {
		return nil, err
	}
	return &region, nil
}

func (s *RegionStore) GetByID(id uint) (*model.Region, error) {
	var region model.Region
	if err := s.db.First(&region, id).Error; err != nil {
		return nil, err
	}
	return &region, nil
}

func (s *RegionStore) Create(region *model.Region) error {
	return s.db.Create(region).Error
}

func (s *RegionStore) Update(region *model.Region) error {
	return s.db.Save(region).Error
}

func (s *RegionStore) Delete(id uint) error {
	return s.db.Delete(&model.Region{}, id).Error
}

func (s *RegionStore) UpdateAttractionCount(regionID uint) error {
	return s.db.Exec(
		"UPDATE regions SET attraction_count = (SELECT COUNT(*) FROM products WHERE region_id = ? AND status = 'approved' AND deleted_at IS NULL) WHERE id = ?",
		regionID, regionID,
	).Error
}
