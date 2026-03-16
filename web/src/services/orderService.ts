/**
 * Order Service
 * C端订单和B端供应商订单 API
 */

import { get, post } from './api';

// 订单状态
export type OrderStatus = 'pending' | 'paid' | 'accepted' | 'processing' | 'completed' | 'cancelled' | 'refunded';

// 订单类型
export type OrderType = 'tour' | 'hotel' | 'attraction' | 'car_rental' | 'restaurant';

// 订单接口
export interface Order {
  id: number;
  order_no: string;
  order_type: OrderType;
  status: OrderStatus;
  user_id: number;
  user_name: string;
  user_phone: string;
  user_email: string;
  supplier_id: number;
  supplier_name: string;
  product_id: number;
  product_name: string;
  product_sku?: string;
  package_name?: string;
  booking_date: string;
  check_in_date?: string;
  check_out_date?: string;
  quantity: number;
  guest_count: number;
  unit_price: number;
  total_price: number;
  currency: string;
  payment_method?: string;
  payment_time?: string;
  payment_ref?: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  refunded_at?: string;
  refund_amount?: number;
  user_remark?: string;
  supplier_remark?: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// 创建订单输入
export interface CreateOrderInput {
  product_id: number;
  package_id: number;
  schedule_id?: number;
  quantity: number;
  booking_date: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  user_remark?: string;
}

// 列表过滤
export interface ListFilter {
  page?: number;
  page_size?: number;
  status?: OrderStatus;
  order_type?: OrderType;
  start_date?: string;
  end_date?: string;
  keyword?: string;
}

// 列表结果
export interface ListResult {
  orders: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 订单统计
export interface OrderStats {
  total: number;
  pending: number;
  paid: number;
  accepted: number;
  completed: number;
  cancelled: number;
  total_amount: number;
}

// 状态变更历史
export interface StatusHistory {
  id: number;
  order_id: number;
  from_status: OrderStatus;
  to_status: OrderStatus;
  operator_id?: number;
  operator_type: string;
  remark: string;
  created_at: string;
}

// 构建查询参数
function buildParams(filter: ListFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined) params.append(key, String(value));
  });
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ==================== C端 API ====================

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return post<Order>('/orders', input, 'user');
}

export async function getOrder(id: number): Promise<Order> {
  return get<Order>(`/orders/${id}`, 'user');
}

export async function listOrders(filter: ListFilter = {}): Promise<ListResult> {
  return get<ListResult>(`/orders${buildParams(filter)}`, 'user');
}

export async function cancelOrder(id: number, reason?: string): Promise<void> {
  await post<void>(`/orders/${id}/cancel`, { reason }, 'user');
}

export async function getOrderHistory(id: number): Promise<StatusHistory[]> {
  return get<StatusHistory[]>(`/orders/${id}/history`, 'user');
}

// ==================== B端 API ====================

export async function listSupplierOrders(filter: ListFilter = {}): Promise<ListResult> {
  return get<ListResult>(`/supplier/orders${buildParams(filter)}`, 'supplier');
}

export async function getSupplierOrder(id: number): Promise<Order> {
  return get<Order>(`/supplier/orders/${id}`, 'supplier');
}

export async function getSupplierOrderStats(): Promise<OrderStats> {
  return get<OrderStats>('/supplier/orders/stats', 'supplier');
}

export async function acceptOrder(id: number): Promise<void> {
  await post<void>(`/supplier/orders/${id}/accept`, undefined, 'supplier');
}

export async function rejectOrder(id: number, reason: string): Promise<void> {
  await post<void>(`/supplier/orders/${id}/reject`, { reason }, 'supplier');
}

export async function completeOrder(id: number): Promise<void> {
  await post<void>(`/supplier/orders/${id}/complete`, undefined, 'supplier');
}

// 导出所有服务函数
export const orderService = {
  // C端
  create: createOrder,
  get: getOrder,
  list: listOrders,
  cancel: cancelOrder,
  getHistory: getOrderHistory,

  // B端
  supplier: {
    list: listSupplierOrders,
    get: getSupplierOrder,
    stats: getSupplierOrderStats,
    accept: acceptOrder,
    reject: rejectOrder,
    complete: completeOrder,
  },
};

export default orderService;
