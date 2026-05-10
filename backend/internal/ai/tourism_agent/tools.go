package tourism_agent

import (
	"context"
	"encoding/json"
	"fmt"

	"enjoysa-backend/internal/llmprovider"
	tourismmodel "enjoysa-backend/internal/tourism/model"
)

// REQ-20260510-0002 · 1B
//
// Function-calling tool specs and dispatcher. Three tools (≥3 per Gate 4):
//   1. search_knowledge      — find real attractions / accommodations / food /
//                              experiences before composing copy
//   2. get_pricing_benchmark — fetch median + p25 + p75 + sample_size for a
//                              dimension before suggesting price
//   3. get_similar_products  — sibling product skeletons (no description) to
//                              shape itinerary structure without copying copy
//
// All tool results MUST come from the store. The LLM cannot fabricate
// knowledge_refs because we only collect refs from real tool returns
// (D3 mitigation).

const (
	toolSearchKnowledge       = "search_knowledge"
	toolGetPricingBenchmark   = "get_pricing_benchmark"
	toolGetSimilarProducts    = "get_similar_products"
)

// ToolSpecs returns the OpenAI-style function specs the agent advertises to
// the LLM on every Generate call.
func ToolSpecs() []llmprovider.Tool {
	return []llmprovider.Tool{
		{
			Type: "function",
			Function: llmprovider.ToolFunction{
				Name:        toolSearchKnowledge,
				Description: "Search the South Australia tourism knowledge base for real attractions, accommodations, food venues, or experiences. Returns up to 10 entries you may reference in copy.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"category": map[string]any{
							"type":        "string",
							"description": "Optional category filter, e.g. 'wine', 'nature', 'history'.",
						},
						"council": map[string]any{
							"type":        "string",
							"description": "Optional South Australia council, e.g. 'Adelaide Hills', 'Barossa'.",
						},
						"keywords": map[string]any{
							"type":        "string",
							"description": "Optional keyword to fuzzy-match against name and description.",
						},
					},
					"required": []string{},
				},
			},
		},
		{
			Type: "function",
			Function: llmprovider.ToolFunction{
				Name:        toolGetPricingBenchmark,
				Description: "Get the median + P25 + P75 + sample_size for a given product dimension. Use this BEFORE suggesting a price.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"category": map[string]any{
							"type":        "string",
							"description": "Product category, e.g. 'wine_tour', 'wildlife_experience'.",
						},
						"council": map[string]any{
							"type":        "string",
							"description": "South Australia council the product runs in.",
						},
						"duration_bucket": map[string]any{
							"type":        "string",
							"enum":        []string{DurationBucketHalfDay, DurationBucketFullDay, DurationBucketMultiDay},
							"description": "Coarse duration: half_day | full_day | multi_day.",
						},
						"season": map[string]any{
							"type":        "string",
							"enum":        []string{tourismmodel.SeasonYearRound, tourismmodel.SeasonSpring, tourismmodel.SeasonSummer, tourismmodel.SeasonAutumn, tourismmodel.SeasonWinter},
							"description": "Optional season; defaults to year_round.",
						},
					},
					"required": []string{"category", "council", "duration_bucket"},
				},
			},
		},
		{
			Type: "function",
			Function: llmprovider.ToolFunction{
				Name:        toolGetSimilarProducts,
				Description: "Fetch up to 5 sibling product SKELETONS (id + dimensions + price; no name/description) to shape itinerary structure. Do NOT copy text from these — they are structural references only.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"category": map[string]any{
							"type":        "string",
							"description": "Product category to match.",
						},
						"council": map[string]any{
							"type":        "string",
							"description": "Council to match.",
						},
						"duration_bucket": map[string]any{
							"type":        "string",
							"enum":        []string{DurationBucketHalfDay, DurationBucketFullDay, DurationBucketMultiDay},
							"description": "Optional duration bucket.",
						},
					},
					"required": []string{"category", "council"},
				},
			},
		},
	}
}

// executeTool routes one LLM-emitted tool call to the store and returns:
//   - resultJSON: the JSON-serialized tool result, fed back to the LLM as the
//     "tool" role message;
//   - refs: any KnowledgeRefs harvested from this tool result, accumulated
//     across the loop so the final response can cite real entries.
func (a *Agent) executeTool(ctx context.Context, tc llmprovider.ToolCall) (string, []KnowledgeRef, error) {
	switch tc.Function.Name {
	case toolSearchKnowledge:
		return a.execSearchKnowledge(ctx, tc.Function.Arguments)
	case toolGetPricingBenchmark:
		return a.execGetPricingBenchmark(ctx, tc.Function.Arguments)
	case toolGetSimilarProducts:
		return a.execGetSimilarProducts(ctx, tc.Function.Arguments)
	default:
		return "", nil, fmt.Errorf("unknown tool %q", tc.Function.Name)
	}
}

func (a *Agent) execSearchKnowledge(ctx context.Context, argsJSON string) (string, []KnowledgeRef, error) {
	var args struct {
		Category string `json:"category"`
		Council  string `json:"council"`
		Keywords string `json:"keywords"`
	}
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return "", nil, fmt.Errorf("search_knowledge: bad arguments: %w", err)
		}
	}
	hits, err := a.store.SearchKnowledge(ctx, SearchParams{
		Category: args.Category,
		Council:  args.Council,
		Keywords: args.Keywords,
		Limit:    defaultSearchLimit,
	})
	if err != nil {
		return "", nil, err
	}

	refs := make([]KnowledgeRef, 0, len(hits))
	for _, h := range hits {
		refs = append(refs, KnowledgeRef{Type: h.Type, ID: h.ID, Name: h.NameZh})
	}

	out, err := json.Marshal(map[string]any{
		"hits":  hits,
		"count": len(hits),
	})
	if err != nil {
		return "", nil, err
	}
	return string(out), refs, nil
}

func (a *Agent) execGetPricingBenchmark(ctx context.Context, argsJSON string) (string, []KnowledgeRef, error) {
	var args struct {
		Category       string `json:"category"`
		Council        string `json:"council"`
		DurationBucket string `json:"duration_bucket"`
		Season         string `json:"season"`
	}
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return "", nil, fmt.Errorf("get_pricing_benchmark: bad arguments: %w", err)
		}
	}
	if args.Category == "" || args.Council == "" || args.DurationBucket == "" {
		return "", nil, fmt.Errorf("get_pricing_benchmark: category, council, duration_bucket are required")
	}

	bench, err := a.store.GetPricingBenchmark(ctx, PricingParams{
		Category:       args.Category,
		Council:        args.Council,
		DurationBucket: args.DurationBucket,
		Season:         args.Season,
	})
	if err != nil {
		return "", nil, err
	}

	confidence := tourismmodel.ConfidenceFor(bench.SampleSize)
	payload := map[string]any{
		"category":         bench.Category,
		"council":          bench.Council,
		"duration_bucket":  bench.DurationBucket,
		"season":           bench.Season,
		"sample_size":      bench.SampleSize,
		"currency":         bench.Currency,
		"confidence":       confidence,
		"insufficient":     confidence == tourismmodel.ConfidenceInsufficient,
	}
	if bench.MedianPrice != nil {
		payload["median"] = *bench.MedianPrice
	}
	if bench.P25 != nil {
		payload["p25"] = *bench.P25
	}
	if bench.P75 != nil {
		payload["p75"] = *bench.P75
	}

	out, err := json.Marshal(payload)
	if err != nil {
		return "", nil, err
	}
	// pricing benchmarks are aggregate stats, not knowledge entities — no refs.
	return string(out), nil, nil
}

func (a *Agent) execGetSimilarProducts(ctx context.Context, argsJSON string) (string, []KnowledgeRef, error) {
	var args struct {
		Category       string `json:"category"`
		Council        string `json:"council"`
		DurationBucket string `json:"duration_bucket"`
	}
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return "", nil, fmt.Errorf("get_similar_products: bad arguments: %w", err)
		}
	}
	if args.Category == "" || args.Council == "" {
		return "", nil, fmt.Errorf("get_similar_products: category and council are required")
	}

	skels, err := a.store.GetSimilarProducts(ctx, PricingParams{
		Category:       args.Category,
		Council:        args.Council,
		DurationBucket: args.DurationBucket,
	})
	if err != nil {
		return "", nil, err
	}

	out, err := json.Marshal(map[string]any{
		"skeletons": skels,
		"count":     len(skels),
	})
	if err != nil {
		return "", nil, err
	}
	// Similar product IDs are existing products, not tourism knowledge entries —
	// they don't get added to KnowledgeRefs which only tracks tourism_* entities.
	return string(out), nil, nil
}
