// REQ-20260510-0002 · Phase 1 · 1D + 1E — Tourism Knowledge admin hub
//
// One page that hosts five entity lists behind a tab nav. Lazy-mounting the
// active tab keeps the initial render light: an admin who only edits
// attractions doesn't pay for the other four lists' state machines.
//
// 1E adds a "Run ETL" button that triggers the cold-start reverse-extract
// from approved products into experiences + pricing benchmarks. The result
// summary stays on screen until the next run so admins can compare passes.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import AttractionList from './AttractionList';
import AccommodationList from './AccommodationList';
import FoodList from './FoodList';
import ExperienceList from './ExperienceList';
import PricingBenchmarkList from './PricingBenchmarkList';
import ScrapeStagingList from './ScrapeStagingList';
import {
  tourismKnowledgeService,
  type EtlSummary,
} from '../../../services/tourismKnowledgeService';
import styles from './TourismKnowledge.module.css';

type TabKey =
  | 'attractions'
  | 'accommodations'
  | 'food'
  | 'experiences'
  | 'pricing'
  | 'scrape';

const TABS: Array<{ key: TabKey; labelKey: string; fallback: string }> = [
  { key: 'attractions', labelKey: 'admin.tourism.tabs.attractions', fallback: '景点' },
  { key: 'accommodations', labelKey: 'admin.tourism.tabs.accommodations', fallback: '酒店' },
  { key: 'food', labelKey: 'admin.tourism.tabs.food', fallback: '美食' },
  { key: 'experiences', labelKey: 'admin.tourism.tabs.experiences', fallback: '体验' },
  { key: 'pricing', labelKey: 'admin.tourism.tabs.pricing', fallback: '价格行情' },
  // REQ-20260510-0011 · 2C: scrape pipeline tab.
  { key: 'scrape', labelKey: 'admin.tourism.tabs.scrape', fallback: '知识抓取' },
];

export const TourismKnowledge: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('attractions');
  const [etlRunning, setEtlRunning] = useState(false);
  const [etlSummary, setEtlSummary] = useState<EtlSummary | null>(null);
  const [etlError, setEtlError] = useState<string | null>(null);

  const runEtl = async () => {
    if (etlRunning) return;
    if (
      !window.confirm(
        t(
          'admin.tourism.etl.confirm',
          '将扫描所有已上架商品并反向写入 experiences + pricing benchmarks。\n新行 IsActive=false（admin 审核后启用），已存在行的 IsActive 不会被覆盖。\n继续？',
        ),
      )
    ) {
      return;
    }
    setEtlRunning(true);
    setEtlError(null);
    try {
      const summary = await tourismKnowledgeService.runEtl();
      setEtlSummary(summary);
    } catch (err) {
      setEtlError(err instanceof Error ? err.message : 'ETL failed');
      setEtlSummary(null);
    } finally {
      setEtlRunning(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>
            {t('admin.tourism.title', '南澳旅游知识库')}
          </h1>
          <p className={styles.pageDescription}>
            {t(
              'admin.tourism.description',
              '维护景点 / 酒店 / 美食 / 体验 / 价格行情数据，作为 AI Agent 的事实依据',
            )}
          </p>
        </div>
        <button
          className={styles.addBtn}
          onClick={runEtl}
          disabled={etlRunning}
          title={t('admin.tourism.etl.tooltip', '从已上架商品反向沉淀知识库')}
        >
          <Database size={16} />
          {etlRunning
            ? t('admin.tourism.etl.running', '正在跑 ETL...')
            : t('admin.tourism.etl.button', '运行冷启动 ETL')}
        </button>
      </div>

      {etlSummary && (
        <div className={styles.etlSummary} role="status">
          <strong>{t('admin.tourism.etl.summaryTitle', 'ETL 完成')}</strong>{' '}
          {t(
            'admin.tourism.etl.summary',
            '扫描 {{scanned}} 个商品，写入 {{exp}} 条 experiences，{{bench}} 条 pricing benchmarks，跳过 {{skip}} 条。',
            {
              scanned: etlSummary.products_scanned,
              exp: etlSummary.experiences_upserted,
              bench: etlSummary.benchmarks_upserted,
              skip: etlSummary.products_skipped,
            },
          )}
          {etlSummary.errors && etlSummary.errors.length > 0 && (
            <details className={styles.etlErrors}>
              <summary>
                {t('admin.tourism.etl.errorsLabel', '{{n}} 条错误', {
                  n: etlSummary.errors.length,
                })}
              </summary>
              <ul>
                {etlSummary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {etlError && (
        <div className={styles.etlError} role="alert">
          {etlError}
        </div>
      )}

      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey, tab.fallback)}
          </button>
        ))}
      </div>

      {activeTab === 'attractions' && <AttractionList />}
      {activeTab === 'accommodations' && <AccommodationList />}
      {activeTab === 'food' && <FoodList />}
      {activeTab === 'experiences' && <ExperienceList />}
      {activeTab === 'pricing' && <PricingBenchmarkList />}
      {activeTab === 'scrape' && <ScrapeStagingList />}
    </div>
  );
};

export default TourismKnowledge;
