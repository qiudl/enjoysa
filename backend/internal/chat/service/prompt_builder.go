// REQ-20260509-0037 dev-4: prompt context injection.
//
// Every LLM call adds a system message *after* the agent.system_prompt that
// describes the runtime context (workspace, channel, thread, group members,
// soft hint). History is then re-emitted with [name] prefixes so the LLM
// knows who said what (defect-analysis section 3 — agent inter-awareness).
package service

import (
	"fmt"
	"strings"

	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/llmprovider"
)

// PromptContext is everything the prompt builder needs at inject time.
type PromptContext struct {
	Owner   OwnerView
	Channel chatmodel.ChatChannel

	GroupMembers []chatmodel.ChatAgent // every agent currently in the channel (excluding the responder)
	OtherChannels []chatmodel.ChatChannel

	Responder       chatmodel.ChatAgent
	InThread        bool
	ThreadParent    *chatmodel.ChatMessage // present when InThread; used for context line
	ThreadParentSender string              // resolved name for the thread parent's author

	History []HistoryMessage // chronological; user + agent messages
	SoftHint string          // optional, surfaced to the responder so it can proactively suggest channel switch
}

// OwnerView is the workspace owner identity, lifted into context.
type OwnerView struct {
	UserID   uint
	UserType string // user | supplier | admin
	Name     string // best-effort display name (supplier name, admin name, etc)
}

// HistoryMessage carries one history row in the form the LLM consumes.
type HistoryMessage struct {
	SenderType    string // user | ai | human | system
	SenderDisplay string // "客服小南" / "B" / "[已合并自旧会话 #12...]"
	Content       string
}

// BuildMessages turns a PromptContext into the []llmprovider.Message slice
// to pass to LLMProvider.ChatStream / ChatJSON.
func BuildMessages(ctx PromptContext) []llmprovider.Message {
	out := make([]llmprovider.Message, 0, 2+len(ctx.History))

	// 1. The agent's own system prompt.
	if sp := strings.TrimSpace(ctx.Responder.SystemPrompt); sp != "" {
		out = append(out, llmprovider.Message{Role: "system", Content: sp})
	}

	// 2. Per-turn context block.
	out = append(out, llmprovider.Message{
		Role:    "system",
		Content: buildContextBlock(ctx),
	})

	// 3. Re-emit history with [name] prefix so the LLM sees who said what.
	for _, h := range ctx.History {
		role := "assistant"
		if h.SenderType == "user" || h.SenderType == "human" {
			role = "user"
		} else if h.SenderType == "system" {
			role = "system"
		}
		// For agent-to-agent visibility, prefix every message with [name].
		// We skip the prefix for our own most recent messages so the LLM
		// reads them as plain assistant turns; but for cross-agent / user
		// context we keep the prefix.
		content := h.Content
		if h.SenderDisplay != "" {
			content = "[" + h.SenderDisplay + "] " + h.Content
		}
		out = append(out, llmprovider.Message{Role: role, Content: content})
	}

	return out
}

// buildContextBlock generates the per-turn injection (workspace + channel +
// thread + group members + soft hint).
func buildContextBlock(ctx PromptContext) string {
	var b strings.Builder
	b.WriteString("【运行时上下文 — 仅你可见】\n")

	if ctx.Owner.Name != "" {
		fmt.Fprintf(&b, "工作区所有者: %s (%s)\n", ctx.Owner.Name, ctx.Owner.UserType)
	} else {
		fmt.Fprintf(&b, "工作区所有者: %s #%d\n", ctx.Owner.UserType, ctx.Owner.UserID)
	}

	fmt.Fprintf(&b, "当前频道: #%s", ctx.Channel.Name)
	if ctx.Channel.Description != "" {
		fmt.Fprintf(&b, " — %s", ctx.Channel.Description)
	}
	b.WriteByte('\n')

	if ctx.InThread && ctx.ThreadParent != nil {
		who := ctx.ThreadParentSender
		if who == "" {
			who = "未知"
		}
		fmt.Fprintf(&b, "当前在主题中（父消息 id=%d，由 [%s] 发出）\n", ctx.ThreadParent.ID, who)
	}

	if len(ctx.GroupMembers) > 0 {
		b.WriteString("本频道其他成员:\n")
		for _, m := range ctx.GroupMembers {
			fmt.Fprintf(&b, "  - %s（%s, model=%s）\n", m.Name, m.LLMProvider, m.LLMModel)
		}
	}

	if len(ctx.OtherChannels) > 0 {
		b.WriteString("可用频道（用户可切换）:\n")
		for _, c := range ctx.OtherChannels {
			if c.ID == ctx.Channel.ID || c.Archived {
				continue
			}
			fmt.Fprintf(&b, "  - #%s\n", c.Name)
		}
	}

	if ctx.SoftHint != "" {
		fmt.Fprintf(&b, "\n%s\n", ctx.SoftHint)
	}

	b.WriteString("\n【群聊规则提醒】\n")
	b.WriteString("1. 历史消息以 [发言人] 前缀区分发言人。看到其他 agent 已答的不要重复，可补充或承上。\n")
	b.WriteString("2. 用户 @ 你的消息必答；不在你专长范围的请主动建议 \"@另一个 agent\" 或 \"切到 #其他频道\"。\n")
	b.WriteString("3. 主题内回复继承父消息上下文，不要重复频道寒暄。\n")

	return b.String()
}
