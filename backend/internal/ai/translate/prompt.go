package translate

import (
	"encoding/json"
	"fmt"
	"strings"
)

func systemPrompt(dir Direction) string {
	switch dir {
	case ZH2EN:
		return "You are a precise Chinese→English translator for tourism product copy. " +
			"Preserve facts, do not invent. Return JSON only."
	default:
		return "你是旅游商品文案的英译中翻译。严格保留事实和数字，不要凭空添加任何信息。" +
			"对地名和业务术语必须按提供的 Glossary 翻译。" +
			"只输出 JSON，不要解释。"
	}
}

// buildPrompt constructs the user message instructing the LLM to translate
// every key in `fields` according to the glossary, leaving §§PH...§§ tokens
// untouched.
func buildPrompt(dir Direction, fields map[string]string, glossary []GlossaryEntry) (string, error) {
	inputJSON, err := json.MarshalIndent(fields, "", "  ")
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	switch dir {
	case ZH2EN:
		sb.WriteString("Translate every value in the JSON below from Chinese to English. ")
		sb.WriteString("Keep the JSON structure and keys identical. ")
	default:
		sb.WriteString("把下面 JSON 中每个 value 从英文翻译到简体中文。\n")
		sb.WriteString("保留 JSON 结构和 key 不变，仅替换 value。\n")
	}

	sb.WriteString("\nRules / 规则:\n")
	sb.WriteString("- Tokens of the form §§PHnn§§ are placeholders for URLs, prices, emails, phone numbers. DO NOT translate or modify them. Copy them verbatim into the output.\n")
	sb.WriteString("- 不允许添加未在原文出现的信息。Do not invent facts.\n")
	sb.WriteString("- Numbers, currencies, percentages stay as written.\n")
	sb.WriteString("- 输出必须是有效 JSON，键名和输入完全一致。Output a single JSON object only — no prose, no markdown fences.\n")

	if len(glossary) > 0 {
		sb.WriteString("\nGlossary (apply strictly when the term appears):\n")
		for _, g := range glossary {
			sb.WriteString(fmt.Sprintf("  %s = %s\n", g.EN, g.ZH))
		}
	}

	sb.WriteString("\nInput JSON:\n")
	sb.Write(inputJSON)
	sb.WriteString("\n")

	return sb.String(), nil
}
