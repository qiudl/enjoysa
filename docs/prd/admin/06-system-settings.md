# PRD-06: 系统设置模块

## 1. 模块概述

### 1.1 模块定位
系统设置模块用于配置平台基础信息、管理员账号和系统参数。

### 1.2 目标用户
- 超级管理员
- 系统管理员

### 1.3 核心价值
- 灵活配置平台参数
- 安全管理管理员账号
- 规范权限分配

---

## 2. 页面设计

### 2.1 设置页面布局 (SettingsPage)

**路由**: `/admin/settings`

#### Tab 结构
```
┌─────────────────────────────────────────────────────────┐
│ 系统设置                                                │
├─────────────────────────────────────────────────────────┤
│ [基本设置] [支付设置] [通知设置] [管理员] [权限管理]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [当前 Tab 内容区域]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 基本设置 (GeneralSettings)

#### 配置项

| 配置项 | 类型 | 说明 |
|--------|------|------|
| 平台名称（中文） | 文本 | 畅游南澳 |
| 平台名称（英文） | 文本 | EnjoySA |
| 平台 Logo | 图片 | 上传 |
| 平台 Favicon | 图片 | 上传 |
| 联系电话 | 文本 | 客服电话 |
| 联系邮箱 | 文本 | 客服邮箱 |
| 微信客服 | 文本 | 微信号 |
| 公司地址 | 文本 | 办公地址 |
| 备案信息 | 文本 | ICP 备案号 |
| 版权信息 | 文本 | 页脚版权 |

```
┌─────────────────────────────────────────────────────────┐
│ 基本设置                                                │
├─────────────────────────────────────────────────────────┤
│ 平台信息                                                │
│ ──────────────────────────────────────                  │
│ 平台名称(中): [畅游南澳____________]                    │
│ 平台名称(英): [EnjoySA______________]                   │
│ 平台 Logo:   [上传图片] 当前: enjoysa-logo.png          │
│                                                         │
│ 联系方式                                                │
│ ──────────────────────────────────────                  │
│ 客服电话:    [+61 8 1234 5678_______]                   │
│ 客服邮箱:    [service@enjoysa.com.au]                   │
│ 微信客服:    [EnjoySA_Service_______]                   │
│                                                         │
│ 其他信息                                                │
│ ──────────────────────────────────────                  │
│ 公司地址:    [Adelaide, SA__________]                   │
│ 备案信息:    [ICP备案号______________]                  │
│                                                         │
│                              [取消] [保存设置]          │
└─────────────────────────────────────────────────────────┘
```

---

### 2.3 支付设置 (PaymentSettings)

#### 支付方式配置

| 支付方式 | 状态 | 配置项 |
|----------|------|--------|
| 微信支付 | 开启/关闭 | AppID, 商户号, 密钥 |
| 支付宝 | 开启/关闭 | AppID, 私钥, 公钥 |
| 银行卡 | 开启/关闭 | Stripe 配置 |
| 银行转账 | 开启/关闭 | 收款账户信息 |

#### 佣金设置
- 默认佣金比例
- 按供应商类型设置

```
┌─────────────────────────────────────────────────────────┐
│ 支付设置                                                │
├─────────────────────────────────────────────────────────┤
│ 支付方式                                                │
│ ──────────────────────────────────────                  │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 微信支付                                    [开启] ○││
│ │ AppID: wx*****                                      ││
│ │ 商户号: 1234567890                                  ││
│ │ [配置]                                              ││
│ └─────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────┐│
│ │ 支付宝                                      [关闭] ○││
│ │ [配置]                                              ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ 佣金设置                                                │
│ ──────────────────────────────────────                  │
│ 默认佣金比例: [10] %                                    │
│                                                         │
│ 按供应商类型:                                           │
│ 旅行社: [10] %  酒店: [8] %  景区: [12] %               │
│                                                         │
│                              [取消] [保存设置]          │
└─────────────────────────────────────────────────────────┘
```

---

### 2.4 通知设置 (NotificationSettings)

#### 通知模板

| 场景 | 通知方式 | 模板变量 |
|------|----------|----------|
| 订单创建 | 邮件/短信 | 订单号、产品名、金额 |
| 支付成功 | 邮件/短信 | 订单号、支付时间 |
| 订单确认 | 邮件/短信 | 订单号、出行日期 |
| 退款通知 | 邮件 | 订单号、退款金额 |
| 行程提醒 | 邮件/短信 | 产品名、出行日期、集合地点 |

---

### 2.5 管理员管理 (AdminList)

#### 管理员列表
```
┌─────────────────────────────────────────────────────────┐
│ 管理员列表                              [+ 添加管理员]   │
├─────────────────────────────────────────────────────────┤
│ 头像 │ 姓名   │ 邮箱            │ 角色    │ 状态 │ 操作 │
│ [👤] │ 张三   │ admin@xx.com   │ 超级管理│ 正常 │ ... │
│ [👤] │ 李四   │ ops@xx.com     │ 运营人员│ 正常 │ ... │
│ [👤] │ 王五   │ cs@xx.com      │ 客服    │ 正常 │ ... │
└─────────────────────────────────────────────────────────┘
```

#### 添加/编辑管理员
- 姓名
- 邮箱（登录账号）
- 初始密码
- 角色选择
- 状态

---

### 2.6 权限管理 (RolePermissions)

#### 预设角色

| 角色 | 权限 |
|------|------|
| 超级管理员 | 所有权限 |
| 管理员 | 除系统设置外所有权限 |
| 运营人员 | 供应商、产品、订单 |
| 客服 | 订单查看、用户查看 |
| 财务 | 订单查看、财务管理 |

#### 权限矩阵
```
           │ 供应商 │ 产品 │ 订单 │ 用户 │ 财务 │ 设置 │
超级管理员 │  ✓✓✓  │ ✓✓✓ │ ✓✓✓ │ ✓✓✓ │ ✓✓✓ │ ✓✓✓ │
管理员     │  ✓✓✓  │ ✓✓✓ │ ✓✓✓ │ ✓✓✓ │ ✓✓✓ │  -  │
运营人员   │  ✓✓-  │ ✓✓- │ ✓✓- │ ✓--  │  -  │  -  │
客服       │  ✓--  │ ✓-- │ ✓✓- │ ✓--  │  -  │  -  │
财务       │  ✓--  │  -  │ ✓-- │  -  │ ✓✓✓ │  -  │

✓✓✓ = 查看+编辑+删除
✓✓- = 查看+编辑
✓-- = 仅查看
 -  = 无权限
```

---

## 3. 数据模型

```typescript
interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'operator'
  | 'customer_service'
  | 'finance';

interface Permission {
  module: string;
  actions: ('view' | 'edit' | 'delete')[];
}

interface RoleConfig {
  role: AdminRole;
  name: string;
  nameEn: string;
  permissions: Permission[];
}

interface PlatformSettings {
  platformNameZh: string;
  platformNameEn: string;
  logo?: string;
  favicon?: string;
  contactPhone: string;
  contactEmail: string;
  wechatService?: string;
  address: string;
  icp?: string;
  copyright: string;
}

interface PaymentConfig {
  wechat: {
    enabled: boolean;
    appId?: string;
    mchId?: string;
  };
  alipay: {
    enabled: boolean;
    appId?: string;
  };
  stripe: {
    enabled: boolean;
    publishableKey?: string;
  };
  bankTransfer: {
    enabled: boolean;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
}

interface CommissionConfig {
  defaultRate: number;
  bySupplierType: {
    travel_agency: number;
    hotel: number;
    attraction: number;
    restaurant: number;
    car_rental: number;
  };
}
```

---

## 4. 组件清单

| 组件名 | 路径 | 说明 |
|--------|------|------|
| SettingsPage | `pages/Admin/SettingsPage/` | 设置页面 |
| GeneralSettings | `components/Admin/GeneralSettings/` | 基本设置 |
| PaymentSettings | `components/Admin/PaymentSettings/` | 支付设置 |
| NotificationSettings | `components/Admin/NotificationSettings/` | 通知设置 |
| AdminList | `components/Admin/AdminList/` | 管理员列表 |
| AdminForm | `components/Admin/AdminForm/` | 管理员表单 |
| RolePermissions | `components/Admin/RolePermissions/` | 权限配置 |

---

## 5. 安全考虑

- 敏感配置（支付密钥）加密存储
- 修改关键配置需二次验证
- 操作日志记录
- 权限变更即时生效

---

## 6. Storybook Stories

```typescript
// GeneralSettings.stories.tsx
export const Default = {};
export const WithData = {};
export const Saving = { args: { loading: true } };
export const EnglishVersion = {};

// PaymentSettings.stories.tsx
export const AllEnabled = {};
export const WechatOnly = {};
export const Configuring = {};

// AdminList.stories.tsx
export const Default = {};
export const Empty = {};
export const WithDisabled = {};

// AdminForm.stories.tsx
export const Create = { args: { mode: 'create' } };
export const Edit = { args: { mode: 'edit' } };

// RolePermissions.stories.tsx
export const Default = {};
export const Editing = {};
```

---

## 7. i18n Keys

```json
{
  "admin.settings": {
    "title": "系统设置",
    "tabs": {
      "general": "基本设置",
      "payment": "支付设置",
      "notification": "通知设置",
      "admins": "管理员",
      "permissions": "权限管理"
    },
    "general": {
      "platformInfo": "平台信息",
      "platformNameZh": "平台名称(中文)",
      "platformNameEn": "平台名称(英文)",
      "logo": "平台 Logo",
      "contactInfo": "联系方式",
      "contactPhone": "客服电话",
      "contactEmail": "客服邮箱",
      "wechatService": "微信客服",
      "otherInfo": "其他信息",
      "address": "公司地址",
      "icp": "备案信息",
      "copyright": "版权信息"
    },
    "payment": {
      "title": "支付方式",
      "wechat": "微信支付",
      "alipay": "支付宝",
      "card": "银行卡",
      "transfer": "银行转账",
      "configure": "配置",
      "commission": "佣金设置",
      "defaultRate": "默认佣金比例",
      "byType": "按供应商类型"
    },
    "admins": {
      "list": "管理员列表",
      "add": "添加管理员",
      "edit": "编辑管理员",
      "name": "姓名",
      "email": "邮箱",
      "role": "角色",
      "status": "状态",
      "password": "密码",
      "resetPassword": "重置密码"
    },
    "roles": {
      "super_admin": "超级管理员",
      "admin": "管理员",
      "operator": "运营人员",
      "customer_service": "客服",
      "finance": "财务"
    },
    "permissions": {
      "title": "权限配置",
      "module": "模块",
      "view": "查看",
      "edit": "编辑",
      "delete": "删除"
    },
    "actions": {
      "save": "保存设置",
      "cancel": "取消",
      "enable": "启用",
      "disable": "禁用"
    }
  }
}
```
