package store

import (
	"enjoysa-backend/internal/models"

	"gorm.io/gorm"
)

type SupplierUserStore struct {
	db *gorm.DB
}

func NewSupplierUserStore(db *gorm.DB) *SupplierUserStore {
	return &SupplierUserStore{db: db}
}

func (s *SupplierUserStore) GetByEmail(email string) (*models.SupplierUser, error) {
	var su models.SupplierUser
	if err := s.db.Preload("Supplier").Where("email = ?", email).First(&su).Error; err != nil {
		return nil, err
	}
	return &su, nil
}

func (s *SupplierUserStore) GetByID(id uint) (*models.SupplierUser, error) {
	var su models.SupplierUser
	if err := s.db.Preload("Supplier").First(&su, id).Error; err != nil {
		return nil, err
	}
	return &su, nil
}

func (s *SupplierUserStore) Create(su *models.SupplierUser) error {
	return s.db.Create(su).Error
}

func (s *SupplierUserStore) Update(su *models.SupplierUser) error {
	return s.db.Save(su).Error
}
