package store

import (
	"enjoysa-backend/internal/product/model"

	"gorm.io/gorm"
)

type CategoryStore struct {
	db *gorm.DB
}

func NewCategoryStore(db *gorm.DB) *CategoryStore {
	return &CategoryStore{db: db}
}

func (s *CategoryStore) List() ([]model.Category, error) {
	var categories []model.Category
	if err := s.db.Order("sort_order ASC, id ASC").Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (s *CategoryStore) GetByID(id uint) (*model.Category, error) {
	var cat model.Category
	if err := s.db.First(&cat, id).Error; err != nil {
		return nil, err
	}
	return &cat, nil
}

func (s *CategoryStore) Create(cat *model.Category) error {
	return s.db.Create(cat).Error
}

func (s *CategoryStore) Update(cat *model.Category) error {
	return s.db.Save(cat).Error
}

func (s *CategoryStore) Delete(id uint) error {
	return s.db.Delete(&model.Category{}, id).Error
}

// GetProductCounts returns approved product count per category
func (s *CategoryStore) GetProductCounts() (map[uint]int, error) {
	type countItem struct {
		CategoryID uint `json:"category_id"`
		Count      int  `json:"count"`
	}
	var items []countItem
	err := s.db.Raw(`
		SELECT category_id, COUNT(*) as count
		FROM products
		WHERE status = 'approved' AND deleted_at IS NULL AND category_id > 0
		GROUP BY category_id
	`).Scan(&items).Error
	if err != nil {
		return nil, err
	}
	result := make(map[uint]int, len(items))
	for _, item := range items {
		result[item.CategoryID] = item.Count
	}
	return result, nil
}
