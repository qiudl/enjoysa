package handler

import (
	"strconv"

	"enjoysa-backend/internal/audit/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuditHandler struct {
	auditStore *store.AuditStore
}

func NewAuditHandler(as *store.AuditStore) *AuditHandler {
	return &AuditHandler{auditStore: as}
}

func (h *AuditHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	adminID, _ := strconv.ParseUint(c.Query("admin_id"), 10, 64)

	params := store.ListParams{
		Page:      page,
		PageSize:  pageSize,
		AdminID:   uint(adminID),
		Action:    c.Query("action"),
		Resource:  c.Query("resource"),
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
	}

	logs, total, err := h.auditStore.List(params)
	if err != nil {
		response.ServerError(c, "Failed to list audit logs")
		return
	}

	response.Paginated(c, logs, total, page, pageSize)
}
