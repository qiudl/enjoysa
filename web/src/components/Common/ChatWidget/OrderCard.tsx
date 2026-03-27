import React from 'react';
import { Package, Calendar, DollarSign } from 'lucide-react';
import styles from './ChatWidget.module.css';

interface OrderInfo {
  order_no: string;
  status: string;
  product_name: string;
  booking_date: string;
  quantity: number;
  total_price: number;
  currency: string;
}

interface OrderCardProps {
  order: OrderInfo;
  onCreateTicket?: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待支付', color: '#f59e0b' },
  paid: { label: '已支付', color: '#3b82f6' },
  accepted: { label: '已接单', color: '#8b5cf6' },
  processing: { label: '处理中', color: '#6366f1' },
  completed: { label: '已完成', color: '#22c55e' },
  cancelled: { label: '已取消', color: '#6b7280' },
  refunded: { label: '已退款', color: '#ef4444' },
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onCreateTicket }) => {
  const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: '#6b7280' };

  return (
    <div className={styles.orderCard}>
      <div className={styles.orderHeader}>
        <Package size={16} />
        <span>订单 {order.order_no}</span>
        <span className={styles.orderStatus} style={{ background: statusInfo.color }}>
          {statusInfo.label}
        </span>
      </div>

      <div className={styles.orderBody}>
        <div className={styles.orderRow}>
          <span className={styles.orderLabel}>产品</span>
          <span>{order.product_name}</span>
        </div>
        <div className={styles.orderRow}>
          <Calendar size={14} />
          <span>{order.booking_date}</span>
          <span>× {order.quantity}</span>
        </div>
        <div className={styles.orderRow}>
          <DollarSign size={14} />
          <span className={styles.orderPrice}>
            {order.currency} {order.total_price.toFixed(2)}
          </span>
        </div>
      </div>

      {onCreateTicket && ['paid', 'accepted', 'processing', 'completed'].includes(order.status) && (
        <button className={styles.orderAction} onClick={onCreateTicket}>
          申请售后
        </button>
      )}
    </div>
  );
};
