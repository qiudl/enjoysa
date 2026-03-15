package handler

import (
	"strconv"
	"time"

	authmodel "enjoysa-backend/internal/auth/model"
	authstore "enjoysa-backend/internal/auth/store"
	"enjoysa-backend/internal/models"
	orderstore "enjoysa-backend/internal/order/store"
	productmodel "enjoysa-backend/internal/product/model"
	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db           *gorm.DB
	adminStore   *authstore.AdminStore
	orderStore   *orderstore.OrderStore
	productStore *productstore.ProductStore
	regionStore  *productstore.RegionStore
}

func NewAdminHandler(
	db *gorm.DB,
	adminStore *authstore.AdminStore,
	orderStore *orderstore.OrderStore,
	productStore *productstore.ProductStore,
	regionStore *productstore.RegionStore,
) *AdminHandler {
	return &AdminHandler{
		db:           db,
		adminStore:   adminStore,
		orderStore:   orderStore,
		productStore: productStore,
		regionStore:  regionStore,
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

func (h *AdminHandler) ListSuppliers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	var suppliers []models.Supplier
	var total int64

	query := h.db.Model(&models.Supplier{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)

	offset := (page - 1) * pageSize
	query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&suppliers)

	response.Paginated(c, suppliers, total, page, pageSize)
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

	// Update region attraction count
	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

	response.SuccessMessage(c, "Product approved")
}

func (h *AdminHandler) RejectProduct(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	if err := h.productStore.UpdateStatus(uint(id), productmodel.ProductStatusRejected); err != nil {
		response.ServerError(c, "Failed to reject product")
		return
	}

	response.SuccessMessage(c, "Product rejected")
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

func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var users []models.User
	var total int64

	query := h.db.Model(&models.User{})
	keyword := c.Query("keyword")
	if keyword != "" {
		kw := "%" + keyword + "%"
		query = query.Where("name ILIKE ? OR email ILIKE ?", kw, kw)
	}
	query.Count(&total)

	offset := (page - 1) * pageSize
	query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&users)

	response.Paginated(c, users, total, page, pageSize)
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

	response.Created(c, admin)
}

// === Banners ===

func (h *AdminHandler) ListBanners(c *gin.Context) {
	var banners []Banner
	h.db.Where("status = ?", "active").Order("sort_order ASC").Find(&banners)
	response.Success(c, banners)
}
