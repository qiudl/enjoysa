package translate

import (
	"strings"
	"testing"
)

func TestProtectAndRestoreRoundtrip(t *testing.T) {
	cases := []struct {
		name string
		in   string
	}{
		{"url", "Visit https://enjoysau.com.au/tour for details."},
		{"email", "Contact us at hello@enjoysa.com for questions."},
		{"price_dollar", "Tour from $199 per person."},
		{"price_aud_prefix", "Adult AUD 250, child AUD 120."},
		{"price_aud_suffix", "Total: 350 AUD."},
		{"a_dollar", "Special offer A$99."},
		{"phone", "Call +61 2 1234 5678 to book."},
		{"mixed", "Book at https://example.com or email a@b.com — A$120, +61 412 345 678."},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			masked, table := Protect(tc.in)
			if masked == tc.in && len(table) > 0 {
				// We expected substitution but got identical text.
				t.Fatalf("Protect produced no substitutions for %q", tc.in)
			}
			if strings.Contains(masked, "https://") || strings.Contains(masked, "@") {
				// Crude check that at least URLs/emails got masked when present.
				if strings.Contains(tc.in, "https://") || strings.Contains(tc.in, "@") {
					t.Fatalf("Protect left raw url/email in masked: %q", masked)
				}
			}
			restored := Restore(masked, table)
			if restored != tc.in {
				t.Fatalf("round-trip mismatch:\n in:  %q\n out: %q", tc.in, restored)
			}
		})
	}
}

func TestRestoreFuzzyTolerance(t *testing.T) {
	// Simulate an LLM that inserted extra whitespace inside the placeholder.
	original := "Tour from $199."
	masked, table := Protect(original)
	// Pick the first placeholder out of the table and mutate it in masked.
	for ph := range table {
		// Replace exact ph with a whitespace-mutated version.
		masked = strings.ReplaceAll(masked, ph, "§§ "+strings.Trim(ph, "§")+" §§")
		break
	}
	restored := Restore(masked, table)
	if !strings.Contains(restored, "$199") {
		t.Fatalf("fuzzy restore failed: %q", restored)
	}
}

func TestHasUnrestoredPlaceholders(t *testing.T) {
	if HasUnrestoredPlaceholders("clean text") {
		t.Fatal("expected false for clean text")
	}
	if !HasUnrestoredPlaceholders("oops §§PH00§§ left") {
		t.Fatal("expected true for residual placeholder")
	}
}
