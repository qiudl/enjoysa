package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	// Code: machine-readable error identifier (REQ-20260509-0034). Frontend can
	// branch on this without parsing localized Error strings. Optional — old
	// helpers don't emit it; new structured helpers do.
	Code string `json:"code,omitempty"`
}

type PaginatedData struct {
	Items      interface{} `json:"items"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func SuccessMessage(c *gin.Context, message string) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: message,
	})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

func BadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, Response{
		Success: false,
		Error:   message,
	})
}

func Unauthorized(c *gin.Context, message string) {
	c.JSON(http.StatusUnauthorized, Response{
		Success: false,
		Error:   message,
	})
}

func Forbidden(c *gin.Context, message string) {
	c.JSON(http.StatusForbidden, Response{
		Success: false,
		Error:   message,
	})
}

func NotFound(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, Response{
		Success: false,
		Error:   message,
	})
}

func ServerError(c *gin.Context, message string) {
	c.JSON(http.StatusInternalServerError, Response{
		Success: false,
		Error:   message,
	})
}

// Fail emits a structured error with explicit HTTP status, machine-readable
// code, and human message (REQ-20260509-0034). Use when the frontend needs
// to branch on the error type — e.g. PAYMENT_DISABLED vs STRIPE_ERROR vs
// ORDER_INVALID — without parsing localized error text.
func Fail(c *gin.Context, status int, code, message string) {
	c.JSON(status, Response{
		Success: false,
		Error:   message,
		Code:    code,
	})
}

// FailWithData is Fail with structured details attached on Response.Data so
// the frontend can branch on `code` and read structured context (e.g.
// missing_ids, conflicting_packages) without parsing message strings.
// REQ-20260509-0035 Phase 3b — batch endpoints need to return per-item
// reasons when 422-ing the whole batch.
func FailWithData(c *gin.Context, status int, code, message string, data interface{}) {
	c.JSON(status, Response{
		Success: false,
		Error:   message,
		Code:    code,
		Data:    data,
	})
}

func Paginated(c *gin.Context, items interface{}, total int64, page, pageSize int) {
	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: PaginatedData{
			Items:      items,
			Total:      total,
			Page:       page,
			PageSize:   pageSize,
			TotalPages: totalPages,
		},
	})
}
