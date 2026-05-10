package tourism_agent

import (
	"sync"
	"testing"
	"time"
)

// REQ-20260510-0011 · 2P-1 · cache_test.go
//
// Coverage targets the bits that determine whether the cache actually
// saves LLM cost in production:
//   - Get-after-Set hits within TTL
//   - Get-after-expiry misses (lazy expiry, no sweeper)
//   - Set overrides existing entry with fresh expiry
//   - Jitter spreads expiry within ±jitterFraction
//   - Concurrent Get/Set safe (race-detector friendly)
//   - jitterFraction clamped to [0, 0.5]

func TestTTLCache_HitWithinTTL(t *testing.T) {
	c := NewTTLCache(1*time.Hour, 0)
	c.Set("p:42", "hello")
	got, ok := c.Get("p:42")
	if !ok || got != "hello" {
		t.Fatalf("Get = (%q, %v); want (\"hello\", true)", got, ok)
	}
}

func TestTTLCache_MissAfterExpiry(t *testing.T) {
	c := NewTTLCache(1*time.Hour, 0)
	frozen := time.Now()
	c.now = func() time.Time { return frozen }
	c.Set("p:42", "v")

	// Move time past TTL.
	c.now = func() time.Time { return frozen.Add(2 * time.Hour) }
	if _, ok := c.Get("p:42"); ok {
		t.Errorf("expected miss after TTL, got hit")
	}
	if c.Len() != 0 {
		t.Errorf("expired entry should be lazily swept on Get, Len=%d", c.Len())
	}
}

func TestTTLCache_SetOverrides(t *testing.T) {
	c := NewTTLCache(1*time.Hour, 0)
	c.Set("k", "first")
	c.Set("k", "second")
	got, _ := c.Get("k")
	if got != "second" {
		t.Errorf("Get = %q, want second", got)
	}
}

func TestTTLCache_DeleteRemoves(t *testing.T) {
	c := NewTTLCache(1*time.Hour, 0)
	c.Set("k", "v")
	c.Delete("k")
	if _, ok := c.Get("k"); ok {
		t.Errorf("expected miss after Delete")
	}
}

func TestTTLCache_JitterClampedAt05(t *testing.T) {
	// jitterFraction > 0.5 should clamp to 0.5 (so effective TTL stays > 0).
	c := NewTTLCache(1*time.Hour, 1.0)
	if c.jitterFraction != 0.5 {
		t.Errorf("jitterFraction = %v; want clamped to 0.5", c.jitterFraction)
	}
	// Negative clamps to 0.
	c2 := NewTTLCache(1*time.Hour, -0.1)
	if c2.jitterFraction != 0 {
		t.Errorf("negative jitter should clamp to 0, got %v", c2.jitterFraction)
	}
}

func TestTTLCache_JitterSpreadsExpiry(t *testing.T) {
	// With ±10% jitter on a 100ms TTL, sample 50 expiries and verify they
	// don't all land at the same moment. Statistical test — flake risk is
	// negligible with that sample size + 10% spread.
	c := NewTTLCache(100*time.Millisecond, 0.1)
	expiries := make(map[time.Duration]int)
	frozen := time.Now()
	c.now = func() time.Time { return frozen }
	for i := 0; i < 50; i++ {
		ttl := c.jitteredTTL()
		expiries[ttl]++
		if ttl <= 0 {
			t.Fatalf("jittered TTL must stay positive, got %v", ttl)
		}
		// Sanity bounds: 100ms ± 10% = [90ms, 110ms]
		if ttl < 90*time.Millisecond || ttl > 110*time.Millisecond {
			t.Errorf("jittered TTL %v outside ±10%% of 100ms", ttl)
		}
	}
	if len(expiries) < 5 {
		t.Errorf("jitter produced only %d distinct values across 50 samples; spread too narrow", len(expiries))
	}
}

func TestTTLCache_ConcurrentReadsAndWrites(t *testing.T) {
	c := NewTTLCache(1*time.Second, 0)
	var wg sync.WaitGroup
	const workers = 8
	const iterations = 200
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				c.Set("k", "v")
				_, _ = c.Get("k")
			}
		}(w)
	}
	wg.Wait()
	// If we got here without -race firing, the cache is safe.
}

func TestTTLCache_MissOnUnknownKey(t *testing.T) {
	c := NewTTLCache(1*time.Hour, 0)
	if _, ok := c.Get("nope"); ok {
		t.Errorf("expected miss for unknown key")
	}
}
