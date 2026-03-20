package store

import (
	"enjoysa-backend/internal/rbac/model"

	"gorm.io/gorm"
)

type RoleStore struct {
	db *gorm.DB
}

func NewRoleStore(db *gorm.DB) *RoleStore {
	return &RoleStore{db: db}
}

func (s *RoleStore) List() ([]model.SysRole, error) {
	var roles []model.SysRole
	err := s.db.Order("sort_order ASC, id ASC").Find(&roles).Error
	return roles, err
}

func (s *RoleStore) GetByID(id uint) (*model.SysRole, error) {
	var role model.SysRole
	err := s.db.First(&role, id).Error
	return &role, err
}

func (s *RoleStore) GetByCode(code string) (*model.SysRole, error) {
	var role model.SysRole
	err := s.db.Where("code = ?", code).First(&role).Error
	return &role, err
}

func (s *RoleStore) Create(role *model.SysRole) error {
	return s.db.Create(role).Error
}

func (s *RoleStore) Update(role *model.SysRole) error {
	return s.db.Save(role).Error
}

func (s *RoleStore) Delete(id uint) error {
	return s.db.Delete(&model.SysRole{}, id).Error
}
