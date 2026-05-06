/**
 * REQ-20260506-0026: runner for the admin AI Chat regression console.
 *
 * Logs in as a test supplier, posts a single message to /api/v1/chat/send,
 * parses the SSE stream, and asserts no write-tool was called. Kept thin and
 * isolated from the rest of the chat service so admin testing cannot
 * accidentally pollute the regular supplier chat flow.
 */
import { type Scenario, assertScenario } from './aiChatTestScenarios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export interface ScenarioRunEvent {
  type: 'session' | 'token' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'done';
  text?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: unknown;
  toolSuccess?: boolean;
  sessionId?: number;
}

export interface ScenarioRunResult {
  scenarioId: string;
  passed: boolean;
  toolCalls: string[];
  aiResponse: string;
  failures: string[];
  durationMs: number;
  errored?: string;
}

export class LoginError extends Error {}
export class ChatStreamError extends Error {}

/**
 * Log in as a supplier and return the access_token. Response shape verified
 * against EnjoySA backend on 2026-05-06: `data.token.access_token`.
 */
export async function loginSupplier(email: string, password: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/supplier/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new LoginError(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const json: unknown = await resp.json();
  const token = extractAccessToken(json);
  if (!token) {
    throw new LoginError('access_token missing from login response');
  }
  return token;
}

function extractAccessToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const token = (data as { token?: unknown }).token;
  if (!token || typeof token !== 'object') return null;
  const access = (token as { access_token?: unknown }).access_token;
  return typeof access === 'string' ? access : null;
}

/**
 * Run a single scenario as the supplier identified by `supplierToken`.
 * `onEvent` is called as the SSE stream emits events so the UI can render
 * live output. Resolves with the assertion result once the stream is done.
 */
export async function runScenario(
  scenario: Scenario,
  supplierToken: string,
  onEvent?: (e: ScenarioRunEvent) => void,
): Promise<ScenarioRunResult> {
  const start = performance.now();
  const toolCalls: string[] = [];
  const contentBuf: string[] = [];
  let errored: string | undefined;

  try {
    const resp = await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplierToken}`,
      },
      body: JSON.stringify({
        session_id: 0,
        message: scenario.message,
        language: 'zh',
        user_type: 'supplier',
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new ChatStreamError(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const reader = resp.body?.getReader();
    if (!reader) throw new ChatStreamError('Response had no body');

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        let ev: { type?: string; [k: string]: unknown };
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        switch (ev.type) {
          case 'session':
            onEvent?.({ type: 'session', sessionId: ev.session_id as number });
            break;
          case 'status':
            onEvent?.({ type: 'status', text: (ev.content as string) || '' });
            break;
          case 'token':
          case 'content': {
            const chunk = (ev.content as string) || '';
            contentBuf.push(chunk);
            onEvent?.({ type: 'token', text: chunk });
            break;
          }
          case 'tool_call': {
            const name = (ev.name as string) || '?';
            toolCalls.push(name);
            onEvent?.({
              type: 'tool_call',
              toolName: name,
              toolArgs: (ev.arguments as string) || '',
            });
            break;
          }
          case 'tool_result':
            onEvent?.({
              type: 'tool_result',
              toolName: (ev.name as string) || '?',
              toolResult: ev.result,
              toolSuccess: ev.success !== false,
            });
            break;
          case 'done':
            onEvent?.({ type: 'done' });
            break;
          case 'error':
            errored = (ev.content as string) || (ev.error as string) || 'Unknown error';
            onEvent?.({ type: 'error', text: errored });
            break;
        }
      }
    }
  } catch (err) {
    errored = err instanceof Error ? err.message : String(err);
  }

  const { passed, failures } = assertScenario(scenario.expectations, toolCalls);
  return {
    scenarioId: scenario.id,
    passed: !errored && passed,
    toolCalls,
    aiResponse: contentBuf.join(''),
    failures: errored ? [...failures, `runtime error: ${errored}`] : failures,
    durationMs: Math.round(performance.now() - start),
    errored,
  };
}
