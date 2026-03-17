package store

import (
	"enjoysa-backend/internal/auth/model"

	"gorm.io/gorm"
)

type AdminStore struct {
	db *gorm.DB
}

func NewAdminStore(db *gorm.DB) *AdminStore {
	return &AdminStore{db: db}
}

func (s *AdminStore) GetByEmail(email string) (*model.Admin, error) {
	var admin model.Admin
	if err := s.db.Where("email = ?", email).First(&admin).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

func (s *AdminStore) GetByID(id uint) (*model.Admin, error) {
	var admin model.Admin
	if err := s.db.First(&admin, id).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

func (s *AdminStore) Create(admin *model.Admin) error {
	return s.db.Create(admin).Error
}

func (s *AdminStore) Update(admin *model.Admin) error {
	return s.db.Save(admin).Error
}

func (s *AdminStore) Delete(id uint) error {
	return s.db.Delete(&model.Admin{}, id).Error
}

func (s *AdminStore) CountActiveSuperAdmins() (int64, error) {
	var count int64
	err := s.db.Model(&model.Admin{}).Where("role = ? AND status = ?", "super_admin", "active").Count(&count).Error
	return count, err
}

func (s *AdminStore) List(page, pageSize int) ([]model.Admin, int64, error) {
	var admins []model.Admin
	var total int64

	s.db.Model(&model.Admin{}).Count(&total)

	offset := (page - 1) * pageSize
	if err := s.db.Offset(offset).Limit(pageSize).Order("id ASC").Find(&admins).Error; err != nil {
		return nil, 0, err
	}

	return admins, total, nil
}
