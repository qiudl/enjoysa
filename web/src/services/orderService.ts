/**
 * Order Service
 * API封装和mock数据支持
 */

// API 基础配置
const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

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
  created_at: string;
  updated_at: string;
}

// 创建订单输入
export interface CreateOrderInput {
  supplier_id: number;
  product_id: number;
  product_name: string;
  product_sku?: string;
  order_type: OrderType;
  booking_date: string;
  check_in_date?: string;
  check_out_date?: string;
  quantity: number;
  guest_count: number;
  unit_price: number;
  total_price: number;
  currency?: string;
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

// API 响应
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Mock 数据
const mockOrders: Order[] = [
  {
    id: 1,
    order_no: 'ES20260201123456',
    order_type: 'tour',
    status: 'completed',
    user_id: 1,
    user_name: '张三',
    user_phone: '+86 138 0000 0001',
    user_email: 'zhang@example.com',
    supplier_id: 1,
    supplier_name: '祥龙旅行社',
    product_id: 101,
    product_name: '袋鼠岛两日游',
    product_sku: 'KI-2D-01',
    booking_date: '2026-02-15',
    quantity: 2,
    guest_count: 2,
    unit_price: 299,
    total_price: 598,
    currency: 'AUD',
    payment_method: 'credit_card',
    payment_time: '2026-02-01T10:30:00Z',
    accepted_at: '2026-02-01T11:00:00Z',
    completed_at: '2026-02-15T18:00:00Z',
    contact_name: '张三',
    contact_phone: '+86 138 0000 0001',
    contact_email: 'zhang@example.com',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-15T18:00:00Z',
  },
  {
    id: 2,
    order_no: 'ES20260202234567',
    order_type: 'hotel',
    status: 'accepted',
    user_id: 1,
    user_name: '张三',
    user_phone: '+86 138 0000 0001',
    user_email: 'zhang@example.com',
    supplier_id: 2,
    supplier_name: '阿德莱德希尔顿酒店',
    product_id: 201,
    product_name: '豪华海景房',
    product_sku: 'DLX-SV',
    booking_date: '2026-03-01',
    check_in_date: '2026-03-01',
    check_out_date: '2026-03-03',
    quantity: 1,
    guest_count: 2,
    unit_price: 250,
    total_price: 500,
    currency: 'AUD',
    payment_method: 'paypal',
    payment_time: '2026-02-02T14:00:00Z',
    accepted_at: '2026-02-02T14:30:00Z',
    contact_name: '张三',
    contact_phone: '+86 138 0000 0001',
    contact_email: 'zhang@example.com',
    user_remark: '请安排高楼层',
    created_at: '2026-02-02T13:30:00Z',
    updated_at: '2026-02-02T14:30:00Z',
  },
  {
    id: 3,
    order_no: 'ES20260203345678',
    order_type: 'attraction',
    status: 'paid',
    user_id: 1,
    user_name: '张三',
    user_phone: '+86 138 0000 0001',
    user_email: 'zhang@example.com',
    supplier_id: 3,
    supplier_name: '阿德莱德动物园',
    product_id: 301,
    product_name: '成人门票',
    product_sku: 'ZOO-ADULT',
    booking_date: '2026-02-20',
    quantity: 3,
    guest_count: 3,
    unit_price: 35,
    total_price: 105,
    currency: 'AUD',
    payment_method: 'wechat',
    payment_time: '2026-02-03T09:00:00Z',
    contact_name: '张三',
    contact_phone: '+86 138 0000 0001',
    contact_email: 'zhang@example.com',
    created_at: '2026-02-03T08:45:00Z',
    updated_at: '2026-02-03T09:00:00Z',
  },
  {
    id: 4,
    order_no: 'ES20260203456789',
    order_type: 'tour',
    status: 'pending',
    user_id: 1,
    user_name: '张三',
    user_phone: '+86 138 0000 0001',
    user_email: 'zhang@example.com',
    supplier_id: 1,
    supplier_name: '祥龙旅行社',
    product_id: 102,
    product_name: '巴罗萨酒庄一日游',
    product_sku: 'BA-1D-01',
    booking_date: '2026-03-10',
    quantity: 4,
    guest_count: 4,
    unit_price: 189,
    total_price: 756,
    currency: 'AUD',
    contact_name: '张三',
    contact_phone: '+86 138 0000 0001',
    contact_email: 'zhang@example.com',
    user_remark: '需要中文导游',
    created_at: '2026-02-03T16:00:00Z',
    updated_at: '2026-02-03T16:00:00Z',
  },
];

// 获取认证头
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// 通用请求方法
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }

  return data.data as T;
}

// 延时函数
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== C端 API ====================

/**
 * 创建订单
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (USE_MOCK) {
    await delay(800);
    const newOrder: Order = {
      id: mockOrders.length + 1,
      order_no: `ES${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${Math.random().toString().slice(2, 8)}`,
      status: 'pending',
      user_id: 1,
      user_name: '当前用户',
      user_phone: '+86 138 0000 0000',
      user_email: 'user@example.com',
      supplier_name: '供应商名称',
      currency: 'AUD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...input,
    };
    mockOrders.unshift(newOrder);
    return newOrder;
  }

  return request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * 获取订单详情
 */
export async function getOrder(id: number): Promise<Order> {
  if (USE_MOCK) {
    await delay(300);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error('订单不存在');
    return order;
  }

  return request<Order>(`/orders/${id}`);
}

/**
 * 获取用户订单列表
 */
export async function listOrders(filter: ListFilter = {}): Promise<ListResult> {
  if (USE_MOCK) {
    await delay(500);
    let orders = [...mockOrders];

    // 应用过滤
    if (filter.status) {
      orders = orders.filter((o) => o.status === filter.status);
    }
    if (filter.order_type) {
      orders = orders.filter((o) => o.order_type === filter.order_type);
    }
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.order_no.toLowerCase().includes(keyword) ||
          o.product_name.toLowerCase().includes(keyword)
      );
    }

    const page = filter.page || 1;
    const pageSize = filter.page_size || 20;
    const start = (page - 1) * pageSize;
    const paginatedOrders = orders.slice(start, start + pageSize);

    return {
      orders: paginatedOrders,
      total: orders.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(orders.length / pageSize),
    };
  }

  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined) params.append(key, String(value));
  });

  return request<ListResult>(`/orders?${params}`);
}

/**
 * 取消订单
 */
export async function cancelOrder(id: number, reason?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(500);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'pending' && order.status !== 'paid') {
      throw new Error('当前状态不允许取消');
    }
    order.status = 'cancelled';
    order.cancelled_at = new Date().toISOString();
    order.cancel_reason = reason;
    return;
  }

  await request<void>(`/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * 获取订单状态历史
 */
export async function getOrderHistory(id: number): Promise<StatusHistory[]> {
  if (USE_MOCK) {
    await delay(300);
    return [
      {
        id: 1,
        order_id: id,
        from_status: '' as OrderStatus,
        to_status: 'pending',
        operator_type: 'user',
        remark: '订单创建',
        created_at: '2026-02-01T10:00:00Z',
      },
      {
        id: 2,
        order_id: id,
        from_status: 'pending',
        to_status: 'paid',
        operator_type: 'system',
        remark: '支付成功',
        created_at: '2026-02-01T10:30:00Z',
      },
    ];
  }

  return request<StatusHistory[]>(`/orders/${id}/history`);
}

// ==================== B端 API ====================

/**
 * 获取供应商订单列表
 */
export async function listSupplierOrders(filter: ListFilter = {}): Promise<ListResult> {
  if (USE_MOCK) {
    await delay(500);
    // 模拟供应商订单（只返回 supplier_id=1 的订单）
    let orders = mockOrders.filter((o) => o.supplier_id === 1);

    if (filter.status) {
      orders = orders.filter((o) => o.status === filter.status);
    }
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.order_no.toLowerCase().includes(keyword) ||
          o.product_name.toLowerCase().includes(keyword) ||
          o.user_name.toLowerCase().includes(keyword)
      );
    }

    const page = filter.page || 1;
    const pageSize = filter.page_size || 20;
    const start = (page - 1) * pageSize;
    const paginatedOrders = orders.slice(start, start + pageSize);

    return {
      orders: paginatedOrders,
      total: orders.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(orders.length / pageSize),
    };
  }

  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined) params.append(key, String(value));
  });

  return request<ListResult>(`/supplier/orders?${params}`);
}

/**
 * 获取供应商订单详情
 */
export async function getSupplierOrder(id: number): Promise<Order> {
  if (USE_MOCK) {
    await delay(300);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error('订单不存在');
    return order;
  }

  return request<Order>(`/supplier/orders/${id}`);
}

/**
 * 获取供应商订单统计
 */
export async function getSupplierOrderStats(): Promise<OrderStats> {
  if (USE_MOCK) {
    await delay(300);
    const orders = mockOrders.filter((o) => o.supplier_id === 1);
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      paid: orders.filter((o) => o.status === 'paid').length,
      accepted: orders.filter((o) => o.status === 'accepted').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      total_amount: orders
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + o.total_price, 0),
    };
  }

  return request<OrderStats>('/supplier/orders/stats');
}

/**
 * 接单
 */
export async function acceptOrder(id: number): Promise<void> {
  if (USE_MOCK) {
    await delay(500);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'paid') throw new Error('当前状态不允许接单');
    order.status = 'accepted';
    order.accepted_at = new Date().toISOString();
    return;
  }

  await request<void>(`/supplier/orders/${id}/accept`, { method: 'POST' });
}

/**
 * 拒绝订单
 */
export async function rejectOrder(id: number, reason: string): Promise<void> {
  if (USE_MOCK) {
    await delay(500);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'paid') throw new Error('当前状态不允许拒绝');
    order.status = 'cancelled';
    order.cancel_reason = reason;
    return;
  }

  await request<void>(`/supplier/orders/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * 完成订单
 */
export async function completeOrder(id: number): Promise<void> {
  if (USE_MOCK) {
    await delay(500);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'accepted' && order.status !== 'processing') {
      throw new Error('当前状态不允许完成');
    }
    order.status = 'completed';
    order.completed_at = new Date().toISOString();
    return;
  }

  await request<void>(`/supplier/orders/${id}/complete`, { method: 'POST' });
}

/**
 * 添加供应商备注
 */
export async function addSupplierRemark(id: number, remark: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error('订单不存在');
    order.supplier_remark = remark;
    return;
  }

  await request<void>(`/supplier/orders/${id}/remark`, {
    method: 'POST',
    body: JSON.stringify({ remark }),
  });
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
    addRemark: addSupplierRemark,
  },
};

export default orderService;
