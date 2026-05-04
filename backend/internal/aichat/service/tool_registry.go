package service

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/core/logger"
)

// ToolRegistry manages AI tool registration and execution.
type ToolRegistry struct {
	mu    sync.RWMutex
	tools map[string]model.ToolDef
}

// NewToolRegistry creates an empty tool registry.
func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{
		tools: make(map[string]model.ToolDef),
	}
}

// Register adds a tool to the registry.
func (r *ToolRegistry) Register(tool model.ToolDef) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tools[tool.Name] = tool
	logger.Info("AI tool registered: %s (%s)", tool.Name, tool.Category)
}

// Execute runs a tool by name with the given arguments.
func (r *ToolRegistry) Execute(name string, argsJSON string, tctx model.ToolContext) (interface{}, int64, error) {
	r.mu.RLock()
	tool, ok := r.tools[name]
	r.mu.RUnlock()

	if !ok {
		return nil, 0, fmt.Errorf("unknown tool: %s", name)
	}

	if tool.RequiresAuth && tctx.UserID == nil {
		return nil, 0, fmt.Errorf("tool %s requires authentication", name)
	}

	var args map[string]interface{}
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return nil, 0, fmt.Errorf("invalid tool args for %s: %w", name, err)
		}
	}

	start := time.Now()
	result, err := tool.Handler(tctx, args)
	durationMs := time.Since(start).Milliseconds()

	if err != nil {
		logger.Error("Tool %s failed (%.0fms): %v", name, float64(durationMs), err)
		return nil, durationMs, err
	}

	logger.Info("Tool %s completed (%.0fms)", name, float64(durationMs))
	return result, durationMs, nil
}

// GetOpenAITools returns tools in OpenAI function calling format.
func (r *ToolRegistry) GetOpenAITools(authenticated bool) []model.OpenAITool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var tools []model.OpenAITool
	for _, t := range r.tools {
		if t.RequiresAuth && !authenticated {
			continue
		}
		tools = append(tools, model.OpenAITool{
			Type: "function",
			Function: model.OpenAIFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		})
	}
	return tools
}

// GetToolNames returns names of all registered tools.
func (r *ToolRegistry) GetToolNames() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.tools))
	for name := range r.tools {
		names = append(names, name)
	}
	return names
}
