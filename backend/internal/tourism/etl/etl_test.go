package etl

import (
	"testing"

	productmodel "enjoysa-backend/internal/product/model"
	tourismmodel "enjoysa-backend/internal/tourism/model"
)

// REQ-20260510-0002 · 1E · etl_test.go
//
// Unit tests for the pure helpers. The DB-touching paths (upsertExperience,
// upsertBenchmark, Run) are integration-shaped — they need a live Postgres
// to exercise the UNIQUE constraint and the IsActive-preservation path,
// and we already have a fake-runner test on the handler side. The pure
// helpers below are where the bugs hide (off-by-one quantiles, wrong
// duration bucket for "1 day" vs "2 days", Chinese rune truncation), so
// that's where the unit suite spends its budget.

// ---- DurationBucketFromText ------------------------------------------------

func TestDurationBucketFromText(t *testing.T) {
	cases := []struct {
		raw  string
		want string
	}{
		{"3 hours", tourismmodel.DurationBucketHalfDay},
		{"4 hours", tourismmodel.DurationBucketHalfDay},
		{"5 hours", tourismmodel.DurationBucketFullDay},
		{"8 hours", tourismmodel.DurationBucketFullDay},
		{"Half day", tourismmodel.DurationBucketHalfDay},
		{"half-day", tourismmodel.DurationBucketHalfDay},
		{"Full day", tourismmodel.DurationBucketFullDay},
		{"All day tour", tourismmodel.DurationBucketFullDay},
		{"1 day", tourismmodel.DurationBucketFullDay},
		{"2 days", tourismmodel.DurationBucketMultiDay},
		{"3 Days", tourismmodel.DurationBucketMultiDay},
		{"Overnight cruise", tourismmodel.DurationBucketMultiDay},
		{"Multi-day", tourismmodel.DurationBucketMultiDay},
		{"Weekend trip", tourismmodel.DurationBucketMultiDay},
		{"", tourismmodel.DurationBucketFullDay}, // empty defaults to full_day
		{"unknown shape", tourismmodel.DurationBucketFullDay},
		{"15 hours", tourismmodel.DurationBucketMultiDay}, // hour-based >12 → multi
	}
	for _, tc := range cases {
		t.Run(tc.raw, func(t *testing.T) {
			if got := DurationBucketFromText(tc.raw); got != tc.want {
				t.Errorf("DurationBucketFromText(%q) = %q want %q", tc.raw, got, tc.want)
			}
		})
	}
}

// ---- DurationMinutesFromText -----------------------------------------------

func TestDurationMinutesFromText(t *testing.T) {
	cases := []struct {
		raw   string
		want  int
		isNil bool
	}{
		{"3 hours", 180, false},
		{"4 hr", 240, false},
		{"Half day", 240, false},
		{"Full day", 480, false},
		{"all day", 480, false},
		{"1 day", 480, false},
		{"", 0, true},
		{"unknown", 0, true},
	}
	for _, tc := range cases {
		t.Run(tc.raw, func(t *testing.T) {
			got := DurationMinutesFromText(tc.raw)
			if tc.isNil {
				if got != nil {
					t.Errorf("expected nil, got %v", *got)
				}
				return
			}
			if got == nil {
				t.Fatalf("expected %d, got nil", tc.want)
			}
			if *got != tc.want {
				t.Errorf("got %d want %d", *got, tc.want)
			}
		})
	}
}

// ---- parseLeadingHours -----------------------------------------------------

func TestParseLeadingHours(t *testing.T) {
	cases := []struct {
		raw  string
		want int
	}{
		{"3 hours", 3},
		{"4hr", 4},
		{"2h tour", 2},
		{"about 6 hours", 6},
		{"30 minutes", 0}, // no h-prefix → 0 (caller falls back)
		{"day trip", 0},
		{"", 0},
	}
	for _, tc := range cases {
		t.Run(tc.raw, func(t *testing.T) {
			if got := parseLeadingHours(tc.raw); got != tc.want {
				t.Errorf("parseLeadingHours(%q)=%d want %d", tc.raw, got, tc.want)
			}
		})
	}
}

// ---- priceRangeFromPackages ------------------------------------------------

func TestPriceRangeFromPackages_PicksMinAndMax(t *testing.T) {
	pkgs := []productmodel.ProductPackage{
		{Price: 90}, {Price: 120}, {Price: 75}, {Price: 200},
	}
	minV, maxV := priceRangeFromPackages(pkgs, 0)
	if minV == nil || *minV != 75 {
		t.Errorf("min: got %v want 75", minV)
	}
	if maxV == nil || *maxV != 200 {
		t.Errorf("max: got %v want 200", maxV)
	}
}

func TestPriceRangeFromPackages_FallsBackToProductPrice(t *testing.T) {
	minV, maxV := priceRangeFromPackages(nil, 88)
	if minV == nil || maxV == nil || *minV != 88 || *maxV != 88 {
		t.Errorf("expected 88/88 from fallback, got %v/%v", minV, maxV)
	}
}

func TestPriceRangeFromPackages_NoSignalReturnsNil(t *testing.T) {
	minV, maxV := priceRangeFromPackages(nil, 0)
	if minV != nil || maxV != nil {
		t.Errorf("expected nil/nil, got %v/%v", minV, maxV)
	}
}

func TestPriceRangeFromPackages_IgnoresZeroPricePackages(t *testing.T) {
	pkgs := []productmodel.ProductPackage{
		{Price: 0}, {Price: 100}, {Price: 0},
	}
	minV, maxV := priceRangeFromPackages(pkgs, 50)
	if minV == nil || *minV != 100 || maxV == nil || *maxV != 100 {
		t.Errorf("expected 100/100, got %v/%v", minV, maxV)
	}
}

// ---- priceQuantiles --------------------------------------------------------

func TestPriceQuantiles_BasicRange(t *testing.T) {
	prices := []float64{10, 20, 30, 40, 50, 60, 70, 80, 90}
	median, p25, p75 := priceQuantiles(prices)
	if median != 50 {
		t.Errorf("median: got %v want 50", median)
	}
	// p25 with R-2 (linear interp): pos = 0.25 * 8 = 2 → sorted[2] = 30
	if p25 != 30 {
		t.Errorf("p25: got %v want 30", p25)
	}
	// p75 with R-2: pos = 0.75 * 8 = 6 → sorted[6] = 70
	if p75 != 70 {
		t.Errorf("p75: got %v want 70", p75)
	}
}

func TestPriceQuantiles_SingleSample(t *testing.T) {
	median, p25, p75 := priceQuantiles([]float64{99})
	if median != 99 || p25 != 99 || p75 != 99 {
		t.Errorf("single sample should hit all three: got %v/%v/%v", median, p25, p75)
	}
}

func TestPriceQuantiles_Interpolates(t *testing.T) {
	// Two-element case: median pos = 0.5 → 0.5 between [10,20] = 15
	median, _, _ := priceQuantiles([]float64{10, 20})
	if median != 15 {
		t.Errorf("median of [10,20] = %v want 15", median)
	}
}

func TestPriceQuantiles_EmptySliceSafe(t *testing.T) {
	median, p25, p75 := priceQuantiles(nil)
	if median != 0 || p25 != 0 || p75 != 0 {
		t.Errorf("empty input should be 0/0/0, got %v/%v/%v", median, p25, p75)
	}
}

// ---- truncateRunes (Unicode-safe) ------------------------------------------

func TestTruncateRunes_HandlesChineseCorrectly(t *testing.T) {
	s := "南澳袋鼠岛半日游"          // 8 runes, 24 bytes
	got := truncateRunes(s, 4)
	want := "南澳袋鼠"
	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
}

func TestTruncateRunes_ShortPassthrough(t *testing.T) {
	if got := truncateRunes("abc", 100); got != "abc" {
		t.Errorf("short string should pass through, got %q", got)
	}
}

func TestTruncateRunes_NonPositiveLimitReturnsEmpty(t *testing.T) {
	if got := truncateRunes("abc", 0); got != "" {
		t.Errorf("zero limit should return empty, got %q", got)
	}
	if got := truncateRunes("abc", -5); got != "" {
		t.Errorf("negative limit should return empty, got %q", got)
	}
}
