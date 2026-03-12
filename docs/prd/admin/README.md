# Admin 平台管理后台 PRD 文档

## 文档索引

| 文档 | 模块 | 优先级 | 状态 |
|------|------|--------|------|
| [PRD-01](./01-supplier-management.md) | 供应商管理 | P0 | 待开发 |
| [PRD-02](./02-product-review.md) | 产品审核 | P0 | 待开发 |
| [PRD-03](./03-order-management.md) | 订单管理 | P1 | 待开发 |
| [PRD-04](./04-user-management.md) | 用户管理 | P1 | 待开发 |
| [PRD-05](./05-finance-management.md) | 财务管理 | P2 | 待开发 |
| [PRD-06](./06-system-settings.md) | 系统设置 | P2 | 待开发 |

## 技术规范

- **框架**: React 18 + TypeScript
- **样式**: CSS Modules
- **国际化**: react-i18next (中英文)
- **图标**: lucide-react
- **文档**: Storybook 组件故事
- **组件目录**: `web/src/components/Admin/`
- **页面目录**: `web/src/pages/Admin/`

## 开发计划

### Phase 1 (P0) - 核心功能
- [ ] 供应商管理模块
- [ ] 产品审核模块

### Phase 2 (P1) - 业务功能
- [ ] 订单管理模块
- [ ] 用户管理模块
- [ ] 通用组件库

### Phase 3 (P2) - 扩展功能
- [ ] 财务管理模块
- [ ] 系统设置模块

## 通用组件需求

| 组件 | 说明 | 优先级 |
|------|------|--------|
| DataTable | 通用数据表格 | P0 |
| SearchInput | 搜索输入框 | P0 |
| FilterDropdown | 筛选下拉框 | P0 |
| StatusBadge | 状态徽章 | P0 |
| Drawer | 侧边抽屉 | P0 |
| DateRangePicker | 日期范围选择 | P1 |
| EmptyState | 空状态展示 | P1 |
| ConfirmDialog | 确认对话框 | P1 |
