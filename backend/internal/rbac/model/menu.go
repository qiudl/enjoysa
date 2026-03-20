package model

import (
	"time"

	"gorm.io/gorm"
)

type SysMenu struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ParentID  uint   `gorm:"default:0;index" json:"parent_id"`
	Name      string `gorm:"size:64;not null" json:"name"`
	Title     string `gorm:"size:128;not null" json:"title"`
	TitleZh   string `gorm:"size:128" json:"title_zh"`
	Icon      string `gorm:"size:64" json:"icon"`
	Path      string `gorm:"size:128" json:"path"`
	Authority string `gorm:"size:128" json:"authority"`
	MenuType  int    `gorm:"default:0;comment:0=directory 1=menu 2=button" json:"menu_type"`
	Method    string `gorm:"size:64" json:"method"`
	ApiPath   string `gorm:"size:255" json:"api_path"`
	SortOrder int    `gorm:"default:100" json:"sort_order"`
	Status    int    `gorm:"default:1" json:"status"`
	Hidden    bool   `gorm:"default:false" json:"hidden"`

	Children []SysMenu `gorm:"-" json:"children,omitempty"`
}

func (SysMenu) TableName() string {
	return "sys_menus"
}
