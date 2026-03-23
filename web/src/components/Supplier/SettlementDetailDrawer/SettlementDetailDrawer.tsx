import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download } from 'lucide-react';
import { exportToCsv } from '../../../utils/csvExport';
import type { Settlement } from '../../../pages/Supplier/SupplierSettlementPage/SupplierSettlementPage';
import styles from './SettlementDetailDrawer.module.css';

interface OrderDetail {
  orderNo: string;
  product: string;
  date: string;
  amount: number;
  commission: number;
  netAmount: number;
}

// Mock order details for a settlement period
function generateMockDetails(settlement: Settlement): OrderDetail[] {
  const products = [
    '袋鼠岛一日游', '巴罗莎谷酒庄之旅', '阿德莱德城市观光',
    '弗林德斯山脉探险', '维克多港观鲸', '汉多夫德国村半日游',
  ];
  const count = settlement.orderCount || 5;
  return Array.from({ length: Math.min(count, 10) }, (_, i) => {
    const amount = Math.round(100 + Math.random() * 400);
    const commissionRate = 0.1;
    const comm = Math.round(amount * commissionRate);
    return {
      orderNo: `ORD-${Date.now().toString(36).toUpperCase()}-${i + 1}`,
      product: products[i % products.length],
      date: `2026-03-${String(10 + i).padStart(2, '0')}`,
      amount,
      commission: comm,
      netAmount: amount - comm,
    };
  });
}

interface Props {
  settlement: Settlement;
  onClose: () => void;
}

export const SettlementDetailDrawer: React.FC<Props> = ({ settlement, onClose }) => {
  const { t } = useTranslation();
  const details = React.useMemo(() => generateMockDetails(settlement), [settlement]);

  const totalAmount = details.reduce((s, d) => s + d.amount, 0);
  const totalCommission = details.reduce((s, d) => s + d.commission, 0);
  const totalNet = details.reduce((s, d) => s + d.netAmount, 0);

  const handleExport = () => {
    const headers = [
      t('supplier.settlement.detail.orderNo'),
      t('supplier.settlement.detail.product'),
      t('supplier.settlement.detail.date'),
      t('supplier.settlement.detail.amount'),
      t('supplier.settlement.commission'),
      t('supplier.settlement.netAmount'),
    ];
    const rows = details.map(d => [
      d.orderNo, d.product, d.date,
      String(d.amount), String(d.commission), String(d.netAmount),
    ]);
    rows.push(['', '', t('supplier.settlement.detail.total'), String(totalAmount), String(totalCommission), String(totalNet)]);
    exportToCsv(`settlement-${settlement.id}.csv`, headers, rows);
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>{t('supplier.settlement.detail.title')}</span>
            <span className={styles.subtitle}>{settlement.period}</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.exportBtn} onClick={handleExport}>
              <Download size={14} />
              {t('supplier.settlement.detail.exportCsv')}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('supplier.settlement.orderCount')}</span>
            <span className={styles.summaryValue}>{details.length}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('supplier.settlement.totalAmount')}</span>
            <span className={styles.summaryValue}>¥{totalAmount.toLocaleString()}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('supplier.settlement.commission')}</span>
            <span className={styles.summaryValue} style={{ color: '#ef4444' }}>-¥{totalCommission.toLocaleString()}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('supplier.settlement.netAmount')}</span>
            <span className={styles.summaryValue} style={{ color: '#10b981' }}>¥{totalNet.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('supplier.settlement.detail.orderNo')}</th>
                <th>{t('supplier.settlement.detail.product')}</th>
                <th>{t('supplier.settlement.detail.date')}</th>
                <th>{t('supplier.settlement.detail.amount')}</th>
                <th>{t('supplier.settlement.commission')}</th>
                <th>{t('supplier.settlement.netAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={d.orderNo}>
                  <td>{d.orderNo}</td>
                  <td>{d.product}</td>
                  <td>{d.date}</td>
                  <td>¥{d.amount.toLocaleString()}</td>
                  <td className={styles.amountNegative}>-¥{d.commission.toLocaleString()}</td>
                  <td className={styles.amountPositive}>¥{d.netAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerItem}>
            <span className={styles.footerLabel}>{t('supplier.settlement.detail.total')}:</span>
            <span className={styles.footerValue}>¥{totalAmount.toLocaleString()}</span>
          </div>
          <div className={styles.footerItem}>
            <span className={styles.footerLabel}>{t('supplier.settlement.commission')}:</span>
            <span className={styles.footerValue} style={{ color: '#ef4444' }}>-¥{totalCommission.toLocaleString()}</span>
          </div>
          <div className={styles.footerItem}>
            <span className={styles.footerLabel}>{t('supplier.settlement.netAmount')}:</span>
            <span className={styles.footerValue} style={{ color: '#10b981' }}>¥{totalNet.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettlementDetailDrawer;
