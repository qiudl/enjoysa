package handler

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"enjoysa-backend/internal/audit"
	auditstore "enjoysa-backend/internal/audit/store"
	authmodel "enjoysa-backend/internal/auth/model"
	authstore "enjoysa-backend/internal/auth/store"
	"enjoysa-backend/internal/models"
	notifservice "enjoysa-backend/internal/notification/service"
	ordermodel "enjoysa-backend/internal/order/model"
	orderstore "enjoysa-backend/internal/order/store"
	producthandler "enjoysa-backend/internal/product/handler"
	productmodel "enjoysa-backend/internal/product/model"
	productstore "enjoysa-backend/internal/product/store"
	reviewstore "enjoysa-backend/internal/review/store"
	settlementstore "enjoysa-backend/internal/settlement/store"
	supplierauditstore "enjoysa-backend/internal/supplier/store"
	"enjoysa-backend/internal/supplier/tier"
	"enjoysa-backend/internal/translation"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db                 *gorm.DB
	adminStore         *authstore.AdminStore
	userStore          *authstore.UserStore
	orderStore         *orderstore.OrderStore
	productStore       *productstore.ProductStore
	regionStore        *productstore.RegionStore
	categoryStore      *productstore.CategoryStore
	audit              *audit.Logger
	notifSvc           *notifservice.NotificationService
	auditStore         *auditstore.AuditStore
	reviewStore        *reviewstore.ReviewStore
	settlementStore    *settlementstore.SettlementStore
	supplierAuditStore *supplierauditstore.AuditLogStore

	// translationSvc is the optional ZH→EN translator wired via
	// SetTranslationService (REQ-20260509-0004). When unset, admin
	// product Create/Update is unchanged — useful for tests that don't
	// care about the translation pipeline.
	translationSvc *translation.Service
}

// SetTranslationService wires the ZH→EN translator that admin Create /
// UpdateProduct fires after a successful save. Optional — leaving it nil
// preserves the pre-REQ-0004 behaviour.
func (h *AdminHandler) SetTranslationService(svc *translation.Service) {
	h.translationSvc = svc
}

func NewAdminHandler(
	db *gorm.DB,
	adminStore *authstore.AdminStore,
	userStore *authstore.UserStore,
	orderStore *orderstore.OrderStore,
	productStore *productstore.ProductStore,
	regionStore *productstore.RegionStore,
	categoryStore *productstore.CategoryStore,
	auditLogger *audit.Logger,
	notifSvc *notifservice.NotificationService,
	aStore *auditstore.AuditStore,
	rvStore *reviewstore.ReviewStore,
	slStore *settlementstore.SettlementStore,
	saStore *supplierauditstore.AuditLogStore,
) *AdminHandler {
	return &AdminHandler{
		db:                 db,
		adminStore:         adminStore,
		userStore:          userStore,
		orderStore:         orderStore,
		productStore:       productStore,
		regionStore:        regionStore,
		categoryStore:      categoryStore,
		audit:              auditLogger,
		notifSvc:           notifSvc,
		auditStore:         aStore,
		reviewStore:        rvStore,
		settlementStore:    slStore,
		supplierAuditStore: saStore,
	}
}

// === Dashboard ===

func (h *AdminHandler) DashboardStats(c *gin.Context) {
	var userCount, supplierCount, productCount, orderCount int64
	var totalRevenue float64

	h.db.Model(&models.User{}).Count(&userCount)
	h.db.Model(&models.Supplier{}).Count(&supplierCount)
	h.db.Model(&productmodel.Product{}).Count(&productCount)
	h.db.Raw("SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL").Scan(&orderCount)
	h.db.Raw("SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE status = 'completed' AND deleted_at IS NULL").Scan(&totalRevenue)

	var pendingSuppliers, pendingProducts int64
	h.db.Model(&models.Supplier{}).Where("status = ?", "pending").Count(&pendingSuppliers)
	h.db.Raw("SELECT COUNT(*) FROM products WHERE status = 'pending' AND deleted_at IS NULL").Scan(&pendingProducts)

	response.Success(c, gin.H{
		"users":             userCount,
		"suppliers":         supplierCount,
		"products":          productCount,
		"orders":            orderCount,
		"total_revenue":     totalRevenue,
		"pending_suppliers": pendingSuppliers,
		"pending_products":  pendingProducts,
	})
}

// === Supplier Management ===

// SupplierWithStats wraps supplier with aggregated counts
type SupplierWithStats struct {
	models.Supplier
	ProductCount int     `json:"product_count"`
	OrderCount   int     `json:"order_count"`
	Revenue      float64 `json:"revenue"`
	AvgRating    float64 `json:"avg_rating"`
	ReviewCount  int     `json:"review_count"`
}

func (h *AdminHandler) ListSuppliers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	supplierType := c.Query("type")
	keyword := c.Query("keyword")
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortOrder := c.DefaultQuery("sort_order", "desc")

	var suppliers []models.Supplier
	var total int64

	query := h.db.Model(&models.Supplier{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if supplierType != "" {
		query = query.Where("type = ?", supplierType)
	}
	if keyword != "" {
		kw := "%" + keyword + "%"
		query = query.Where("name ILIKE ? OR email ILIKE ?", kw, kw)
	}
	query.Count(&total)

	offset := (page - 1) * pageSize
	// Default sort by id DESC; will re-sort by aggregated fields below if needed
	query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&suppliers)

	// Aggregate product and order counts per supplier
	supplierIDs := make([]uint, len(suppliers))
	for i, s := range suppliers {
		supplierIDs[i] = s.ID
	}

	type countItem struct {
		SupplierID uint `json:"supplier_id"`
		Count      int  `json:"count"`
	}
	type revenueItem struct {
		SupplierID uint    `json:"supplier_id"`
		Revenue    float64 `json:"revenue"`
	}

	productCounts := make(map[uint]int)
	orderCounts := make(map[uint]int)
	revenues := make(map[uint]float64)

	if len(supplierIDs) > 0 {
		var pCounts []countItem
		h.db.Raw(`SELECT supplier_id, COUNT(*) as count FROM products
			WHERE supplier_id IN ? AND deleted_at IS NULL GROUP BY supplier_id`, supplierIDs).Scan(&pCounts)
		for _, pc := range pCounts {
			productCounts[pc.SupplierID] = pc.Count
		}

		var oCounts []countItem
		h.db.Raw(`SELECT supplier_id, COUNT(*) as count FROM orders
			WHERE supplier_id IN ? AND deleted_at IS NULL GROUP BY supplier_id`, supplierIDs).Scan(&oCounts)
		for _, oc := range oCounts {
			orderCounts[oc.SupplierID] = oc.Count
		}

		var revs []revenueItem
		h.db.Raw(`SELECT supplier_id, COALESCE(SUM(total_price), 0) as revenue FROM orders
			WHERE supplier_id IN ? AND status = 'completed' AND deleted_at IS NULL GROUP BY supplier_id`, supplierIDs).Scan(&revs)
		for _, r := range revs {
			revenues[r.SupplierID] = r.Revenue
		}
	}

	result := make([]SupplierWithStats, len(suppliers))
	for i, s := range suppliers {
		result[i] = SupplierWithStats{
			Supplier:     s,
			ProductCount: productCounts[s.ID],
			OrderCount:   orderCounts[s.ID],
			Revenue:      revenues[s.ID],
			AvgRating:    s.Rating,
			ReviewCount:  s.ReviewCount,
		}
	}

	// Sort by aggregated field if requested
	if sortBy == "revenue" || sortBy == "orders" || sortBy == "rating" {
		isAsc := sortOrder == "asc"
		for i := 0; i < len(result); i++ {
			for j := i + 1; j < len(result); j++ {
				swap := false
				switch sortBy {
				case "revenue":
					swap = (isAsc && result[i].Revenue > result[j].Revenue) || (!isAsc && result[i].Revenue < result[j].Revenue)
				case "orders":
					swap = (isAsc && result[i].OrderCount > result[j].OrderCount) || (!isAsc && result[i].OrderCount < result[j].OrderCount)
				case "rating":
					swap = (isAsc && result[i].AvgRating > result[j].AvgRating) || (!isAsc && result[i].AvgRating < result[j].AvgRating)
				}
				if swap {
					result[i], result[j] = result[j], result[i]
				}
			}
		}
	}

	response.Paginated(c, result, total, page, pageSize)
}

func (h *AdminHandler) GetSupplier(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	var supplier models.Supplier
	if err := h.db.First(&supplier, uint(id)).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	// Get supplier users
	var users []models.SupplierUser
	h.db.Where("supplier_id = ?", supplier.ID).Find(&users)

	response.Success(c, gin.H{
		"supplier": supplier,
		"users":    users,
	})
}

func (h *AdminHandler) ApproveSupplier(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uint)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	var supplier models.Supplier
	if err := h.db.First(&supplier, uint(id)).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	now := time.Now()
	supplier.Status = "approved"
	supplier.ApprovedAt = &now
	supplier.ApprovedBy = &adminID

	if err := h.db.Save(&supplier).Error; err != nil {
		response.ServerError(c, "Failed to approve supplier")
		return
	}

	h.audit.Log(c, "approve", "supplier", supplier.ID, supplier.Name)
	response.SuccessMessage(c, "Supplier approved")
}

func (h *AdminHandler) RejectSupplier(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Reason is required")
		return
	}

	var supplier models.Supplier
	if err := h.db.First(&supplier, uint(id)).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	now := time.Now()
	supplier.Status = "rejected"
	supplier.RejectedAt = &now
	supplier.RejectReason = req.Reason

	if err := h.db.Save(&supplier).Error; err != nil {
		response.ServerError(c, "Failed to reject supplier")
		return
	}

	h.audit.Log(c, "reject", "supplier", supplier.ID, req.Reason)
	response.SuccessMessage(c, "Supplier rejected")
}

func (h *AdminHandler) SuspendSupplier(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	if err := h.db.Model(&models.Supplier{}).Where("id = ?", uint(id)).Update("status", "suspended").Error; err != nil {
		response.ServerError(c, "Failed to suspend supplier")
		return
	}

	response.SuccessMessage(c, "Supplier suspended")
}

// === Supplier Detail & Enhanced Operations ===

func (h *AdminHandler) GetSupplierDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	var supplier models.Supplier
	if err := h.db.First(&supplier, uint(id)).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	// Get supplier users
	var users []models.SupplierUser
	h.db.Where("supplier_id = ?", supplier.ID).Find(&users)

	// Get order stats
	orderStats, _ := h.orderStore.GetStats(supplier.ID)

	// Get settlement stats
	settlementStats, _ := h.settlementStore.SupplierStats(supplier.ID)

	// Count products
	var productCount, activeProducts int64
	h.db.Model(&productmodel.Product{}).Where("supplier_id = ? AND deleted_at IS NULL", supplier.ID).Count(&productCount)
	h.db.Model(&productmodel.Product{}).Where("supplier_id = ? AND status = 'approved' AND deleted_at IS NULL", supplier.ID).Count(&activeProducts)

	// Cancel rate
	cancelRate := 0.0
	if orderStats.Total > 0 {
		cancelRate = float64(orderStats.Cancelled) / float64(orderStats.Total) * 100
	}

	// Update tier lazily
	newTier := tier.Calculate(orderStats.Total, supplier.Rating, cancelRate)
	if newTier != supplier.Tier {
		supplier.Tier = newTier
		h.db.Model(&supplier).Update("tier", newTier)
	}

	pendingSettlement := 0.0
	if settlementStats != nil {
		if v, ok := settlementStats["pending_amount"]; ok {
			if f, ok := v.(float64); ok {
				pendingSettlement = f
			}
		}
	}

	response.Success(c, gin.H{
		"supplier": supplier,
		"users":    users,
		"stats": gin.H{
			"total_revenue":      orderStats.TotalAmount,
			"total_orders":       orderStats.Total,
			"avg_rating":         supplier.Rating,
			"cancel_rate":        cancelRate,
			"product_count":      productCount,
			"active_products":    activeProducts,
			"pending_settlement": pendingSettlement,
		},
	})
}

func (h *AdminHandler) GetSupplierProducts(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	products, total, err := h.productStore.ListBySupplier(uint(id), productstore.ProductFilter{
		Status:   status,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list products")
		return
	}

	response.Paginated(c, products, total, page, pageSize)
}

func (h *AdminHandler) GetSupplierOrders(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	orders, total, err := h.orderStore.List(orderstore.OrderFilter{
		SupplierID: uint(id),
		Status:     c.Query("status"),
		Keyword:    c.Query("keyword"),
		StartDate:  c.Query("start_date"),
		EndDate:    c.Query("end_date"),
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list orders")
		return
	}

	response.Paginated(c, orders, total, page, pageSize)
}

func (h *AdminHandler) GetSupplierSettlements(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	settlements, total, err := h.settlementStore.ListBySupplier(uint(id), page, pageSize)
	if err != nil {
		response.ServerError(c, "Failed to list settlements")
		return
	}

	response.Paginated(c, settlements, total, page, pageSize)
}

func (h *AdminHandler) GetSupplierSettlementStats(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	stats, err := h.settlementStore.SupplierStats(uint(id))
	if err != nil {
		response.ServerError(c, "Failed to get settlement stats")
		return
	}

	response.Success(c, stats)
}

func (h *AdminHandler) GetSupplierReviews(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	reviews, total, err := h.reviewStore.ListBySupplier(reviewstore.ReviewFilter{
		SupplierID: uint(id),
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list reviews")
		return
	}

	response.Paginated(c, reviews, total, page, pageSize)
}

// GetSupplierAuditLogs merges admin audit_logs and supplier_audit_logs
func (h *AdminHandler) GetSupplierAuditLogs(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	// Admin audit logs for this supplier
	adminLogs, _, _ := h.auditStore.ListByResource("supplier", uint(id), page, pageSize)

	// Supplier's own audit logs
	supplierLogs, _, _ := h.supplierAuditStore.List(supplierauditstore.AuditLogFilter{
		SupplierID: uint(id),
		Page:       page,
		PageSize:   pageSize,
	})

	// Merge into unified format
	type mergedLog struct {
		ID        uint      `json:"id"`
		Source    string    `json:"source"` // "admin" or "supplier"
		Action    string    `json:"action"`
		Detail    string    `json:"detail"`
		UserName  string    `json:"user_name"`
		CreatedAt time.Time `json:"created_at"`
	}

	var merged []mergedLog
	for _, l := range adminLogs {
		merged = append(merged, mergedLog{
			ID:        l.ID,
			Source:    "admin",
			Action:    l.Action,
			Detail:    l.Detail,
			UserName:  l.AdminName,
			CreatedAt: l.CreatedAt,
		})
	}
	for _, l := range supplierLogs {
		merged = append(merged, mergedLog{
			ID:        l.ID,
			Source:    "supplier",
			Action:    l.Action,
			Detail:    l.Detail,
			UserName:  l.UserName,
			CreatedAt: l.CreatedAt,
		})
	}

	// Sort by created_at DESC
	for i := 0; i < len(merged); i++ {
		for j := i + 1; j < len(merged); j++ {
			if merged[j].CreatedAt.After(merged[i].CreatedAt) {
				merged[i], merged[j] = merged[j], merged[i]
			}
		}
	}

	response.Success(c, gin.H{
		"items": merged,
		"total": len(merged),
	})
}

func (h *AdminHandler) ForceOfflineProduct(c *gin.Context) {
	supplierID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}
	productID, err := strconv.ParseUint(c.Param("pid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Reason is required")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil || product.SupplierID != uint(supplierID) {
		response.NotFound(c, "Product not found")
		return
	}

	if err := h.productStore.UpdateStatus(product.ID, productmodel.ProductStatusOffline); err != nil {
		response.ServerError(c, "Failed to force offline")
		return
	}

	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	h.audit.Log(c, "force_offline", "product", product.ID, req.Reason)

	if h.notifSvc != nil {
		_ = h.notifSvc.Send("supplier", product.SupplierID, "product_force_offline",
			"Product Forced Offline",
			fmt.Sprintf("Your product '%s' has been forced offline. Reason: %s", product.NameEn, req.Reason),
			"product", product.ID)
	}

	response.SuccessMessage(c, "Product forced offline")
}

func (h *AdminHandler) RestoreProduct(c *gin.Context) {
	supplierID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}
	productID, err := strconv.ParseUint(c.Param("pid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.productStore.GetByID(uint(productID))
	if err != nil || product.SupplierID != uint(supplierID) {
		response.NotFound(c, "Product not found")
		return
	}

	if err := h.productStore.UpdateStatus(product.ID, productmodel.ProductStatusApproved); err != nil {
		response.ServerError(c, "Failed to restore product")
		return
	}

	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	h.audit.Log(c, "restore", "product", product.ID, product.NameEn)

	if h.notifSvc != nil {
		_ = h.notifSvc.Send("supplier", product.SupplierID, "product_restored",
			"Product Restored",
			fmt.Sprintf("Your product '%s' has been restored and is now live", product.NameEn),
			"product", product.ID)
	}

	response.SuccessMessage(c, "Product restored")
}

type CreateSupplierRequest struct {
	Name            string `json:"name" binding:"required"`
	Type            string `json:"type" binding:"required"`
	Description     string `json:"description"`
	ContactName     string `json:"contact_name" binding:"required"`
	ContactPhone    string `json:"contact_phone" binding:"required"`
	ContactEmail    string `json:"contact_email" binding:"required,email"`
	Address         string `json:"address"`
	BusinessLicense string `json:"business_license"`
}

func generatePassword(length int) string {
	const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	result := make([]byte, length)
	for i := range result {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		result[i] = chars[n.Int64()]
	}
	return string(result)
}

func (h *AdminHandler) CreateSupplier(c *gin.Context) {
	var req CreateSupplierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Check if supplier email already exists
	var existCount int64
	h.db.Model(&models.Supplier{}).Where("email = ?", req.ContactEmail).Count(&existCount)
	if existCount > 0 {
		response.BadRequest(c, "Supplier email already registered")
		return
	}

	// Check if supplier user email already exists
	h.db.Model(&models.SupplierUser{}).Where("email = ?", req.ContactEmail).Count(&existCount)
	if existCount > 0 {
		response.BadRequest(c, "Contact email already registered as supplier user")
		return
	}

	initialPassword := generatePassword(10)
	hashedPwd, err := bcrypt.GenerateFromPassword([]byte(initialPassword), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "Failed to generate password")
		return
	}

	var supplier models.Supplier
	var supplierUser models.SupplierUser

	txErr := h.db.Transaction(func(tx *gorm.DB) error {
		supplier = models.Supplier{
			Name:            req.Name,
			Type:            req.Type,
			Status:          "pending",
			Description:     req.Description,
			Email:           req.ContactEmail,
			Phone:           req.ContactPhone,
			Address:         req.Address,
			BusinessLicense: req.BusinessLicense,
		}
		if err := tx.Create(&supplier).Error; err != nil {
			return err
		}

		supplierUser = models.SupplierUser{
			SupplierID: supplier.ID,
			Email:      req.ContactEmail,
			Password:   string(hashedPwd),
			Name:       req.ContactName,
			Phone:      req.ContactPhone,
			Role:       "admin",
			Status:     "active",
		}
		if err := tx.Create(&supplierUser).Error; err != nil {
			return err
		}
		return nil
	})

	if txErr != nil {
		response.ServerError(c, "Failed to create supplier")
		return
	}

	h.audit.Log(c, "create", "supplier", supplier.ID, supplier.Name)
	response.Created(c, gin.H{
		"supplier":         supplier,
		"initial_password": initialPassword,
	})
}

type UpdateSupplierRequest struct {
	Name            *string `json:"name"`
	Type            *string `json:"type"`
	Description     *string `json:"description"`
	Logo            *string `json:"logo"`
	Email           *string `json:"email"`
	Phone           *string `json:"phone"`
	Website         *string `json:"website"`
	Address         *string `json:"address"`
	City            *string `json:"city"`
	State           *string `json:"state"`
	PostalCode      *string `json:"postal_code"`
	BusinessLicense *string `json:"business_license"`
	TaxNumber       *string `json:"tax_number"`
	BankName        *string `json:"bank_name"`
	BankAccount     *string `json:"bank_account"`
	BankBSB         *string `json:"bank_bsb"`
	AccountHolder   *string `json:"account_holder"`
}

func (h *AdminHandler) UpdateSupplier(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	var supplier models.Supplier
	if err := h.db.First(&supplier, uint(id)).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	var req UpdateSupplierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	// Email uniqueness check + SupplierUser sync
	oldEmail := supplier.Email
	emailChanged := false
	if req.Email != nil && *req.Email != oldEmail {
		var count int64
		h.db.Model(&models.Supplier{}).Where("email = ? AND id != ?", *req.Email, supplier.ID).Count(&count)
		if count > 0 {
			response.BadRequest(c, "Email already in use by another supplier")
			return
		}
		emailChanged = true
	}

	if req.Name != nil {
		supplier.Name = *req.Name
	}
	if req.Type != nil {
		supplier.Type = *req.Type
	}
	if req.Description != nil {
		supplier.Description = *req.Description
	}
	if req.Logo != nil {
		supplier.Logo = *req.Logo
	}
	if req.Email != nil {
		supplier.Email = *req.Email
	}
	if req.Phone != nil {
		supplier.Phone = *req.Phone
	}
	if req.Website != nil {
		supplier.Website = *req.Website
	}
	if req.Address != nil {
		supplier.Address = *req.Address
	}
	if req.City != nil {
		supplier.City = *req.City
	}
	if req.State != nil {
		supplier.State = *req.State
	}
	if req.PostalCode != nil {
		supplier.PostalCode = *req.PostalCode
	}
	if req.BusinessLicense != nil {
		supplier.BusinessLicense = *req.BusinessLicense
	}
	if req.TaxNumber != nil {
		supplier.TaxNumber = *req.TaxNumber
	}
	if req.BankName != nil {
		supplier.BankName = *req.BankName
	}
	if req.BankAccount != nil {
		supplier.BankAccount = *req.BankAccount
	}
	if req.BankBSB != nil {
		supplier.BankBSB = *req.BankBSB
	}
	if req.AccountHolder != nil {
		supplier.AccountHolder = *req.AccountHolder
	}

	txErr := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&supplier).Error; err != nil {
			return err
		}
		// Sync email to SupplierUser (admin role) when changed
		if emailChanged {
			if err := tx.Model(&models.SupplierUser{}).
				Where("supplier_id = ? AND email = ? AND role = ?", supplier.ID, oldEmail, "admin").
				Update("email", *req.Email).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if txErr != nil {
		response.ServerError(c, "Failed to update supplier")
		return
	}

	h.audit.Log(c, "update", "supplier", supplier.ID, supplier.Name)
	response.Success(c, supplier)
}

func (h *AdminHandler) GetSupplierRevenueTrend(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid supplier ID")
		return
	}

	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days < 1 || days > 365 {
		days = 30
	}

	items, err := h.orderStore.GetRevenueTrend(uint(id), days)
	if err != nil {
		response.ServerError(c, "Failed to get revenue trend")
		return
	}

	response.Success(c, items)
}

func (h *AdminHandler) AdminRefundOrder(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	var req struct {
		Amount     float64 `json:"amount" binding:"required"`
		Reason     string  `json:"reason" binding:"required"`
		RefundType string  `json:"refund_type" binding:"required,oneof=full partial"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: amount, reason, and refund_type (full/partial) are required")
		return
	}

	order, err := h.orderStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Order not found")
		return
	}

	now := time.Now()
	order.Status = ordermodel.OrderStatusRefunded
	order.RefundedAt = &now
	order.RefundAmount = req.Amount
	order.RefundType = req.RefundType
	order.RefundReason = req.Reason
	order.RefundStatus = "completed"

	if err := h.orderStore.Update(order); err != nil {
		response.ServerError(c, "Failed to refund order")
		return
	}

	// Record status history
	adminID := c.MustGet("admin_id").(uint)
	_ = h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      order.ID,
		FromStatus:   ordermodel.OrderStatusCompleted,
		ToStatus:     ordermodel.OrderStatusRefunded,
		OperatorID:   &adminID,
		OperatorType: "admin",
		Remark:       fmt.Sprintf("Admin refund (%s): %s", req.RefundType, req.Reason),
	})

	h.audit.Log(c, "refund", "order", order.ID, fmt.Sprintf("%s refund $%.2f: %s", req.RefundType, req.Amount, req.Reason))

	// Notify supplier
	if h.notifSvc != nil {
		_ = h.notifSvc.Send("supplier", order.SupplierID, "order_refunded",
			"Order Refunded by Admin",
			fmt.Sprintf("Order %s has been refunded ($%.2f). Reason: %s", order.OrderNo, req.Amount, req.Reason),
			"order", order.ID)
	}

	response.SuccessMessage(c, "Order refunded")
}

// === Product Management ===

func (h *AdminHandler) ListProducts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	products, total, err := h.productStore.ListAll(productstore.ProductFilter{
		Status:   status,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list products")
		return
	}

	response.Paginated(c, products, total, page, pageSize)
}

func (h *AdminHandler) ApproveProduct(c *gin.Context) {
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

	if err := h.productStore.UpdateStatus(product.ID, productmodel.ProductStatusApproved); err != nil {
		response.ServerError(c, "Failed to approve product")
		return
	}

	// Notify supplier
	if h.notifSvc != nil {
		_ = h.notifSvc.Send("supplier", product.SupplierID, "product_approved",
			"Product Approved",
			fmt.Sprintf("Your product '%s' has been approved and is now live", product.NameEn),
			"product", product.ID)
	}

	// Update region attraction count
	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	h.audit.Log(c, "approve", "product", product.ID, product.NameEn)
	response.SuccessMessage(c, "Product approved")
}

func (h *AdminHandler) RejectProduct(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	product, err := h.productStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}

	if err := h.productStore.RejectWithReason(product.ID, req.Reason); err != nil {
		response.ServerError(c, "Failed to reject product")
		return
	}

	// Notify supplier
	if h.notifSvc != nil {
		content := fmt.Sprintf("Your product '%s' has been rejected", product.NameEn)
		if req.Reason != "" {
			content += ". Reason: " + req.Reason
		}
		_ = h.notifSvc.Send("supplier", product.SupplierID, "product_rejected",
			"Product Rejected", content, "product", product.ID)
	}

	// Update region attraction count (product was potentially approved before)
	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	h.audit.Log(c, "reject", "product", product.ID, req.Reason)
	response.SuccessMessage(c, "Product rejected")
}

func (h *AdminHandler) GetProduct(c *gin.Context) {
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

	response.Success(c, product)
}

type AdminCreateProductRequest struct {
	producthandler.CreateProductRequest
	SupplierID uint   `json:"supplier_id" binding:"required"`
	Status     string `json:"status"`
	IsFeatured *bool  `json:"is_featured"`
}

func (h *AdminHandler) CreateProduct(c *gin.Context) {
	var req AdminCreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Validate supplier exists and is approved
	var supplier models.Supplier
	if err := h.db.First(&supplier, req.SupplierID).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}
	if supplier.Status != "approved" {
		response.BadRequest(c, "Cannot create product for supplier with status: "+supplier.Status)
		return
	}

	status := productmodel.ProductStatusApproved
	if req.Status != "" {
		status = productmodel.ProductStatus(req.Status)
	}

	product := &productmodel.Product{
		NameZh:        req.NameZh,
		NameEn:        req.NameEn,
		SupplierID:    req.SupplierID,
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
		Status:        status,
	}

	if req.IsFeatured != nil {
		product.IsFeatured = *req.IsFeatured
	}

	for _, img := range req.Images {
		product.Images = append(product.Images, productmodel.ProductImage{
			URL:       img.URL,
			SortOrder: img.SortOrder,
			IsCover:   img.IsCover,
		})
	}
	for _, pkg := range req.Packages {
		product.Packages = append(product.Packages, productmodel.ProductPackage{
			NameZh:    pkg.NameZh,
			NameEn:    pkg.NameEn,
			DescZh:    pkg.DescZh,
			DescEn:    pkg.DescEn,
			Price:     pkg.Price,
			SortOrder: pkg.SortOrder,
		})
	}
	for _, hl := range req.Highlights {
		product.Highlights = append(product.Highlights, productmodel.ProductHighlight{
			TitleZh:   hl.TitleZh,
			TitleEn:   hl.TitleEn,
			DescZh:    hl.DescZh,
			DescEn:    hl.DescEn,
			SortOrder: hl.SortOrder,
		})
	}
	for _, faq := range req.FAQs {
		product.FAQs = append(product.FAQs, productmodel.ProductFAQ{
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

	// Update region attraction count
	if product.RegionID > 0 && product.Status == productmodel.ProductStatusApproved {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	h.maybeEnqueueZhToEn(c, product)

	product, _ = h.productStore.GetByID(product.ID)
	response.Created(c, product)
}

func (h *AdminHandler) UpdateProduct(c *gin.Context) {
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

	var req AdminCreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	oldRegionID := product.RegionID
	oldStatus := product.Status

	product.NameZh = req.NameZh
	product.NameEn = req.NameEn
	product.SupplierID = req.SupplierID
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
	if req.Status != "" {
		product.Status = productmodel.ProductStatus(req.Status)
	}
	if req.IsFeatured != nil {
		product.IsFeatured = *req.IsFeatured
	}

	// Delete old related and re-create
	h.productStore.DeleteRelated(product.ID)

	product.Images = nil
	product.Packages = nil
	product.Highlights = nil
	product.FAQs = nil

	for _, img := range req.Images {
		product.Images = append(product.Images, productmodel.ProductImage{
			ProductID: product.ID,
			URL:       img.URL,
			SortOrder: img.SortOrder,
			IsCover:   img.IsCover,
		})
	}
	for _, pkg := range req.Packages {
		product.Packages = append(product.Packages, productmodel.ProductPackage{
			ProductID: product.ID,
			NameZh:    pkg.NameZh,
			NameEn:    pkg.NameEn,
			DescZh:    pkg.DescZh,
			DescEn:    pkg.DescEn,
			Price:     pkg.Price,
			SortOrder: pkg.SortOrder,
		})
	}
	for _, hl := range req.Highlights {
		product.Highlights = append(product.Highlights, productmodel.ProductHighlight{
			ProductID: product.ID,
			TitleZh:   hl.TitleZh,
			TitleEn:   hl.TitleEn,
			DescZh:    hl.DescZh,
			DescEn:    hl.DescEn,
			SortOrder: hl.SortOrder,
		})
	}
	for _, faq := range req.FAQs {
		product.FAQs = append(product.FAQs, productmodel.ProductFAQ{
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

	// Update region attraction counts if region or status changed
	if oldRegionID != product.RegionID || oldStatus != product.Status {
		if oldRegionID > 0 {
			h.regionStore.UpdateAttractionCount(oldRegionID)
		}
		if product.RegionID > 0 {
			h.regionStore.UpdateAttractionCount(product.RegionID)
		}
	}

	h.maybeEnqueueZhToEn(c, product)

	product, _ = h.productStore.GetByID(product.ID)
	response.Success(c, product)
}

// maybeEnqueueZhToEn fires a ZH→EN translation task for the product when
// admin-side conditions allow it (REQ-20260509-0004). All checks are best-
// effort: any error is logged via the audit logger but never bubbled to
// the caller — translation is an enhancement, not a save prerequisite.
//
// Skip conditions:
//   - translationSvc not wired (test, or feature off)
//   - product.ManualOverrideEn = true (admin locked the EN side)
//   - All four EN fields are already populated (don't clobber human work)
//   - A pending or running zh2en task already exists (idempotent)
//   - All four ZH fields empty (nothing to translate)
func (h *AdminHandler) maybeEnqueueZhToEn(c *gin.Context, product *productmodel.Product) {
	if h.translationSvc == nil || product == nil {
		return
	}
	if product.ManualOverrideEn {
		return
	}

	// Don't overwrite the admin's own English entries — only fill blanks.
	if product.NameEn != "" && product.SummaryEn != "" && product.DescriptionEn != "" && product.AddressEn != "" {
		return
	}

	fields := map[string]string{}
	if product.NameZh != "" {
		fields["name"] = product.NameZh
	}
	if product.SummaryZh != "" {
		fields["summary"] = product.SummaryZh
	}
	if product.DescriptionZh != "" {
		fields["description"] = product.DescriptionZh
	}
	if product.AddressZh != "" {
		fields["address"] = product.AddressZh
	}
	if len(fields) == 0 {
		return
	}

	inflight, err := h.translationSvc.Store().HasInflight(translation.TargetTypeProduct, product.ID, translation.DirectionZH2EN)
	if err != nil || inflight {
		return
	}

	adminID, _ := c.Get("admin_id")
	enqueuedBy, _ := adminID.(uint)
	_ = h.db.Transaction(func(tx *gorm.DB) error {
		_, txErr := h.translationSvc.EnqueueProductZhToEnInTx(tx, product.ID, enqueuedBy, fields)
		return txErr
	})
}

func (h *AdminHandler) DeleteProduct(c *gin.Context) {
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

	regionID := product.RegionID

	h.productStore.DeleteRelated(product.ID)
	if err := h.productStore.Delete(product.ID); err != nil {
		response.ServerError(c, "Failed to delete product")
		return
	}

	if regionID > 0 {
		h.regionStore.UpdateAttractionCount(regionID)
	}

	response.SuccessMessage(c, "Product deleted")
}

// === Order Management ===

func (h *AdminHandler) ListOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	orders, total, err := h.orderStore.List(orderstore.OrderFilter{
		Status:    c.Query("status"),
		Keyword:   c.Query("keyword"),
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list orders")
		return
	}

	response.Paginated(c, orders, total, page, pageSize)
}

// === User Management ===

// UserWithStats wraps user with aggregated order stats
type UserWithStats struct {
	models.User
	OrderCount int     `json:"order_count"`
	TotalSpent float64 `json:"total_spent"`
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	keyword := c.Query("keyword")

	users, total, err := h.userStore.List(page, pageSize, status, keyword)
	if err != nil {
		response.ServerError(c, "Failed to list users")
		return
	}

	// Aggregate order stats per user
	userIDs := make([]uint, len(users))
	for i, u := range users {
		userIDs[i] = u.ID
	}

	type userOrderStat struct {
		UserID     uint    `json:"user_id"`
		OrderCount int     `json:"order_count"`
		TotalSpent float64 `json:"total_spent"`
	}

	orderStats := make(map[uint]userOrderStat)

	if len(userIDs) > 0 {
		var stats []userOrderStat
		h.db.Raw(`SELECT user_id, COUNT(*) as order_count, COALESCE(SUM(total_price), 0) as total_spent
			FROM orders WHERE user_id IN ? AND deleted_at IS NULL GROUP BY user_id`, userIDs).Scan(&stats)
		for _, s := range stats {
			orderStats[s.UserID] = s
		}
	}

	result := make([]UserWithStats, len(users))
	for i, u := range users {
		stat := orderStats[u.ID]
		result[i] = UserWithStats{
			User:       u,
			OrderCount: stat.OrderCount,
			TotalSpent: stat.TotalSpent,
		}
	}

	response.Paginated(c, result, total, page, pageSize)
}

func (h *AdminHandler) GetUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	user, err := h.userStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "User not found")
		return
	}

	response.Success(c, user)
}

type CreateUserRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone"`
	Password string `json:"password" binding:"required,min=6"`
	Status   string `json:"status"`
}

func (h *AdminHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Check email uniqueness
	if _, err := h.userStore.GetByEmail(req.Email); err == nil {
		response.BadRequest(c, "Email already exists")
		return
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	status := "active"
	if req.Status != "" {
		status = req.Status
	}

	user := &models.User{
		Name:     req.Name,
		Email:    req.Email,
		Phone:    req.Phone,
		Password: string(hashedPwd),
		Status:   status,
	}

	if err := h.userStore.Create(user); err != nil {
		response.ServerError(c, "Failed to create user")
		return
	}

	response.Created(c, user)
}

type UpdateUserRequest struct {
	Name   *string `json:"name"`
	Email  *string `json:"email"`
	Phone  *string `json:"phone"`
	Status *string `json:"status"`
}

func (h *AdminHandler) UpdateUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := h.userStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "User not found")
		return
	}

	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.Email != nil {
		existing, _ := h.userStore.GetByEmail(*req.Email)
		if existing != nil && existing.ID != user.ID {
			response.BadRequest(c, "Email already in use")
			return
		}
		user.Email = *req.Email
	}
	if req.Phone != nil {
		user.Phone = *req.Phone
	}
	if req.Status != nil {
		user.Status = *req.Status
	}

	if err := h.userStore.Update(user); err != nil {
		response.ServerError(c, "Failed to update user")
		return
	}

	response.Success(c, user)
}

func (h *AdminHandler) DeleteUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	if _, err := h.userStore.GetByID(uint(id)); err != nil {
		response.NotFound(c, "User not found")
		return
	}

	if err := h.userStore.Delete(uint(id)); err != nil {
		response.ServerError(c, "Failed to delete user")
		return
	}

	response.SuccessMessage(c, "User deleted")
}

type ToggleUserStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active suspended banned"`
}

func (h *AdminHandler) ToggleUserStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	var req ToggleUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: status must be 'active', 'suspended', or 'banned'")
		return
	}

	if _, err := h.userStore.GetByID(uint(id)); err != nil {
		response.NotFound(c, "User not found")
		return
	}

	if err := h.userStore.UpdateStatus(uint(id), req.Status); err != nil {
		response.ServerError(c, "Failed to update user status")
		return
	}

	response.SuccessMessage(c, "User status updated")
}

// === Admin Management ===

func (h *AdminHandler) ListAdmins(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	admins, total, err := h.adminStore.List(page, pageSize)
	if err != nil {
		response.ServerError(c, "Failed to list admins")
		return
	}

	response.Paginated(c, admins, total, page, pageSize)
}

type CreateAdminRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
	Role     string `json:"role" binding:"required"`
}

func (h *AdminHandler) CreateAdmin(c *gin.Context) {
	var req CreateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Check if email exists
	if _, err := h.adminStore.GetByEmail(req.Email); err == nil {
		response.BadRequest(c, "Email already exists")
		return
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	admin := &authmodel.Admin{
		Email:    req.Email,
		Password: string(hashedPwd),
		Name:     req.Name,
		Role:     req.Role,
		Status:   "active",
	}

	if err := h.adminStore.Create(admin); err != nil {
		response.ServerError(c, "Failed to create admin")
		return
	}

	h.audit.Log(c, "create", "admin", admin.ID, admin.Email)
	response.Created(c, admin)
}

// === Get Single Admin ===

func (h *AdminHandler) GetAdmin(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid admin ID")
		return
	}

	admin, err := h.adminStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Admin not found")
		return
	}

	response.Success(c, admin)
}

// === Update Admin ===

type UpdateAdminRequest struct {
	Name   *string `json:"name"`
	Email  *string `json:"email"`
	Role   *string `json:"role"`
	Status *string `json:"status"`
}

func (h *AdminHandler) UpdateAdmin(c *gin.Context) {
	currentAdminID := c.MustGet("admin_id").(uint)

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid admin ID")
		return
	}

	var req UpdateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	admin, err := h.adminStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Admin not found")
		return
	}

	// Cannot change own role
	if req.Role != nil && admin.ID == currentAdminID {
		response.BadRequest(c, "Cannot change your own role")
		return
	}

	// Prevent demoting last super_admin
	if req.Role != nil && *req.Role != "super_admin" && admin.Role == "super_admin" {
		count, _ := h.adminStore.CountActiveSuperAdmins()
		if count <= 1 {
			response.BadRequest(c, "Cannot demote the last super admin")
			return
		}
	}

	if req.Name != nil {
		admin.Name = *req.Name
	}
	if req.Email != nil {
		// Check email uniqueness
		existing, _ := h.adminStore.GetByEmail(*req.Email)
		if existing != nil && existing.ID != admin.ID {
			response.BadRequest(c, "Email already in use")
			return
		}
		admin.Email = *req.Email
	}
	if req.Role != nil {
		admin.Role = *req.Role
	}
	if req.Status != nil {
		admin.Status = *req.Status
	}

	if err := h.adminStore.Update(admin); err != nil {
		response.ServerError(c, "Failed to update admin")
		return
	}

	response.Success(c, admin)
}

// === Delete Admin (soft delete) ===

func (h *AdminHandler) DeleteAdmin(c *gin.Context) {
	currentAdminID := c.MustGet("admin_id").(uint)

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid admin ID")
		return
	}

	if uint(id) == currentAdminID {
		response.BadRequest(c, "Cannot delete yourself")
		return
	}

	admin, err := h.adminStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Admin not found")
		return
	}

	// Prevent deleting last super_admin
	if admin.Role == "super_admin" {
		count, _ := h.adminStore.CountActiveSuperAdmins()
		if count <= 1 {
			response.BadRequest(c, "Cannot delete the last super admin")
			return
		}
	}

	if err := h.adminStore.Delete(uint(id)); err != nil {
		response.ServerError(c, "Failed to delete admin")
		return
	}

	h.audit.Log(c, "delete", "admin", admin.ID, admin.Email)
	response.SuccessMessage(c, "Admin deleted")
}

// === Toggle Admin Status ===

type ToggleStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active suspended"`
}

func (h *AdminHandler) ToggleAdminStatus(c *gin.Context) {
	currentAdminID := c.MustGet("admin_id").(uint)

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid admin ID")
		return
	}

	if uint(id) == currentAdminID {
		response.BadRequest(c, "Cannot change your own status")
		return
	}

	var req ToggleStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: status must be 'active' or 'suspended'")
		return
	}

	admin, err := h.adminStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Admin not found")
		return
	}

	// Prevent suspending last active super_admin
	if req.Status == "suspended" && admin.Role == "super_admin" {
		count, _ := h.adminStore.CountActiveSuperAdmins()
		if count <= 1 {
			response.BadRequest(c, "Cannot suspend the last active super admin")
			return
		}
	}

	admin.Status = req.Status
	if err := h.adminStore.Update(admin); err != nil {
		response.ServerError(c, "Failed to update admin status")
		return
	}

	response.SuccessMessage(c, "Admin status updated")
}

// === Reset Admin Password ===

type ResetPasswordRequest struct {
	Password string `json:"password" binding:"required,min=8"`
}

func (h *AdminHandler) ResetAdminPassword(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid admin ID")
		return
	}

	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Password must be at least 8 characters")
		return
	}

	admin, err := h.adminStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Admin not found")
		return
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	admin.Password = string(hashedPwd)

	if err := h.adminStore.Update(admin); err != nil {
		response.ServerError(c, "Failed to reset password")
		return
	}

	response.SuccessMessage(c, "Password reset successfully")
}

// === Banners ===

func (h *AdminHandler) ListBanners(c *gin.Context) {
	var banners []Banner
	h.db.Where("status = ?", "active").Order("sort_order ASC").Find(&banners)
	response.Success(c, banners)
}

func (h *AdminHandler) ListAllBanners(c *gin.Context) {
	var banners []Banner
	h.db.Order("sort_order ASC").Find(&banners)
	response.Success(c, banners)
}

type BannerRequest struct {
	TitleZh    string `json:"title_zh"`
	TitleEn    string `json:"title_en"`
	SubtitleZh string `json:"subtitle_zh"`
	SubtitleEn string `json:"subtitle_en"`
	Image      string `json:"image"`
	LinkURL    string `json:"link_url"`
	SortOrder  int    `json:"sort_order"`
	Status     string `json:"status"`
}

func (h *AdminHandler) CreateBanner(c *gin.Context) {
	var req BannerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	status := "active"
	if req.Status != "" {
		status = req.Status
	}

	banner := Banner{
		TitleZh:    req.TitleZh,
		TitleEn:    req.TitleEn,
		SubtitleZh: req.SubtitleZh,
		SubtitleEn: req.SubtitleEn,
		Image:      req.Image,
		LinkURL:    req.LinkURL,
		SortOrder:  req.SortOrder,
		Status:     status,
	}

	if err := h.db.Create(&banner).Error; err != nil {
		response.ServerError(c, "Failed to create banner")
		return
	}

	response.Created(c, banner)
}

func (h *AdminHandler) UpdateBanner(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid banner ID")
		return
	}

	var banner Banner
	if err := h.db.First(&banner, uint(id)).Error; err != nil {
		response.NotFound(c, "Banner not found")
		return
	}

	var req BannerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	banner.TitleZh = req.TitleZh
	banner.TitleEn = req.TitleEn
	banner.SubtitleZh = req.SubtitleZh
	banner.SubtitleEn = req.SubtitleEn
	banner.Image = req.Image
	banner.LinkURL = req.LinkURL
	banner.SortOrder = req.SortOrder
	if req.Status != "" {
		banner.Status = req.Status
	}

	if err := h.db.Save(&banner).Error; err != nil {
		response.ServerError(c, "Failed to update banner")
		return
	}

	response.Success(c, banner)
}

func (h *AdminHandler) DeleteBanner(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid banner ID")
		return
	}

	if err := h.db.Delete(&Banner{}, uint(id)).Error; err != nil {
		response.ServerError(c, "Failed to delete banner")
		return
	}

	response.SuccessMessage(c, "Banner deleted")
}

// === Region Admin ===

type RegionRequest struct {
	Slug      string `json:"slug"`
	NameZh    string `json:"name_zh" binding:"required"`
	NameEn    string `json:"name_en" binding:"required"`
	DescZh    string `json:"desc_zh"`
	DescEn    string `json:"desc_en"`
	TaglineZh string `json:"tagline_zh"`
	TaglineEn string `json:"tagline_en"`
	Image     string `json:"image"`
	SortOrder int    `json:"sort_order"`
}

func (h *AdminHandler) ListRegions(c *gin.Context) {
	regions, err := h.regionStore.List()
	if err != nil {
		response.ServerError(c, "Failed to list regions")
		return
	}
	response.Success(c, regions)
}

func (h *AdminHandler) CreateRegion(c *gin.Context) {
	var req RegionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	region := &productmodel.Region{
		Slug:      req.Slug,
		NameZh:    req.NameZh,
		NameEn:    req.NameEn,
		DescZh:    req.DescZh,
		DescEn:    req.DescEn,
		TaglineZh: req.TaglineZh,
		TaglineEn: req.TaglineEn,
		Image:     req.Image,
		SortOrder: req.SortOrder,
	}

	if err := h.regionStore.Create(region); err != nil {
		response.ServerError(c, "Failed to create region")
		return
	}

	response.Created(c, region)
}

func (h *AdminHandler) UpdateRegion(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid region ID")
		return
	}

	region, err := h.regionStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Region not found")
		return
	}

	var req RegionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.Slug != "" {
		region.Slug = req.Slug
	}
	region.NameZh = req.NameZh
	region.NameEn = req.NameEn
	region.DescZh = req.DescZh
	region.DescEn = req.DescEn
	region.TaglineZh = req.TaglineZh
	region.TaglineEn = req.TaglineEn
	region.Image = req.Image
	region.SortOrder = req.SortOrder

	if err := h.regionStore.Update(region); err != nil {
		response.ServerError(c, "Failed to update region")
		return
	}

	response.Success(c, region)
}

func (h *AdminHandler) DeleteRegion(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid region ID")
		return
	}

	if err := h.regionStore.Delete(uint(id)); err != nil {
		response.ServerError(c, "Failed to delete region")
		return
	}

	response.SuccessMessage(c, "Region deleted")
}

// === Category Admin ===

type CategoryRequest struct {
	Slug      string `json:"slug"`
	NameZh    string `json:"name_zh" binding:"required"`
	NameEn    string `json:"name_en" binding:"required"`
	Icon      string `json:"icon"`
	SortOrder int    `json:"sort_order"`
}

func (h *AdminHandler) ListCategories(c *gin.Context) {
	categories, err := h.categoryStore.List()
	if err != nil {
		response.ServerError(c, "Failed to list categories")
		return
	}

	counts, _ := h.categoryStore.GetProductCounts()

	type catWithCount struct {
		productmodel.Category
		ProductCount int `json:"product_count"`
	}
	result := make([]catWithCount, len(categories))
	for i, cat := range categories {
		result[i] = catWithCount{Category: cat}
		if count, ok := counts[cat.ID]; ok {
			result[i].ProductCount = count
		}
	}
	response.Success(c, result)
}

func (h *AdminHandler) CreateCategory(c *gin.Context) {
	var req CategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	cat := &productmodel.Category{
		Slug:      req.Slug,
		NameZh:    req.NameZh,
		NameEn:    req.NameEn,
		Icon:      req.Icon,
		SortOrder: req.SortOrder,
	}

	if err := h.categoryStore.Create(cat); err != nil {
		response.ServerError(c, "Failed to create category")
		return
	}

	response.Created(c, cat)
}

func (h *AdminHandler) UpdateCategory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid category ID")
		return
	}

	cat, err := h.categoryStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Category not found")
		return
	}

	var req CategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.Slug != "" {
		cat.Slug = req.Slug
	}
	cat.NameZh = req.NameZh
	cat.NameEn = req.NameEn
	cat.Icon = req.Icon
	cat.SortOrder = req.SortOrder

	if err := h.categoryStore.Update(cat); err != nil {
		response.ServerError(c, "Failed to update category")
		return
	}

	response.Success(c, cat)
}

func (h *AdminHandler) DeleteCategory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid category ID")
		return
	}

	if err := h.categoryStore.Delete(uint(id)); err != nil {
		response.ServerError(c, "Failed to delete category")
		return
	}

	response.SuccessMessage(c, "Category deleted")
}
