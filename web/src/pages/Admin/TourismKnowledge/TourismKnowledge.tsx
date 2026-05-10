// REQ-20260510-0002 · Phase 1 · 1D — Tourism Knowledge admin hub
//
// One page that hosts five entity lists behind a tab nav. Lazy-mounting the
// active tab keeps the initial render light: an admin who only edits
// attractions doesn't pay for the other four lists' state machines.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AttractionList from './AttractionList';
import AccommodationList from './AccommodationList';
import FoodList from './FoodList';
import ExperienceList from './ExperienceList';
import PricingBenchmarkList from './PricingBenchmarkList';
import styles from './TourismKnowledge.module.css';

type TabKey = 'attractions' | 'accommodations' | 'food' | 'experiences' | 'pricing';

const TABS: Array<{ key: TabKey; labelKey: string; fallback: string }> = [
  { key: 'attractions', labelKey: 'admin.tourism.tabs.attractions', fallback: '景点' },
  { key: 'accommodations', labelKey: 'admin.tourism.tabs.accommodations', fallback: '酒店' },
  { key: 'food', labelKey: 'admin.tourism.tabs.food', fallback: '美食' },
  { key: 'experiences', labelKey: 'admin.tourism.tabs.experiences', fallback: '体验' },
  { key: 'pricing', labelKey: 'admin.tourism.tabs.pricing', fallback: '价格行情' },
];

export const TourismKnowledge: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('attractions');

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
      </div>

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
    </div>
  );
};

export default TourismKnowledge;
