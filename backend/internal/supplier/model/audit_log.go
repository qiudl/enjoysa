package model

import "time"

type SupplierAuditLog struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	SupplierID   uint      `gorm:"index" json:"supplier_id"`
	UserID       uint      `json:"user_id"`
	UserName     string    `gorm:"size:100" json:"user_name"`
	Action       string    `gorm:"size:50;index" json:"action"`
	ResourceType string    `gorm:"size:30" json:"resource_type"`
	ResourceID   uint      `json:"resource_id"`
	ResourceName string    `gorm:"size:255" json:"resource_name"`
	Detail       string    `gorm:"type:jsonb" json:"detail"`
	IP           string    `gorm:"size:50" json:"ip"`
	UserAgent    string    `gorm:"size:500" json:"user_agent"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

func (SupplierAuditLog) TableName() string {
	return "supplier_audit_logs"
}
