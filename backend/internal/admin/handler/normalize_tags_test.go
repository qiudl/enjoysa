package handler

import "testing"

func TestNormalizeTags(t *testing.T) {
	cases := []struct {
		name, in, want string
	}{
		{"empty", "", "[]"},
		{"blank", "   ", "[]"},
		{"valid json array passthrough", `["beach","nature"]`, `["beach","nature"]`},
		{"comma separated ascii", "beach,nature", `["beach","nature"]`},
		{"comma separated cjk + trim", " beach , 自然 ", `["beach","自然"]`},
		{"single token (not json)", "beach", `["beach"]`},
		{"trailing comma / blanks dropped", "a,,b,", `["a","b"]`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := normalizeTags(c.in); got != c.want {
				t.Fatalf("normalizeTags(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}
