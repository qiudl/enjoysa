package model

import "time"

// ChatWorkspace is the per-user "Slack workspace" — REQ-20260509-0037.
// One row per (OwnerUserID, OwnerUserType).
type ChatWorkspace struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	OwnerUserID   uint      `gorm:"not null;uniqueIndex:uq_workspace_owner,priority:1" json:"owner_user_id"`
	OwnerUserType string    `gorm:"size:20;not null;uniqueIndex:uq_workspace_owner,priority:2" json:"owner_user_type"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (ChatWorkspace) TableName() string { return "chat_workspaces" }
