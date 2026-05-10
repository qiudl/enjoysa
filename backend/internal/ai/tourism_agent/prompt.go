package tourism_agent

import (
	"fmt"
	"strings"
)

// REQ-20260510-0002 · 1B
//
// System / user prompt builders. The system prompt is intentionally stable
// (council list + tool grounding rules) so DeepSeek prompt caching can hit on
// repeat calls — see user memory "REQ-0036 prompt cache 经验".

// SystemPrompt is the cache-friendly preamble shared by all GenerateField
// calls. Keep this string stable; if you must change it, do so deliberately
// (cache miss costs real tokens).
func SystemPrompt() string {
	var sb strings.Builder
	sb.WriteString("You are a South Australia (SA) tourism domain expert AI. Your job:\n")
	sb.WriteString("1) Generate factual, professional product copy (titles, descriptions, highlights, itineraries) grounded in real South Australia attractions, accommodations, food, and experiences.\n")
	sb.WriteString("2) Suggest pricing based on market benchmarks for similar products.\n\n")
	sb.WriteString("CRITICAL RULES:\n")
	sb.WriteString("- Call search_knowledge ONCE with the supplier's council/category to find relevant entries before composing copy. DO NOT invent attraction names or prices.\n")
	sb.WriteString("- If the first search returns results: use them as grounding and write the answer.\n")
	sb.WriteString("- If the first search returns no results: try ONE alternate search with broader keywords (e.g., the category in Chinese AND English). If that also returns nothing, IMMEDIATELY compose a brief, generic answer from the supplier's skeleton fields — do not keep searching.\n")
	sb.WriteString("- Hard limit: at most TWO search_knowledge calls per conversation. After two empty searches, write the answer based on whatever skeleton info the supplier provided.\n")
	sb.WriteString("- Only reference attractions / experiences / food / accommodations returned by search_knowledge in this conversation. Do not name venues from training data alone.\n")
	sb.WriteString("- Reference specific councils (e.g., \"Adelaide Hills\", \"Barossa\") returned by tools.\n")
	sb.WriteString("- For pricing suggestions, ALWAYS call get_pricing_benchmark first (this counts separately from the search budget).\n")
	sb.WriteString("- Output strictly the requested content — no disclaimers, no meta-commentary, no markdown unless the field requests it.\n\n")
	sb.WriteString("Available South Australia councils:\n")
	sb.WriteString(strings.Join(SACouncils, ", "))
	sb.WriteString("\n")
	return sb.String()
}

// FieldType is one of the editable product copy fields the agent can produce.
type FieldType string

const (
	FieldTitle       FieldType = "title"
	FieldDescription FieldType = "description"
	FieldHighlights  FieldType = "highlights"
	FieldItinerary   FieldType = "itinerary"
)

// IsValidField reports whether f is one of the supported FieldTypes.
func IsValidField(f FieldType) bool {
	switch f {
	case FieldTitle, FieldDescription, FieldHighlights, FieldItinerary:
		return true
	}
	return false
}

// Skeleton is the supplier-provided seed for a generation. The agent uses
// these dimensions to ground search_knowledge and shape the output.
type Skeleton struct {
	Category        string   `json:"category,omitempty"`
	Council         string   `json:"council,omitempty"`
	DurationMinutes int      `json:"duration_minutes,omitempty"`
	Highlights      []string `json:"highlights,omitempty"`
	Tags            []string `json:"tags,omitempty"`
}

// BuildUserPrompt formats the per-call instruction. Length / format expectations
// per field are encoded here so the LLM doesn't return an essay for a title or
// a one-liner for a description.
func BuildUserPrompt(field FieldType, language string, sk Skeleton) string {
	var sb strings.Builder

	lang := language
	if lang == "" {
		lang = "zh-CN"
	}

	switch field {
	case FieldTitle:
		sb.WriteString("Generate a product TITLE.\n")
		sb.WriteString("- Length: 5-60 characters.\n")
		sb.WriteString("- Single line, no markdown, no period at the end.\n")
		sb.WriteString("- Should mention the council/region or a real attraction name returned by search_knowledge.\n")
	case FieldDescription:
		sb.WriteString("Generate a product DESCRIPTION.\n")
		sb.WriteString("- Length: 100-2000 characters.\n")
		sb.WriteString("- 2-4 short paragraphs, no markdown headings.\n")
		sb.WriteString("- Open with the location/council, then highlights, then practical notes.\n")
		sb.WriteString("- Reference at least one real attraction / experience returned by search_knowledge.\n")
	case FieldHighlights:
		sb.WriteString("Generate a HIGHLIGHTS list.\n")
		sb.WriteString("- 3-6 bullet items, each 20-80 characters.\n")
		sb.WriteString("- Plain text, one bullet per line, prefix \"- \".\n")
		sb.WriteString("- Each bullet calls out a concrete experience or sight.\n")
	case FieldItinerary:
		sb.WriteString("Generate an ITINERARY (sequenced steps).\n")
		sb.WriteString("- 3-8 steps, each \"<duration> · <activity at place>\".\n")
		sb.WriteString("- Plain text, one step per line, prefix the line with the step number.\n")
		sb.WriteString("- Use real council / attraction names from search_knowledge.\n")
	default:
		sb.WriteString("Generate the requested field.\n")
	}

	sb.WriteString("\nOutput language: ")
	sb.WriteString(lang)
	sb.WriteString(" only.\n\n")

	sb.WriteString("Skeleton from supplier:\n")
	if sk.Category != "" {
		fmt.Fprintf(&sb, "- category: %s\n", sk.Category)
	}
	if sk.Council != "" {
		fmt.Fprintf(&sb, "- council: %s\n", sk.Council)
	}
	if sk.DurationMinutes > 0 {
		fmt.Fprintf(&sb, "- duration_minutes: %d (bucket: %s)\n",
			sk.DurationMinutes, DurationBucketForMinutes(sk.DurationMinutes))
	}
	if len(sk.Highlights) > 0 {
		fmt.Fprintf(&sb, "- highlights hints: %s\n", strings.Join(sk.Highlights, ", "))
	}
	if len(sk.Tags) > 0 {
		fmt.Fprintf(&sb, "- tags: %s\n", strings.Join(sk.Tags, ", "))
	}

	sb.WriteString("\nReturn the field content directly — no JSON wrapping, no preamble.\n")
	return sb.String()
}
