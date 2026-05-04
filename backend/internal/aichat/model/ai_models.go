package model

import "time"

// ToolDef defines an AI tool that can be called by the LLM.
type ToolDef struct {
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Parameters   map[string]interface{} `json:"parameters"` // JSON Schema
	Handler      ToolHandler            `json:"-"`
	Category     string                 `json:"category"` // query | action | analysis
	RequiresAuth bool                   `json:"requires_auth"`
}

// ToolContext provides context for tool execution.
type ToolContext struct {
	UserID   *uint  // nil = guest
	Language string // "zh" | "en"
	DB       interface{}
}

// ToolHandler executes a tool and returns a result.
type ToolHandler func(ctx ToolContext, args map[string]interface{}) (interface{}, error)

// OpenAI-compatible function calling types

type OpenAITool struct {
	Type     string         `json:"type"` // "function"
	Function OpenAIFunction `json:"function"`
}

type OpenAIFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type OpenAIToolCall struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"` // "function"
	Function OpenAIFunctionCall `json:"function"`
}

type OpenAIFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON string
}

// SSE event types

type SSEEvent struct {
	Type    string      `json:"type"`    // content_delta | tool_started | tool_completed | error | done
	TraceID string      `json:"trace_id"`
	Seq     int         `json:"seq"`
	Payload interface{} `json:"payload"`
}

type ContentDeltaPayload struct {
	Text string `json:"text"`
}

type ToolStartedPayload struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

type ToolCompletedPayload struct {
	Name       string      `json:"name"`
	Result     interface{} `json:"result"`
	DurationMs int64       `json:"duration_ms"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type DonePayload struct {
	ElapsedMs     int64 `json:"elapsed_ms"`
	ContentTokens int   `json:"content_tokens,omitempty"`
}

// DB models

type AICache struct {
	ID        uint      `gorm:"primarykey"`
	CacheKey  string    `gorm:"uniqueIndex;size:200"`
	CacheType string    `gorm:"size:50"`
	Result    string    `gorm:"type:jsonb"`
	ExpiresAt time.Time `gorm:"index"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (AICache) TableName() string { return "ai_cache" }

type AIFaqFeedback struct {
	ID        uint   `gorm:"primarykey"`
	ProductID uint   `gorm:"index"`
	Question  string `gorm:"type:text"`
	Answer    string `gorm:"type:text"`
	Helpful   *bool
	CreatedAt time.Time
}

func (AIFaqFeedback) TableName() string { return "ai_faq_feedback" }

type AIMetric struct {
	ID           uint   `gorm:"primarykey"`
	Scene        string `gorm:"size:50;index"`
	LatencyMs    int
	TokensUsed   int
	Success      bool `gorm:"default:true"`
	ErrorMessage string
	CreatedAt    time.Time
}

func (AIMetric) TableName() string { return "ai_metrics" }
