import { describe, it, expect } from 'vitest';
import { assertScenario, scenarios } from '../aiChatTestScenarios';

// REQ-20260506-0026: regression for the assertion engine. The runner is
// hard to unit-test end-to-end (needs SSE plumbing) but the assertion is
// pure and is exactly the gate that decides pass/fail, so we cover it here.

describe('assertScenario', () => {
  it('passes when no forbidden tools were observed', () => {
    const r = assertScenario(
      { shouldNotCallTools: ['create_requirement'] },
      ['search_knowledge', 'list_pending_orders'],
    );
    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it('fails and names the violating tool when one fires', () => {
    const r = assertScenario(
      { shouldNotCallTools: ['create_requirement', 'confirm_order'] },
      ['search_knowledge', 'create_requirement'],
    );
    expect(r.passed).toBe(false);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('create_requirement');
  });

  it('deduplicates the violation message when the same tool fires twice', () => {
    const r = assertScenario(
      { shouldNotCallTools: ['create_requirement'] },
      ['create_requirement', 'create_requirement', 'create_requirement'],
    );
    expect(r.passed).toBe(false);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('create_requirement');
    expect(r.failures[0]).not.toContain('create_requirement, create_requirement');
  });

  it('passes with empty observed tool calls', () => {
    const r = assertScenario(
      { shouldNotCallTools: ['create_requirement'] },
      [],
    );
    expect(r.passed).toBe(true);
  });

  it('ignores tools that are not on the forbidden list', () => {
    const r = assertScenario(
      { shouldNotCallTools: ['create_requirement'] },
      ['confirm_order', 'approve_product'],
    );
    expect(r.passed).toBe(true);
  });
});

describe('scenarios catalog', () => {
  it('every scenario has a non-empty message and at least one forbidden tool', () => {
    expect(scenarios.length).toBeGreaterThan(0);
    for (const s of scenarios) {
      expect(s.message.trim().length).toBeGreaterThan(0);
      expect(s.expectations.shouldNotCallTools.length).toBeGreaterThan(0);
      expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('scenario ids are unique', () => {
    const ids = scenarios.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
