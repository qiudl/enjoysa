package translation

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Status string

const (
	StatusPending Status = "pending"
	StatusRunning Status = "running"
	StatusSuccess Status = "success"
	StatusFailed  Status = "failed"
)

type Direction string

const (
	DirectionEN2ZH Direction = "en2zh"
	DirectionZH2EN Direction = "zh2en"
)

type TargetType string

const (
	TargetTypeProduct TargetType = "product"
)

// TranslationTask is a unit of asynchronous LLM translation work.
type TranslationTask struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TargetType TargetType `gorm:"size:32;not null;index:idx_tt_target,priority:1" json:"target_type"`
	TargetID   uint       `gorm:"not null;index:idx_tt_target,priority:2" json:"target_id"`
	Direction  Direction  `gorm:"size:16;not null;default:en2zh" json:"direction"`
	Status     Status     `gorm:"size:16;not null;default:pending;index:idx_tt_status,priority:1" json:"status"`

	Retries    int    `gorm:"not null;default:0" json:"retries"`
	MaxRetries int    `gorm:"not null;default:2" json:"max_retries"`
	LastError  string `gorm:"type:text" json:"last_error,omitempty"`

	Provider         string         `gorm:"size:32" json:"provider,omitempty"`
	ModelVersion     string         `gorm:"size:64" json:"model_version,omitempty"`
	PromptTokens     int            `json:"prompt_tokens,omitempty"`
	CompletionTokens int            `json:"completion_tokens,omitempty"`
	CostUSD          float64        `gorm:"type:decimal(10,6)" json:"cost_usd,omitempty"`
	FieldsInput      datatypes.JSON `gorm:"type:jsonb" json:"fields_input,omitempty"`
	FieldsOutput     datatypes.JSON `gorm:"type:jsonb" json:"fields_output,omitempty"`

	EnqueuedBy  uint       `json:"enqueued_by,omitempty"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

func (TranslationTask) TableName() string {
	return "translation_tasks"
}

// IsTerminal reports whether the task is in a final state.
func (t *TranslationTask) IsTerminal() bool {
	return t.Status == StatusSuccess || t.Status == StatusFailed
}
