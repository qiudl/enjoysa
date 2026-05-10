package scraper

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"

	"gorm.io/datatypes"
)

// REQ-20260510-0011 · 2C · service_test.go
//
// Two layers:
//   - pure-helper tests (TitleCase, sitemap parsing, etc) — no fakes
//   - service-flow tests with fakes for store/sitemap/fetcher/extractor
//     drive RunSync end-to-end so the orchestrator (mutex, pacing skip,
//     dedupe gate, error counting) is fully covered without touching DB.
//
// The DB-bound store paths (CreateJob, MarkPromoted, etc) need a real
// Postgres → integration-test layer, deferred to next sub-phase.

// ============================================================================
// Pure helpers
// ============================================================================

func TestCouncilHintFromURL(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"https://southaustralia.com/destinations/adelaide-hills/places/hahndorf", "adelaide-hills"},
		{"https://southaustralia.com/destinations/barossa/places/tanunda", "barossa"},
		{"https://southaustralia.com/things-to-do/x", ""},
		{"not a url", ""},
		{"", ""},
	}
	for _, tc := range cases {
		if got := CouncilHintFromURL(tc.in); got != tc.want {
			t.Errorf("CouncilHintFromURL(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestSlugFromURL(t *testing.T) {
	cases := []struct{ in, want string }{
		{"https://southaustralia.com/destinations/adelaide-hills/places/hahndorf", "hahndorf"},
		{"https://x/", ""},
		{"", ""},
	}
	for _, tc := range cases {
		if got := SlugFromURL(tc.in); got != tc.want {
			t.Errorf("SlugFromURL(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestTitleCaseCouncil(t *testing.T) {
	cases := []struct{ in, want string }{
		{"adelaide", "Adelaide"},
		{"adelaide-hills", "Adelaide Hills"},
		{"ADELAIDE HILLS", "Adelaide Hills"},
		{"flinders ranges and outback", "Flinders Ranges and Outback"},
		{"flinders-ranges-and-outback", "Flinders Ranges and Outback"},
		{"", ""},
		{"  Adelaide  ", "Adelaide"},
	}
	for _, tc := range cases {
		if got := titleCaseCouncil(tc.in); got != tc.want {
			t.Errorf("titleCaseCouncil(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestStripJSONFences(t *testing.T) {
	cases := []struct{ in, want string }{
		{`{"a":1}`, `{"a":1}`},
		{"```json\n{\"a\":1}\n```", `{"a":1}`},
		{"```\n{\"a\":1}\n```", `{"a":1}`},
		{"   ```json\n{\"a\":1}\n```   ", `{"a":1}`},
	}
	for _, tc := range cases {
		if got := stripJSONFences(tc.in); got != tc.want {
			t.Errorf("stripJSONFences(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestStripToText(t *testing.T) {
	html := `<html><body><script>evil()</script><style>.x{}</style><p>Hello   world</p></body></html>`
	got := stripToText(html)
	if !strings.Contains(got, "Hello world") {
		t.Errorf("expected 'Hello world' in stripped text, got %q", got)
	}
	if strings.Contains(got, "evil") || strings.Contains(got, ".x{}") {
		t.Errorf("script/style not stripped: %q", got)
	}
}

func TestIsUniqueViolation(t *testing.T) {
	cases := []struct {
		err  error
		want bool
	}{
		{errors.New("pq: duplicate key value violates unique constraint"), true},
		{errors.New("ERROR (23505): duplicate"), true},
		{errors.New("UNIQUE constraint failed: tourism_scrape_staging.source_url"), true},
		{errors.New("connection refused"), false},
		{nil, false},
	}
	for _, tc := range cases {
		if got := isUniqueViolation(tc.err); got != tc.want {
			t.Errorf("isUniqueViolation(%v)=%v want %v", tc.err, got, tc.want)
		}
	}
}

func TestExtractedPayload_Roundtrip(t *testing.T) {
	in := ExtractedPayload{
		NameEn: "Hahndorf", NameZh: "汉多夫", Council: "Adelaide Hills",
		Category: "history", Tags: []string{"heritage"},
		ExtractionConfidence: "high",
	}
	body, _ := json.Marshal(in)
	var out ExtractedPayload
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.Council != "Adelaide Hills" || out.NameZh != "汉多夫" {
		t.Errorf("roundtrip mismatch: %+v", out)
	}
}

// ============================================================================
// Fakes for service-flow tests
// ============================================================================

type fakeFetcher struct {
	bodies map[string]string
	errs   map[string]error
	mu     sync.Mutex
	got    []string
}

func (f *fakeFetcher) Get(_ context.Context, u string) (string, error) {
	f.mu.Lock()
	f.got = append(f.got, u)
	f.mu.Unlock()
	if e, ok := f.errs[u]; ok {
		return "", e
	}
	if b, ok := f.bodies[u]; ok {
		return b, nil
	}
	return "<html><body>fallback</body></html>", nil
}

type fakeSitemap struct {
	urls []string
	err  error
}

func (s *fakeSitemap) URLs(_ context.Context, _ int) ([]string, error) {
	return s.urls, s.err
}

type fakeExtractor struct {
	payloads map[string]*ExtractedPayload
	errs     map[string]error
	mu       sync.Mutex
	gotURLs  []string
	gotHints []string
}

func (e *fakeExtractor) Extract(_ context.Context, u, hint, _ string) (*ExtractedPayload, error) {
	e.mu.Lock()
	e.gotURLs = append(e.gotURLs, u)
	e.gotHints = append(e.gotHints, hint)
	e.mu.Unlock()
	if err := e.errs[u]; err != nil {
		return nil, err
	}
	if p := e.payloads[u]; p != nil {
		return p, nil
	}
	return &ExtractedPayload{NameEn: "default", Council: "Adelaide", ExtractionConfidence: "high"}, nil
}

type fakeServiceStore struct {
	mu          sync.Mutex
	jobs        map[string]*Job
	stagingURL  map[string]bool
	stagingRows []*Staging
	createErr   error
	hasRunning  bool
}

func newFakeServiceStore() *fakeServiceStore {
	return &fakeServiceStore{
		jobs:       make(map[string]*Job),
		stagingURL: make(map[string]bool),
	}
}

func (s *fakeServiceStore) AnyRunningJob(_ context.Context, _ string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hasRunning, nil
}
func (s *fakeServiceStore) CreateJob(_ context.Context, j *Job) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[j.ID] = j
	return nil
}
func (s *fakeServiceStore) UpdateJobProgress(_ context.Context, j *Job) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[j.ID] = j
	return nil
}
func (s *fakeServiceStore) StagingExists(_ context.Context, source, url string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stagingURL[source+"|"+url], nil
}
func (s *fakeServiceStore) CreateStaging(_ context.Context, st *Staging) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.createErr != nil {
		return s.createErr
	}
	key := st.Source + "|" + st.SourceURL
	if s.stagingURL[key] {
		return ErrDuplicateStaging
	}
	s.stagingURL[key] = true
	s.stagingRows = append(s.stagingRows, st)
	return nil
}

// ============================================================================
// Service flow tests
// ============================================================================

func newServiceWithFakes(urls []string, store *fakeServiceStore, fetcher *fakeFetcher, extractor *fakeExtractor) *Service {
	s := NewService(store, &fakeSitemap{urls: urls}, fetcher, extractor)
	s.WithPace(0)
	s.WithBatchSize(len(urls))
	return s
}

func TestRunSync_HappyPath(t *testing.T) {
	urls := []string{
		"https://southaustralia.com/destinations/adelaide-hills/places/hahndorf",
		"https://southaustralia.com/destinations/barossa/places/tanunda",
	}
	store := newFakeServiceStore()
	fetcher := &fakeFetcher{}
	extractor := &fakeExtractor{
		payloads: map[string]*ExtractedPayload{
			urls[0]: {NameEn: "Hahndorf", Council: "Adelaide Hills"},
			urls[1]: {NameEn: "Tanunda", Council: "Barossa"},
		},
	}
	svc := newServiceWithFakes(urls, store, fetcher, extractor)

	job, err := svc.RunSync(context.Background(), nil)
	if err != nil {
		t.Fatalf("RunSync: %v", err)
	}
	if job.Status != JobStatusCompleted {
		t.Errorf("status = %q, want completed", job.Status)
	}
	if job.ExtractedRows != 2 {
		t.Errorf("ExtractedRows = %d, want 2", job.ExtractedRows)
	}
	if job.ScrapedURLs != 2 {
		t.Errorf("ScrapedURLs = %d, want 2", job.ScrapedURLs)
	}
	if len(store.stagingRows) != 2 {
		t.Errorf("stagingRows = %d, want 2", len(store.stagingRows))
	}
	if len(extractor.gotHints) != 2 || extractor.gotHints[0] != "adelaide-hills" {
		t.Errorf("extractor not called with council hints from URLs: %v", extractor.gotHints)
	}
}

func TestRunSync_DedupeSkipsLLM_D5(t *testing.T) {
	url := "https://southaustralia.com/destinations/adelaide/places/glenelg"
	store := newFakeServiceStore()
	store.stagingURL[SourceSATourism+"|"+url] = true // pre-seed using prod source key
	fetcher := &fakeFetcher{}
	extractor := &fakeExtractor{}
	svc := newServiceWithFakes([]string{url}, store, fetcher, extractor)

	job, err := svc.RunSync(context.Background(), nil)
	if err != nil {
		t.Fatalf("RunSync: %v", err)
	}
	if job.SkippedRows != 1 {
		t.Errorf("SkippedRows = %d, want 1 (D5 dedupe)", job.SkippedRows)
	}
	if job.ExtractedRows != 0 {
		t.Errorf("ExtractedRows = %d, want 0 (LLM should be skipped)", job.ExtractedRows)
	}
	if len(extractor.gotURLs) != 0 {
		t.Errorf("extractor called %d times, want 0 (D5: pre-existing → no LLM)", len(extractor.gotURLs))
	}
	if len(fetcher.got) != 0 {
		t.Errorf("fetcher called %d times, want 0 (D5: pre-existing → no fetch either)", len(fetcher.got))
	}
}

func TestRunSync_FetchErrorCountedNotFatal(t *testing.T) {
	urls := []string{
		"https://southaustralia.com/destinations/x/places/bad",
		"https://southaustralia.com/destinations/x/places/good",
	}
	store := newFakeServiceStore()
	fetcher := &fakeFetcher{
		errs: map[string]error{urls[0]: errors.New("503")},
	}
	extractor := &fakeExtractor{}
	svc := newServiceWithFakes(urls, store, fetcher, extractor)

	job, err := svc.RunSync(context.Background(), nil)
	if err != nil {
		t.Fatalf("RunSync: %v", err)
	}
	if job.Status != JobStatusPartial {
		t.Errorf("status = %q, want partial (some URLs failed)", job.Status)
	}
	if job.ErrorCount != 1 || job.ExtractedRows != 1 {
		t.Errorf("ErrorCount=%d ExtractedRows=%d; want 1/1", job.ErrorCount, job.ExtractedRows)
	}
}

func TestRunSync_ExtractorErrorCountedNotFatal(t *testing.T) {
	url := "https://southaustralia.com/destinations/x/places/bad"
	store := newFakeServiceStore()
	fetcher := &fakeFetcher{}
	extractor := &fakeExtractor{
		errs: map[string]error{url: errors.New("LLM 500")},
	}
	svc := newServiceWithFakes([]string{url}, store, fetcher, extractor)

	job, err := svc.RunSync(context.Background(), nil)
	if err != nil {
		t.Fatalf("RunSync: %v", err)
	}
	if job.ErrorCount != 1 {
		t.Errorf("ErrorCount = %d, want 1", job.ErrorCount)
	}
	if job.Status != JobStatusPartial {
		t.Errorf("status = %q, want partial", job.Status)
	}
}

func TestRunSync_MutexBlocksConcurrentRuns_D4(t *testing.T) {
	url := "https://southaustralia.com/destinations/x/places/y"
	store := newFakeServiceStore()
	fetcher := &fakeFetcher{}
	extractor := &fakeExtractor{}
	svc := newServiceWithFakes([]string{url}, store, fetcher, extractor)

	// Manually flip the mutex as if another job is running.
	svc.mu.Lock()
	svc.inflight[svc.source] = true
	svc.mu.Unlock()

	_, err := svc.RunSync(context.Background(), nil)
	if !errors.Is(err, ErrJobAlreadyRunning) {
		t.Errorf("expected ErrJobAlreadyRunning, got %v", err)
	}
}

func TestRunSync_DBSideRunningCheckBlocks_D4(t *testing.T) {
	store := newFakeServiceStore()
	store.hasRunning = true // simulate another replica running
	svc := newServiceWithFakes([]string{"https://x/destinations/a/places/b"}, store, &fakeFetcher{}, &fakeExtractor{})

	_, err := svc.RunSync(context.Background(), nil)
	if !errors.Is(err, ErrJobAlreadyRunning) {
		t.Errorf("expected ErrJobAlreadyRunning when DB shows running, got %v", err)
	}
}

func TestRunSync_StagingPayloadIsPreservedJSON(t *testing.T) {
	url := "https://southaustralia.com/destinations/x/places/y"
	store := newFakeServiceStore()
	extractor := &fakeExtractor{
		payloads: map[string]*ExtractedPayload{
			url: {NameEn: "Y", NameZh: "Y点", Council: "Adelaide", Tags: []string{"a", "b"}},
		},
	}
	svc := newServiceWithFakes([]string{url}, store, &fakeFetcher{}, extractor)

	_, err := svc.RunSync(context.Background(), nil)
	if err != nil {
		t.Fatalf("RunSync: %v", err)
	}
	if len(store.stagingRows) != 1 {
		t.Fatalf("stagingRows = %d, want 1", len(store.stagingRows))
	}
	body, _ := store.stagingRows[0].ExtractedPayload.MarshalJSON()
	if !strings.Contains(string(body), `"name_zh":"Y点"`) {
		t.Errorf("payload roundtrip lost CJK: %s", body)
	}
}

func TestSATourismSitemap_FiltersToPlaceURLs(t *testing.T) {
	sitemapBody := `<?xml version="1.0"?>
<urlset>
  <url><loc>https://southaustralia.com/things-to-do</loc></url>
  <url><loc>https://southaustralia.com/destinations/adelaide</loc></url>
  <url><loc>https://southaustralia.com/destinations/adelaide/places/glenelg</loc></url>
  <url><loc>https://southaustralia.com/destinations/barossa/places/tanunda</loc></url>
  <url><loc>https://southaustralia.com/destinations/x/things-to-do</loc></url>
</urlset>`
	fetcher := &fakeFetcher{bodies: map[string]string{sitemapURL: sitemapBody}}
	sm := NewSATourismSitemap(fetcher)

	urls, err := sm.URLs(context.Background(), 10)
	if err != nil {
		t.Fatalf("URLs: %v", err)
	}
	if len(urls) != 2 {
		t.Errorf("expected 2 place URLs, got %d: %v", len(urls), urls)
	}
	for _, u := range urls {
		if !strings.Contains(u, "/places/") {
			t.Errorf("non-place URL leaked through: %s", u)
		}
	}
}

// ---- staging payload roundtrip --------------------------------------------

func TestStaging_PayloadIsJSON(t *testing.T) {
	p := ExtractedPayload{NameEn: "X", Council: "Adelaide"}
	body, _ := json.Marshal(p)
	st := &Staging{ExtractedPayload: datatypes.JSON(body)}
	out, _ := st.ExtractedPayload.MarshalJSON()
	if !strings.Contains(string(out), `"name_en":"X"`) {
		t.Errorf("payload didn't roundtrip cleanly: %s", out)
	}
}
