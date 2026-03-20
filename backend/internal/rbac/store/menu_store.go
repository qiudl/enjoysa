package store

import (
	"enjoysa-backend/internal/rbac/model"

	"gorm.io/gorm"
)

type MenuStore struct {
	db *gorm.DB
}

func NewMenuStore(db *gorm.DB) *MenuStore {
	return &MenuStore{db: db}
}

func (s *MenuStore) List() ([]model.SysMenu, error) {
	var menus []model.SysMenu
	err := s.db.Order("sort_order ASC, id ASC").Find(&menus).Error
	return menus, err
}

func (s *MenuStore) GetByID(id uint) (*model.SysMenu, error) {
	var menu model.SysMenu
	err := s.db.First(&menu, id).Error
	return &menu, err
}

func (s *MenuStore) Create(menu *model.SysMenu) error {
	return s.db.Create(menu).Error
}

func (s *MenuStore) Update(menu *model.SysMenu) error {
	return s.db.Save(menu).Error
}

func (s *MenuStore) Delete(id uint) error {
	return s.db.Delete(&model.SysMenu{}, id).Error
}

// BuildTree converts a flat menu list into a tree structure.
func BuildTree(menus []model.SysMenu) []model.SysMenu {
	menuMap := make(map[uint]*model.SysMenu)
	var roots []model.SysMenu

	for i := range menus {
		menus[i].Children = nil
		menuMap[menus[i].ID] = &menus[i]
	}

	for i := range menus {
		if menus[i].ParentID == 0 {
			roots = append(roots, menus[i])
		} else if parent, ok := menuMap[menus[i].ParentID]; ok {
			parent.Children = append(parent.Children, menus[i])
		}
	}

	// Update root children from map
	for i := range roots {
		if mapped, ok := menuMap[roots[i].ID]; ok {
			roots[i].Children = mapped.Children
		}
	}

	return roots
}
