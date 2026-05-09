/**
 * @mention parsing — REQ-20260509-0037 dev-10.
 *
 * Pure helpers for the composer's @mention dropdown. Kept apart from the
 * React component so the parsing edge cases (cursor inside a name, escape
 * with a space, multiple @s in a single message) can be unit-tested
 * without rendering anything.
 */
import type { ChatAgent } from '../../../services/groupChatService';

/**
 * Inspect the text up to caret position. If the user is currently typing an
 * @mention (an `@` with no whitespace between it and the caret), return the
 * query (text after `@`) and the start index of the `@`. Otherwise null.
 *
 * Examples:
 *   detectMentionContext("hi @cs", 6) -> { query: "cs", atIndex: 3 }
 *   detectMentionContext("hi @ x", 6) -> null  (whitespace after @)
 *   detectMentionContext("@", 1)      -> { query: "", atIndex: 0 }
 *   detectMentionContext("foo bar", 7) -> null
 *   detectMentionContext("@a @b", 5)  -> { query: "b", atIndex: 3 }  (latest)
 *   detectMentionContext("email@x", 7) -> null  (preceded by non-whitespace)
 */
export function detectMentionContext(text: string, caret: number): { query: string; atIndex: number } | null {
  if (caret <= 0 || caret > text.length) return null;
  const head = text.slice(0, caret);
  // Find the most recent `@` that has whitespace (or start-of-string) immediately before it.
  for (let i = head.length - 1; i >= 0; i--) {
    const ch = head.charAt(i);
    if (ch === '@') {
      if (i > 0 && !/\s/.test(head.charAt(i - 1))) return null; // not a fresh mention
      const query = head.slice(i + 1);
      if (/\s/.test(query)) return null; // user typed past the name with a space
      return { query, atIndex: i };
    }
    if (/\s/.test(ch)) return null; // hit whitespace before any @
  }
  return null;
}

/** Filter agents by name prefix match (case-insensitive). Empty query returns all. */
export function filterMentionCandidates(agents: ChatAgent[], query: string): ChatAgent[] {
  const q = query.trim().toLowerCase();
  if (!q) return agents;
  return agents.filter(a => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
}

/**
 * Insert a mention into `text`: replaces the in-progress `@query` (starting
 * at `atIndex`) with `@AgentName ` and returns the new text + caret position.
 */
export function applyMention(text: string, atIndex: number, caret: number, agentName: string): { text: string; caret: number } {
  const before = text.slice(0, atIndex);
  const after = text.slice(caret);
  const insert = `@${agentName} `;
  return { text: before + insert + after, caret: before.length + insert.length };
}

/**
 * Scan a finished message for all @mention tokens and resolve them to agent
 * ids. Used at send time so mentions[] in the request matches what the user
 * actually typed (handles cases where the dropdown wasn't used but the
 * agent's name was typed verbatim).
 */
export function extractMentionIds(text: string, agents: ChatAgent[]): number[] {
  if (!text) return [];
  const seen = new Set<number>();
  // Match `@<name>` until whitespace; agent names may contain CJK so we
  // accept anything that's not whitespace.
  const re = /(^|\s)@(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[2];
    const hit = agents.find(a => token.startsWith(a.name) || token.startsWith(a.code));
    if (hit) seen.add(hit.id);
  }
  return Array.from(seen);
}
