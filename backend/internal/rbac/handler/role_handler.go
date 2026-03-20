package handler

import (
	"strconv"

	"enjoysa-backend/internal/core/cache"
	"enjoysa-backend/internal/rbac/model"
	"enjoysa-backend/internal/rbac/store"
	"enjoysa-backend/pkg/response"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
)

type RoleHandler struct {
	roleStore     *store.RoleStore
	menuStore     *store.MenuStore
	roleMenuStore *store.RoleMenuStore
	enforcer      *casbin.SyncedEnforcer
}

func NewRoleHandler(rs *store.RoleStore, ms *store.MenuStore, rms *store.RoleMenuStore, e *casbin.SyncedEnforcer) *RoleHandler {
	return &RoleHandler{
		roleStore:     rs,
		menuStore:     ms,
		roleMenuStore: rms,
		enforcer:      e,
	}
}

func (h *RoleHandler) List(c *gin.Context) {
	roles, err := h.roleStore.List()
	if err != nil {
		response.ServerError(c, "Failed to list roles")
		return
	}
	response.Success(c, roles)
}

func (h *RoleHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid role ID")
		return
	}
	role, err := h.roleStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Role not found")
		return
	}
	response.Success(c, role)
}

type CreateRoleRequest struct {
	Name      string `json:"name" binding:"required"`
	Code      string `json:"code" binding:"required"`
	Note      string `json:"note"`
	SortOrder int    `json:"sort_order"`
	Status    int    `json:"status"`
}

func (h *RoleHandler) Create(c *gin.Context) {
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	role := &model.SysRole{
		Name:      req.Name,
		Code:      req.Code,
		Note:      req.Note,
		SortOrder: req.SortOrder,
		Status:    req.Status,
	}
	if role.Status == 0 {
		role.Status = 1
	}

	if err := h.roleStore.Create(role); err != nil {
		response.ServerError(c, "Failed to create role")
		return
	}
	response.Created(c, role)
}

type UpdateRoleRequest struct {
	Name      string `json:"name"`
	Note      string `json:"note"`
	SortOrder int    `json:"sort_order"`
	Status    int    `json:"status"`
}

func (h *RoleHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid role ID")
		return
	}

	role, err := h.roleStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Role not found")
		return
	}

	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.Name != "" {
		role.Name = req.Name
	}
	if req.Note != "" {
		role.Note = req.Note
	}
	if req.SortOrder != 0 {
		role.SortOrder = req.SortOrder
	}
	if req.Status != 0 {
		role.Status = req.Status
	}

	if err := h.roleStore.Update(role); err != nil {
		response.ServerError(c, "Failed to update role")
		return
	}
	response.Success(c, role)
}

func (h *RoleHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid role ID")
		return
	}

	role, err := h.roleStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Role not found")
		return
	}

	if role.IsSystem {
		response.BadRequest(c, "Cannot delete system role")
		return
	}

	if err := h.roleStore.Delete(uint(id)); err != nil {
		response.ServerError(c, "Failed to delete role")
		return
	}
	response.SuccessMessage(c, "Role deleted")
}

// GetRoleMenus returns the menu IDs assigned to a role.
func (h *RoleHandler) GetRoleMenus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid role ID")
		return
	}

	menuIDs, err := h.roleMenuStore.GetMenuIDsByRoleID(uint(id))
	if err != nil {
		response.ServerError(c, "Failed to get role menus")
		return
	}
	response.Success(c, gin.H{"menu_ids": menuIDs})
}

type UpdateRoleMenusRequest struct {
	MenuIDs []uint `json:"menu_ids" binding:"required"`
}

// UpdateRoleMenus replaces the menu assignments for a role and syncs Casbin policies.
func (h *RoleHandler) UpdateRoleMenus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid role ID")
		return
	}

	role, err := h.roleStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Role not found")
		return
	}

	if role.Code == "super_admin" {
		response.BadRequest(c, "Cannot modify super_admin permissions")
		return
	}

	var req UpdateRoleMenusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Replace role-menu associations
	if err := h.roleMenuStore.ReplaceRoleMenus(uint(id), req.MenuIDs); err != nil {
		response.ServerError(c, "Failed to update role menus")
		return
	}

	// Sync Casbin policies
	if err := h.syncCasbinPolicies(role.Code, req.MenuIDs); err != nil {
		response.ServerError(c, "Failed to sync permissions")
		return
	}

	// Invalidate all cached permissions (role change affects multiple admins)
	cache.InvalidateAllPermissions()

	response.SuccessMessage(c, "Role menus updated")
}

// syncCasbinPolicies rebuilds Casbin policies for a role based on assigned menus.
func (h *RoleHandler) syncCasbinPolicies(roleCode string, menuIDs []uint) error {
	// Remove old policies for this role
	h.enforcer.RemoveFilteredPolicy(0, roleCode)

	if len(menuIDs) == 0 {
		return h.enforcer.SavePolicy()
	}

	// Get all menus to look up paths
	allMenus, err := h.menuStore.List()
	if err != nil {
		return err
	}

	menuMap := make(map[uint]model.SysMenu)
	for _, m := range allMenus {
		menuMap[m.ID] = m
	}

	for _, mid := range menuIDs {
		menu, ok := menuMap[mid]
		if !ok {
			continue
		}
		switch menu.MenuType {
		case 1: // page menu - allow all methods on the path
			if menu.Path != "" {
				h.enforcer.AddPolicy(roleCode, menu.Path+"/*", "GET|POST|PUT|DELETE")
			}
		case 2: // button - specific API path + method
			if menu.ApiPath != "" && menu.Method != "" {
				h.enforcer.AddPolicy(roleCode, menu.ApiPath, menu.Method)
			}
		}
	}

	return h.enforcer.SavePolicy()
}
