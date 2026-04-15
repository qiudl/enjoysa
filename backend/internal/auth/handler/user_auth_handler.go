package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"enjoysa-backend/internal/auth"
	authmodel "enjoysa-backend/internal/auth/model"
	"enjoysa-backend/internal/auth/store"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/email"
	"enjoysa-backend/internal/models"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type UserAuthHandler struct {
	userStore          *store.UserStore
	jwtService         *auth.JWTService
	passwordResetStore *store.PasswordResetStore
	emailService       *email.ResendService
	frontendURL        string
}

func NewUserAuthHandler(
	userStore *store.UserStore,
	jwtService *auth.JWTService,
	passwordResetStore *store.PasswordResetStore,
	emailService *email.ResendService,
	frontendURL string,
) *UserAuthHandler {
	return &UserAuthHandler{
		userStore:          userStore,
		jwtService:         jwtService,
		passwordResetStore: passwordResetStore,
		emailService:       emailService,
		frontendURL:        frontendURL,
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

// googleTokenInfo represents the response from Google's tokeninfo endpoint
type googleTokenInfo struct {
	Sub           string `json:"sub"`            // Google user ID
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (h *UserAuthHandler) GoogleLogin(c *gin.Context) {
	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	// Verify Google ID token via Google's tokeninfo endpoint
	resp, err := http.Get(fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", req.IDToken))
	if err != nil {
		logger.Errorf("Failed to verify Google token: %v", err)
		response.ServerError(c, "Failed to verify Google token")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		response.Unauthorized(c, "Invalid Google token")
		return
	}

	var tokenInfo googleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		logger.Errorf("Failed to decode Google token info: %v", err)
		response.ServerError(c, "Failed to process Google token")
		return
	}

	if tokenInfo.Sub == "" || tokenInfo.Email == "" {
		response.Unauthorized(c, "Invalid Google token")
		return
	}

	// Try to find user by Google ID first
	user, err := h.userStore.GetByGoogleID(tokenInfo.Sub)
	if err != nil {
		// Not found by Google ID, try by email
		user, err = h.userStore.GetByEmail(tokenInfo.Email)
		if err != nil {
			// New user — auto register
			user = &models.User{
				Email:         tokenInfo.Email,
				Name:          tokenInfo.Name,
				Avatar:        tokenInfo.Picture,
				GoogleID:      tokenInfo.Sub,
				Status:        "active",
				EmailVerified: true,
			}
			if err := h.userStore.Create(user); err != nil {
				logger.Errorf("Failed to create Google user: %v", err)
				response.ServerError(c, "Failed to create account")
				return
			}
		} else {
			// Existing user with same email — link Google ID
			user.GoogleID = tokenInfo.Sub
			if user.Avatar == "" && tokenInfo.Picture != "" {
				user.Avatar = tokenInfo.Picture
			}
			_ = h.userStore.Update(user)
		}
	}

	if user.Status != "active" {
		response.Forbidden(c, "Account suspended")
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

// userProfileResponse wraps User with computed fields like google_bound.
func userProfileResponse(u *models.User) gin.H {
	return gin.H{
		"id":             u.ID,
		"email":          u.Email,
		"name":           u.Name,
		"phone":          u.Phone,
		"avatar":         u.Avatar,
		"status":         u.Status,
		"email_verified": u.EmailVerified,
		"phone_verified": u.PhoneVerified,
		"language":       u.Language,
		"currency":       u.Currency,
		"timezone":       u.Timezone,
		"google_bound":   u.GoogleID != "",
		"created_at":     u.CreatedAt,
		"updated_at":     u.UpdatedAt,
		"last_login_at":  u.LastLoginAt,
	}
}

func (h *UserAuthHandler) GetProfile(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	response.Success(c, userProfileResponse(user.(*models.User)))
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

	response.Success(c, userProfileResponse(u))
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

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func (h *UserAuthHandler) ForgotPassword(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := h.userStore.GetByEmail(req.Email)
	if err != nil {
		response.NotFound(c, "Email not registered")
		return
	}

	// Rate limit: max 3 requests per 15 minutes
	count, err := h.passwordResetStore.CountRecent(user.ID, 15*time.Minute)
	if err != nil {
		logger.Errorf("Failed to count recent reset tokens: %v", err)
		response.BadRequest(c, "Too many requests, please try again later")
		return
	}
	if count >= 3 {
		response.BadRequest(c, "Too many requests, please try again later")
		return
	}

	// Generate secure token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		logger.Errorf("Failed to generate random token: %v", err)
		response.ServerError(c, "Internal error")
		return
	}
	tokenStr := hex.EncodeToString(tokenBytes)

	// Store token (expires in 1 hour)
	resetToken := &authmodel.PasswordResetToken{
		UserID:    user.ID,
		Token:     tokenStr,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	if err := h.passwordResetStore.Create(resetToken); err != nil {
		logger.Errorf("Failed to create reset token: %v", err)
		response.ServerError(c, "Internal error")
		return
	}

	// Send email asynchronously
	resetLink := h.frontendURL + "/reset-password?token=" + tokenStr
	go func() {
		if err := h.emailService.SendPasswordResetEmail(user.Email, user.Name, resetLink, user.Language); err != nil {
			logger.Errorf("Failed to send reset email to %s: %v", user.Email, err)
		}
	}()

	response.Success(c, gin.H{
		"message": "Reset link has been sent.",
		"email":   req.Email,
	})
}

type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func (h *UserAuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Find valid token
	resetToken, err := h.passwordResetStore.FindValidToken(req.Token)
	if err != nil {
		response.BadRequest(c, "Invalid or expired reset token")
		return
	}

	// Get user
	user, err := h.userStore.GetByID(resetToken.UserID)
	if err != nil || user.Status != "active" {
		response.BadRequest(c, "Invalid or expired reset token")
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "Failed to hash password")
		return
	}

	// Update password
	user.Password = string(hashedPassword)
	if err := h.userStore.Update(user); err != nil {
		response.ServerError(c, "Failed to update password")
		return
	}

	// Mark token as used
	_ = h.passwordResetStore.MarkUsed(resetToken.ID)

	// Invalidate all other tokens for this user
	_ = h.passwordResetStore.InvalidateUserTokens(user.ID)

	response.SuccessMessage(c, "Password has been reset successfully.")
}

// BindGoogle binds a Google account to the current user.
func (h *UserAuthHandler) BindGoogle(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}
	u := user.(*models.User)

	if u.GoogleID != "" {
		response.BadRequest(c, "Google account already bound")
		return
	}

	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	// Verify Google ID token
	resp, err := http.Get(fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", req.IDToken))
	if err != nil {
		response.ServerError(c, "Failed to verify Google token")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		response.Unauthorized(c, "Invalid Google token")
		return
	}

	var tokenInfo googleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		response.ServerError(c, "Failed to process Google token")
		return
	}

	if tokenInfo.Sub == "" {
		response.Unauthorized(c, "Invalid Google token")
		return
	}

	// Check if this Google account is already bound to another user
	existing, _ := h.userStore.GetByGoogleID(tokenInfo.Sub)
	if existing != nil && existing.ID != u.ID {
		response.BadRequest(c, "This Google account is already linked to another user")
		return
	}

	u.GoogleID = tokenInfo.Sub
	if u.Avatar == "" && tokenInfo.Picture != "" {
		u.Avatar = tokenInfo.Picture
	}
	if err := h.userStore.Update(u); err != nil {
		response.ServerError(c, "Failed to bind Google account")
		return
	}

	response.Success(c, userProfileResponse(u))
}

// UnbindGoogle removes the Google account binding from the current user.
func (h *UserAuthHandler) UnbindGoogle(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}
	u := user.(*models.User)

	if u.GoogleID == "" {
		response.BadRequest(c, "No Google account bound")
		return
	}

	// Ensure user has a password set (so they can still log in)
	if u.Password == "" {
		response.BadRequest(c, "Please set a password before unbinding Google account")
		return
	}

	u.GoogleID = ""
	if err := h.userStore.Update(u); err != nil {
		response.ServerError(c, "Failed to unbind Google account")
		return
	}

	response.Success(c, userProfileResponse(u))
}
