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
