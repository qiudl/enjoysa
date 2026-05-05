package service

import (
	"strings"
	"testing"

	aichatmodel "enjoysa-backend/internal/aichat/model"
)

// REQ-20260506-0003: prompt must guard write tools behind explicit user
// intent and not encourage proactive create_requirement calls.
func TestSystemPrompt_SupplierZh_GuardsWriteTools(t *testing.T) {
	prompt := SystemPrompt("zh", "", &aichatmodel.ChatUser{
		UserType: "supplier",
		Name:     "测试供应商",
	})

	mustContain := []string{
		"显式",
		"create_requirement",
		"不是创建信号",
		"是否需要我帮你创建",
		"服务端会拒绝",
	}
	for _, kw := range mustContain {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier zh prompt missing intent-guard keyword %q\nprompt:\n%s", kw, prompt)
		}
	}

	if strings.Contains(prompt, "create_requirement 和 list_requirements 工具可以操作 ai-proj 需求系统，积极使用它们") {
		t.Error("supplier zh prompt still contains the old aggressive instruction for create_requirement")
	}
}

func TestSystemPrompt_SupplierEn_GuardsWriteTools(t *testing.T) {
	prompt := SystemPrompt("en", "", &aichatmodel.ChatUser{
		UserType: "supplier",
		Name:     "Test Supplier",
	})

	mustContain := []string{
		"WRITE tool",
		"create_requirement",
		"explicitly",
		"NOT by itself a creation signal",
		"server will reject",
	}
	for _, kw := range mustContain {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier en prompt missing intent-guard keyword %q\nprompt:\n%s", kw, prompt)
		}
	}

	if strings.Contains(prompt, "create_requirement and list_requirements tools to manage the ai-proj system — use them proactively") {
		t.Error("supplier en prompt still contains the old aggressive instruction for create_requirement")
	}
}
