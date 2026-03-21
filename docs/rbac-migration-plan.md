# Tuangou RBAC 移植到 EnjoySA — 详细开发计划

> 需求编号: REQ-20260319-0004
> 关联分析: REQ-20260319-0002

---

## 一、架构适配设计

### 1.1 Tuangou → EnjoySA 差异映射

| 维度 | Tuangou | EnjoySA 适配 |
|------|---------|-------------|
| 数据库 | MySQL | PostgreSQL（改 GORM tag） |
| ORM | GORM + soft_delete plugin | GORM（已有，用内置 `gorm.DeletedAt`）|
| 主键类型 | `int64` | `uint`（与现有 Admin 模型一致）|
| 多租户 | `tenant_id` 在所有表 | **去掉**，单平台无需隔离 |
| 部门体系 | `dept_id` 在 user_role | **去掉**，无组织架构需求 |
| 用户模型 | 统一 `sys_user` | 保持 `admins` 表，新增 `admin_roles` 关联表 |
| Base Model | `core.Model`（含 tenant_id/mark） | 用 EnjoySA 现有模式（`gorm.Model` 风格）|
| Casbin Model | `r=sub,dom,obj,act`（含 domain） | 简化为 `r=sub,obj,act`（无 domain 维度）|
| 菜单树 | `tenant_type` 区分平台/经销商/生产商 | **去掉**，单一管理端 |

### 1.2 简化后的 Casbin Model

```
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatch2(r.obj, p.obj) && regexMatch(r.act, p.act) || r.sub == "super_admin"
```

**说明**:
- 去掉 `dom`(domain) 维度，无多租户
- `g = _, _`：用户→角色映射（无 domain）
- `keyMatch2`：支持 `/admin/users/:id` 路径匹配
- `super_admin` 角色自动放行（matcher 中硬编码）

---

## 二、Phase 1：后端 RBAC 数据模型 + Casbin + API

### 2.1 新建数据模型（4 张表）

#### `sys_roles` 表

```go
// backend/internal/rbac/model/role.go
type SysRole struct {
    ID        uint           `gorm:"primaryKey" json:"id"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

    Name       string `gorm:"size:64;not null;uniqueIndex" json:"name"`
    Code       string `gorm:"size:64;not null;uniqueIndex" json:"code"`
    Note       string `gorm:"size:255" json:"note"`
    SortOrder  int    `gorm:"default:100" json:"sort_order"`
    Status     int    `gorm:"default:1;comment:0=禁用 1=启用" json:"status"`
    IsSystem   bool   `gorm:"default:false;comment:系统内置角色不可删除" json:"is_system"`
}
```

与 Tuangou 差异: 去掉 `tenant_id`/`created_user_id`/`mark`，用 GORM 标准模式。新增 `is_system` 标记预置角色。

#### `sys_menus` 表

```go
// backend/internal/rbac/model/menu.go
type SysMenu struct {
    ID        uint           `gorm:"primaryKey" json:"id"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

    ParentID   uint   `gorm:"default:0;index" json:"parent_id"`
    Name       string `gorm:"size:64;not null" json:"name"`        // 英文标识 (e.g. "UserManage")
    Title      string `gorm:"size:128;not null" json:"title"`      // 显示标题 (en)
    TitleZh    string `gorm:"size:128" json:"title_zh"`            // 中文标题
    Icon       string `gorm:"size:64" json:"icon"`                 // Lucide icon name
    Path       string `gorm:"size:128" json:"path"`                // 前端路由 path
    Authority  string `gorm:"size:128" json:"authority"`           // 权限标识 (e.g. "users.manage")
    MenuType   int    `gorm:"default:0;comment:0=目录 1=菜单 2=按钮" json:"menu_type"`
    Method     string `gorm:"size:64" json:"method"`               // HTTP method (按钮级: GET|POST|PUT|DELETE)
    ApiPath    string `gorm:"size:255" json:"api_path"`            // 后端 API path (按钮级)
    SortOrder  int    `gorm:"default:100" json:"sort_order"`
    Status     int    `gorm:"default:1" json:"status"`
    Hidden     bool   `gorm:"default:false" json:"hidden"`
}
```

与 Tuangou 差异: 去掉 `tenant_type`/`component`/`target`/`redirect`/`keep_alive`/`locale`/`parent_keys`。新增 `TitleZh`（双语）、`ApiPath`+`Method`（直接绑 API，比 authority 更明确）。

#### `sys_role_menus` 表

```go
// backend/internal/rbac/model/role_menu.go
type SysRoleMenu struct {
    RoleID uint `gorm:"primaryKey;autoIncrement:false" json:"role_id"`
    MenuID uint `gorm:"primaryKey;autoIncrement:false" json:"menu_id"`
}
```

与 Tuangou 一致（联合主键，无审计字段）。

#### `admin_roles` 表（替代 admin.Role 字段）

```go
// backend/internal/rbac/model/admin_role.go
type AdminRole struct {
    AdminID uint `gorm:"primaryKey;autoIncrement:false" json:"admin_id"`
    RoleID  uint `gorm:"primaryKey;autoIncrement:false" json:"role_id"`
}
```

与 Tuangou `sys_user_role` 差异: 去掉 `dept_id`，简化为纯 admin-role 映射。

### 2.2 新增 Go 依赖

```bash
cd backend
go get github.com/casbin/casbin/v2@latest
go get github.com/casbin/gorm-adapter/v3@latest
```

### 2.3 Casbin 初始化

```go
// backend/internal/rbac/casbin.go
// 参考: tuangou/pkg/auth/authz.go

func NewCasbinEnforcer(db *gorm.DB) (*casbin.SyncedEnforcer, error) {
    adapter, _ := gormadapter.NewAdapterByDBUseTableName(db, "", "casbin_rules")
    m, _ := model.NewModelFromString(casbinModelConf)
    enforcer, _ := casbin.NewSyncedEnforcer(m, adapter)
    enforcer.LoadPolicy()
    return enforcer, nil
}
```

### 2.4 RequirePermission 中间件

```go
// backend/internal/core/middleware/permission.go
// 参考: tuangou/internal/core/middleware/permission.go

func RequirePermission(enforcer *casbin.SyncedEnforcer) gin.HandlerFunc {
    return func(c *gin.Context) {
        role, _ := c.Get("admin_role_code")
        roleCode := role.(string)

        // super_admin 跳过检查
        if roleCode == "super_admin" {
            c.Next()
            return
        }

        path := extractApiPath(c.Request.URL.Path) // 去掉 /api/v1 前缀
        method := c.Request.Method

        allowed, _ := enforcer.Enforce(roleCode, path, method)
        if !allowed {
            response.Forbidden(c, "权限不足")
            c.Abort()
            return
        }
        c.Next()
    }
}
```

与 Tuangou 差异: 去掉 `dom`(domain) 参数，直接 `Enforce(sub, obj, act)`。

### 2.5 API 端点设计

#### 角色管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin/roles` | 角色列表 | admins.view |
| POST | `/admin/roles` | 创建角色 | admins.manage |
| GET | `/admin/roles/:id` | 角色详情 | admins.view |
| PUT | `/admin/roles/:id` | 更新角色 | admins.manage |
| DELETE | `/admin/roles/:id` | 删除角色 | admins.manage |
| GET | `/admin/roles/:id/menus` | 角色的菜单权限 | admins.view |
| PUT | `/admin/roles/:id/menus` | 更新角色权限 | admins.manage |

#### 菜单管理（超管专用）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin/menus` | 菜单树 | admins.view |
| POST | `/admin/menus` | 创建菜单项 | super_admin |
| PUT | `/admin/menus/:id` | 更新菜单项 | super_admin |
| DELETE | `/admin/menus/:id` | 删除菜单项 | super_admin |

#### 管理员角色分配

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin/admins/:id/roles` | 管理员的角色列表 | admins.view |
| PUT | `/admin/admins/:id/roles` | 更新管理员角色 | admins.manage |
| GET | `/admin/auth/me` | 登录时返回权限列表 | (已登录) |

### 2.6 Admin 表迁移策略

**渐进式迁移**（不删除 `admin.Role` 字段，避免破坏现有逻辑）:

1. 新增 `admin_roles` 关联表
2. AdminAuth 中间件同时读 `admin_roles` 表获取角色 code 列表
3. 保留 `admin.Role` 字段做向后兼容，后续版本再移除
4. 登录接口返回 `permissions: string[]` 到前端

### 2.7 种子数据

#### 4 个预置角色

| Code | Name | is_system | 说明 |
|------|------|-----------|------|
| `super_admin` | 超级管理员 | true | 全部权限（matcher 硬编码跳过） |
| `admin` | 管理员 | true | 除 admins.manage + settings.manage |
| `operator` | 运营 | true | 产品审核 + 订单管理 + 用户查看 |
| `viewer` | 只读 | true | 仅 *.view 权限 |

#### 菜单树（3 级：目录→页面→按钮）

```
📁 仪表盘 (dashboard)
   📄 仪表盘概览 (dashboard.view) → /admin/dashboard

📁 供应商管理 (suppliers)
   📄 供应商列表 (suppliers.view) → /admin/suppliers
   🔘 审批供应商 (suppliers.manage) → POST /admin/suppliers/:id/approve
   🔘 拒绝供应商 (suppliers.manage) → POST /admin/suppliers/:id/reject
   🔘 停用供应商 (suppliers.manage) → POST /admin/suppliers/:id/suspend

📁 产品管理 (products)
   📄 产品列表 (products.view) → /admin/products
   🔘 审核产品 (products.review) → POST /admin/products/:id/approve
   🔘 拒绝产品 (products.review) → POST /admin/products/:id/reject
   🔘 创建产品 (products.manage) → POST /admin/products
   🔘 编辑产品 (products.manage) → PUT /admin/products/:id
   🔘 删除产品 (products.manage) → DELETE /admin/products/:id

📁 订单管理 (orders)
   📄 订单列表 (orders.view) → /admin/orders
   🔘 处理订单 (orders.manage)

📁 用户管理 (users)
   📄 用户列表 (users.view) → /admin/users
   🔘 创建用户 (users.manage) → POST /admin/users
   🔘 编辑用户 (users.manage) → PUT /admin/users/:id
   🔘 删除用户 (users.manage) → DELETE /admin/users/:id
   🔘 封禁/解封 (users.manage) → POST /admin/users/:id/status

📁 财务管理 (finance)
   📄 结算列表 (finance.view) → /admin/settlements
   🔘 处理结算 (finance.manage) → POST /admin/settlements/:id/process

📁 系统管理 (admins)
   📄 管理员列表 (admins.view) → /admin/admins
   🔘 创建管理员 (admins.manage) → POST /admin/admins
   🔘 编辑管理员 (admins.manage) → PUT /admin/admins/:id
   🔘 删除管理员 (admins.manage) → DELETE /admin/admins/:id
   📄 角色管理 (admins.view) → /admin/admins (roles tab)
   🔘 角色编辑 (admins.manage)

📁 系统设置 (settings)
   📄 设置页面 (settings.view) → /admin/settings
   🔘 修改设置 (settings.manage) → PUT /admin/settings/:group

📁 联系消息 (contacts)
   📄 消息列表 (contacts.view) → /admin/contacts
   🔘 标记已读 (contacts.manage) → POST /admin/contacts/:id/read
```

#### 默认角色-菜单权限矩阵

| 权限 | super_admin | admin | operator | viewer |
|------|:-----------:|:-----:|:--------:|:------:|
| dashboard.view | ✅ | ✅ | ✅ | ✅ |
| suppliers.view | ✅ | ✅ | ✅ | ✅ |
| suppliers.manage | ✅ | ✅ | ❌ | ❌ |
| products.view | ✅ | ✅ | ✅ | ✅ |
| products.review | ✅ | ✅ | ✅ | ❌ |
| products.manage | ✅ | ✅ | ❌ | ❌ |
| orders.view | ✅ | ✅ | ✅ | ✅ |
| orders.manage | ✅ | ✅ | ✅ | ❌ |
| users.view | ✅ | ✅ | ✅ | ✅ |
| users.manage | ✅ | ✅ | ❌ | ❌ |
| finance.view | ✅ | ✅ | ❌ | ✅ |
| finance.manage | ✅ | ✅ | ❌ | ❌ |
| admins.view | ✅ | ✅ | ❌ | ❌ |
| admins.manage | ✅ | ❌ | ❌ | ❌ |
| settings.view | ✅ | ✅ | ❌ | ✅ |
| settings.manage | ✅ | ❌ | ❌ | ❌ |
| contacts.view | ✅ | ✅ | ✅ | ✅ |
| contacts.manage | ✅ | ✅ | ✅ | ❌ |

### 2.8 Phase 1 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/internal/rbac/model/role.go` | 新建 | SysRole 模型 |
| `backend/internal/rbac/model/menu.go` | 新建 | SysMenu 模型 |
| `backend/internal/rbac/model/role_menu.go` | 新建 | SysRoleMenu 模型 |
| `backend/internal/rbac/model/admin_role.go` | 新建 | AdminRole 模型 |
| `backend/internal/rbac/store/role_store.go` | 新建 | 角色 CRUD |
| `backend/internal/rbac/store/menu_store.go` | 新建 | 菜单 CRUD + 树构建 |
| `backend/internal/rbac/store/role_menu_store.go` | 新建 | 角色-菜单关联操作 |
| `backend/internal/rbac/store/admin_role_store.go` | 新建 | 管理员-角色关联操作 |
| `backend/internal/rbac/handler/role_handler.go` | 新建 | 角色 API handler |
| `backend/internal/rbac/handler/menu_handler.go` | 新建 | 菜单 API handler |
| `backend/internal/rbac/casbin.go` | 新建 | Casbin enforcer 初始化 |
| `backend/internal/rbac/seed.go` | 新建 | 种子数据 |
| `backend/internal/core/middleware/permission.go` | 新建 | RequirePermission 中间件 |
| `backend/internal/core/middleware/auth.go` | 修改 | AdminAuth 读取角色 code |
| `backend/internal/router/router.go` | 修改 | 注册 RBAC 路由 + RequirePermission |
| `backend/internal/auth/handler/admin_auth.go` | 修改 | /me 返回 permissions |
| `backend/cmd/server/main.go` | 修改 | AutoMigrate + seed |
| `backend/go.mod` | 修改 | casbin + gorm-adapter |

---

## 三、Phase 2：前端权限对接

### 3.1 adminService.ts 新增 API

```typescript
// 角色管理
listRoles(): Promise<SysRole[]>
getRole(id: number): Promise<SysRole>
createRole(data: CreateRoleReq): Promise<{ id: number }>
updateRole(id: number, data: UpdateRoleReq): Promise<void>
deleteRole(id: number): Promise<void>
getRoleMenus(roleId: number): Promise<RoleMenuItem[]>
updateRoleMenus(roleId: number, menuIds: number[]): Promise<void>

// 菜单管理
listMenus(): Promise<SysMenu[]>

// 管理员角色
getAdminRoles(adminId: number): Promise<SysRole[]>
updateAdminRoles(adminId: number, roleIds: number[]): Promise<void>
```

### 3.2 AdminAuthContext 改造

```typescript
// 登录后 /me 接口返回:
interface AdminInfo {
  id: number;
  name: string;
  email: string;
  roles: { id: number; code: string; name: string }[];
  permissions: string[];  // ["dashboard.view", "users.manage", ...]
  menus: MenuTree[];      // 菜单树用于渲染侧边栏
}

// hasPermission 改为真实检查:
const hasPermission = (permission: string): boolean => {
  if (!admin) return false;
  if (admin.roles.some(r => r.code === 'super_admin')) return true;
  return admin.permissions.includes(permission);
};
```

### 3.3 组件改造清单

| 文件 | 改动 |
|------|------|
| `AdminAuthContext.tsx` | hasPermission 对接真实 permissions 数组 |
| `RolePermissions.tsx` | onSave → 调用 updateRoleMenus API |
| `AdminForm.tsx` | 角色下拉 → listRoles() 动态获取 |
| `AdminSidebar` (或 Layout) | 菜单项根据 menus 动态渲染 |
| `AdminList.tsx` | 管理员列表显示角色名称 |
| 各管理页面 | 操作按钮用 hasPermission 控制显示 |

### 3.4 i18n 新增 key

```json
{
  "admin.roles.title": "角色管理 / Role Management",
  "admin.roles.create": "创建角色 / Create Role",
  "admin.roles.edit": "编辑角色 / Edit Role",
  "admin.roles.delete": "删除角色 / Delete Role",
  "admin.roles.deleteConfirm": "确定删除角色 {{name}}？",
  "admin.roles.systemRole": "系统内置角色 / System Role",
  "admin.roles.permissions": "权限配置 / Permissions",
  "admin.roles.assignPermissions": "分配权限 / Assign Permissions",
  "admin.roles.noPermission": "您没有权限执行此操作 / Insufficient permissions"
}
```

---

## 四、Phase 3：审计日志 + Redis + Swagger（后续迭代）

### 4.1 审计日志

参考 `tuangou/internal/core/core/core_syslog.go`:

```go
type AuditLog struct {
    ID         uint      `gorm:"primaryKey"`
    AdminID    uint      `json:"admin_id"`
    AdminName  string    `json:"admin_name"`
    Action     string    `json:"action"`      // create/update/delete
    Resource   string    `json:"resource"`     // users/products/roles...
    ResourceID uint      `json:"resource_id"`
    Detail     string    `gorm:"type:text" json:"detail"` // JSON diff
    IP         string    `json:"ip"`
    CreatedAt  time.Time `json:"created_at"`
}
```

### 4.2 Redis 缓存

- 权限数据缓存：`rbac:admin:{id}:permissions` → TTL 5min
- 登录时写入，角色变更时失效
- 参考 `tuangou/internal/core/core/cache.go`

### 4.3 Swagger

```bash
go install github.com/swaggo/swag/cmd/swag@latest
# handler 函数加注释 → swag init 生成文档
```

---

## 五、Casbin 策略生成流程（核心移植逻辑）

参考 `tuangou/internal/sys/biz/sys_role.go::UpdateRoleMenu()`，简化后流程：

```
管理员修改角色权限
  ↓
PUT /admin/roles/:id/menus { menu_ids: [1,2,3...] }
  ↓
1. 事务开始
2. 删除 sys_role_menus WHERE role_id = ?
3. 批量插入新的 sys_role_menus
4. 查询所选菜单中 menu_type=1(页面) 和 menu_type=2(按钮) 的记录
5. 清除该角色旧的 Casbin 策略: RemoveFilteredPolicy(0, role_code)
6. 遍历菜单:
   - 页面(type=1): AddPolicy(role_code, path+"/*", "GET|POST|PUT|DELETE")
   - 按钮(type=2): AddPolicy(role_code, api_path, method)
7. 事务提交
8. 返回成功
```

与 Tuangou 差异:
- 去掉 domain/tenant_id 参数
- 直接用 `api_path` + `method` 字段，不走 `authority` + `parentPath/*` 拼接
- 更简洁直观

---

## 六、风险与注意事项

1. **向后兼容**: Admin.Role 字段暂时保留，AdminAuth 中间件同时读取新旧两套角色数据
2. **数据迁移**: 现有 admin 记录需在 seed 中自动创建 admin_roles 关联（根据现有 Role 字段）
3. **前端降级**: Phase 1 完成但 Phase 2 未开始时，前端仍用 stub hasPermission，不影响使用
4. **Casbin 性能**: SyncedEnforcer 自动加载策略，小规模场景无需 Redis 缓存
5. **系统角色保护**: is_system=true 的角色不可删除，super_admin 的权限不可修改
6. **菜单树初始化**: seed 数据与 router.go 中已注册的路由保持一致，每次新增路由需同步更新菜单
