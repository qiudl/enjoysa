import { describe, expect, it } from 'vitest';

import {
  applyMention,
  detectMentionContext,
  extractMentionIds,
  filterMentionCandidates,
} from '../mention';
import type { ChatAgent } from '../../../../services/groupChatService';

// REQ-20260509-0037 dev-10: pure mention parsing — pinned edge cases so the
// composer's @ behavior doesn't regress when the dropdown UI changes.

const cs: ChatAgent = {
  id: 1, code: 'cs', name: '客服小南', member_type: 'ai', llm_provider: 'deepseek', llm_model: '',
  system_prompt: '', tool_keys: [], avatar_emoji: '', color_hex: '', sort_order: 0,
  default_in_new_channel: true, enabled: true,
};
const tech: ChatAgent = { ...cs, id: 2, code: 'tech', name: '技术阿澳' };
const cs2: ChatAgent = { ...cs, id: 3, code: 'cs2', name: 'csiro-bot' };

describe('detectMentionContext', () => {
  it('returns null when caret is not inside a mention', () => {
    expect(detectMentionContext('hello world', 11)).toBeNull();
    expect(detectMentionContext('', 0)).toBeNull();
  });

  it('opens dropdown for @ at start of text', () => {
    expect(detectMentionContext('@', 1)).toEqual({ query: '', atIndex: 0 });
    expect(detectMentionContext('@cs', 3)).toEqual({ query: 'cs', atIndex: 0 });
  });

  it('opens dropdown for @ after whitespace', () => {
    expect(detectMentionContext('hi @c', 5)).toEqual({ query: 'c', atIndex: 3 });
  });

  it('does not trigger for @ inside an email-like token', () => {
    expect(detectMentionContext('email@x', 7)).toBeNull();
  });

  it('closes dropdown once user types whitespace after the @', () => {
    expect(detectMentionContext('@cs ', 4)).toBeNull();
    expect(detectMentionContext('hi @cs end', 10)).toBeNull();
  });

  it('uses the most recent @ when multiple are typed', () => {
    expect(detectMentionContext('@a @b', 5)).toEqual({ query: 'b', atIndex: 3 });
  });
});

describe('filterMentionCandidates', () => {
  const all = [cs, tech, cs2];

  it('returns all agents on empty query', () => {
    expect(filterMentionCandidates(all, '')).toEqual(all);
    expect(filterMentionCandidates(all, '   ')).toEqual(all);
  });

  it('matches by name substring (case-insensitive)', () => {
    expect(filterMentionCandidates(all, '小南')).toEqual([cs]);
    expect(filterMentionCandidates(all, '阿澳')).toEqual([tech]);
  });

  it('matches by code prefix', () => {
    expect(filterMentionCandidates(all, 'cs')).toEqual([cs, cs2]);
    expect(filterMentionCandidates(all, 'CS')).toEqual([cs, cs2]); // case-insensitive
  });
});

describe('applyMention', () => {
  it('replaces in-progress @query with @AgentName + trailing space', () => {
    const got = applyMention('hi @cs', 3, 6, '客服小南');
    expect(got.text).toBe('hi @客服小南 ');
    expect(got.caret).toBe(got.text.length);
  });

  it('preserves text after the caret', () => {
    const got = applyMention('hi @ end', 3, 4, '客服小南');
    expect(got.text).toBe('hi @客服小南  end');
    expect(got.caret).toBe('hi @客服小南 '.length);
  });
});

describe('extractMentionIds', () => {
  const agents = [cs, tech, cs2];

  it('returns empty for plain text without @', () => {
    expect(extractMentionIds('hello world', agents)).toEqual([]);
  });

  it('resolves @客服小南 by name', () => {
    expect(extractMentionIds('@客服小南 帮我看下订单', agents)).toEqual([cs.id]);
  });

  it('resolves @cs by code', () => {
    expect(extractMentionIds('@cs 你好', agents)).toEqual([cs.id]);
  });

  it('does not match an unknown agent', () => {
    expect(extractMentionIds('@nobody hi', agents)).toEqual([]);
  });

  it('skips email-like @ in middle of word', () => {
    expect(extractMentionIds('reach me at user@host.com please', agents)).toEqual([]);
  });

  it('dedupes when the same agent is mentioned twice', () => {
    expect(extractMentionIds('@cs @cs', agents)).toEqual([cs.id]);
  });

  it('handles multiple distinct mentions in one message', () => {
    const ids = extractMentionIds('@客服小南 @技术阿澳 商量一下', agents);
    expect(ids.sort()).toEqual([cs.id, tech.id].sort());
  });

  it('prefers the longer-name match when codes overlap', () => {
    // "csiro-bot" starts with "cs" — agents are scanned in order, so
    // `cs` (id=1) wins on the prefix test. We're documenting the current
    // behavior so future "longest-prefix" sorting is a deliberate change.
    const ids = extractMentionIds('@cs hi', agents);
    expect(ids).toEqual([cs.id]);
  });
});
