package tools

import (
	"strings"
	"testing"
)

// REQ-20260506-0017: extend the three-layer guard standard (REQ-0003) to all
// admin write tools. The description text on every action-category tool is
// the second of three guard layers (prompt + tool desc + handler dedupe). It
// is the only signal the LLM sees per-tool, so silently dropping the
// explicit-consent / single-turn warnings would re-open the 0003 bug class.

func TestApproveProductDescription_HasIntentAndDedupGuards(t *testing.T) {
	tool := RegisterApproveProduct()

	mustContain := []string{
		"显式",
		"同意",
		"写操作",
	}
	for _, kw := range mustContain {
		if !strings.Contains(tool.Description, kw) {
			t.Errorf("approve_product description missing guard keyword %q\ndescription: %s", kw, tool.Description)
		}
	}
	assertSingleTurnGuard(t, "approve_product", tool.Description)
}

func TestOfflineProductDescription_HasIntentAndDedupGuards(t *testing.T) {
	tool := RegisterOfflineProduct()

	mustContain := []string{
		"显式",
		"同意",
		"写操作",
		"原因", // offline requires a reason — make sure the description still says so
	}
	for _, kw := range mustContain {
		if !strings.Contains(tool.Description, kw) {
			t.Errorf("offline_product description missing guard keyword %q\ndescription: %s", kw, tool.Description)
		}
	}
	assertSingleTurnGuard(t, "offline_product", tool.Description)
}

// assertSingleTurnGuard checks the description advertises the single-turn
// dedupe contract in at least one common form. Shared with
// supplier_tools_test.go.
func assertSingleTurnGuard(t *testing.T, toolName, description string) {
	t.Helper()
	dedupKeywords := []string{"同一轮", "单轮", "重复"}
	for _, kw := range dedupKeywords {
		if strings.Contains(description, kw) {
			return
		}
	}
	t.Errorf("%s description must mention single-turn dedupe (one of %v)\ndescription: %s", toolName, dedupKeywords, description)
}
