package tools

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/core/config"
)

// REQ-20260506-0014: list_requirements tool reliability tests. Covers the
// three bugs identified from the supplier "一直无法实现" report:
//   1. Query parameters with Chinese / commas were not URL-encoded.
//   2. `total` was read from the wrong path (top-level vs data.total).
//   3. Empty / unexpected responses produced no diagnostic log.

type recordedRequest struct {
	method string
	path   string
	query  url.Values
}

func setupAIProjServer(t *testing.T, response interface{}, status int) (*httptest.Server, *recordedRequest) {
	t.Helper()
	rec := &recordedRequest{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.method = r.Method
		rec.path = r.URL.Path
		rec.query = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if response != nil {
			_ = json.NewEncoder(w).Encode(response)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, rec
}

func runListRequirements(t *testing.T, srvURL string, args map[string]interface{}) (interface{}, error) {
	t.Helper()
	tool := RegisterListRequirements(config.AIConfig{
		AIProjBase:   srvURL,
		AIProjToken:  "test-token",
		AIProjProjID: 167,
	})
	return tool.Handler(model.ToolContext{Language: "zh"}, args)
}

func TestListRequirements_URLEncodesChineseSearch(t *testing.T) {
	srv, rec := setupAIProjServer(t, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"requirements": []interface{}{},
			"total":        float64(0),
		},
	}, 200)

	_, err := runListRequirements(t, srv.URL, map[string]interface{}{
		"search": "AI Chat 的问题",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := rec.query.Get("search")
	if got != "AI Chat 的问题" {
		t.Errorf("search query not received correctly: got %q", got)
	}
	if rec.path != "/mcp/requirements" {
		t.Errorf("expected path /mcp/requirements, got %q", rec.path)
	}
}

func TestListRequirements_PreservesCommaInStatusFilter(t *testing.T) {
	srv, rec := setupAIProjServer(t, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"requirements": []interface{}{},
			"total":        float64(0),
		},
	}, 200)

	_, err := runListRequirements(t, srv.URL, map[string]interface{}{
		"status": "draft,pending",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := rec.query.Get("status"); got != "draft,pending" {
		t.Errorf("status query lost commas: got %q", got)
	}
}

func TestListRequirements_AlwaysSetsProjectIdAndPaging(t *testing.T) {
	srv, rec := setupAIProjServer(t, map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"requirements": []interface{}{}, "total": float64(0)},
	}, 200)

	_, err := runListRequirements(t, srv.URL, map[string]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := rec.query.Get("project_id"); got != "167" {
		t.Errorf("expected project_id=167, got %q", got)
	}
	if got := rec.query.Get("page"); got != "1" {
		t.Errorf("expected page=1, got %q", got)
	}
	if got := rec.query.Get("page_size"); got != "10" {
		t.Errorf("expected default page_size=10, got %q", got)
	}
}

func TestListRequirements_LimitClampedTo50(t *testing.T) {
	srv, rec := setupAIProjServer(t, map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"requirements": []interface{}{}, "total": float64(0)},
	}, 200)

	_, err := runListRequirements(t, srv.URL, map[string]interface{}{
		"limit": float64(999),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := rec.query.Get("page_size"); got != "50" {
		t.Errorf("expected limit clamped to 50, got %q", got)
	}
}

func TestListRequirements_ReadsTotalFromDataPath(t *testing.T) {
	// ai-proj wraps total inside data, not at top level. Pre-fix the code
	// read result["total"] which was always nil.
	srv, _ := setupAIProjServer(t, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"requirements": []interface{}{
				map[string]interface{}{
					"display_id": "REQ-20260506-0014",
					"title":      "test",
					"status":     "approved",
					"priority":   "high",
					"category":   "bug",
					"created_at": "2026-05-06T00:00:00Z",
				},
			},
			"total": float64(42),
		},
	}, 200)

	res, err := runListRequirements(t, srv.URL, map[string]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	m, ok := res.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", res)
	}
	if total := m["total"]; total != 42 {
		t.Errorf("expected total=42, got %v", total)
	}
	if showing := m["showing"]; showing != 1 {
		t.Errorf("expected showing=1, got %v", showing)
	}
}

func TestListRequirements_PropagatesUpstreamError(t *testing.T) {
	srv, _ := setupAIProjServer(t, map[string]string{"error": "boom"}, 500)

	_, err := runListRequirements(t, srv.URL, map[string]interface{}{})
	if err == nil {
		t.Fatal("expected an error when ai-proj returns 5xx, got nil")
	}
}

func TestListRequirements_HandlesMissingDataGracefully(t *testing.T) {
	// Some upstream regressions could drop the `data` envelope. Pre-fix
	// this would still "succeed" with empty results; we want to make sure
	// it doesn't panic and still returns an empty list.
	srv, _ := setupAIProjServer(t, map[string]interface{}{
		"success": true,
		// no "data" key
	}, 200)

	res, err := runListRequirements(t, srv.URL, map[string]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	m := res.(map[string]interface{})
	if showing := m["showing"]; showing != 0 {
		t.Errorf("expected empty showing on missing data, got %v", showing)
	}
}

func TestMapKeys(t *testing.T) {
	if mapKeys(nil) != nil {
		t.Error("nil map should return nil")
	}
	keys := mapKeys(map[string]interface{}{"a": 1, "b": 2})
	if len(keys) != 2 {
		t.Errorf("expected 2 keys, got %d", len(keys))
	}
}
