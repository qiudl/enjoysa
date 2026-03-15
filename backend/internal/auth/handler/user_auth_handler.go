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

type UserAuthHandler struct {
	userStore  *store.UserStore
	jwtService *auth.JWTService
}

func NewUserAuthHandler(userStore *store.UserStore, jwtService *auth.JWTService) *UserAuthHandler {
	return &UserAuthHandler{
		userStore:  userStore,
		jwtService: jwtService,
	}
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

func (h *UserAuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Check if email exists
	if _, err := h.userStore.GetByEmail(req.Email); err == nil {
		response.BadRequest(c, "Email already registered")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "Failed to hash password")
		return
	}

	user := &models.User{
		Email:    req.Email,
		Password: string(hashedPassword),
		Name:     req.Name,
		Status:   "active",
	}

	if err := h.userStore.Create(user); err != nil {
		response.ServerError(c, "Failed to create user")
		return
	}

	tokenPair, err := h.jwtService.GenerateTokenPair(user.ID, "user")
	if err != nil {
		response.ServerError(c, "Failed to generate token")
		return
	}

	response.Created(c, gin.H{
		"user":  user,
		"token": tokenPair,
	})
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *UserAuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := h.userStore.GetByEmail(req.Email)
	if err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	if user.Status != "active" {
		response.Forbidden(c, "Account suspended")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	// Update last login
	now := time.Now()
	user.LastLoginAt = &now
	user.LastLoginIP = c.ClientIP()
	_ = h.userStore.Update(user)

	tokenPair, err := h.jwtService.GenerateTokenPair(user.ID, "user")
	if err != nil {
		response.ServerError(c, "Failed to generate token")
		return
	}

	response.Success(c, gin.H{
		"user":  user,
		"token": tokenPair,
	})
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *UserAuthHandler) RefreshToken(c *gin.Context) {
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

type GoogleLoginRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

func (h *UserAuthHandler) GoogleLogin(c *gin.Context) {
	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	// TODO: Verify Google ID token with Google API
	// For now, return not implemented
	response.BadRequest(c, "Google login not yet configured")
}

func (h *UserAuthHandler) GetProfile(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	response.Success(c, user)
}

type UpdateProfileRequest struct {
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Avatar   string `json:"avatar"`
	Language string `json:"language"`
}

func (h *UserAuthHandler) UpdateProfile(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	u := user.(*models.User)
	if req.Name != "" {
		u.Name = req.Name
	}
	if req.Phone != "" {
		u.Phone = req.Phone
	}
	if req.Avatar != "" {
		u.Avatar = req.Avatar
	}
	if req.Language != "" {
		u.Language = req.Language
	}

	if err := h.userStore.Update(u); err != nil {
		response.ServerError(c, "Failed to update profile")
		return
	}

	response.Success(c, u)
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func (h *UserAuthHandler) ChangePassword(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	u := user.(*models.User)

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.OldPassword)); err != nil {
		response.BadRequest(c, "Current password is incorrect")
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.NewPassword)) == nil {
		response.BadRequest(c, "New password must be different from current password")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "Failed to hash password")
		return
	}

	u.Password = string(hashedPassword)
	if err := h.userStore.Update(u); err != nil {
		response.ServerError(c, "Failed to update password")
		return
	}

	response.SuccessMessage(c, "Password changed successfully")
}
