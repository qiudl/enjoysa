// REQ-20260510-0011 · Phase 2 · 2P-1 · cache.go
//
// Tiny TTL cache for per-product Agent responses. Used by the C-end
// /explain and /nearby endpoints where input is purely product_id and
// re-running the LLM for the same product is wasteful.
//
// Why not hashicorp/golang-lru: this codebase has no LRU dep yet and the
// tourism KB is small (max ~1000 products in foreseeable Phase 2). A flat
// map + jittered TTL covers the use case without pulling a new transitive.
//
// D1 jitter: TTL is randomised within ±jitterFraction of the configured
// TTL so a hot-product warmup doesn't hit a coordinated expiry cliff that
// would burst LLM calls. With 6h TTL ± 30min, expiries spread over a 1h
// window even when many entries were inserted at the same moment.

package tourism_agent

import (
	"math/rand"
	"sync"
	"time"
)

// TTLCache is a goroutine-safe map keyed by string with per-entry expiry.
// Misses do not allocate; reads are O(1).
type TTLCache struct {
	mu             sync.RWMutex
	entries        map[string]cacheEntry
	ttl            time.Duration
	jitterFraction float64 // 0.0 = no jitter, 0.1 = ±10%
	now            func() time.Time
	rng            *rand.Rand
}

type cacheEntry struct {
	value    string
	expireAt time.Time
}

// NewTTLCache returns a cache with the given baseline TTL and ±jitterFraction
// expiry spread. jitterFraction must be in [0, 0.5]; values outside the range
// are clamped to keep the effective TTL strictly positive.
func NewTTLCache(ttl time.Duration, jitterFraction float64) *TTLCache {
	if jitterFraction < 0 {
		jitterFraction = 0
	}
	if jitterFraction > 0.5 {
		jitterFraction = 0.5
	}
	return &TTLCache{
		entries:        make(map[string]cacheEntry),
		ttl:            ttl,
		jitterFraction: jitterFraction,
		now:            time.Now,
		rng:            rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Get returns (value, true) if the key exists and hasn't expired. Lazy
// expiry: stale entries are removed on read so we don't need a sweeper.
func (c *TTLCache) Get(key string) (string, bool) {
	c.mu.RLock()
	e, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		return "", false
	}
	if c.now().After(e.expireAt) {
		c.mu.Lock()
		// Re-check under write lock — another goroutine may have refreshed.
		if cur, still := c.entries[key]; still && c.now().After(cur.expireAt) {
			delete(c.entries, key)
		}
		c.mu.Unlock()
		return "", false
	}
	return e.value, true
}

// Set inserts the value with a jittered expiry. Existing entries are
// overwritten and pick up a fresh expiry — useful when the underlying KB
// changes and a stale cached answer is unwanted.
func (c *TTLCache) Set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = cacheEntry{
		value:    value,
		expireAt: c.now().Add(c.jitteredTTL()),
	}
}

// Delete removes a key. Safe even if absent.
func (c *TTLCache) Delete(key string) {
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
}

// Len reports current entry count (including not-yet-swept stale ones).
// Mostly a diagnostic; production code should treat hit/miss instead.
func (c *TTLCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

// jitteredTTL returns ttl ± (ttl * jitterFraction * random in [-1, 1]).
// Caller already holds the write lock.
func (c *TTLCache) jitteredTTL() time.Duration {
	if c.jitterFraction == 0 {
		return c.ttl
	}
	// rand.Float64 ∈ [0, 1) → spread ∈ (-jitterFraction, +jitterFraction)
	spread := (c.rng.Float64()*2 - 1) * c.jitterFraction
	return time.Duration(float64(c.ttl) * (1 + spread))
}
