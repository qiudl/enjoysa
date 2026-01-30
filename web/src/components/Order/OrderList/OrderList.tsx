import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './OrderList.module.css';
import { OrderCard } from '../OrderCard';
import { Loading } from '../../Common/Loading';
import type { Order, OrderStatus } from '../../../types';

export interface OrderListProps {
  /** 订单列表 */
  orders: Order[];
  /** 是否加载中 */
  loading?: boolean;
  /** 当前选中的标签 */
  activeTab?: 'all' | 'pending' | 'confirmed' | 'completed';
  /** 订单点击回调 */
  onOrderClick?: (order: Order) => void;
  /** 订单操作回调 */
  onActionClick?: (order: Order, action: 'pay' | 'cancel' | 'refund' | 'review' | 'reorder') => void;
  /** 标签切换回调 */
  onTabChange?: (tab: 'all' | 'pending' | 'confirmed' | 'completed') => void;
  /** 是否显示空状态 */
  showEmptyState?: boolean;
  /** 空状态图片 */
  emptyImage?: string;
  /** 空状态文字 */
  emptyText?: string;
  /** 空状态按钮 */
  emptyAction?: {
    text: string;
    onClick: () => void;
  };
  /** 语言 */
  language?: 'zh' | 'en';
}

type TabKey = 'all' | 'pending' | 'confirmed' | 'completed';

const tabStatusMap: Record<TabKey, OrderStatus[] | null> = {
  all: null,
  pending: ['pending_payment'],
  confirmed: ['paid', 'confirmed', 'in_progress'],
  completed: ['completed', 'cancelled', 'refunded', 'refund_requested'],
};

export const OrderList: React.FC<OrderListProps> = ({
  orders,
  loading = false,
  activeTab = 'all',
  onOrderClick,
  onActionClick,
  onTabChange,
  showEmptyState = true,
  emptyImage,
  emptyText,
  emptyAction,
  language,
}) => {
  const { t, i18n } = useTranslation();
  const [currentTab, setCurrentTab] = useState<TabKey>(activeTab);
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const tabs: TabKey[] = ['all', 'pending', 'confirmed', 'completed'];

  const handleTabChange = (tab: TabKey) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  const filteredOrders = tabStatusMap[currentTab]
    ? orders.filter((order) => tabStatusMap[currentTab]?.includes(order.status))
    : orders;

  const renderEmptyState = () => {
    if (!showEmptyState) return null;

    return (
      <div className={styles.emptyState}>
        {emptyImage ? (
          <img src={emptyImage} alt="" className={styles.emptyImage} />
        ) : (
          <div className={styles.emptyIcon}>
            <svg
              viewBox="0 0 80 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="10"
                y="15"
                width="60"
                height="50"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <path
                d="M25 35h30M25 45h20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
        <p className={styles.emptyText}>
          {emptyText || t('common.noData')}
        </p>
        {emptyAction && (
          <button className={styles.emptyButton} onClick={emptyAction.onClick}>
            {emptyAction.text}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={clsx(styles.tab, currentTab === tab && styles.active)}
            onClick={() => handleTabChange(tab)}
          >
            {t(`order.tabs.${tab}`)}
            {tab !== 'all' && (
              <span className={styles.tabCount}>
                {
                  orders.filter((order) =>
                    tabStatusMap[tab]?.includes(order.status)
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Order List */}
      <div className={styles.list}>
        {loading ? (
          <div className={styles.loading}>
            <Loading size="lg" text={t('common.loading')} />
          </div>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={onOrderClick}
              onActionClick={onActionClick}
              language={isZh ? 'zh' : 'en'}
            />
          ))
        ) : (
          renderEmptyState()
        )}
      </div>
    </div>
  );
};

export default OrderList;
