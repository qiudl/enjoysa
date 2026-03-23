package handler

import (
	"strconv"
	"time"

	"enjoysa-backend/internal/models"
	"enjoysa-backend/internal/product/model"
	"enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PublicProductHandler struct {
	db            *gorm.DB
	productStore  *store.ProductStore
	regionStore   *store.RegionStore
	categoryStore *store.CategoryStore
	scheduleStore *store.ScheduleStore
}

func NewPublicProductHandler(
	db *gorm.DB,
	productStore *store.ProductStore,
	regionStore *store.RegionStore,
	categoryStore *store.CategoryStore,
	scheduleStore *store.ScheduleStore,
) *PublicProductHandler {
	return &PublicProductHandler{
		db:            db,
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

// CategoryWithCount wraps Category with product count
type CategoryWithCount struct {
	model.Category
	ProductCount int `json:"product_count"`
}

func (h *PublicProductHandler) ListCategories(c *gin.Context) {
	categories, err := h.categoryStore.List()
	if err != nil {
		response.ServerError(c, "Failed to list categories")
		return
	}

	counts, _ := h.categoryStore.GetProductCounts()

	result := make([]CategoryWithCount, len(categories))
	for i, cat := range categories {
		result[i] = CategoryWithCount{Category: cat}
		if count, ok := counts[cat.ID]; ok {
			result[i].ProductCount = count
		}
	}
	response.Success(c, result)
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

// SupplierPublicProfile is the public-facing supplier info (hides sensitive fields)
type SupplierPublicProfile struct {
	ID           uint    `json:"id"`
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	Description  string  `json:"description"`
	Logo         string  `json:"logo"`
	Phone        string  `json:"phone"`
	Website      string  `json:"website"`
	City         string  `json:"city"`
	State        string  `json:"state"`
	Country      string  `json:"country"`
	Rating       float64 `json:"rating"`
	ReviewCount  int     `json:"review_count"`
	ProductCount int64   `json:"product_count"`
}

func (h *PublicProductHandler) GetSupplier(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	var supplier models.Supplier
	if err := h.db.First(&supplier, id).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	if supplier.Status != "approved" {
		response.NotFound(c, "Supplier not found")
		return
	}

	var productCount int64
	h.db.Model(&model.Product{}).Where("supplier_id = ? AND status = ? AND deleted_at IS NULL", supplier.ID, "approved").Count(&productCount)

	profile := SupplierPublicProfile{
		ID:           supplier.ID,
		Name:         supplier.Name,
		Type:         supplier.Type,
		Description:  supplier.Description,
		Logo:         supplier.Logo,
		Phone:        supplier.Phone,
		Website:      supplier.Website,
		City:         supplier.City,
		State:        supplier.State,
		Country:      supplier.Country,
		Rating:       supplier.Rating,
		ReviewCount:  supplier.ReviewCount,
		ProductCount: productCount,
	}

	response.Success(c, profile)
}

func (h *PublicProductHandler) GetSupplierProducts(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	// Verify supplier exists and is approved
	var supplier models.Supplier
	if err := h.db.Select("id, status").First(&supplier, id).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}
	if supplier.Status != "approved" {
		response.NotFound(c, "Supplier not found")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	products, total, err := h.productStore.ListPublic(store.ProductFilter{
		SupplierID: uint(id),
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list products")
		return
	}

	response.Paginated(c, products, total, page, pageSize)
}
