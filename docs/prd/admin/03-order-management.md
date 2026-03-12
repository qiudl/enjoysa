# PRD-03: 订单管理模块

## 1. 模块概述

### 1.1 模块定位
订单管理模块用于监控和管理平台所有交易订单，处理异常订单和退款申请。

### 1.2 目标用户
- 客服人员
- 运营人员
- 财务人员

### 1.3 核心价值
- 实时监控订单状态
- 快速处理订单异常
- 高效处理退款申请

---

## 2. 页面设计

### 2.1 订单列表页 (OrderList)

**路由**: `/admin/orders`

#### 页面布局
```
┌─────────────────────────────────────────────────────────┐
│ [统计卡片区]                                            │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│ │今日订单 │ │ 待处理  │ │ 退款中  │ │今日销售额│            │
│ │  56    │ │   8    │ │   3    │ │ ¥12,580│            │
│ └────────┘ └────────┘ └────────┘ └────────┘            │
├─────────────────────────────────────────────────────────┤
│ [筛选区]                                                │
│ [搜索订单号/客户] [状态▼] [供应商▼] [日期范围____]       │
├─────────────────────────────────────────────────────────┤
│ [订单表格]                                              │
│ 订单号      │ 产品     │ 客户  │ 供应商 │ 金额  │ 状态 │ 操作│
│ 20260128001│ 袋鼠岛.. │ 王五  │ 祥龙.. │ ¥778 │ 已支付│ ... │
│ 20260128002│ 巴罗莎.. │ 赵六  │ 阳光.. │ ¥598 │ 待支付│ ... │
├─────────────────────────────────────────────────────────┤
│ [分页]                                                  │
└─────────────────────────────────────────────────────────┘
```

#### 功能点

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 订单搜索 | 按订单号、客户名、手机号搜索 | P0 |
| 状态筛选 | 全部/待支付/已支付/已确认/已完成/已取消/退款中 | P0 |
| 时间筛选 | 今日/本周/本月/自定义 | P0 |
| 供应商筛选 | 按供应商筛选 | P1 |
| 导出订单 | 导出 Excel | P1 |
| 订单统计 | 实时统计今日数据 | P0 |

---

### 2.2 订单详情 (OrderDetail)

#### 详情布局
```
┌─────────────────────────────────────────────────────────┐
│ 订单详情                                    [关闭 X]    │
├─────────────────────────────────────────────────────────┤
│ [订单状态时间线]                                        │
│ ● 创建订单 ─── ● 支付成功 ─── ○ 商家确认 ─── ○ 完成     │
│   01-28 10:30   01-28 10:35                             │
├─────────────────────────────────────────────────────────┤
│ 订单信息                                                │
│ 订单号: 20260128001                                     │
│ 下单时间: 2026-01-28 10:30:15                           │
│ 支付方式: 微信支付                                      │
│ 支付时间: 2026-01-28 10:35:22                           │
├─────────────────────────────────────────────────────────┤
│ 产品信息                                                │
│ [图片] 袋鼠岛一日游                                     │
│        供应商: 祥龙旅行社                               │
│        出行日期: 2026-02-15                             │
│        出行人数: 2 成人                                 │
│        单价: ¥389 × 2 = ¥778                            │
├─────────────────────────────────────────────────────────┤
│ 客户信息                                                │
│ 联系人: 王五                                            │
│ 手机: 138****8888                                       │
│ 邮箱: wang@example.com                                  │
├─────────────────────────────────────────────────────────┤
│ 出行人信息                                              │
│ 1. 王五 (护照: G12345678)                               │
│ 2. 李六 (护照: G87654321)                               │
├─────────────────────────────────────────────────────────┤
│ [操作按钮]                                              │
│ [联系客户] [联系供应商] [取消订单] [处理退款]            │
└─────────────────────────────────────────────────────────┘
```

---

### 2.3 订单时间线 (OrderTimeline)

#### 状态流转
```
待支付 → 已支付 → 已确认 → 已完成
   ↓        ↓        ↓
已取消   退款中 → 已退款
```

#### 时间线事件
```typescript
interface TimelineEvent {
  type: 'created' | 'paid' | 'confirmed' | 'completed' | 'cancelled' | 'refund_requested' | 'refunded';
  time: string;
  operator?: string;
  note?: string;
}
```

---

### 2.4 退款处理 (OrderRefundForm)

#### 退款流程
```
[客户申请退款] → [客服审核] → 同意 → [财务处理] → [已退款]
                          → 拒绝 → [维持原状]
```

#### 退款表单

| 字段 | 类型 | 必填 |
|------|------|------|
| 退款金额 | 数字 | 是 |
| 退款原因 | 下拉 | 是 |
| 处理备注 | 文本 | 否 |
| 退回方式 | 原路退回 | 自动 |

---

## 3. 数据模型

### 3.1 Order 接口

```typescript
interface Order {
  id: string;
  orderNo: string;
  // 产品信息
  productId: string;
  productName: string;
  productImage: string;
  // 供应商
  supplierId: string;
  supplierName: string;
  // 客户
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  // 订单详情
  travelDate: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  // 出行人
  travelers: Traveler[];
  // 支付
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  // 状态
  status: OrderStatus;
  // 退款
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: string;
  // 备注
  customerNote?: string;
  adminNote?: string;
  // 时间戳
  createdAt: string;
  updatedAt: string;
}

interface Traveler {
  name: string;
  passport?: string;
  phone?: string;
}

type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

type RefundStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'refunded';

type PaymentMethod =
  | 'wechat'
  | 'alipay'
  | 'credit_card'
  | 'bank_transfer';
```

---

## 4. 组件清单

| 组件名 | 路径 | 说明 |
|--------|------|------|
| OrderList | `pages/Admin/OrderList/` | 列表页面 |
| OrderTable | `components/Admin/OrderTable/` | 订单表格 |
| OrderDetail | `components/Admin/OrderDetail/` | 订单详情抽屉 |
| OrderTimeline | `components/Admin/OrderTimeline/` | 状态时间线 |
| OrderRefundForm | `components/Admin/OrderRefundForm/` | 退款表单 |
| OrderStats | `components/Admin/OrderStats/` | 订单统计 |

---

## 5. Storybook Stories

```typescript
// OrderTable.stories.tsx
export const Default = {};
export const Loading = {};
export const Empty = {};
export const WithRefundOrders = {};
export const EnglishVersion = {};

// OrderTimeline.stories.tsx
export const PendingPayment = { args: { status: 'pending_payment' } };
export const Paid = { args: { status: 'paid' } };
export const Confirmed = { args: { status: 'confirmed' } };
export const Completed = { args: { status: 'completed' } };
export const Cancelled = { args: { status: 'cancelled' } };
export const Refunding = { args: { refundStatus: 'requested' } };

// OrderRefundForm.stories.tsx
export const Default = {};
export const Processing = { args: { loading: true } };
export const PartialRefund = { args: { partialRefund: true } };
```

---

## 6. i18n Keys

```json
{
  "admin.orders": {
    "title": "订单管理",
    "stats": {
      "today": "今日订单",
      "pending": "待处理",
      "refunding": "退款中",
      "todaySales": "今日销售额"
    },
    "status": {
      "pending_payment": "待支付",
      "paid": "已支付",
      "confirmed": "已确认",
      "completed": "已完成",
      "cancelled": "已取消",
      "refunding": "退款中",
      "refunded": "已退款"
    },
    "table": {
      "orderNo": "订单号",
      "product": "产品",
      "customer": "客户",
      "supplier": "供应商",
      "amount": "金额",
      "status": "状态",
      "orderDate": "下单时间"
    },
    "detail": {
      "orderInfo": "订单信息",
      "productInfo": "产品信息",
      "customerInfo": "客户信息",
      "travelerInfo": "出行人信息",
      "paymentInfo": "支付信息"
    },
    "actions": {
      "contactCustomer": "联系客户",
      "contactSupplier": "联系供应商",
      "cancelOrder": "取消订单",
      "processRefund": "处理退款",
      "export": "导出订单"
    },
    "refund": {
      "title": "退款处理",
      "amount": "退款金额",
      "reason": "退款原因",
      "note": "处理备注",
      "approve": "同意退款",
      "reject": "拒绝退款"
    },
    "timeline": {
      "created": "订单创建",
      "paid": "支付成功",
      "confirmed": "商家确认",
      "completed": "行程完成",
      "cancelled": "订单取消",
      "refundRequested": "申请退款",
      "refunded": "退款完成"
    }
  }
}
```
