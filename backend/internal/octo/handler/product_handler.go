package handler

import (
	"net/http"
	"strconv"

	"enjoysa-backend/internal/octo/service"
	productstore "enjoysa-backend/internal/product/store"

	"github.com/gin-gonic/gin"
)

// ProductHandler OCTO Product 端点
type ProductHandler struct {
	productStore *productstore.ProductStore
}

func NewProductHandler(productStore *productstore.ProductStore) *ProductHandler {
	return &ProductHandler{productStore: productStore}
}

// ListProducts GET /octo/v1/products
func (h *ProductHandler) ListProducts(c *gin.Context) {
	caps := service.GetCapabilities(c)

	products, _, err := h.productStore.ListPublic(productstore.ProductFilter{
		Status:   "approved",
		Page:     1,
		PageSize: 100,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to fetch products"})
		return
	}

	var result []service.OctoProduct
	for _, p := range products {
		if !p.OctoEnabled {
			continue
		}
		// Load full relations
		full, err := h.productStore.GetByID(p.ID)
		if err != nil {
			continue
		}
		op := service.MapProductToOcto(full, caps["content"], caps["pricing"])
		result = append(result, op)
	}

	if result == nil {
		result = []service.OctoProduct{}
	}

	c.JSON(http.StatusOK, result)
}

// GetProduct GET /octo/v1/products/:id
func (h *ProductHandler) GetProduct(c *gin.Context) {
	caps := service.GetCapabilities(c)

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": "Invalid product ID"})
		return
	}

	product, err := h.productStore.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Product not found"})
		return
	}

	if !product.OctoEnabled || product.Status != "approved" {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Product not available"})
		return
	}

	result := service.MapProductToOcto(product, caps["content"], caps["pricing"])
	c.JSON(http.StatusOK, result)
}
