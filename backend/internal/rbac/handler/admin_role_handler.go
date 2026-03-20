package handler

import (
	"strconv"

	"enjoysa-backend/internal/core/cache"
	"enjoysa-backend/internal/rbac/store"
	"enjoysa-backend/pkg/response"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
)

type AdminRoleHandler struct {
	adminRoleStore *store.AdminRoleStore
	roleStore      *store.RoleStore
	enforcer       *casbin.SyncedEnforcer
}

func NewAdminRoleHandler(ars *store.AdminRoleStore, rs *store.RoleStore, e *casbin.SyncedEnforcer) *AdminRoleHandler {
	return &AdminRoleHandler{
		adminRoleStore: ars,
		roleStore:      rs,
		enforcer:       e,
	}
}

// GetAdminRoles returns roles assigned to an admin.
func (h *AdminRoleHandler) GetAdminRoles(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid admin ID")
		return
	}

	roles, err := h.adminRoleStore.GetRolesByAdminID(uint(id))
	if err != nil {
		response.ServerError(c, "Failed to get admin roles")
		return
	}
	response.Success(c, roles)
}

type UpdateAdminRolesRequest struct {
	RoleIDs []uint `json:"role_ids" binding:"required"`
}

// UpdateAdminRoles replaces role assignments for an admin and updates Casbin grouping policies.
func (h *AdminRoleHandler) UpdateAdminRoles(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid admin ID")
		return
	}

	var req UpdateAdminRolesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	adminID := uint(id)

	if err := h.adminRoleStore.ReplaceAdminRoles(adminID, req.RoleIDs); err != nil {
		response.ServerError(c, "Failed to update admin roles")
		return
	}

	// Sync Casbin grouping policies: remove old g policies, add new ones
	adminSub := strconv.FormatUint(uint64(adminID), 10)
	h.enforcer.RemoveFilteredGroupingPolicy(0, adminSub)
	for _, roleID := range req.RoleIDs {
		role, err := h.roleStore.GetByID(roleID)
		if err != nil {
			continue
		}
		h.enforcer.AddGroupingPolicy(adminSub, role.Code)
	}
	h.enforcer.SavePolicy()

	// Invalidate cached permissions for this admin
	cache.InvalidatePermissions(adminID)

	response.SuccessMessage(c, "Admin roles updated")
}
