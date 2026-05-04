package service

import (
	"testing"

	"enjoysa-backend/internal/aichat/model"
)

func TestToolRegistry_Register(t *testing.T) {
	r := NewToolRegistry()

	tool := model.ToolDef{
		Name:        "test_tool",
		Description: "A test tool",
		Category:    "query",
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			return map[string]string{"result": "ok"}, nil
		},
	}

	r.Register(tool)

	names := r.GetToolNames()
	if len(names) != 1 || names[0] != "test_tool" {
		t.Errorf("expected [test_tool], got %v", names)
	}
}

func TestToolRegistry_Execute(t *testing.T) {
	r := NewToolRegistry()
	r.Register(model.ToolDef{
		Name:     "echo",
		Category: "query",
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			return args["msg"], nil
		},
	})

	result, durationMs, err := r.Execute("echo", `{"msg":"hello"}`, model.ToolContext{Language: "zh"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "hello" {
		t.Errorf("expected 'hello', got %v", result)
	}
	if durationMs < 0 {
		t.Errorf("expected non-negative duration, got %d", durationMs)
	}
}

func TestToolRegistry_ExecuteUnknown(t *testing.T) {
	r := NewToolRegistry()
	_, _, err := r.Execute("nonexistent", `{}`, model.ToolContext{})
	if err == nil {
		t.Error("expected error for unknown tool")
	}
}

func TestToolRegistry_ExecuteRequiresAuth(t *testing.T) {
	r := NewToolRegistry()
	r.Register(model.ToolDef{
		Name:         "admin_tool",
		Category:     "action",
		RequiresAuth: true,
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			return "ok", nil
		},
	})

	// Guest (no userID) should fail
	_, _, err := r.Execute("admin_tool", `{}`, model.ToolContext{})
	if err == nil {
		t.Error("expected auth error for guest")
	}

	// Authenticated should succeed
	uid := uint(1)
	result, _, err := r.Execute("admin_tool", `{}`, model.ToolContext{UserID: &uid})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "ok" {
		t.Errorf("expected 'ok', got %v", result)
	}
}

func TestToolRegistry_GetOpenAITools(t *testing.T) {
	r := NewToolRegistry()
	r.Register(model.ToolDef{Name: "public_tool", Category: "query", RequiresAuth: false,
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) { return nil, nil },
	})
	r.Register(model.ToolDef{Name: "auth_tool", Category: "action", RequiresAuth: true,
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) { return nil, nil },
	})

	// Unauthenticated: only public
	tools := r.GetOpenAITools(false)
	if len(tools) != 1 || tools[0].Function.Name != "public_tool" {
		t.Errorf("unauthenticated should only see public_tool, got %v", tools)
	}

	// Authenticated: both
	tools = r.GetOpenAITools(true)
	if len(tools) != 2 {
		t.Errorf("authenticated should see 2 tools, got %d", len(tools))
	}
}

func TestToolRegistry_InvalidArgs(t *testing.T) {
	r := NewToolRegistry()
	r.Register(model.ToolDef{
		Name:     "typed",
		Category: "query",
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			return args, nil
		},
	})

	// Invalid JSON
	_, _, err := r.Execute("typed", `{invalid`, model.ToolContext{})
	if err == nil {
		t.Error("expected error for invalid JSON args")
	}
}
