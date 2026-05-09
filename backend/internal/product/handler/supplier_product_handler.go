package handler

import (
	"errors"
	"strconv"
	"time"

	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/product/model"
	"enjoysa-backend/internal/product/store"
	"enjoysa-backend/internal/translation"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SupplierProductHandler struct {
	productStore  *store.ProductStore
	scheduleStore *store.ScheduleStore
	regionStore   *store.RegionStore
	// translation is optional; when set, SubmitForReview enqueues an EN→ZH
	// translation task in the same transaction so the supplier sees a
	// Chinese preview shortly after submitting.
	translation *translation.Service
}

func NewSupplierProductHandler(
	productStore *store.ProductStore,
	scheduleStore *store.ScheduleStore,
	regionStore *store.RegionStore,
) *SupplierProductHandler {
	return &SupplierProductHandler{
		productStore:  productStore,
		scheduleStore: scheduleStore,
		regionStore:   regionStore,
	}
}

// SetTranslationService wires up the AI translation pipeline. Optional so
// tests and minimal builds can run without LLM access.
func (h *SupplierProductHandler) SetTranslationService(ts *translation.Service) {
	h.translation = ts
}

func (h *SupplierProductHandler) getSupplierID(c *gin.Context) uint {
	id, _ := c.Get("supplier_id")
	return id.(uint)
}

// ProductWithStock 带库存信息的产品
type ProductWithStock struct {
	model.Product
	TotalStock     int `json:"total_stock"`
	AvailableStock int `json:"available_stock"`
}

func (h *SupplierProductHandler) ListProducts(c *gin.Context) {
	supplierID := h.getSupplierID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	products, total, err := h.productStore.ListBySupplier(supplierID, store.ProductFilter{
		Status:   status,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list products")
		return
	}

	// Collect product IDs and query stock
	productIDs := make([]uint, len(products))
	for i, p := range products {
		productIDs[i] = p.ID
	}

	stockMap, _ := h.scheduleStore.GetStockByProductIDs(productIDs)

	// Build response with stock info
	result := make([]ProductWithStock, len(products))
	for i, p := range products {
		item := ProductWithStock{Product: p}
		if stock, ok := stockMap[p.ID]; ok {
			item.TotalStock = stock.TotalSlots
			item.AvailableStock = stock.TotalSlots - stock.BookedSlots
		}
		result[i] = item
	}

	response.Paginated(c, result, total, page, pageSize)
}

type CreateProductRequest struct {
	// REQ-20260509-0015: 双向 AI 翻译要求允许"只填一种语言"，所以这里
	// 不能再用 binding:"required"。改用 ValidateAtLeastOneName() 在 handler
	// 入口校验"至少填一种"，缺失的那一边由 maybeEnqueueZhToEn /
	// maybeEnqueueEnToZh 自动翻译补齐。
	NameZh        string  `json:"name_zh"`
	NameEn        string  `json:"name_en"`
	RegionID      uint    `json:"region_id"`
	CategoryID    uint    `json:"category_id"`
	PriceFrom     float64 `json:"price_from"`
	SummaryZh     string  `json:"summary_zh"`
	SummaryEn     string  `json:"summary_en"`
	DescriptionZh string  `json:"description_zh"`
	DescriptionEn string  `json:"description_en"`
	AddressZh     string  `json:"address_zh"`
	AddressEn     string  `json:"address_en"`
	Duration      string  `json:"duration"`
	GroupSize     string  `json:"group_size"`
	Tags          string  `json:"tags"`

	Images     []CreateImageRequest     `json:"images"`
	Packages   []CreatePackageRequest   `json:"packages"`
	Highlights []CreateHighlightRequest `json:"highlights"`
	FAQs       []CreateFAQRequest       `json:"faqs"`
}

// ValidateAtLeastOneName enforces the bidirectional-translation rule from
// REQ-20260509-0015: at least one of name_zh / name_en must be non-empty so
// the AI translator has source material to fill the missing side from.
// Empty-both is the only blocked state — the rest of the form (summary /
// description / address) can stay empty and inherit translation later.
func (r *CreateProductRequest) ValidateAtLeastOneName() error {
	if r.NameZh == "" && r.NameEn == "" {
		return errors.New("at least one of name_zh or name_en is required")
	}
	return nil
}

type CreateImageRequest struct {
	URL       string `json:"url" binding:"required"`
	SortOrder int    `json:"sort_order"`
	IsCover   bool   `json:"is_cover"`
}

// StockTotalOrUnlimited (REQ-20260509-0035): missing pointer = -1 (unlimited),
// preserves backwards compatibility for clients that don't send the field.
func StockTotalOrUnlimited(p *int) int {
	if p == nil {
		return -1
	}
	return *p
}

type CreatePackageRequest struct {
	NameZh    string  `json:"name_zh" binding:"required"`
	NameEn    string  `json:"name_en" binding:"required"`
	DescZh    string  `json:"desc_zh"`
	DescEn    string  `json:"desc_en"`
	Price     float64 `json:"price" binding:"required"`
	SortOrder int     `json:"sort_order"`
	// REQ-20260509-0035: stock_total. -1 = 无限量。前端不发即默认 -1（不限量
	// 兼容历史商品，零回归）。stock_sold 不在请求里——服务端自己维护。
	StockTotal *int `json:"stock_total,omitempty"`
}

type CreateHighlightRequest struct {
	TitleZh   string `json:"title_zh"`
	TitleEn   string `json:"title_en"`
	DescZh    string `json:"desc_zh"`
	DescEn    string `json:"desc_en"`
	SortOrder int    `json:"sort_order"`
}

type CreateFAQRequest struct {
	QuestionZh string `json:"question_zh"`
	QuestionEn string `json:"question_en"`
	AnswerZh   string `json:"answer_zh"`
	AnswerEn   string `json:"answer_en"`
	SortOrder  int    `json:"sort_order"`
}

func (h *SupplierProductHandler) CreateProduct(c *gin.Context) {
	supplierID := h.getSupplierID(c)

	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if err := req.ValidateAtLeastOneName(); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	// REQ-20260509-0015 G6 hotfix: region/category 是 FK，AI 不会填；
	// 兜底挡掉 0 值避免 GORM 报 fk_products_region 500。
	if req.RegionID == 0 || req.CategoryID == 0 {
		response.BadRequest(c, "region_id and category_id are required")
		return
	}

	product := &model.Product{
		NameZh:        req.NameZh,
		NameEn:        req.NameEn,
		SupplierID:    supplierID,
		RegionID:      req.RegionID,
		CategoryID:    req.CategoryID,
		PriceFrom:     req.PriceFrom,
		SummaryZh:     req.SummaryZh,
		SummaryEn:     req.SummaryEn,
		DescriptionZh: req.DescriptionZh,
		DescriptionEn: req.DescriptionEn,
		AddressZh:     req.AddressZh,
		AddressEn:     req.AddressEn,
		Duration:      req.Duration,
		GroupSize:     req.GroupSize,
		Tags:          req.Tags,
		Status:        model.ProductStatusDraft,
	}

	for _, img := range req.Images {
		product.Images = append(product.Images, model.ProductImage{
			URL:       img.URL,
			SortOrder: img.SortOrder,
			IsCover:   img.IsCover,
		})
	}
	for _, pkg := range req.Packages {
		product.Packages = append(product.Packages, model.ProductPackage{
			NameZh:     pkg.NameZh,
			NameEn:     pkg.NameEn,
			DescZh:     pkg.DescZh,
			DescEn:     pkg.DescEn,
			Price:      pkg.Price,
			SortOrder:  pkg.SortOrder,
			StockTotal: StockTotalOrUnlimited(pkg.StockTotal),
			// StockSold defaults to 0 for new packages (REQ-20260509-0035)
		})
	}
	for _, hl := range req.Highlights {
		product.Highlights = append(product.Highlights, model.ProductHighlight{
			TitleZh:   hl.TitleZh,
			TitleEn:   hl.TitleEn,
			DescZh:    hl.DescZh,
			DescEn:    hl.DescEn,
			SortOrder: hl.SortOrder,
		})
	}
	for _, faq := range req.FAQs {
		product.FAQs = append(product.FAQs, model.ProductFAQ{
			QuestionZh: faq.QuestionZh,
			QuestionEn: faq.QuestionEn,
			AnswerZh:   faq.AnswerZh,
			AnswerEn:   faq.AnswerEn,
			SortOrder:  faq.SortOrder,
		})
	}

	if err := h.productStore.Create(product); err != nil {
		response.ServerError(c, "Failed to create product")
		return
	}

	// Reload with associations
	product, _ = h.productStore.GetByID(product.ID)
	response.Created(c, product)
}

func (h *SupplierProductHandler) GetProduct(c *gin.Context) {
	supplierID := h.getSupplierID(c)
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

	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	// REQ-20260509-0019: 在 admin 代录场景下补上 admin 姓名，让供应商看到
	// "Created by ${admin} on ${date}" 而不是裸的 created_by_admin_id。
	h.productStore.PopulateCreatedByAdminName(product)

	response.Success(c, product)
}

func (h *SupplierProductHandler) UpdateProduct(c *gin.Context) {
	supplierID := h.getSupplierID(c)
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
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if err := req.ValidateAtLeastOneName(); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if req.RegionID == 0 || req.CategoryID == 0 {
		response.BadRequest(c, "region_id and category_id are required")
		return
	}

	product.NameZh = req.NameZh
	product.NameEn = req.NameEn
	product.RegionID = req.RegionID
	product.CategoryID = req.CategoryID
	product.PriceFrom = req.PriceFrom
	product.SummaryZh = req.SummaryZh
	product.SummaryEn = req.SummaryEn
	product.DescriptionZh = req.DescriptionZh
	product.DescriptionEn = req.DescriptionEn
	product.AddressZh = req.AddressZh
	product.AddressEn = req.AddressEn
	product.Duration = req.Duration
	product.GroupSize = req.GroupSize
	if req.Tags != "" {
		product.Tags = req.Tags
	}

	// REQ-20260509-0035: snapshot stock_sold by (name_zh, name_en) fingerprint
	// before delete-recreate so admin/supplier edits don't zero out actual sales.
	// Limitation: 重命名 package 会丢失 stock_sold（fingerprint 不再匹配）——
	// Phase 2 改成 update-in-place 时移除该 limitation。
	oldStockSold := make(map[string]int, len(product.Packages))
	for _, p := range product.Packages {
		if p.StockTotal != -1 {
			oldStockSold[p.NameZh+"|"+p.NameEn] = p.StockSold
		}
	}

	// Delete old related and re-create
	h.productStore.DeleteRelated(product.ID)

	product.Images = nil
	product.Packages = nil
	product.Highlights = nil
	product.FAQs = nil

	for _, img := range req.Images {
		product.Images = append(product.Images, model.ProductImage{
			ProductID: product.ID,
			URL:       img.URL,
			SortOrder: img.SortOrder,
			IsCover:   img.IsCover,
		})
	}
	for _, pkg := range req.Packages {
		newPkg := model.ProductPackage{
			ProductID:  product.ID,
			NameZh:     pkg.NameZh,
			NameEn:     pkg.NameEn,
			DescZh:     pkg.DescZh,
			DescEn:     pkg.DescEn,
			Price:      pkg.Price,
			SortOrder:  pkg.SortOrder,
			StockTotal: StockTotalOrUnlimited(pkg.StockTotal),
		}
		if sold, ok := oldStockSold[pkg.NameZh+"|"+pkg.NameEn]; ok {
			newPkg.StockSold = sold
		}
		product.Packages = append(product.Packages, newPkg)
	}
	for _, hl := range req.Highlights {
		product.Highlights = append(product.Highlights, model.ProductHighlight{
			ProductID: product.ID,
			TitleZh:   hl.TitleZh,
			TitleEn:   hl.TitleEn,
			DescZh:    hl.DescZh,
			DescEn:    hl.DescEn,
			SortOrder: hl.SortOrder,
		})
	}
	for _, faq := range req.FAQs {
		product.FAQs = append(product.FAQs, model.ProductFAQ{
			ProductID:  product.ID,
			QuestionZh: faq.QuestionZh,
			QuestionEn: faq.QuestionEn,
			AnswerZh:   faq.AnswerZh,
			AnswerEn:   faq.AnswerEn,
			SortOrder:  faq.SortOrder,
		})
	}

	if err := h.productStore.Update(product); err != nil {
		response.ServerError(c, "Failed to update product")
		return
	}

	product, _ = h.productStore.GetByID(product.ID)
	response.Success(c, product)
}

func (h *SupplierProductHandler) DeleteProduct(c *gin.Context) {
	supplierID := h.getSupplierID(c)
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
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	regionID := product.RegionID

	h.productStore.DeleteRelated(product.ID)
	if err := h.productStore.Delete(product.ID); err != nil {
		response.ServerError(c, "Failed to delete product")
		return
	}

	// Update region attraction count
	if regionID > 0 {
		h.regionStore.UpdateAttractionCount(regionID)
	}

	response.SuccessMessage(c, "Product deleted")
}

func (h *SupplierProductHandler) SubmitForReview(c *gin.Context) {
	supplierID := h.getSupplierID(c)
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
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}
	if product.Status != model.ProductStatusDraft && product.Status != model.ProductStatusRejected {
		response.BadRequest(c, "Product cannot be submitted in current status")
		return
	}

	// Flip status and enqueue translation in a single transaction so a crash
	// can never leave a "pending" product without a translation task (or a
	// task referencing a still-draft product).
	var taskID uint
	err = h.productStore.DB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Product{}).Where("id = ?", product.ID).
			Update("status", model.ProductStatusPending).Error; err != nil {
			return err
		}
		if h.translation == nil {
			return nil
		}
		fields := translationFieldsFromProduct(product)
		if !hasTranslatableContent(fields) {
			// Skip enqueue when there is nothing to translate (all-empty EN).
			return nil
		}
		task, err := h.translation.EnqueueProductTranslationInTx(tx, product.ID, supplierID, fields)
		if err != nil {
			return err
		}
		taskID = task.ID
		return nil
	})
	if err != nil {
		logger.Errorf("submit product %d failed: %v", product.ID, err)
		response.ServerError(c, "Failed to submit product")
		return
	}

	response.Success(c, gin.H{
		"message":             "Product submitted for review",
		"translation_task_id": taskID,
	})
}

// translationFieldsFromProduct extracts the EN-side text fields the LLM
// translates into Chinese. Keep keys in sync with
// product/store.translatedColumnByKey so writes round-trip cleanly.
func translationFieldsFromProduct(p *model.Product) map[string]string {
	return map[string]string{
		"name":        p.NameEn,
		"summary":     p.SummaryEn,
		"description": p.DescriptionEn,
		"address":     p.AddressEn,
	}
}

func hasTranslatableContent(fields map[string]string) bool {
	for _, v := range fields {
		if v != "" {
			return true
		}
	}
	return false
}

func (h *SupplierProductHandler) Offline(c *gin.Context) {
	supplierID := h.getSupplierID(c)
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
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	if err := h.productStore.UpdateStatus(product.ID, model.ProductStatusOffline); err != nil {
		response.ServerError(c, "Failed to set product offline")
		return
	}

	// Update region attraction count
	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	response.SuccessMessage(c, "Product set offline")
}

func (h *SupplierProductHandler) Online(c *gin.Context) {
	supplierID := h.getSupplierID(c)
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
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}
	if product.Status != model.ProductStatusOffline {
		response.BadRequest(c, "Product can only go online from offline status")
		return
	}

	if err := h.productStore.UpdateStatus(product.ID, model.ProductStatusApproved); err != nil {
		response.ServerError(c, "Failed to set product online")
		return
	}

	// Update region attraction count
	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	response.SuccessMessage(c, "Product set online")
}

// === Schedule management ===

type CreateScheduleRequest struct {
	PackageID  uint     `json:"package_id"`
	Date       string   `json:"date" binding:"required"`
	TimeSlot   string   `json:"time_slot"`
	TotalSlots int      `json:"total_slots" binding:"required"`
	Price      *float64 `json:"price"`
}

func (h *SupplierProductHandler) CreateSchedule(c *gin.Context) {
	supplierID := h.getSupplierID(c)
	productID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	var req CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		response.BadRequest(c, "Invalid date format, use YYYY-MM-DD")
		return
	}

	schedule := &model.ProductSchedule{
		ProductID:  uint(productID),
		PackageID:  req.PackageID,
		Date:       date,
		TimeSlot:   req.TimeSlot,
		TotalSlots: req.TotalSlots,
		Price:      req.Price,
		Status:     "available",
	}

	if err := h.scheduleStore.Create(schedule); err != nil {
		response.ServerError(c, "Failed to create schedule")
		return
	}

	response.Created(c, schedule)
}

type BatchScheduleRequest struct {
	Schedules []CreateScheduleRequest `json:"schedules" binding:"required"`
}

func (h *SupplierProductHandler) BatchCreateSchedules(c *gin.Context) {
	supplierID := h.getSupplierID(c)
	productID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	var req BatchScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	var schedules []model.ProductSchedule
	for _, s := range req.Schedules {
		date, err := time.Parse("2006-01-02", s.Date)
		if err != nil {
			response.BadRequest(c, "Invalid date format: "+s.Date)
			return
		}
		schedules = append(schedules, model.ProductSchedule{
			ProductID:  uint(productID),
			PackageID:  s.PackageID,
			Date:       date,
			TimeSlot:   s.TimeSlot,
			TotalSlots: s.TotalSlots,
			Price:      s.Price,
			Status:     "available",
		})
	}

	if err := h.scheduleStore.BatchCreate(schedules); err != nil {
		response.ServerError(c, "Failed to create schedules")
		return
	}

	response.Created(c, schedules)
}

func (h *SupplierProductHandler) UpdateSchedule(c *gin.Context) {
	supplierID := h.getSupplierID(c)
	productID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	scheduleID, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid schedule ID")
		return
	}

	schedule, err := h.scheduleStore.GetByID(uint(scheduleID))
	if err != nil {
		response.NotFound(c, "Schedule not found")
		return
	}
	if schedule.ProductID != uint(productID) {
		response.Forbidden(c, "Access denied")
		return
	}

	var req CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.Date != "" {
		date, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			response.BadRequest(c, "Invalid date format")
			return
		}
		schedule.Date = date
	}
	if req.TimeSlot != "" {
		schedule.TimeSlot = req.TimeSlot
	}
	if req.TotalSlots > 0 {
		schedule.TotalSlots = req.TotalSlots
	}
	if req.Price != nil {
		schedule.Price = req.Price
	}

	if err := h.scheduleStore.Update(schedule); err != nil {
		response.ServerError(c, "Failed to update schedule")
		return
	}

	response.Success(c, schedule)
}

func (h *SupplierProductHandler) DeleteSchedule(c *gin.Context) {
	supplierID := h.getSupplierID(c)
	productID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	scheduleID, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid schedule ID")
		return
	}

	schedule, err := h.scheduleStore.GetByID(uint(scheduleID))
	if err != nil {
		response.NotFound(c, "Schedule not found")
		return
	}
	if schedule.ProductID != uint(productID) {
		response.Forbidden(c, "Access denied")
		return
	}

	if err := h.scheduleStore.Delete(schedule.ID); err != nil {
		response.ServerError(c, "Failed to delete schedule")
		return
	}

	response.SuccessMessage(c, "Schedule deleted")
}

// BatchAction 产品批量操作（上架/下架/删除）
func (h *SupplierProductHandler) BatchAction(c *gin.Context) {
	supplierID := h.getSupplierID(c)

	var req struct {
		Action     string `json:"action" binding:"required,oneof=online offline delete"`
		ProductIDs []uint `json:"product_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if len(req.ProductIDs) > 50 {
		response.BadRequest(c, "Maximum 50 products per batch")
		return
	}

	type result struct {
		ID      uint   `json:"id"`
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	results := make([]result, 0, len(req.ProductIDs))

	for _, pid := range req.ProductIDs {
		product, err := h.productStore.GetByID(pid)
		if err != nil {
			results = append(results, result{pid, false, "Product not found"})
			continue
		}
		if product.SupplierID != supplierID {
			results = append(results, result{pid, false, "Access denied"})
			continue
		}

		switch req.Action {
		case "online":
			if product.Status != model.ProductStatusOffline {
				results = append(results, result{pid, false, "Can only go online from offline status"})
				continue
			}
			h.productStore.UpdateStatus(pid, model.ProductStatusApproved)
		case "offline":
			if product.Status != model.ProductStatusApproved {
				results = append(results, result{pid, false, "Can only go offline from approved status"})
				continue
			}
			h.productStore.UpdateStatus(pid, model.ProductStatusOffline)
		case "delete":
			if product.Status != model.ProductStatusDraft && product.Status != model.ProductStatusRejected {
				results = append(results, result{pid, false, "Can only delete draft or rejected products"})
				continue
			}
			h.productStore.DeleteRelated(pid)
			h.productStore.Delete(pid)
		}
		results = append(results, result{pid, true, "OK"})
	}

	response.Success(c, results)
}

// BatchDeleteSchedules 排期批量删除
func (h *SupplierProductHandler) BatchDeleteSchedules(c *gin.Context) {
	supplierID := h.getSupplierID(c)
	productID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	var req struct {
		ScheduleIDs []uint `json:"schedule_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if len(req.ScheduleIDs) > 100 {
		response.BadRequest(c, "Maximum 100 schedules per batch")
		return
	}

	deleted, hasBookings, err := h.scheduleStore.BatchDeleteByProduct(req.ScheduleIDs, uint(productID))
	if err != nil {
		response.ServerError(c, "Failed to delete schedules")
		return
	}

	response.Success(c, gin.H{
		"deleted":      deleted,
		"has_bookings": hasBookings,
		"message":      "Batch delete completed",
	})
}

// ScheduleCalendar 排期日历聚合数据
func (h *SupplierProductHandler) ScheduleCalendar(c *gin.Context) {
	supplierID := h.getSupplierID(c)
	productID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	month := c.DefaultQuery("month", time.Now().Format("2006-01"))
	items, err := h.scheduleStore.CalendarSummary(uint(productID), month)
	if err != nil {
		response.ServerError(c, "Failed to get calendar data")
		return
	}

	response.Success(c, items)
}

// ScheduleAlerts 库存预警
func (h *SupplierProductHandler) ScheduleAlerts(c *gin.Context) {
	supplierID := h.getSupplierID(c)

	lowStock, soldOut, err := h.scheduleStore.GetAlerts(supplierID)
	if err != nil {
		response.ServerError(c, "Failed to get alerts")
		return
	}

	response.Success(c, gin.H{
		"low_stock": lowStock,
		"sold_out":  soldOut,
	})
}
