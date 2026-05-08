package translate

import (
	"fmt"
	"regexp"
	"strings"
)

// Placeholder sequences are intentionally non-ASCII so they cannot appear in
// human-written supplier copy. The marker uses U+00A7 (§) which is rare in
// English/Chinese product descriptions.
const (
	phPrefix = "§§PH"
	phSuffix = "§§"
)

// Patterns the LLM should not translate. Order matters — URL must come before
// email so that "https://foo@bar.com" is captured as a URL.
var protectPatterns = []*regexp.Regexp{
	regexp.MustCompile(`https?://[^\s<>"'\)]+`),                  // URL
	regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`), // email
	regexp.MustCompile(`A?\$\s?\d+(?:[.,]\d+)*`),                  // $99 / A$99 / $1,200
	regexp.MustCompile(`AUD\s?\d+(?:[.,]\d+)*`),                   // AUD 99
	regexp.MustCompile(`\d+(?:[.,]\d+)*\s?AUD`),                   // 99 AUD
	regexp.MustCompile(`\+?\d{1,3}[\s\-]\d{3,4}[\s\-]\d{3,4}(?:[\s\-]\d{2,4})?`), // phone
}

// Protect replaces sensitive substrings (URLs, emails, prices, phones) with
// placeholders and returns the masked string plus the placeholder→original map.
func Protect(s string) (masked string, table map[string]string) {
	table = make(map[string]string)
	masked = s
	idx := 0
	for _, re := range protectPatterns {
		masked = re.ReplaceAllStringFunc(masked, func(match string) string {
			placeholder := fmt.Sprintf("%s%02d%s", phPrefix, idx, phSuffix)
			table[placeholder] = match
			idx++
			return placeholder
		})
	}
	return masked, table
}

// Restore replaces placeholders in the LLM output with their original values.
// Tolerant of LLM whitespace mutation (e.g. "§§ PH 00 §§") because models
// frequently insert spaces inside ASCII tokens during translation.
func Restore(s string, table map[string]string) string {
	for placeholder, original := range table {
		// Exact match first.
		if strings.Contains(s, placeholder) {
			s = strings.ReplaceAll(s, placeholder, original)
			continue
		}
		// Fuzzy: extract the digits inside the placeholder and match a flexible
		// version that allows whitespace between every meaningful character.
		// E.g. "§§PH00§§" matches "§§ PH 00 §§" or "§§PH 00§§".
		digits := strings.TrimPrefix(strings.TrimSuffix(placeholder, phSuffix), phPrefix)
		var pattern strings.Builder
		pattern.WriteString(`§§\s*P\s*H\s*`)
		for i, r := range digits {
			if i > 0 {
				pattern.WriteString(`\s*`)
			}
			pattern.WriteRune(r)
		}
		pattern.WriteString(`\s*§§`)
		// Use Literal variant: original may contain "$199" which would be
		// interpreted as a backreference by ReplaceAllString.
		s = regexp.MustCompile(pattern.String()).ReplaceAllLiteralString(s, original)
	}
	return s
}

// HasUnrestoredPlaceholders reports whether any §§PH...§§ markers remain in
// the string after Restore. Used as a sanity check; presence indicates the
// LLM mangled placeholders beyond fuzzy recovery.
func HasUnrestoredPlaceholders(s string) bool {
	return strings.Contains(s, phPrefix)
}
