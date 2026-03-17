# REQ-20260317-0002: 产品管理功能完善

## 1. 需求背景

EnjoySA 旅游平台的产品管理模块目前后端 API 已基本完整（产品 CRUD、图片/套餐/亮点/FAQ 子资源、排期管理、审核流程），但前端页面存在大量静态 mock 数据和功能缺失，导致供应商无法完整发布产品、管理员无法有效审核、C 端用户看到的是假数据。

---

## 2. 现状分析

### 2.1 实现矩阵

| 功能模块 | 后端 API | 前端 UI | 前端对接 | 状态 |
|---------|---------|---------|---------|------|
| **B 端产品列表** | ✅ GET /supplier/products | ✅ 列表页 | ✅ 已对接 | **可用** |
| **B 端创建产品（基本信息）** | ✅ POST /supplier/products | ✅ 表单页 | ⚠️ 仅基本字段 | **部分可用** |
| **B 端编辑产品** | ✅ PUT /supplier/products/:id | ⚠️ 表单页无回填 | ⚠️ 缺回填+子资源 | **不可用** |
| **B 端图片管理** | ✅ 随产品 CRUD | ❌ 无 UI | ❌ 未对接 | **不可用** |
| **B 端套餐管理** | ✅ 随产品 CRUD | ❌ 无 UI | ❌ 未对接 | **不可用** |
| **B 端亮点管理** | ✅ 随产品 CRUD | ❌ 无 UI | ❌ 未对接 | **不可用** |
| **B 端 FAQ 管理** | ✅ 随产品 CRUD | ❌ 无 UI | ❌ 未对接 | **不可用** |
| **B 端排期管理** | ✅ CRUD + 批量 | ❌ 无 UI | ❌ 未对接 | **不可用** |
| **B 端提交审核** | ✅ POST submit | ❌ 无按钮 | ❌ 未对接 | **不可用** |
| **B 端上/下架** | ✅ POST online/offline | ⚠️ 列表页有按钮 | ⚠️ 未对接 API | **不可用** |
| **B 端区域/分类选择** | ✅ GET regions/categories | ⚠️ 硬编码 4 个分类 | ❌ 未对接 | **不可用** |
| **Admin 产品列表** | ✅ GET /admin/products | ✅ 列表页 | ✅ 已对接 | **可用** |
| **Admin 审核通过/拒绝** | ✅ POST approve/reject | ✅ 按钮 | ✅ 已对接 | **可用** |
| **Admin 产品详情** | ⚠️ 复用公开 API | ⚠️ 硬编码 mock 数据 | ❌ 未对接 | **不可用** |
| **C 端区域景点列表** | ✅ GET /regions/:slug | ✅ RegionPage | ⚠️ 用静态 mock 数据 | **不可用** |
| **C 端景点详情** | ✅ GET /products/:id | ✅ AttractionDetailPage | ⚠️ 用静态 mock 数据 | **不可用** |
| **C 端产品搜索** | ✅ GET /products?keyword= | ❌ 无搜索页 | ❌ 未实现 | **不可用** |

### 2.2 关键问题

1. **供应商表单过于简陋** — 仅支持名称/描述/价格/时长/地点 5 个基本字段，不支持图片上传、套餐定价、亮点描述、FAQ 编辑、区域/分类选择
2. **编辑模式无数据回填** — 打开编辑页面时不加载已有产品数据，所有字段为空
3. **子资源无管理界面** — 后端支持图片/套餐/亮点/FAQ 随产品一起 CRUD，但前端完全没有对应 UI
4. **排期管理无界面** — 后端有完整的排期 API（单个创建、批量创建、更新、删除），前端完全没有排期管理页面
5. **C 端使用静态假数据** — RegionPage 和 AttractionDetailPage 使用 `web/src/data/attractions/` 下的硬编码数据，没有对接真实 API
6. **Admin 审核详情用假数据** — ProductReviewDetail 组件中图片、行程、包含项目全部硬编码
7. **分类硬编码** — 供应商表单的分类下拉框写死 4 个选项（day_tour/multi_day/activity/ticket），未从 API 动态获取
8. **缺少状态流转操作** — 列表页有上/下架按钮但未对接 API；缺少"提交审核"按钮

---

## 3. 实施方案

### Phase 1: B 端产品表单完善（核心，优先级最高）

#### 3.1 改造供应商产品表单

**目标**: 供应商可以完整创建和编辑一个产品的所有信息。

**文件**: `web/src/pages/Supplier/SupplierProductFormPage/SupplierProductFormPage.tsx`

**改造内容**:

**A. 基本信息区域（改造已有）**
- 产品中文名 `name_zh` ✅ 已有
- 产品英文名 `name_en` ✅ 已有
- 中文摘要 `summary_zh`（新增，短描述，200 字以内）
- 英文摘要 `summary_en`（新增）
- 中文详细描述 `description_zh` ✅ 已有（改为富文本或大文本框）
- 英文详细描述 `description_en` ✅ 已有
- 区域选择 `region_id`（新增，下拉框，从 GET /regions 动态获取）
- 分类选择 `category_id`（改造，从 GET /categories 动态获取，替换硬编码）
- 起步价 `price_from` ✅ 已有
- 时长 `duration` ✅ 已有
- 团组人数 `group_size`（新增，如 "2-15 人"）
- 标签 `tags`（新增，多选标签：bestseller/family_friendly/instant_confirmation 等）
- 是否推荐 `is_featured`（新增，开关）
- 中文集合地点 `address_zh` ✅ 已有（meetingPoint）
- 英文集合地点 `address_en`（新增）

**B. 图片管理区域（新增）**
- 图片上传组件（调用 POST /upload 获取 URL）
- 支持多图排序（拖拽排序，sort_order）
- 设置封面图（is_cover 标记）
- 图片预览和删除
- 提交时作为 `images[]` 数组一起发送

**C. 套餐管理区域（新增）**
- 动态列表，每项包含：
  - 套餐中文名 `name_zh`
  - 套餐英文名 `name_en`
  - 套餐中文描述 `desc_zh`
  - 套餐英文描述 `desc_en`
  - 价格 `price`
- 支持添加/删除/排序套餐
- 提交时作为 `packages[]` 数组一起发送

**D. 亮点管理区域（新增）**
- 动态列表，每项包含：
  - 中文标题 `title_zh` + 英文标题 `title_en`
  - 中文描述 `desc_zh` + 英文描述 `desc_en`
- 支持添加/删除/排序
- 提交时作为 `highlights[]` 数组一起发送

**E. FAQ 管理区域（新增）**
- 动态列表，每项包含：
  - 中文问题 `question_zh` + 英文问题 `question_en`
  - 中文回答 `answer_zh` + 英文回答 `answer_en`
- 支持添加/删除/排序
- 提交时作为 `faqs[]` 数组一起发送

**F. 编辑模式数据回填**
- 进入编辑页面时，调用 GET `/supplier/products/:id` 获取完整产品数据
- 将所有字段回填到表单（包括图片列表、套餐、亮点、FAQ）
- 保存时使用 PUT 提交完整数据（后端会删除旧子资源重建）

#### 3.2 产品列表页增强

**文件**: `web/src/pages/Supplier/SupplierProductListPage/SupplierProductListPage.tsx`

- 添加"提交审核"操作按钮（调用 POST `/supplier/products/:id/submit`，仅 draft/rejected 状态显示）
- 对接"上架"API（POST `/supplier/products/:id/online`，仅 offline 状态显示）
- 对接"下架"API（POST `/supplier/products/:id/offline`，仅 approved 状态显示）
- 状态筛选增加 `draft` 标签
- 显示产品图片缩略图（从 API 返回的 images 中取 is_cover=true 的）

---

### Phase 2: Admin 审核详情对接真实数据

**目标**: 管理员审核产品时看到的是真实产品数据而非 mock。

**文件**: `web/src/components/Admin/ProductReviewDetail/ProductReviewDetail.tsx`

**改造内容**:
- 调用 GET `/products/:id` 获取完整产品详情（含图片/套餐/亮点/FAQ）
- **图片 Tab**: 使用真实 `images[]` 数据替换 3 个 Unsplash 硬编码 URL
- **信息 Tab**: 显示真实数据
  - 时长 → `duration`
  - 地点 → `address_zh/address_en`
  - 描述 → `description_zh/description_en`
  - 包含项 → 从 `packages[]` 提取
  - 亮点 → 从 `highlights[]` 提取
- **行程 Tab**: 改为显示 FAQ 列表（或隐藏，因为后端没有行程模型）
- 拒绝时传递 reason 到后端（当前后端 RejectProduct 未接收 reason，需补充）

---

### Phase 3: C 端页面对接真实 API

**目标**: C 端用户看到的是数据库中的真实产品，不再使用静态假数据。

#### 3.3 RegionPage 对接

**文件**: `web/src/pages/RegionPage/RegionPage.tsx`

- 移除对 `web/src/data/attractions/` 的依赖
- 调用 GET `/regions/:slug` 获取区域信息 + 该区域下的产品列表
- 调用 `productService.transformApiProduct()` 转换数据
- 使用真实产品的图片、价格、评分渲染卡片

#### 3.4 AttractionDetailPage 对接

**文件**: `web/src/pages/AttractionDetailPage/AttractionDetailPage.tsx`

- 移除对 `web/src/data/attractions/` 的依赖
- 改用 `productService.getProduct(id)` 获取产品详情
- 将后端 Product 数据映射到页面各模块：
  - 图片轮播 → `images[]`
  - 亮点 → `highlights[]`
  - 套餐选择 → `packages[]`
  - FAQ → `faqs[]`
  - 出发信息 → `duration`, `address_zh/en`
  - 预订排期 → `productService.getSchedules(id)`

#### 3.5 HomePage 产品展示

**文件**: `web/src/pages/HomePage/HomePage.tsx`

- 区域卡片 → 已使用 API（✅ 已完成）
- 精选产品 → 已使用 API（✅ 已完成）
- 轮播图 → 已使用 API（✅ 已完成）

---

### Phase 4: B 端排期管理（可延后）

**目标**: 供应商可以为产品设置可预约日期和时段。

**新增页面**: `web/src/pages/Supplier/SupplierSchedulePage/`

- 日历视图展示产品排期
- 单日新增排期：选择套餐 → 设置时段/名额/价格
- 批量创建排期：选择日期范围 → 设置重复模式（每日/工作日/周末）
- 编辑/删除已有排期
- 显示已预订数量（booked_slots / total_slots）

**API 对接**:
- GET `/products/:id/schedules` — 获取排期列表
- POST `/supplier/products/:id/schedules` — 创建单个排期
- POST `/supplier/products/:id/schedules/batch` — 批量创建
- PUT `/supplier/products/:id/schedules/:sid` — 更新排期
- DELETE `/supplier/products/:id/schedules/:sid` — 删除排期

---

### Phase 5: 后端补充（少量）

| 改动 | 文件 | 说明 |
|------|------|------|
| RejectProduct 接收 reason | `admin_handler.go` | 当前不接收拒绝原因 |
| 下架时更新 region attraction_count | `supplier_product_handler.go` | Offline 时 count - 1 |
| 删除时更新 region attraction_count | `supplier_product_handler.go` | Delete 时 count - 1 |
| 编辑模式 GET 忽略 status 限制 | `supplier_product_handler.go` | 供应商查看自己的 draft 产品详情 |

---

## 4. 实施优先级

| 优先级 | Phase | 内容 | 预估改动 |
|--------|-------|------|---------|
| **P0** | Phase 1 | B 端产品表单完善 | 1 个页面重写 + 1 个列表页增强 |
| **P0** | Phase 2 | Admin 审核详情 | 1 个组件改造 |
| **P1** | Phase 3 | C 端页面对接真实 API | 2 个页面改造 |
| **P2** | Phase 4 | B 端排期管理 | 1 个新页面 |
| **P1** | Phase 5 | 后端补充 | 4 处小改动 |

---

## 5. 验收标准

### Phase 1 验收
- [ ] 供应商可以创建产品并填写所有字段（基本信息 + 图片 + 套餐 + 亮点 + FAQ）
- [ ] 供应商可以上传产品图片并设置封面
- [ ] 供应商可以添加多个套餐（每个有独立名称和价格）
- [ ] 供应商打开编辑页面时所有已有数据正确回填
- [ ] 供应商可以在列表页提交审核（draft → pending）
- [ ] 供应商可以上架/下架产品
- [ ] 区域和分类下拉框从 API 动态获取

### Phase 2 验收
- [ ] 管理员点击产品详情看到的是真实图片、描述、套餐
- [ ] 管理员拒绝产品时可以填写拒绝原因

### Phase 3 验收
- [ ] C 端区域页面展示的是数据库中的真实产品
- [ ] C 端景点详情页展示真实数据（图片、亮点、套餐、FAQ、排期日历）
- [ ] 删除 `web/src/data/attractions/` 静态假数据目录

### Phase 4 验收
- [ ] 供应商可以按日历查看产品排期
- [ ] 供应商可以单个和批量创建排期
- [ ] 供应商可以编辑和删除排期
- [ ] 已预订的排期显示预订进度

---

## 6. 文件变更清单

### 前端新增/改造

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/pages/Supplier/SupplierProductFormPage/SupplierProductFormPage.tsx` | **重写** | 完整产品表单（基本信息+图片+套餐+亮点+FAQ） |
| `web/src/pages/Supplier/SupplierProductListPage/SupplierProductListPage.tsx` | 改造 | 添加提交审核/上架/下架操作 |
| `web/src/components/Admin/ProductReviewDetail/ProductReviewDetail.tsx` | 改造 | 对接真实产品数据 |
| `web/src/pages/RegionPage/RegionPage.tsx` | 改造 | 移除静态数据，对接 API |
| `web/src/pages/AttractionDetailPage/AttractionDetailPage.tsx` | 改造 | 移除静态数据，对接 API |
| `web/src/pages/Supplier/SupplierSchedulePage/` | **新增** | 排期管理页面（Phase 4） |
| `web/src/services/productService.ts` | 改造 | 添加供应商产品 API 方法 |
| `web/src/data/attractions/` | **删除** | 移除所有静态假数据文件 |

### 后端改造

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/internal/admin/handler/admin_handler.go` | 改造 | RejectProduct 接收 reason |
| `backend/internal/product/handler/supplier_product_handler.go` | 改造 | Offline/Delete 时更新 region count |
