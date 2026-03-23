package model

import (
	"time"

	"gorm.io/gorm"
)

type SupplierInvitation struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	SupplierID uint      `gorm:"index;not null" json:"supplier_id"`
	Email      string    `gorm:"size:100;not null" json:"email"`
	Role       string    `gorm:"size:20;default:staff" json:"role"`
	Token      string    `gorm:"size:64;uniqueIndex" json:"-"`
	Status     string    `gorm:"size:20;default:pending" json:"status"` // pending, accepted, expired, revoked
	ExpiresAt  time.Time `json:"expires_at"`
	InvitedBy  uint      `json:"invited_by"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
}

func (SupplierInvitation) TableName() string {
	return "supplier_invitations"
}
