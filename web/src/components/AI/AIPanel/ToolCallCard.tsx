import React from 'react';
import type { ToolCallDisplay } from '../../../contexts/ChatContext';
import styles from './AIPanel.module.css';
import clsx from 'clsx';

const TOOL_NAME_MAP: Record<string, string> = {
  get_order_stats: '查询订单统计',
  list_pending_orders: '查询待确认订单',
  get_review_stats: '查询评价统计',
  get_revenue_trend: '查询收入趋势',
  get_inventory_alerts: '查询库存预警',
  get_settlement_detail: '查询结算详情',
  confirm_order: '确认订单',
  search_orders: '搜索订单',
  get_platform_stats: '查询平台概览',
  search_suppliers: '搜索供应商',
  list_pending_products: '查询待审核商品',
  approve_product: '审核通过商品',
  offline_product: '下架商品',
  search_products: '搜索商品',
  product_detail: '查询商品详情',
  recommend_attractions: '推荐景点',
  check_availability: '查询可用日期',
  get_reviews: '查询评价',
};

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const displayName = TOOL_NAME_MAP[toolCall.name] || toolCall.name;

  return (
    <div className={styles.toolCall}>
      <div className={styles.toolCallHeader}>
        <span className={clsx(
          styles.toolStatus,
          toolCall.status === 'completed' && styles.toolStatusOk,
          toolCall.status === 'running' && styles.toolStatusRunning,
        )}>
          {toolCall.status === 'completed' ? '✓' : toolCall.status === 'error' ? '✗' : '⟳'}
        </span>
        <span className={styles.toolCallName}>{displayName}</span>
        <span className={styles.toolCallDuration}>
          {toolCall.status === 'running' ? '运行中...' : toolCall.durationMs ? `${toolCall.durationMs}ms` : ''}
        </span>
      </div>
      {toolCall.result && toolCall.status === 'completed' && (
        <div className={styles.toolCallResult}>
          {formatResult(toolCall.result)}
        </div>
      )}
    </div>
  );
};

function formatResult(resultStr: string): string {
  try {
    const data = JSON.parse(resultStr);
    if (data.error) return `错误: ${data.error}`;
    // Show a brief summary
    return JSON.stringify(data, null, 0).slice(0, 200) + (JSON.stringify(data).length > 200 ? '...' : '');
  } catch {
    return resultStr.slice(0, 200);
  }
}
