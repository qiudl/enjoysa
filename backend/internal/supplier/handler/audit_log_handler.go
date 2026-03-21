package handler

import (
	"strconv"

	"enjoysa-backend/internal/supplier/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuditLogHandler struct {
	auditStore *store.AuditLogStore
}

func NewAuditLogHandler(auditStore *store.AuditLogStore) *AuditLogHandler {
	return &AuditLogHandler{auditStore: auditStore}
}

func (h *AuditLogHandler) List(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	logs, total, err := h.auditStore.List(store.AuditLogFilter{
		SupplierID:   supplierID,
		Action:       c.Query("action"),
		ResourceType: c.Query("resource_type"),
		Page:         page,
		PageSize:     pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to get audit logs")
		return
	}

	response.Paginated(c, logs, total, page, pageSize)
}
