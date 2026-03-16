package handler

import (
	"strconv"

	"enjoysa-backend/internal/contact/model"
	"enjoysa-backend/internal/contact/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ContactHandler struct {
	store *store.ContactStore
}

func NewContactHandler(s *store.ContactStore) *ContactHandler {
	return &ContactHandler{store: s}
}

type CreateContactRequest struct {
	Name    string `json:"name" binding:"required"`
	Email   string `json:"email" binding:"required,email"`
	Phone   string `json:"phone"`
	Subject string `json:"subject"`
	Message string `json:"message" binding:"required"`
}

// Submit — public endpoint, no auth
func (h *ContactHandler) Submit(c *gin.Context) {
	var req CreateContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	msg := &model.ContactMessage{
		Name:    req.Name,
		Email:   req.Email,
		Phone:   req.Phone,
		Subject: req.Subject,
		Message: req.Message,
		Status:  "unread",
	}

	if err := h.store.Create(msg); err != nil {
		response.ServerError(c, "Failed to submit message")
		return
	}

	response.Created(c, msg)
}

// List — admin only
func (h *ContactHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	messages, total, err := h.store.List(page, pageSize)
	if err != nil {
		response.ServerError(c, "Failed to list messages")
		return
	}

	response.Paginated(c, messages, total, page, pageSize)
}

// MarkRead — admin only
func (h *ContactHandler) MarkRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	if err := h.store.UpdateStatus(uint(id), "read"); err != nil {
		response.ServerError(c, "Failed to update status")
		return
	}

	response.Success(c, nil)
}
