package store

import (
	"enjoysa-backend/internal/rbac/model"

	"gorm.io/gorm"
)

type RoleMenuStore struct {
	db *gorm.DB
}

func NewRoleMenuStore(db *gorm.DB) *RoleMenuStore {
	return &RoleMenuStore{db: db}
}

// GetMenuIDsByRoleID returns all menu IDs assigned to a role.
func (s *RoleMenuStore) GetMenuIDsByRoleID(roleID uint) ([]uint, error) {
	var ids []uint
	err := s.db.Model(&model.SysRoleMenu{}).Where("role_id = ?", roleID).Pluck("menu_id", &ids).Error
	return ids, err
}

// GetMenusByRoleID returns all menus assigned to a role.
func (s *RoleMenuStore) GetMenusByRoleID(roleID uint) ([]model.SysMenu, error) {
	var menus []model.SysMenu
	err := s.db.
		Joins("JOIN sys_role_menus ON sys_role_menus.menu_id = sys_menus.id").
		Where("sys_role_menus.role_id = ?", roleID).
		Order("sys_menus.sort_order ASC, sys_menus.id ASC").
		Find(&menus).Error
	return menus, err
}

// ReplaceRoleMenus replaces all menu assignments for a role within a transaction.
func (s *RoleMenuStore) ReplaceRoleMenus(roleID uint, menuIDs []uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&model.SysRoleMenu{}).Error; err != nil {
			return err
		}
		if len(menuIDs) == 0 {
			return nil
		}
		var records []model.SysRoleMenu
		for _, mid := range menuIDs {
			records = append(records, model.SysRoleMenu{RoleID: roleID, MenuID: mid})
		}
		return tx.Create(&records).Error
	})
}
