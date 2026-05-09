package handler

import (
	"testing"

	productmodel "enjoysa-backend/internal/product/model"
)

// REQ-20260509-0019: productDisplayName picks the most useful supplier-facing
// label for a freshly created product. Admins routinely fill only one locale
// and the AI ZH↔EN translation arrives seconds later, so the supplier
// notification body must not render an empty string when the admin happened
// to type only Chinese (or only English).
func TestProductDisplayName_PrefersEnglishWhenBothPresent(t *testing.T) {
	p := &productmodel.Product{NameEn: "Wine Tour", NameZh: "酒庄之旅"}
	if got := productDisplayName(p); got != "Wine Tour" {
		t.Errorf("expected English when both filled, got %q", got)
	}
}

func TestProductDisplayName_FallsBackToChineseWhenEnEmpty(t *testing.T) {
	p := &productmodel.Product{NameEn: "", NameZh: "酒庄之旅"}
	if got := productDisplayName(p); got != "酒庄之旅" {
		t.Errorf("expected Chinese fallback, got %q", got)
	}
}

func TestProductDisplayName_NilProductReturnsEmpty(t *testing.T) {
	if got := productDisplayName(nil); got != "" {
		t.Errorf("expected empty string for nil, got %q", got)
	}
}

// REQ-20260509-0019 PR-B: dedupeUints feeds BatchApprove/Reject so admin
// dispatching the same id twice in a single batch does not double-process
// the product (would generate redundant audit + supplier notifications).
func TestDedupeUints_PreservesFirstSeenOrder(t *testing.T) {
	got := dedupeUints([]uint{3, 1, 2, 1, 3, 4})
	want := []uint{3, 1, 2, 4}
	if len(got) != len(want) {
		t.Fatalf("len mismatch: got %v want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("at index %d: got %d want %d (full got=%v)", i, got[i], want[i], got)
		}
	}
}

func TestDedupeUints_EmptyInput(t *testing.T) {
	got := dedupeUints(nil)
	if len(got) != 0 {
		t.Errorf("expected empty for nil input, got %v", got)
	}
}

func TestDedupeUints_NoDuplicatesIsIdentity(t *testing.T) {
	in := []uint{5, 7, 11, 13}
	got := dedupeUints(in)
	if len(got) != len(in) {
		t.Fatalf("len changed: got %v in %v", got, in)
	}
	for i := range in {
		if got[i] != in[i] {
			t.Errorf("at %d: got %d in %d", i, got[i], in[i])
		}
	}
}

// batchProductOpsCap is the documented upper bound for batch endpoints.
// If anyone bumps it, force a conscious code review by failing this test.
func TestBatchProductOpsCap_LockedAt50(t *testing.T) {
	if batchProductOpsCap != 50 {
		t.Errorf("batch cap changed from documented 50 to %d — update PRD AC13 + adminService too",
			batchProductOpsCap)
	}
}
