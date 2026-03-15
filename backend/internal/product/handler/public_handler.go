package handler

import (
	"strconv"
	"time"

	"enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type PublicProductHandler struct {
	productStore  *store.ProductStore
	regionStore   *store.RegionStore
	categoryStore *store.CategoryStore
	scheduleStore *store.ScheduleStore
}

func NewPublicProductHandler(
	productStore *store.ProductStore,
	regionStore *store.RegionStore,
	categoryStore *store.CategoryStore,
	scheduleStore *store.ScheduleStore,
) *PublicProductHandler {
	return &PublicProductHandler{
		productStore:  productStore,
		regionStore:   regionStore,
		categoryStore: categoryStore,
		scheduleStore: scheduleStore,
	}
}

func (h *PublicProductHandler) ListRegions(c *gin.Context) {
	regions, err := h.regionStore.List()
	if err != nil {
		response.ServerError(c, "Failed to list regions")
		return
	}
	response.Success(c, regions)
}

func (h *PublicProductHandler) GetRegion(c *gin.Context) {
	slug := c.Param("slug")
	region, err := h.regionStore.GetBySlug(slug)
	if err != nil {
		response.NotFound(c, "Region not found")
		return
	}

	// Get products in this region
	products, total, _ := h.productStore.ListPublic(store.ProductFilter{
		RegionID: region.ID,
		Page:     1,
		PageSize: 20,
	})

	response.Success(c, gin.H{
		"region":   region,
		"products": products,
		"total":    total,
	})
}

func (h *PublicProductHandler) ListCategories(c *gin.Context) {
	categories, err := h.categoryStore.List()
	if err != nil {
		response.ServerError(c, "Failed to list categories")
		return
	}
	response.Success(c, categories)
}

func (h *PublicProductHandler) ListProducts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	regionID, _ := strconv.Atoi(c.Query("region_id"))
	categoryID, _ := strconv.Atoi(c.Query("category_id"))
	keyword := c.Query("keyword")

	products, total, err := h.productStore.ListPublic(store.ProductFilter{
		RegionID:   uint(regionID),
		CategoryID: uint(categoryID),
		Keyword:    keyword,
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list products")
		return
	}

	response.Paginated(c, products, total, page, pageSize)
}

func (h *PublicProductHandler) ListFeatured(c *gin.Context) {
	featured := true
	products, _, err := h.productStore.ListPublic(store.ProductFilter{
		IsFeatured: &featured,
		Page:       1,
		PageSize:   10,
	})
	if err != nil {
		response.ServerError(c, "Failed to list featured products")
		return
	}
	response.Success(c, products)
}

func (h *PublicProductHandler) GetProduct(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}

	// Only show approved products to public
	if product.Status != "approved" {
		response.NotFound(c, "Product not found")
		return
	}

	response.Success(c, product)
}

func (h *PublicProductHandler) GetSchedules(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	from := time.Now().Truncate(24 * time.Hour)
	to := from.AddDate(0, 0, 60)

	schedules, err := h.scheduleStore.ListByProduct(uint(id), from, to)
	if err != nil {
		response.ServerError(c, "Failed to list schedules")
		return
	}

	response.Success(c, schedules)
}
