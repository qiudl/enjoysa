package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// SupplierHandler OCTO Supplier 端点
type SupplierHandler struct{}

func NewSupplierHandler() *SupplierHandler {
	return &SupplierHandler{}
}

// GetSupplier GET /octo/v1/supplier
func (h *SupplierHandler) GetSupplier(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"id":       "enjoysa",
		"name":     "EnjoySA - South Australia Travel Platform",
		"endpoint": "https://enjoysa.com.au/octo/v1",
		"contact": gin.H{
			"website": "https://enjoysa.com.au",
			"email":   "connect@enjoysa.com.au",
			"address": "Adelaide, South Australia, Australia",
		},
	})
}
