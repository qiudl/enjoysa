package models

import (
	"time"

	"gorm.io/gorm"
)

// User C端用户模型
type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 基本信息
	Email       string `gorm:"uniqueIndex;size:100;not null" json:"email"`
	Password    string `gorm:"size:255" json:"-"`                           // 密码哈希，不返回给前端
	Name        string `gorm:"size:100" json:"name"`
	Phone       string `gorm:"size:20;index" json:"phone"`
	Avatar      string `gorm:"size:500" json:"avatar"`

	// 第三方登录
	GoogleID    string `gorm:"size:100;index" json:"-"`
	FacebookID  string `gorm:"size:100;index" json:"-"`

	// 状态
	Status      string `gorm:"size:20;default:active" json:"status"`        // active/suspended/deleted
	EmailVerified bool `gorm:"default:false" json:"email_verified"`
	PhoneVerified bool `gorm:"default:false" json:"phone_verified"`

	// 偏好设置
	Language    string `gorm:"size:10;default:en" json:"language"`          // 语言偏好
	Currency    string `gorm:"size:10;default:ZAR" json:"currency"`         // 货币偏好
	Timezone    string `gorm:"size:50;default:Africa/Johannesburg" json:"timezone"`

	// 最后登录
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	LastLoginIP string     `gorm:"size:50" json:"-"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}
