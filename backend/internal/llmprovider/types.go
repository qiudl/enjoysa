// Package llmprovider provides a uniform interface for OpenAI-compatible
// chat completion providers (DeepSeek, GLM, etc).
//
// REQ-20260509-0037 Phase 1: extracted to allow per-agent provider routing
// in the upcoming group-chat model. Existing aichat.service.LLMClient remains
// in use; consumers will migrate over subsequent sub-tasks.
package llmprovider

// Message is a provider-agnostic chat message (OpenAI shape).
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

// ToolCall is an LLM-emitted function invocation.
type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"` // always "function"
	Function FunctionCall `json:"function"`
}

type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// Tool is a function spec sent to the LLM (OpenAI shape).
type Tool struct {
	Type     string       `json:"type"` // always "function"
	Function ToolFunction `json:"function"`
}

type ToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// Request is a provider-agnostic chat request.
type Request struct {
	Model    string    // override default; empty = provider default
	Messages []Message
	Tools    []Tool    // optional; tool-calling enabled when non-empty
}

// StreamEvent is emitted during streaming. Mirrors the existing
// aichat/service.StreamEvent shape so future migration is mechanical.
type StreamEvent struct {
	Type         string // "content" | "tool_calls" | "done" | "error"
	Content      string
	ToolCalls    []ToolCall
	FinishReason string
	TotalTokens  int
}
