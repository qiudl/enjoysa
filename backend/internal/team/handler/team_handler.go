package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"enjoysa-backend/internal/email"
	"enjoysa-backend/internal/models"
	teammodel "enjoysa-backend/internal/team/model"
	"enjoysa-backend/internal/team/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type TeamHandler struct {
	teamStore    *store.TeamStore
	emailService *email.ResendService
	frontendURL  string
}

func NewTeamHandler(teamStore *store.TeamStore, emailService *email.ResendService, frontendURL string) *TeamHandler {
	return &TeamHandler{
		teamStore:    teamStore,
		emailService: emailService,
		frontendURL:  frontendURL,
	}
}

// ListMembers GET /supplier/team
func (h *TeamHandler) ListMembers(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")

	members, err := h.teamStore.ListMembers(supplierID.(uint))
	if err != nil {
		response.ServerError(c, "Failed to list members")
		return
	}

	type memberResp struct {
		ID          uint       `json:"id"`
		Name        string     `json:"name"`
		Email       string     `json:"email"`
		Phone       string     `json:"phone"`
		Role        string     `json:"role"`
		Status      string     `json:"status"`
		LastLoginAt *time.Time `json:"last_login_at"`
		CreatedAt   time.Time  `json:"created_at"`
	}
	var result []memberResp
	for _, m := range members {
		result = append(result, memberResp{
			ID:          m.ID,
			Name:        m.Name,
			Email:       m.Email,
			Phone:       m.Phone,
			Role:        m.Role,
			Status:      m.Status,
			LastLoginAt: m.LastLoginAt,
			CreatedAt:   m.CreatedAt,
		})
	}

	response.Success(c, result)
}

// InviteMember POST /supplier/team/invite
func (h *TeamHandler) InviteMember(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	supplierUserID, _ := c.Get("supplier_user_id")

	var req struct {
		Email  string `json:"email" binding:"required,email"`
		Role   string `json:"role" binding:"required"`
		Expiry string `json:"expiry"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	tokenBytes := make([]byte, 32)
	rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	var expiresAt time.Time
	switch req.Expiry {
	case "1d":
		expiresAt = time.Now().Add(24 * time.Hour)
	case "7d":
		expiresAt = time.Now().Add(7 * 24 * time.Hour)
	case "never":
		expiresAt = time.Now().Add(365 * 24 * time.Hour)
	default:
		expiresAt = time.Now().Add(3 * 24 * time.Hour)
	}

	inv := &teammodel.SupplierInvitation{
		SupplierID: supplierID.(uint),
		Email:      req.Email,
		Role:       req.Role,
		Token:      token,
		Status:     "pending",
		ExpiresAt:  expiresAt,
		InvitedBy:  supplierUserID.(uint),
	}

	if err := h.teamStore.CreateInvitation(inv); err != nil {
		response.ServerError(c, "Failed to create invitation")
		return
	}

	response.Created(c, inv)
}

// UpdateRole PUT /supplier/team/:id/role
func (h *TeamHandler) UpdateRole(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.teamStore.UpdateRole(uint(id), supplierID.(uint), req.Role); err != nil {
		response.ServerError(c, "Failed to update role")
		return
	}

	response.SuccessMessage(c, "Role updated")
}

// UpdateStatus PUT /supplier/team/:id/status
func (h *TeamHandler) UpdateStatus(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required,oneof=active suspended"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.teamStore.UpdateStatus(uint(id), supplierID.(uint), req.Status); err != nil {
		response.ServerError(c, "Failed to update status")
		return
	}

	response.SuccessMessage(c, "Status updated")
}

// RemoveMember DELETE /supplier/team/:id
func (h *TeamHandler) RemoveMember(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	supplierUserID, _ := c.Get("supplier_user_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	if uint(id) == supplierUserID.(uint) {
		response.BadRequest(c, "Cannot remove yourself")
		return
	}

	if err := h.teamStore.RemoveMember(uint(id), supplierID.(uint)); err != nil {
		response.ServerError(c, "Failed to remove member")
		return
	}

	response.SuccessMessage(c, "Member removed")
}

// ResetPassword POST /supplier/team/:id/reset-password
func (h *TeamHandler) ResetPassword(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	chars := "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
	pw := make([]byte, 10)
	rand.Read(pw)
	for i := range pw {
		pw[i] = chars[int(pw[i])%len(chars)]
	}
	tempPassword := string(pw)

	hashedPwd, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "Failed to generate password")
		return
	}

	if err := h.teamStore.ResetPassword(uint(id), supplierID.(uint), string(hashedPwd)); err != nil {
		response.ServerError(c, "Failed to reset password")
		return
	}

	response.Success(c, gin.H{"temp_password": tempPassword})
}

// ListInvitations GET /supplier/team/invitations
func (h *TeamHandler) ListInvitations(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")

	invitations, err := h.teamStore.ListInvitations(supplierID.(uint))
	if err != nil {
		response.ServerError(c, "Failed to list invitations")
		return
	}

	now := time.Now()
	for i, inv := range invitations {
		if inv.Status == "pending" && inv.ExpiresAt.Before(now) {
			invitations[i].Status = "expired"
		}
	}

	response.Success(c, invitations)
}

// RevokeInvitation DELETE /supplier/team/invitations/:id
func (h *TeamHandler) RevokeInvitation(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	if err := h.teamStore.RevokeInvitation(uint(id), supplierID.(uint)); err != nil {
		response.ServerError(c, "Failed to revoke invitation")
		return
	}

	response.SuccessMessage(c, "Invitation revoked")
}

// ResendInvitation POST /supplier/team/invitations/:id/resend
func (h *TeamHandler) ResendInvitation(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	tokenBytes := make([]byte, 32)
	rand.Read(tokenBytes)
	newToken := hex.EncodeToString(tokenBytes)
	newExpiry := time.Now().Add(3 * 24 * time.Hour)

	if err := h.teamStore.ResendInvitation(uint(id), supplierID.(uint), newToken, newExpiry); err != nil {
		response.ServerError(c, "Failed to resend invitation")
		return
	}

	response.SuccessMessage(c, "Invitation resent")
}

// AcceptInvitation POST /supplier/invite/accept (public)
func (h *TeamHandler) AcceptInvitation(c *gin.Context) {
	var req struct {
		Token    string `json:"token" binding:"required"`
		Name     string `json:"name" binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	inv, err := h.teamStore.GetInvitationByToken(req.Token)
	if err != nil {
		response.NotFound(c, "Invalid or expired invitation")
		return
	}

	if inv.Status != "pending" {
		response.BadRequest(c, fmt.Sprintf("Invitation is %s", inv.Status))
		return
	}

	if inv.ExpiresAt.Before(time.Now()) {
		response.BadRequest(c, "Invitation has expired")
		return
	}

	hashedPwd, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "Failed to process password")
		return
	}

	su := &models.SupplierUser{
		SupplierID: inv.SupplierID,
		Email:      inv.Email,
		Password:   string(hashedPwd),
		Name:       req.Name,
		Role:       inv.Role,
		Status:     "active",
	}

	if err := h.teamStore.AcceptInvitation(req.Token, su); err != nil {
		response.ServerError(c, "Failed to accept invitation")
		return
	}

	response.SuccessMessage(c, "Invitation accepted. You can now login.")
}
