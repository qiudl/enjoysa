package model

import (
	"time"

	"github.com/lib/pq"
)

// ChatChannel is a topical sub-room inside a workspace — REQ-20260509-0037.
// User-creatable; one workspace seeds with a single IsDefault=TRUE channel
// (#kefu-default) at first chat-page visit.
type ChatChannel struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	WorkspaceID    uint           `gorm:"not null;uniqueIndex:uq_channel_workspace_slug,priority:1" json:"workspace_id"`
	Name           string         `gorm:"size:40;not null" json:"name"`
	Slug           string         `gorm:"size:40;not null;uniqueIndex:uq_channel_workspace_slug,priority:2" json:"slug"`
	Description    string         `gorm:"size:200;not null;default:''" json:"description"`
	DefaultAgentID *uint          `json:"default_agent_id"`
	KeywordRules   pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"keyword_rules"`
	IsDefault      bool           `gorm:"not null;default:false" json:"is_default"`
	Archived       bool           `gorm:"not null;default:false" json:"archived"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

func (ChatChannel) TableName() string { return "chat_channels" }

// Default channel slug seeded on first workspace creation. Migration code
// keys off IsDefault=TRUE (defect-analysis D4), not this slug — but the
// constant is here so seed + tests share one source.
const DefaultChannelSlug = "kefu-default"
const DefaultChannelName = "客服-默认"
