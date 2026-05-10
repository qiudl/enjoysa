package tourism_agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"enjoysa-backend/internal/llmprovider"
	tourismmodel "enjoysa-backend/internal/tourism/model"

	"github.com/gin-gonic/gin"
)

// REQ-20260510-0002 · 1F · handler_test.go
//
// HTTP-level tests for the tourism_agent handler. We don't need a real LLM
// or DB — Agent's LLM and Store interfaces are already mocked-friendly
// (see agent_test.go), and we reuse them here to drive the handler end-to-end.

func init() {
	gin.SetMode(gin.TestMode)
}

func newCtx(method, target string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if body == nil {
		c.Request = httptest.NewRequest(method, target, nil)
	} else {
		c.Request = httptest.NewRequest(method, target, bytes.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
	}
	return c, w
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json marshal: %v", err)
	}
	return b
}

// newAgentWithFakes spins up an Agent backed by the same scriptedLLM /
// fakeStore the unit suite uses. Tests can pre-load the LLM script + store
// returns and exercise the handler in one go.
func newAgentWithFakes(turns []llmTurn, hits []SearchHit) *Agent {
	llm := &scriptedLLM{turns: turns}
	store := &fakeStore{hits: hits}
	return New(llm, store, "deepseek-chat").WithMaxIterations(3)
}

// makeBench is a tiny helper for the pricing tests.
func makeBench(median, p25, p75 float64, sample int) *tourismmodel.PricingBenchmark {
	return &tourismmodel.PricingBenchmark{
		Category:       "wine",
		Council:        "Barossa",
		DurationBucket: DurationBucketHalfDay,
		Season:         tourismmodel.SeasonYearRound,
		MedianPrice:    &median,
		P25:            &p25,
		P75:            &p75,
		SampleSize:     sample,
		Currency:       "AUD",
	}
}

// ---- auth gate -------------------------------------------------------------

func TestGenerateContent_RejectsAnonymous(t *testing.T) {
	h := NewHandler(newAgentWithFakes(nil, nil))
	body := mustJSON(t, map[string]any{"field": "title"})
	c, w := newCtx(http.MethodPost, "/", body)
	h.GenerateContent(c)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d want 401", w.Code)
	}
}

func TestGenerateContent_RejectsConsumerToken(t *testing.T) {
	// user_id alone is NOT enough — consumers don't edit products.
	h := NewHandler(newAgentWithFakes(nil, nil))
	body := mustJSON(t, map[string]any{"field": "title"})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("user_id", uint(7))
	h.GenerateContent(c)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d want 401", w.Code)
	}
}

func TestGenerateContent_AcceptsSupplier(t *testing.T) {
	h := NewHandler(newAgentWithFakes(
		[]llmTurn{{content: "Adelaide Hills 半日游"}},
		nil,
	))
	body := mustJSON(t, map[string]any{
		"field":    "title",
		"language": "zh-CN",
		"skeleton": map[string]any{"council": "Adelaide Hills"},
	})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("supplier_user_id", uint(42))
	h.GenerateContent(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Adelaide Hills 半日游") {
		t.Errorf("response missing generated content: %s", w.Body.String())
	}
}

func TestGenerateContent_AcceptsAdmin(t *testing.T) {
	h := NewHandler(newAgentWithFakes(
		[]llmTurn{{content: "ok"}},
		nil,
	))
	body := mustJSON(t, map[string]any{"field": "description"})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("admin_id", uint(1))
	h.GenerateContent(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200", w.Code)
	}
}

// ---- input validation ------------------------------------------------------

func TestGenerateContent_RejectsUnknownField(t *testing.T) {
	h := NewHandler(newAgentWithFakes(nil, nil))
	body := mustJSON(t, map[string]any{"field": "color"})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("supplier_user_id", uint(1))
	h.GenerateContent(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestGenerateContent_RejectsMalformedBody(t *testing.T) {
	h := NewHandler(newAgentWithFakes(nil, nil))
	c, w := newCtx(http.MethodPost, "/", []byte("not json"))
	c.Set("admin_id", uint(1))
	h.GenerateContent(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestGenerateContent_RejectsMissingField(t *testing.T) {
	h := NewHandler(newAgentWithFakes(nil, nil))
	c, w := newCtx(http.MethodPost, "/", []byte(`{}`))
	c.Set("admin_id", uint(1))
	h.GenerateContent(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

// ---- error mapping ---------------------------------------------------------

func TestGenerateContent_MapsMaxIterationsTo503(t *testing.T) {
	// Script the LLM to keep asking for tools so the loop blows the cap.
	turns := make([]llmTurn, 4)
	for i := range turns {
		turns[i] = llmTurn{
			toolCalls: []llmprovider.ToolCall{{
				ID:   "call_x",
				Type: "function",
				Function: llmprovider.FunctionCall{
					Name:      "search_knowledge",
					Arguments: `{}`,
				},
			}},
		}
	}
	h := NewHandler(newAgentWithFakes(turns, nil))
	body := mustJSON(t, map[string]any{"field": "description"})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("supplier_user_id", uint(1))
	h.GenerateContent(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d want 503", w.Code)
	}
	if !strings.Contains(w.Body.String(), "AGENT_MAX_ITERATIONS") {
		t.Errorf("error code missing from body: %s", w.Body.String())
	}
}

func TestGenerateContent_MapsLLMErrorTo500(t *testing.T) {
	llm := &scriptedLLM{turns: []llmTurn{{err: errors.New("upstream timeout")}}}
	store := &fakeStore{}
	agent := New(llm, store, "deepseek-chat")
	h := NewHandler(agent)

	body := mustJSON(t, map[string]any{"field": "title"})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("admin_id", uint(1))
	h.GenerateContent(c)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d want 500", w.Code)
	}
	if !strings.Contains(w.Body.String(), "upstream timeout") {
		t.Errorf("error message should bubble: %s", w.Body.String())
	}
}

// ---- pricing suggest -------------------------------------------------------

func TestPricingSuggest_RejectsAnonymous(t *testing.T) {
	h := NewHandler(newAgentWithFakes(nil, nil))
	body := mustJSON(t, map[string]any{
		"category": "wine", "council": "Barossa", "duration_minutes": 240,
	})
	c, w := newCtx(http.MethodPost, "/", body)
	h.PricingSuggest(c)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d want 401", w.Code)
	}
}

func TestPricingSuggest_RejectsMissingDimensions(t *testing.T) {
	h := NewHandler(newAgentWithFakes(nil, nil))
	cases := [][]byte{
		[]byte(`{"council": "Barossa", "duration_minutes": 240}`),                  // no category
		[]byte(`{"category": "wine", "duration_minutes": 240}`),                    // no council
		[]byte(`{"category": "wine", "council": "Barossa"}`),                       // no duration
		[]byte(`{"category": "wine", "council": "Barossa", "duration_minutes": 0}`), // zero duration
	}
	for i, body := range cases {
		c, w := newCtx(http.MethodPost, "/", body)
		c.Set("supplier_user_id", uint(1))
		h.PricingSuggest(c)
		if w.Code != http.StatusBadRequest {
			t.Errorf("case %d: got %d want 400", i, w.Code)
		}
	}
}

func TestPricingSuggest_ReturnsBenchmark(t *testing.T) {
	median := 150.0
	store := &fakeStore{bench: makeBench(median, 90.0, 210.0, 8)}
	agent := New(&scriptedLLM{}, store, "deepseek-chat")
	h := NewHandler(agent)

	body := mustJSON(t, map[string]any{
		"category": "wine", "council": "Barossa", "duration_minutes": 240,
	})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("supplier_user_id", uint(1))
	h.PricingSuggest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"sample_size":8`) {
		t.Errorf("sample size missing from body: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"confidence":"normal"`) {
		t.Errorf("confidence missing from body: %s", w.Body.String())
	}
}

func TestPricingSuggest_InsufficientDataReturnsFlag(t *testing.T) {
	median := 150.0
	store := &fakeStore{bench: makeBench(median, 0, 0, 1)} // sample_size < 3
	agent := New(&scriptedLLM{}, store, "deepseek-chat")
	h := NewHandler(agent)

	body := mustJSON(t, map[string]any{
		"category": "wine", "council": "Barossa", "duration_minutes": 240,
	})
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("admin_id", uint(1))
	h.PricingSuggest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"insufficient_data":true`) {
		t.Errorf("insufficient_data flag missing: %s", w.Body.String())
	}
}

// ---- hasEditorIdentity -----------------------------------------------------

func TestHasEditorIdentity(t *testing.T) {
	cases := []struct {
		name string
		set  func(*gin.Context)
		want bool
	}{
		{"none", func(_ *gin.Context) {}, false},
		{"user only", func(c *gin.Context) { c.Set("user_id", uint(1)) }, false},
		{"supplier", func(c *gin.Context) { c.Set("supplier_user_id", uint(1)) }, true},
		{"admin", func(c *gin.Context) { c.Set("admin_id", uint(1)) }, true},
		{"both supplier and user", func(c *gin.Context) {
			c.Set("user_id", uint(1))
			c.Set("supplier_user_id", uint(1))
		}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
			tc.set(c)
			if got := hasEditorIdentity(c); got != tc.want {
				t.Errorf("got %v want %v", got, tc.want)
			}
		})
	}
}

// silence unused warning when context isn't used in a particular case.
var _ = context.Background

// ============================================================================
// REQ-20260510-0011 · Phase 2 · 2A — ExplainContent
// ============================================================================

// fakeProductLookup is a tiny in-memory ProductLookup for handler tests.
// `seedByID` lets per-test tables pre-load specific product IDs; missing
// IDs return ErrProductNotFound which the handler should map to 404.
type fakeProductLookup struct {
	seedByID map[uint]*ProductSeed
	err      error // injected error overrides table lookup
}

func (f *fakeProductLookup) LookupForAgent(_ context.Context, id uint) (*ProductSeed, error) {
	if f.err != nil {
		return nil, f.err
	}
	if s, ok := f.seedByID[id]; ok {
		return s, nil
	}
	return nil, errors.New("not found")
}

// newExplainHandler wires a Handler with cache + product lookup configured
// (the supplier-side endpoints don't need them so the default constructor
// leaves them nil).
func newExplainHandler(turns []llmTurn, hits []SearchHit, lookup *fakeProductLookup) *Handler {
	h := NewHandler(newAgentWithFakes(turns, hits))
	h.SetExplainCache(NewTTLCache(1*time.Hour, 0))
	h.SetProductLookup(lookup)
	return h
}

func TestExplainContent_NotWiredReturns503(t *testing.T) {
	h := NewHandler(newAgentWithFakes(nil, nil))
	c, w := newCtx(http.MethodPost, "/", []byte(`{"product_id":1}`))
	h.ExplainContent(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d want 503", w.Code)
	}
	if !strings.Contains(w.Body.String(), "EXPLAIN_NOT_WIRED") {
		t.Errorf("error code missing from body: %s", w.Body.String())
	}
}

func TestExplainContent_RejectsMissingProductID(t *testing.T) {
	h := newExplainHandler(nil, nil, &fakeProductLookup{})
	c, w := newCtx(http.MethodPost, "/", []byte(`{}`))
	h.ExplainContent(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestExplainContent_RejectsMalformedBody(t *testing.T) {
	h := newExplainHandler(nil, nil, &fakeProductLookup{})
	c, w := newCtx(http.MethodPost, "/", []byte("not json"))
	h.ExplainContent(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestExplainContent_NotFoundMaps404(t *testing.T) {
	h := newExplainHandler(nil, nil, &fakeProductLookup{seedByID: map[uint]*ProductSeed{}})
	c, w := newCtx(http.MethodPost, "/", []byte(`{"product_id":99}`))
	h.ExplainContent(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

func TestExplainContent_DraftProductRejected(t *testing.T) {
	// Status="draft" → 403 PRODUCT_NOT_PUBLIC; we don't expose AI on
	// non-public products to avoid leaking unreleased content.
	lookup := &fakeProductLookup{seedByID: map[uint]*ProductSeed{
		7: {NameZh: "X", Council: "Adelaide", Category: "wine", Status: "draft"},
	}}
	h := newExplainHandler(nil, nil, lookup)
	c, w := newCtx(http.MethodPost, "/", []byte(`{"product_id":7}`))
	h.ExplainContent(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("got %d want 403", w.Code)
	}
	if !strings.Contains(w.Body.String(), "PRODUCT_NOT_PUBLIC") {
		t.Errorf("error code missing: %s", w.Body.String())
	}
}

func TestExplainContent_HappyPathReturns200AndCaches(t *testing.T) {
	lookup := &fakeProductLookup{seedByID: map[uint]*ProductSeed{
		10: {NameZh: "大鸭号", Council: "Fleurieu Peninsula", Category: "attractions", Status: "approved"},
	}}
	h := newExplainHandler(
		[]llmTurn{{content: "Big Duck 是袋鼠岛附近的海上观光项目..."}},
		nil,
		lookup,
	)

	// First call — miss, hits LLM.
	c, w := newCtx(http.MethodPost, "/", []byte(`{"product_id":10}`))
	h.ExplainContent(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if w.Header().Get("X-Cache") != "MISS" {
		t.Errorf("first call should be MISS, got %q", w.Header().Get("X-Cache"))
	}
	if !strings.Contains(w.Body.String(), "Big Duck") {
		t.Errorf("body should contain LLM content: %s", w.Body.String())
	}

	// Second call — hit, no LLM.
	c2, w2 := newCtx(http.MethodPost, "/", []byte(`{"product_id":10}`))
	h.ExplainContent(c2)
	if w2.Code != http.StatusOK {
		t.Fatalf("second call: got %d want 200", w2.Code)
	}
	if w2.Header().Get("X-Cache") != "HIT" {
		t.Errorf("second call should be HIT, got %q", w2.Header().Get("X-Cache"))
	}
	if w2.Body.String() != w.Body.String() {
		t.Errorf("cached body should byte-match first response\nfirst:  %s\nsecond: %s", w.Body.String(), w2.Body.String())
	}
}

func TestExplainContent_MaxIterationsMaps503(t *testing.T) {
	lookup := &fakeProductLookup{seedByID: map[uint]*ProductSeed{
		1: {NameZh: "X", Council: "Adelaide", Category: "wine", Status: "approved"},
	}}
	// LLM keeps requesting tools — 3 turns of tool calls past the cap.
	turns := make([]llmTurn, 4)
	for i := range turns {
		turns[i] = llmTurn{toolCalls: []llmprovider.ToolCall{{
			ID:   "t",
			Type: "function",
			Function: llmprovider.FunctionCall{Name: "search_knowledge", Arguments: `{}`},
		}}}
	}
	h := newExplainHandler(turns, nil, lookup)

	c, w := newCtx(http.MethodPost, "/", []byte(`{"product_id":1}`))
	h.ExplainContent(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d want 503", w.Code)
	}
	if !strings.Contains(w.Body.String(), "AGENT_MAX_ITERATIONS") {
		t.Errorf("error code missing: %s", w.Body.String())
	}
}

// ---- json-string helper ---------------------------------------------------

func TestJSONString_EscapesQuotesAndControlChars(t *testing.T) {
	cases := []struct{ in, want string }{
		{`hello`, `"hello"`},
		{`he"llo`, `"he\"llo"`},
		{"a\nb", `"a\nb"`},
		{"x\tz", `"x\tz"`},
		{"中文", `"中文"`}, // CJK passes through unchanged
	}
	for _, tc := range cases {
		got := jsonString(tc.in)
		if got != tc.want {
			t.Errorf("jsonString(%q) = %q; want %q", tc.in, got, tc.want)
		}
	}
}

func TestJSONRefsList_EmptyAndPopulated(t *testing.T) {
	if got := jsonRefsList(nil); got != "[]" {
		t.Errorf("nil refs → %q; want []", got)
	}
	refs := []KnowledgeRef{{Type: "experience", ID: 10, Name: "大鸭号"}}
	got := jsonRefsList(refs)
	want := `[{"type":"experience","id":10,"name":"大鸭号"}]`
	if got != want {
		t.Errorf("got %s\nwant %s", got, want)
	}
}
