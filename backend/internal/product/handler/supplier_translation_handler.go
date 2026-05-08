package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"enjoysa-backend/internal/product/store"
	"enjoysa-backend/internal/translation"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// SupplierTranslationHandler exposes per-product translation status and a
// retry endpoint so the supplier-facing UI can poll until the AI translation
// completes (or surface a manual retry button when it failed).
type SupplierTranslationHandler struct {
	productStore *store.ProductStore
	translation  *translation.Service
}

func NewSupplierTranslationHandler(productStore *store.ProductStore, ts *translation.Service) *SupplierTranslationHandler {
	return &SupplierTranslationHandler{productStore: productStore, translation: ts}
}

func (h *SupplierTranslationHandler) supplierID(c *gin.Context) uint {
	id, _ := c.Get("supplier_id")
	if v, ok := id.(uint); ok {
		return v
	}
	return 0
}

type translationStatusResponse struct {
	TaskID    uint              `json:"task_id"`
	Status    string            `json:"status"`
	Retries   int               `json:"retries"`
	LastError string            `json:"last_error,omitempty"`
	UpdatedAt string            `json:"updated_at"`
	Preview   map[string]string `json:"preview,omitempty"`
}

// GetStatus returns the latest translation task for a product the calling
// supplier owns. Returns 404 when no task has ever been enqueued (which is
// the normal state for a freshly created draft product).
func (h *SupplierTranslationHandler) GetStatus(c *gin.Context) {
	supplierID := h.supplierID(c)
	pid, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(pid))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	task, err := h.translation.Store().GetLatestForTarget(translation.TargetTypeProduct, uint(pid))
	if err != nil {
		response.ServerError(c, "Failed to load translation status")
		return
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "no translation task for this product",
		})
		return
	}

	out := translationStatusResponse{
		TaskID:    task.ID,
		Status:    string(task.Status),
		Retries:   task.Retries,
		LastError: task.LastError,
		UpdatedAt: task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if task.Status == translation.StatusSuccess {
		// Surface the *_zh fields straight from the product row instead of
		// fields_output so admin edits (Phase 2) and supplier overrides will
		// override stale snapshots automatically.
		out.Preview = map[string]string{
			"name_zh":        product.NameZh,
			"summary_zh":     product.SummaryZh,
			"description_zh": product.DescriptionZh,
			"address_zh":     product.AddressZh,
		}
		// If the worker only returned a partial output that bypassed the
		// product update for some reason, fall back to fields_output so the
		// supplier still sees something.
		if len(task.FieldsOutput) > 0 {
			var raw map[string]string
			if err := json.Unmarshal(task.FieldsOutput, &raw); err == nil {
				if out.Preview["name_zh"] == "" {
					if v, ok := raw["name"]; ok {
						out.Preview["name_zh"] = v
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// Retry flips the latest translation task back to pending so the worker
// re-runs it. Only allowed when the task is currently failed.
func (h *SupplierTranslationHandler) Retry(c *gin.Context) {
	supplierID := h.supplierID(c)
	pid, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(pid))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	task, err := h.translation.Store().GetLatestForTarget(translation.TargetTypeProduct, uint(pid))
	if err != nil {
		response.ServerError(c, "Failed to load translation task")
		return
	}
	if task == nil {
		response.NotFound(c, "No translation task to retry")
		return
	}

	if err := h.translation.RetryFailed(task.ID); err != nil {
		// Conflict if not in failed state.
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"task_id": task.ID, "status": "pending"}})
}

