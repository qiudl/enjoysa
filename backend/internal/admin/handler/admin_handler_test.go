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
