// Package feishu builds and posts interactive cards to a Feishu (Lark) group
// bot webhook. The wire format follows the public docs at
// https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot.
package feishu

import (
	"strings"
	"time"
)

// answerExcerptMax is the soft cap on the AI answer rendered in the card
// itself; the full text remains accessible via the "view full conversation"
// button so the card stays readable in a busy group.
const answerExcerptMax = 800

// InteractiveCard is the platform-neutral payload our share handler builds.
// `feishu` package translates it into the Feishu interactive card schema.
type InteractiveCard struct {
	Title     string
	Question  string
	Answer    string
	Sender    string    // e.g. "张三 (供应商 · xx民宿)"
	Timestamp time.Time
	DetailURL string    // jumps back to the platform's conversation view
	Note      string    // optional sender remark, may be empty
}

// truncate returns s shortened to at most n runes followed by "..." if cut.
func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "..."
}

// BuildCardJSON renders an InteractiveCard into the JSON payload accepted by
// Feishu group bots (msg_type=interactive). It is a plain map so callers can
// json.Marshal it without pulling in any Feishu SDK.
func BuildCardJSON(card InteractiveCard) map[string]interface{} {
	answerExcerpt := truncate(strings.TrimSpace(card.Answer), answerExcerptMax)
	question := truncate(strings.TrimSpace(card.Question), 400)

	elements := []map[string]interface{}{
		{
			"tag": "div",
			"text": map[string]interface{}{
				"content": "**🙋 问题**\n" + question,
				"tag":     "lark_md",
			},
		},
		{"tag": "hr"},
		{
			"tag": "div",
			"text": map[string]interface{}{
				"content": "**🤖 AI 答复**\n" + answerExcerpt,
				"tag":     "lark_md",
			},
		},
	}

	if note := strings.TrimSpace(card.Note); note != "" {
		elements = append(elements,
			map[string]interface{}{"tag": "hr"},
			map[string]interface{}{
				"tag": "div",
				"text": map[string]interface{}{
					"content": "📝 **备注**：" + note,
					"tag":     "lark_md",
				},
			},
		)
	}

	elements = append(elements,
		map[string]interface{}{"tag": "hr"},
		map[string]interface{}{
			"tag": "note",
			"elements": []map[string]interface{}{
				{
					"tag":     "plain_text",
					"content": "来自：" + card.Sender + "  ·  " + card.Timestamp.Format("2006-01-02 15:04"),
				},
			},
		},
	)

	if card.DetailURL != "" {
		elements = append(elements, map[string]interface{}{
			"tag": "action",
			"actions": []map[string]interface{}{
				{
					"tag": "button",
					"text": map[string]interface{}{
						"tag":     "plain_text",
						"content": "🔗 查看完整对话",
					},
					"type": "primary",
					"url":  card.DetailURL,
				},
			},
		})
	}

	title := card.Title
	if title == "" {
		title = "📤 EnjoySA AI 分享"
	}

	return map[string]interface{}{
		"msg_type": "interactive",
		"card": map[string]interface{}{
			"config": map[string]interface{}{
				"wide_screen_mode": true,
			},
			"header": map[string]interface{}{
				"title": map[string]interface{}{
					"tag":     "plain_text",
					"content": title,
				},
				"template": "blue",
			},
			"elements": elements,
		},
	}
}
