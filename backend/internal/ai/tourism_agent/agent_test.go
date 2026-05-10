package tourism_agent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"enjoysa-backend/internal/llmprovider"
	tourismmodel "enjoysa-backend/internal/tourism/model"
)

// REQ-20260510-0002 · 1B · agent_test.go
//
// Tests cover the dimensions required by Gate 4:
//   - tool dispatch shape (executeTool routes correctly)
//   - prompt grounding (system prompt contains stable preface)
//   - agent loop terminates on no-tool reply
//   - agent loop respects max-iterations cap
//   - knowledge_refs only ever contain entries returned by the store
//     (D3: LLM-fabricated IDs cannot leak through)
//   - SuggestPricing confidence buckets (D4)

// ---------- fakes ------------------------------------------------------------

type fakeStore struct {
	hits        []SearchHit
	bench       *tourismmodel.PricingBenchmark
	similar     []SimilarProductSkeleton
	searchErr   error
	pricingErr  error
	similarErr  error
	searchCalls int
}

func (s *fakeStore) SearchKnowledge(_ context.Context, _ SearchParams) ([]SearchHit, error) {
	s.searchCalls++
	if s.searchErr != nil {
		return nil, s.searchErr
	}
	return s.hits, nil
}

func (s *fakeStore) GetPricingBenchmark(_ context.Context, _ PricingParams) (*tourismmodel.PricingBenchmark, error) {
	if s.pricingErr != nil {
		return nil, s.pricingErr
	}
	return s.bench, nil
}

func (s *fakeStore) GetSimilarProducts(_ context.Context, _ PricingParams) ([]SimilarProductSkeleton, error) {
	if s.similarErr != nil {
		return nil, s.similarErr
	}
	return s.similar, nil
}

// scriptedLLM returns canned (content, toolCalls) pairs in order. After the
// last script entry it returns ("", nil, nil) so a caller mistakenly looping
// past the script gets a clean termination rather than a panic.
type scriptedLLM struct {
	turns []llmTurn
	idx   int
	got   []llmprovider.Request
}

type llmTurn struct {
	content   string
	toolCalls []llmprovider.ToolCall
	err       error
}

func (l *scriptedLLM) ChatJSON(_ context.Context, req llmprovider.Request) (string, []llmprovider.ToolCall, error) {
	l.got = append(l.got, req)
	if l.idx >= len(l.turns) {
		return "", nil, nil
	}
	t := l.turns[l.idx]
	l.idx++
	return t.content, t.toolCalls, t.err
}

// ---------- tests ------------------------------------------------------------

func TestSystemPromptIsStable(t *testing.T) {
	got := SystemPrompt()
	// The first line is the cache-friendly preface; if it changes we lose
	// any DeepSeek prompt cache hits, so guard it.
	want := "You are a South Australia (SA) tourism domain expert AI."
	if !strings.HasPrefix(got, want) {
		t.Fatalf("SystemPrompt prefix changed; expected to start with %q, got: %q",
			want, got[:min(len(got), len(want)+20)])
	}
	// Council list must appear so the LLM has the grounding vocabulary.
	if !strings.Contains(got, "Adelaide Hills") {
		t.Errorf("SystemPrompt missing council 'Adelaide Hills'")
	}
}

func TestBuildUserPromptDescription(t *testing.T) {
	got := BuildUserPrompt(FieldDescription, "zh-CN", Skeleton{
		Category:        "wine_tour",
		Council:         "Adelaide Hills",
		DurationMinutes: 240,
		Highlights:      []string{"wine tasting", "scenic drive"},
	})
	for _, want := range []string{
		"DESCRIPTION", "Adelaide Hills", "wine tasting", "half_day", "zh-CN",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("user prompt missing %q\n--prompt--\n%s", want, got)
		}
	}
}

func TestDurationBucketForMinutes(t *testing.T) {
	cases := []struct {
		minutes int
		want    string
	}{
		{60, DurationBucketHalfDay},
		{240, DurationBucketHalfDay},
		{241, DurationBucketFullDay},
		{600, DurationBucketFullDay},
		{601, DurationBucketMultiDay},
		{1440, DurationBucketMultiDay},
	}
	for _, c := range cases {
		if got := DurationBucketForMinutes(c.minutes); got != c.want {
			t.Errorf("DurationBucketForMinutes(%d) = %q, want %q", c.minutes, got, c.want)
		}
	}
}

func TestGenerateNoToolCallsReturnsContent(t *testing.T) {
	// LLM directly returns content without calling tools — agent should
	// finish in one turn and return empty knowledge_refs (no tools visited).
	llm := &scriptedLLM{turns: []llmTurn{{content: "Sample description"}}}
	store := &fakeStore{}
	a := New(llm, store, "deepseek-v4")

	resp, err := a.Generate(context.Background(), GenerateRequest{
		Field:    FieldDescription,
		Language: "zh-CN",
		Skeleton: Skeleton{Council: "Barossa"},
	})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if resp.Content != "Sample description" {
		t.Errorf("Content = %q, want %q", resp.Content, "Sample description")
	}
	if len(resp.KnowledgeRefs) != 0 {
		t.Errorf("KnowledgeRefs = %+v, want empty", resp.KnowledgeRefs)
	}
	if len(llm.got) != 1 {
		t.Errorf("LLM called %d times, want 1", len(llm.got))
	}
}

func TestGenerateOneToolCallThenContent(t *testing.T) {
	// LLM calls search_knowledge once, then returns content. Agent should:
	//   - dispatch to fakeStore.SearchKnowledge
	//   - feed JSON tool result back as a tool-role message
	//   - collect KnowledgeRef from the hit
	//   - return content + 1 ref
	store := &fakeStore{
		hits: []SearchHit{
			{Type: "attraction", ID: 12, NameZh: "Penfolds Magill Estate", Council: "Adelaide"},
		},
	}
	args := `{"council":"Adelaide"}`
	llm := &scriptedLLM{turns: []llmTurn{
		{toolCalls: []llmprovider.ToolCall{{
			ID:   "call_1",
			Type: "function",
			Function: llmprovider.FunctionCall{
				Name:      "search_knowledge",
				Arguments: args,
			},
		}}},
		{content: "Visit Penfolds Magill Estate, an iconic winery in the heart of Adelaide."},
	}}
	a := New(llm, store, "")

	resp, err := a.Generate(context.Background(), GenerateRequest{
		Field:    FieldDescription,
		Skeleton: Skeleton{Council: "Adelaide"},
	})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if !strings.Contains(resp.Content, "Penfolds") {
		t.Errorf("Content = %q, expected to mention Penfolds", resp.Content)
	}
	if len(resp.KnowledgeRefs) != 1 {
		t.Fatalf("KnowledgeRefs len = %d, want 1; got %+v", len(resp.KnowledgeRefs), resp.KnowledgeRefs)
	}
	if r := resp.KnowledgeRefs[0]; r.Type != "attraction" || r.ID != 12 {
		t.Errorf("KnowledgeRef = %+v, want type=attraction id=12", r)
	}
	if store.searchCalls != 1 {
		t.Errorf("store.searchCalls = %d, want 1", store.searchCalls)
	}

	// Second LLM call should see 4 messages: system, user, assistant(tool_calls), tool(result).
	if len(llm.got) != 2 {
		t.Fatalf("LLM call count = %d, want 2", len(llm.got))
	}
	secondReq := llm.got[1]
	if got := len(secondReq.Messages); got != 4 {
		t.Errorf("second call message count = %d, want 4", got)
	}
	if last := secondReq.Messages[len(secondReq.Messages)-1]; last.Role != "tool" {
		t.Errorf("last message role = %q, want tool", last.Role)
	}
}

func TestGenerateMaxIterationsCap(t *testing.T) {
	// LLM keeps emitting tool calls forever — agent caps at 2 and returns
	// ErrMaxIterations.
	store := &fakeStore{}
	infiniteToolCall := llmTurn{toolCalls: []llmprovider.ToolCall{{
		ID:   "call_x",
		Type: "function",
		Function: llmprovider.FunctionCall{
			Name:      "search_knowledge",
			Arguments: `{}`,
		},
	}}}
	llm := &scriptedLLM{turns: []llmTurn{infiniteToolCall, infiniteToolCall, infiniteToolCall}}

	a := New(llm, store, "").WithMaxIterations(2)
	_, err := a.Generate(context.Background(), GenerateRequest{Field: FieldTitle})
	if !errors.Is(err, ErrMaxIterations) {
		t.Fatalf("err = %v, want ErrMaxIterations", err)
	}
}

func TestKnowledgeRefsOnlyFromStore(t *testing.T) {
	// D3 mitigation: even if the LLM mentions "id 99999" in its prose, the
	// agent only attaches refs harvested from real tool returns. fakeStore
	// returns an empty hit list → resp.KnowledgeRefs must be empty.
	store := &fakeStore{hits: nil}
	llm := &scriptedLLM{turns: []llmTurn{
		{toolCalls: []llmprovider.ToolCall{{
			ID:   "call_1",
			Type: "function",
			Function: llmprovider.FunctionCall{
				Name:      "search_knowledge",
				Arguments: `{}`,
			},
		}}},
		{content: "Visit fake-attraction id=99999 (the LLM made this up)."},
	}}
	a := New(llm, store, "")
	resp, err := a.Generate(context.Background(), GenerateRequest{Field: FieldDescription})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(resp.KnowledgeRefs) != 0 {
		t.Errorf("KnowledgeRefs = %+v, want empty (LLM hallucination must not leak)", resp.KnowledgeRefs)
	}
}

func TestGenerateDedupesRefs(t *testing.T) {
	// Same hit returned twice across two tool calls → output has 1 ref.
	store := &fakeStore{
		hits: []SearchHit{
			{Type: "attraction", ID: 5, NameZh: "Barossa Cellars"},
		},
	}
	tc := func() llmprovider.ToolCall {
		return llmprovider.ToolCall{
			ID:   "call_x",
			Type: "function",
			Function: llmprovider.FunctionCall{
				Name:      "search_knowledge",
				Arguments: `{}`,
			},
		}
	}
	llm := &scriptedLLM{turns: []llmTurn{
		{toolCalls: []llmprovider.ToolCall{tc()}},
		{toolCalls: []llmprovider.ToolCall{tc()}},
		{content: "Final."},
	}}
	a := New(llm, store, "").WithMaxIterations(5)
	resp, err := a.Generate(context.Background(), GenerateRequest{Field: FieldDescription})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(resp.KnowledgeRefs) != 1 {
		t.Fatalf("dedupe failed: got %d refs, want 1; %+v", len(resp.KnowledgeRefs), resp.KnowledgeRefs)
	}
}

func TestExecutePricingToolReturnsConfidence(t *testing.T) {
	// Bench with sample 12 → confidence "high". Result JSON is fed back to
	// the LLM, so we assert the JSON shape.
	median := 89.0
	bench := &tourismmodel.PricingBenchmark{
		Category:       "wine_tour",
		Council:        "Adelaide Hills",
		DurationBucket: DurationBucketHalfDay,
		Season:         tourismmodel.SeasonYearRound,
		MedianPrice:    &median,
		SampleSize:     12,
		Currency:       "AUD",
	}
	store := &fakeStore{bench: bench}
	a := New(&scriptedLLM{}, store, "")

	tc := llmprovider.ToolCall{
		ID:   "call_p",
		Type: "function",
		Function: llmprovider.FunctionCall{
			Name:      "get_pricing_benchmark",
			Arguments: `{"category":"wine_tour","council":"Adelaide Hills","duration_bucket":"half_day"}`,
		},
	}
	out, refs, err := a.executeTool(context.Background(), tc)
	if err != nil {
		t.Fatalf("executeTool: %v", err)
	}
	if len(refs) != 0 {
		t.Errorf("pricing tool emitted refs = %+v, want none", refs)
	}
	var got map[string]any
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatalf("tool result not JSON: %v", err)
	}
	if got["confidence"] != tourismmodel.ConfidenceHigh {
		t.Errorf("confidence = %v, want %q", got["confidence"], tourismmodel.ConfidenceHigh)
	}
	if got["sample_size"].(float64) != 12 {
		t.Errorf("sample_size = %v, want 12", got["sample_size"])
	}
}

func TestSuggestPricingInsufficientSample(t *testing.T) {
	// Sample 2 → insufficient_data, no median exposed.
	bench := &tourismmodel.PricingBenchmark{
		Category:       "wine_tour",
		Council:        "Adelaide Hills",
		DurationBucket: DurationBucketHalfDay,
		Season:         tourismmodel.SeasonYearRound,
		SampleSize:     2,
		Currency:       "AUD",
	}
	store := &fakeStore{bench: bench}
	a := New(&scriptedLLM{}, store, "")
	resp, err := a.SuggestPricing(context.Background(), PricingRequest{
		Category:        "wine_tour",
		Council:         "Adelaide Hills",
		DurationMinutes: 240,
	})
	if err != nil {
		t.Fatalf("SuggestPricing: %v", err)
	}
	if !resp.InsufficientData {
		t.Error("InsufficientData = false, want true")
	}
	if resp.Median != nil {
		t.Errorf("Median = %v, want nil for insufficient sample", *resp.Median)
	}
	if resp.Confidence != tourismmodel.ConfidenceInsufficient {
		t.Errorf("Confidence = %q, want %q", resp.Confidence, tourismmodel.ConfidenceInsufficient)
	}
}

func TestSuggestPricingHighConfidence(t *testing.T) {
	median := 89.0
	p25 := 75.0
	p75 := 110.0
	bench := &tourismmodel.PricingBenchmark{
		Category:       "wine_tour",
		Council:        "Adelaide Hills",
		DurationBucket: DurationBucketHalfDay,
		Season:         tourismmodel.SeasonYearRound,
		MedianPrice:    &median,
		P25:            &p25,
		P75:            &p75,
		SampleSize:     12,
		Currency:       "AUD",
	}
	store := &fakeStore{bench: bench}
	a := New(&scriptedLLM{}, store, "")
	resp, err := a.SuggestPricing(context.Background(), PricingRequest{
		Category:        "wine_tour",
		Council:         "Adelaide Hills",
		DurationMinutes: 240,
	})
	if err != nil {
		t.Fatalf("SuggestPricing: %v", err)
	}
	if resp.Confidence != tourismmodel.ConfidenceHigh {
		t.Errorf("Confidence = %q, want %q", resp.Confidence, tourismmodel.ConfidenceHigh)
	}
	if resp.Median == nil || *resp.Median != 89.0 {
		t.Errorf("Median = %v, want 89", resp.Median)
	}
	if resp.Explanation == "" {
		t.Error("Explanation is empty; expected templated text")
	}
}

func TestSuggestPricingMissingDimsErrors(t *testing.T) {
	a := New(&scriptedLLM{}, &fakeStore{}, "")
	_, err := a.SuggestPricing(context.Background(), PricingRequest{Category: "x"})
	if err == nil {
		t.Error("expected error for missing council")
	}
}

func TestExecuteSimilarProductsRequiresDims(t *testing.T) {
	a := New(&scriptedLLM{}, &fakeStore{}, "")
	tc := llmprovider.ToolCall{
		Function: llmprovider.FunctionCall{
			Name:      "get_similar_products",
			Arguments: `{}`,
		},
	}
	if _, _, err := a.executeTool(context.Background(), tc); err == nil {
		t.Error("expected error when category/council omitted")
	}
}

func TestExecuteUnknownTool(t *testing.T) {
	a := New(&scriptedLLM{}, &fakeStore{}, "")
	tc := llmprovider.ToolCall{
		Function: llmprovider.FunctionCall{Name: "delete_everything"},
	}
	if _, _, err := a.executeTool(context.Background(), tc); err == nil {
		t.Error("expected error for unknown tool")
	}
}

func TestExecuteSearchKnowledgeBadJSON(t *testing.T) {
	a := New(&scriptedLLM{}, &fakeStore{}, "")
	tc := llmprovider.ToolCall{
		Function: llmprovider.FunctionCall{
			Name:      "search_knowledge",
			Arguments: "not json",
		},
	}
	if _, _, err := a.executeTool(context.Background(), tc); err == nil {
		t.Error("expected error for malformed JSON args")
	}
}

func TestExecutePricingBenchmarkMissingDims(t *testing.T) {
	a := New(&scriptedLLM{}, &fakeStore{}, "")
	tc := llmprovider.ToolCall{
		Function: llmprovider.FunctionCall{
			Name:      "get_pricing_benchmark",
			Arguments: `{"category":"x"}`,
		},
	}
	if _, _, err := a.executeTool(context.Background(), tc); err == nil {
		t.Error("expected error for missing council/duration_bucket")
	}
}

func TestExecuteSimilarProductsBadJSON(t *testing.T) {
	a := New(&scriptedLLM{}, &fakeStore{}, "")
	tc := llmprovider.ToolCall{
		Function: llmprovider.FunctionCall{
			Name:      "get_similar_products",
			Arguments: "{",
		},
	}
	if _, _, err := a.executeTool(context.Background(), tc); err == nil {
		t.Error("expected error for malformed JSON args")
	}
}

func TestGenerateInvalidField(t *testing.T) {
	a := New(&scriptedLLM{}, &fakeStore{}, "")
	_, err := a.Generate(context.Background(), GenerateRequest{Field: "totally-bogus"})
	if err == nil {
		t.Error("expected error for invalid field type")
	}
}

func TestSuggestPricingDefaultsSeason(t *testing.T) {
	// Empty Season → store should be queried with year_round; we verify by
	// having fakeStore record nothing and just check no error.
	median := 100.0
	bench := &tourismmodel.PricingBenchmark{
		Category:       "wine_tour",
		Council:        "Barossa",
		DurationBucket: DurationBucketFullDay,
		Season:         tourismmodel.SeasonYearRound,
		MedianPrice:    &median,
		SampleSize:     6,
		Currency:       "", // exercise the default-AUD branch
	}
	store := &fakeStore{bench: bench}
	a := New(&scriptedLLM{}, store, "")
	resp, err := a.SuggestPricing(context.Background(), PricingRequest{
		Category:        "wine_tour",
		Council:         "Barossa",
		DurationMinutes: 480,
	})
	if err != nil {
		t.Fatalf("SuggestPricing: %v", err)
	}
	if resp.Confidence != tourismmodel.ConfidenceNormal {
		t.Errorf("Confidence = %q, want %q", resp.Confidence, tourismmodel.ConfidenceNormal)
	}
	if resp.Currency != "AUD" {
		t.Errorf("Currency = %q, want AUD (default)", resp.Currency)
	}
}

func TestToolSpecsShape(t *testing.T) {
	specs := ToolSpecs()
	if len(specs) < 3 {
		t.Fatalf("ToolSpecs() returned %d, want >= 3 (Gate 4)", len(specs))
	}
	names := map[string]bool{}
	for _, s := range specs {
		if s.Type != "function" {
			t.Errorf("tool %q has type %q, want function", s.Function.Name, s.Type)
		}
		if s.Function.Parameters == nil {
			t.Errorf("tool %q missing parameters", s.Function.Name)
		}
		names[s.Function.Name] = true
	}
	for _, want := range []string{"search_knowledge", "get_pricing_benchmark", "get_similar_products"} {
		if !names[want] {
			t.Errorf("missing tool %q", want)
		}
	}
}

func TestIsValidField(t *testing.T) {
	for _, f := range []FieldType{FieldTitle, FieldDescription, FieldHighlights, FieldItinerary} {
		if !IsValidField(f) {
			t.Errorf("IsValidField(%q) = false, want true", f)
		}
	}
	if IsValidField("nonsense") {
		t.Error("IsValidField('nonsense') = true, want false")
	}
}

func TestBuildUserPromptAllFields(t *testing.T) {
	// Each field type has its own length / format guidance — verify the
	// per-branch instruction text is present so the LLM gets the right cue.
	cases := []struct {
		field       FieldType
		mustContain string
	}{
		{FieldTitle, "TITLE"},
		{FieldDescription, "DESCRIPTION"},
		{FieldHighlights, "HIGHLIGHTS"},
		{FieldItinerary, "ITINERARY"},
	}
	for _, c := range cases {
		got := BuildUserPrompt(c.field, "en-US", Skeleton{Council: "Barossa"})
		if !strings.Contains(got, c.mustContain) {
			t.Errorf("BuildUserPrompt(%q) missing %q", c.field, c.mustContain)
		}
		if !strings.Contains(got, "en-US") {
			t.Errorf("BuildUserPrompt(%q) missing language", c.field)
		}
	}

	// Default language branch (empty → zh-CN).
	got := BuildUserPrompt(FieldTitle, "", Skeleton{})
	if !strings.Contains(got, "zh-CN") {
		t.Errorf("default language not zh-CN: %q", got)
	}
}

func TestNewRateLimiter(t *testing.T) {
	if NewRateLimiter() == nil {
		t.Fatal("NewRateLimiter returned nil")
	}
}

func TestExecuteSimilarProductsHappyPath(t *testing.T) {
	store := &fakeStore{
		similar: []SimilarProductSkeleton{
			{ID: 1, Category: "wine_tour", Council: "Barossa", DurationBucket: DurationBucketHalfDay, Price: 89},
			{ID: 2, Category: "wine_tour", Council: "Barossa", DurationBucket: DurationBucketHalfDay, Price: 110},
		},
	}
	a := New(&scriptedLLM{}, store, "")
	tc := llmprovider.ToolCall{
		Function: llmprovider.FunctionCall{
			Name:      "get_similar_products",
			Arguments: `{"category":"wine_tour","council":"Barossa","duration_bucket":"half_day"}`,
		},
	}
	out, refs, err := a.executeTool(context.Background(), tc)
	if err != nil {
		t.Fatalf("executeTool: %v", err)
	}
	if len(refs) != 0 {
		t.Errorf("similar_products tool emitted refs = %+v, want none", refs)
	}
	var got map[string]any
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatalf("tool result not JSON: %v", err)
	}
	if got["count"].(float64) != 2 {
		t.Errorf("count = %v, want 2", got["count"])
	}
}

func TestPricingExplanationCoversAllBuckets(t *testing.T) {
	for _, b := range []string{DurationBucketHalfDay, DurationBucketFullDay, DurationBucketMultiDay, "unknown"} {
		got := pricingExplanation(5, "Barossa", b)
		if got == "" {
			t.Errorf("pricingExplanation(%q) returned empty string", b)
		}
		if !strings.Contains(got, "Barossa") {
			t.Errorf("pricingExplanation(%q) missing council: %q", b, got)
		}
	}
}

func TestConfidenceForBoundaries(t *testing.T) {
	cases := []struct {
		n    int
		want string
	}{
		{0, tourismmodel.ConfidenceInsufficient},
		{2, tourismmodel.ConfidenceInsufficient},
		{3, tourismmodel.ConfidenceLow},
		{4, tourismmodel.ConfidenceLow},
		{5, tourismmodel.ConfidenceNormal},
		{11, tourismmodel.ConfidenceNormal},
		{12, tourismmodel.ConfidenceHigh},
		{100, tourismmodel.ConfidenceHigh},
	}
	for _, c := range cases {
		if got := tourismmodel.ConfidenceFor(c.n); got != c.want {
			t.Errorf("ConfidenceFor(%d) = %q, want %q", c.n, got, c.want)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
