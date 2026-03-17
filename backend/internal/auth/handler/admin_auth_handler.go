package handler

import (
	"time"

	"enjoysa-backend/internal/auth"
	authmodel "enjoysa-backend/internal/auth/model"
	"enjoysa-backend/internal/auth/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AdminAuthHandler struct {
	adminStore *store.AdminStore
	jwtService *auth.JWTService
}

func NewAdminAuthHandler(adminStore *store.AdminStore, jwtService *auth.JWTService) *AdminAuthHandler {
	return &AdminAuthHandler{
		adminStore: adminStore,
		jwtService: jwtService,
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

	response.Success(c, admin.(*authmodel.Admin))
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
