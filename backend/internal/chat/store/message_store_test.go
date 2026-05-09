package store

import "testing"

func TestSenderTypeToRole(t *testing.T) {
	cases := map[string]string{
		"user":    "user",
		"human":   "user",
		"ai":      "assistant",
		"system":  "system",
		"unknown": "user", // default fallback
		"":        "user",
	}
	for in, want := range cases {
		if got := senderTypeToRole(in); got != want {
			t.Errorf("senderTypeToRole(%q) = %q, want %q", in, got, want)
		}
	}
}
