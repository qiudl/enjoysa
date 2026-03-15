package handler

import (
	"enjoysa-backend/internal/models"
	orderstore "enjoysa-backend/internal/order/store"
	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type SupplierHandler struct {
	db            *gorm.DB
	orderStore    *orderstore.OrderStore
	productStore  *productstore.ProductStore
}

func NewSupplierHandler(db *gorm.DB, orderStore *orderstore.OrderStore, productStore *productstore.ProductStore) *SupplierHandler {
	return &SupplierHandler{
		db:           db,
		orderStore:   orderStore,
		productStore: productStore,
	}
}

type SupplierRegisterRequest struct {
	// 供应商信息
	Name        string `json:"name" binding:"required"`
	Type        string `json:"type" binding:"required"`
	Description string `json:"description"`
	Email       string `json:"email" binding:"required,email"`
	Phone       string `json:"phone" binding:"required"`
	Website     string `json:"website"`

	// 地址
	Address    string `json:"address"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postal_code"`

	// 资质
	BusinessLicense string `json:"business_license"`
	TaxNumber       string `json:"tax_number"`

	// 登录账号
	ContactName  string `json:"contact_name" binding:"required"`
	ContactEmail string `json:"contact_email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=8"`
}

func (h *SupplierHandler) Register(c *gin.Context) {
	var req SupplierRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Check if supplier email exists
	var existCount int64
	h.db.Model(&models.Supplier{}).Where("email = ?", req.Email).Count(&existCount)
	if existCount > 0 {
		response.BadRequest(c, "Supplier email already registered")
		return
	}

	// Check if supplier user email exists
	h.db.Model(&models.SupplierUser{}).Where("email = ?", req.ContactEmail).Count(&existCount)
	if existCount > 0 {
		response.BadRequest(c, "Contact email already registered")
		return
	}

	supplier := &models.Supplier{
		Name:            req.Name,
		Type:            req.Type,
		Status:          "pending",
		Description:     req.Description,
		Email:           req.Email,
		Phone:           req.Phone,
		Website:         req.Website,
		Address:         req.Address,
		City:            req.City,
		State:           req.State,
		PostalCode:      req.PostalCode,
		BusinessLicense: req.BusinessLicense,
		TaxNumber:       req.TaxNumber,
	}

	if err := h.db.Create(supplier).Error; err != nil {
		response.ServerError(c, "Failed to create supplier")
		return
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	su := &models.SupplierUser{
		SupplierID: supplier.ID,
		Email:      req.ContactEmail,
		Password:   string(hashedPwd),
		Name:       req.ContactName,
		Role:       "admin",
		Status:     "active",
	}

	if err := h.db.Create(su).Error; err != nil {
		response.ServerError(c, "Failed to create supplier user")
		return
	}

	response.Created(c, gin.H{
		"supplier": supplier,
		"message":  "Registration submitted, pending approval",
	})
}

func (h *SupplierHandler) Dashboard(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)

	stats, err := h.orderStore.GetStats(supplierID)
	if err != nil {
		response.ServerError(c, "Failed to get stats")
		return
	}

	// Product counts
	var productTotal, productApproved, productPending int64
	h.db.Raw("SELECT COUNT(*) FROM products WHERE supplier_id = ? AND deleted_at IS NULL", supplierID).Scan(&productTotal)
	h.db.Raw("SELECT COUNT(*) FROM products WHERE supplier_id = ? AND status = 'approved' AND deleted_at IS NULL", supplierID).Scan(&productApproved)
	h.db.Raw("SELECT COUNT(*) FROM products WHERE supplier_id = ? AND status = 'pending' AND deleted_at IS NULL", supplierID).Scan(&productPending)

	response.Success(c, gin.H{
		"order_stats": stats,
		"products": gin.H{
			"total":    productTotal,
			"approved": productApproved,
			"pending":  productPending,
		},
	})
}

func (h *SupplierHandler) GetProfile(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)

	var supplier models.Supplier
	if err := h.db.First(&supplier, supplierID).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	response.Success(c, supplier)
}

type UpdateSupplierProfileRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Logo        string `json:"logo"`
	Phone       string `json:"phone"`
	Website     string `json:"website"`
	Address     string `json:"address"`
	City        string `json:"city"`
	State       string `json:"state"`
	PostalCode  string `json:"postal_code"`
	BankName    string `json:"bank_name"`
	BankAccount string `json:"bank_account"`
	BankBSB     string `json:"bank_bsb"`
	AccountHolder string `json:"account_holder"`
	AutoAccept  *bool  `json:"auto_accept"`
	NotifyEmail *bool  `json:"notify_email"`
}

func (h *SupplierHandler) UpdateProfile(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)

	var supplier models.Supplier
	if err := h.db.First(&supplier, supplierID).Error; err != nil {
		response.NotFound(c, "Supplier not found")
		return
	}

	var req UpdateSupplierProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	if req.Name != "" {
		supplier.Name = req.Name
	}
	if req.Description != "" {
		supplier.Description = req.Description
	}
	if req.Logo != "" {
		supplier.Logo = req.Logo
	}
	if req.Phone != "" {
		supplier.Phone = req.Phone
	}
	if req.Website != "" {
		supplier.Website = req.Website
	}
	if req.Address != "" {
		supplier.Address = req.Address
	}
	if req.City != "" {
		supplier.City = req.City
	}
	if req.State != "" {
		supplier.State = req.State
	}
	if req.PostalCode != "" {
		supplier.PostalCode = req.PostalCode
	}
	if req.BankName != "" {
		supplier.BankName = req.BankName
	}
	if req.BankAccount != "" {
		supplier.BankAccount = req.BankAccount
	}
	if req.BankBSB != "" {
		supplier.BankBSB = req.BankBSB
	}
	if req.AccountHolder != "" {
		supplier.AccountHolder = req.AccountHolder
	}
	if req.AutoAccept != nil {
		supplier.AutoAccept = *req.AutoAccept
	}
	if req.NotifyEmail != nil {
		supplier.NotifyEmail = *req.NotifyEmail
	}

	if err := h.db.Save(&supplier).Error; err != nil {
		response.ServerError(c, "Failed to update profile")
		return
	}

	response.Success(c, supplier)
}
