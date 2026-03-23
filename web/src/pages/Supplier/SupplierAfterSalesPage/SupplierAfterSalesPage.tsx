import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, XCircle, AlertTriangle, Play } from 'lucide-react';
import styles from './SupplierAfterSalesPage.module.css';

export interface SupplierAfterSalesPageProps {
  onNavigate?: (path: string) => void;
}

type TicketType = 'refund' | 'complaint' | 'exchange';
type TicketStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

interface Ticket {
  id: string;
  ticketNo: string;
  type: TicketType;
  customer: string;
  product: string;
  productEn: string;
  amount: number;
  status: TicketStatus;
  slaHoursLeft: number;
  createdAt: string;
  description: string;
}

const typeColors: Record<TicketType, string> = {
  refund: '#ef4444',
  complaint: '#f59e0b',
  exchange: '#3b82f6',
};

const statusIcons: Record<TicketStatus, React.ReactNode> = {
  pending: <Clock size={14} />,
  processing: <Play size={14} />,
  resolved: <CheckCircle size={14} />,
  rejected: <XCircle size={14} />,
};

const mockTickets: Ticket[] = [
  { id: 't1', ticketNo: 'AS-20260320-001', type: 'refund', customer: 'Alice Wang', product: '袋鼠岛一日游', productEn: 'Kangaroo Island Day Tour', amount: 398, status: 'pending', slaHoursLeft: 18, createdAt: '2026-03-20 14:30', description: 'Weather cancellation, requesting full refund' },
  { id: 't2', ticketNo: 'AS-20260319-002', type: 'complaint', customer: 'Bob Zhang', product: '巴罗萨谷品酒之旅', productEn: 'Barossa Valley Wine Tour', amount: 0, status: 'processing', slaHoursLeft: 6, createdAt: '2026-03-19 10:15', description: 'Tour guide was late by 30 minutes' },
  { id: 't3', ticketNo: 'AS-20260318-003', type: 'exchange', customer: 'Carol Li', product: '阿德莱德城市观光', productEn: 'Adelaide City Sightseeing', amount: 0, status: 'pending', slaHoursLeft: 2, createdAt: '2026-03-18 16:00', description: 'Want to change travel date from Mar 25 to Apr 1' },
  { id: 't4', ticketNo: 'AS-20260317-004', type: 'refund', customer: 'David Chen', product: '维克多港企鹅观赏', productEn: 'Victor Harbor Penguin Tour', amount: 178, status: 'resolved', slaHoursLeft: 0, createdAt: '2026-03-17 09:00', description: 'Trip cancelled due to illness' },
  { id: 't5', ticketNo: 'AS-20260315-005', type: 'complaint', customer: 'Eva Liu', product: '格雷内尔格日落之旅', productEn: 'Glenelg Sunset Tour', amount: 0, status: 'rejected', slaHoursLeft: 0, createdAt: '2026-03-15 11:45', description: 'Unhappy with photo quality - not covered by policy' },
  { id: 't6', ticketNo: 'AS-20260314-006', type: 'refund', customer: 'Frank Ma', product: '克莱兰德野生动物园', productEn: 'Cleland Wildlife Park Tour', amount: 89, status: 'resolved', slaHoursLeft: 0, createdAt: '2026-03-14 08:20', description: 'Partial refund for missing activity' },
];

export const SupplierAfterSalesPage: React.FC<SupplierAfterSalesPageProps> = () => {
  const { t, i18n } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');

  const filteredTickets = filter === 'all' ? tickets : tickets.filter((tk) => tk.status === filter);

  const pendingCount = tickets.filter((tk) => tk.status === 'pending').length;
  const avgResponseHours = 4.2;
  const slaRate = 87;

  const handleAction = (id: string, action: 'process' | 'resolve' | 'reject') => {
    setTickets((prev) =>
      prev.map((tk) => {
        if (tk.id !== id) return tk;
        switch (action) {
          case 'process': return { ...tk, status: 'processing' as TicketStatus };
          case 'resolve': return { ...tk, status: 'resolved' as TicketStatus, slaHoursLeft: 0 };
          case 'reject': return { ...tk, status: 'rejected' as TicketStatus, slaHoursLeft: 0 };
          default: return tk;
        }
      })
    );
  };

  const filters: { key: 'all' | TicketStatus; labelKey: string }[] = [
    { key: 'all', labelKey: 'supplier.afterSales.all' },
    { key: 'pending', labelKey: 'supplier.afterSales.statusPending' },
    { key: 'processing', labelKey: 'supplier.afterSales.statusProcessing' },
    { key: 'resolved', labelKey: 'supplier.afterSales.statusResolved' },
    { key: 'rejected', labelKey: 'supplier.afterSales.statusRejected' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.afterSales.title')}</h1>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{tickets.length}</span>
          <span className={styles.statLabel}>{t('supplier.afterSales.totalTickets')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statValue} ${pendingCount > 0 ? styles.statWarning : ''}`}>{pendingCount}</span>
          <span className={styles.statLabel}>{t('supplier.afterSales.pendingTickets')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{avgResponseHours}h</span>
          <span className={styles.statLabel}>{t('supplier.afterSales.avgResponse')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statValue} ${slaRate >= 80 ? styles.statGood : styles.statWarning}`}>{slaRate}%</span>
          <span className={styles.statLabel}>{t('supplier.afterSales.slaRate')}</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.toolbar}>
        {filters.map((f) => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      {filteredTickets.length > 0 ? (
        <div className={styles.ticketList}>
          {filteredTickets.map((ticket) => (
            <div key={ticket.id} className={styles.ticketCard}>
              <div className={styles.ticketHeader}>
                <div className={styles.ticketId}>
                  <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                  <span
                    className={styles.typeBadge}
                    style={{ backgroundColor: `${typeColors[ticket.type]}15`, color: typeColors[ticket.type] }}
                  >
                    {t(`supplier.afterSales.type${ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1)}`)}
                  </span>
                </div>
                <div className={styles.ticketStatus}>
                  <span className={`${styles.statusBadge} ${styles[`status_${ticket.status}`]}`}>
                    {statusIcons[ticket.status]}
                    {t(`supplier.afterSales.status${ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}`)}
                  </span>
                  {ticket.slaHoursLeft > 0 && (
                    <span className={`${styles.slaBadge} ${ticket.slaHoursLeft <= 4 ? styles.slaUrgent : ''}`}>
                      <AlertTriangle size={12} />
                      {ticket.slaHoursLeft}h {t('supplier.afterSales.slaLeft')}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.ticketBody}>
                <div className={styles.ticketCustomer}>
                  <span className={styles.customerName}>{ticket.customer}</span>
                  <span className={styles.ticketProduct}>
                    {i18n.language === 'en' ? ticket.productEn : ticket.product}
                  </span>
                </div>
                <p className={styles.ticketDesc}>{ticket.description}</p>
                {ticket.amount > 0 && (
                  <span className={styles.ticketAmount}>AUD ${ticket.amount.toFixed(2)}</span>
                )}
              </div>

              <div className={styles.ticketFooter}>
                <span className={styles.ticketDate}>{ticket.createdAt}</span>
                <div className={styles.ticketActions}>
                  {ticket.status === 'pending' && (
                    <button className={styles.processBtn} onClick={() => handleAction(ticket.id, 'process')}>
                      {t('supplier.afterSales.actionProcess')}
                    </button>
                  )}
                  {(ticket.status === 'pending' || ticket.status === 'processing') && (
                    <>
                      <button className={styles.resolveBtn} onClick={() => handleAction(ticket.id, 'resolve')}>
                        {t('supplier.afterSales.actionResolve')}
                      </button>
                      <button className={styles.rejectBtn} onClick={() => handleAction(ticket.id, 'reject')}>
                        {t('supplier.afterSales.actionReject')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <CheckCircle size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>{t('supplier.afterSales.noTickets')}</p>
        </div>
      )}
    </div>
  );
};

export default SupplierAfterSalesPage;
