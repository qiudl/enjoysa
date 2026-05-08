package translate

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	aimodel "enjoysa-backend/internal/aichat/model"
	aiservice "enjoysa-backend/internal/aichat/service"
)

// LLM is the minimal interface the translator needs from a chat client.
// Decoupling lets us swap the DeepSeek client for a fake in tests.
type LLM interface {
	ChatJSON(ctx context.Context, messages []aiservice.ChatMessage, tools []aimodel.OpenAITool) (string, []aimodel.OpenAIToolCall, error)
}

// Request describes one batch of fields to translate. All fields are
// translated together so the LLM can keep terminology and tone consistent
// across, say, name + summary + description.
type Request struct {
	Direction Direction
	// Fields keyed by a stable name (e.g. "name", "summary", "description").
	// The same keys are returned in Response.Translations.
	Fields map[string]string
}

type Direction string

const (
	EN2ZH Direction = "en2zh"
	ZH2EN Direction = "zh2en"
)

type Response struct {
	Translations     map[string]string
	PromptTokens     int
	CompletionTokens int
	CostUSD          float64
	Provider         string
	ModelVersion     string
}

type Translator struct {
	llm   LLM
	model string
}

func New(llm LLM, model string) *Translator {
	return &Translator{llm: llm, model: model}
}

// Translate runs one LLM call to translate all input fields in one shot.
// Empty fields are skipped (returned empty in the output) so we don't waste
// tokens. The function masks URLs/prices/emails/phones with placeholders, asks
// the LLM for strict JSON output, and restores the placeholders afterwards.
func (t *Translator) Translate(ctx context.Context, req Request) (*Response, error) {
	if len(req.Fields) == 0 {
		return &Response{Translations: map[string]string{}, Provider: "deepseek", ModelVersion: t.model}, nil
	}

	// 1. Mask sensitive substrings field by field, so we can restore per-field.
	masked := make(map[string]string, len(req.Fields))
	tables := make(map[string]map[string]string, len(req.Fields))
	hasContent := false
	for k, v := range req.Fields {
		if strings.TrimSpace(v) == "" {
			masked[k] = ""
			continue
		}
		hasContent = true
		m, tbl := Protect(v)
		masked[k] = m
		tables[k] = tbl
	}
	if !hasContent {
		// All inputs blank — nothing to do, but return all-empty mapping.
		out := make(map[string]string, len(req.Fields))
		for k := range req.Fields {
			out[k] = ""
		}
		return &Response{Translations: out, Provider: "deepseek", ModelVersion: t.model}, nil
	}

	// 2. Build prompt with glossary.
	glossary, err := LoadGlossary()
	if err != nil {
		return nil, fmt.Errorf("load glossary: %w", err)
	}
	prompt, err := buildPrompt(req.Direction, masked, glossary.All())
	if err != nil {
		return nil, fmt.Errorf("build prompt: %w", err)
	}

	// 3. Call LLM. ChatJSON returns the assistant message content as a string.
	// We don't pass tools — pure text-in/text-out.
	messages := []aiservice.ChatMessage{
		{Role: "system", Content: systemPrompt(req.Direction)},
		{Role: "user", Content: prompt},
	}
	content, _, err := t.llm.ChatJSON(ctx, messages, nil)
	if err != nil {
		return nil, fmt.Errorf("llm call: %w", err)
	}

	// 4. Parse the LLM response as JSON, robust to code fences and prose.
	parsed, err := parseJSONOutput(content)
	if err != nil {
		return nil, fmt.Errorf("parse llm json: %w (raw: %q)", err, snippet(content, 200))
	}

	// 5. Verify all expected keys are present and restore placeholders.
	out := make(map[string]string, len(req.Fields))
	for k, src := range req.Fields {
		if strings.TrimSpace(src) == "" {
			out[k] = ""
			continue
		}
		raw, ok := parsed[k]
		if !ok {
			return nil, fmt.Errorf("llm output missing key %q", k)
		}
		restored := Restore(raw, tables[k])
		if HasUnrestoredPlaceholders(restored) {
			return nil, fmt.Errorf("placeholders not fully restored in field %q", k)
		}
		out[k] = restored
	}

	return &Response{
		Translations: out,
		Provider:     "deepseek",
		ModelVersion: t.model,
	}, nil
}

// jsonBlockRe extracts the first {...} JSON object from a string, tolerant of
// surrounding prose. Non-greedy on the inside of braces does not work for
// nested JSON, so we match the outermost balanced braces with a manual scan.
var fenceRe = regexp.MustCompile("(?s)```(?:json)?\\s*(.*?)```")

func parseJSONOutput(content string) (map[string]string, error) {
	candidate := strings.TrimSpace(content)

	// Try unwrapping a fenced code block first.
	if m := fenceRe.FindStringSubmatch(candidate); len(m) == 2 {
		candidate = strings.TrimSpace(m[1])
	}

	// Try direct unmarshal.
	var out map[string]string
	if err := json.Unmarshal([]byte(candidate), &out); err == nil {
		return out, nil
	}

	// Fall back to scanning for the first balanced {...} block.
	if start := strings.Index(candidate, "{"); start >= 0 {
		depth := 0
		for i := start; i < len(candidate); i++ {
			switch candidate[i] {
			case '{':
				depth++
			case '}':
				depth--
				if depth == 0 {
					sub := candidate[start : i+1]
					if err := json.Unmarshal([]byte(sub), &out); err == nil {
						return out, nil
					}
				}
			}
		}
	}
	return nil, fmt.Errorf("no valid JSON object found")
}

func snippet(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
