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
