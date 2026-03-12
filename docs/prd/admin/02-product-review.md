# PRD-02: 产品审核模块

## 1. 模块概述

### 1.1 模块定位
产品审核模块用于管理供应商提交的旅游产品，确保平台产品质量和信息准确性。

### 1.2 目标用户
- 产品运营人员
- 内容审核人员

### 1.3 核心价值
- 保障平台产品质量
- 规范产品信息标准
- 提高审核效率

---

## 2. 页面设计

### 2.1 产品审核列表 (ProductReviewList)

**路由**: `/admin/products`

#### 页面布局
```
┌─────────────────────────────────────────────────────────┐
│ [Tab 切换]                                              │
│ [待审核(12)] [已通过] [已拒绝] [需修改]                  │
├─────────────────────────────────────────────────────────┤
│ [工具栏]                                                │
│ [搜索框________] [分类▼] [供应商▼] [批量通过] [批量拒绝] │
├─────────────────────────────────────────────────────────┤
│ [产品卡片列表]                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ [图片] │ 袋鼠岛一日游                              │  │
│ │        │ 供应商: 祥龙旅行社  分类: 一日游          │  │
│ │        │ 价格: ¥389  提交: 2026-01-28             │  │
│ │        │ [预览] [通过] [拒绝] [要求修改]           │  │
│ └───────────────────────────────────────────────────┘  │
│ ┌───────────────────────────────────────────────────┐  │
│ │ [图片] │ 巴罗莎谷酒庄之旅                          │  │
│ │ ...                                               │  │
│ └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│ [分页]                                                  │
└─────────────────────────────────────────────────────────┘
```

#### 功能点

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Tab 筛选 | 按审核状态快速切换 | P0 |
| 产品搜索 | 按名称搜索 | P0 |
| 分类筛选 | 一日游/多日游/门票/活动 | P0 |
| 供应商筛选 | 按供应商筛选 | P1 |
| 批量审核 | 批量通过/拒绝 | P1 |
| 快速预览 | 悬停预览产品信息 | P2 |

---

### 2.2 产品审核详情 (ProductReviewDetail)

#### 预览布局
```
┌─────────────────────────────────────────────────────────┐
│ [产品预览 - 模拟 C 端展示]                              │
│ ┌─────────────────────────────────────────────────────┐│
│ │ [轮播图区域]                                        ││
│ │ [图1] [图2] [图3] [图4]                             ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ 袋鼠岛一日游 / Kangaroo Island Day Tour                │
│ ⭐ 4.8 (126条评价)                                     │
│                                                         │
│ ¥389 /人                                               │
│                                                         │
│ [Tab: 产品详情 | 费用说明 | 预订须知]                   │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 行程亮点                                            ││
│ │ • 近距离接触野生袋鼠和考拉                          ││
│ │ • 品尝当地特色蜂蜜和美食                            ││
│ │ • 欣赏神奇岩石等自然奇观                            ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│ [审核操作区]                                            │
│ 审核意见: [________________________]                    │
│ [通过] [拒绝] [要求修改]                                │
└─────────────────────────────────────────────────────────┘
```

#### 审核检查项

| 检查项 | 说明 |
|--------|------|
| 标题规范 | 中英文标题完整、无错别字 |
| 图片质量 | 清晰、无水印、符合规范 |
| 价格合理 | 价格在合理范围内 |
| 描述完整 | 行程、费用说明完整 |
| 信息准确 | 集合地点、时间准确 |

---

### 2.3 审核操作 (ProductReviewForm)

#### 审核流程
```
[待审核] → 通过 → [已上架]
         → 拒绝 → [已拒绝] → 供应商修改 → [待审核]
         → 要求修改 → [需修改] → 供应商修改 → [待审核]
```

#### 拒绝/修改原因模板

```typescript
const rejectReasons = [
  { key: 'image_quality', label: '图片质量不符合要求' },
  { key: 'title_issue', label: '标题不规范或有错误' },
  { key: 'price_abnormal', label: '价格异常' },
  { key: 'description_incomplete', label: '描述信息不完整' },
  { key: 'misleading_info', label: '存在误导性信息' },
  { key: 'duplicate', label: '与已有产品重复' },
  { key: 'other', label: '其他原因' },
];
```

---

## 3. 数据模型

### 3.1 ProductReview 接口

```typescript
interface ProductReview {
  id: string;
  productId: string;
  // 产品信息
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  images: string[];
  price: number;
  originalPrice?: number;
  category: ProductCategory;
  duration?: string;
  meetingPoint?: string;
  includes: string[];
  excludes: string[];
  highlights: string[];
  // 供应商信息
  supplierId: string;
  supplierName: string;
  // 审核信息
  status: ReviewStatus;
  rejectReason?: string;
  revisionNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  // 时间戳
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

type ProductCategory =
  | 'day_tour'
  | 'multi_day'
  | 'activity'
  | 'ticket';

type ReviewStatus =
  | 'pending'           // 待审核
  | 'approved'          // 已通过
  | 'rejected'          // 已拒绝
  | 'revision_required'; // 需修改
```

---

## 4. 交互设计

### 4.1 列表交互

| 操作 | 触发 | 结果 |
|------|------|------|
| 预览 | 点击预览按钮 | 打开全屏预览模态框 |
| 快速通过 | 点击通过 | 二次确认后直接通过 |
| 快速拒绝 | 点击拒绝 | 弹出原因选择框 |
| 要求修改 | 点击要求修改 | 弹出修改意见填写框 |
| 批量选择 | 勾选多个 | 显示批量操作按钮 |

### 4.2 预览模式

- 模拟 C 端用户视角
- 支持中英文切换预览
- 支持移动端视图预览

---

## 5. 组件清单

| 组件名 | 路径 | 说明 |
|--------|------|------|
| ProductReviewList | `pages/Admin/ProductReviewList/` | 列表页面 |
| ProductReviewCard | `components/Admin/ProductReviewCard/` | 产品卡片 |
| ProductReviewDetail | `components/Admin/ProductReviewDetail/` | 预览详情 |
| ProductReviewForm | `components/Admin/ProductReviewForm/` | 审核表单 |
| ProductPreview | `components/Admin/ProductPreview/` | C端预览 |

---

## 6. Storybook Stories

```typescript
// ProductReviewCard.stories.tsx
export const Default = {};
export const Pending = { args: { status: 'pending' } };
export const Approved = { args: { status: 'approved' } };
export const Rejected = { args: { status: 'rejected' } };
export const Selected = { args: { selected: true } };

// ProductPreview.stories.tsx
export const ChineseVersion = { args: { language: 'zh' } };
export const EnglishVersion = { args: { language: 'en' } };
export const MobileView = { args: { viewport: 'mobile' } };
export const WithManyImages = { args: { imageCount: 10 } };

// ProductReviewForm.stories.tsx
export const ApproveMode = { args: { mode: 'approve' } };
export const RejectMode = { args: { mode: 'reject' } };
export const RevisionMode = { args: { mode: 'revision' } };
```

---

## 7. i18n Keys

```json
{
  "admin.products": {
    "title": "产品审核",
    "tabs": {
      "pending": "待审核",
      "approved": "已通过",
      "rejected": "已拒绝",
      "revision": "需修改"
    },
    "categories": {
      "day_tour": "一日游",
      "multi_day": "多日游",
      "activity": "活动体验",
      "ticket": "景点门票"
    },
    "actions": {
      "preview": "预览",
      "approve": "通过",
      "reject": "拒绝",
      "requestRevision": "要求修改",
      "batchApprove": "批量通过",
      "batchReject": "批量拒绝"
    },
    "review": {
      "approveConfirm": "确定通过该产品？",
      "rejectReason": "拒绝原因",
      "revisionNote": "修改意见",
      "notePlaceholder": "请输入审核意见..."
    },
    "reasons": {
      "imageQuality": "图片质量不符合要求",
      "titleIssue": "标题不规范或有错误",
      "priceAbnormal": "价格异常",
      "descriptionIncomplete": "描述信息不完整",
      "misleadingInfo": "存在误导性信息",
      "duplicate": "与已有产品重复",
      "other": "其他原因"
    },
    "preview": {
      "title": "产品预览",
      "switchLang": "切换语言",
      "mobileView": "移动端视图"
    }
  }
}
```
