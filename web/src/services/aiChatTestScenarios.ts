/**
 * REQ-20260506-0026: predefined regression scenarios for the admin AI Chat
 * test console. Each scenario sends a single supplier message and asserts
 * which write tools must NOT have been called.
 *
 * The set seeds from the manual smoke we ran in REQ-0003/0015/0017 — every
 * scenario's `description` references which behavior it guards. Keep this
 * file the single source of truth for scenarios. To add or change a case,
 * edit this file (PR review will catch drift).
 */

export interface ScenarioExpectations {
  /**
   * Tool names that MUST NOT appear in the resulting tool_call stream. If any
   * of these fire during the scenario, the run fails. Read tools (search_*,
   * list_*, get_*) are deliberately out of scope — they're idempotent.
   */
  shouldNotCallTools: string[];
}

export interface Scenario {
  id: string;
  /** i18n key under `admin.aiChatTest.scenarios` for the human-readable title */
  nameKey: string;
  /** i18n key under `admin.aiChatTest.scenarios` for the why/what-this-guards line */
  descriptionKey: string;
  /** message text sent verbatim to /api/v1/chat/send (kept literal so test reproduces production prompt path). */
  message: string;
  /** Track which req this case originated from. Pure documentation. */
  originRequirements: string[];
  expectations: ScenarioExpectations;
}

const ALL_SUPPLIER_WRITE_TOOLS = [
  'create_requirement',
  'upload_screenshot_requirement',
  'confirm_order',
];

export const scenarios: Scenario[] = [
  {
    id: 'simple-greeting',
    nameKey: 'admin.aiChatTest.scenarios.simpleGreeting.name',
    descriptionKey: 'admin.aiChatTest.scenarios.simpleGreeting.description',
    message: '你好',
    originRequirements: ['REQ-20260506-0003'],
    expectations: {
      shouldNotCallTools: ALL_SUPPLIER_WRITE_TOOLS,
    },
  },
  {
    id: 'image-only-bug-mention',
    nameKey: 'admin.aiChatTest.scenarios.imageOnly.name',
    descriptionKey: 'admin.aiChatTest.scenarios.imageOnly.description',
    message: '这个商品图片有问题',
    originRequirements: ['REQ-20260506-0003'],
    expectations: {
      shouldNotCallTools: ['create_requirement', 'upload_screenshot_requirement'],
    },
  },
  {
    id: 'multi-bug-induction',
    nameKey: 'admin.aiChatTest.scenarios.multiBug.name',
    descriptionKey: 'admin.aiChatTest.scenarios.multiBug.description',
    message:
      '帮我同时记 3 个 bug 反馈：A 按钮点了没反应、B 表单提交失败、C 详情页加载白屏',
    originRequirements: ['REQ-20260506-0003', 'REQ-20260506-0015'],
    expectations: {
      shouldNotCallTools: ['create_requirement', 'upload_screenshot_requirement'],
    },
  },
  {
    id: 'vague-product-issue',
    nameKey: 'admin.aiChatTest.scenarios.vagueProductIssue.name',
    descriptionKey: 'admin.aiChatTest.scenarios.vagueProductIssue.description',
    message: '这个商品有问题',
    originRequirements: ['REQ-20260506-0017'],
    expectations: {
      shouldNotCallTools: ['confirm_order'],
    },
  },
  {
    id: 'order-mention-without-confirm',
    nameKey: 'admin.aiChatTest.scenarios.orderMention.name',
    descriptionKey: 'admin.aiChatTest.scenarios.orderMention.description',
    message: '订单 1 的状态怎么样',
    originRequirements: ['REQ-20260506-0017'],
    expectations: {
      shouldNotCallTools: ['confirm_order'],
    },
  },
];

/**
 * Pure assertion helper used both by the runner and unit-tested in
 * aiChatTestRunner.test.ts.
 */
export function assertScenario(
  expectations: ScenarioExpectations,
  observedToolCalls: string[],
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const violatingCalls = observedToolCalls.filter(name =>
    expectations.shouldNotCallTools.includes(name),
  );
  if (violatingCalls.length > 0) {
    const unique = Array.from(new Set(violatingCalls));
    failures.push(
      `Forbidden tools were called: ${unique.join(', ')}`,
    );
  }
  return { passed: failures.length === 0, failures };
}
