# REQ-20260317-0001: 管理员用户管理模块 - CRUD 完善

## 1. 需求背景

管理员用户管理模块（AdminList）目前仅实现了 **创建(Create)** 和 **列表(List)** 两个操作，其余 CRUD 操作（查看详情、编辑、删除、状态切换、密码管理）的前端 UI 已就绪但未对接后端 API。

---

## 2. 现状分析

### 2.1 CRUD 实现矩阵

| 操作 | 后端 Route | 后端 Handler | 后端 Store | 前端 Service | 前端 UI | 状态 |
|------|-----------|-------------|-----------|-------------|---------|------|
| **Create** | `POST /admin/admins` | ✅ CreateAdmin | ✅ Create | ✅ createAdmin | ✅ AdminForm | **可用** |
| **List** | `GET /admin/admins` | ✅ ListAdmins | ✅ List | ✅ listAdmins | ✅ AdminTable | **可用** |
| **Get** | ❌ 缺失 | ❌ 缺失 | ✅ GetByID | ❌ 缺失 | ⚠️ 复用列表数据 | **不可用** |
| **Update** | ❌ 缺失 | ❌ 缺失 | ✅ Update | ❌ 缺失 | ⚠️ UI 就绪未对接 | **不可用** |
| **Delete** | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 | ⚠️ 仅本地删除 | **不可用** |
| **状态切换** | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 | ⚠️ 仅本地切换 | **不可用** |
| **改密码** | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 | **不可用** |

### 2.2 已实现的部分

**后端（5 个文件）：**
- `backend/internal/auth/model/admin.go` — Admin 模型（ID, Email, Password, Name, Role, Status, LastLoginAt, 软删除）
- `backend/internal/auth/store/admin_store.go` — 4 个方法：GetByEmail, GetByID, Create, Update(GORM Save)
- `backend/internal/auth/handler/admin_auth_handler.go` — Login, RefreshToken, GetProfile
- `backend/internal/admin/handler/admin_handler.go` — ListAdmins, CreateAdmin
- `backend/internal/router/router.go` — 2 条路由（GET + POST /admin/admins），super_admin 权限

**前端（4 个文件）：**
- `web/src/services/adminService.ts` — listAdmins, createAdmin
- `web/src/pages/Admin/AdminList/AdminList.tsx` — 列表页，含本地状态切换/删除逻辑
- `web/src/components/Admin/AdminTable/AdminTable.tsx` — 表格组件，含操作按钮
- `web/src/components/Admin/AdminForm/AdminForm.tsx` — 表单组件，支持创建/编辑模式

### 2.3 关键问题

1. **硬编码默认密码** — 创建管理员时前端写死 `Admin123!`，存在安全隐患
2. **角色不一致** — 前端定义 4 种角色（super_admin/admin/operator/viewer），后端仅用 2 种（super_admin/admin）
3. **编辑/删除仅本地** — 前端 handleFormSubmit / handleDelete / handleToggleStatus 只改本地 state，无 API 调用
4. **无密码管理** — 管理员无法修改自己密码，也没有重置密码功能

---

## 3. 需要补全的 API

### 3.1 获取单个管理员
```
GET /api/v1/admin/admins/:id
权限: super_admin
响应: { success: true, data: Admin }
```

### 3.2 更新管理员
```
PUT /api/v1/admin/admins/:id
权限: super_admin
请求: { name?, email?, role?, status? }
响应: { success: true, data: Admin }
注意: 不允许修改自己的角色；不允许降级最后一个 super_admin
```

### 3.3 删除管理员（软删除）
```
DELETE /api/v1/admin/admins/:id
权限: super_admin
响应: { success: true }
注意: 不允许删除自己；不允许删除最后一个 super_admin
```

### 3.4 切换状态
```
POST /api/v1/admin/admins/:id/status
权限: super_admin
请求: { status: "active" | "suspended" }
响应: { success: true }
注意: 不允许停用自己；不允许停用最后一个活跃的 super_admin
```

### 3.5 重置密码
```
POST /api/v1/admin/admins/:id/reset-password
权限: super_admin
请求: { password: string }  // 至少 8 位
响应: { success: true }
```

### 3.6 管理员修改自己密码
```
PUT /api/v1/admin/auth/password
权限: 已登录管理员
请求: { old_password: string, new_password: string }
响应: { success: true }
```

---

## 4. 实施计划

### Phase 1: 后端补全（5 个端点）

**文件变更：**
- `backend/internal/auth/store/admin_store.go` — 新增 Delete 方法
- `backend/internal/admin/handler/admin_handler.go` — 新增 GetAdmin, UpdateAdmin, DeleteAdmin, ToggleAdminStatus, ResetAdminPassword
- `backend/internal/auth/handler/admin_auth_handler.go` — 新增 ChangePassword
- `backend/internal/router/router.go` — 新增 5 条路由

### Phase 2: 前端对接

**文件变更：**
- `web/src/services/adminService.ts` — 新增 getAdmin, updateAdmin, deleteAdmin, toggleStatus, resetPassword, changePassword
- `web/src/pages/Admin/AdminList/AdminList.tsx` — 将本地操作替换为真实 API 调用
- `web/src/components/Admin/AdminForm/AdminForm.tsx` — 对齐角色定义（去掉 operator/viewer 或后端支持）

---

## 5. 验收标准

- [ ] 管理员列表正确显示，支持分页
- [ ] 可以创建新管理员，密码不再硬编码
- [ ] 可以编辑管理员姓名、邮箱、角色
- [ ] 可以停用/启用管理员，被停用的管理员无法登录
- [ ] 可以软删除管理员，不允许删除自己或最后一个 super_admin
- [ ] super_admin 可以重置其他管理员密码
- [ ] 管理员可以修改自己的密码（需验证旧密码）
