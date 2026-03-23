package homepage

import (
	"encoding/json"
	"strconv"

	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

// ============================
// Public API
// ============================

// PopularProduct is the DTO returned for popular activities ranking.
type PopularProduct struct {
	ID         uint    `json:"id"`
	NameZh     string  `json:"name_zh"`
	NameEn     string  `json:"name_en"`
	Image      string  `json:"image"`
	PriceFrom  float64 `json:"price_from"`
	Currency   string  `json:"currency"`
	Rating     float64 `json:"rating"`
	OrderCount int64   `json:"order_count"`
}

// HomepageConfigResponse is the aggregated homepage config returned to the frontend.
type HomepageConfigResponse struct {
	Modules         []HomepageModule      `json:"modules"`
	Features        []HomepageFeature     `json:"features"`
	Testimonials    []HomepageTestimonial `json:"testimonials"`
	Partners        []HomepagePartner     `json:"partners"`
	PopularProducts []PopularProduct      `json:"popular_products"`
}

// GetConfig returns all homepage configuration in a single response.
func (h *Handler) GetConfig(c *gin.Context) {
	var modules []HomepageModule
	h.db.Order("sort_order ASC").Find(&modules)

	var features []HomepageFeature
	h.db.Where("status = ?", "active").Order("sort_order ASC").Find(&features)

	var testimonials []HomepageTestimonial
	h.db.Where("status = ?", "active").Order("sort_order ASC").Find(&testimonials)

	var partners []HomepagePartner
	h.db.Where("status = ?", "active").Order("sort_order ASC").Find(&partners)

	// Popular products: top 8 by order count
	limit := 8
	for _, m := range modules {
		if m.ModuleKey == "popular" {
			var cfg struct {
				Limit int `json:"limit"`
			}
			if err := json.Unmarshal([]byte(m.Config), &cfg); err == nil && cfg.Limit > 0 {
				limit = cfg.Limit
			}
			break
		}
	}

	var popular []PopularProduct
	h.db.Raw(`
		SELECT p.id, p.name_zh, p.name_en, p.price_from, p.currency, p.rating,
			COALESCE((SELECT url FROM product_images WHERE product_id = p.id AND is_cover = true LIMIT 1),
					 (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1), '') as image,
			COUNT(o.id) as order_count
		FROM products p
		LEFT JOIN orders o ON o.product_id = p.id AND o.status NOT IN ('cancelled', 'refunded')
		WHERE p.status = 'approved' AND p.deleted_at IS NULL
		GROUP BY p.id
		ORDER BY order_count DESC, p.rating DESC
		LIMIT ?
	`, limit).Scan(&popular)

	response.Success(c, HomepageConfigResponse{
		Modules:         modules,
		Features:        features,
		Testimonials:    testimonials,
		Partners:        partners,
		PopularProducts: popular,
	})
}

// ============================
// Admin: Features CRUD
// ============================

type FeatureRequest struct {
	Icon      string `json:"icon"`
	TitleZh   string `json:"title_zh"`
	TitleEn   string `json:"title_en"`
	DescZh    string `json:"desc_zh"`
	DescEn    string `json:"desc_en"`
	SortOrder int    `json:"sort_order"`
	Status    string `json:"status"`
}

func (h *Handler) ListFeatures(c *gin.Context) {
	var items []HomepageFeature
	h.db.Order("sort_order ASC").Find(&items)
	response.Success(c, items)
}

func (h *Handler) CreateFeature(c *gin.Context) {
	var req FeatureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	item := HomepageFeature{
		Icon: req.Icon, TitleZh: req.TitleZh, TitleEn: req.TitleEn,
		DescZh: req.DescZh, DescEn: req.DescEn, SortOrder: req.SortOrder,
		Status: defaultStatus(req.Status),
	}
	if err := h.db.Create(&item).Error; err != nil {
		response.ServerError(c, "Failed to create feature")
		return
	}
	response.Created(c, item)
}

func (h *Handler) UpdateFeature(c *gin.Context) {
	id := parseID(c)
	if id == 0 {
		return
	}
	var item HomepageFeature
	if err := h.db.First(&item, id).Error; err != nil {
		response.NotFound(c, "Feature not found")
		return
	}
	var req FeatureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	item.Icon = req.Icon
	item.TitleZh = req.TitleZh
	item.TitleEn = req.TitleEn
	item.DescZh = req.DescZh
	item.DescEn = req.DescEn
	item.SortOrder = req.SortOrder
	if req.Status != "" {
		item.Status = req.Status
	}
	if err := h.db.Save(&item).Error; err != nil {
		response.ServerError(c, "Failed to update feature")
		return
	}
	response.Success(c, item)
}

func (h *Handler) DeleteFeature(c *gin.Context) {
	id := parseID(c)
	if id == 0 {
		return
	}
	if err := h.db.Delete(&HomepageFeature{}, id).Error; err != nil {
		response.ServerError(c, "Failed to delete feature")
		return
	}
	response.SuccessMessage(c, "Feature deleted")
}

// ============================
// Admin: Testimonials CRUD
// ============================

type TestimonialRequest struct {
	Source        string `json:"source"`
	AuthorName    string `json:"author_name"`
	AuthorAvatar  string `json:"author_avatar"`
	ContentZh     string `json:"content_zh"`
	ContentEn     string `json:"content_en"`
	Rating        int    `json:"rating"`
	ProductNameZh string `json:"product_name_zh"`
	ProductNameEn string `json:"product_name_en"`
	SortOrder     int    `json:"sort_order"`
	Status        string `json:"status"`
}

func (h *Handler) ListTestimonials(c *gin.Context) {
	var items []HomepageTestimonial
	h.db.Order("sort_order ASC").Find(&items)
	response.Success(c, items)
}

func (h *Handler) CreateTestimonial(c *gin.Context) {
	var req TestimonialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	item := HomepageTestimonial{
		Source: "manual", AuthorName: req.AuthorName, AuthorAvatar: req.AuthorAvatar,
		ContentZh: req.ContentZh, ContentEn: req.ContentEn, Rating: req.Rating,
		ProductNameZh: req.ProductNameZh, ProductNameEn: req.ProductNameEn,
		SortOrder: req.SortOrder, Status: defaultStatus(req.Status),
	}
	if err := h.db.Create(&item).Error; err != nil {
		response.ServerError(c, "Failed to create testimonial")
		return
	}
	response.Created(c, item)
}

func (h *Handler) UpdateTestimonial(c *gin.Context) {
	id := parseID(c)
	if id == 0 {
		return
	}
	var item HomepageTestimonial
	if err := h.db.First(&item, id).Error; err != nil {
		response.NotFound(c, "Testimonial not found")
		return
	}
	var req TestimonialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	item.AuthorName = req.AuthorName
	item.AuthorAvatar = req.AuthorAvatar
	item.ContentZh = req.ContentZh
	item.ContentEn = req.ContentEn
	item.Rating = req.Rating
	item.ProductNameZh = req.ProductNameZh
	item.ProductNameEn = req.ProductNameEn
	item.SortOrder = req.SortOrder
	if req.Status != "" {
		item.Status = req.Status
	}
	if err := h.db.Save(&item).Error; err != nil {
		response.ServerError(c, "Failed to update testimonial")
		return
	}
	response.Success(c, item)
}

func (h *Handler) DeleteTestimonial(c *gin.Context) {
	id := parseID(c)
	if id == 0 {
		return
	}
	if err := h.db.Delete(&HomepageTestimonial{}, id).Error; err != nil {
		response.ServerError(c, "Failed to delete testimonial")
		return
	}
	response.SuccessMessage(c, "Testimonial deleted")
}

// SyncTestimonials pulls high-rated approved reviews into testimonials.
func (h *Handler) SyncTestimonials(c *gin.Context) {
	type reviewRow struct {
		ID            uint
		UserName      string
		Content       string
		Rating        int
		ProductNameZh string
		ProductNameEn string
	}
	var rows []reviewRow
	h.db.Raw(`
		SELECT r.id, u.name as user_name, r.content, r.rating,
			p.name_zh as product_name_zh, p.name_en as product_name_en
		FROM reviews r
		JOIN users u ON u.id = r.user_id
		JOIN products p ON p.id = r.product_id
		WHERE r.status = 'approved' AND r.rating >= 4
		AND r.id NOT IN (SELECT review_id FROM homepage_testimonials WHERE review_id IS NOT NULL AND deleted_at IS NULL)
		ORDER BY r.rating DESC, r.created_at DESC
		LIMIT 10
	`).Scan(&rows)

	created := 0
	for _, r := range rows {
		t := HomepageTestimonial{
			Source:        "review",
			ReviewID:      &r.ID,
			AuthorName:    r.UserName,
			ContentZh:     r.Content,
			ContentEn:     r.Content,
			Rating:        r.Rating,
			ProductNameZh: r.ProductNameZh,
			ProductNameEn: r.ProductNameEn,
			Status:        "active",
		}
		if err := h.db.Create(&t).Error; err == nil {
			created++
		}
	}
	response.Success(c, gin.H{"synced": created})
}

// ============================
// Admin: Partners CRUD
// ============================

type PartnerRequest struct {
	Name      string `json:"name"`
	Logo      string `json:"logo"`
	Website   string `json:"website"`
	SortOrder int    `json:"sort_order"`
	Status    string `json:"status"`
}

func (h *Handler) ListPartners(c *gin.Context) {
	var items []HomepagePartner
	h.db.Order("sort_order ASC").Find(&items)
	response.Success(c, items)
}

func (h *Handler) CreatePartner(c *gin.Context) {
	var req PartnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	item := HomepagePartner{
		Name: req.Name, Logo: req.Logo, Website: req.Website,
		SortOrder: req.SortOrder, Status: defaultStatus(req.Status),
	}
	if err := h.db.Create(&item).Error; err != nil {
		response.ServerError(c, "Failed to create partner")
		return
	}
	response.Created(c, item)
}

func (h *Handler) UpdatePartner(c *gin.Context) {
	id := parseID(c)
	if id == 0 {
		return
	}
	var item HomepagePartner
	if err := h.db.First(&item, id).Error; err != nil {
		response.NotFound(c, "Partner not found")
		return
	}
	var req PartnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	item.Name = req.Name
	item.Logo = req.Logo
	item.Website = req.Website
	item.SortOrder = req.SortOrder
	if req.Status != "" {
		item.Status = req.Status
	}
	if err := h.db.Save(&item).Error; err != nil {
		response.ServerError(c, "Failed to update partner")
		return
	}
	response.Success(c, item)
}

func (h *Handler) DeletePartner(c *gin.Context) {
	id := parseID(c)
	if id == 0 {
		return
	}
	if err := h.db.Delete(&HomepagePartner{}, id).Error; err != nil {
		response.ServerError(c, "Failed to delete partner")
		return
	}
	response.SuccessMessage(c, "Partner deleted")
}

// ============================
// Admin: Modules config
// ============================

type ModuleUpdateItem struct {
	ID        uint   `json:"id"`
	TitleZh   string `json:"title_zh"`
	TitleEn   string `json:"title_en"`
	SortOrder int    `json:"sort_order"`
	IsVisible bool   `json:"is_visible"`
}

func (h *Handler) ListModules(c *gin.Context) {
	var items []HomepageModule
	h.db.Order("sort_order ASC").Find(&items)
	response.Success(c, items)
}

func (h *Handler) UpdateModules(c *gin.Context) {
	var items []ModuleUpdateItem
	if err := c.ShouldBindJSON(&items); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	for _, item := range items {
		h.db.Model(&HomepageModule{}).Where("id = ?", item.ID).Updates(map[string]interface{}{
			"title_zh":   item.TitleZh,
			"title_en":   item.TitleEn,
			"sort_order": item.SortOrder,
			"is_visible": item.IsVisible,
		})
	}
	// Return updated list
	var updated []HomepageModule
	h.db.Order("sort_order ASC").Find(&updated)
	response.Success(c, updated)
}

// ============================
// Helpers
// ============================

func parseID(c *gin.Context) uint {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return 0
	}
	return uint(id)
}

func defaultStatus(s string) string {
	if s != "" {
		return s
	}
	return "active"
}
