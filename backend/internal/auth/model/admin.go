package model

import (
	"time"

	"gorm.io/gorm"
)

// Admin 管理员模型
type Admin struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Email    string `gorm:"uniqueIndex;size:100;not null" json:"email"`
	Password string `gorm:"size:255" json:"-"`
	Name     string `gorm:"size:100" json:"name"`
	Role     string `gorm:"size:20;default:admin" json:"role"`   // super_admin/admin
	Status   string `gorm:"size:20;default:active" json:"status"` // active/suspended

	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
}

func (Admin) TableName() string {
	return "admins"
}
