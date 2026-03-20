package handler

import (
	"time"

	"enjoysa-backend/internal/auth"
	authmodel "enjoysa-backend/internal/auth/model"
	"enjoysa-backend/internal/auth/store"
	"enjoysa-backend/internal/core/cache"
	rbacmodel "enjoysa-backend/internal/rbac/model"
	rbacstore "enjoysa-backend/internal/rbac/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminAuthHandler struct {
	adminStore     *store.AdminStore
	jwtService     *auth.JWTService
	db             *gorm.DB
	adminRoleStore *rbacstore.AdminRoleStore
	roleMenuStore  *rbacstore.RoleMenuStore
}

func NewAdminAuthHandler(adminStore *store.AdminStore, jwtService *auth.JWTService, db *gorm.DB) *AdminAuthHandler {
	return &AdminAuthHandler{
		adminStore:     adminStore,
		jwtService:     jwtService,
		db:             db,
		adminRoleStore: rbacstore.NewAdminRoleStore(db),
		roleMenuStore:  rbacstore.NewRoleMenuStore(db),
	}
}

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *AdminAuthHandler) Login(c *gin.Context) {
	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	admin, err := h.adminStore.GetByEmail(req.Email)
	if err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	if admin.Status != "active" {
		response.Forbidden(c, "Account suspended")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password)); err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	now := time.Now()
	admin.LastLoginAt = &now

	tokenPair, err := h.jwtService.GenerateTokenPair(admin.ID, "admin")
	if err != nil {
		response.ServerError(c, "Failed to generate token")
		return
	}

	response.Success(c, gin.H{
		"admin": admin,
		"token": tokenPair,
	})
}

func (h *AdminAuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	tokenPair, err := h.jwtService.RefreshToken(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "Invalid refresh token")
		return
	}

	response.Success(c, gin.H{"token": tokenPair})
}

func (h *AdminAuthHandler) GetProfile(c *gin.Context) {
	admin, exists := c.Get("admin")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	adminObj := admin.(*authmodel.Admin)

	// Get roles from RBAC
	roles, _ := h.adminRoleStore.GetRolesByAdminID(adminObj.ID)
	isSuperAdmin := false
	roleInfos := make([]gin.H, 0, len(roles))
	for _, r := range roles {
		roleInfos = append(roleInfos, gin.H{
			"id":   r.ID,
			"code": r.Code,
			"name": r.Name,
		})
		if r.Code == "super_admin" {
			isSuperAdmin = true
		}
	}

	// Try Redis cache for permissions
	var permissions []string
	if cached := cache.GetPermissions(adminObj.ID); cached != nil {
		permissions = cached
	}

	// Collect permissions from role menus (if not cached)
	var menuTree []rbacmodel.SysMenu

	if isSuperAdmin {
		var allMenus []rbacmodel.SysMenu
		h.db.Order("sort_order ASC, id ASC").Find(&allMenus)
		if permissions == nil {
			permSet := make(map[string]bool)
			for _, m := range allMenus {
				if m.Authority != "" {
					permSet[m.Authority] = true
				}
			}
			permissions = make([]string, 0, len(permSet))
			for p := range permSet {
				permissions = append(permissions, p)
			}
			cache.SetPermissions(adminObj.ID, permissions)
		}
		menuTree = rbacstore.BuildTree(allMenus)
	} else {
		menuMap := make(map[uint]rbacmodel.SysMenu)
		for _, r := range roles {
			menus, _ := h.roleMenuStore.GetMenusByRoleID(r.ID)
			for _, m := range menus {
				menuMap[m.ID] = m
			}
		}
		if permissions == nil {
			permSet := make(map[string]bool)
			for _, m := range menuMap {
				if m.Authority != "" {
					permSet[m.Authority] = true
				}
			}
			permissions = make([]string, 0, len(permSet))
			for p := range permSet {
				permissions = append(permissions, p)
			}
			cache.SetPermissions(adminObj.ID, permissions)
		}
		menuList := make([]rbacmodel.SysMenu, 0, len(menuMap))
		for _, m := range menuMap {
			menuList = append(menuList, m)
		}
		menuTree = rbacstore.BuildTree(menuList)
	}

	response.Success(c, gin.H{
		"id":          adminObj.ID,
		"email":       adminObj.Email,
		"name":        adminObj.Name,
		"status":      adminObj.Status,
		"roles":       roleInfos,
		"permissions": permissions,
		"menus":       menuTree,
	})
}

type AdminChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func (h *AdminAuthHandler) ChangePassword(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uint)

	var req AdminChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Old password and new password (min 8 chars) are required")
		return
	}

	admin, err := h.adminStore.GetByID(adminID)
	if err != nil {
		response.NotFound(c, "Admin not found")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.OldPassword)); err != nil {
		response.BadRequest(c, "Old password is incorrect")
		return
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	admin.Password = string(hashedPwd)

	if err := h.adminStore.Update(admin); err != nil {
		response.ServerError(c, "Failed to change password")
		return
	}

	response.SuccessMessage(c, "Password changed successfully")
}
