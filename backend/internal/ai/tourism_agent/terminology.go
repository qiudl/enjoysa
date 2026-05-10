package tourism_agent

// REQ-20260510-0002 · 南澳旅游 AI Agent · Phase 1
//
// Terminology constants used to ground the LLM. These are intentionally
// hard-coded in Go (not YAML) for v1 — they're stable, small, and reading
// from a YAML at startup adds an init step without enabling admin override.
// 二期如要开放给 admin 编辑，再迁到 DB 表 + admin CRUD。

// SACouncils is a representative (non-exhaustive) list of South Australia
// council / region names. Used in the system prompt so the LLM emits canonical
// names in generated tourism copy.
var SACouncils = []string{
	"Adelaide", "Adelaide Hills", "Adelaide Plains",
	"Barossa", "Burnside", "Campbelltown",
	"Charles Sturt", "Eyre Peninsula", "Fleurieu Peninsula",
	"Gawler", "Holdfast Bay", "Kangaroo Island",
	"Limestone Coast", "Mid Murray", "Mount Barker",
	"Murray Bridge", "Norwood Payneham St Peters",
	"Onkaparinga", "Outback", "Playford",
	"Port Adelaide Enfield", "Prospect", "Riverland",
	"Salisbury", "Tea Tree Gully", "Unley",
	"Victor Harbor", "Walkerville", "West Torrens", "Yorke Peninsula",
}

// AttractionCategories — closed enum used by knowledge entries and tools.
var AttractionCategories = []string{
	"nature", "urban", "history", "food", "wine", "family",
}

// ExperienceCategories — closed enum for experience-type entries.
var ExperienceCategories = []string{
	"wine", "wildlife", "cruise", "hike", "cultural", "adventure",
}

// DurationBuckets keeps pricing benchmarks coarsely aggregated.
const (
	DurationBucketHalfDay  = "half_day"  // <= 4h
	DurationBucketFullDay  = "full_day"  // <= 10h
	DurationBucketMultiDay = "multi_day" // > 10h (overnight tours)
)

// DurationBucketForMinutes maps a minute count to a duration bucket.
// Used by both the pricing tool and the SuggestPricing handler.
func DurationBucketForMinutes(minutes int) string {
	switch {
	case minutes <= 240:
		return DurationBucketHalfDay
	case minutes <= 600:
		return DurationBucketFullDay
	default:
		return DurationBucketMultiDay
	}
}
