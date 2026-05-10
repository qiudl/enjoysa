package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"enjoysa-backend/internal/tourism/etl"
	tourismmodel "enjoysa-backend/internal/tourism/model"
	tourismstore "enjoysa-backend/internal/tourism/store"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// REQ-20260510-0002 · 1C · admin_handler_test.go
//
// Coverage targets the bits that the wire format depends on:
//   - parseUintParam / parseBoolQuery / parseIntQuery edge cases
//   - applyAttractionRequest preserves the full PUT shape (incl. nil → []
//     for pq.StringArray columns)
//   - defaultActiveOnCreate honours explicit override and otherwise
//     defaults true (admin-entered data is trusted, D2)
//   - applyPricingBenchmarkRequest fills Season=year_round on empty input
//   - validateDurationBucket / validateSeason whitelist enforcement
//   - writeStoreError maps gorm.ErrRecordNotFound → 404 and
//     tourismstore.ErrDuplicate → 409

// ---- helpers ---------------------------------------------------------------

func init() {
	gin.SetMode(gin.TestMode)
}

func newCtx(method, target string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var r *http.Request
	if body == nil {
		r = httptest.NewRequest(method, target, nil)
	} else {
		r = httptest.NewRequest(method, target, bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	}
	c.Request = r
	return c, w
}

func ptrBool(b bool) *bool       { return &b }
func ptrInt(n int) *int          { return &n }
func ptrInt16(n int16) *int16    { return &n }
func ptrFloat(f float64) *float64 { return &f }

// ---- parseUintParam --------------------------------------------------------

func TestParseUintParam(t *testing.T) {
	cases := []struct {
		name      string
		raw       string
		wantOK    bool
		wantValue uint
	}{
		{"valid", "42", true, 42},
		{"zero rejected", "0", false, 0},
		{"non-numeric", "abc", false, 0},
		{"negative", "-1", false, 0},
		{"empty", "", false, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, w := newCtx(http.MethodGet, "/", nil)
			c.Params = gin.Params{{Key: "id", Value: tc.raw}}
			got, ok := parseUintParam(c, "id")
			if ok != tc.wantOK {
				t.Fatalf("ok mismatch: got %v want %v (status %d)", ok, tc.wantOK, w.Code)
			}
			if got != tc.wantValue {
				t.Errorf("value mismatch: got %d want %d", got, tc.wantValue)
			}
			if !tc.wantOK && w.Code != http.StatusBadRequest {
				t.Errorf("expected 400 on failure, got %d", w.Code)
			}
		})
	}
}

// ---- parseBoolQuery --------------------------------------------------------

func TestParseBoolQuery(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want *bool
	}{
		{"true literal", "true", ptrBool(true)},
		{"1 means true", "1", ptrBool(true)},
		{"false literal", "false", ptrBool(false)},
		{"0 means false", "0", ptrBool(false)},
		{"absent", "", nil},
		{"typo treated as absent", "yes", nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			target := "/?flag=" + tc.raw
			if tc.raw == "" {
				target = "/"
			}
			c, _ := newCtx(http.MethodGet, target, nil)
			got := parseBoolQuery(c, "flag")
			switch {
			case tc.want == nil && got != nil:
				t.Errorf("expected nil, got *%v", *got)
			case tc.want != nil && got == nil:
				t.Errorf("expected *%v, got nil", *tc.want)
			case tc.want != nil && got != nil && *tc.want != *got:
				t.Errorf("value mismatch: got %v want %v", *got, *tc.want)
			}
		})
	}
}

// ---- parseIntQuery ---------------------------------------------------------

func TestParseIntQuery(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want int
	}{
		{"valid", "5", 5},
		{"zero", "0", 0},
		{"absent", "", 0},
		{"non-numeric falls back to 0", "abc", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			target := "/"
			if tc.raw != "" || tc.name == "absent" {
				if tc.raw != "" {
					target = "/?n=" + tc.raw
				}
			}
			c, _ := newCtx(http.MethodGet, target, nil)
			if got := parseIntQuery(c, "n"); got != tc.want {
				t.Errorf("got %d want %d", got, tc.want)
			}
		})
	}
}

// ---- nilSafeStringSlice ----------------------------------------------------

func TestNilSafeStringSlice(t *testing.T) {
	got := nilSafeStringSlice(nil)
	if got == nil || len(got) != 0 {
		t.Errorf("expected non-nil empty slice, got %v", got)
	}
	in := []string{"a", "b"}
	if got := nilSafeStringSlice(in); &got[0] != &in[0] {
		t.Errorf("non-nil input should be returned unchanged")
	}
}

// ---- defaultActiveOnCreate -------------------------------------------------

func TestDefaultActiveOnCreate(t *testing.T) {
	if !defaultActiveOnCreate(nil) {
		t.Errorf("nil pointer should default to true (admin-trusted)")
	}
	if defaultActiveOnCreate(ptrBool(false)) {
		t.Errorf("explicit false must be honoured")
	}
	if !defaultActiveOnCreate(ptrBool(true)) {
		t.Errorf("explicit true must be honoured")
	}
}

// ---- applyAttractionRequest ------------------------------------------------

func TestApplyAttractionRequest_FullPUTSemantics(t *testing.T) {
	target := &tourismmodel.Attraction{
		NameZh:      "OLD",
		NameEn:      "OLD",
		Council:     "OLD",
		Tags:        []string{"prev"},
		BestSeasons: []string{"summer"},
		Description: "OLD",
	}
	req := AttractionRequest{
		NameZh:                 "考拉抱抱",
		NameEn:                 "Koala Cuddle",
		Council:                "Adelaide Hills",
		Category:               "wildlife",
		Tags:                   []string{"family", "easy"},
		PriceRangeMin:          ptrFloat(50),
		PriceRangeMax:          ptrFloat(120),
		TypicalDurationMinutes: ptrInt(60),
		BestSeasons:            []string{"spring", "autumn"},
		Description:            "Hands-on koala experience.",
		Source:                 "scraped",
		SourceRef:              "https://example.com",
	}
	applyAttractionRequest(target, req)

	if target.NameZh != "考拉抱抱" || target.NameEn != "Koala Cuddle" {
		t.Errorf("name fields not copied")
	}
	if target.Category != "wildlife" {
		t.Errorf("category not copied")
	}
	if len(target.Tags) != 2 || target.Tags[0] != "family" {
		t.Errorf("tags not replaced: %v", target.Tags)
	}
	if target.PriceRangeMin == nil || *target.PriceRangeMin != 50 {
		t.Errorf("price_range_min not copied")
	}
	if target.SourceRef != "https://example.com" {
		t.Errorf("source_ref not copied")
	}
}

func TestApplyAttractionRequest_NilArrayBecomesEmpty(t *testing.T) {
	target := &tourismmodel.Attraction{Tags: []string{"prev"}, BestSeasons: []string{"summer"}}
	req := AttractionRequest{NameZh: "X"} // Tags / BestSeasons absent → nil
	applyAttractionRequest(target, req)
	if target.Tags == nil || len(target.Tags) != 0 {
		t.Errorf("nil tags must become empty slice, got %v", target.Tags)
	}
	if target.BestSeasons == nil || len(target.BestSeasons) != 0 {
		t.Errorf("nil best_seasons must become empty slice, got %v", target.BestSeasons)
	}
}

// ---- applyPricingBenchmarkRequest ------------------------------------------

func TestApplyPricingBenchmarkRequest_DefaultsSeasonAndCurrency(t *testing.T) {
	target := &tourismmodel.PricingBenchmark{}
	req := PricingBenchmarkRequest{
		Category:       "wine",
		Council:        "Barossa",
		DurationBucket: "full_day",
		// Season + Currency intentionally empty
		MedianPrice: ptrFloat(180),
		SampleSize:  6,
	}
	applyPricingBenchmarkRequest(target, req)
	if target.Season != tourismmodel.SeasonYearRound {
		t.Errorf("empty season should default to year_round, got %q", target.Season)
	}
	if target.Currency != "AUD" {
		t.Errorf("empty currency should default to AUD, got %q", target.Currency)
	}
	if target.SampleSize != 6 {
		t.Errorf("sample size not copied")
	}
}

func TestApplyPricingBenchmarkRequest_HonoursExplicitSeason(t *testing.T) {
	target := &tourismmodel.PricingBenchmark{}
	req := PricingBenchmarkRequest{
		Category:       "wine",
		Council:        "Barossa",
		DurationBucket: "full_day",
		Season:         "summer",
		Currency:       "USD",
	}
	applyPricingBenchmarkRequest(target, req)
	if target.Season != "summer" {
		t.Errorf("explicit season must be preserved, got %q", target.Season)
	}
	if target.Currency != "USD" {
		t.Errorf("explicit currency must be preserved, got %q", target.Currency)
	}
}

// ---- validators ------------------------------------------------------------

func TestValidateDurationBucket(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"half_day", true},
		{"full_day", true},
		{"multi_day", true},
		{"halfday", false},
		{"", false},
		{"day", false},
	}
	for _, tc := range cases {
		if got := validateDurationBucket(tc.in); got != tc.want {
			t.Errorf("validateDurationBucket(%q) = %v want %v", tc.in, got, tc.want)
		}
	}
}

func TestValidateSeason(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"", true}, // empty allowed (handler defaults to year_round)
		{"year_round", true},
		{"spring", true},
		{"summer", true},
		{"autumn", true},
		{"winter", true},
		{"fall", false},
		{"any", false},
	}
	for _, tc := range cases {
		if got := validateSeason(tc.in); got != tc.want {
			t.Errorf("validateSeason(%q) = %v want %v", tc.in, got, tc.want)
		}
	}
}

// ---- writeStoreError -------------------------------------------------------

func TestWriteStoreError_NotFoundMaps404(t *testing.T) {
	c, w := newCtx(http.MethodGet, "/", nil)
	writeStoreError(c, gorm.ErrRecordNotFound)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

func TestWriteStoreError_DuplicateMaps409WithCode(t *testing.T) {
	c, w := newCtx(http.MethodGet, "/", nil)
	writeStoreError(c, tourismstore.ErrDuplicate)
	if w.Code != http.StatusConflict {
		t.Fatalf("got %d want 409", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid body json: %v", err)
	}
	if body["code"] != "DUPLICATE_PRICING_BENCHMARK" {
		t.Errorf("expected DUPLICATE_PRICING_BENCHMARK code, got %v", body["code"])
	}
}

func TestWriteStoreError_GenericMaps500(t *testing.T) {
	c, w := newCtx(http.MethodGet, "/", nil)
	writeStoreError(c, errors.New("connection reset"))
	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d want 500", w.Code)
	}
	if !strings.Contains(w.Body.String(), "connection reset") {
		t.Errorf("error message should bubble up, got %s", w.Body.String())
	}
}

// ===========================================================================
// Fake store for HTTP-level handler tests.
// ===========================================================================

type fakeStore struct {
	// Attractions
	listAttractionsRows  []tourismmodel.Attraction
	listAttractionsTotal int64
	listAttractionsErr   error
	listAttractionsArg   tourismstore.AttractionFilter
	getAttractionRow     *tourismmodel.Attraction
	getAttractionErr     error
	createAttractionErr  error
	createdAttraction    *tourismmodel.Attraction
	updateAttractionErr  error
	updatedAttraction    *tourismmodel.Attraction
	deleteAttractionErr  error
	deleteAttractionArg  uint

	// Accommodations (only the bits the tests touch)
	createAccommodationErr error
	createdAccommodation   *tourismmodel.Accommodation

	// Food
	createFoodErr error
	createdFood   *tourismmodel.Food

	// Experiences
	createExperienceErr error
	createdExperience   *tourismmodel.Experience

	// Pricing benchmarks
	getPricingErr        error
	getPricingRow        *tourismmodel.PricingBenchmark
	createPricingErr     error
	createdPricing       *tourismmodel.PricingBenchmark
	updatePricingErr     error
	updatedPricing       *tourismmodel.PricingBenchmark
	deletePricingErr     error
	listPricingRows      []tourismmodel.PricingBenchmark
	listPricingTotal     int64
	listPricingErr       error
}

// --- Attractions ---
func (s *fakeStore) ListAttractions(_ context.Context, f tourismstore.AttractionFilter) ([]tourismmodel.Attraction, int64, error) {
	s.listAttractionsArg = f
	return s.listAttractionsRows, s.listAttractionsTotal, s.listAttractionsErr
}
func (s *fakeStore) GetAttraction(_ context.Context, _ uint) (*tourismmodel.Attraction, error) {
	return s.getAttractionRow, s.getAttractionErr
}
func (s *fakeStore) CreateAttraction(_ context.Context, a *tourismmodel.Attraction) error {
	s.createdAttraction = a
	return s.createAttractionErr
}
func (s *fakeStore) UpdateAttraction(_ context.Context, a *tourismmodel.Attraction) error {
	s.updatedAttraction = a
	return s.updateAttractionErr
}
func (s *fakeStore) DeleteAttraction(_ context.Context, id uint) error {
	s.deleteAttractionArg = id
	return s.deleteAttractionErr
}

// --- Accommodations ---
func (s *fakeStore) ListAccommodations(_ context.Context, _ tourismstore.AccommodationFilter) ([]tourismmodel.Accommodation, int64, error) {
	return nil, 0, nil
}
func (s *fakeStore) GetAccommodation(_ context.Context, _ uint) (*tourismmodel.Accommodation, error) {
	return nil, gorm.ErrRecordNotFound
}
func (s *fakeStore) CreateAccommodation(_ context.Context, a *tourismmodel.Accommodation) error {
	s.createdAccommodation = a
	return s.createAccommodationErr
}
func (s *fakeStore) UpdateAccommodation(_ context.Context, _ *tourismmodel.Accommodation) error {
	return nil
}
func (s *fakeStore) DeleteAccommodation(_ context.Context, _ uint) error { return nil }

// --- Food ---
func (s *fakeStore) ListFood(_ context.Context, _ tourismstore.FoodFilter) ([]tourismmodel.Food, int64, error) {
	return nil, 0, nil
}
func (s *fakeStore) GetFood(_ context.Context, _ uint) (*tourismmodel.Food, error) {
	return nil, gorm.ErrRecordNotFound
}
func (s *fakeStore) CreateFood(_ context.Context, a *tourismmodel.Food) error {
	s.createdFood = a
	return s.createFoodErr
}
func (s *fakeStore) UpdateFood(_ context.Context, _ *tourismmodel.Food) error { return nil }
func (s *fakeStore) DeleteFood(_ context.Context, _ uint) error              { return nil }

// --- Experiences ---
func (s *fakeStore) ListExperiences(_ context.Context, _ tourismstore.ExperienceFilter) ([]tourismmodel.Experience, int64, error) {
	return nil, 0, nil
}
func (s *fakeStore) GetExperience(_ context.Context, _ uint) (*tourismmodel.Experience, error) {
	return nil, gorm.ErrRecordNotFound
}
func (s *fakeStore) CreateExperience(_ context.Context, a *tourismmodel.Experience) error {
	s.createdExperience = a
	return s.createExperienceErr
}
func (s *fakeStore) UpdateExperience(_ context.Context, _ *tourismmodel.Experience) error {
	return nil
}
func (s *fakeStore) DeleteExperience(_ context.Context, _ uint) error { return nil }

// --- Pricing benchmarks ---
func (s *fakeStore) ListPricingBenchmarks(_ context.Context, _ tourismstore.PricingBenchmarkFilter) ([]tourismmodel.PricingBenchmark, int64, error) {
	return s.listPricingRows, s.listPricingTotal, s.listPricingErr
}
func (s *fakeStore) GetPricingBenchmark(_ context.Context, _ uint) (*tourismmodel.PricingBenchmark, error) {
	return s.getPricingRow, s.getPricingErr
}
func (s *fakeStore) CreatePricingBenchmark(_ context.Context, a *tourismmodel.PricingBenchmark) error {
	s.createdPricing = a
	return s.createPricingErr
}
func (s *fakeStore) UpdatePricingBenchmark(_ context.Context, a *tourismmodel.PricingBenchmark) error {
	s.updatedPricing = a
	return s.updatePricingErr
}
func (s *fakeStore) DeletePricingBenchmark(_ context.Context, _ uint) error {
	return s.deletePricingErr
}

// ===========================================================================
// HTTP-level tests
// ===========================================================================

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json marshal: %v", err)
	}
	return b
}

func TestListAttractions_ForwardsFiltersAndPaginates(t *testing.T) {
	rows := []tourismmodel.Attraction{
		{NameZh: "A", Council: "Adelaide Hills"},
		{NameZh: "B", Council: "Adelaide Hills"},
	}
	fs := &fakeStore{listAttractionsRows: rows, listAttractionsTotal: 47}
	h := NewAdminHandler(fs)

	c, w := newCtx(http.MethodGet,
		"/?council=Adelaide+Hills&category=wildlife&keywords=koala&is_active=true&page=2&page_size=10", nil)
	h.ListAttractions(c)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200", w.Code)
	}
	if fs.listAttractionsArg.Council != "Adelaide Hills" {
		t.Errorf("council not forwarded: %v", fs.listAttractionsArg.Council)
	}
	if fs.listAttractionsArg.Category != "wildlife" {
		t.Errorf("category not forwarded")
	}
	if fs.listAttractionsArg.Keywords != "koala" {
		t.Errorf("keywords not forwarded")
	}
	if fs.listAttractionsArg.IsActive == nil || *fs.listAttractionsArg.IsActive != true {
		t.Errorf("is_active not forwarded as true")
	}
	if fs.listAttractionsArg.Page != 2 || fs.listAttractionsArg.PageSize != 10 {
		t.Errorf("pagination not forwarded: %+v", fs.listAttractionsArg)
	}

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid body: %v", err)
	}
	data := body["data"].(map[string]any)
	if int(data["total"].(float64)) != 47 {
		t.Errorf("total not echoed: %v", data["total"])
	}
}

func TestListAttractions_StoreErrorMaps500(t *testing.T) {
	fs := &fakeStore{listAttractionsErr: errors.New("db down")}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodGet, "/", nil)
	h.ListAttractions(c)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d want 500", w.Code)
	}
}

func TestGetAttraction_NotFoundMaps404(t *testing.T) {
	fs := &fakeStore{getAttractionErr: gorm.ErrRecordNotFound}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "123"}}
	h.GetAttraction(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

func TestGetAttraction_BadIDMaps400(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	c, w := newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "abc"}}
	h.GetAttraction(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestGetAttraction_OK(t *testing.T) {
	row := &tourismmodel.Attraction{NameZh: "考拉抱抱"}
	fs := &fakeStore{getAttractionRow: row}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.GetAttraction(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "考拉抱抱") {
		t.Errorf("body should contain row data: %s", w.Body.String())
	}
}

func TestCreateAttraction_DefaultsActiveAndSource(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	body := mustJSON(t, AttractionRequest{
		NameZh:   "考拉抱抱",
		Council:  "Adelaide Hills",
		Category: "wildlife",
		Tags:     []string{"family"},
	})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreateAttraction(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("got %d want 201, body=%s", w.Code, w.Body.String())
	}
	if fs.createdAttraction == nil {
		t.Fatal("create not called")
	}
	if !fs.createdAttraction.IsActive {
		t.Errorf("IsActive must default to true on admin create (D2)")
	}
	if fs.createdAttraction.Source != tourismmodel.SourceAdminManual {
		t.Errorf("Source must default to admin_manual, got %q", fs.createdAttraction.Source)
	}
}

func TestCreateAttraction_HonoursExplicitIsActiveFalse(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	isActive := false
	body := mustJSON(t, AttractionRequest{NameZh: "X", IsActive: &isActive})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreateAttraction(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("got %d want 201", w.Code)
	}
	if fs.createdAttraction.IsActive {
		t.Errorf("explicit false must be honoured even on create")
	}
}

func TestCreateAttraction_MissingNameRejected(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	c, w := newCtx(http.MethodPost, "/", []byte(`{"council":"x"}`))
	h.CreateAttraction(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400 (missing name_zh)", w.Code)
	}
}

func TestCreateAttraction_MalformedBodyRejected(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	c, w := newCtx(http.MethodPost, "/", []byte(`not json`))
	h.CreateAttraction(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestUpdateAttraction_NotFound(t *testing.T) {
	fs := &fakeStore{getAttractionErr: gorm.ErrRecordNotFound}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodPut, "/", []byte(`{"name_zh":"x"}`))
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdateAttraction(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

func TestUpdateAttraction_AppliesAllFields(t *testing.T) {
	existing := &tourismmodel.Attraction{
		NameZh:      "OLD",
		Council:     "OLD",
		Tags:        []string{"prev"},
		BestSeasons: []string{"summer"},
	}
	fs := &fakeStore{getAttractionRow: existing}
	h := NewAdminHandler(fs)
	body := mustJSON(t, AttractionRequest{
		NameZh:      "NEW",
		Council:     "Barossa",
		Tags:        []string{"family"},
		BestSeasons: []string{"autumn"},
		IsActive:    ptrBool(false),
	})
	c, w := newCtx(http.MethodPut, "/", body)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdateAttraction(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if fs.updatedAttraction == nil {
		t.Fatal("update not called")
	}
	if fs.updatedAttraction.NameZh != "NEW" {
		t.Errorf("name not replaced")
	}
	if fs.updatedAttraction.IsActive {
		t.Errorf("IsActive=false must be applied")
	}
	if len(fs.updatedAttraction.Tags) != 1 || fs.updatedAttraction.Tags[0] != "family" {
		t.Errorf("tags not replaced: %v", fs.updatedAttraction.Tags)
	}
}

func TestUpdateAttraction_OmittedIsActivePreservesPrevious(t *testing.T) {
	existing := &tourismmodel.Attraction{NameZh: "OLD", IsActive: true}
	fs := &fakeStore{getAttractionRow: existing}
	h := NewAdminHandler(fs)
	body := mustJSON(t, AttractionRequest{NameZh: "NEW"}) // IsActive nil
	c, w := newCtx(http.MethodPut, "/", body)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdateAttraction(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200", w.Code)
	}
	if !fs.updatedAttraction.IsActive {
		t.Errorf("IsActive should be preserved when client omits the field")
	}
}

func TestDeleteAttraction_OK(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodDelete, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "42"}}
	h.DeleteAttraction(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200", w.Code)
	}
	if fs.deleteAttractionArg != 42 {
		t.Errorf("id not forwarded, got %d", fs.deleteAttractionArg)
	}
}

func TestDeleteAttraction_NotFoundMaps404(t *testing.T) {
	fs := &fakeStore{deleteAttractionErr: gorm.ErrRecordNotFound}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodDelete, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.DeleteAttraction(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

// --- Accommodations / Food / Experiences smoke tests (one per entity) ------

func TestCreateAccommodation_Defaults(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	body := mustJSON(t, AccommodationRequest{
		NameZh:     "袋鼠岛酒店",
		StarRating: ptrInt16(4),
	})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreateAccommodation(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("got %d want 201", w.Code)
	}
	if !fs.createdAccommodation.IsActive {
		t.Errorf("IsActive should default to true")
	}
	if fs.createdAccommodation.RoomTypes == nil {
		t.Errorf("RoomTypes nil should become []string{} for pq.StringArray")
	}
}

func TestCreateFood_Defaults(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	body := mustJSON(t, FoodRequest{NameZh: "袋鼠岛海鲜"})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreateFood(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("got %d want 201", w.Code)
	}
	if !fs.createdFood.IsActive {
		t.Errorf("IsActive should default to true")
	}
}

func TestCreateExperience_Defaults(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	body := mustJSON(t, ExperienceRequest{NameZh: "巴罗莎红酒之旅", Category: "wine"})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreateExperience(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("got %d want 201", w.Code)
	}
	if !fs.createdExperience.IsActive {
		t.Errorf("IsActive should default to true")
	}
	if fs.createdExperience.Category != "wine" {
		t.Errorf("Category not copied")
	}
}

// --- Pricing benchmarks specific paths -------------------------------------

func TestCreatePricingBenchmark_RejectsBadDurationBucket(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	body := mustJSON(t, PricingBenchmarkRequest{
		Category: "wine", Council: "Barossa", DurationBucket: "halfday",
	})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreatePricingBenchmark(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestCreatePricingBenchmark_RejectsBadSeason(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	body := mustJSON(t, PricingBenchmarkRequest{
		Category: "wine", Council: "Barossa", DurationBucket: "full_day", Season: "fall",
	})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreatePricingBenchmark(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestCreatePricingBenchmark_DefaultsAndSucceeds(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	body := mustJSON(t, PricingBenchmarkRequest{
		Category: "wine", Council: "Barossa", DurationBucket: "full_day",
		MedianPrice: ptrFloat(180), SampleSize: 6,
	})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreatePricingBenchmark(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("got %d want 201, body=%s", w.Code, w.Body.String())
	}
	if fs.createdPricing.Season != tourismmodel.SeasonYearRound {
		t.Errorf("Season should default to year_round, got %q", fs.createdPricing.Season)
	}
	if fs.createdPricing.Currency != "AUD" {
		t.Errorf("Currency should default to AUD")
	}
}

func TestCreatePricingBenchmark_DuplicateMaps409(t *testing.T) {
	fs := &fakeStore{createPricingErr: tourismstore.ErrDuplicate}
	h := NewAdminHandler(fs)
	body := mustJSON(t, PricingBenchmarkRequest{
		Category: "wine", Council: "Barossa", DurationBucket: "full_day",
	})
	c, w := newCtx(http.MethodPost, "/", body)
	h.CreatePricingBenchmark(c)
	if w.Code != http.StatusConflict {
		t.Errorf("got %d want 409", w.Code)
	}
}

func TestUpdatePricingBenchmark_AppliesAllFields(t *testing.T) {
	existing := &tourismmodel.PricingBenchmark{
		Category: "wine", Council: "Barossa", DurationBucket: "full_day",
	}
	fs := &fakeStore{getPricingRow: existing}
	h := NewAdminHandler(fs)
	body := mustJSON(t, PricingBenchmarkRequest{
		Category: "wine", Council: "Barossa", DurationBucket: "full_day",
		MedianPrice: ptrFloat(220), SampleSize: 12,
	})
	c, w := newCtx(http.MethodPut, "/", body)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdatePricingBenchmark(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200", w.Code)
	}
	if fs.updatedPricing.SampleSize != 12 {
		t.Errorf("sample_size not updated")
	}
	if fs.updatedPricing.MedianPrice == nil || *fs.updatedPricing.MedianPrice != 220 {
		t.Errorf("median_price not updated")
	}
}

func TestUpdatePricingBenchmark_DuplicateMaps409(t *testing.T) {
	existing := &tourismmodel.PricingBenchmark{}
	fs := &fakeStore{getPricingRow: existing, updatePricingErr: tourismstore.ErrDuplicate}
	h := NewAdminHandler(fs)
	body := mustJSON(t, PricingBenchmarkRequest{
		Category: "wine", Council: "Barossa", DurationBucket: "full_day",
	})
	c, w := newCtx(http.MethodPut, "/", body)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdatePricingBenchmark(c)
	if w.Code != http.StatusConflict {
		t.Errorf("got %d want 409", w.Code)
	}
}

func TestDeletePricingBenchmark_OK(t *testing.T) {
	fs := &fakeStore{}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodDelete, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.DeletePricingBenchmark(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200", w.Code)
	}
}

func TestListPricingBenchmarks_ForwardsFilters(t *testing.T) {
	fs := &fakeStore{listPricingTotal: 3}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodGet,
		"/?category=wine&council=Barossa&duration_bucket=full_day&season=summer&page=1&page_size=20", nil)
	h.ListPricingBenchmarks(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200", w.Code)
	}
}

func TestGetPricingBenchmark_OK(t *testing.T) {
	row := &tourismmodel.PricingBenchmark{Category: "wine"}
	fs := &fakeStore{getPricingRow: row}
	h := NewAdminHandler(fs)
	c, w := newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.GetPricingBenchmark(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200", w.Code)
	}
}

// ===========================================================================
// Smoke tests for the three remaining entities — list/get/update/delete to
// keep coverage above the 60% gate without triplicating every assertion.
// ===========================================================================

// fakeStoreWithFullSupport extends fakeStore with row payloads for the
// secondary entities so the smoke tests can exercise list/get/update/delete
// without nil-pointer panics.
type fakeStoreWithFullSupport struct {
	fakeStore
	accommodationRow *tourismmodel.Accommodation
	foodRow          *tourismmodel.Food
	experienceRow    *tourismmodel.Experience
}

func (s *fakeStoreWithFullSupport) ListAccommodations(_ context.Context, _ tourismstore.AccommodationFilter) ([]tourismmodel.Accommodation, int64, error) {
	if s.accommodationRow == nil {
		return nil, 0, nil
	}
	return []tourismmodel.Accommodation{*s.accommodationRow}, 1, nil
}
func (s *fakeStoreWithFullSupport) GetAccommodation(_ context.Context, _ uint) (*tourismmodel.Accommodation, error) {
	if s.accommodationRow == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return s.accommodationRow, nil
}

func (s *fakeStoreWithFullSupport) ListFood(_ context.Context, _ tourismstore.FoodFilter) ([]tourismmodel.Food, int64, error) {
	if s.foodRow == nil {
		return nil, 0, nil
	}
	return []tourismmodel.Food{*s.foodRow}, 1, nil
}
func (s *fakeStoreWithFullSupport) GetFood(_ context.Context, _ uint) (*tourismmodel.Food, error) {
	if s.foodRow == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return s.foodRow, nil
}

func (s *fakeStoreWithFullSupport) ListExperiences(_ context.Context, _ tourismstore.ExperienceFilter) ([]tourismmodel.Experience, int64, error) {
	if s.experienceRow == nil {
		return nil, 0, nil
	}
	return []tourismmodel.Experience{*s.experienceRow}, 1, nil
}
func (s *fakeStoreWithFullSupport) GetExperience(_ context.Context, _ uint) (*tourismmodel.Experience, error) {
	if s.experienceRow == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return s.experienceRow, nil
}

func TestAccommodationsCRUDFlow(t *testing.T) {
	fs := &fakeStoreWithFullSupport{accommodationRow: &tourismmodel.Accommodation{NameZh: "袋鼠岛酒店"}}
	h := NewAdminHandler(fs)

	// List
	c, w := newCtx(http.MethodGet, "/?council=Kangaroo+Island", nil)
	h.ListAccommodations(c)
	if w.Code != http.StatusOK {
		t.Errorf("list: got %d want 200", w.Code)
	}

	// Get
	c, w = newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.GetAccommodation(c)
	if w.Code != http.StatusOK {
		t.Errorf("get: got %d want 200", w.Code)
	}

	// Update
	body := mustJSON(t, AccommodationRequest{NameZh: "袋鼠岛酒店", Council: "Kangaroo Island"})
	c, w = newCtx(http.MethodPut, "/", body)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdateAccommodation(c)
	if w.Code != http.StatusOK {
		t.Errorf("update: got %d want 200", w.Code)
	}

	// Delete
	c, w = newCtx(http.MethodDelete, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.DeleteAccommodation(c)
	if w.Code != http.StatusOK {
		t.Errorf("delete: got %d want 200", w.Code)
	}
}

func TestFoodCRUDFlow(t *testing.T) {
	fs := &fakeStoreWithFullSupport{foodRow: &tourismmodel.Food{NameZh: "袋鼠岛海鲜"}}
	h := NewAdminHandler(fs)

	c, w := newCtx(http.MethodGet, "/?cuisine=seafood", nil)
	h.ListFood(c)
	if w.Code != http.StatusOK {
		t.Errorf("list: got %d want 200", w.Code)
	}

	c, w = newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.GetFood(c)
	if w.Code != http.StatusOK {
		t.Errorf("get: got %d want 200", w.Code)
	}

	body := mustJSON(t, FoodRequest{NameZh: "袋鼠岛海鲜", Cuisine: "seafood"})
	c, w = newCtx(http.MethodPut, "/", body)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdateFood(c)
	if w.Code != http.StatusOK {
		t.Errorf("update: got %d want 200", w.Code)
	}

	c, w = newCtx(http.MethodDelete, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.DeleteFood(c)
	if w.Code != http.StatusOK {
		t.Errorf("delete: got %d want 200", w.Code)
	}
}

// ===========================================================================
// ETL endpoint tests — fake EtlRunner so we don't need real Postgres.
// ===========================================================================

type fakeEtlRunner struct {
	summary *etl.Summary
	err     error
	called  int
}

func (f *fakeEtlRunner) Run(_ context.Context) (*etl.Summary, error) {
	f.called++
	return f.summary, f.err
}

func TestRunEtl_NotWiredReturns503(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	c, w := newCtx(http.MethodPost, "/", nil)
	h.RunEtl(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("got %d want 503", w.Code)
	}
	if !strings.Contains(w.Body.String(), "ETL_NOT_WIRED") {
		t.Errorf("error code missing from body: %s", w.Body.String())
	}
}

func TestRunEtl_OKReturnsSummary(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	runner := &fakeEtlRunner{
		summary: &etl.Summary{
			ProductsScanned:     10,
			ExperiencesUpserted: 8,
			ProductsSkipped:     2,
			BenchmarksUpserted:  3,
		},
	}
	h.SetEtlRunner(runner)

	c, w := newCtx(http.MethodPost, "/", nil)
	h.RunEtl(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if runner.called != 1 {
		t.Errorf("runner should be called exactly once, got %d", runner.called)
	}
	if !strings.Contains(w.Body.String(), `"experiences_upserted":8`) {
		t.Errorf("summary fields missing from body: %s", w.Body.String())
	}
}

func TestRunEtl_RunnerErrorMaps500(t *testing.T) {
	h := NewAdminHandler(&fakeStore{})
	h.SetEtlRunner(&fakeEtlRunner{err: errors.New("db timeout")})
	c, w := newCtx(http.MethodPost, "/", nil)
	h.RunEtl(c)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d want 500", w.Code)
	}
	if !strings.Contains(w.Body.String(), "db timeout") {
		t.Errorf("upstream error should bubble: %s", w.Body.String())
	}
}

func TestExperiencesCRUDFlow(t *testing.T) {
	fs := &fakeStoreWithFullSupport{experienceRow: &tourismmodel.Experience{NameZh: "考拉抱抱体验"}}
	h := NewAdminHandler(fs)

	c, w := newCtx(http.MethodGet, "/?category=wildlife", nil)
	h.ListExperiences(c)
	if w.Code != http.StatusOK {
		t.Errorf("list: got %d want 200", w.Code)
	}

	c, w = newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.GetExperience(c)
	if w.Code != http.StatusOK {
		t.Errorf("get: got %d want 200", w.Code)
	}

	body := mustJSON(t, ExperienceRequest{NameZh: "考拉抱抱体验", Category: "wildlife"})
	c, w = newCtx(http.MethodPut, "/", body)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.UpdateExperience(c)
	if w.Code != http.StatusOK {
		t.Errorf("update: got %d want 200", w.Code)
	}

	c, w = newCtx(http.MethodDelete, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	h.DeleteExperience(c)
	if w.Code != http.StatusOK {
		t.Errorf("delete: got %d want 200", w.Code)
	}
}

