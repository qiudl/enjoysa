// Package etl reverse-extracts the platform's already-approved products
// into the tourism knowledge base.
//
// REQ-20260510-0002 · Phase 1 · 1E
//
// The ETL is admin-triggered (no cron, no auto-run on product publish).
// On each run it walks every approved product, upserts a row in
// `tourism_experiences` keyed on (source='product_etl', source_ref=<id>),
// and re-aggregates `tourism_pricing_benchmarks` by
// (category, council, duration_bucket, season=year_round).
//
// Idempotency rules (D1):
//   - Re-running never duplicates a row — the (source, source_ref) tuple
//     is the natural key for experiences; benchmarks UPSERT on the table's
//     UNIQUE(category, council, duration_bucket, season) constraint.
//   - Admin's IsActive flag is preserved on re-runs (D5) — we only flip
//     IsActive on the very first insert, and never overwrite an existing
//     admin choice. This means an admin who reviews + activates an ETL row
//     keeps that activation across re-runs.
//   - Description text is truncated at 500 chars on write so the table
//     stays small and the agent's tools.go truncation stays consistent
//     with what's stored.
package etl

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	productmodel "enjoysa-backend/internal/product/model"
	tourismmodel "enjoysa-backend/internal/tourism/model"

	"gorm.io/gorm"
)

// Service runs the cold-start ETL. The whole thing fits behind one Run()
// call: handler invokes, returns the summary, no background work.
type Service struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Service {
	return &Service{db: db}
}

// Summary is the structured report returned to the admin who triggered the
// run. Errors is a per-row list (capped at 50) so a malformed product row
// doesn't drown out useful signal.
type Summary struct {
	ProductsScanned     int      `json:"products_scanned"`
	ExperiencesUpserted int      `json:"experiences_upserted"`
	ProductsSkipped     int      `json:"products_skipped"`
	BenchmarksUpserted  int      `json:"benchmarks_upserted"`
	Errors              []string `json:"errors,omitempty"`
}

const (
	maxErrorsReported   = 50
	descriptionMaxRunes = 500
)

// Run walks every approved product, upserts experiences, and recomputes
// pricing benchmarks. The whole pass is one DB session — if something
// hard-fails (eg connection drop) we abort and surface a top-level error;
// per-row failures are captured in Summary.Errors and the run continues.
func (s *Service) Run(ctx context.Context) (*Summary, error) {
	if s.db == nil {
		return nil, errors.New("etl: nil db")
	}
	summary := &Summary{}

	var products []productmodel.Product
	err := s.db.WithContext(ctx).
		Where("status = ?", productmodel.ProductStatusApproved).
		Preload("Region").
		Preload("Category").
		Preload("Packages").
		Find(&products).Error
	if err != nil {
		return nil, fmt.Errorf("etl: load products: %w", err)
	}
	summary.ProductsScanned = len(products)

	// Group prices for benchmark aggregation: key = (category, council, bucket)
	// → []float64 of all package prices that contributed.
	type benchKey struct {
		Category, Council, Bucket string
	}
	benchPrices := make(map[benchKey][]float64)

	for _, p := range products {
		if p.Region == nil || p.Region.NameEn == "" {
			summary.ProductsSkipped++
			s.appendError(summary, fmt.Sprintf("product %d: missing region", p.ID))
			continue
		}
		if p.Category == nil || p.Category.Slug == "" {
			summary.ProductsSkipped++
			s.appendError(summary, fmt.Sprintf("product %d: missing category", p.ID))
			continue
		}

		council := p.Region.NameEn
		category := p.Category.Slug
		minP, maxP := priceRangeFromPackages(p.Packages, p.PriceFrom)
		bucket := DurationBucketFromText(p.Duration)
		typicalDuration := DurationMinutesFromText(p.Duration)

		if err := s.upsertExperience(ctx, &p, council, category, minP, maxP, typicalDuration); err != nil {
			s.appendError(summary, fmt.Sprintf("product %d: upsert experience: %v", p.ID, err))
			continue
		}
		summary.ExperiencesUpserted++

		// Feed pricing aggregation. We use every package price (not just the
		// product-level PriceFrom) so multi-tier packages get full weight in
		// the median — that's what the 0036 supplier-side analytics taught
		// us is the most useful number for "what should I price this at".
		key := benchKey{Category: category, Council: council, Bucket: bucket}
		if len(p.Packages) == 0 && p.PriceFrom > 0 {
			benchPrices[key] = append(benchPrices[key], p.PriceFrom)
		}
		for _, pkg := range p.Packages {
			if pkg.Price > 0 {
				benchPrices[key] = append(benchPrices[key], pkg.Price)
			}
		}
	}

	for k, prices := range benchPrices {
		if len(prices) == 0 {
			continue
		}
		if err := s.upsertBenchmark(ctx, k.Category, k.Council, k.Bucket, prices); err != nil {
			s.appendError(summary, fmt.Sprintf("benchmark %s/%s/%s: %v", k.Category, k.Council, k.Bucket, err))
			continue
		}
		summary.BenchmarksUpserted++
	}

	return summary, nil
}

func (s *Service) appendError(summary *Summary, msg string) {
	if len(summary.Errors) >= maxErrorsReported {
		return
	}
	summary.Errors = append(summary.Errors, msg)
}

// upsertExperience inserts or updates a tourism_experiences row keyed on
// (source='product_etl', source_ref=product_id). On update we deliberately
// preserve the existing IsActive flag (D5).
func (s *Service) upsertExperience(
	ctx context.Context,
	p *productmodel.Product,
	council, category string,
	minPrice, maxPrice *float64,
	typicalDuration *int,
) error {
	const sourceKind = tourismmodel.SourceProductETL
	sourceRef := fmt.Sprintf("%d", p.ID)

	var existing tourismmodel.Experience
	err := s.db.WithContext(ctx).
		Where("source = ? AND source_ref = ?", sourceKind, sourceRef).
		First(&existing).Error
	switch {
	case err == nil:
		// Update path — preserve IsActive (D5), refresh data fields.
		existing.NameZh = p.NameZh
		existing.NameEn = p.NameEn
		existing.Council = council
		existing.Category = category
		existing.PriceRangeMin = minPrice
		existing.PriceRangeMax = maxPrice
		existing.TypicalDurationMinutes = typicalDuration
		existing.Description = truncateRunes(p.SummaryZh, descriptionMaxRunes)
		// IsActive intentionally NOT touched — admin's review verdict wins.
		// BestSeasons left alone for the same reason: ETL has no signal here,
		// and an admin may have curated this list manually.
		return s.db.WithContext(ctx).Save(&existing).Error
	case errors.Is(err, gorm.ErrRecordNotFound):
		// Insert path — IsActive=false (D2: cold-start ETL is admin-gated).
		row := tourismmodel.Experience{
			NameZh:                 p.NameZh,
			NameEn:                 p.NameEn,
			Council:                council,
			Category:               category,
			PriceRangeMin:          minPrice,
			PriceRangeMax:          maxPrice,
			TypicalDurationMinutes: typicalDuration,
			Description:            truncateRunes(p.SummaryZh, descriptionMaxRunes),
			BestSeasons:            []string{},
			Source:                 sourceKind,
			SourceRef:              sourceRef,
			IsActive:               false,
		}
		return s.db.WithContext(ctx).Create(&row).Error
	default:
		return err
	}
}

// upsertBenchmark replaces median/p25/p75/sample_size for the given
// dimension. Season is hard-coded to year_round for v1 — we have no
// reliable seasonal signal in the source data yet.
func (s *Service) upsertBenchmark(
	ctx context.Context,
	category, council, bucket string,
	prices []float64,
) error {
	median, p25, p75 := priceQuantiles(prices)
	now := nowFunc()

	var existing tourismmodel.PricingBenchmark
	err := s.db.WithContext(ctx).
		Where("category = ? AND council = ? AND duration_bucket = ? AND season = ?",
			category, council, bucket, tourismmodel.SeasonYearRound).
		First(&existing).Error
	switch {
	case err == nil:
		existing.MedianPrice = &median
		existing.P25 = &p25
		existing.P75 = &p75
		existing.SampleSize = len(prices)
		existing.ComputedAt = &now
		// Currency intentionally not touched — admin override wins.
		return s.db.WithContext(ctx).Save(&existing).Error
	case errors.Is(err, gorm.ErrRecordNotFound):
		row := tourismmodel.PricingBenchmark{
			Category:       category,
			Council:        council,
			DurationBucket: bucket,
			Season:         tourismmodel.SeasonYearRound,
			MedianPrice:    &median,
			P25:            &p25,
			P75:            &p75,
			SampleSize:     len(prices),
			Currency:       "AUD",
			ComputedAt:     &now,
		}
		return s.db.WithContext(ctx).Create(&row).Error
	default:
		return err
	}
}

// priceRangeFromPackages returns (min, max) across non-zero package prices.
// Falls back to ProductFrom if there are no packages with prices. nil is
// returned when no signal is available so the column stays NULL.
func priceRangeFromPackages(pkgs []productmodel.ProductPackage, fallback float64) (*float64, *float64) {
	var minV, maxV float64
	seen := false
	for _, pkg := range pkgs {
		if pkg.Price <= 0 {
			continue
		}
		if !seen {
			minV, maxV = pkg.Price, pkg.Price
			seen = true
			continue
		}
		if pkg.Price < minV {
			minV = pkg.Price
		}
		if pkg.Price > maxV {
			maxV = pkg.Price
		}
	}
	if !seen {
		if fallback > 0 {
			return &fallback, &fallback
		}
		return nil, nil
	}
	return &minV, &maxV
}

// priceQuantiles returns (median, p25, p75) for a non-empty slice. We use
// the type R-2 method (linear interpolation between adjacent ranks) — same
// definition NumPy / SciPy default to, so admins comparing externally see
// matching numbers.
func priceQuantiles(prices []float64) (median, p25, p75 float64) {
	if len(prices) == 0 {
		return 0, 0, 0
	}
	sorted := append([]float64(nil), prices...)
	sort.Float64s(sorted)
	return percentile(sorted, 0.50), percentile(sorted, 0.25), percentile(sorted, 0.75)
}

func percentile(sorted []float64, q float64) float64 {
	n := len(sorted)
	if n == 1 {
		return sorted[0]
	}
	pos := q * float64(n-1)
	lo := int(pos)
	hi := lo + 1
	if hi >= n {
		return sorted[n-1]
	}
	frac := pos - float64(lo)
	return sorted[lo] + (sorted[hi]-sorted[lo])*frac
}

// DurationBucketFromText classifies free-text "Duration" fields into the
// three benchmark buckets. The matcher is keyword-based: numeric hour
// values up to 4 are half-day, up to 12 are full-day, and anything explicit
// about days / overnight / multi is multi-day. Unknown defaults to full-day
// — the most common shape for EnjoySA tours.
func DurationBucketFromText(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		return tourismmodel.DurationBucketFullDay
	}
	if strings.Contains(s, "multi") || strings.Contains(s, "overnight") ||
		strings.Contains(s, "days") || strings.Contains(s, "day trip") ||
		strings.Contains(s, "weekend") {
		// "2 days" and "3 days" plurals; singular "1 day" is full_day below
		return tourismmodel.DurationBucketMultiDay
	}
	if strings.Contains(s, "half") {
		return tourismmodel.DurationBucketHalfDay
	}
	if strings.Contains(s, "full day") || strings.Contains(s, "all day") ||
		strings.Contains(s, "whole day") || strings.Contains(s, "1 day") ||
		strings.Contains(s, "one day") {
		return tourismmodel.DurationBucketFullDay
	}
	if h := parseLeadingHours(s); h > 0 {
		if h <= 4 {
			return tourismmodel.DurationBucketHalfDay
		}
		if h <= 12 {
			return tourismmodel.DurationBucketFullDay
		}
		return tourismmodel.DurationBucketMultiDay
	}
	return tourismmodel.DurationBucketFullDay
}

// DurationMinutesFromText returns the typical duration in minutes if the
// raw text contains a recognisable hour count, otherwise nil. The tourism
// model column is *int; nil leaves it NULL so the agent surfaces "data
// not available" rather than a misleading 0.
func DurationMinutesFromText(raw string) *int {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		return nil
	}
	if strings.Contains(s, "half") {
		v := 4 * 60
		return &v
	}
	if strings.Contains(s, "full day") || strings.Contains(s, "all day") ||
		strings.Contains(s, "whole day") || strings.Contains(s, "1 day") ||
		strings.Contains(s, "one day") {
		v := 8 * 60
		return &v
	}
	if h := parseLeadingHours(s); h > 0 {
		v := h * 60
		return &v
	}
	return nil
}

// parseLeadingHours extracts the leading integer "N" from strings like
// "3 hours", "4 hr", "2h tour". Returns 0 when no clear hour count is
// present so the caller can apply its own default.
func parseLeadingHours(s string) int {
	// Trim leading non-digit, then grab the leading run of digits, then
	// look for an "h" / "hour" / "hr" suffix anywhere after it.
	digitsStart := -1
	for i, ch := range s {
		if ch >= '0' && ch <= '9' {
			digitsStart = i
			break
		}
	}
	if digitsStart < 0 {
		return 0
	}
	digitsEnd := digitsStart
	for digitsEnd < len(s) && s[digitsEnd] >= '0' && s[digitsEnd] <= '9' {
		digitsEnd++
	}
	if digitsEnd == digitsStart {
		return 0
	}
	val := 0
	for i := digitsStart; i < digitsEnd; i++ {
		val = val*10 + int(s[i]-'0')
	}
	rest := s[digitsEnd:]
	if strings.Contains(rest, "h") {
		return val
	}
	return 0
}

// truncateRunes cuts a string at maxRunes (Unicode-safe — Chinese chars
// are multi-byte, so a byte-based truncation would corrupt the trailing
// rune). Empty / short inputs pass through unchanged.
func truncateRunes(s string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return string(runes[:maxRunes])
}

// nowFunc is overridable in tests. Tests inject a stable time so generated
// SQL diffs are deterministic.
var nowFunc = func() time.Time { return time.Now() }
