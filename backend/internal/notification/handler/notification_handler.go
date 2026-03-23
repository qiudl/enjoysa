package handler

import (
	"strconv"

	"enjoysa-backend/internal/notification/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	store *store.NotificationStore
}

func NewNotificationHandler(store *store.NotificationStore) *NotificationHandler {
	return &NotificationHandler{store: store}
}

// List GET /supplier/notifications
func (h *NotificationHandler) List(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := store.NotifFilter{
		Page:     page,
		PageSize: pageSize,
	}

	if isRead := c.Query("is_read"); isRead != "" {
		v := isRead == "true"
		filter.IsRead = &v
	}

	notifications, total, err := h.store.List("supplier", supplierID.(uint), filter)
	if err != nil {
		response.ServerError(c, "Failed to list notifications")
		return
	}

	response.Paginated(c, notifications, total, page, pageSize)
}

// UnreadCount GET /supplier/notifications/unread-count
func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")

	count, err := h.store.UnreadCount("supplier", supplierID.(uint))
	if err != nil {
		response.ServerError(c, "Failed to get unread count")
		return
	}

	response.Success(c, gin.H{"count": count})
}

// MarkRead POST /supplier/notifications/:id/read
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid notification ID")
		return
	}

	if err := h.store.MarkRead(uint(id)); err != nil {
		response.ServerError(c, "Failed to mark as read")
		return
	}

	response.SuccessMessage(c, "Marked as read")
}

// MarkAllRead POST /supplier/notifications/read-all
func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")

	if err := h.store.MarkAllRead("supplier", supplierID.(uint)); err != nil {
		response.ServerError(c, "Failed to mark all as read")
		return
	}

	response.SuccessMessage(c, "All marked as read")
}

// Delete DELETE /supplier/notifications/:id
func (h *NotificationHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid notification ID")
		return
	}

	if err := h.store.Delete(uint(id)); err != nil {
		response.ServerError(c, "Failed to delete notification")
		return
	}

	response.SuccessMessage(c, "Deleted")
}
