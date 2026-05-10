// Command scrape-poc — REQ-20260510-0011 · Phase 2 · 2C R7 PoC
//
// Fetch 10 South Australia Tourism Commission place URLs, send each through
// DeepSeek with a structured-extraction prompt, dump results to disk for
// human evaluation. Determines whether 2C scraping is worth building out
// (R7 design gate: accuracy ≥ 70% → proceed; else defer 2C past this phase).
//
// Run from backend/:
//
//	export DEEPSEEK_API_KEY=...
//	go run ./cmd/scrape-poc
//
// Output: /tmp/scrape-poc/{slug}.json — each file contains:
//   { "url": ..., "fetched_chars": N, "raw_excerpt": ..., "extracted": {...}, "elapsed_ms": M }
//
// Compliance per R5 design decision:
//   - User-Agent identifies us
//   - Referer set to enjoysau.com
//   - 1 r/s pacing (sleep 1s between requests)
//   - Only fetches /destinations/*/places/* (sitemap-listed, robots-allowed)
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var pocURLs = []string{
	"https://southaustralia.com/destinations/adelaide/places/glenelg",
	"https://southaustralia.com/destinations/adelaide-hills/places/hahndorf",
	"https://southaustralia.com/destinations/barossa/places/tanunda",
	"https://southaustralia.com/destinations/clare-valley/places/clare",
	"https://southaustralia.com/destinations/eyre-peninsula/places/port-lincoln",
	"https://southaustralia.com/destinations/fleurieu-peninsula/places/goolwa",
	"https://southaustralia.com/destinations/kangaroo-island/places/kingscote",
	"https://southaustralia.com/destinations/limestone-coast/places/mount-gambier",
	"https://southaustralia.com/destinations/yorke-peninsula/places/innes-national-park",
	"https://southaustralia.com/destinations/flinders-ranges-and-outback/places/wilpena-pound",
}

const (
	deepseekURL    = "https://api.deepseek.com/v1/chat/completions"
	deepseekModel  = "deepseek-chat"
	maxRawHTMLSize = 40_000 // 40KB excerpt cap so LLM input stays bounded
	pacingDelay    = 1 * time.Second
)

const extractionSystemPrompt = `You extract structured tourism data from raw web pages of the South Australia tourism authority site (southaustralia.com).

Given HTML excerpt, return STRICT JSON with these fields:
{
  "name_en": "official English name",
  "name_zh": "Chinese translation, faithful not literal",
  "council": "one of: Adelaide, Adelaide Hills, Barossa, Clare Valley, Eyre Peninsula, Fleurieu Peninsula, Kangaroo Island, Limestone Coast, Yorke Peninsula, Flinders Ranges, Outback",
  "category": "one of: nature, urban, history, food, wine, family, beach, wildlife, hike",
  "description_zh": "60-120 character Chinese summary, traveler-facing tone",
  "tags": ["3-6 tags", "lowercase", "english"],
  "best_seasons": ["array of: year_round, spring, summer, autumn, winter"],
  "extraction_confidence": "high | medium | low"
}

Rules:
- Output JSON only, no prose, no markdown fences.
- If a field can't be inferred, set null (do NOT make up data).
- description_zh must be a real summary of THIS place, not generic SA marketing.
- council MUST come from the URL path, never invented.`

type LLMRequest struct {
	Model    string       `json:"model"`
	Messages []ChatMsg    `json:"messages"`
	Stream   bool         `json:"stream"`
	Temp     float64      `json:"temperature"`
	Format   *RespFormat  `json:"response_format,omitempty"`
}

type ChatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type RespFormat struct {
	Type string `json:"type"`
}

type LLMResponse struct {
	Choices []struct {
		Message ChatMsg `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type PoCResult struct {
	URL                string         `json:"url"`
	Slug               string         `json:"slug"`
	CouncilFromURL     string         `json:"council_from_url"`
	FetchedChars       int            `json:"fetched_chars"`
	ExtractElapsed     int64          `json:"extract_elapsed_ms"`
	TotalElapsed       int64          `json:"total_elapsed_ms"`
	PromptTokens       int            `json:"prompt_tokens"`
	CompletionTokens   int            `json:"completion_tokens"`
	RawExcerpt         string         `json:"raw_excerpt"`
	Extracted          map[string]any `json:"extracted"`
	Error              string         `json:"error,omitempty"`
}

var (
	scriptRe = regexp.MustCompile(`(?s)<script.*?</script>`)
	styleRe  = regexp.MustCompile(`(?s)<style.*?</style>`)
	tagRe    = regexp.MustCompile(`<[^>]+>`)
	wsRe     = regexp.MustCompile(`\s+`)
)

func main() {
	apiKey := os.Getenv("DEEPSEEK_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "DEEPSEEK_API_KEY env var required")
		os.Exit(1)
	}

	outDir := "/tmp/scrape-poc"
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, "mkdir:", err)
		os.Exit(1)
	}

	ctx := context.Background()
	httpClient := &http.Client{Timeout: 30 * time.Second}

	totalStart := time.Now()
	for i, u := range pocURLs {
		fmt.Printf("\n[%d/%d] %s\n", i+1, len(pocURLs), u)
		res := runOne(ctx, httpClient, apiKey, u)
		writeResult(outDir, res)
		fmt.Printf("  fetched: %d chars, extract %d ms, tokens %d\n",
			res.FetchedChars, res.ExtractElapsed, res.PromptTokens+res.CompletionTokens)
		if res.Error != "" {
			fmt.Printf("  ERROR: %s\n", res.Error)
		} else if conf, ok := res.Extracted["extraction_confidence"].(string); ok {
			fmt.Printf("  confidence: %s\n", conf)
		}
		// Pacing per R5 — 1 r/s.
		if i < len(pocURLs)-1 {
			time.Sleep(pacingDelay)
		}
	}
	fmt.Printf("\nTOTAL: %d URLs in %.1fs\n", len(pocURLs), time.Since(totalStart).Seconds())
	fmt.Printf("Output: %s/\n", outDir)
}

func runOne(ctx context.Context, hc *http.Client, apiKey, u string) PoCResult {
	res := PoCResult{URL: u}
	parts := strings.Split(strings.Trim(u, "/"), "/")
	res.Slug = parts[len(parts)-1]
	if len(parts) >= 5 {
		res.CouncilFromURL = parts[len(parts)-3] // .../destinations/{council}/places/{slug}
	}

	totalStart := time.Now()

	// 1. Fetch HTML.
	html, err := fetchHTML(ctx, hc, u)
	if err != nil {
		res.Error = "fetch: " + err.Error()
		return res
	}
	res.FetchedChars = len(html)

	// 2. Strip to text excerpt (LLM-friendly, ≤ maxRawHTMLSize chars).
	excerpt := stripToText(html)
	if len(excerpt) > maxRawHTMLSize {
		excerpt = excerpt[:maxRawHTMLSize]
	}
	res.RawExcerpt = excerpt[:min(len(excerpt), 800)] // only first 800 saved for review

	// 3. LLM extraction.
	extractStart := time.Now()
	parsed, prompt, completion, err := extractWithLLM(ctx, hc, apiKey, u, res.CouncilFromURL, excerpt)
	res.ExtractElapsed = time.Since(extractStart).Milliseconds()
	res.PromptTokens = prompt
	res.CompletionTokens = completion
	if err != nil {
		res.Error = "extract: " + err.Error()
		return res
	}
	res.Extracted = parsed

	res.TotalElapsed = time.Since(totalStart).Milliseconds()
	return res
}

func fetchHTML(ctx context.Context, hc *http.Client, u string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "EnjoySA-tourism-bot/1.0 (+https://enjoysau.com; admin@enjoysau.com)")
	req.Header.Set("Referer", "https://enjoysau.com/")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	resp, err := hc.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 500_000)) // 500KB cap
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func stripToText(html string) string {
	html = scriptRe.ReplaceAllString(html, " ")
	html = styleRe.ReplaceAllString(html, " ")
	text := tagRe.ReplaceAllString(html, " ")
	text = wsRe.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func extractWithLLM(ctx context.Context, hc *http.Client, apiKey, url, councilFromURL, excerpt string) (map[string]any, int, int, error) {
	user := fmt.Sprintf("URL: %s\ncouncil_from_url: %s\n\nHTML excerpt:\n%s", url, councilFromURL, excerpt)
	reqBody := LLMRequest{
		Model: deepseekModel,
		Messages: []ChatMsg{
			{Role: "system", Content: extractionSystemPrompt},
			{Role: "user", Content: user},
		},
		Stream: false,
		Temp:   0.2, // low temp = stable structured output
		Format: &RespFormat{Type: "json_object"},
	}
	rawReq, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, "POST", deepseekURL, bytes.NewReader(rawReq))
	if err != nil {
		return nil, 0, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := hc.Do(req)
	if err != nil {
		return nil, 0, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, 0, 0, fmt.Errorf("LLM %d: %s", resp.StatusCode, truncate(string(raw), 200))
	}
	var out LLMResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, 0, 0, err
	}
	if len(out.Choices) == 0 {
		return nil, 0, 0, fmt.Errorf("empty choices")
	}
	var parsed map[string]any
	content := out.Choices[0].Message.Content
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, out.Usage.PromptTokens, out.Usage.CompletionTokens,
			fmt.Errorf("parse extracted JSON: %w; raw: %s", err, truncate(content, 200))
	}
	return parsed, out.Usage.PromptTokens, out.Usage.CompletionTokens, nil
}

func writeResult(dir string, r PoCResult) {
	path := filepath.Join(dir, r.Slug+".json")
	body, _ := json.MarshalIndent(r, "", "  ")
	_ = os.WriteFile(path, body, 0o644)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "...[truncated]"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
