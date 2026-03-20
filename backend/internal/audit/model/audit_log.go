package model

import "time"

type AuditLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	AdminID    uint      `gorm:"index" json:"admin_id"`
	AdminName  string    `gorm:"size:100" json:"admin_name"`
	Action     string    `gorm:"size:32;index" json:"action"`     // create, update, delete, approve, reject, login
	Resource   string    `gorm:"size:64;index" json:"resource"`   // users, products, roles, admins, suppliers, orders, settings
	ResourceID uint      `json:"resource_id"`
	Detail     string    `gorm:"type:text" json:"detail"`
	IP         string    `gorm:"size:45" json:"ip"`
	UserAgent  string    `gorm:"size:255" json:"user_agent"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
