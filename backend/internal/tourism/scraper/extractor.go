package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"enjoysa-backend/internal/llmprovider"
)

// REQ-20260510-0011 · 2C · extractor.go
//
// LLM-based structured extraction from raw web pages. Ported from the R7
// PoC (cmd/scrape-poc) — same prompt with two PoC fixes applied:
//   - council post-processing: Title-case enforce so "adelaide" → "Adelaide"
//   - description_zh: prompt strengthens "no English words" rule (PoC innes
//     output had "pristine" / "historic" leaked through)
//
// The extractor is provider-agnostic — it talks to the llmprovider.Provider
// interface that we've used since 1B / Phase 1, so swapping models or
// providers in one place only.

// SystemPrompt is the cache-friendly extraction preamble. Stable string
// for prompt cache hits across many URLs in a single scrape job.
const ExtractorSystemPrompt = `You extract structured tourism data from raw web pages of the South Australia tourism authority site (southaustralia.com).

Given an HTML excerpt, return STRICT JSON with these fields:
{
  "name_en": "official English name",
  "name_zh": "Chinese translation, faithful not literal",
  "council": "one of: Adelaide, Adelaide Hills, Barossa, Clare Valley, Eyre Peninsula, Fleurieu Peninsula, Kangaroo Island, Limestone Coast, Yorke Peninsula, Flinders Ranges and Outback",
  "category": "one of: nature, urban, history, food, wine, family, beach, wildlife, hike",
  "description_zh": "60-120 character Chinese summary, traveler-facing tone. MUST be entirely Chinese — do NOT leave English words like 'pristine' or 'historic' untranslated.",
  "tags": ["3-6 tags", "lowercase", "english"],
  "best_seasons": ["array of: year_round, spring, summer, autumn, winter"],
  "extraction_confidence": "high | medium | low"
}

Rules:
- Output JSON only, no prose, no markdown fences.
- If a field can't be inferred, set null (do NOT make up data).
- description_zh must be a real summary of THIS place, not generic SA marketing.
- council MUST come from the URL path (provided in the user message), never invented.
- category must be a single value (pick the most dominant if a place fits multiple).`

// ExtractedPayload is the shape we expect back from the LLM. Fields are
// pointers / interface{} where they're optional so missing-or-null in the
// JSON doesn't error.
type ExtractedPayload struct {
	NameEn               string   `json:"name_en"`
	NameZh               string   `json:"name_zh"`
	Council              string   `json:"council"`
	Category             string   `json:"category"`
	DescriptionZh        string   `json:"description_zh"`
	Tags                 []string `json:"tags"`
	BestSeasons          []string `json:"best_seasons"`
	ExtractionConfidence string   `json:"extraction_confidence"`
}

// Extractor wraps an LLM provider with the SA tourism extraction prompt.
// Defined as an interface (not just a struct) so the service layer can
// inject fakes in tests without spinning up a DeepSeek HTTP mock.
type Extractor interface {
	Extract(ctx context.Context, sourceURL, councilHint, htmlExcerpt string) (*ExtractedPayload, error)
}

// LLMExtractor is the production implementation that calls a real provider.
type LLMExtractor struct {
	llm   llmprovider.Provider
	model string
}

func NewLLMExtractor(llm llmprovider.Provider, model string) *LLMExtractor {
	return &LLMExtractor{llm: llm, model: model}
}

// Extract calls the LLM with the SA tourism extraction prompt, parses the
// returned JSON, and post-processes (council Title-case, councilHint
// fallback).
func (e *LLMExtractor) Extract(ctx context.Context, sourceURL, councilHint, htmlExcerpt string) (*ExtractedPayload, error) {
	user := fmt.Sprintf("URL: %s\ncouncil_from_url: %s\n\nHTML excerpt:\n%s",
		sourceURL, councilHint, htmlExcerpt)

	msg, err := e.llm.ChatJSONMessage(ctx, llmprovider.Request{
		Model: e.model,
		Messages: []llmprovider.Message{
			{Role: "system", Content: ExtractorSystemPrompt},
			{Role: "user", Content: user},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("extractor: LLM call: %w", err)
	}
	if msg.Content == "" {
		return nil, fmt.Errorf("extractor: empty content")
	}

	// LLM may wrap in markdown fences despite the prompt saying not to —
	// strip them defensively.
	content := stripJSONFences(msg.Content)

	var p ExtractedPayload
	if err := json.Unmarshal([]byte(content), &p); err != nil {
		return nil, fmt.Errorf("extractor: parse JSON: %w (content: %.200s)", err, content)
	}

	// PoC fix #1: post-process council to Title Case so "adelaide" matches
	// the canonical form admins expect (and what the agent's terminology
	// list uses).
	p.Council = titleCaseCouncil(p.Council)

	// If LLM left council blank, fall back to the URL hint (we already
	// extracted it from the URL path before calling the LLM).
	if p.Council == "" {
		p.Council = titleCaseCouncil(councilHint)
	}

	return &p, nil
}

// CouncilHintFromURL extracts the council slug from a southaustralia.com
// place URL like /destinations/adelaide-hills/places/hahndorf → "adelaide-hills".
// Returns empty string when the URL doesn't match the expected shape so
// downstream code can fall back to LLM inference.
func CouncilHintFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	// expect: destinations/{council}/places/{slug} → 4+ parts
	for i, p := range parts {
		if p == "destinations" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

// SlugFromURL returns the trailing path segment.
func SlugFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

// titleCaseCouncil normalises any of "adelaide", "Adelaide-hills", "ADELAIDE
// HILLS" → "Adelaide Hills". Hyphenated slugs become space-separated.
func titleCaseCouncil(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	s = strings.ReplaceAll(s, "-", " ")
	out := make([]rune, 0, len(s))
	upcomingUpper := true
	for _, r := range s {
		if r == ' ' {
			out = append(out, r)
			upcomingUpper = true
			continue
		}
		if upcomingUpper {
			if r >= 'a' && r <= 'z' {
				r -= 'a' - 'A'
			}
			upcomingUpper = false
		} else {
			if r >= 'A' && r <= 'Z' {
				r += 'a' - 'A'
			}
		}
		out = append(out, r)
	}
	// Special case: "Flinders Ranges And Outback" → "Flinders Ranges and Outback"
	// (the canonical form used by the agent terminology list keeps "and" lowercase).
	return strings.ReplaceAll(string(out), " And ", " and ")
}

// stripJSONFences removes ```json ... ``` wrappers that DeepSeek
// occasionally emits despite the "no markdown" instruction.
var jsonFenceRe = regexp.MustCompile("(?s)```(?:json)?\\s*(.*?)\\s*```")

func stripJSONFences(s string) string {
	s = strings.TrimSpace(s)
	if m := jsonFenceRe.FindStringSubmatch(s); len(m) == 2 {
		return strings.TrimSpace(m[1])
	}
	return s
}
