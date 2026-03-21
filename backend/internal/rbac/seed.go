package rbac

import (
	"strconv"

	authmodel "enjoysa-backend/internal/auth/model"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/rbac/model"

	"github.com/casbin/casbin/v2"
	"gorm.io/gorm"
)

// SeedRBAC creates default roles, menus, role-menu assignments, admin-role mappings, and Casbin policies.
func SeedRBAC(db *gorm.DB, enforcer *casbin.SyncedEnforcer) {
	seedRoles(db)
	seedMenus(db)
	seedRoleMenus(db)
	seedAdminRoles(db)
	seedCasbinPolicies(db, enforcer)
}

func seedRoles(db *gorm.DB) {
	var count int64
	db.Model(&model.SysRole{}).Count(&count)
	if count > 0 {
		return
	}

	roles := []model.SysRole{
		{Name: "Super Admin", Code: "super_admin", Note: "Full system access", SortOrder: 1, Status: 1, IsSystem: true},
		{Name: "Admin", Code: "admin", Note: "Admin without admin/settings management", SortOrder: 2, Status: 1, IsSystem: true},
		{Name: "Operator", Code: "operator", Note: "Product review, order management, user viewing", SortOrder: 3, Status: 1, IsSystem: true},
		{Name: "Viewer", Code: "viewer", Note: "Read-only access", SortOrder: 4, Status: 1, IsSystem: true},
	}

	for i := range roles {
		db.Create(&roles[i])
	}
	logger.Infof("Seeded %d RBAC roles", len(roles))
}

type menuDef struct {
	parentKey string
	name      string
	title     string
	titleZh   string
	icon      string
	path      string
	authority string
	menuType  int
	method    string
	apiPath   string
	sort      int
}

func seedMenus(db *gorm.DB) {
	var count int64
	db.Model(&model.SysMenu{}).Count(&count)
	if count > 0 {
		return
	}

	defs := []menuDef{
		// Dashboard
		{"", "Dashboard", "Dashboard", "仪表盘", "layout-dashboard", "", "", 0, "", "", 10},
		{"Dashboard", "DashboardView", "Dashboard Overview", "仪表盘概览", "", "/admin/dashboard", "dashboard.view", 1, "", "", 11},

		// Suppliers
		{"", "Suppliers", "Supplier Management", "供应商管理", "building-2", "", "", 0, "", "", 20},
		{"Suppliers", "SupplierList", "Supplier List", "供应商列表", "", "/admin/suppliers", "suppliers.view", 1, "", "", 21},
		{"Suppliers", "SupplierApprove", "Approve Supplier", "审批供应商", "", "", "suppliers.manage", 2, "POST", "/admin/suppliers/:id/approve", 22},
		{"Suppliers", "SupplierReject", "Reject Supplier", "拒绝供应商", "", "", "suppliers.manage", 2, "POST", "/admin/suppliers/:id/reject", 23},
		{"Suppliers", "SupplierSuspend", "Suspend Supplier", "停用供应商", "", "", "suppliers.manage", 2, "POST", "/admin/suppliers/:id/suspend", 24},

		// Products
		{"", "Products", "Product Management", "产品管理", "package", "", "", 0, "", "", 30},
		{"Products", "ProductList", "Product List", "产品列表", "", "/admin/products", "products.view", 1, "", "", 31},
		{"Products", "ProductApprove", "Approve Product", "审核产品", "", "", "products.review", 2, "POST", "/admin/products/:id/approve", 32},
		{"Products", "ProductReject", "Reject Product", "拒绝产品", "", "", "products.review", 2, "POST", "/admin/products/:id/reject", 33},
		{"Products", "ProductCreate", "Create Product", "创建产品", "", "", "products.manage", 2, "POST", "/admin/products", 34},
		{"Products", "ProductEdit", "Edit Product", "编辑产品", "", "", "products.manage", 2, "PUT", "/admin/products/:id", 35},
		{"Products", "ProductDelete", "Delete Product", "删除产品", "", "", "products.manage", 2, "DELETE", "/admin/products/:id", 36},

		// Orders
		{"", "Orders", "Order Management", "订单管理", "shopping-cart", "", "", 0, "", "", 40},
		{"Orders", "OrderList", "Order List", "订单列表", "", "/admin/orders", "orders.view", 1, "", "", 41},
		{"Orders", "OrderManage", "Process Order", "处理订单", "", "", "orders.manage", 2, "POST", "/admin/orders/:id/process", 42},

		// Users
		{"", "Users", "User Management", "用户管理", "users", "", "", 0, "", "", 50},
		{"Users", "UserList", "User List", "用户列表", "", "/admin/users", "users.view", 1, "", "", 51},
		{"Users", "UserCreate", "Create User", "创建用户", "", "", "users.manage", 2, "POST", "/admin/users", 52},
		{"Users", "UserEdit", "Edit User", "编辑用户", "", "", "users.manage", 2, "PUT", "/admin/users/:id", 53},
		{"Users", "UserDelete", "Delete User", "删除用户", "", "", "users.manage", 2, "DELETE", "/admin/users/:id", 54},
		{"Users", "UserStatus", "Toggle User Status", "封禁/解封用户", "", "", "users.manage", 2, "POST", "/admin/users/:id/status", 55},

		// Finance
		{"", "Finance", "Finance Management", "财务管理", "credit-card", "", "", 0, "", "", 60},
		{"Finance", "SettlementList", "Settlement List", "结算列表", "", "/admin/settlements", "finance.view", 1, "", "", 61},
		{"Finance", "SettlementProcess", "Process Settlement", "处理结算", "", "", "finance.manage", 2, "POST", "/admin/settlements/:id/process", 62},

		// Admins (System)
		{"", "Admins", "System Management", "系统管理", "settings", "", "", 0, "", "", 70},
		{"Admins", "AdminList", "Admin List", "管理员列表", "", "/admin/admins", "admins.view", 1, "", "", 71},
		{"Admins", "AdminCreate", "Create Admin", "创建管理员", "", "", "admins.manage", 2, "POST", "/admin/admins", 72},
		{"Admins", "AdminEdit", "Edit Admin", "编辑管理员", "", "", "admins.manage", 2, "PUT", "/admin/admins/:id", 73},
		{"Admins", "AdminDelete", "Delete Admin", "删除管理员", "", "", "admins.manage", 2, "DELETE", "/admin/admins/:id", 74},
		{"Admins", "RoleManage", "Role Management", "角色管理", "", "/admin/admins", "admins.view", 1, "", "", 75},
		{"Admins", "RoleEdit", "Edit Role", "角色编辑", "", "", "admins.manage", 2, "", "", 76},

		// Settings
		{"", "Settings", "System Settings", "系统设置", "sliders-horizontal", "", "", 0, "", "", 80},
		{"Settings", "SettingsView", "Settings Page", "设置页面", "", "/admin/settings", "settings.view", 1, "", "", 81},
		{"Settings", "SettingsManage", "Modify Settings", "修改设置", "", "", "settings.manage", 2, "PUT", "/admin/settings/:group", 82},

		// Contacts
		{"", "Contacts", "Contact Messages", "联系消息", "mail", "", "", 0, "", "", 90},
		{"Contacts", "ContactList", "Message List", "消息列表", "", "/admin/contacts", "contacts.view", 1, "", "", 91},
		{"Contacts", "ContactRead", "Mark Read", "标记已读", "", "", "contacts.manage", 2, "POST", "/admin/contacts/:id/read", 92},
	}

	// First pass: create all menus with parentID=0
	nameToID := make(map[string]uint)
	for _, d := range defs {
		menu := model.SysMenu{
			ParentID:  0,
			Name:      d.name,
			Title:     d.title,
			TitleZh:   d.titleZh,
			Icon:      d.icon,
			Path:      d.path,
			Authority: d.authority,
			MenuType:  d.menuType,
			Method:    d.method,
			ApiPath:   d.apiPath,
			SortOrder: d.sort,
			Status:    1,
		}
		db.Create(&menu)
		nameToID[d.name] = menu.ID
	}

	// Second pass: set parent IDs
	for _, d := range defs {
		if d.parentKey != "" {
			if parentID, ok := nameToID[d.parentKey]; ok {
				db.Model(&model.SysMenu{}).Where("id = ?", nameToID[d.name]).Update("parent_id", parentID)
			}
		}
	}

	logger.Infof("Seeded %d RBAC menus", len(defs))
}

// seedRoleMenus creates role-menu assignments based on the permission matrix.
func seedRoleMenus(db *gorm.DB) {
	var count int64
	db.Model(&model.SysRoleMenu{}).Count(&count)
	if count > 0 {
		return
	}

	// Get role IDs
	var roles []model.SysRole
	db.Find(&roles)
	roleMap := make(map[string]uint)
	for _, r := range roles {
		roleMap[r.Code] = r.ID
	}

	// Permission matrix: authority -> which roles have access
	matrix := map[string][]string{
		"dashboard.view":   {"admin", "operator", "viewer"},
		"suppliers.view":   {"admin", "operator", "viewer"},
		"suppliers.manage": {"admin"},
		"products.view":    {"admin", "operator", "viewer"},
		"products.review":  {"admin", "operator"},
		"products.manage":  {"admin"},
		"orders.view":      {"admin", "operator", "viewer"},
		"orders.manage":    {"admin", "operator"},
		"users.view":       {"admin", "operator", "viewer"},
		"users.manage":     {"admin"},
		"finance.view":     {"admin", "viewer"},
		"finance.manage":   {"admin"},
		"admins.view":      {"admin"},
		"admins.manage":    {},
		"settings.view":    {"admin", "viewer"},
		"settings.manage":  {},
		"contacts.view":    {"admin", "operator", "viewer"},
		"contacts.manage":  {"admin", "operator"},
	}

	// Get all menus
	var allMenus []model.SysMenu
	db.Find(&allMenus)

	// Assign menus to roles based on authority
	assigned := make(map[string]map[uint]bool)
	for authority, roleCodes := range matrix {
		for _, roleCode := range roleCodes {
			roleID, ok := roleMap[roleCode]
			if !ok {
				continue
			}
			if assigned[roleCode] == nil {
				assigned[roleCode] = make(map[uint]bool)
			}
			for _, menu := range allMenus {
				if menu.Authority == authority {
					if !assigned[roleCode][menu.ID] {
						db.Create(&model.SysRoleMenu{RoleID: roleID, MenuID: menu.ID})
						assigned[roleCode][menu.ID] = true
					}
				}
			}
		}
	}

	// Assign directory menus to roles that have at least one child
	for _, menu := range allMenus {
		if menu.MenuType == 0 {
			for roleCode, roleID := range roleMap {
				if roleCode == "super_admin" {
					continue
				}
				if assigned[roleCode] == nil {
					continue
				}
				hasChild := false
				for _, child := range allMenus {
					if child.ParentID == menu.ID && assigned[roleCode][child.ID] {
						hasChild = true
						break
					}
				}
				if hasChild && !assigned[roleCode][menu.ID] {
					db.Create(&model.SysRoleMenu{RoleID: roleID, MenuID: menu.ID})
					assigned[roleCode][menu.ID] = true
				}
			}
		}
	}

	logger.Info("Seeded RBAC role-menu assignments")
}

// seedAdminRoles creates admin_roles mappings for existing admins based on their Role field.
func seedAdminRoles(db *gorm.DB) {
	var count int64
	db.Model(&model.AdminRole{}).Count(&count)
	if count > 0 {
		return
	}

	var admins []authmodel.Admin
	db.Find(&admins)

	var roles []model.SysRole
	db.Find(&roles)
	roleMap := make(map[string]uint)
	for _, r := range roles {
		roleMap[r.Code] = r.ID
	}

	for _, admin := range admins {
		roleID, ok := roleMap[admin.Role]
		if !ok {
			roleID = roleMap["admin"]
		}
		if roleID > 0 {
			db.Create(&model.AdminRole{AdminID: admin.ID, RoleID: roleID})
		}
	}
	logger.Infof("Seeded admin-role mappings for %d admins", len(admins))
}

// seedCasbinPolicies creates initial Casbin policies from role-menu assignments.
func seedCasbinPolicies(db *gorm.DB, enforcer *casbin.SyncedEnforcer) {
	policies, _ := enforcer.GetPolicy()
	if len(policies) > 0 {
		return
	}

	var roles []model.SysRole
	db.Where("code != ?", "super_admin").Find(&roles)

	for _, role := range roles {
		var menuIDs []uint
		db.Model(&model.SysRoleMenu{}).Where("role_id = ?", role.ID).Pluck("menu_id", &menuIDs)
		if len(menuIDs) == 0 {
			continue
		}

		var menus []model.SysMenu
		db.Where("id IN ?", menuIDs).Find(&menus)

		for _, menu := range menus {
			switch menu.MenuType {
			case 1: // page
				if menu.Path != "" {
					enforcer.AddPolicy(role.Code, menu.Path, "GET|POST|PUT|DELETE")
					enforcer.AddPolicy(role.Code, menu.Path+"/*", "GET|POST|PUT|DELETE")
				}
			case 2: // button
				if menu.ApiPath != "" && menu.Method != "" {
					enforcer.AddPolicy(role.Code, menu.ApiPath, menu.Method)
				}
			}
		}
	}

	// Add grouping policies: admin ID -> role code
	var adminRoles []model.AdminRole
	db.Find(&adminRoles)

	var allRoles []model.SysRole
	db.Find(&allRoles)
	roleIDToCode := make(map[uint]string)
	for _, r := range allRoles {
		roleIDToCode[r.ID] = r.Code
	}

	for _, ar := range adminRoles {
		if code, ok := roleIDToCode[ar.RoleID]; ok {
			enforcer.AddGroupingPolicy(
				strconv.FormatUint(uint64(ar.AdminID), 10),
				code,
			)
		}
	}

	enforcer.SavePolicy()
	logger.Info("Seeded Casbin policies")
}

// RepairPolicies ensures all page menus have both base-path and wildcard Casbin policies.
// This is idempotent and safe to run on every startup — Casbin deduplicates policies.
func RepairPolicies(db *gorm.DB, enforcer *casbin.SyncedEnforcer) {
	var roles []model.SysRole
	db.Where("code != ?", "super_admin").Find(&roles)

	changed := false
	for _, role := range roles {
		var menuIDs []uint
		db.Model(&model.SysRoleMenu{}).Where("role_id = ?", role.ID).Pluck("menu_id", &menuIDs)
		if len(menuIDs) == 0 {
			continue
		}

		var menus []model.SysMenu
		db.Where("id IN ?", menuIDs).Find(&menus)

		for _, menu := range menus {
			if menu.MenuType == 1 && menu.Path != "" {
				// Ensure base-path policy exists (fixes list endpoints like GET /admin/orders)
				added, _ := enforcer.AddPolicy(role.Code, menu.Path, "GET|POST|PUT|DELETE")
				if added {
					changed = true
				}
				added, _ = enforcer.AddPolicy(role.Code, menu.Path+"/*", "GET|POST|PUT|DELETE")
				if added {
					changed = true
				}
			}
		}
	}

	if changed {
		enforcer.SavePolicy()
		logger.Info("Repaired RBAC Casbin policies (added missing base-path rules)")
	}
}
