# PRD-01: 供应商管理模块

## 1. 模块概述

### 1.1 模块定位
供应商管理是 Admin 后台的核心模块之一，用于管理平台入驻的旅游服务供应商（旅行社、酒店、景区等）的全生命周期。

### 1.2 目标用户
- 平台运营人员
- 平台管理员

### 1.3 核心价值
- 高效审核供应商入驻申请
- 实时监控供应商经营状态
- 快速处理供应商问题

---

## 2. 页面设计

### 2.1 供应商列表页 (SupplierList)

**路由**: `/admin/suppliers`

#### 页面布局
```
┌─────────────────────────────────────────────────────────┐
│ [统计卡片区]                                            │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ 总供应商 │ │ 待审核   │ │ 已通过   │ │ 已暂停   │        │
│ │   128   │ │   12    │ │   108   │ │    8    │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────┤
│ [工具栏]                                                │
│ [搜索框________] [类型▼] [状态▼] [排序▼] [+ 添加]       │
├─────────────────────────────────────────────────────────┤
│ [数据表格]                                              │
│ ☐ │ 公司名称     │ 类型   │ 联系人 │ 状态  │ 入驻时间 │ 操作  │
│ ☐ │ 祥龙旅行社   │ 旅行社 │ 张三   │ 已通过 │ 01-15   │ ...  │
│ ☐ │ 阳光酒店     │ 酒店   │ 李四   │ 待审核 │ 01-28   │ ...  │
├─────────────────────────────────────────────────────────┤
│ [分页] 共 128 条  < 1 2 3 ... 13 >  每页 [10▼] 条       │
└─────────────────────────────────────────────────────────┘
```

#### 功能点

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 统计展示 | 显示各状态供应商数量 | P0 |
| 搜索 | 按公司名称、联系人搜索 | P0 |
| 类型筛选 | 旅行社/酒店/景区/餐厅/租车 | P0 |
| 状态筛选 | 全部/待审核/已通过/已暂停/已拒绝 | P0 |
| 排序 | 入驻时间/订单量/销售额 | P1 |
| 批量操作 | 批量通过/批量暂停 | P2 |
| 导出 | 导出供应商列表 Excel | P2 |

---

### 2.2 供应商详情 (SupplierDetail)

#### 信息结构

**基本信息 Tab**
- 公司名称（中/英）
- 供应商类型
- 联系人姓名
- 联系电话
- 联系邮箱
- 营业执照号
- 营业执照照片
- 入驻时间
- 审核状态
- 审核备注

**经营数据 Tab**
- 产品数量（在售/下架）
- 订单统计（总数/本月）
- 销售额（总额/本月）
- 评分（平均分/评价数）
- 退款率

**产品列表 Tab**
- 该供应商的所有产品
- 支持跳转到产品详情

**订单记录 Tab**
- 该供应商的订单列表
- 支持跳转到订单详情

---

### 2.3 审核功能 (SupplierReviewForm)

#### 审核流程
```
[待审核] → 通过 → [已通过]
         → 拒绝 → [已拒绝]
         → 补充资料 → [待补充]

[已通过] → 暂停 → [已暂停]
[已暂停] → 恢复 → [已通过]
```

#### 审核表单

**通过审核**
- 确认信息完整
- 可添加审核备注

**拒绝审核**
- 必填：拒绝原因（下拉选择 + 自定义）
- 拒绝原因选项：
  - 营业执照信息不符
  - 资质不满足要求
  - 联系方式无效
  - 其他（需填写）

**暂停供应商**
- 必填：暂停原因
- 暂停后：产品自动下架，订单继续履约

---

## 3. 数据模型

### 3.1 Supplier 接口

```typescript
interface Supplier {
  id: string;
  companyName: string;
  companyNameEn?: string;
  type: SupplierType;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  businessLicense?: string;
  businessLicenseImage?: string;
  address?: string;
  description?: string;
  status: SupplierStatus;
  rejectReason?: string;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  // 统计数据
  productCount: number;
  activeProductCount: number;
  orderCount: number;
  totalRevenue: number;
  rating: number;
  ratingCount: number;
  // 时间戳
  createdAt: string;
  updatedAt: string;
}

type SupplierType =
  | 'travel_agency'
  | 'hotel'
  | 'attraction'
  | 'restaurant'
  | 'car_rental';

type SupplierStatus =
  | 'pending'      // 待审核
  | 'approved'     // 已通过
  | 'rejected'     // 已拒绝
  | 'suspended'    // 已暂停
  | 'revision';    // 待补充
```

### 3.2 审核记录

```typescript
interface SupplierReviewLog {
  id: string;
  supplierId: string;
  action: 'approve' | 'reject' | 'suspend' | 'resume' | 'request_revision';
  reason?: string;
  note?: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}
```

---

## 4. 交互设计

### 4.1 列表交互

| 操作 | 触发方式 | 结果 |
|------|----------|------|
| 查看详情 | 点击行/查看按钮 | 打开右侧抽屉 |
| 快速审核 | 点击通过/拒绝 | 弹出确认框 |
| 暂停 | 点击暂停按钮 | 弹出原因填写框 |
| 批量选择 | 勾选复选框 | 显示批量操作栏 |

### 4.2 状态颜色

| 状态 | 颜色 | 色值 |
|------|------|------|
| 待审核 | 橙色 | #f59e0b |
| 已通过 | 绿色 | #10b981 |
| 已拒绝 | 红色 | #ef4444 |
| 已暂停 | 灰色 | #6b7280 |
| 待补充 | 蓝色 | #3b82f6 |

---

## 5. 组件清单

| 组件名 | 路径 | 说明 |
|--------|------|------|
| SupplierList | `pages/Admin/SupplierList/` | 列表页面 |
| SupplierTable | `components/Admin/SupplierTable/` | 数据表格 |
| SupplierDetail | `components/Admin/SupplierDetail/` | 详情抽屉 |
| SupplierReviewForm | `components/Admin/SupplierReviewForm/` | 审核表单 |
| SupplierStats | `components/Admin/SupplierStats/` | 统计卡片 |

---

## 6. Storybook Stories

```typescript
// SupplierTable.stories.tsx
export default {
  title: 'Admin/SupplierTable',
  component: SupplierTable,
};

export const Default = {};
export const Loading = { args: { loading: true } };
export const Empty = { args: { data: [] } };
export const WithPendingItems = {};
export const WithSelection = { args: { selectable: true } };
export const EnglishVersion = { args: { language: 'en' } };

// SupplierDetail.stories.tsx
export const Pending = { args: { status: 'pending' } };
export const Approved = { args: { status: 'approved' } };
export const Suspended = { args: { status: 'suspended' } };

// SupplierReviewForm.stories.tsx
export const ApproveForm = { args: { action: 'approve' } };
export const RejectForm = { args: { action: 'reject' } };
export const SuspendForm = { args: { action: 'suspend' } };
```

---

## 7. i18n Keys

```json
{
  "admin.suppliers": {
    "title": "供应商管理",
    "stats": {
      "total": "总供应商",
      "pending": "待审核",
      "approved": "已通过",
      "suspended": "已暂停"
    },
    "table": {
      "companyName": "公司名称",
      "type": "类型",
      "contact": "联系人",
      "status": "状态",
      "joinDate": "入驻时间",
      "actions": "操作"
    },
    "types": {
      "travel_agency": "旅行社",
      "hotel": "酒店",
      "attraction": "景区",
      "restaurant": "餐厅",
      "car_rental": "租车"
    },
    "status": {
      "pending": "待审核",
      "approved": "已通过",
      "rejected": "已拒绝",
      "suspended": "已暂停",
      "revision": "待补充"
    },
    "actions": {
      "view": "查看",
      "approve": "通过",
      "reject": "拒绝",
      "suspend": "暂停",
      "resume": "恢复"
    },
    "review": {
      "approveTitle": "确认通过",
      "approveConfirm": "确定通过该供应商的入驻申请？",
      "rejectTitle": "拒绝入驻",
      "rejectReason": "拒绝原因",
      "suspendTitle": "暂停供应商",
      "suspendReason": "暂停原因",
      "note": "审核备注"
    },
    "detail": {
      "basicInfo": "基本信息",
      "businessData": "经营数据",
      "products": "产品列表",
      "orders": "订单记录"
    }
  }
}
```
