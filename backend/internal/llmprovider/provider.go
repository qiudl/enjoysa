package llmprovider

import "context"

// Provider is the uniform interface every LLM backend implements.
type Provider interface {
	// Code is a stable short identifier ("deepseek", "glm").
	Code() string

	// DefaultModel is what the provider uses when Request.Model is empty.
	DefaultModel() string

	// ChatStream runs a streaming chat completion. onEvent is called for
	// every parsed SSE chunk (content delta, tool_calls, done). Return
	// false from onEvent to stop early.
	ChatStream(ctx context.Context, req Request, onEvent func(StreamEvent) bool) error

	// ChatJSON runs a non-streaming chat completion and returns the full
	// assistant content + any tool calls in one shot.
	ChatJSON(ctx context.Context, req Request) (content string, toolCalls []ToolCall, err error)
}
