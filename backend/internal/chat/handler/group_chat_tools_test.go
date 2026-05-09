package handler

import (
	"reflect"
	"sort"
	"testing"

	"github.com/lib/pq"

	aichatmodel "enjoysa-backend/internal/aichat/model"
	aichatservice "enjoysa-backend/internal/aichat/service"
	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/llmprovider"
)

// fakeRegistry returns a tool registry pre-loaded with one tool per audience
// + one create_* write tool, so the intersection logic has something to
// reject and accept.
func fakeRegistry() *aichatservice.ToolRegistry {
	r := aichatservice.NewToolRegistry()
	r.Register(aichatmodel.ToolDef{
		Name:         "search_orders",
		Description:  "list orders for the supplier",
		Parameters:   map[string]interface{}{"type": "object"},
		Audience:     "supplier",
		RequiresAuth: false,
		Handler: func(_ aichatmodel.ToolContext, _ map[string]interface{}) (interface{}, error) {
			return map[string]string{"ok": "true"}, nil
		},
	})
	r.Register(aichatmodel.ToolDef{
		Name:        "approve_product",
		Description: "admin-only product approval",
		Parameters:  map[string]interface{}{"type": "object"},
		Audience:    "admin",
		Handler:     func(_ aichatmodel.ToolContext, _ map[string]interface{}) (interface{}, error) { return nil, nil },
	})
	r.Register(aichatmodel.ToolDef{
		Name:        "search_knowledge",
		Description: "shared knowledge base search",
		Parameters:  map[string]interface{}{"type": "object"},
		Audience:    "all",
		Handler:     func(_ aichatmodel.ToolContext, _ map[string]interface{}) (interface{}, error) { return nil, nil },
	})
	r.Register(aichatmodel.ToolDef{
		Name:        "create_requirement",
		Description: "create a requirement (write)",
		Parameters:  map[string]interface{}{"type": "object"},
		// no Audience → available to everyone
		Handler: func(_ aichatmodel.ToolContext, _ map[string]interface{}) (interface{}, error) { return nil, nil },
	})
	return r
}

func TestSelectToolsForAgent_IntersectsKeysAndAudience(t *testing.T) {
	reg := fakeRegistry()

	t.Run("supplier agent sees its keys ∩ supplier audience", func(t *testing.T) {
		agent := chatmodel.ChatAgent{
			ToolKeys: pq.StringArray{"search_orders", "search_knowledge", "approve_product"},
		}
		got := toolNamesSorted(selectToolsForAgent(reg, agent, "supplier"))
		want := []string{"search_knowledge", "search_orders"} // approve_product is admin-only
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})

	t.Run("admin agent sees admin-audience tool the supplier cannot", func(t *testing.T) {
		agent := chatmodel.ChatAgent{
			ToolKeys: pq.StringArray{"approve_product", "search_orders"},
		}
		got := toolNamesSorted(selectToolsForAgent(reg, agent, "admin"))
		want := []string{"approve_product"} // search_orders has supplier audience
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})

	t.Run("unknown keys silently dropped", func(t *testing.T) {
		agent := chatmodel.ChatAgent{
			ToolKeys: pq.StringArray{"never_registered_tool", "search_knowledge"},
		}
		got := toolNamesSorted(selectToolsForAgent(reg, agent, "supplier"))
		if !reflect.DeepEqual(got, []string{"search_knowledge"}) {
			t.Fatalf("got %v", got)
		}
	})

	t.Run("empty tool_keys returns nil so caller sends no Tools field", func(t *testing.T) {
		agent := chatmodel.ChatAgent{ToolKeys: pq.StringArray{}}
		if got := selectToolsForAgent(reg, agent, "supplier"); got != nil {
			t.Fatalf("expected nil, got %v", toolNamesSorted(got))
		}
	})

	t.Run("nil registry returns nil", func(t *testing.T) {
		agent := chatmodel.ChatAgent{ToolKeys: pq.StringArray{"search_orders"}}
		if got := selectToolsForAgent(nil, agent, "supplier"); got != nil {
			t.Fatal("expected nil when registry not wired")
		}
	})

	t.Run("whitespace-only keys are ignored", func(t *testing.T) {
		agent := chatmodel.ChatAgent{ToolKeys: pq.StringArray{"   ", ""}}
		if got := selectToolsForAgent(reg, agent, "supplier"); got != nil {
			t.Fatalf("expected nil, got %v", toolNamesSorted(got))
		}
	})
}

// TestWriteToolDedupSharedAcrossPipelines pins the contract that the new
// group-chat tool loop reuses the same write-tool whitelist + dedup helper as
// the legacy aichat handler. Both callers live in package handler so the
// helpers must stay at package scope; this test fails loudly if either is
// renamed or moved.
func TestWriteToolDedupSharedAcrossPipelines(t *testing.T) {
	called := map[string]bool{}
	if !isAIChatWriteTool("create_requirement") {
		t.Fatal("create_requirement should be a write tool")
	}
	if isAIChatWriteTool("search_orders") {
		t.Fatal("search_orders should NOT be a write tool")
	}

	if blocked := duplicateWriteToolBlockResult("create_requirement", called); blocked != nil {
		t.Fatal("first call must not be blocked")
	}
	called["create_requirement"] = true
	blocked := duplicateWriteToolBlockResult("create_requirement", called)
	if blocked == nil {
		t.Fatal("second call must be blocked")
	}
	if blocked["error"] != "duplicate_call_blocked" {
		t.Fatalf("expected duplicate_call_blocked sentinel, got %v", blocked["error"])
	}
}

func TestBuildToolContext_SupplierUsesSupplierID(t *testing.T) {
	supplierID := uint(123)
	user := &aichatmodel.ChatUser{
		UserType:   "supplier",
		UserID:     999, // raw user id; should be overridden
		SupplierID: &supplierID,
	}
	ctx := buildToolContext(user, 42, nil)
	if ctx.UserID == nil || *ctx.UserID != supplierID {
		t.Fatalf("expected supplier_id=%d in ToolContext.UserID, got %v", supplierID, ctx.UserID)
	}
	if ctx.SessionID == nil || *ctx.SessionID != 42 {
		t.Fatalf("expected channel id 42 propagated as SessionID, got %v", ctx.SessionID)
	}
	if ctx.User != user {
		t.Fatal("ChatUser should be passed through unchanged")
	}
}

// helpers ------------------------------------------------------------

func toolNamesSorted(tools []llmprovider.Tool) []string {
	out := make([]string, 0, len(tools))
	for _, t := range tools {
		out = append(out, t.Function.Name)
	}
	sort.Strings(out)
	return out
}
