package service

import (
	"strings"
	"testing"

	chatmodel "enjoysa-backend/internal/chat/model"
)

func TestBuildMessages_StructureAndPrefixes(t *testing.T) {
	cs := chatmodel.ChatAgent{
		ID: 1, Name: "客服小南", LLMProvider: "deepseek", LLMModel: "deepseek-chat",
		SystemPrompt: "你是客服小南。",
	}
	tech := chatmodel.ChatAgent{
		ID: 2, Name: "技术阿澳", LLMProvider: "glm", LLMModel: "glm-4-flash",
	}
	ch := chatmodel.ChatChannel{ID: 100, Name: "客服-默认", Description: "默认客服频道"}

	msgs := BuildMessages(PromptContext{
		Owner:        OwnerView{UserID: 7, UserType: "supplier", Name: "Barossa Wines"},
		Channel:      ch,
		GroupMembers: []chatmodel.ChatAgent{tech},
		Responder:    cs,
		History: []HistoryMessage{
			{SenderType: "user", SenderDisplay: "B", Content: "我要退款"},
			{SenderType: "ai", SenderDisplay: "客服小南", Content: "好的"},
		},
		SoftHint: "提示：是否切到 #API-技术？",
	})

	if len(msgs) < 4 {
		t.Fatalf("expected ≥4 messages (system + ctx + 2 history), got %d", len(msgs))
	}
	if msgs[0].Role != "system" || !strings.Contains(msgs[0].Content, "你是客服小南") {
		t.Fatalf("msg[0] should be agent system prompt; got %+v", msgs[0])
	}
	if msgs[1].Role != "system" {
		t.Fatalf("msg[1] should be context block")
	}
	ctxBlock := msgs[1].Content
	for _, want := range []string{
		"Barossa Wines (supplier)",
		"#客服-默认",
		"默认客服频道",
		"技术阿澳",
		"glm-4-flash",   // GroupMembers list shows the *other* member's model
		"提示：是否切到 #API-技术？",
		"群聊规则提醒",
	} {
		if !strings.Contains(ctxBlock, want) {
			t.Errorf("context block missing %q\n%s", want, ctxBlock)
		}
	}

	// History prefixes
	if msgs[2].Role != "user" || !strings.HasPrefix(msgs[2].Content, "[B]") {
		t.Fatalf("history[0] missing user role/prefix: %+v", msgs[2])
	}
	if msgs[3].Role != "assistant" || !strings.HasPrefix(msgs[3].Content, "[客服小南]") {
		t.Fatalf("history[1] missing assistant role/prefix: %+v", msgs[3])
	}
}

func TestBuildMessages_InThread(t *testing.T) {
	cs := chatmodel.ChatAgent{ID: 1, Name: "客服小南", SystemPrompt: "p"}
	parent := chatmodel.ChatMessage{ID: 555}

	msgs := BuildMessages(PromptContext{
		Owner:              OwnerView{UserID: 1, UserType: "user"},
		Channel:            chatmodel.ChatChannel{ID: 100, Name: "退款专题"},
		Responder:          cs,
		InThread:           true,
		ThreadParent:       &parent,
		ThreadParentSender: "客服小南",
	})
	if !strings.Contains(msgs[1].Content, "当前在主题中") || !strings.Contains(msgs[1].Content, "id=555") {
		t.Fatalf("thread context missing: %s", msgs[1].Content)
	}
}

func TestBuildMessages_OmitsSystemWhenAgentPromptEmpty(t *testing.T) {
	a := chatmodel.ChatAgent{ID: 1, Name: "ghost", SystemPrompt: ""}
	msgs := BuildMessages(PromptContext{
		Owner:     OwnerView{UserID: 1, UserType: "user"},
		Channel:   chatmodel.ChatChannel{ID: 1, Name: "x"},
		Responder: a,
	})
	if msgs[0].Role != "system" || !strings.Contains(msgs[0].Content, "运行时上下文") {
		t.Fatalf("when agent prompt empty, msg[0] should be context block; got %+v", msgs[0])
	}
}

func TestBuildMessages_SystemHistoryRowMapsToSystemRole(t *testing.T) {
	a := chatmodel.ChatAgent{ID: 1, Name: "x", SystemPrompt: "p"}
	msgs := BuildMessages(PromptContext{
		Owner:     OwnerView{UserID: 1, UserType: "user"},
		Channel:   chatmodel.ChatChannel{ID: 1, Name: "c"},
		Responder: a,
		History: []HistoryMessage{
			{SenderType: "system", SenderDisplay: "", Content: "[已合并自旧会话 #12 · 创建于 2026-04-01]"},
		},
	})
	last := msgs[len(msgs)-1]
	if last.Role != "system" {
		t.Fatalf("system history row should map to system role; got %s", last.Role)
	}
	if last.Content != "[已合并自旧会话 #12 · 创建于 2026-04-01]" {
		t.Fatalf("content unexpectedly modified: %s", last.Content)
	}
}
