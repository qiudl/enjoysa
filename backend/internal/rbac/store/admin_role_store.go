package store

import (
	"enjoysa-backend/internal/rbac/model"

	"gorm.io/gorm"
)

type AdminRoleStore struct {
	db *gorm.DB
}

func NewAdminRoleStore(db *gorm.DB) *AdminRoleStore {
	return &AdminRoleStore{db: db}
}

// GetRolesByAdminID returns all roles assigned to an admin.
func (s *AdminRoleStore) GetRolesByAdminID(adminID uint) ([]model.SysRole, error) {
	var roles []model.SysRole
	err := s.db.
		Joins("JOIN admin_roles ON admin_roles.role_id = sys_roles.id").
		Where("admin_roles.admin_id = ?", adminID).
		Find(&roles).Error
	return roles, err
}

// GetRoleCodesByAdminID returns role codes for an admin.
func (s *AdminRoleStore) GetRoleCodesByAdminID(adminID uint) ([]string, error) {
	var codes []string
	err := s.db.
		Model(&model.SysRole{}).
		Joins("JOIN admin_roles ON admin_roles.role_id = sys_roles.id").
		Where("admin_roles.admin_id = ? AND sys_roles.status = 1", adminID).
		Pluck("sys_roles.code", &codes).Error
	return codes, err
}

// ReplaceAdminRoles replaces all role assignments for an admin.
func (s *AdminRoleStore) ReplaceAdminRoles(adminID uint, roleIDs []uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("admin_id = ?", adminID).Delete(&model.AdminRole{}).Error; err != nil {
			return err
		}
		if len(roleIDs) == 0 {
			return nil
		}
		var records []model.AdminRole
		for _, rid := range roleIDs {
			records = append(records, model.AdminRole{AdminID: adminID, RoleID: rid})
		}
		return tx.Create(&records).Error
	})
}

// GetAdminIDsByRoleID returns all admin IDs that have a specific role.
func (s *AdminRoleStore) GetAdminIDsByRoleID(roleID uint) ([]uint, error) {
	var ids []uint
	err := s.db.Model(&model.AdminRole{}).Where("role_id = ?", roleID).Pluck("admin_id", &ids).Error
	return ids, err
}
