package router

import (
	"net/http"

	"enjoysa-backend/internal/admin/handler"
	"enjoysa-backend/internal/auth"
	authhandler "enjoysa-backend/internal/auth/handler"
	authstore "enjoysa-backend/internal/auth/store"
	"enjoysa-backend/internal/audit"
	audithandler "enjoysa-backend/internal/audit/handler"
	auditstore "enjoysa-backend/internal/audit/store"
	contacthandler "enjoysa-backend/internal/contact/handler"
	contactstore "enjoysa-backend/internal/contact/store"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/middleware"
	"enjoysa-backend/internal/email"
	octohandler "enjoysa-backend/internal/octo/handler"
	octomw "enjoysa-backend/internal/octo/middleware"
	octostore "enjoysa-backend/internal/octo/store"
	orderhandler "enjoysa-backend/internal/order/handler"
	orderstore "enjoysa-backend/internal/order/store"
	"enjoysa-backend/internal/payment/gateway"
	paymenthandler "enjoysa-backend/internal/payment/handler"
	producthandler "enjoysa-backend/internal/product/handler"
	productstore "enjoysa-backend/internal/product/store"
	rbachandler "enjoysa-backend/internal/rbac/handler"
	rbacstore "enjoysa-backend/internal/rbac/store"
	settlementhandler "enjoysa-backend/internal/settlement/handler"
	settlementstore "enjoysa-backend/internal/settlement/store"
	settingshandler "enjoysa-backend/internal/settings/handler"
	settingsstore "enjoysa-backend/internal/settings/store"
	supplierhandler "enjoysa-backend/internal/supplier/handler"
	uploadhandler "enjoysa-backend/internal/upload/handler"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Config struct {
	FrontendURL    string
	DB             *gorm.DB
	JWTService     *auth.JWTService
	UploadConfig   config.UploadConfig
	StripeConfig   config.StripeConfig
	ResendConfig   config.ResendConfig
	CasbinEnforcer *casbin.SyncedEnforcer
}

func Setup(cfg Config) *gin.Engine {
	r := gin.New()

	// Global middleware
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger())
	r.Use(middleware.Recovery())
	r.Use(middleware.CORS(cfg.FrontendURL))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Static files for uploads
	r.Static("/uploads", "./uploads")

	// === Stores ===
	userStore := authstore.NewUserStore(cfg.DB)
	supplierUserStore := authstore.NewSupplierUserStore(cfg.DB)
	adminStore := authstore.NewAdminStore(cfg.DB)
	pStore := productstore.NewProductStore(cfg.DB)
	regionStore := productstore.NewRegionStore(cfg.DB)
	categoryStore := productstore.NewCategoryStore(cfg.DB)
	scheduleStore := productstore.NewScheduleStore(cfg.DB)
	oStore := orderstore.NewOrderStore(cfg.DB)

	cStore := contactstore.NewContactStore(cfg.DB)
	stStore := settingsstore.NewSettingsStore(cfg.DB)
	slStore := settlementstore.NewSettlementStore(cfg.DB)

	// === Payment gateway ===
	var pg gateway.PaymentGateway
	if cfg.StripeConfig.SecretKey != "" {
		pg = gateway.NewStripeGateway(cfg.StripeConfig.SecretKey, cfg.StripeConfig.WebhookSecret)
	}

	// === Audit ===
	aStore := auditstore.NewAuditStore(cfg.DB)
	auditLogger := audit.NewLogger(aStore)
	auditHandler := audithandler.NewAuditHandler(aStore)

	// === RBAC Stores ===
	roleStore := rbacstore.NewRoleStore(cfg.DB)
	menuStore := rbacstore.NewMenuStore(cfg.DB)
	roleMenuStore := rbacstore.NewRoleMenuStore(cfg.DB)
	adminRoleStore := rbacstore.NewAdminRoleStore(cfg.DB)

	// === Password Reset ===
	passwordResetStore := authstore.NewPasswordResetStore(cfg.DB)
	emailService := email.NewResendService(cfg.ResendConfig)

	// === Handlers ===
	userAuthHandler := authhandler.NewUserAuthHandler(userStore, cfg.JWTService, passwordResetStore, emailService, cfg.FrontendURL)
	supplierAuthHandler := authhandler.NewSupplierAuthHandler(supplierUserStore, cfg.JWTService)
	adminAuthHandler := authhandler.NewAdminAuthHandler(adminStore, cfg.JWTService, cfg.DB)
	publicProductHandler := producthandler.NewPublicProductHandler(pStore, regionStore, categoryStore, scheduleStore)
	supplierProductHandler := producthandler.NewSupplierProductHandler(pStore, scheduleStore, regionStore)
	uploadHandler := uploadhandler.NewUploadHandler(cfg.UploadConfig)
	orderHandler := orderhandler.NewOrderHandler(oStore, pStore, scheduleStore)
	supplierOrderHandler := orderhandler.NewSupplierOrderHandler(oStore, pg)
	paymentHandler := paymenthandler.NewPaymentHandler(oStore, pg, cfg.FrontendURL)
	supplierHandler := supplierhandler.NewSupplierHandler(cfg.DB, oStore, pStore)
	adminHandler := handler.NewAdminHandler(cfg.DB, adminStore, userStore, oStore, pStore, regionStore, auditLogger)
	contactHandler := contacthandler.NewContactHandler(cStore)
	settingsHandler := settingshandler.NewSettingsHandler(stStore)
	settlementHandler := settlementhandler.NewSettlementHandler(slStore)

	// RBAC handlers
	roleHandler := rbachandler.NewRoleHandler(roleStore, menuStore, roleMenuStore, cfg.CasbinEnforcer)
	menuHandler := rbachandler.NewMenuHandler(menuStore)
	adminRoleHandler := rbachandler.NewAdminRoleHandler(adminRoleStore, roleStore, cfg.CasbinEnforcer)

	// Auth middleware
	userAuth := middleware.UserAuth(cfg.JWTService, cfg.DB)
	supplierAuth := middleware.SupplierAuth(cfg.JWTService, cfg.DB)
	adminAuth := middleware.AdminAuth(cfg.JWTService, cfg.DB)
	jwtAuth := middleware.JWTAuth(cfg.JWTService)

	// API v1
	v1 := r.Group("/api/v1")

	// ========================================
	// Auth routes (C端)
	// ========================================
	authGroup := v1.Group("/auth")
	{
		authGroup.POST("/register", userAuthHandler.Register)
		authGroup.POST("/login", userAuthHandler.Login)
		authGroup.POST("/refresh", userAuthHandler.RefreshToken)
		authGroup.POST("/google", userAuthHandler.GoogleLogin)
		authGroup.POST("/forgot-password", userAuthHandler.ForgotPassword)
		authGroup.POST("/reset-password", userAuthHandler.ResetPassword)

		authProtected := authGroup.Group("")
		authProtected.Use(userAuth)
		{
			authProtected.GET("/me", userAuthHandler.GetProfile)
			authProtected.PUT("/me", userAuthHandler.UpdateProfile)
			authProtected.PUT("/password", userAuthHandler.ChangePassword)
		}
	}

	// ========================================
	// Supplier auth routes
	// ========================================
	supplierAuthGroup := v1.Group("/supplier/auth")
	{
		supplierAuthGroup.POST("/login", supplierAuthHandler.Login)
		supplierAuthGroup.POST("/refresh", supplierAuthHandler.RefreshToken)

		supplierAuthProtected := supplierAuthGroup.Group("")
		supplierAuthProtected.Use(supplierAuth)
		{
			supplierAuthProtected.GET("/me", supplierAuthHandler.GetProfile)
		}
	}

	// ========================================
	// Admin auth routes
	// ========================================
	adminAuthGroup := v1.Group("/admin/auth")
	{
		adminAuthGroup.POST("/login", adminAuthHandler.Login)
		adminAuthGroup.POST("/refresh", adminAuthHandler.RefreshToken)

		adminAuthProtected := adminAuthGroup.Group("")
		adminAuthProtected.Use(adminAuth)
		{
			adminAuthProtected.GET("/me", adminAuthHandler.GetProfile)
			adminAuthProtected.PUT("/password", adminAuthHandler.ChangePassword)
		}
	}

	// ========================================
	// Public routes (no auth)
	// ========================================
	v1.GET("/regions", publicProductHandler.ListRegions)
	v1.GET("/regions/:slug", publicProductHandler.GetRegion)
	v1.GET("/categories", publicProductHandler.ListCategories)
	v1.GET("/products", publicProductHandler.ListProducts)
	v1.GET("/products/featured", publicProductHandler.ListFeatured)
	v1.GET("/products/:id", publicProductHandler.GetProduct)
	v1.GET("/products/:id/schedules", publicProductHandler.GetSchedules)
	v1.GET("/banners", adminHandler.ListBanners)

	// Contact (public)
	v1.POST("/contact", contactHandler.Submit)

	// ========================================
	// Supplier routes
	// ========================================
	v1.POST("/supplier/register", supplierHandler.Register)

	supplierGroup := v1.Group("/supplier")
	supplierGroup.Use(supplierAuth)
	{
		supplierGroup.GET("/dashboard", supplierHandler.Dashboard)
		supplierGroup.GET("/profile", supplierHandler.GetProfile)
		supplierGroup.PUT("/profile", supplierHandler.UpdateProfile)
	}

	// Supplier product routes
	supplierProducts := v1.Group("/supplier/products")
	supplierProducts.Use(supplierAuth)
	{
		supplierProducts.GET("", supplierProductHandler.ListProducts)
		supplierProducts.POST("", supplierProductHandler.CreateProduct)
		supplierProducts.GET("/:id", supplierProductHandler.GetProduct)
		supplierProducts.PUT("/:id", supplierProductHandler.UpdateProduct)
		supplierProducts.DELETE("/:id", supplierProductHandler.DeleteProduct)
		supplierProducts.POST("/:id/submit", supplierProductHandler.SubmitForReview)
		supplierProducts.POST("/:id/offline", supplierProductHandler.Offline)
		supplierProducts.POST("/:id/online", supplierProductHandler.Online)
		supplierProducts.POST("/:id/schedules", supplierProductHandler.CreateSchedule)
		supplierProducts.POST("/:id/schedules/batch", supplierProductHandler.BatchCreateSchedules)
		supplierProducts.PUT("/:id/schedules/:sid", supplierProductHandler.UpdateSchedule)
		supplierProducts.DELETE("/:id/schedules/:sid", supplierProductHandler.DeleteSchedule)
	}

	// Supplier order routes
	supplierOrders := v1.Group("/supplier/orders")
	supplierOrders.Use(supplierAuth)
	{
		supplierOrders.GET("", supplierOrderHandler.ListOrders)
		supplierOrders.GET("/stats", supplierOrderHandler.GetStats)
		supplierOrders.GET("/:id", supplierOrderHandler.GetOrder)
		supplierOrders.POST("/:id/accept", supplierOrderHandler.AcceptOrder)
		supplierOrders.POST("/:id/reject", supplierOrderHandler.RejectOrder)
		supplierOrders.POST("/:id/complete", supplierOrderHandler.CompleteOrder)
		supplierOrders.GET("/:id/history", supplierOrderHandler.GetHistory)
	}

	// Supplier settlement routes
	supplierSettlements := v1.Group("/supplier/settlements")
	supplierSettlements.Use(supplierAuth)
	{
		supplierSettlements.GET("", settlementHandler.SupplierList)
		supplierSettlements.GET("/stats", settlementHandler.SupplierStats)
	}

	// ========================================
	// C端 Order routes
	// ========================================
	orders := v1.Group("/orders")
	orders.Use(userAuth)
	{
		orders.POST("", orderHandler.CreateOrder)
		orders.GET("", orderHandler.ListUserOrders)
		orders.GET("/:id", orderHandler.GetOrder)
		orders.POST("/:id/cancel", orderHandler.CancelOrder)
		orders.GET("/:id/history", orderHandler.GetOrderHistory)
	}

	// ========================================
	// Payment routes
	// ========================================
	checkout := v1.Group("/checkout")
	checkout.Use(userAuth)
	{
		checkout.POST("/create-session", paymentHandler.CreateCheckoutSession)
	}
	v1.POST("/webhooks/stripe", paymentHandler.StripeWebhook)

	// ========================================
	// Admin routes
	// ========================================
	adminGroup := v1.Group("/admin")
	adminGroup.Use(adminAuth)
	{
		// Dashboard
		adminGroup.GET("/dashboard/stats", adminHandler.DashboardStats)

		// Supplier management
		adminGroup.GET("/suppliers", adminHandler.ListSuppliers)
		adminGroup.GET("/suppliers/:id", adminHandler.GetSupplier)
		adminGroup.POST("/suppliers/:id/approve", adminHandler.ApproveSupplier)
		adminGroup.POST("/suppliers/:id/reject", adminHandler.RejectSupplier)
		adminGroup.POST("/suppliers/:id/suspend", adminHandler.SuspendSupplier)

		// Product management
		adminGroup.GET("/products", adminHandler.ListProducts)
		adminGroup.GET("/products/:id", adminHandler.GetProduct)
		adminGroup.POST("/products", adminHandler.CreateProduct)
		adminGroup.PUT("/products/:id", adminHandler.UpdateProduct)
		adminGroup.DELETE("/products/:id", adminHandler.DeleteProduct)
		adminGroup.POST("/products/:id/approve", adminHandler.ApproveProduct)
		adminGroup.POST("/products/:id/reject", adminHandler.RejectProduct)

		// Order management
		adminGroup.GET("/orders", adminHandler.ListOrders)

		// User management
		adminGroup.GET("/users", adminHandler.ListUsers)
		adminGroup.GET("/users/:id", adminHandler.GetUser)
		adminGroup.POST("/users", adminHandler.CreateUser)
		adminGroup.PUT("/users/:id", adminHandler.UpdateUser)
		adminGroup.DELETE("/users/:id", adminHandler.DeleteUser)
		adminGroup.POST("/users/:id/status", adminHandler.ToggleUserStatus)

		// Settlements / Finance
		adminGroup.GET("/settlements", settlementHandler.AdminList)
		adminGroup.GET("/settlements/stats", settlementHandler.AdminStats)
		adminGroup.POST("/settlements/:id/process", settlementHandler.AdminProcess)

		// Contact messages
		adminGroup.GET("/contacts", contactHandler.List)
		adminGroup.POST("/contacts/:id/read", contactHandler.MarkRead)

		// Settings
		adminGroup.GET("/settings", settingsHandler.GetAll)
		adminGroup.GET("/settings/:group", settingsHandler.GetByGroup)
		adminGroup.PUT("/settings/:group", settingsHandler.Update)

		// RBAC: Role management
		adminGroup.GET("/roles", roleHandler.List)
		adminGroup.POST("/roles", roleHandler.Create)
		adminGroup.GET("/roles/:id", roleHandler.Get)
		adminGroup.PUT("/roles/:id", roleHandler.Update)
		adminGroup.DELETE("/roles/:id", roleHandler.Delete)
		adminGroup.GET("/roles/:id/menus", roleHandler.GetRoleMenus)
		adminGroup.PUT("/roles/:id/menus", roleHandler.UpdateRoleMenus)

		// RBAC: Menu management (super_admin only via RequirePermission)
		adminGroup.GET("/menus", menuHandler.ListTree)
		adminGroup.POST("/menus", menuHandler.Create)
		adminGroup.PUT("/menus/:id", menuHandler.Update)
		adminGroup.DELETE("/menus/:id", menuHandler.Delete)

		// Audit logs
		adminGroup.GET("/audit-logs", auditHandler.List)

		// RBAC: Admin-role assignment
		adminGroup.GET("/admins/:id/roles", adminRoleHandler.GetAdminRoles)
		adminGroup.PUT("/admins/:id/roles", adminRoleHandler.UpdateAdminRoles)

		// Admin management (super_admin only)
		superAdmin := adminGroup.Group("")
		superAdmin.Use(middleware.RequireAdminRole("super_admin"))
		{
			superAdmin.GET("/admins", adminHandler.ListAdmins)
			superAdmin.POST("/admins", adminHandler.CreateAdmin)
			superAdmin.GET("/admins/:id", adminHandler.GetAdmin)
			superAdmin.PUT("/admins/:id", adminHandler.UpdateAdmin)
			superAdmin.DELETE("/admins/:id", adminHandler.DeleteAdmin)
			superAdmin.POST("/admins/:id/status", adminHandler.ToggleAdminStatus)
			superAdmin.POST("/admins/:id/reset-password", adminHandler.ResetAdminPassword)
		}
	}

	// ========================================
	// File upload
	// ========================================
	v1.POST("/upload", jwtAuth, uploadHandler.Upload)

	// ========================================
	// OCTO API (Trip.com Connect)
	// ========================================
	resellerStore := octostore.NewResellerStore(cfg.DB)
	availStore := octostore.NewAvailabilityStore(cfg.DB)
	bookingStore := octostore.NewBookingStore(cfg.DB)

	octoSupplierHandler := octohandler.NewSupplierHandler()
	octoProductHandler := octohandler.NewProductHandler(pStore)
	octoAvailHandler := octohandler.NewAvailabilityHandler(scheduleStore, pStore, availStore)
	octoBookingHandler := octohandler.NewBookingHandler(bookingStore, availStore, scheduleStore, pStore)

	octo := r.Group("/octo/v1")
	octo.Use(octomw.OctoAuth(resellerStore))
	octo.Use(octomw.OctoCapabilities())
	{
		octo.GET("/supplier", octoSupplierHandler.GetSupplier)
		octo.GET("/products", octoProductHandler.ListProducts)
		octo.GET("/products/:id", octoProductHandler.GetProduct)
		octo.POST("/availability/calendar", octoAvailHandler.Calendar)
		octo.POST("/availability", octoAvailHandler.Check)
		octo.POST("/bookings", octoBookingHandler.CreateBooking)
		octo.GET("/bookings", octoBookingHandler.ListBookings)
		octo.GET("/bookings/:uuid", octoBookingHandler.GetBooking)
		octo.PUT("/bookings/:uuid/confirm", octoBookingHandler.ConfirmBooking)
		octo.PATCH("/bookings/:uuid", octoBookingHandler.UpdateBooking)
		octo.POST("/bookings/:uuid/cancel", octoBookingHandler.CancelBooking)
		octo.POST("/bookings/:uuid/extend", octoBookingHandler.ExtendBooking)
	}

	return r
}
