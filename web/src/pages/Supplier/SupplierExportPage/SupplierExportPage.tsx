import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, DollarSign, Package, FileDown } from 'lucide-react';
import { exportToCsv } from '../../../utils/csvExport';
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

function generateMockOrdersCsv(): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Order No', 'Product', 'Customer', 'Travel Date', 'Quantity', 'Amount (AUD)', 'Status', 'Created'],
    rows: [
      ['ORD-20260301-001', 'Kangaroo Island Day Tour', 'Alice Wang', '2026-03-05', '2', '398.00', 'Completed', '2026-03-01'],
      ['ORD-20260302-002', 'Barossa Valley Wine Tour', 'Bob Zhang', '2026-03-08', '4', '596.00', 'Confirmed', '2026-03-02'],
      ['ORD-20260305-003', 'Adelaide City Sightseeing', 'Carol Li', '2026-03-10', '1', '89.00', 'Pending', '2026-03-05'],
      ['ORD-20260308-004', 'Cleland Wildlife Park Tour', 'David Chen', '2026-03-12', '3', '267.00', 'Completed', '2026-03-08'],
      ['ORD-20260310-005', 'Victor Harbor Penguin Tour', 'Eva Liu', '2026-03-15', '2', '178.00', 'Cancelled', '2026-03-10'],
    ],
  };
}

function generateMockSettlementCsv(): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Settlement No', 'Period', 'Order Count', 'Gross Amount (AUD)', 'Commission (AUD)', 'Net Amount (AUD)', 'Status'],
    rows: [
      ['STL-202603-001', '2026-03-01 ~ 2026-03-15', '12', '4560.00', '456.00', '4104.00', 'Completed'],
      ['STL-202602-002', '2026-02-16 ~ 2026-02-28', '8', '3200.00', '320.00', '2880.00', 'Completed'],
      ['STL-202602-001', '2026-02-01 ~ 2026-02-15', '15', '5890.00', '589.00', '5301.00', 'Completed'],
    ],
  };
}

function generateMockProductsCsv(): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Product ID', 'Product Name', 'Category', 'Price (AUD)', 'Stock', 'Sold', 'Status', 'Rating'],
    rows: [
      ['P001', 'Kangaroo Island Day Tour', 'Tour', '199.00', 'Unlimited', '156', 'Active', '4.8'],
      ['P002', 'Barossa Valley Wine Tour', 'Tour', '149.00', '20', '89', 'Active', '4.6'],
      ['P003', 'Adelaide City Sightseeing', 'Tour', '89.00', '30', '234', 'Active', '4.3'],
      ['P004', 'Cleland Wildlife Park Tour', 'Tour', '89.00', '15', '67', 'Active', '4.9'],
      ['P005', 'Victor Harbor Penguin Tour', 'Tour', '89.00', '10', '45', 'Inactive', '4.1'],
    ],
  };
}

export const SupplierExportPage: React.FC<SupplierExportPageProps> = () => {
  const { t } = useTranslation();
  const [dateRanges, setDateRanges] = useState<Record<string, { start: string; end: string }>>({
    orders: { start: '', end: '' },
    settlement: { start: '', end: '' },
    products: { start: '', end: '' },
  });

  const handleDateChange = (cardKey: string, field: 'start' | 'end', value: string) => {
    setDateRanges((prev) => ({
      ...prev,
      [cardKey]: { ...prev[cardKey], [field]: value },
    }));
  };

  const handleExport = (cardKey: string) => {
    const now = new Date().toISOString().slice(0, 10);
    let data: { headers: string[]; rows: string[][] };
    let filename: string;

    switch (cardKey) {
      case 'orders':
        data = generateMockOrdersCsv();
        filename = `orders_export_${now}.csv`;
        break;
      case 'settlement':
        data = generateMockSettlementCsv();
        filename = `settlement_export_${now}.csv`;
        break;
      case 'products':
        data = generateMockProductsCsv();
        filename = `products_export_${now}.csv`;
        break;
      default:
        return;
    }

    exportToCsv(filename, data.headers, data.rows);
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.exports.title')}</h1>
      </div>

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
            >
              <FileDown size={16} />
              {t('supplier.exports.exportBtn')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupplierExportPage;
