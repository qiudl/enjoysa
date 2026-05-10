package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	tourismmodel "enjoysa-backend/internal/tourism/model"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// REQ-20260510-0011 · 2C-2 · handler_test.go
//
// HTTP-level tests using fake Runner / HandlerStore / AttractionWriter.
// Coverage focuses on the HTTP boundary (status codes, error mapping,
// response shape) — the orchestration logic itself is covered by
// service_test.go.

func init() {
	gin.SetMode(gin.TestMode)
}

func newCtx(method, target string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if body == nil {
		c.Request = httptest.NewRequest(method, target, nil)
	} else {
		c.Request = httptest.NewRequest(method, target, bytes.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
	}
	return c, w
}

// ---- fakes -----------------------------------------------------------------

type fakeRunner struct {
	job *Job
	err error
}

func (f *fakeRunner) RunSync(_ context.Context, triggeredBy *uint) (*Job, error) {
	return f.job, f.err
}

type fakeHandlerStore struct {
	mu             sync.Mutex
	job            *Job
	jobErr         error
	stagingByID    map[uint]*Staging
	stagingByIDErr error
	listRows       []Staging
	listTotal      int64
	listErr        error
	promoteErr     error
	rejectErr      error
	promoteCalls   []promoteCall
	rejectCalls    []rejectCall
}

type promoteCall struct {
	stagingID, attractionID uint
	reviewedBy              *uint
}
type rejectCall struct {
	stagingID  uint
	reason     string
	reviewedBy *uint
}

func (f *fakeHandlerStore) GetJob(_ context.Context, _ string) (*Job, error) {
	return f.job, f.jobErr
}
func (f *fakeHandlerStore) ListStaging(_ context.Context, _ string, _, _ int) ([]Staging, int64, error) {
	return f.listRows, f.listTotal, f.listErr
}
func (f *fakeHandlerStore) GetStaging(_ context.Context, id uint) (*Staging, error) {
	if f.stagingByIDErr != nil {
		return nil, f.stagingByIDErr
	}
	if s, ok := f.stagingByID[id]; ok {
		return s, nil
	}
	return nil, gorm.ErrRecordNotFound
}
func (f *fakeHandlerStore) MarkPromoted(_ context.Context, id, attractionID uint, reviewedBy *uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.promoteErr != nil {
		return f.promoteErr
	}
	f.promoteCalls = append(f.promoteCalls, promoteCall{id, attractionID, reviewedBy})
	return nil
}
func (f *fakeHandlerStore) MarkRejected(_ context.Context, id uint, reason string, reviewedBy *uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.rejectErr != nil {
		return f.rejectErr
	}
	f.rejectCalls = append(f.rejectCalls, rejectCall{id, reason, reviewedBy})
	return nil
}

type fakeWriter struct {
	createdAttraction *tourismmodel.Attraction
	createErr         error
	nextID            uint
}

func (w *fakeWriter) CreateAttraction(_ context.Context, a *tourismmodel.Attraction) error {
	if w.createErr != nil {
		return w.createErr
	}
	w.nextID++
	a.ID = w.nextID
	w.createdAttraction = a
	return nil
}

// ---- RunScrape -------------------------------------------------------------

func TestRunScrape_NotWiredReturns503(t *testing.T) {
	h := NewHandler(nil, &fakeHandlerStore{}, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	h.RunScrape(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("got %d want 503", w.Code)
	}
}

func TestRunScrape_HappyPathReturnsJob(t *testing.T) {
	job := &Job{ID: "uuid-1", Status: JobStatusCompleted, ExtractedRows: 5}
	h := NewHandler(&fakeRunner{job: job}, &fakeHandlerStore{}, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Set("admin_id", uint(1))
	h.RunScrape(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"id":"uuid-1"`) {
		t.Errorf("response missing job id: %s", w.Body.String())
	}
}

func TestRunScrape_AlreadyRunningMaps409(t *testing.T) {
	h := NewHandler(&fakeRunner{err: ErrJobAlreadyRunning}, &fakeHandlerStore{}, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Set("admin_id", uint(1))
	h.RunScrape(c)
	if w.Code != http.StatusConflict {
		t.Errorf("got %d want 409", w.Code)
	}
	if !strings.Contains(w.Body.String(), "SCRAPE_JOB_RUNNING") {
		t.Errorf("error code missing: %s", w.Body.String())
	}
}

func TestRunScrape_GenericErrorMaps500(t *testing.T) {
	h := NewHandler(&fakeRunner{err: errors.New("boom")}, &fakeHandlerStore{}, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Set("admin_id", uint(1))
	h.RunScrape(c)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d want 500", w.Code)
	}
}

// ---- GetJob ---------------------------------------------------------------

func TestGetJob_NotFoundMaps404(t *testing.T) {
	store := &fakeHandlerStore{jobErr: gorm.ErrRecordNotFound}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "x"}}
	h.GetJob(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

func TestGetJob_HappyPath(t *testing.T) {
	store := &fakeHandlerStore{job: &Job{ID: "x", Status: JobStatusRunning}}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "x"}}
	h.GetJob(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"status":"running"`) {
		t.Errorf("body: %s", w.Body.String())
	}
}

// ---- ListStaging ----------------------------------------------------------

func TestListStaging_PaginatedShape(t *testing.T) {
	store := &fakeHandlerStore{
		listRows:  []Staging{{ID: 1, Source: "sa-tourism", Status: "pending"}},
		listTotal: 1,
	}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodGet, "/?status=pending&page=1&page_size=20", nil)
	h.ListStaging(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200", w.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	data := body["data"].(map[string]any)
	if int(data["total"].(float64)) != 1 {
		t.Errorf("total mismatch: %v", data["total"])
	}
}

// ---- PromoteStaging ------------------------------------------------------

func makeStagingRow(id uint, payload ExtractedPayload) *Staging {
	body, _ := json.Marshal(payload)
	return &Staging{
		ID:               id,
		Source:           "sa-tourism",
		SourceURL:        "https://x/places/y",
		Status:           StagingStatusPending,
		ExtractedPayload: datatypes.JSON(body),
	}
}

func TestPromoteStaging_HappyPath(t *testing.T) {
	st := makeStagingRow(7, ExtractedPayload{
		NameZh: "汉多夫", NameEn: "Hahndorf",
		Council: "Adelaide Hills", Category: "history",
		Tags: []string{"heritage", "german"},
	})
	store := &fakeHandlerStore{stagingByID: map[uint]*Staging{7: st}}
	writer := &fakeWriter{}
	h := NewHandler(&fakeRunner{}, store, writer)

	c, w := newCtx(http.MethodPost, "/", nil)
	c.Set("admin_id", uint(42))
	c.Params = gin.Params{{Key: "id", Value: "7"}}
	h.PromoteStaging(c)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if writer.createdAttraction == nil {
		t.Fatal("attraction not created")
	}
	if writer.createdAttraction.NameZh != "汉多夫" {
		t.Errorf("name not propagated, got %q", writer.createdAttraction.NameZh)
	}
	if writer.createdAttraction.IsActive {
		t.Errorf("D2: promoted attraction must default to IsActive=false")
	}
	if writer.createdAttraction.Source != tourismmodel.SourceScraped {
		t.Errorf("Source must be 'scraped', got %q", writer.createdAttraction.Source)
	}
	if writer.createdAttraction.SourceRef != st.SourceURL {
		t.Errorf("SourceRef must be staging's source_url, got %q", writer.createdAttraction.SourceRef)
	}
	if len(store.promoteCalls) != 1 {
		t.Errorf("MarkPromoted not called: %d", len(store.promoteCalls))
	}
	if store.promoteCalls[0].reviewedBy == nil || *store.promoteCalls[0].reviewedBy != 42 {
		t.Errorf("reviewedBy admin id not propagated")
	}
}

func TestPromoteStaging_AlreadyPromotedMaps409(t *testing.T) {
	st := makeStagingRow(7, ExtractedPayload{NameZh: "X"})
	st.Status = StagingStatusPromoted
	store := &fakeHandlerStore{stagingByID: map[uint]*Staging{7: st}}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Set("admin_id", uint(1))
	c.Params = gin.Params{{Key: "id", Value: "7"}}
	h.PromoteStaging(c)
	if w.Code != http.StatusConflict {
		t.Errorf("got %d want 409", w.Code)
	}
}

func TestPromoteStaging_NotFoundMaps404(t *testing.T) {
	store := &fakeHandlerStore{stagingByID: map[uint]*Staging{}}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "99"}}
	h.PromoteStaging(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

func TestPromoteStaging_MissingNameZhMaps400(t *testing.T) {
	st := makeStagingRow(7, ExtractedPayload{NameEn: "Only English"})
	store := &fakeHandlerStore{stagingByID: map[uint]*Staging{7: st}}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "7"}}
	h.PromoteStaging(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

func TestPromoteStaging_PartialFailureSurfacesAttractionID(t *testing.T) {
	// Attraction insert succeeds, MarkPromoted fails — handler returns 500
	// + PROMOTE_PARTIAL code so admin can manually reconcile.
	st := makeStagingRow(7, ExtractedPayload{NameZh: "X"})
	store := &fakeHandlerStore{
		stagingByID: map[uint]*Staging{7: st},
		promoteErr:  errors.New("DB connection lost"),
	}
	writer := &fakeWriter{}
	h := NewHandler(&fakeRunner{}, store, writer)
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "7"}}
	h.PromoteStaging(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("got %d want 500", w.Code)
	}
	if !strings.Contains(w.Body.String(), "PROMOTE_PARTIAL") {
		t.Errorf("error code missing: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "id=1") {
		t.Errorf("response should mention created attraction id for manual reconcile: %s", w.Body.String())
	}
}

// ---- RejectStaging --------------------------------------------------------

func TestRejectStaging_HappyPathWithReason(t *testing.T) {
	store := &fakeHandlerStore{}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	body := []byte(`{"reason":"low quality LLM output"}`)
	c, w := newCtx(http.MethodPost, "/", body)
	c.Set("admin_id", uint(7))
	c.Params = gin.Params{{Key: "id", Value: "9"}}
	h.RejectStaging(c)
	if w.Code != http.StatusOK {
		t.Errorf("got %d want 200, body=%s", w.Code, w.Body.String())
	}
	if len(store.rejectCalls) != 1 {
		t.Errorf("MarkRejected not called: %d", len(store.rejectCalls))
	}
	if store.rejectCalls[0].reason != "low quality LLM output" {
		t.Errorf("reason not propagated: %q", store.rejectCalls[0].reason)
	}
}

func TestRejectStaging_NotFoundMaps404(t *testing.T) {
	store := &fakeHandlerStore{rejectErr: gorm.ErrRecordNotFound}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "9"}}
	h.RejectStaging(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("got %d want 404", w.Code)
	}
}

func TestRejectStaging_BadIDMaps400(t *testing.T) {
	store := &fakeHandlerStore{}
	h := NewHandler(&fakeRunner{}, store, &fakeWriter{})
	c, w := newCtx(http.MethodPost, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: "abc"}}
	h.RejectStaging(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400", w.Code)
	}
}

// ---- buildAttractionFromStaging -------------------------------------------

func TestBuildAttractionFromStaging_PreservesAllFields(t *testing.T) {
	st := makeStagingRow(1, ExtractedPayload{
		NameZh: "塔南达", NameEn: "Tanunda",
		Council: "Barossa", Category: "wine",
		DescriptionZh: "巴罗莎心脏地带的小镇",
		Tags:          []string{"wine", "historic"},
		BestSeasons:   []string{"year_round"},
	})
	a, err := buildAttractionFromStaging(st)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if a.Council != "Barossa" || a.Category != "wine" {
		t.Errorf("council/category mismatch: %+v", a)
	}
	if len(a.Tags) != 2 {
		t.Errorf("tags lost: %v", a.Tags)
	}
	if a.IsActive {
		t.Errorf("must default to IsActive=false (D2)")
	}
}

func TestBuildAttractionFromStaging_NilSafeArrays(t *testing.T) {
	st := makeStagingRow(1, ExtractedPayload{NameZh: "x"})
	a, err := buildAttractionFromStaging(st)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if a.Tags == nil {
		t.Errorf("Tags must be non-nil empty slice for pq.StringArray NOT NULL")
	}
	if a.BestSeasons == nil {
		t.Errorf("BestSeasons must be non-nil empty slice for pq.StringArray NOT NULL")
	}
}

func TestBuildAttractionFromStaging_RejectsEmptyName(t *testing.T) {
	st := makeStagingRow(1, ExtractedPayload{NameEn: "X"})
	if _, err := buildAttractionFromStaging(st); err == nil {
		t.Errorf("expected error when name_zh missing")
	}
}

func TestBuildAttractionFromStaging_RejectsNil(t *testing.T) {
	if _, err := buildAttractionFromStaging(nil); err == nil {
		t.Errorf("expected error on nil staging")
	}
}
