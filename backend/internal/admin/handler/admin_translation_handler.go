package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/internal/translation"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AdminTranslationHandler exposes the admin-side ZH→EN translation status and
// retry endpoints introduced for REQ-20260509-0004. Mirrors the supplier
// EN→ZH endpoints in shape, but is scoped to direction=zh2en and skips the
// supplier-ownership check (admins see every product).
type AdminTranslationHandler struct {
	db           *gorm.DB
	productStore *productstore.ProductStore
	translation  *translation.Service
}

func NewAdminTranslationHandler(db *gorm.DB, productStore *productstore.ProductStore, ts *translation.Service) *AdminTranslationHandler {
	return &AdminTranslationHandler{db: db, productStore: productStore, translation: ts}
}

func (h *AdminTranslationHandler) adminID(c *gin.Context) uint {
	if v, ok := c.Get("admin_id"); ok {
		if id, ok := v.(uint); ok {
			return id
		}
	}
	return 0
}

type adminTranslationStatusResponse struct {
	TaskID    uint              `json:"task_id"`
	Direction string            `json:"direction"`
	Status    string            `json:"status"`
	Retries   int               `json:"retries"`
	LastError string            `json:"last_error,omitempty"`
	UpdatedAt string            `json:"updated_at"`
	Preview   map[string]string `json:"preview,omitempty"`
}

// GetStatus returns the latest ZH→EN translation task for the product. 404
// when no task has ever been enqueued, which is the normal state for
// brand-new products before the first save.
func (h *AdminTranslationHandler) GetStatus(c *gin.Context) {
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

	task, err := h.translation.GetLatestForProductByDirection(uint(pid), string(translation.DirectionZH2EN))
	if err != nil {
		response.ServerError(c, "Failed to load translation status")
		return
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "no zh2en translation task for this product",
		})
		return
	}

	out := adminTranslationStatusResponse{
		TaskID:    task.ID,
		Direction: string(task.Direction),
		Status:    string(task.Status),
		Retries:   task.Retries,
		LastError: task.LastError,
		UpdatedAt: task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if task.Status == translation.StatusSuccess {
		// Surface the *_en fields straight from the product row so subsequent
		// admin edits override stale snapshots automatically.
		out.Preview = map[string]string{
			"name_en":        product.NameEn,
			"summary_en":     product.SummaryEn,
			"description_en": product.DescriptionEn,
			"address_en":     product.AddressEn,
		}
		// Fall back to fields_output when the product row was unexpectedly
		// not updated (defensive — should not happen in the normal path).
		if len(task.FieldsOutput) > 0 {
			var raw map[string]string
			if err := json.Unmarshal(task.FieldsOutput, &raw); err == nil {
				if out.Preview["name_en"] == "" {
					if v, ok := raw["name"]; ok {
						out.Preview["name_en"] = v
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// Retry flips the latest ZH→EN translation task back to pending so the
// worker re-runs it. 409 when the task is not currently in failed state.
func (h *AdminTranslationHandler) Retry(c *gin.Context) {
	pid, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	if _, err := h.productStore.GetByID(uint(pid)); err != nil {
		response.NotFound(c, "Product not found")
		return
	}

	task, err := h.translation.GetLatestForProductByDirection(uint(pid), string(translation.DirectionZH2EN))
	if err != nil {
		response.ServerError(c, "Failed to load translation task")
		return
	}
	if task == nil {
		response.NotFound(c, "No zh2en translation task to retry")
		return
	}

	if err := h.translation.RetryFailed(task.ID); err != nil {
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"task_id": task.ID, "status": "pending"}})
}

// Regenerate force-enqueues a new ZH→EN translation task using the
// product's current ZH fields. Refuses when manual_override_en=true so
// admin-locked English content cannot be silently overwritten — caller
// must clear the override flag first via UpdateProduct.
func (h *AdminTranslationHandler) Regenerate(c *gin.Context) {
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

	if product.ManualOverrideEn {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "manual_override_en is set; clear it on the product first to allow re-translation",
		})
		return
	}

	fields := zhFieldsForTranslation(product.NameZh, product.SummaryZh, product.DescriptionZh, product.AddressZh)
	if len(fields) == 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"success": false,
			"error":   "no chinese content to translate",
		})
		return
	}

	adminID := h.adminID(c)
	var task *translation.TranslationTask
	err = h.db.Transaction(func(tx *gorm.DB) error {
		t, txErr := h.translation.EnqueueProductZhToEnInTx(tx, uint(pid), adminID, fields)
		if txErr != nil {
			return txErr
		}
		task = t
		return nil
	})
	if err != nil {
		response.ServerError(c, "Failed to enqueue translation: "+err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"task_id":   task.ID,
		"direction": string(task.Direction),
		"status":    string(task.Status),
	}})
}

// zhFieldsForTranslation packs the four canonical ZH fields into the
// translator's input map, dropping empties so the LLM does not waste
// tokens on blank values.
func zhFieldsForTranslation(name, summary, description, address string) map[string]string {
	out := map[string]string{}
	if name != "" {
		out["name"] = name
	}
	if summary != "" {
		out["summary"] = summary
	}
	if description != "" {
		out["description"] = description
	}
	if address != "" {
		out["address"] = address
	}
	return out
}
