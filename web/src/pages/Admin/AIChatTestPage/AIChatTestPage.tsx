import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Play, Loader2, Lock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

import { scenarios, type Scenario } from '../../../services/aiChatTestScenarios';
import {
  loginSupplier,
  runScenario,
  type ScenarioRunEvent,
  type ScenarioRunResult,
} from '../../../services/aiChatTestRunner';
import styles from './AIChatTestPage.module.css';

const CREDENTIALS_KEY = 'enjoysa_aichat_test_email';

interface RunState {
  status: 'idle' | 'running' | 'passed' | 'failed';
  result?: ScenarioRunResult;
}

interface LiveLine {
  kind: 'text' | 'toolCall' | 'toolResult' | 'status' | 'error';
  text: string;
}

export const AIChatTestPage: React.FC = () => {
  const { t } = useTranslation();

  const [email, setEmail] = useState<string>(() => sessionStorage.getItem(CREDENTIALS_KEY) || '');
  const [password, setPassword] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  const [runState, setRunState] = useState<Record<string, RunState>>({});
  const [activeScenarioId, setActiveScenarioId] = useState<string>('');
  const [liveOutput, setLiveOutput] = useState<LiveLine[]>([]);
  const [batchRunning, setBatchRunning] = useState<boolean>(false);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setLoginError(t('admin.aiChatTest.errors.credentialsRequired'));
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const tk = await loginSupplier(email, password);
      setToken(tk);
      sessionStorage.setItem(CREDENTIALS_KEY, email);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoggingIn(false);
    }
  }, [email, password, t]);

  const handleRunOne = useCallback(
    async (scenario: Scenario) => {
      if (!token) return;
      setActiveScenarioId(scenario.id);
      setLiveOutput([]);
      setRunState(prev => ({ ...prev, [scenario.id]: { status: 'running' } }));

      const onEvent = (e: ScenarioRunEvent) => {
        setLiveOutput(prev => {
          const next = [...prev];
          switch (e.type) {
            case 'token':
              if (next.length > 0 && next[next.length - 1].kind === 'text') {
                next[next.length - 1] = { kind: 'text', text: next[next.length - 1].text + (e.text || '') };
              } else {
                next.push({ kind: 'text', text: e.text || '' });
              }
              break;
            case 'tool_call':
              next.push({
                kind: 'toolCall',
                text: `🔧 ${e.toolName}(${(e.toolArgs || '').slice(0, 200)})`,
              });
              break;
            case 'tool_result': {
              const marker = e.toolSuccess === false ? '❌' : '✅';
              const result = typeof e.toolResult === 'string'
                ? e.toolResult.slice(0, 200)
                : JSON.stringify(e.toolResult).slice(0, 200);
              next.push({ kind: 'toolResult', text: `   ${marker} [${e.toolName}] ${result}` });
              break;
            }
            case 'status':
              next.push({ kind: 'status', text: `📋 ${e.text || ''}` });
              break;
            case 'error':
              next.push({ kind: 'error', text: `❌ ${e.text || ''}` });
              break;
          }
          return next;
        });
      };

      const result = await runScenario(scenario, token, onEvent);
      setRunState(prev => ({
        ...prev,
        [scenario.id]: { status: result.passed ? 'passed' : 'failed', result },
      }));
      return result;
    },
    [token],
  );

  const handleRunAll = useCallback(async () => {
    if (!token) return;
    setBatchRunning(true);
    for (const scenario of scenarios) {
      await handleRunOne(scenario);
    }
    setBatchRunning(false);
  }, [handleRunOne, token]);

  const summary = useMemo(() => {
    const total = scenarios.length;
    let passed = 0;
    let failed = 0;
    let totalMs = 0;
    let totalToolCalls = 0;
    for (const s of scenarios) {
      const r = runState[s.id];
      if (r?.status === 'passed') passed += 1;
      if (r?.status === 'failed') failed += 1;
      if (r?.result) {
        totalMs += r.result.durationMs;
        totalToolCalls += r.result.toolCalls.length;
      }
    }
    return { total, passed, failed, totalMs, totalToolCalls };
  }, [runState]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('admin.aiChatTest.title')}</h1>
          <p className={styles.subtitle}>{t('admin.aiChatTest.subtitle')}</p>
        </div>
        {token && (
          <button
            type="button"
            className={styles.runAllButton}
            onClick={handleRunAll}
            disabled={batchRunning}
          >
            {batchRunning ? (
              <Loader2 size={16} className={styles.spin} />
            ) : (
              <Play size={16} />
            )}
            {t('admin.aiChatTest.runAll')}
          </button>
        )}
      </header>

      {!token ? (
        <section className={styles.loginCard}>
          <div className={styles.loginIconWrap}>
            <Lock size={20} />
          </div>
          <h2 className={styles.loginTitle}>{t('admin.aiChatTest.login.title')}</h2>
          <p className={styles.loginHint}>{t('admin.aiChatTest.login.hint')}</p>
          <div className={styles.loginForm}>
            <label className={styles.field}>
              <span>{t('admin.aiChatTest.login.email')}</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@kiodysseys.com.au"
                autoComplete="off"
              />
            </label>
            <label className={styles.field}>
              <span>{t('admin.aiChatTest.login.password')}</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="off"
              />
            </label>
            {loginError && (
              <div className={styles.loginError}>
                <AlertCircle size={14} /> {loginError}
              </div>
            )}
            <button
              type="button"
              className={styles.loginButton}
              onClick={handleLogin}
              disabled={loggingIn}
            >
              {loggingIn && <Loader2 size={14} className={styles.spin} />}
              {t('admin.aiChatTest.login.submit')}
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className={styles.summaryBar}>
            <span>
              {t('admin.aiChatTest.summary.session', { email })}
            </span>
            <span className={styles.summaryStats}>
              <span className={styles.statPass}>
                <CheckCircle2 size={14} /> {summary.passed}
              </span>
              <span className={styles.statFail}>
                <XCircle size={14} /> {summary.failed}
              </span>
              <span className={styles.statTotal}>
                / {summary.total}
              </span>
              {summary.totalMs > 0 && (
                <span className={styles.statTime}>
                  {(summary.totalMs / 1000).toFixed(1)}s · {summary.totalToolCalls} {t('admin.aiChatTest.summary.toolCalls')}
                </span>
              )}
            </span>
          </div>

          <div className={styles.layout}>
            <section className={styles.scenarioList}>
              {scenarios.map(scenario => {
                const state = runState[scenario.id];
                const status = state?.status || 'idle';
                return (
                  <article
                    key={scenario.id}
                    className={clsx(
                      styles.scenarioCard,
                      activeScenarioId === scenario.id && styles.scenarioCardActive,
                      status === 'passed' && styles.scenarioCardPassed,
                      status === 'failed' && styles.scenarioCardFailed,
                    )}
                  >
                    <header className={styles.scenarioHeader}>
                      <div className={styles.scenarioMeta}>
                        <h3 className={styles.scenarioName}>
                          {t(scenario.nameKey)}
                        </h3>
                        <p className={styles.scenarioMessage}>
                          <code>{scenario.message}</code>
                        </p>
                        <p className={styles.scenarioDescription}>{t(scenario.descriptionKey)}</p>
                      </div>
                      <div className={styles.scenarioControls}>
                        <ScenarioStatusBadge status={status} />
                        <button
                          type="button"
                          className={styles.runButton}
                          onClick={() => handleRunOne(scenario)}
                          disabled={status === 'running' || batchRunning}
                        >
                          {status === 'running' ? (
                            <Loader2 size={14} className={styles.spin} />
                          ) : (
                            <Play size={14} />
                          )}
                          {t('admin.aiChatTest.run')}
                        </button>
                      </div>
                    </header>

                    {state?.result && (
                      <div className={styles.scenarioResult}>
                        <div className={styles.scenarioStats}>
                          <span>
                            {state.result.toolCalls.length}{' '}
                            {t('admin.aiChatTest.result.toolCalls')}
                          </span>
                          <span>{state.result.durationMs}ms</span>
                        </div>
                        {state.result.toolCalls.length > 0 && (
                          <div className={styles.toolCallList}>
                            {state.result.toolCalls.map((name, idx) => (
                              <span key={`${name}-${idx}`} className={styles.toolBadge}>
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        {state.result.failures.length > 0 && (
                          <ul className={styles.failures}>
                            {state.result.failures.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        )}
                        {state.result.aiResponse && (
                          <details className={styles.aiResponse}>
                            <summary>{t('admin.aiChatTest.result.aiResponse')}</summary>
                            <pre>{state.result.aiResponse}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <aside className={styles.liveOutput}>
              <header className={styles.liveHeader}>
                {t('admin.aiChatTest.liveOutput.title')}
                {activeScenarioId && (
                  <span className={styles.liveActive}>
                    {scenarios.find(s => s.id === activeScenarioId)?.id}
                  </span>
                )}
              </header>
              <div className={styles.liveBody}>
                {liveOutput.length === 0 ? (
                  <span className={styles.liveEmpty}>
                    {t('admin.aiChatTest.liveOutput.empty')}
                  </span>
                ) : (
                  liveOutput.map((line, i) => (
                    <div key={i} className={clsx(styles.liveLine, styles[`liveLine_${line.kind}`])}>
                      {line.text}
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};

const ScenarioStatusBadge: React.FC<{ status: RunState['status'] }> = ({ status }) => {
  const { t } = useTranslation();
  if (status === 'idle') {
    return <span className={styles.badgeIdle}>{t('admin.aiChatTest.status.idle')}</span>;
  }
  if (status === 'running') {
    return (
      <span className={styles.badgeRunning}>
        <Loader2 size={12} className={styles.spin} /> {t('admin.aiChatTest.status.running')}
      </span>
    );
  }
  if (status === 'passed') {
    return (
      <span className={styles.badgePassed}>
        <CheckCircle2 size={12} /> {t('admin.aiChatTest.status.passed')}
      </span>
    );
  }
  return (
    <span className={styles.badgeFailed}>
      <XCircle size={12} /> {t('admin.aiChatTest.status.failed')}
    </span>
  );
};

export default AIChatTestPage;
