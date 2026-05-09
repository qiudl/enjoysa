package model

import (
	"time"

	"github.com/lib/pq"
)

// ChatAgent is a globally registered chat participant — REQ-20260509-0037.
// Phase 1 only seeds 2 hardcoded agents (cs / tech); admin CMS for editing
// is Phase 2.
type ChatAgent struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	Code                string         `gorm:"size:40;not null;uniqueIndex" json:"code"`
	Name                string         `gorm:"size:50;not null" json:"name"`
	MemberType          string         `gorm:"size:20;not null;default:ai" json:"member_type"` // ai | human (P3)
	LLMProvider         string         `gorm:"size:20" json:"llm_provider"`                    // deepseek | glm
	LLMModel            string         `gorm:"size:60" json:"llm_model"`
	SystemPrompt        string         `gorm:"type:text;not null;default:''" json:"system_prompt"`
	ToolKeys            pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"tool_keys"`
	AvatarEmoji         string         `gorm:"size:8" json:"avatar_emoji"`
	ColorHex            string         `gorm:"size:8" json:"color_hex"`
	SortOrder           int            `gorm:"not null;default:0" json:"sort_order"`
	DefaultInNewChannel bool           `gorm:"not null;default:true" json:"default_in_new_channel"`
	Enabled             bool           `gorm:"not null;default:true" json:"enabled"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
}

func (ChatAgent) TableName() string { return "chat_agents" }

// Hardcoded agent codes (Phase 1).
const (
	AgentCodeCustomerService = "customer-service-deepseek"
	AgentCodeTechSupport     = "tech-support-glm"
)
