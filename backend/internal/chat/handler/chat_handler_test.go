package handler

import (
	"strings"
	"testing"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// REQ-20260506-0050 [SECURITY]: regression coverage for the SendMessageStream
// session-ownership check. Pre-fix the inline predicate
// `if userType == "user" && session.UserID != userID` only validated
// ownership for c-end users; supplier and admin tokens could pass any
// sessionID and append messages to / read history from another user's
// session. The fix replaces it with sessionAccessibleBy(...) which double-
// checks (user_id, user_type) for ALL identities — matching the predicate
// already used in GetMessages / ListSessions / ShareHandler.
func TestSessionAccessibleBy_REQ0050(t *testing.T) {
	t.Run("UserCrossUser_DifferentUserID_Denied", func(t *testing.T) {
		// session belongs to user A (id=1)
		s := &chatmodel.ChatSession{UserID: 1, UserType: "user"}
		// caller is user B (id=2) — must NOT pass
		if sessionAccessibleBy(s, 2, "user") {
			t.Fatal("user B must not access user A's session")
		}
	})

	t.Run("SupplierCrossSupplier_DifferentSupplierID_Denied", func(t *testing.T) {
		// session belongs to supplier S (supplier_user.id=10)
		s := &chatmodel.ChatSession{UserID: 10, UserType: "supplier"}
		// caller is supplier T (id=20) — must NOT pass
		if sessionAccessibleBy(s, 20, "supplier") {
			t.Fatal("supplier T must not access supplier S's session")
		}
	})

	t.Run("AdminAccessingUserSession_Denied_RegressionForREQ0050", func(t *testing.T) {
		// session belongs to user X (id=5)
		s := &chatmodel.ChatSession{UserID: 5, UserType: "user"}
		// caller is admin (id=99) — pre-fix this WOULD have passed because
		// the old predicate `userType == "user" && session.UserID != userID`
		// is false for an admin caller (userType != "user"), short-circuiting
		// the check. This is the load-bearing scenario the patch closes.
		if sessionAccessibleBy(s, 99, "admin") {
			t.Fatal("admin must not access user X's chat session via cross-type confusion")
		}
	})

	t.Run("SameUser_SameID_Allowed", func(t *testing.T) {
		// session belongs to user A (id=1)
		s := &chatmodel.ChatSession{UserID: 1, UserType: "user"}
		// caller is user A — must pass
		if !sessionAccessibleBy(s, 1, "user") {
			t.Fatal("owner must be able to access their own session")
		}
	})

	t.Run("SameSupplier_Allowed", func(t *testing.T) {
		s := &chatmodel.ChatSession{UserID: 10, UserType: "supplier"}
		if !sessionAccessibleBy(s, 10, "supplier") {
			t.Fatal("supplier owner must access their own session")
		}
	})

	t.Run("SameNumericID_DifferentUserType_Denied", func(t *testing.T) {
		// supplier_user.id=7 and users.id=7 are unrelated rows in different
		// tables. The pre-fix predicate could let an admin (id=7, "admin")
		// peek at supplier 7's session because user_type was never compared.
		s := &chatmodel.ChatSession{UserID: 7, UserType: "supplier"}
		if sessionAccessibleBy(s, 7, "admin") {
			t.Fatal("matching numeric ID with different user_type must be denied")
		}
		if sessionAccessibleBy(s, 7, "user") {
			t.Fatal("matching numeric ID with different user_type must be denied")
		}
	})

	t.Run("NilSession_Denied", func(t *testing.T) {
		// Defensive: even if the store ever returns (nil, nil), no caller
		// must be granted access.
		if sessionAccessibleBy(nil, 1, "user") {
			t.Fatal("nil session must never be accessible")
		}
	})
}

// REQ-20260506-0003 / REQ-20260506-0017: only persistence/write tools should
// be subject to the single-turn dedupe guard. The whitelist must cover every
// tool with `Category: "action"` so the standard does not silently drift.
// Read tools must remain freely callable.
func TestIsAIChatWriteTool(t *testing.T) {
	cases := []struct {
		name string
		want bool
	}{
		// Write tools — Category="action" in the registry.
		{"create_requirement", true},
		{"upload_screenshot_requirement", true},
		{"approve_product", true},
		{"offline_product", true},
		{"confirm_order", true},
		// Read tools — must never be blocked even if called repeatedly.
		{"list_requirements", false},
		{"search_knowledge", false},
		{"get_product_detail", false},
		{"recommend_products", false},
		{"list_pending_products", false},
		{"list_pending_orders", false},
		{"search_orders", false},
		// Sentinel: empty / unknown names are not write tools.
		{"", false},
		{"some_unknown_future_tool", false},
	}
	for _, c := range cases {
		if got := isAIChatWriteTool(c.name); got != c.want {
			t.Errorf("isAIChatWriteTool(%q) = %v, want %v", c.name, got, c.want)
		}
	}
}

// REQ-20260506-0015: regression coverage for the actual single-turn dedupe
// behavior used inside streamWithTools. Pre-fix the only test was the
// classifier above, so a refactor that broke the dedupe path could land
// silently.
func TestDuplicateWriteToolBlockResult(t *testing.T) {
	t.Run("read tool never blocked", func(t *testing.T) {
		called := map[string]bool{"list_requirements": true}
		if got := duplicateWriteToolBlockResult("list_requirements", called); got != nil {
			t.Errorf("read tool should never be blocked, got %v", got)
		}
	})

	t.Run("write tool first call allowed", func(t *testing.T) {
		called := map[string]bool{}
		if got := duplicateWriteToolBlockResult("create_requirement", called); got != nil {
			t.Errorf("first call to write tool must not be blocked, got %v", got)
		}
	})

	t.Run("write tool second call blocked with error envelope", func(t *testing.T) {
		called := map[string]bool{"create_requirement": true}
		got := duplicateWriteToolBlockResult("create_requirement", called)
		if got == nil {
			t.Fatal("second call to write tool must be blocked")
		}
		if got["success"] != false {
			t.Errorf("blocked result must have success=false, got %v", got["success"])
		}
		if got["error"] != "duplicate_call_blocked" {
			t.Errorf("blocked result error code mismatch, got %v", got["error"])
		}
		msg, _ := got["message"].(string)
		if !strings.Contains(msg, "create_requirement") {
			t.Errorf("blocked result message must name the tool, got %q", msg)
		}
		if !strings.Contains(msg, "拒绝") {
			t.Errorf("blocked result message must explain rejection, got %q", msg)
		}
	})

	t.Run("upload_screenshot_requirement second call blocked", func(t *testing.T) {
		called := map[string]bool{"upload_screenshot_requirement": true}
		got := duplicateWriteToolBlockResult("upload_screenshot_requirement", called)
		if got == nil {
			t.Fatal("upload_screenshot_requirement second call must be blocked")
		}
		if got["error"] != "duplicate_call_blocked" {
			t.Errorf("error code mismatch, got %v", got["error"])
		}
	})

	t.Run("blocking one write tool does not block a different write tool", func(t *testing.T) {
		// If create_requirement already ran, the LLM should still be able
		// to call upload_screenshot_requirement once in the same turn.
		called := map[string]bool{"create_requirement": true}
		if got := duplicateWriteToolBlockResult("upload_screenshot_requirement", called); got != nil {
			t.Errorf("different write tool's first call must not be blocked, got %v", got)
		}
	})

	t.Run("unknown tool name treated as non-write", func(t *testing.T) {
		called := map[string]bool{"some_future_tool": true}
		if got := duplicateWriteToolBlockResult("some_future_tool", called); got != nil {
			t.Errorf("unknown tool should not be blocked by write-tool guard, got %v", got)
		}
	})
}
