package handler

import (
	"strconv"
	"time"

	authmodel "enjoysa-backend/internal/auth/model"
	authstore "enjoysa-backend/internal/auth/store"
	"enjoysa-backend/internal/models"
	orderstore "enjoysa-backend/internal/order/store"
	producthandler "enjoysa-backend/internal/product/handler"
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
	userStore    *authstore.UserStore
	orderStore   *orderstore.OrderStore
	productStore *productstore.ProductStore
	regionStore  *productstore.RegionStore
}

func NewAdminHandler(
	db *gorm.DB,
	adminStore *authstore.AdminStore,
	userStore *authstore.UserStore,
	orderStore *orderstore.OrderStore,
	productStore *productstore.ProductStore,
	regionStore *productstore.RegionStore,
) *AdminHandler {
	return &AdminHandler{
		db:           db,
		adminStore:   adminStore,
		userStore:    userStore,
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

	// Update region attraction count (product was potentially approved before)
	if product.RegionID > 0 {
		h.regionStore.UpdateAttractionCount(product.RegionID)
	}

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

	product, _ = h.productStore.GetByID(product.ID)
	response.Success(c, product)
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

	response.Paginated(c, users, total, page, pageSize)
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
