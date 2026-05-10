package tourism_agent

import (
	"testing"
	"time"
)

// REQ-20260510-0011 dev-2A — cache tests cover only the deterministic
// helpers (jitter math). The DB-backed Get/Set path needs Postgres and
// is exercised by the prod smoke + handler tests against a sqlite test
// shim if/when one lands. Locking down jitter here because:
//   - it's the user-facing knob in defect D1 (ttl ±15%)
//   - any drift to ±50% would silently double LLM cost amplitude after
//     a deploy

func TestJitterDuration_DeterministicForSameKey(t *testing.T) {
	a := jitterDuration(6*time.Hour, "explain:42")
	b := jitterDuration(6*time.Hour, "explain:42")
	if a != b {
		t.Errorf("jitter must be deterministic for same key: %v vs %v", a, b)
	}
}

func TestJitterDuration_DiffersAcrossKeys(t *testing.T) {
	a := jitterDuration(6*time.Hour, "explain:42")
	b := jitterDuration(6*time.Hour, "explain:43")
	if a == b {
		t.Errorf("expected jitter to differ across keys, both got %v", a)
	}
}

func TestJitterDuration_StaysWithinFifteenPercent(t *testing.T) {
	const base = 6 * time.Hour
	const allowedAbs = base * 15 / 100 // 15% of 6h = 54min
	for _, key := range []string{
		"explain:1", "explain:2", "explain:99",
		"fit:1:abcdef", "nearby:7", "fit:42:0123456789abcdef",
	} {
		got := jitterDuration(base, key)
		delta := got - base
		if delta < 0 {
			delta = -delta
		}
		if delta > allowedAbs {
			t.Errorf("key=%q: jittered %v (delta %v) exceeds 15%% bound %v",
				key, got, got-base, allowedAbs)
		}
	}
}

func TestJitterDuration_ZeroTTLPassesThrough(t *testing.T) {
	if got := jitterDuration(0, "any"); got != 0 {
		t.Errorf("zero TTL should pass through, got %v", got)
	}
}

func TestJitterDuration_NegativeTTLPassesThrough(t *testing.T) {
	// Defensive: a caller passing a negative TTL probably has a bug
	// upstream, but the cache should not amplify it via jitter.
	if got := jitterDuration(-time.Hour, "any"); got != -time.Hour {
		t.Errorf("negative TTL should pass through, got %v", got)
	}
}
