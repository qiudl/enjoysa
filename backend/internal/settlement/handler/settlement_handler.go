package handler

import (
	"strconv"

	"enjoysa-backend/internal/settlement/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type SettlementHandler struct {
	store *store.SettlementStore
}

func NewSettlementHandler(s *store.SettlementStore) *SettlementHandler {
	return &SettlementHandler{store: s}
}

// ========================================
// Supplier endpoints
// ========================================

// SupplierList returns settlements for the current supplier
func (h *SettlementHandler) SupplierList(c *gin.Context) {
	supplierID := getSupplierID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	settlements, total, err := h.store.ListBySupplier(supplierID, page, pageSize)
	if err != nil {
		response.ServerError(c, "Failed to list settlements")
		return
	}

	response.Paginated(c, settlements, total, page, pageSize)
}

// SupplierStats returns settlement stats for the current supplier
func (h *SettlementHandler) SupplierStats(c *gin.Context) {
	supplierID := getSupplierID(c)

	stats, err := h.store.SupplierStats(supplierID)
	if err != nil {
		response.ServerError(c, "Failed to get stats")
		return
	}

	response.Success(c, stats)
}

// ========================================
// Admin endpoints
// ========================================

// AdminList returns all settlements
func (h *SettlementHandler) AdminList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	settlements, total, err := h.store.ListAll(page, pageSize, status)
	if err != nil {
		response.ServerError(c, "Failed to list settlements")
		return
	}

	response.Paginated(c, settlements, total, page, pageSize)
}

// AdminStats returns global settlement/finance stats
func (h *SettlementHandler) AdminStats(c *gin.Context) {
	stats, err := h.store.Stats()
	if err != nil {
		response.ServerError(c, "Failed to get stats")
		return
	}

	response.Success(c, stats)
}

// AdminProcess marks a settlement as processing/completed
func (h *SettlementHandler) AdminProcess(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	if req.Status != "processing" && req.Status != "completed" && req.Status != "failed" {
		response.BadRequest(c, "Invalid status")
		return
	}

	if err := h.store.UpdateStatus(uint(id), req.Status); err != nil {
		response.ServerError(c, "Failed to update settlement")
		return
	}

	response.Success(c, nil)
}

func getSupplierID(c *gin.Context) uint {
	if id, exists := c.Get("supplier_id"); exists {
		if uid, ok := id.(uint); ok {
			return uid
		}
	}
	return 0
}
