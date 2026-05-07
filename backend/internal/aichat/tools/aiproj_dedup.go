package tools

import (
	"context"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"enjoysa-backend/internal/core/logger"
)

// REQ-20260507-0002 cross-turn duplicate detection helpers for
// create_requirement. The handler queries ai-proj for the caller's recent
// drafts (filtered by a `chat-actor:<X>` tag we inject on create) and
// compares titles via token Jaccard; on a hit it short-circuits the create
// and asks the LLM to confirm with the user.
//
// The single-turn guard (REQ-20260506-0003) lives in chat_handler and is
// orthogonal — it only looks at write-tool calls within one LLM reply.

// candidate is the slim view of an ai-proj requirement we keep for
// similarity comparison and the detected_similar_requirement payload.
type candidate struct {
	DisplayID string  `json:"display_id"`
	Title     string  `json:"title"`
	Status    string  `json:"status"`
	CreatedAt string  `json:"created_at,omitempty"`
}

// dedupCache is a tiny TTL cache keyed by actor tag. Per-process is enough
// under the single-instance docker compose deployment; multi-instance would
// need ai-proj-side idempotency (see follow-ups in REQ-20260507-0002).
type dedupCache struct {
	mu      sync.Mutex
	entries map[string]dedupCacheEntry
	ttl     time.Duration
}

type dedupCacheEntry struct {
	candidates []candidate
	expiresAt  time.Time
}

func newDedupCache(ttlSec int) *dedupCache {
	if ttlSec <= 0 {
		ttlSec = 60
	}
	return &dedupCache{
		entries: make(map[string]dedupCacheEntry),
		ttl:     time.Duration(ttlSec) * time.Second,
	}
}

func (c *dedupCache) get(key string) ([]candidate, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.candidates, true
}

func (c *dedupCache) put(key string, items []candidate) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = dedupCacheEntry{
		candidates: items,
		expiresAt:  time.Now().Add(c.ttl),
	}
}

func (c *dedupCache) invalidate(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
}

// findRecentDraftsForActor pulls the caller's drafts created within
// `windowHours` from ai-proj, filters client-side by `actorTag` and the
// time window, and caches the result for `cacheTTL`. ai-proj's
// `/mcp/requirements` does not currently support tag filtering server-side,
// so we pull a slim page (status=draft) and filter here. Hard-bounded by
// `timeout` so a slow upstream cannot stall the chat reply.
func (c *aiProjClient) findRecentDraftsForActor(
	ctx context.Context,
	actorTag string,
	windowHours int,
	maxCandidates int,
	timeout time.Duration,
) ([]candidate, error) {
	if c.dedupCache != nil {
		if cached, ok := c.dedupCache.get(actorTag); ok {
			return cached, nil
		}
	}

	q := url.Values{}
	q.Set("project_id", strconv.Itoa(c.projectID))
	q.Set("page", "1")
	q.Set("page_size", strconv.Itoa(maxCandidates*5)) // overfetch; we filter client-side
	q.Set("status", "draft")
	// Do NOT set response_mode=compact — that mode strips the tags field
	// from list items (verified empirically against the live ai-proj
	// instance during REQ-20260507-0002 e2e smoke), which would defeat
	// the chat-actor:<X> client-side filter and silently miss every
	// dedup hit. Default mode returns the full record including tags.

	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	result, err := c.doJSONCtx(reqCtx, "GET", "/mcp/requirements?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}

	data, _ := result["data"].(map[string]interface{})
	if data == nil {
		return nil, nil
	}
	// ai-proj's paginated list endpoint returns rows under data.data
	// (not data.requirements — that name was the old wrapper convention
	// and silently breaks here, see list_requirements tool comment).
	// Fall back to data.requirements if the upstream ever standardizes back.
	rawList, ok := data["data"].([]interface{})
	if !ok {
		rawList, _ = data["requirements"].([]interface{})
	}

	cutoff := time.Now().Add(-time.Duration(windowHours) * time.Hour)
	out := make([]candidate, 0, maxCandidates)
	for _, r := range rawList {
		req, ok := r.(map[string]interface{})
		if !ok {
			continue
		}
		if !candidateMatchesActor(req, actorTag) {
			continue
		}
		if !candidateWithinWindow(req, cutoff) {
			continue
		}
		title, _ := req["title"].(string)
		displayID, _ := req["display_id"].(string)
		status, _ := req["status"].(string)
		createdAt, _ := req["created_at"].(string)
		out = append(out, candidate{
			DisplayID: displayID,
			Title:     title,
			Status:    status,
			CreatedAt: createdAt,
		})
		if len(out) >= maxCandidates {
			break
		}
	}

	if c.dedupCache != nil {
		c.dedupCache.put(actorTag, out)
	}
	return out, nil
}

func candidateMatchesActor(req map[string]interface{}, actorTag string) bool {
	tagsRaw, _ := req["tags"].([]interface{})
	for _, t := range tagsRaw {
		if s, ok := t.(string); ok && s == actorTag {
			return true
		}
	}
	return false
}

func candidateWithinWindow(req map[string]interface{}, cutoff time.Time) bool {
	createdAt, _ := req["created_at"].(string)
	if createdAt == "" {
		return true // missing timestamp — be permissive, the upstream filter is soft
	}
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		// Some ai-proj responses use a fractional-seconds variant; fall back.
		t, err = time.Parse("2006-01-02T15:04:05.999999Z07:00", createdAt)
		if err != nil {
			logger.Warnf("[ai-chat dedup] unparseable created_at %q, accepting", createdAt)
			return true
		}
	}
	return t.After(cutoff)
}

// actorTagFor builds the canonical "chat-actor:<userType>:<chatUserID>" tag
// used both when writing (create_requirement) and reading
// (findRecentDraftsForActor). Empty inputs return "" — caller should treat
// that as "no actor identity, skip dedup".
func actorTagFor(userType string, chatUserID *uint) string {
	if chatUserID == nil || userType == "" {
		return ""
	}
	return "chat-actor:" + userType + ":" + strconv.FormatUint(uint64(*chatUserID), 10)
}

// imageMarkdownPattern matches `![alt](url)` so similarity comparison is
// not dominated by random screenshot URLs the LLM tacks onto descriptions.
var imageMarkdownPattern = regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`)

func stripImageMarkdown(s string) string {
	return imageMarkdownPattern.ReplaceAllString(s, "")
}

// dedupStopWords are structural words the supplier feedback chat tends to
// throw into titles ("前台首页 testimonials 板块" / "admin 板块 内容") — they
// would otherwise inflate Jaccard between unrelated titles.
var dedupStopWords = map[string]struct{}{
	"前台": {}, "后台": {}, "首页": {}, "页面": {}, "板块": {}, "管理": {},
	"功能": {}, "需求": {}, "系统": {}, "模块": {}, "内容": {},
	"the": {}, "and": {}, "for": {}, "page": {}, "section": {}, "block": {},
	"admin": {},
}

// tokenize lowercases, strips punctuation, splits ASCII runs on whitespace,
// then bigrams CJK runs. Stop words are dropped. Returns a deduplicated
// slice — Jaccard will work on a set view.
func tokenize(s string) []string {
	s = strings.ToLower(s)
	seen := map[string]struct{}{}
	out := []string{}
	add := func(t string) {
		if t == "" {
			return
		}
		if _, ok := dedupStopWords[t]; ok {
			return
		}
		if _, ok := seen[t]; ok {
			return
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}

	var asciiRun strings.Builder
	var cjkRun []rune

	flushASCII := func() {
		if asciiRun.Len() == 0 {
			return
		}
		for _, w := range strings.Fields(asciiRun.String()) {
			add(w)
		}
		asciiRun.Reset()
	}
	flushCJK := func() {
		if len(cjkRun) == 0 {
			return
		}
		// add unigrams (≥2 runes, otherwise pointless) and bigrams
		if len(cjkRun) >= 2 {
			for i := 0; i < len(cjkRun)-1; i++ {
				add(string(cjkRun[i : i+2]))
			}
		} else {
			add(string(cjkRun))
		}
		cjkRun = cjkRun[:0]
	}

	for _, r := range s {
		switch {
		case unicode.Is(unicode.Han, r) || unicode.Is(unicode.Hiragana, r) || unicode.Is(unicode.Katakana, r):
			flushASCII()
			cjkRun = append(cjkRun, r)
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			flushCJK()
			asciiRun.WriteRune(r)
		default:
			flushCJK()
			flushASCII()
			// punctuation/whitespace — ignore
		}
	}
	flushCJK()
	flushASCII()
	return out
}

// tokenJaccard returns |A ∩ B| / |A ∪ B|. Both sides empty → 0.
func tokenJaccard(a, b []string) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	setA := make(map[string]struct{}, len(a))
	for _, t := range a {
		setA[t] = struct{}{}
	}
	inter := 0
	setB := make(map[string]struct{}, len(b))
	for _, t := range b {
		if _, ok := setB[t]; ok {
			continue
		}
		setB[t] = struct{}{}
		if _, ok := setA[t]; ok {
			inter++
		}
	}
	union := len(setA) + len(setB) - inter
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

// dedupVerdict captures the outcome of comparing the current create payload
// against recent candidates. `topSimilarity` lets callers pass it back to
// the LLM for transparency.
type dedupVerdict struct {
	Hit           bool        // ≥ HitThreshold — must surface to user
	Gray          bool        // GrayThreshold ≤ x < HitThreshold — surface candidates, let LLM decide
	Candidates    []candidate // matches above gray threshold, sorted by similarity desc
	TopSimilarity float64
}

// buildCreateTags returns the tag slice written into the POST
// /mcp/requirements/create body. Always includes from-ai-chat +
// supplier-feedback (legacy markers); appends the actor tag when
// available so subsequent dedup queries can scope by caller identity.
func buildCreateTags(actorTag string) []string {
	tags := []string{"from-ai-chat", "supplier-feedback"}
	if actorTag != "" {
		tags = append(tags, actorTag)
	}
	return tags
}

// dedupPrecheck runs the full pre-create pipeline: fetch candidates from
// ai-proj (with cache + 1.5s upstream cap), classify against the new
// title/description, and return the structured "detected_similar"
// payload when we should *not* create. Returns nil to mean "go ahead and
// create" — covering both genuine misses and fail-open scenarios where
// the upstream check itself errored.
func dedupPrecheck(client *aiProjClient, actorTag, title, description string) map[string]interface{} {
	timeout := time.Duration(client.dedupCfg.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 1500 * time.Millisecond
	}
	items, err := client.findRecentDraftsForActor(
		context.Background(),
		actorTag,
		client.dedupCfg.WindowHours,
		client.dedupCfg.MaxCandidates,
		timeout,
	)
	if err != nil {
		// fail-open: never block create on upstream hiccups
		logger.Warnf("[ai-chat dedup] candidate fetch failed for %s: %v (fail-open)", actorTag, err)
		return nil
	}
	verdict := classifySimilarity(title, description, items,
		client.dedupCfg.HitThreshold, client.dedupCfg.GrayThreshold)
	if !verdict.Hit && !verdict.Gray {
		return nil
	}

	action := "detected_similar_requirement"
	if verdict.Gray {
		action = "detected_similar_requirement_gray"
	}
	candidatesPayload := make([]map[string]interface{}, 0, len(verdict.Candidates))
	for _, c := range verdict.Candidates {
		candidatesPayload = append(candidatesPayload, map[string]interface{}{
			"display_id": c.DisplayID,
			"title":      c.Title,
			"status":     c.Status,
		})
	}
	msg := "检测到你最近创建过标题主题相似的需求草稿，请直接告诉用户候选 REQ-ID 与标题，问『要更新这个、还是确实要新建』。用户明确说新建后再次调用 create_requirement 并设 force_new=true。"
	if verdict.Gray {
		msg = "检测到你最近创建过的草稿与本次主题可能重叠（相似度处于灰区），请把候选告诉用户、由用户确认是更新还是新建。"
	}
	return map[string]interface{}{
		"success":        false,
		"action":         action,
		"top_similarity": verdict.TopSimilarity,
		"candidates":     candidatesPayload,
		"current_args": map[string]interface{}{
			"title":       title,
			"description": description,
		},
		"message": msg,
	}
}

// classifySimilarity compares (title+description) against the candidates
// and returns the verdict. It is pure — no I/O — so unit tests can drive it
// directly.
func classifySimilarity(title, description string, items []candidate, hit, gray float64) dedupVerdict {
	cur := tokenize(title + " " + stripImageMarkdown(description))
	type scored struct {
		c   candidate
		sim float64
	}
	rated := make([]scored, 0, len(items))
	for _, item := range items {
		sim := tokenJaccard(cur, tokenize(item.Title))
		if sim >= gray {
			rated = append(rated, scored{c: item, sim: sim})
		}
	}
	// Insertion-sort desc by sim — n is bounded by max_candidates.
	for i := 1; i < len(rated); i++ {
		for j := i; j > 0 && rated[j].sim > rated[j-1].sim; j-- {
			rated[j], rated[j-1] = rated[j-1], rated[j]
		}
	}
	if len(rated) == 0 {
		return dedupVerdict{}
	}
	out := dedupVerdict{
		Candidates:    make([]candidate, 0, len(rated)),
		TopSimilarity: rated[0].sim,
	}
	for _, r := range rated {
		out.Candidates = append(out.Candidates, r.c)
	}
	out.Hit = rated[0].sim >= hit
	out.Gray = !out.Hit
	return out
}
