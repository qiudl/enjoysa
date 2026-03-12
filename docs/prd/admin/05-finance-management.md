# PRD-05: 财务管理模块

## 1. 模块概述

### 1.1 模块定位
财务管理模块用于查看平台收入数据、管理供应商结算和生成财务报表。

### 1.2 目标用户
- 财务人员
- 管理层

### 1.3 核心价值
- 实时掌握财务状况
- 规范供应商结算
- 生成财务报表

---

## 2. 页面设计

### 2.1 财务概览页 (FinanceOverview)

**路由**: `/admin/finance`

#### 页面布局
```
┌─────────────────────────────────────────────────────────┐
│ [财务统计卡片]                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ 总收入   │ │待结算   │ │ 已结算   │ │平台佣金  │        │
│ │¥358,600│ │¥45,800 │ │¥298,200│ │¥35,860 │        │
│ │ +12.5%  │ │         │ │ +8.3%   │ │ +12.5% │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────┤
│ [收入趋势图]                                            │
│ ┌───────────────────────────────────────────────────┐  │
│ │     ╭─────╮                                       │  │
│ │    ╱      ╲    ╭───╮                             │  │
│ │ ──╱        ╲──╱     ╲──                          │  │
│ │ 1月  2月  3月  4月  5月  6月                       │  │
│ └───────────────────────────────────────────────────┘  │
│ [日] [周] [月] [年]                                     │
├─────────────────────────────────────────────────────────┤
│ [Tab: 结算管理 | 财务报表]                              │
├─────────────────────────────────────────────────────────┤
│ [结算列表]                                              │
│ 供应商    │ 周期      │ 订单数│ 销售额  │ 佣金  │ 状态   │
│ 祥龙旅行社│ 01.15-21 │  28  │ ¥12,580│¥1,258│ 待结算 │
│ 阳光酒店  │ 01.15-21 │  15  │ ¥8,200 │ ¥820 │ 已结算 │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 收入趋势图 (RevenueChart)

#### 图表类型
- 折线图：收入趋势
- 柱状图：订单量
- 饼图：收入构成

#### 时间维度
- 日：近30天
- 周：近12周
- 月：近12个月
- 年：近5年

#### 数据指标
- 总销售额
- 订单数量
- 平台佣金
- 退款金额

---

### 2.3 结算管理 (SettlementList)

#### 结算流程
```
[生成账单] → [待结算] → [处理中] → [已结算]
```

#### 结算周期
- 周结：每周一生成上周账单
- 月结：每月1日生成上月账单

#### 结算列表

| 字段 | 说明 |
|------|------|
| 供应商 | 供应商名称 |
| 结算周期 | 时间范围 |
| 订单数 | 周期内订单数 |
| 销售总额 | 周期内总销售 |
| 佣金 | 平台抽成 |
| 结算金额 | 销售额 - 佣金 |
| 状态 | 待结算/处理中/已结算 |

---

### 2.4 结算详情 (SettlementDetail)

```
┌─────────────────────────────────────────────────────────┐
│ 结算详情                                    [关闭 X]    │
├─────────────────────────────────────────────────────────┤
│ 基本信息                                                │
│ 结算单号: STL20260122001                                │
│ 供应商: 祥龙旅行社                                      │
│ 结算周期: 2026-01-15 ~ 2026-01-21                       │
│ 生成时间: 2026-01-22 00:00:00                           │
├─────────────────────────────────────────────────────────┤
│ 金额明细                                                │
│ 订单数量:     28 单                                     │
│ 销售总额:     ¥12,580.00                                │
│ 佣金比例:     10%                                       │
│ 平台佣金:     -¥1,258.00                                │
│ ──────────────────────────────────────                  │
│ 结算金额:     ¥11,322.00                                │
├─────────────────────────────────────────────────────────┤
│ 订单明细                                                │
│ 订单号      │ 产品       │ 金额   │ 佣金  │ 结算金额    │
│ 202601..001│ 袋鼠岛..   │ ¥778  │ ¥78  │ ¥700       │
│ ...        │ ...        │ ...   │ ...  │ ...        │
├─────────────────────────────────────────────────────────┤
│ [处理结算] [导出账单]                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型

```typescript
interface FinanceStats {
  totalRevenue: number;
  pendingSettlement: number;
  settledAmount: number;
  platformCommission: number;
  revenueGrowth: number;    // 百分比
  commissionGrowth: number; // 百分比
}

interface Settlement {
  id: string;
  settlementNo: string;
  supplierId: string;
  supplierName: string;
  period: string;           // "2026-01-15 ~ 2026-01-21"
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  totalSales: number;
  commissionRate: number;   // 0.1 = 10%
  commission: number;
  netAmount: number;        // totalSales - commission
  status: 'pending' | 'processing' | 'completed';
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
}

interface SettlementOrder {
  orderId: string;
  orderNo: string;
  productName: string;
  amount: number;
  commission: number;
  netAmount: number;
  orderDate: string;
}

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
  commission: number;
  refunds: number;
}
```

---

## 4. 组件清单

| 组件名 | 路径 | 说明 |
|--------|------|------|
| FinanceOverview | `pages/Admin/FinanceOverview/` | 概览页面 |
| FinanceStats | `components/Admin/FinanceStats/` | 统计卡片 |
| RevenueChart | `components/Admin/RevenueChart/` | 收入图表 |
| SettlementList | `components/Admin/SettlementList/` | 结算列表 |
| SettlementDetail | `components/Admin/SettlementDetail/` | 结算详情 |

---

## 5. 图表库选择

推荐使用 **Recharts**：
- 轻量级
- React 友好
- 支持响应式

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={revenueData}>
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" />
  </LineChart>
</ResponsiveContainer>
```

---

## 6. Storybook Stories

```typescript
// FinanceStats.stories.tsx
export const Default = {};
export const Loading = {};
export const GrowthPositive = {};
export const GrowthNegative = {};
export const EnglishVersion = {};

// RevenueChart.stories.tsx
export const Daily = { args: { period: 'daily' } };
export const Weekly = { args: { period: 'weekly' } };
export const Monthly = { args: { period: 'monthly' } };
export const Yearly = { args: { period: 'yearly' } };
export const Loading = {};
export const NoData = {};

// SettlementList.stories.tsx
export const Default = {};
export const WithPending = {};
export const AllCompleted = {};
export const Empty = {};

// SettlementDetail.stories.tsx
export const Pending = { args: { status: 'pending' } };
export const Processing = { args: { status: 'processing' } };
export const Completed = { args: { status: 'completed' } };
```

---

## 7. i18n Keys

```json
{
  "admin.finance": {
    "title": "财务管理",
    "stats": {
      "totalRevenue": "总收入",
      "pending": "待结算",
      "settled": "已结算",
      "commission": "平台佣金"
    },
    "chart": {
      "title": "收入趋势",
      "revenue": "收入",
      "orders": "订单",
      "commission": "佣金",
      "refunds": "退款",
      "daily": "日",
      "weekly": "周",
      "monthly": "月",
      "yearly": "年"
    },
    "settlement": {
      "title": "结算管理",
      "supplier": "供应商",
      "period": "结算周期",
      "orders": "订单数",
      "sales": "销售额",
      "commission": "佣金",
      "netAmount": "结算金额",
      "status": "状态",
      "process": "处理结算",
      "export": "导出账单"
    },
    "status": {
      "pending": "待结算",
      "processing": "处理中",
      "completed": "已结算"
    },
    "detail": {
      "title": "结算详情",
      "settlementNo": "结算单号",
      "basicInfo": "基本信息",
      "amountDetail": "金额明细",
      "orderDetail": "订单明细",
      "commissionRate": "佣金比例"
    }
  }
}
```
