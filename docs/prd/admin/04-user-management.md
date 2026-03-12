# PRD-04: 用户管理模块

## 1. 模块概述

### 1.1 模块定位
用户管理模块用于管理平台注册用户，查看用户数据和处理用户问题。

### 1.2 目标用户
- 客服人员
- 运营人员

### 1.3 核心价值
- 了解用户画像
- 处理用户问题
- 用户数据分析

---

## 2. 页面设计

### 2.1 用户列表页 (UserList)

**路由**: `/admin/users`

#### 页面布局
```
┌─────────────────────────────────────────────────────────┐
│ [统计卡片区]                                            │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ 总用户数 │ │ 今日新增 │ │ 活跃用户 │ │ 已禁用  │        │
│ │  5,280  │ │   23    │ │  1,256  │ │   15    │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────┤
│ [工具栏]                                                │
│ [搜索用户________] [状态▼] [注册时间▼]                  │
├─────────────────────────────────────────────────────────┤
│ [用户表格]                                              │
│ 头像 │ 昵称   │ 手机/邮箱     │ 订单数│ 消费额 │ 状态 │ 操作 │
│ [👤] │ 小明   │ 138****8888  │  12  │ ¥3,580│ 正常 │ ... │
│ [👤] │ 游客A  │ test@xx.com  │   0  │    ¥0 │ 正常 │ ... │
├─────────────────────────────────────────────────────────┤
│ [分页]                                                  │
└─────────────────────────────────────────────────────────┘
```

#### 功能点

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 用户搜索 | 按昵称、手机、邮箱搜索 | P0 |
| 状态筛选 | 全部/正常/已禁用 | P0 |
| 时间筛选 | 注册时间范围 | P1 |
| 排序 | 注册时间/订单数/消费额 | P1 |
| 导出 | 导出用户列表 | P2 |

---

### 2.2 用户详情 (UserDetail)

#### 详情布局
```
┌─────────────────────────────────────────────────────────┐
│ 用户详情                                    [关闭 X]    │
├─────────────────────────────────────────────────────────┤
│ [用户头像]                                              │
│    👤                                                   │
│   小明                                                  │
│   正常用户                                              │
├─────────────────────────────────────────────────────────┤
│ [Tab: 基本信息 | 订单记录 | 收藏列表]                   │
├─────────────────────────────────────────────────────────┤
│ 基本信息                                                │
│ ──────────────────────────────────────                  │
│ 用户ID: U10086                                          │
│ 昵称: 小明                                              │
│ 手机: 138****8888                                       │
│ 邮箱: xiaoming@example.com                              │
│ 注册时间: 2025-12-15 10:30                              │
│ 最后登录: 2026-01-28 15:20                              │
│ ──────────────────────────────────────                  │
│ 消费统计                                                │
│ 订单数: 12                                              │
│ 消费总额: ¥3,580                                        │
│ 收藏数: 8                                               │
├─────────────────────────────────────────────────────────┤
│ [操作按钮]                                              │
│ [禁用用户] [删除用户]                                   │
└─────────────────────────────────────────────────────────┘
```

#### Tab 内容

**基本信息**
- 用户ID
- 昵称
- 头像
- 手机号
- 邮箱
- 注册时间
- 最后登录时间
- 登录方式

**订单记录**
- 该用户的所有订单列表
- 简化展示：订单号、产品名、金额、状态、时间
- 支持跳转到订单详情

**收藏列表**
- 用户收藏的产品列表
- 显示：产品名、价格、收藏时间

---

### 2.3 用户订单历史 (UserOrderHistory)

显示用户的所有历史订单，支持跳转到订单详情。

```
┌─────────────────────────────────────────────────────────┐
│ 订单记录 (共 12 条)                                     │
├─────────────────────────────────────────────────────────┤
│ 订单号      │ 产品          │ 金额  │ 状态   │ 时间     │
│ 20260128001│ 袋鼠岛一日游   │ ¥778 │ 已完成 │ 01-28   │
│ 20260115002│ 巴罗莎谷酒庄   │ ¥598 │ 已完成 │ 01-15   │
│ 20260110003│ 阿德莱德观光   │ ¥318 │ 已取消 │ 01-10   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型

```typescript
interface User {
  id: string;
  nickname: string;
  avatar?: string;
  phone?: string;
  email?: string;
  // 登录方式
  loginType: 'phone' | 'email' | 'wechat' | 'google';
  // 状态
  status: 'active' | 'disabled';
  // 统计
  orderCount: number;
  totalSpent: number;
  favoriteCount: number;
  // 时间
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserFavorite {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  createdAt: string;
}
```

---

## 4. 组件清单

| 组件名 | 路径 | 说明 |
|--------|------|------|
| UserList | `pages/Admin/UserList/` | 列表页面 |
| UserTable | `components/Admin/UserTable/` | 用户表格 |
| UserDetail | `components/Admin/UserDetail/` | 用户详情抽屉 |
| UserOrderHistory | `components/Admin/UserOrderHistory/` | 订单历史 |
| UserStats | `components/Admin/UserStats/` | 用户统计 |

---

## 5. Storybook Stories

```typescript
// UserTable.stories.tsx
export const Default = {};
export const Loading = {};
export const Empty = {};
export const WithDisabledUsers = {};
export const EnglishVersion = {};

// UserDetail.stories.tsx
export const ActiveUser = { args: { status: 'active' } };
export const DisabledUser = { args: { status: 'disabled' } };
export const NewUser = { args: { orderCount: 0 } };
export const VIPUser = { args: { totalSpent: 10000 } };

// UserOrderHistory.stories.tsx
export const WithOrders = {};
export const Empty = {};
export const Loading = {};
```

---

## 6. i18n Keys

```json
{
  "admin.users": {
    "title": "用户管理",
    "stats": {
      "total": "总用户数",
      "today": "今日新增",
      "active": "活跃用户",
      "disabled": "已禁用"
    },
    "table": {
      "avatar": "头像",
      "nickname": "昵称",
      "contact": "手机/邮箱",
      "orders": "订单数",
      "spent": "消费额",
      "status": "状态",
      "registerDate": "注册时间",
      "lastLogin": "最后登录"
    },
    "status": {
      "active": "正常",
      "disabled": "已禁用"
    },
    "detail": {
      "basicInfo": "基本信息",
      "orderHistory": "订单记录",
      "favorites": "收藏列表",
      "stats": "消费统计",
      "userId": "用户ID",
      "registerTime": "注册时间",
      "lastLogin": "最后登录",
      "loginType": "登录方式"
    },
    "actions": {
      "view": "查看",
      "disable": "禁用用户",
      "enable": "启用用户",
      "delete": "删除用户"
    },
    "confirm": {
      "disableTitle": "禁用用户",
      "disableMessage": "确定要禁用该用户吗？禁用后用户将无法登录。",
      "deleteTitle": "删除用户",
      "deleteMessage": "确定要删除该用户吗？此操作不可恢复。"
    }
  }
}
```
