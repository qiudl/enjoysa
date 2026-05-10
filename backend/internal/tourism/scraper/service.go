package scraper

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// REQ-20260510-0011 · 2C · service.go
//
// Service is the admin-callable orchestrator. One instance per server
// process. Holds a per-source mutex so two admins clicking "Run" at the
// same moment can't double-spend LLM budget — the second click gets
// ErrJobAlreadyRunning and the handler maps that to HTTP 409 (D4).
//
// Pacing: 1 r/s between URL fetches per R5/R6 design — lives in the run
// loop, not the HTTP client, so unit tests can pass a 0-pace clock.

const (
	// DefaultFetchPace is the per-URL sleep enforced inside Run. Production
	// uses 1s; tests inject 0 via WithPace.
	DefaultFetchPace = 1 * time.Second
	// DefaultBatchSize caps URLs per Run call so the whole pipeline stays
	// within a single HTTP request budget. Admin can re-trigger for more.
	DefaultBatchSize = 30
	// MaxRawHTMLBytes caps the LLM-bound HTML excerpt — long pages get
	// truncated so prompt cost stays bounded.
	MaxRawHTMLBytes = 40_000
	// FetcherTimeout is the per-request HTTP timeout — short enough that
	// a slow page can't stall the whole run.
	FetcherTimeout = 30 * time.Second
)

// Fetcher is the HTTP client interface — defined narrow for tests.
type Fetcher interface {
	Get(ctx context.Context, url string) (string, error)
}

// HTTPFetcher is the production fetcher. UA + Referer per R5 design
// (identify as EnjoySA bot, attribute traffic to enjoysau.com).
type HTTPFetcher struct {
	c *http.Client
}

func NewHTTPFetcher() *HTTPFetcher {
	return &HTTPFetcher{c: &http.Client{Timeout: FetcherTimeout}}
}

func (f *HTTPFetcher) Get(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "EnjoySA-tourism-bot/1.0 (+https://enjoysau.com; admin@enjoysau.com)")
	req.Header.Set("Referer", "https://enjoysau.com/")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	resp, err := f.c.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 500_000))
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// SitemapSource enumerates URLs to scrape. Production points at the
// southaustralia.com sitemap.xml; tests inject a fixed slice.
type SitemapSource interface {
	URLs(ctx context.Context, batchSize int) ([]string, error)
}

// SATourismSitemap fetches the southaustralia.com sitemap and filters for
// /destinations/*/places/* URLs (the place-level pages that have actual
// attraction content per the R7 PoC).
type SATourismSitemap struct {
	fetcher Fetcher
}

func NewSATourismSitemap(f Fetcher) *SATourismSitemap {
	return &SATourismSitemap{fetcher: f}
}

var (
	sitemapURL  = "https://southaustralia.com/sitemap.xml"
	locTagRe    = regexp.MustCompile(`<loc>([^<]+)</loc>`)
	placeRe     = regexp.MustCompile(`/destinations/[^/]+/places/[^/]+$`)
)

func (s *SATourismSitemap) URLs(ctx context.Context, batchSize int) ([]string, error) {
	body, err := s.fetcher.Get(ctx, sitemapURL)
	if err != nil {
		return nil, fmt.Errorf("fetch sitemap: %w", err)
	}
	out := make([]string, 0, batchSize)
	for _, m := range locTagRe.FindAllStringSubmatch(body, -1) {
		if len(m) < 2 {
			continue
		}
		u := m[1]
		if !placeRe.MatchString(u) {
			continue
		}
		out = append(out, u)
		if len(out) >= batchSize {
			break
		}
	}
	return out, nil
}

// ============================================================================
// Service
// ============================================================================

// ErrJobAlreadyRunning is returned by RunSync when another scrape job
// for the same source is already in progress (D4 mutex).
var ErrJobAlreadyRunning = errors.New("scraper: another job for this source is already running")

// ServiceStore is the narrow set of store ops the orchestrator depends on.
// Production code passes *Store; tests pass a fake without touching DB.
type ServiceStore interface {
	AnyRunningJob(ctx context.Context, source string) (bool, error)
	CreateJob(ctx context.Context, j *Job) error
	UpdateJobProgress(ctx context.Context, j *Job) error
	StagingExists(ctx context.Context, source, url string) (bool, error)
	CreateStaging(ctx context.Context, s *Staging) error
}

// Service orchestrates one Run cycle: load sitemap, walk URLs at 1 r/s,
// extract via LLM, write staging row, update job progress.
type Service struct {
	store     ServiceStore
	sitemap   SitemapSource
	fetcher   Fetcher
	extractor Extractor
	pace      time.Duration
	batchSize int
	source    string

	mu       sync.Mutex
	inflight map[string]bool // source → true if running
}

func NewService(store ServiceStore, sitemap SitemapSource, fetcher Fetcher, extractor Extractor) *Service {
	return &Service{
		store:     store,
		sitemap:   sitemap,
		fetcher:   fetcher,
		extractor: extractor,
		pace:      DefaultFetchPace,
		batchSize: DefaultBatchSize,
		source:    SourceSATourism,
		inflight:  make(map[string]bool),
	}
}

// WithPace overrides the inter-URL sleep. Used by tests + an admin
// "go-fast" toggle if/when we add one.
func (s *Service) WithPace(p time.Duration) *Service {
	s.pace = p
	return s
}

// WithBatchSize overrides the per-Run URL cap.
func (s *Service) WithBatchSize(n int) *Service {
	s.batchSize = n
	return s
}

// RunSync executes a scrape synchronously and returns the final Job. The
// admin handler treats this as a long-poll: typically 30 URLs * (3s LLM +
// 1s pace) = ~2 minutes. If we ever go async we'd flip this to launch a
// goroutine and return the job_id immediately.
//
// triggeredBy is the admin user id for audit. Pass nil for system-internal
// runs (none in Phase 2).
func (s *Service) RunSync(ctx context.Context, triggeredBy *uint) (*Job, error) {
	// D4 mutex: only one job per source at a time.
	if !s.tryAcquire(s.source) {
		return nil, ErrJobAlreadyRunning
	}
	defer s.release(s.source)

	// Also DB-side check — the in-process mutex doesn't help if we have
	// multiple server replicas. Future-proofing.
	hasRunning, err := s.store.AnyRunningJob(ctx, s.source)
	if err != nil {
		return nil, fmt.Errorf("check running jobs: %w", err)
	}
	if hasRunning {
		return nil, ErrJobAlreadyRunning
	}

	job := &Job{
		ID:          uuid.NewString(),
		Source:      s.source,
		Status:      JobStatusRunning,
		TriggeredBy: triggeredBy,
	}
	now := time.Now()
	job.StartedAt = &now
	if err := s.store.CreateJob(ctx, job); err != nil {
		return nil, fmt.Errorf("create job: %w", err)
	}

	// Load URLs from the sitemap (Phase 2 v1 just takes the first batchSize).
	urls, err := s.sitemap.URLs(ctx, s.batchSize)
	if err != nil {
		s.finishJob(ctx, job, JobStatusFailed, err.Error())
		return job, err
	}
	job.TotalURLs = len(urls)
	_ = s.store.UpdateJobProgress(ctx, job)

	// Walk URLs at 1 r/s.
	for i, u := range urls {
		if ctx.Err() != nil {
			s.finishJob(ctx, job, JobStatusPartial, "context cancelled")
			return job, ctx.Err()
		}

		// D5: skip the LLM if we already have a row for this URL.
		exists, _ := s.store.StagingExists(ctx, s.source, u)
		if exists {
			job.SkippedRows++
			job.ScrapedURLs++
			_ = s.store.UpdateJobProgress(ctx, job)
			s.pacingSleep(ctx, i, len(urls))
			continue
		}

		if err := s.scrapeOne(ctx, job, u); err != nil {
			job.ErrorCount++
			job.LastError = err.Error()
			_ = s.store.UpdateJobProgress(ctx, job)
		}
		job.ScrapedURLs++
		_ = s.store.UpdateJobProgress(ctx, job)

		s.pacingSleep(ctx, i, len(urls))
	}

	finalStatus := JobStatusCompleted
	if job.ErrorCount > 0 {
		finalStatus = JobStatusPartial
	}
	s.finishJob(ctx, job, finalStatus, job.LastError)
	return job, nil
}

// scrapeOne fetches one URL → strips → extracts → writes staging.
func (s *Service) scrapeOne(ctx context.Context, job *Job, sourceURL string) error {
	html, err := s.fetcher.Get(ctx, sourceURL)
	if err != nil {
		return fmt.Errorf("fetch %s: %w", sourceURL, err)
	}

	excerpt := stripToText(html)
	if len(excerpt) > MaxRawHTMLBytes {
		excerpt = excerpt[:MaxRawHTMLBytes]
	}

	councilHint := CouncilHintFromURL(sourceURL)
	payload, err := s.extractor.Extract(ctx, sourceURL, councilHint, excerpt)
	if err != nil {
		return fmt.Errorf("extract %s: %w", sourceURL, err)
	}

	rawJSON, err := datatypes.NewJSONType(*payload).MarshalJSON()
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	// First 800 chars of the cleaned excerpt go into staging for audit.
	keepLen := 800
	if len(excerpt) < keepLen {
		keepLen = len(excerpt)
	}
	st := &Staging{
		Source:               s.source,
		SourceURL:            sourceURL,
		RawHTMLExcerpt:       excerpt[:keepLen],
		ExtractedPayload:     datatypes.JSON(rawJSON),
		ExtractionConfidence: payload.ExtractionConfidence,
		Status:               StagingStatusPending,
		ScrapeJobID:          job.ID,
	}
	if err := s.store.CreateStaging(ctx, st); err != nil {
		if errors.Is(err, ErrDuplicateStaging) {
			// Another worker beat us — count as skipped, not error.
			job.SkippedRows++
			return nil
		}
		return fmt.Errorf("save staging: %w", err)
	}
	job.ExtractedRows++
	return nil
}

func (s *Service) finishJob(ctx context.Context, job *Job, status, lastErr string) {
	now := time.Now()
	job.Status = status
	job.FinishedAt = &now
	if lastErr != "" {
		job.LastError = lastErr
	}
	_ = s.store.UpdateJobProgress(ctx, job)
}

func (s *Service) pacingSleep(ctx context.Context, i, total int) {
	if i >= total-1 || s.pace <= 0 {
		return
	}
	select {
	case <-time.After(s.pace):
	case <-ctx.Done():
	}
}

// tryAcquire / release implement the per-source mutex (D4). Channel-based
// instead of sync.Mutex so a future "wait-for-other-job" semantic is easy.
func (s *Service) tryAcquire(source string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.inflight[source] {
		return false
	}
	s.inflight[source] = true
	return true
}

func (s *Service) release(source string) {
	s.mu.Lock()
	delete(s.inflight, source)
	s.mu.Unlock()
}

// stripToText: same regex pipeline as the PoC. Inline here so the scraper
// package is self-contained.
var (
	scriptRe = regexp.MustCompile(`(?s)<script.*?</script>`)
	styleRe  = regexp.MustCompile(`(?s)<style.*?</style>`)
	tagRe    = regexp.MustCompile(`<[^>]+>`)
	wsRe     = regexp.MustCompile(`\s+`)
)

func stripToText(html string) string {
	html = scriptRe.ReplaceAllString(html, " ")
	html = styleRe.ReplaceAllString(html, " ")
	text := tagRe.ReplaceAllString(html, " ")
	text = wsRe.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}
