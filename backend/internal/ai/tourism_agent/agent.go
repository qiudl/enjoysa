package tourism_agent

import (
	"context"
	"errors"
	"fmt"

	"enjoysa-backend/internal/llmprovider"
	tourismmodel "enjoysa-backend/internal/tourism/model"
)

// REQ-20260510-0002 · 1B
//
// Agent orchestrates a single field-generation conversation: it advertises
// tools to the LLM, executes any tool calls the LLM emits, feeds results
// back, and returns the final assistant content along with the knowledge
// references actually visited during the loop.
//
// Pricing suggestions don't need an LLM — SuggestPricing reads the benchmark
// row directly and templates a Chinese explanation.

// LLM is the narrow chat interface tourism_agent needs. Defining it here
// (rather than depending on llmprovider.Provider) lets tests pass a fake
// without implementing Code() / DefaultModel() / ChatStream().
type LLM interface {
	ChatJSON(ctx context.Context, req llmprovider.Request) (content string, toolCalls []llmprovider.ToolCall, err error)
}

// KnowledgeRef is a tourism_* entity the agent actually visited via tools
// during a conversation. Returned to the API caller so the UI can show
// "based on X attractions" without trusting any IDs the LLM might mention
// in its emitted prose (D3).
type KnowledgeRef struct {
	Type string `json:"type"`
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

// GenerateRequest is one field-generation call.
type GenerateRequest struct {
	Field    FieldType
	Language string // "zh-CN" or "en-US"; empty → zh-CN
	Skeleton Skeleton
}

// GenerateResponse is the final agent answer.
type GenerateResponse struct {
	Field         FieldType      `json:"field"`
	Content       string         `json:"content"`
	KnowledgeRefs []KnowledgeRef `json:"knowledge_refs"`
}

// PricingRequest mirrors the API-level body of POST /api/v1/ai/tourism/pricing-suggest.
type PricingRequest struct {
	Category        string
	Council         string
	DurationMinutes int
	Season          string
}

// PricingResponse mirrors the API-level response body. Confidence is derived
// from SampleSize via tourismmodel.ConfidenceFor (D4).
type PricingResponse struct {
	Median           *float64 `json:"median,omitempty"`
	P25              *float64 `json:"p25,omitempty"`
	P75              *float64 `json:"p75,omitempty"`
	SampleSize       int      `json:"sample_size"`
	Currency         string   `json:"currency"`
	Confidence       string   `json:"confidence"`
	Explanation      string   `json:"explanation,omitempty"`
	InsufficientData bool     `json:"insufficient_data,omitempty"`
}

const defaultMaxIterations = 3

// Agent runs the tool loop. Construct via New.
type Agent struct {
	llm            LLM
	store          Store
	model          string
	maxIterations  int
}

// New constructs an Agent. `model` may be empty to use the provider default.
func New(llm LLM, store Store, model string) *Agent {
	return &Agent{
		llm:           llm,
		store:         store,
		model:         model,
		maxIterations: defaultMaxIterations,
	}
}

// WithMaxIterations overrides the default tool-call cap. Useful for tests.
func (a *Agent) WithMaxIterations(n int) *Agent {
	a.maxIterations = n
	return a
}

// ErrMaxIterations is returned when the LLM keeps requesting tools past the
// configured cap. The HTTP handler should map this to 503 with a retry hint.
var ErrMaxIterations = errors.New("tourism_agent: exceeded max tool iterations")

// Generate runs the agent loop until the LLM returns a final answer (no tool
// calls) or the iteration cap is hit.
func (a *Agent) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	if !IsValidField(req.Field) {
		return nil, fmt.Errorf("tourism_agent: invalid field %q", req.Field)
	}

	messages := []llmprovider.Message{
		{Role: "system", Content: SystemPrompt()},
		{Role: "user", Content: BuildUserPrompt(req.Field, req.Language, req.Skeleton)},
	}

	tools := ToolSpecs()
	var collectedRefs []KnowledgeRef

	for i := 0; i < a.maxIterations; i++ {
		content, toolCalls, err := a.llm.ChatJSON(ctx, llmprovider.Request{
			Model:    a.model,
			Messages: messages,
			Tools:    tools,
		})
		if err != nil {
			return nil, fmt.Errorf("tourism_agent: llm call: %w", err)
		}

		if len(toolCalls) == 0 {
			// LLM returned a final answer.
			return &GenerateResponse{
				Field:         req.Field,
				Content:       content,
				KnowledgeRefs: dedupeRefs(collectedRefs),
			}, nil
		}

		// Append the assistant turn (with tool_calls) to the conversation.
		messages = append(messages, llmprovider.Message{
			Role:      "assistant",
			ToolCalls: toolCalls,
		})

		// Execute each tool, feed results back as tool-role messages.
		for _, tc := range toolCalls {
			result, refs, err := a.executeTool(ctx, tc)
			if err != nil {
				// Surface the error to the LLM so it can recover (or stop)
				// rather than failing the whole call.
				result = fmt.Sprintf(`{"error": %q}`, err.Error())
			}
			collectedRefs = append(collectedRefs, refs...)
			messages = append(messages, llmprovider.Message{
				Role:       "tool",
				Content:    result,
				ToolCallID: tc.ID,
			})
		}
	}

	return nil, ErrMaxIterations
}

// SuggestPricing reads the benchmark row directly, no LLM involvement.
// The explanation string is templated in Chinese per Phase 1 scope.
func (a *Agent) SuggestPricing(ctx context.Context, req PricingRequest) (*PricingResponse, error) {
	if req.Category == "" || req.Council == "" {
		return nil, fmt.Errorf("tourism_agent: category and council required")
	}

	bucket := DurationBucketForMinutes(req.DurationMinutes)
	season := req.Season
	if season == "" {
		season = tourismmodel.SeasonYearRound
	}

	bench, err := a.store.GetPricingBenchmark(ctx, PricingParams{
		Category:       req.Category,
		Council:        req.Council,
		DurationBucket: bucket,
		Season:         season,
	})
	if err != nil {
		return nil, fmt.Errorf("tourism_agent: pricing benchmark: %w", err)
	}

	confidence := tourismmodel.ConfidenceFor(bench.SampleSize)
	currency := bench.Currency
	if currency == "" {
		currency = "AUD"
	}

	if confidence == tourismmodel.ConfidenceInsufficient {
		return &PricingResponse{
			SampleSize:       bench.SampleSize,
			Currency:         currency,
			Confidence:       confidence,
			InsufficientData: true,
		}, nil
	}

	return &PricingResponse{
		Median:      bench.MedianPrice,
		P25:         bench.P25,
		P75:         bench.P75,
		SampleSize:  bench.SampleSize,
		Currency:    currency,
		Confidence:  confidence,
		Explanation: pricingExplanation(bench.SampleSize, req.Council, bucket),
	}, nil
}

func pricingExplanation(sampleSize int, council, bucket string) string {
	bucketLabel := bucket
	switch bucket {
	case DurationBucketHalfDay:
		bucketLabel = "半日"
	case DurationBucketFullDay:
		bucketLabel = "全日"
	case DurationBucketMultiDay:
		bucketLabel = "多日"
	}
	return fmt.Sprintf("基于 %d 个 %s %s产品的中位价（含 P25/P75 分位）", sampleSize, council, bucketLabel)
}

// dedupeRefs collapses duplicate (type, id) refs harvested across multiple
// tool calls in the same conversation.
func dedupeRefs(refs []KnowledgeRef) []KnowledgeRef {
	if len(refs) == 0 {
		return []KnowledgeRef{}
	}
	seen := make(map[string]struct{}, len(refs))
	out := make([]KnowledgeRef, 0, len(refs))
	for _, r := range refs {
		key := fmt.Sprintf("%s:%d", r.Type, r.ID)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, r)
	}
	return out
}
