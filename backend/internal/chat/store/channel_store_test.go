package store

import "testing"

func TestSlugify(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"Refund Topic", "refund-topic"},
		{"Refund   Topic", "refund-topic"},   // collapses repeated spaces
		{"  Refund Topic  ", "refund-topic"}, // trims edges
		{"API-Tech", "api-tech"},
		{"api_tech", "api-tech"},                            // underscore → dash
		{"refund2025", "refund2025"},                        // digits preserved
		{"REQ_2026-05-09 Discussion", "req-2026-05-09-discussion"},
		{"客服-默认", ""},                                       // pure CJK collapses to empty (Channel.Create falls back to "channel")
		{"客服-API-discussion", "api-discussion"},             // mixed CJK + ascii drops CJK
		{"!!!!!", ""},                                       // pure punctuation
		{"channel-with-a-very-very-very-long-name-truncated-here", "channel-with-a-very-very-very-long-name"}, // 40-char cap, trailing dash trimmed
	}
	for _, c := range cases {
		got := slugify(c.in)
		// truncation cap: 40 chars
		if len(got) > 40 {
			t.Errorf("slugify(%q) length %d > 40", c.in, len(got))
		}
		// the empty/CJK fallback is "" — Channel.Create catches that and uses
		// "channel" as the base. Just assert what slugify itself returns.
		if got != c.want {
			t.Errorf("slugify(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestSlugify_Cap40Chars(t *testing.T) {
	long := "supercalifragilisticexpialidocious-channel-name-that-runs-on-and-on"
	got := slugify(long)
	if len(got) > 40 {
		t.Fatalf("slugify cap broken: %d chars: %s", len(got), got)
	}
}
