// REQ-20260510-0002 · Phase 1 · 1D
//
// Small helpers shared by the 5 entity list components inside the Tourism
// Knowledge admin hub. Keep these intentionally thin — the goal is to remove
// duplication, not to build a generic CRUD framework.

/** Convert "vine, food, family" → ["vine","food","family"]. Trims and drops empties. */
export function parseTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Inverse: array → comma-joined display string. */
export function tagsToInput(tags: string[] | undefined | null): string {
  if (!tags || tags.length === 0) return '';
  return tags.join(', ');
}

/** Empty string from a number input → null so the backend stores NULL rather than 0. */
export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return null;
  return n;
}

/** Same as parseOptionalNumber but rounds to integer for typical_duration_minutes / star_rating / sample_size. */
export function parseOptionalInt(raw: string): number | null {
  const n = parseOptionalNumber(raw);
  if (n === null) return null;
  return Math.round(n);
}

/** Format an optional number for display in an input value — empty string when absent. */
export function numberOrEmpty(n: number | undefined | null): string {
  if (n === undefined || n === null) return '';
  return String(n);
}

/** Confidence bucket per the agent's D4 rules — kept here so the admin UI can show what the AI will see. */
export function confidenceBucket(sampleSize: number): 'high' | 'normal' | 'low' | 'insufficient' {
  if (sampleSize >= 12) return 'high';
  if (sampleSize >= 5) return 'normal';
  if (sampleSize >= 3) return 'low';
  return 'insufficient';
}
