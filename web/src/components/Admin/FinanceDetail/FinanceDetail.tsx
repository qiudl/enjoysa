import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Building2,
  Calendar,
  Receipt,
  CheckCircle2,
  Clock,
  Download,
  CreditCard,
} from 'lucide-react';
import clsx from 'clsx';
import type { Settlement, SettlementStatus } from '../FinanceTable';
import styles from './FinanceDetail.module.css';

export interface FinanceDetailProps {
  settlement: Settlement | null;
  open: boolean;
  onClose: () => void;
  onProcess?: (settlement: Settlement) => void;
  onDownload?: (settlement: Settlement) => void;
}

export const FinanceDetail: React.FC<FinanceDetailProps> = ({
  settlement,
  open,
  onClose,
  onProcess,
  onDownload,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'orders'>('info');

  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  if (!open || !settlement) return null;

  const getStatusLabel = (status: SettlementStatus) => {
    const labels: Record<SettlementStatus, string> = {
      pending: t('admin.finance.status.pending'),
      processing: t('admin.finance.status.processing'),
      completed: t('admin.finance.status.completed'),
      failed: t('admin.finance.status.failed'),
    };
    return labels[status];
  };

  const formatPrice = (price: number) => {
    return `A$${price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const tabs = [
    { key: 'info', label: t('admin.finance.detail.tabs.info') },
    { key: 'orders', label: t('admin.finance.detail.tabs.orders') },
  ];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('admin.finance.detail.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.settlementHeader}>
          <div className={styles.settlementInfo}>
            <div className={styles.settlementIcon}>
              <Receipt size={28} />
            </div>
            <div className={styles.settlementMeta}>
              <h3 className={styles.settlementNo}>{settlement.settlementNo}</h3>
              <span className={clsx(styles.statusBadge, styles[settlement.status])}>
                {getStatusLabel(settlement.status)}
              </span>
            </div>
          </div>

          <div className={styles.amountDisplay}>
            <span className={styles.amountLabel}>{t('admin.finance.detail.netAmount')}</span>
            <span className={styles.amountValue}>{formatPrice(settlement.netAmount)}</span>
          </div>
        </div>

        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={clsx(styles.tab, activeTab === tab.key && styles.active)}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'info' && (
            <div className={styles.infoSection}>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Building2 size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.finance.detail.supplier')}</span>
                    <span className={styles.infoValue}>{settlement.supplierName}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Calendar size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.finance.detail.period')}</span>
                    <span className={styles.infoValue}>{settlement.period}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Receipt size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.finance.detail.orderCount')}</span>
                    <span className={styles.infoValue}>{settlement.orderCount} {t('admin.finance.detail.orders')}</span>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}><Clock size={16} /></span>
                  <div>
                    <span className={styles.infoLabel}>{t('admin.finance.detail.createdAt')}</span>
                    <span className={styles.infoValue}>{formatDate(settlement.createdAt)}</span>
                  </div>
                </div>
                {settlement.paidAt && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoIcon}><CheckCircle2 size={16} /></span>
                    <div>
                      <span className={styles.infoLabel}>{t('admin.finance.detail.paidAt')}</span>
                      <span className={styles.infoValue}>{formatDate(settlement.paidAt)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.breakdown}>
                <h4 className={styles.breakdownTitle}>{t('admin.finance.detail.breakdown')}</h4>
                <div className={styles.breakdownItem}>
                  <span>{t('admin.finance.detail.totalAmount')}</span>
                  <span>{formatPrice(settlement.totalAmount)}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>{t('admin.finance.detail.commission')} ({settlement.commissionRate}%)</span>
                  <span className={styles.negative}>-{formatPrice(settlement.commissionAmount)}</span>
                </div>
                <div className={clsx(styles.breakdownItem, styles.total)}>
                  <span>{t('admin.finance.detail.netAmount')}</span>
                  <span className={styles.positive}>{formatPrice(settlement.netAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className={styles.placeholder}>
              <CreditCard size={48} />
              <p>{t('admin.finance.detail.ordersPlaceholder')}</p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={clsx(styles.btn, styles.btnSecondary)}
            onClick={() => onDownload?.(settlement)}
          >
            <Download size={16} />
            <span>{t('admin.finance.actions.download')}</span>
          </button>
          {settlement.status === 'pending' && (
            <button
              className={clsx(styles.btn, styles.btnPrimary)}
              onClick={() => onProcess?.(settlement)}
            >
              <CheckCircle2 size={16} />
              <span>{t('admin.finance.actions.process')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default FinanceDetail;
