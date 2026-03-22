package handler

import (
	"time"

	"enjoysa-backend/internal/auth"
	"enjoysa-backend/internal/auth/store"
	"enjoysa-backend/internal/models"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type SupplierAuthHandler struct {
	supplierUserStore *store.SupplierUserStore
	jwtService        *auth.JWTService
}

func NewSupplierAuthHandler(supplierUserStore *store.SupplierUserStore, jwtService *auth.JWTService) *SupplierAuthHandler {
	return &SupplierAuthHandler{
		supplierUserStore: supplierUserStore,
		jwtService:        jwtService,
	}
}

type SupplierLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *SupplierAuthHandler) Login(c *gin.Context) {
	var req SupplierLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	su, err := h.supplierUserStore.GetByEmail(req.Email)
	if err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	if su.Status != "active" {
		response.Forbidden(c, "Account suspended")
		return
	}

	// Block suspended/rejected suppliers; allow pending to login with limited access
	if su.Supplier != nil && (su.Supplier.Status == "suspended" || su.Supplier.Status == "rejected") {
		response.Forbidden(c, "Supplier account is "+su.Supplier.Status)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(su.Password), []byte(req.Password)); err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	now := time.Now()
	su.LastLoginAt = &now
	_ = h.supplierUserStore.Update(su)

	tokenPair, err := h.jwtService.GenerateTokenPair(su.ID, "supplier")
	if err != nil {
		response.ServerError(c, "Failed to generate token")
		return
	}

	response.Success(c, gin.H{
		"supplier_user": su,
		"token":         tokenPair,
	})
}

func (h *SupplierAuthHandler) RefreshToken(c *gin.Context) {
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

func (h *SupplierAuthHandler) GetProfile(c *gin.Context) {
	su, exists := c.Get("supplier_user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	response.Success(c, su.(*models.SupplierUser))
}
