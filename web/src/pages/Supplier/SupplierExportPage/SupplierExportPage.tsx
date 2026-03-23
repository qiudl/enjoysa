import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, DollarSign, Package, FileDown, Loader2 } from 'lucide-react';
import { supplierExportService } from '../../../services/supplierExportService';
import styles from './SupplierExportPage.module.css';

export interface SupplierExportPageProps {
  onNavigate?: (path: string) => void;
}

interface ExportCard {
  key: string;
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  color: string;
}

const exportCards: ExportCard[] = [
  {
    key: 'orders',
    icon: <ShoppingCart size={24} />,
    titleKey: 'supplier.exports.ordersTitle',
    descKey: 'supplier.exports.ordersDesc',
    color: '#3b82f6',
  },
  {
    key: 'settlement',
    icon: <DollarSign size={24} />,
    titleKey: 'supplier.exports.settlementTitle',
    descKey: 'supplier.exports.settlementDesc',
    color: '#10b981',
  },
  {
    key: 'products',
    icon: <Package size={24} />,
    titleKey: 'supplier.exports.productsTitle',
    descKey: 'supplier.exports.productsDesc',
    color: '#f59e0b',
  },
];

export const SupplierExportPage: React.FC<SupplierExportPageProps> = () => {
  const { t } = useTranslation();
  const [dateRanges, setDateRanges] = useState<Record<string, { start: string; end: string }>>({
    orders: { start: '', end: '' },
    settlement: { start: '', end: '' },
    products: { start: '', end: '' },
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = (cardKey: string, field: 'start' | 'end', value: string) => {
    setDateRanges((prev) => ({
      ...prev,
      [cardKey]: { ...prev[cardKey], [field]: value },
    }));
  };

  const handleExport = async (cardKey: string) => {
    setLoading(cardKey);
    setError(null);

    try {
      const range = dateRanges[cardKey];
      switch (cardKey) {
        case 'orders':
          await supplierExportService.exportOrders(range.start || undefined, range.end || undefined);
          break;
        case 'settlement':
          await supplierExportService.exportSettlements(range.start || undefined, range.end || undefined);
          break;
        case 'products':
          await supplierExportService.exportProducts();
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.exports.title')}</h1>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Export Cards */}
      <div className={styles.exportGrid}>
        {exportCards.map((card) => (
          <div key={card.key} className={styles.exportCard}>
            <div className={styles.cardHeader}>
              <div
                className={styles.cardIcon}
                style={{ backgroundColor: `${card.color}15`, color: card.color }}
              >
                {card.icon}
              </div>
              <div>
                <h3 className={styles.cardTitle}>{t(card.titleKey)}</h3>
                <p className={styles.cardDesc}>{t(card.descKey)}</p>
              </div>
            </div>

            <div className={styles.cardBody}>
              {/* Date Range */}
              <div className={styles.dateRange}>
                <label className={styles.dateLabel}>{t('supplier.exports.dateRange')}</label>
                <div className={styles.dateInputs}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={dateRanges[card.key]?.start || ''}
                    onChange={(e) => handleDateChange(card.key, 'start', e.target.value)}
                  />
                  <span className={styles.dateSeparator}>~</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={dateRanges[card.key]?.end || ''}
                    onChange={(e) => handleDateChange(card.key, 'end', e.target.value)}
                  />
                </div>
              </div>

              {/* Format */}
              <div className={styles.formatRow}>
                <label className={styles.dateLabel}>{t('supplier.exports.format')}</label>
                <select className={styles.formatSelect} disabled>
                  <option>CSV</option>
                </select>
              </div>
            </div>

            <button
              className={styles.exportBtn}
              onClick={() => handleExport(card.key)}
              style={{ backgroundColor: card.color }}
              disabled={loading === card.key}
            >
              {loading === card.key ? <Loader2 size={16} className={styles.spinner} /> : <FileDown size={16} />}
              {loading === card.key ? t('common.loading', 'Loading...') : t('supplier.exports.exportBtn')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupplierExportPage;
