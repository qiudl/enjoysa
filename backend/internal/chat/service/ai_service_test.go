package service

import (
	"strings"
	"testing"

	aichatmodel "enjoysa-backend/internal/aichat/model"
)

// REQ-20260506-0003 + REQ-20260506-0052: the supplier prompt is the first
// (and most influential) of three guard layers. It must (a) gate write tools
// behind explicit user intent, (b) tell the LLM to call create_requirement
// directly on explicit triggers without pre-searching, (c) carry few-shot
// examples that anchor the right behaviour. Drop any of these and the LLM
// silently regresses to plain-text "I'll create..." or to defensive
// list_requirements pre-checks that loop forever on weird upstream responses.
func TestSystemPrompt_SupplierZh_GuardsWriteTools(t *testing.T) {
	prompt := SystemPrompt("zh", "", &aichatmodel.ChatUser{
		UserType: "supplier",
		Name:     "测试供应商",
	})

	// Layer 1: explicit-intent gating preserved from REQ-0003 / REQ-0052.
	// REQ-20260506-0052 (round 2): rule 4 reworded — "明确表示创建意图" replaces
	// "显式同意"; "虚假创建" replaces "不是创建信号".
	// REQ-20260509-0024: rule 6 reworded from "server rejects duplicates" to
	// topic-based dedupe semantics — sentinel "服务端按标题相似度做 dedup" must be
	// present so the LLM understands it can call multiple distinct creates
	// in one turn while still respecting same-topic dedupe.
	intentGuards := []string{
		"明确表示创建意图",
		"create_requirement",
		"虚假创建",
		"服务端按标题相似度做 dedup", // REQ-0024: replaces old "服务端会拒绝"
	}
	for _, kw := range intentGuards {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier zh prompt missing intent-guard keyword %q", kw)
		}
	}

	// REQ-0052 add-ons: must explicitly cover the "创建需求" trigger word and
	// must explicitly ban pre-search defence so the LLM does not loop on a
	// list_requirements response it cannot interpret.
	createTriggers := []string{"创建需求", "提需求"}
	for _, kw := range createTriggers {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier zh prompt missing create-trigger %q (REQ-0052)", kw)
		}
	}

	// rule 5/6 still bans pre-search defence (kept "预查重" via 反向用例 + rule 6).
	antiPreSearch := []string{"反向用例", "list_requirements"}
	for _, kw := range antiPreSearch {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier zh prompt must explicitly ban LLM-side pre-search; missing %q", kw)
		}
	}

	// few-shot block must exist so the LLM has concrete behaviour anchors.
	if !strings.Contains(prompt, "few-shot") {
		t.Error("supplier zh prompt must include a few-shot block (REQ-0052)")
	}
	if !strings.Contains(prompt, "立刻 create_requirement") {
		t.Error("supplier zh few-shot must show an immediate create_requirement example")
	}
	if !strings.Contains(prompt, "不要先调 list_requirements") {
		t.Error("supplier zh few-shot must explicitly call out the no-pre-search anti-pattern")
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

	// REQ-20260506-0052 (round 2): rule 4 reworded — "Write tools" replaces
	// "WRITE tool"; "fake creation" replaces "NOT by itself a creation signal".
	// REQ-20260509-0024: dedupe semantic switched from per-call to per-topic;
	// sentinel "server dedupes by title similarity" must be present so the LLM
	// allows multiple distinct creates in one turn.
	intentGuards := []string{
		"Write tools",
		"create_requirement",
		"explicitly",
		"fake creation",
		"server dedupes by title similarity", // REQ-0024: replaces old "server rejects"
	}
	for _, kw := range intentGuards {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier en prompt missing intent-guard keyword %q", kw)
		}
	}

	createTriggers := []string{"create a requirement", "file an issue"}
	for _, kw := range createTriggers {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier en prompt missing create-trigger %q (REQ-0052)", kw)
		}
	}

	// rule 5 still bans pre-search defence (REVERSE CASES). REQ-0024 dropped
	// the "second line of defence" wording when rule 6 was rewritten — the
	// REVERSE CASES table now carries the no-list-requirements-pre-check rule.
	antiPreSearch := []string{"REVERSE CASES"}
	for _, kw := range antiPreSearch {
		if !strings.Contains(prompt, kw) {
			t.Errorf("supplier en prompt must ban LLM-side pre-search; missing %q", kw)
		}
	}

	if !strings.Contains(prompt, "Few-shot") {
		t.Error("supplier en prompt must include a Few-shot block (REQ-0052)")
	}
	if !strings.Contains(prompt, "Immediately create_requirement") {
		t.Error("supplier en few-shot must show an immediate create_requirement example")
	}
	if !strings.Contains(prompt, "Do NOT call list_requirements first") {
		t.Error("supplier en few-shot must explicitly call out the no-pre-search anti-pattern")
	}

	if strings.Contains(prompt, "create_requirement and list_requirements tools to manage the ai-proj system — use them proactively") {
		t.Error("supplier en prompt still contains the old aggressive instruction for create_requirement")
	}
}
