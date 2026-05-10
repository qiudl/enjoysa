// Package tourism_agent orchestrates the tourism domain AI agent
// (REQ-20260510-0002 Phase 1 + REQ-20260510-0011 Phase 2).
package tourism_agent

import (
	aichatmw "enjoysa-backend/internal/aichat/middleware"
)

// Supplier/admin limiter (Phase 1, REQ-0002 1A): 1/s burst 3.
// Mounted on the existing /api/v1/ai/tourism/* group so a chatty
// supplier hitting "✨ AI 生成" can't starve other AI scenes that
// share the global 2/s burst-5 aiGroup limiter.
const (
	rateLimitRPS   = 1.0
	rateLimitBurst = 3
)

// NewRateLimiter returns the supplier/admin-side limiter (Phase 1
// shape). Kept verbatim so REQ-0011 doesn't risk regressing the 1F
// product-edit buttons.
func NewRateLimiter() *aichatmw.IPRateLimiter {
	return aichatmw.NewIPRateLimiter(rateLimitRPS, rateLimitBurst)
}

// C-end limiter (Phase 2, REQ-0011 R1 decision): 6 r/min/IP. Mounted
// only on /api/v1/ai/tourism/c/* — the consumer-facing endpoints
// (explain / fit-check / nearby) where PV is much higher than the
// supplier editor and per-product cache absorbs the bulk of repeat
// traffic. The cheaper rate (vs supplier 1/s = 60/min) reflects that
// (a) C-end users don't need rapid-fire generations and (b) cache
// hits dominate so the LLM-bound calls are sparse.
//
// Why not bursty: a burst would let a single user trigger N expensive
// LLM calls in one tab refresh storm before the bucket drains. 6/min
// flat keeps the worst case predictable.
const (
	cEndRateLimitRPS   = 0.1 // 6 per 60 seconds
	cEndRateLimitBurst = 2   // tolerate a quick double-click but no more
)

// NewCEndRateLimiter returns the C-end consumer limiter for the new
// /api/v1/ai/tourism/c/* sub-group introduced in Phase 2. Separate
// from NewRateLimiter so the supplier/admin path is unaffected.
func NewCEndRateLimiter() *aichatmw.IPRateLimiter {
	return aichatmw.NewIPRateLimiter(cEndRateLimitRPS, cEndRateLimitBurst)
}
