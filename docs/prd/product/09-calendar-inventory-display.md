# REQ-20260326-0001 日历库存数显示优化

| 字段 | 值 |
|------|-----|
| 需求编号 | REQ-20260326-0001 |
| 优先级 | Medium |
| 类型 | Improvement |
| 状态 | approved |
| 创建日期 | 2026-03-26 |
| 原型 | [product-calendar-inventory.html](../../prototypes/product-calendar-inventory.html) |

---

## 1. 需求描述

### 1.1 问题背景

商品详情页的预订日历目前仅使用绿色/橙色小圆点表示日期可用性。用户无法在日历上直观看到每天的**价格**和**剩余库存数**，必须点击具体日期后才能在时段选择器中查看详情。

### 1.2 现状痛点

- 圆点指示器信息密度太低，只能区分"可订/紧张/售罄"三种状态
- 用户无法比价 — 不同日期可能有不同价格（周末溢价等），但需逐个点击才能发现
- 库存紧迫感缺失 — 看不到具体剩余数量，无法制造"仅剩N位"的紧迫感
- 与 Klook、Viator、携程等主流平台的日历体验有明显差距

### 1.3 竞品参考

| 平台 | 日历格显示内容 |
|------|--------------|
| Klook | 日期 + 起步价（红色） |
| Viator | 日期 + 价格 |
| 携程 | 日期 + 价格 + 余量标签 |
| GetYourGuide | 日期 + 价格 |

---

## 2. 预期结果

日历每个有排期的日期格内直接展示**三行信息**：

```
┌─────────┐
│   26    │  ← 日期数字 (13px, 500weight)
│  A$89   │  ← 当日起步价 (9px, 红色 #ef4444)
│  余12   │  ← 剩余库存 (8px, 绿色/橙色)
└─────────┘
```

- 库存充足（≥5位）→ 绿色 `#16a34a`
- 库存紧张（<5位）→ 橙色 `#f59e0b`，制造紧迫感
- 已售罄 → 红色"满"/"Full"文字，日期不可点击
- 选中日期 → 蓝底 `#0066ff`，文字全部反白
- 过去日期 → 仅显示日期数字，30% 透明度
- 无排期日期 → 仅显示日期数字

---

## 3. 验收标准

- [ ] 日历格内显示价格（红色）+ 剩余库存数（绿/橙色），替换原有圆点指示器
- [ ] 库存充足（≥5）绿色，库存紧张（<5）橙色，售罄显示"满"/"Full"
- [ ] 选中日期状态下价格和库存文字正确反白（白色/半透明白）
- [ ] 中英文双语正确显示（中文"余N" / 英文"N left"）
- [ ] 移动端响应式布局正常，日历格文字不溢出截断
- [ ] 切换套餐后日历库存数据跟随刷新

---

## 4. 技术方案

### 4.1 影响范围

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `ProductDetailPage.tsx` | 修改 | 日历格渲染逻辑：圆点 → 价格+库存文本 |
| `ProductDetailPage.module.css` | 修改 | 日历格样式：aspect-ratio → min-height，新增文本样式 |

**无新文件**，仅修改现有 2 个文件。无后端变更，数据已通过 `scheduleMap` 就绪。

### 4.2 数据源

日历格所需数据已在现有 `scheduleMap` 中：

```typescript
// 现有数据结构，无需修改
scheduleMap: Map<string, {
  available: boolean;
  slots: number;    // ← 剩余库存（已有）
  total: number;
  price: number;    // ← 起步价（已有）
}>
```

### 4.3 TSX 变更

**删除**：圆点指示器 `<span className={styles.dayDot}>`

**替换为**：

```tsx
{day.hasSchedule && !day.isPast && info ? (
  <>
    {info.price > 0 && (
      <span className={styles.dayPrice}>{currencySymbol}{info.price}</span>
    )}
    <span className={`${styles.daySlots} ${isLimited ? styles.daySlotsLimited : styles.daySlotsAvailable}`}>
      {isZh ? `余${day.slots}` : `${day.slots} left`}
    </span>
  </>
) : null}
```

### 4.4 CSS 变更

| 变更 | Before | After |
|------|--------|-------|
| 日历格高度 | `aspect-ratio: 1` | `min-height: 54px` |
| 日历格间距 | 无 | `gap: 1px; padding: 4px 2px` |
| 可用指示器 | `.dayDot` (4px 圆点) | `.dayPrice` + `.daySlots` (文本) |
| 选中态 | `.selectedDay .dayDot { background: white }` | `.selectedDay .dayPrice { color: white }` |

**新增 CSS 类**：

```css
.dayPrice     /* 9px, 600weight, #ef4444 */
.daySlots     /* 8px, 500weight */
.daySlotsAvailable  /* #16a34a */
.daySlotsLimited    /* #f59e0b */
```

**删除 CSS 类**：

```css
.dayDot       /* 4px 圆点 */
.dotAvailable /* 绿色圆点 */
.dotLimited   /* 橙色圆点 */
.dotFull      /* 红色圆点 */
```

### 4.5 界面原型

原型文件：[docs/prototypes/product-calendar-inventory.html](../../prototypes/product-calendar-inventory.html)

包含 Before/After 对比视图，可在浏览器直接打开预览。

---

## 5. 开发计划

### 任务拆分

| # | 任务 | 工作量 | 说明 |
|---|------|--------|------|
| 1 | TSX 日历格渲染逻辑替换 | 已完成 | 圆点 → 价格+库存文本 |
| 2 | CSS 样式替换 | 已完成 | 删除圆点样式，新增文本样式 |
| 3 | 移动端适配验证 | 待验证 | 小屏幕下日历格文字溢出检查 |
| 4 | 中英文切换验证 | 待验证 | "余N" vs "N left" 显示效果 |
| 5 | 构建检查 | 已通过 | `tsc --noEmit` + `npm run build` 均通过 |

### 当前进度

代码改动已完成（任务 1、2、5），待执行视觉验证（任务 3、4）。
