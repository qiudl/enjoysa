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
