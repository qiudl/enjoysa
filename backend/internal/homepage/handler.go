package homepage

import (
	"encoding/json"
	"strconv"

	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
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

type ModuleCreateRequest struct {
	ModuleKey string `json:"module_key" binding:"required"`
	TitleZh   string `json:"title_zh"`
	TitleEn   string `json:"title_en"`
	SortOrder int    `json:"sort_order"`
	IsVisible bool   `json:"is_visible"`
	Config    string `json:"config"`
}

func (h *Handler) CreateModule(c *gin.Context) {
	var req ModuleCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	cfg := req.Config
	if cfg == "" {
		cfg = "{}"
	}
	item := HomepageModule{
		ModuleKey: req.ModuleKey, TitleZh: req.TitleZh, TitleEn: req.TitleEn,
		SortOrder: req.SortOrder, IsVisible: req.IsVisible,
		Config: datatypes.JSON([]byte(cfg)),
	}
	if err := h.db.Create(&item).Error; err != nil {
		response.ServerError(c, "Failed to create module")
		return
	}
	response.Created(c, item)
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
// Public: One-time Init (no auth)
// ============================

// InitHomepage seeds default homepage data if tables are empty. Idempotent — skips if data exists.
func (h *Handler) InitHomepage(c *gin.Context) {
	var moduleCount int64
	h.db.Model(&HomepageModule{}).Count(&moduleCount)
	if moduleCount > 0 {
		response.Success(c, gin.H{"message": "Homepage data already exists", "skipped": true})
		return
	}

	// Modules
	popularCfg := datatypes.JSON([]byte(`{"limit":8}`))
	modules := []HomepageModule{
		{ModuleKey: "banner", TitleZh: "轮播横幅", TitleEn: "Banner", SortOrder: 1, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "search", TitleZh: "搜索", TitleEn: "Search", SortOrder: 2, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "regions", TitleZh: "热门目的地", TitleEn: "Popular Destinations", SortOrder: 3, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "featured", TitleZh: "精选产品", TitleEn: "Featured Products", SortOrder: 4, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "categories", TitleZh: "体验分类", TitleEn: "Categories", SortOrder: 5, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "features", TitleZh: "为什么选择我们", TitleEn: "Why Choose Us", SortOrder: 6, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "testimonials", TitleZh: "用户评价", TitleEn: "Testimonials", SortOrder: 7, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "partners", TitleZh: "合作伙伴", TitleEn: "Our Partners", SortOrder: 8, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "popular", TitleZh: "热门活动", TitleEn: "Popular Activities", SortOrder: 9, IsVisible: true, Config: popularCfg},
	}
	h.db.Create(&modules)

	// Features
	features := []HomepageFeature{
		{Icon: "🇨🇳", TitleZh: "本地专家", TitleEn: "Local Expert", DescZh: "深耕南澳多年，为您提供最地道的旅行体验", DescEn: "Years of local expertise to provide the most authentic travel experience", SortOrder: 1, Status: "active"},
		{Icon: "💳", TitleZh: "超值价格", TitleEn: "Best Price", DescZh: "直连供应商，去除中间环节，享受最优价格", DescEn: "Direct supplier connections, no middlemen, enjoy the best prices", SortOrder: 2, Status: "active"},
		{Icon: "⭐", TitleZh: "轻松预订", TitleEn: "Easy Booking", DescZh: "即时确认，灵活取消，中文客服全程支持", DescEn: "Instant confirmation, flexible cancellation, bilingual support", SortOrder: 3, Status: "active"},
		{Icon: "💰", TitleZh: "全天候服务", TitleEn: "24/7 Support", DescZh: "中英文双语客服，随时解答您的旅行疑问", DescEn: "Bilingual support team, always ready to assist with your travel needs", SortOrder: 4, Status: "active"},
	}
	h.db.Create(&features)

	// Testimonials
	testimonials := []HomepageTestimonial{
		{Source: "manual", AuthorName: "王小明", ContentZh: "袋鼠岛一日游太棒了！导游非常专业，还帮我们拍了很多好看的照片。强烈推荐！", ContentEn: "The Kangaroo Island day tour was amazing! The guide was very professional and took many great photos for us. Highly recommended!", Rating: 5, ProductNameZh: "袋鼠岛一日游", ProductNameEn: "Kangaroo Island Day Tour", SortOrder: 1, Status: "active"},
		{Source: "manual", AuthorName: "Sarah Chen", ContentZh: "巴罗萨酒庄之旅让我和朋友们度过了愉快的一天，品尝了很多优质葡萄酒，还参观了酒庄的酿造过程。", ContentEn: "The Barossa winery tour gave my friends and I a wonderful day. We tasted many quality wines and toured the winemaking process.", Rating: 5, ProductNameZh: "巴罗萨酒庄一日游", ProductNameEn: "Barossa Valley Wine Tour", SortOrder: 2, Status: "active"},
		{Source: "manual", AuthorName: "李婷", ContentZh: "带孩子参加了野生动物园半日游，孩子们特别开心，近距离接触了考拉和袋鼠。客服沟通也非常及时。", ContentEn: "Took the kids on the wildlife park half-day tour. They were so happy to get up close with koalas and kangaroos. Customer service was very responsive.", Rating: 5, ProductNameZh: "克莱兰德野生动物园", ProductNameEn: "Cleland Wildlife Park", SortOrder: 3, Status: "active"},
		{Source: "manual", AuthorName: "Mike Zhang", ContentZh: "阿德莱德城市徒步游很有意义，了解了很多历史文化。价格也很合理，性价比很高。", ContentEn: "The Adelaide city walking tour was very meaningful, learned a lot about history and culture. Great value for money.", Rating: 4, ProductNameZh: "阿德莱德城市徒步", ProductNameEn: "Adelaide City Walking Tour", SortOrder: 4, Status: "active"},
	}
	h.db.Create(&testimonials)

	// Partners
	partners := []HomepagePartner{
		{Name: "South Australian Tourism Commission", Logo: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=80&fit=crop", Website: "https://southaustralia.com", SortOrder: 1, Status: "active"},
		{Name: "Tourism Australia", Logo: "https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=200&h=80&fit=crop", Website: "https://tourism.australia.com", SortOrder: 2, Status: "active"},
		{Name: "Adelaide Airport", Logo: "https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=200&h=80&fit=crop", Website: "https://adelaideairport.com.au", SortOrder: 3, Status: "active"},
		{Name: "Kangaroo Island Tours", Logo: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=200&h=80&fit=crop", Website: "https://kangarooisland.sa.gov.au", SortOrder: 4, Status: "active"},
		{Name: "Barossa Wine Region", Logo: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200&h=80&fit=crop", Website: "https://barossa.com", SortOrder: 5, Status: "active"},
	}
	h.db.Create(&partners)

	response.Success(c, gin.H{
		"message":       "Homepage data initialized",
		"modules":       len(modules),
		"features":      len(features),
		"testimonials":  len(testimonials),
		"partners":      len(partners),
	})
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
