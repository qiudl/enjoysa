import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, XCircle, Play, Loader2 } from 'lucide-react';
import { listSupplierOrders, refundOrder, type Order } from '../../../services/orderService';
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
  amount: number;
  status: TicketStatus;
  createdAt: string;
  description: string;
  orderId: number;
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

/** Map an order to a ticket for display */
function orderToTicket(order: Order): Ticket {
  let type: TicketType = 'refund';
  let status: TicketStatus = 'pending';
  let description = order.cancel_reason || order.supplier_remark || '';

  if (order.status === 'refunded') {
    type = 'refund';
    status = 'resolved';
    description = description || 'Refund completed';
  } else if (order.status === 'cancelled') {
    if (order.refund_amount && order.refund_amount > 0) {
      type = 'refund';
      status = 'resolved';
    } else {
      type = 'exchange';
      status = 'rejected';
    }
    description = order.cancel_reason || 'Order cancelled';
  }

  return {
    id: String(order.id),
    ticketNo: order.order_no,
    type,
    customer: order.contact_name || order.user_name || '-',
    product: order.product_name,
    amount: order.refund_amount || order.total_price,
    status,
    createdAt: order.cancelled_at || order.refunded_at || order.created_at,
    description,
    orderId: order.id,
  };
}

export const SupplierAfterSalesPage: React.FC<SupplierAfterSalesPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listSupplierOrders({ status: 'cancelled', page_size: 50 }).catch(() => ({ items: [] as Order[], total: 0, page: 1, page_size: 50, total_pages: 0 })),
      listSupplierOrders({ status: 'refunded', page_size: 50 }).catch(() => ({ items: [] as Order[], total: 0, page: 1, page_size: 50, total_pages: 0 })),
    ]).then(([cancelled, refunded]) => {
      const allOrders = [...(cancelled.items || []), ...(refunded.items || [])];
      // Sort by most recent first
      allOrders.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setTickets(allOrders.map(orderToTicket));
    }).finally(() => setLoading(false));
  }, []);

  const filteredTickets = filter === 'all' ? tickets : tickets.filter((tk) => tk.status === filter);

  const pendingCount = tickets.filter((tk) => tk.status === 'pending').length;
  const resolvedCount = tickets.filter((tk) => tk.status === 'resolved').length;
  const totalCount = tickets.length;

  const handleRefund = async (ticket: Ticket) => {
    setActionLoading(ticket.id);
    try {
      await refundOrder(ticket.orderId, { type: 'full', reason: 'After-sales resolution' });
      setTickets((prev) =>
        prev.map((tk) => tk.id === ticket.id ? { ...tk, status: 'resolved' as TicketStatus } : tk)
      );
    } catch {
      // refund failed
    } finally {
      setActionLoading(null);
    }
  };

  const filters: { key: 'all' | TicketStatus; labelKey: string }[] = [
    { key: 'all', labelKey: 'supplier.afterSales.all' },
    { key: 'pending', labelKey: 'supplier.afterSales.statusPending' },
    { key: 'processing', labelKey: 'supplier.afterSales.statusProcessing' },
    { key: 'resolved', labelKey: 'supplier.afterSales.statusResolved' },
    { key: 'rejected', labelKey: 'supplier.afterSales.statusRejected' },
  ];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return dateStr.replace('T', ' ').slice(0, 16);
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.afterSales.title')}</h1>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalCount}</span>
          <span className={styles.statLabel}>{t('supplier.afterSales.totalTickets')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statValue} ${pendingCount > 0 ? styles.statWarning : ''}`}>{pendingCount}</span>
          <span className={styles.statLabel}>{t('supplier.afterSales.pendingTickets')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{resolvedCount}</span>
          <span className={styles.statLabel}>{t('supplier.afterSales.statusResolved', 'Resolved')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statValue} ${totalCount > 0 ? styles.statGood : ''}`}>
            {totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0}%
          </span>
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

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#64748b' }} />
        </div>
      ) : filteredTickets.length > 0 ? (
        <div className={styles.ticketList}>
          {filteredTickets.map((ticket) => (
            <div key={ticket.id} className={styles.ticketCard} onClick={() => onNavigate?.(`/supplier/orders/${ticket.orderId}`)} style={{ cursor: 'pointer' }}>
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
                </div>
              </div>

              <div className={styles.ticketBody}>
                <div className={styles.ticketCustomer}>
                  <span className={styles.customerName}>{ticket.customer}</span>
                  <span className={styles.ticketProduct}>{ticket.product}</span>
                </div>
                <p className={styles.ticketDesc}>{ticket.description}</p>
                {ticket.amount > 0 && (
                  <span className={styles.ticketAmount}>AUD ${ticket.amount.toFixed(2)}</span>
                )}
              </div>

              <div className={styles.ticketFooter}>
                <span className={styles.ticketDate}>{formatDate(ticket.createdAt)}</span>
                <div className={styles.ticketActions}>
                  {ticket.status === 'pending' && (
                    <button
                      className={styles.resolveBtn}
                      disabled={actionLoading === ticket.id}
                      onClick={(e) => { e.stopPropagation(); handleRefund(ticket); }}
                    >
                      {actionLoading === ticket.id ? '...' : t('supplier.afterSales.actionResolve')}
                    </button>
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
