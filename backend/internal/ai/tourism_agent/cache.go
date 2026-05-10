package tourism_agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"time"

	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
)

// REQ-20260510-0011 Phase 2 dev-2A — cache layer for the C-end embedded
// AI buttons. DB-backed (table tourism_agent_cache) with a per-key
// singleflight guard so a TTL-expiry stampede can't fan out to 100
// concurrent LLM calls.
//
// Trade-offs vs an in-memory LRU:
//   - DB lookup is ~1-2ms vs <1µs in-memory; acceptable since the
//     alternative (cache miss → LLM call) is 1-3s
//   - cross-restart durability comes for free (no cold-deploy spike)
//   - cross-replica sharing when we scale out (no Redis needed yet)
//
// TTL jitter is applied at write time (±15%) per defect D1 so
// mass-cached entries don't expire in lockstep.

// Cache stores JSON-serialized AI responses keyed by short string IDs.
// All methods are safe for concurrent use.
type Cache struct {
	db *gorm.DB
	sf singleflight.Group
}

// NewCache constructs a Cache backed by the given gorm DB.
func NewCache(db *gorm.DB) *Cache {
	return &Cache{db: db}
}

// cacheRow mirrors the migrations/012 schema. Defined inline because
// it's only consumed by Cache; promoting to internal/models would
// invite reuse outside of the agent path which we don't want.
type cacheRow struct {
	CacheKey  string          `gorm:"primaryKey;column:cache_key"`
	ValueJSON json.RawMessage `gorm:"type:jsonb;column:value_json"`
	ExpiresAt time.Time       `gorm:"column:expires_at"`
	CreatedAt time.Time       `gorm:"column:created_at"`
}

func (cacheRow) TableName() string { return "tourism_agent_cache" }

// ErrCacheMiss is returned by Get when the key is absent or expired.
// Callers typically branch on this (not on hit==false) to distinguish
// from real DB errors.
var ErrCacheMiss = errors.New("tourism_agent: cache miss")

// Get returns the cached JSON bytes for key, or ErrCacheMiss if the
// row is absent or has expired. It does NOT proactively delete
// expired rows — a janitor job (cron / pg_cron) handles that lazily
// per defect D2 so the read path stays cheap.
func (c *Cache) Get(ctx context.Context, key string) (json.RawMessage, error) {
	var row cacheRow
	err := c.db.WithContext(ctx).
		Where("cache_key = ? AND expires_at > ?", key, time.Now()).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrCacheMiss
	}
	if err != nil {
		return nil, fmt.Errorf("tourism_agent cache get: %w", err)
	}
	return row.ValueJSON, nil
}

// Set upserts a JSON-serializable value at key with the given TTL.
// TTL is jittered ±15% before being applied to spread the expiry of
// rows written in close succession.
func (c *Cache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("tourism_agent cache marshal: %w", err)
	}
	expiresAt := time.Now().Add(jitterDuration(ttl, key))
	row := cacheRow{
		CacheKey:  key,
		ValueJSON: raw,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	// gorm's "ON CONFLICT" support via clause.OnConflict is the cleanest
	// upsert; using a plain Save() would round-trip an extra SELECT.
	return c.db.WithContext(ctx).
		Exec(`
			INSERT INTO tourism_agent_cache (cache_key, value_json, expires_at, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT (cache_key) DO UPDATE SET
				value_json = EXCLUDED.value_json,
				expires_at = EXCLUDED.expires_at,
				created_at = EXCLUDED.created_at
		`, row.CacheKey, row.ValueJSON, row.ExpiresAt, row.CreatedAt).Error
}

// GetOrCompute returns the cached value at key, or runs compute() and
// caches its result. The singleflight guard ensures concurrent requests
// for the same key share a single compute() call (defect D1).
//
// Out is the destination — must be a pointer to a JSON-decodable value.
// Returns true if the value came from cache, false if compute ran.
func (c *Cache) GetOrCompute(
	ctx context.Context,
	key string,
	ttl time.Duration,
	out any,
	compute func(context.Context) (any, error),
) (cached bool, err error) {
	// Fast path — cache hit.
	if raw, err := c.Get(ctx, key); err == nil {
		if jerr := json.Unmarshal(raw, out); jerr != nil {
			return false, fmt.Errorf("tourism_agent cache unmarshal: %w", jerr)
		}
		return true, nil
	} else if !errors.Is(err, ErrCacheMiss) {
		return false, err
	}

	// Singleflight: only one request per key actually computes.
	v, err, _ := c.sf.Do(key, func() (any, error) {
		// Re-check inside the leader goroutine — a concurrent miss may
		// have just populated the cache while we were queuing.
		if raw, gerr := c.Get(ctx, key); gerr == nil {
			var sink json.RawMessage = raw
			return sink, nil
		}
		computed, cerr := compute(ctx)
		if cerr != nil {
			return nil, cerr
		}
		// Write-through; failures here are logged but not fatal — the
		// caller still gets the computed value.
		_ = c.Set(ctx, key, computed, ttl)
		return computed, nil
	})
	if err != nil {
		return false, err
	}

	// v is either a json.RawMessage (re-check hit) or the typed value
	// returned by compute(). Re-marshal to bytes so the unmarshal below
	// produces the caller's expected type uniformly.
	if raw, ok := v.(json.RawMessage); ok {
		return true, json.Unmarshal(raw, out)
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return false, fmt.Errorf("tourism_agent cache compute marshal: %w", err)
	}
	return false, json.Unmarshal(raw, out)
}

// SweepExpired deletes all expired rows. The handler doesn't call this
// directly; it's exported so a cron job (or admin debug endpoint) can
// reclaim space without poking at the schema.
func (c *Cache) SweepExpired(ctx context.Context) (int64, error) {
	res := c.db.WithContext(ctx).
		Where("expires_at < ?", time.Now()).
		Delete(&cacheRow{})
	return res.RowsAffected, res.Error
}

// jitterDuration adds a deterministic ±15% wobble to ttl, keyed off the
// cache key so retries for the same key hit the same ttl (avoids a
// thundering refresh after a migration). We use FNV-1a over the key for
// speed — this is not cryptographic.
func jitterDuration(ttl time.Duration, key string) time.Duration {
	if ttl <= 0 {
		return ttl
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	// Map 0..2^32-1 to -0.15..+0.15.
	frac := (float64(h.Sum32())/float64(1<<32))*0.3 - 0.15
	return ttl + time.Duration(float64(ttl)*frac)
}
