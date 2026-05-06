package tools

import (
	"strings"
	"testing"
)

// REQ-20260506-0017: extend the three-layer guard standard (REQ-0003) to the
// supplier-facing confirm_order action tool.

func TestConfirmOrderDescription_HasIntentAndDedupGuards(t *testing.T) {
	tool := RegisterConfirmOrder()

	mustContain := []string{
		"显式",
		"同意",
		"写操作",
	}
	for _, kw := range mustContain {
		if !strings.Contains(tool.Description, kw) {
			t.Errorf("confirm_order description missing guard keyword %q\ndescription: %s", kw, tool.Description)
		}
	}
	assertSingleTurnGuard(t, "confirm_order", tool.Description)
}
