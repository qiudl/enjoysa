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
	chathandler "enjoysa-backend/internal/chat/handler"
	chatservice "enjoysa-backend/internal/chat/service"
	chatstore "enjoysa-backend/internal/chat/store"
	"enjoysa-backend/internal/aichat"
	aichathandler "enjoysa-backend/internal/aichat/handler"
	contacthandler "enjoysa-backend/internal/contact/handler"
	contactstore "enjoysa-backend/internal/contact/store"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/homepage"
	"enjoysa-backend/internal/core/middleware"
	"enjoysa-backend/internal/email"
	exporthandler "enjoysa-backend/internal/export/handler"
	notifhandler "enjoysa-backend/internal/notification/handler"
	notifservice "enjoysa-backend/internal/notification/service"
	notifstore "enjoysa-backend/internal/notification/store"
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
	reviewhandler "enjoysa-backend/internal/review/handler"
	reviewstore "enjoysa-backend/internal/review/store"
	settlementhandler "enjoysa-backend/internal/settlement/handler"
	settlementstore "enjoysa-backend/internal/settlement/store"
	settingshandler "enjoysa-backend/internal/settings/handler"
	settingsstore "enjoysa-backend/internal/settings/store"
	supplierhandler "enjoysa-backend/internal/supplier/handler"
	supplierstore "enjoysa-backend/internal/supplier/store"
	teamhandler "enjoysa-backend/internal/team/handler"
	teamstore "enjoysa-backend/internal/team/store"
	aftersaleshandler "enjoysa-backend/internal/aftersales/handler"
	aftersalesstore "enjoysa-backend/internal/aftersales/store"
	uploadhandler "enjoysa-backend/internal/upload/handler"
	usercontacthandler "enjoysa-backend/internal/usercontact/handler"
	usercontactstore "enjoysa-backend/internal/usercontact/store"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Config struct {
	FrontendURL      string
	DB               *gorm.DB
	JWTService       *auth.JWTService
	UploadConfig     config.UploadConfig
	StripeConfig     config.StripeConfig
	ResendConfig     config.ResendConfig
	AIConfig         config.AIConfig
	AfterSalesConfig config.AfterSalesConfig
	CasbinEnforcer   *casbin.SyncedEnforcer
	AIModule         *aichat.Module
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

	ucStore := usercontactstore.NewUserContactStore(cfg.DB)
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

	// === Chat ===
	chStore := chatstore.NewChatStore(cfg.DB)
	aiService := chatservice.NewAIService(cfg.AIConfig)
	chatHandler := chathandler.NewChatHandler(chStore, aiService)

	// === Supplier audit ===
	supplierAuditStore := supplierstore.NewAuditLogStore(cfg.DB)
	supplierAuditLogHandler := supplierhandler.NewAuditLogHandler(supplierAuditStore)

	// === New module stores ===
	rvStore := reviewstore.NewReviewStore(cfg.DB)
	nStore := notifstore.NewNotificationStore(cfg.DB)
	tStore := teamstore.NewTeamStore(cfg.DB)

	// === Notification service ===
	notifSvc := notifservice.NewNotificationService(nStore)

	// === Handlers ===
	userAuthHandler := authhandler.NewUserAuthHandler(userStore, cfg.JWTService, passwordResetStore, emailService, cfg.FrontendURL)
	supplierAuthHandler := authhandler.NewSupplierAuthHandler(supplierUserStore, cfg.JWTService)
	adminAuthHandler := authhandler.NewAdminAuthHandler(adminStore, cfg.JWTService, cfg.DB)
	hotelStore := productstore.NewHotelStore(cfg.DB)
	publicProductHandler := producthandler.NewPublicProductHandler(cfg.DB, pStore, regionStore, categoryStore, scheduleStore)
	supplierProductHandler := producthandler.NewSupplierProductHandler(pStore, scheduleStore, regionStore)
	uploadHandler := uploadhandler.NewUploadHandler(cfg.UploadConfig)
	orderHandler := orderhandler.NewOrderHandler(oStore, pStore, scheduleStore, notifSvc)
	supplierOrderHandler := orderhandler.NewSupplierOrderHandler(oStore, pg)
	paymentHandler := paymenthandler.NewPaymentHandler(oStore, pg, cfg.FrontendURL)
	supplierHandler := supplierhandler.NewSupplierHandler(cfg.DB, oStore, pStore)
	adminHandler := handler.NewAdminHandler(cfg.DB, adminStore, userStore, oStore, pStore, regionStore, categoryStore, auditLogger, notifSvc, aStore, rvStore, slStore, supplierAuditStore)
	contactHandler := contacthandler.NewContactHandler(cStore)
	userContactHandler := usercontacthandler.NewUserContactHandler(ucStore)
	settingsHandler := settingshandler.NewSettingsHandler(stStore)
	settlementHandler := settlementhandler.NewSettlementHandler(slStore)

	hotelHandler := producthandler.NewHotelHandler(hotelStore)
	homepageHandler := homepage.NewHandler(cfg.DB)

	// New module handlers
	exportHandler := exporthandler.NewExportHandler(cfg.DB)
	reviewHandler := reviewhandler.NewReviewHandler(rvStore, oStore, pStore, notifSvc)
	notifHandler := notifhandler.NewNotificationHandler(nStore)
	teamHandler := teamhandler.NewTeamHandler(tStore, emailService, cfg.FrontendURL)

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
			authProtected.POST("/google/bind", userAuthHandler.BindGoogle)
			authProtected.DELETE("/google/bind", userAuthHandler.UnbindGoogle)

			// User contacts
			authProtected.GET("/contacts", userContactHandler.List)
			authProtected.POST("/contacts", userContactHandler.Create)
			authProtected.POST("/contacts/upsert", userContactHandler.Upsert)
			authProtected.PUT("/contacts/:id", userContactHandler.Update)
			authProtected.DELETE("/contacts/:id", userContactHandler.Delete)
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
	v1.GET("/suppliers/:id", publicProductHandler.GetSupplier)
	v1.GET("/suppliers/:id/products", publicProductHandler.GetSupplierProducts)
	v1.GET("/banners", adminHandler.ListBanners)

	// Hotel search (public)
	v1.GET("/hotels/search", hotelHandler.Search)

	// Homepage config (public)
	v1.GET("/homepage/config", homepageHandler.GetConfig)
	v1.POST("/homepage/init", homepageHandler.InitHomepage)

	// Product reviews (public)
	v1.GET("/products/:id/reviews", reviewHandler.ListProductReviews)

	// Contact (public)
	v1.POST("/contact", contactHandler.Submit)

	// ========================================
	// Chat routes (public + optional auth)
	// ========================================
	// Chat send supports both guest and authenticated users.
	// Guest users get userID=0; authenticated users get their real ID.
	v1.POST("/chat/send", middleware.OptionalUserAuth(cfg.JWTService, cfg.DB), chatHandler.SendMessageStream)

	// Authenticated chat routes
	chatGroup := v1.Group("/chat")
	chatGroup.Use(userAuth)
	{
		chatGroup.GET("/sessions", chatHandler.ListSessions)
		chatGroup.GET("/sessions/:id/messages", chatHandler.GetMessages)
	}

	// ========================================
	// AI routes (embedded AI features)
	// ========================================
	aiGroup := v1.Group("/ai")
	{
		// Scene ①: Smart Search (public, optional auth for personalization)
		smartSearchHandler := aichathandler.NewSmartSearchHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore)
		aiGroup.POST("/smart-search", middleware.OptionalUserAuth(cfg.JWTService, cfg.DB), smartSearchHandler.Search)

		// Scene ③-A: Product Q&A (public)
		productQAHandler := aichathandler.NewProductQAHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore, pStore)
		aiGroup.POST("/product-qa", productQAHandler.Ask)
		aiGroup.POST("/product-qa/feedback", productQAHandler.Feedback)

		// Scene ③-B: Product Fit Check (public)
		productFitHandler := aichathandler.NewProductFitHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore)
		aiGroup.POST("/product-fit", productFitHandler.Check)

		// Scene ③-C: Review Summary (public, cached)
		reviewSummaryHandler := aichathandler.NewReviewSummaryHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore, pStore)
		aiGroup.GET("/review-summary", reviewSummaryHandler.Get)

		// Scene ④: Itinerary Planning (public, SSE streaming + JSON fallback)
		itineraryHandler := aichathandler.NewItineraryHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore)
		aiGroup.POST("/plan-itinerary", itineraryHandler.Plan)
		aiGroup.POST("/plan-itinerary-json", itineraryHandler.PlanJSON)
	}

	// ========================================
	// Supplier routes
	// ========================================
	v1.POST("/supplier/register", supplierHandler.Register)

	supplierGroup := v1.Group("/supplier")
	supplierGroup.Use(supplierAuth)
	{
		supplierGroup.GET("/dashboard", supplierHandler.Dashboard)
		supplierGroup.GET("/dashboard/enhanced", supplierHandler.DashboardEnhanced)
		supplierGroup.GET("/dashboard/revenue-trend", supplierHandler.RevenueTrend)
		supplierGroup.GET("/dashboard/top-products", supplierHandler.TopProducts)
		supplierGroup.GET("/dashboard/channel-stats", supplierHandler.ChannelStats)
		supplierGroup.GET("/profile", supplierHandler.GetProfile)
		supplierGroup.PUT("/profile", supplierHandler.UpdateProfile)
		supplierGroup.GET("/schedules/alerts", supplierProductHandler.ScheduleAlerts)
		supplierGroup.GET("/audit-logs", supplierAuditLogHandler.List)
	}

	// Supplier product routes (requires approved supplier)
	supplierProducts := v1.Group("/supplier/products")
	supplierProducts.Use(supplierAuth, middleware.RequireApprovedSupplier())
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
		supplierProducts.POST("/batch", supplierProductHandler.BatchAction)
		supplierProducts.POST("/:id/schedules/batch-delete", supplierProductHandler.BatchDeleteSchedules)
		supplierProducts.GET("/:id/schedules/calendar", supplierProductHandler.ScheduleCalendar)
	}

	// Supplier order routes (requires approved supplier)
	supplierOrders := v1.Group("/supplier/orders")
	supplierOrders.Use(supplierAuth, middleware.RequireApprovedSupplier())
	{
		supplierOrders.GET("", supplierOrderHandler.ListOrders)
		supplierOrders.GET("/stats", supplierOrderHandler.GetStats)
		supplierOrders.GET("/:id", supplierOrderHandler.GetOrder)
		supplierOrders.POST("/:id/accept", supplierOrderHandler.AcceptOrder)
		supplierOrders.POST("/:id/reject", supplierOrderHandler.RejectOrder)
		supplierOrders.POST("/:id/complete", supplierOrderHandler.CompleteOrder)
		supplierOrders.GET("/:id/history", supplierOrderHandler.GetHistory)
		supplierOrders.POST("/:id/refund", supplierOrderHandler.RefundOrder)
		supplierOrders.PATCH("/:id/remark", supplierOrderHandler.UpdateRemark)
	}

	// Supplier settlement routes (requires approved supplier)
	supplierSettlements := v1.Group("/supplier/settlements")
	supplierSettlements.Use(supplierAuth, middleware.RequireApprovedSupplier())
	{
		supplierSettlements.GET("", settlementHandler.SupplierList)
		supplierSettlements.GET("/stats", settlementHandler.SupplierStats)
	}

	// Supplier export routes (requires approved supplier)
	supplierExport := v1.Group("/supplier/export")
	supplierExport.Use(supplierAuth, middleware.RequireApprovedSupplier())
	{
		supplierExport.GET("/orders", exportHandler.ExportOrders)
		supplierExport.GET("/settlements", exportHandler.ExportSettlements)
		supplierExport.GET("/products", exportHandler.ExportProducts)
	}

	// Supplier review routes (requires approved supplier)
	supplierReviews := v1.Group("/supplier/reviews")
	supplierReviews.Use(supplierAuth, middleware.RequireApprovedSupplier())
	{
		supplierReviews.GET("", reviewHandler.SupplierListReviews)
		supplierReviews.GET("/stats", reviewHandler.SupplierGetStats)
		supplierReviews.POST("/:id/reply", reviewHandler.SupplierReply)
	}

	// Supplier notification routes
	supplierNotifs := v1.Group("/supplier/notifications")
	supplierNotifs.Use(supplierAuth)
	{
		supplierNotifs.GET("", notifHandler.List)
		supplierNotifs.GET("/unread-count", notifHandler.UnreadCount)
		supplierNotifs.POST("/:id/read", notifHandler.MarkRead)
		supplierNotifs.POST("/read-all", notifHandler.MarkAllRead)
		supplierNotifs.DELETE("/:id", notifHandler.Delete)
	}

	// Supplier team routes (requires approved supplier)
	supplierTeam := v1.Group("/supplier/team")
	supplierTeam.Use(supplierAuth, middleware.RequireApprovedSupplier())
	{
		supplierTeam.GET("", teamHandler.ListMembers)
		supplierTeam.POST("/invite", teamHandler.InviteMember)
		supplierTeam.PUT("/:id/role", teamHandler.UpdateRole)
		supplierTeam.PUT("/:id/status", teamHandler.UpdateStatus)
		supplierTeam.DELETE("/:id", teamHandler.RemoveMember)
		supplierTeam.POST("/:id/reset-password", teamHandler.ResetPassword)
		supplierTeam.GET("/invitations", teamHandler.ListInvitations)
		supplierTeam.DELETE("/invitations/:id", teamHandler.RevokeInvitation)
		supplierTeam.POST("/invitations/:id/resend", teamHandler.ResendInvitation)
	}

	// Public invite accept (no auth)
	v1.POST("/supplier/invite/accept", teamHandler.AcceptInvitation)

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
		orders.POST("/:id/review", reviewHandler.CreateReview)
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
	adminGroup.Use(middleware.RequirePermission(cfg.CasbinEnforcer))
	{
		// Dashboard
		adminGroup.GET("/dashboard/stats", adminHandler.DashboardStats)

		// Supplier management
		adminGroup.GET("/suppliers", adminHandler.ListSuppliers)
		adminGroup.GET("/suppliers/:id", adminHandler.GetSupplier)
		adminGroup.PUT("/suppliers/:id", adminHandler.UpdateSupplier)
		adminGroup.POST("/suppliers/:id/approve", adminHandler.ApproveSupplier)
		adminGroup.POST("/suppliers/:id/reject", adminHandler.RejectSupplier)
		adminGroup.POST("/suppliers/:id/suspend", adminHandler.SuspendSupplier)
		adminGroup.GET("/suppliers/:id/detail", adminHandler.GetSupplierDetail)
		adminGroup.GET("/suppliers/:id/products", adminHandler.GetSupplierProducts)
		adminGroup.GET("/suppliers/:id/orders", adminHandler.GetSupplierOrders)
		adminGroup.GET("/suppliers/:id/settlements", adminHandler.GetSupplierSettlements)
		adminGroup.GET("/suppliers/:id/settlements/stats", adminHandler.GetSupplierSettlementStats)
		adminGroup.GET("/suppliers/:id/reviews", adminHandler.GetSupplierReviews)
		adminGroup.GET("/suppliers/:id/audit-logs", adminHandler.GetSupplierAuditLogs)
		adminGroup.GET("/suppliers/:id/revenue-trend", adminHandler.GetSupplierRevenueTrend)
		adminGroup.POST("/suppliers/:id/products/:pid/force-offline", adminHandler.ForceOfflineProduct)
		adminGroup.POST("/suppliers/:id/products/:pid/restore", adminHandler.RestoreProduct)

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
		adminGroup.POST("/orders/:id/refund", adminHandler.AdminRefundOrder)

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

		// Banner management
		adminGroup.GET("/banners", adminHandler.ListAllBanners)
		adminGroup.POST("/banners", adminHandler.CreateBanner)
		adminGroup.PUT("/banners/:id", adminHandler.UpdateBanner)
		adminGroup.DELETE("/banners/:id", adminHandler.DeleteBanner)

		// Region management
		adminGroup.GET("/regions", adminHandler.ListRegions)
		adminGroup.POST("/regions", adminHandler.CreateRegion)
		adminGroup.PUT("/regions/:id", adminHandler.UpdateRegion)
		adminGroup.DELETE("/regions/:id", adminHandler.DeleteRegion)

		// Category management
		adminGroup.GET("/categories", adminHandler.ListCategories)
		adminGroup.POST("/categories", adminHandler.CreateCategory)
		adminGroup.PUT("/categories/:id", adminHandler.UpdateCategory)
		adminGroup.DELETE("/categories/:id", adminHandler.DeleteCategory)

		// Homepage CMS
		adminHomepage := adminGroup.Group("/homepage")
		{
			adminHomepage.GET("/features", homepageHandler.ListFeatures)
			adminHomepage.POST("/features", homepageHandler.CreateFeature)
			adminHomepage.PUT("/features/:id", homepageHandler.UpdateFeature)
			adminHomepage.DELETE("/features/:id", homepageHandler.DeleteFeature)

			adminHomepage.GET("/testimonials", homepageHandler.ListTestimonials)
			adminHomepage.POST("/testimonials", homepageHandler.CreateTestimonial)
			adminHomepage.POST("/testimonials/sync", homepageHandler.SyncTestimonials)
			adminHomepage.PUT("/testimonials/:id", homepageHandler.UpdateTestimonial)
			adminHomepage.DELETE("/testimonials/:id", homepageHandler.DeleteTestimonial)

			adminHomepage.GET("/partners", homepageHandler.ListPartners)
			adminHomepage.POST("/partners", homepageHandler.CreatePartner)
			adminHomepage.PUT("/partners/:id", homepageHandler.UpdatePartner)
			adminHomepage.DELETE("/partners/:id", homepageHandler.DeletePartner)

			adminHomepage.GET("/modules", homepageHandler.ListModules)
			adminHomepage.POST("/modules", homepageHandler.CreateModule)
			adminHomepage.PUT("/modules", homepageHandler.UpdateModules)
		}

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

		// Reviews
		adminGroup.GET("/reviews", reviewHandler.AdminListReviews)
		adminGroup.PUT("/reviews/:id/status", reviewHandler.AdminUpdateStatus)

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
	// After-sales API (service-to-service, API Key auth)
	// ========================================
	asStore := aftersalesstore.NewTicketStore(cfg.DB)
	asHandler := aftersaleshandler.NewAfterSalesHandler(asStore)

	aftersalesGroup := v1.Group("/aftersales")
	if cfg.AfterSalesConfig.ServiceKey != "" {
		aftersalesGroup.Use(middleware.APIKeyAuth(cfg.AfterSalesConfig.ServiceKey))
	}
	{
		aftersalesGroup.GET("/orders/:id", asHandler.GetOrder)
		aftersalesGroup.GET("/orders", asHandler.SearchOrders)
		aftersalesGroup.POST("/tickets", asHandler.CreateTicket)
		aftersalesGroup.GET("/tickets/:id", asHandler.GetTicket)
		aftersalesGroup.GET("/tickets", asHandler.ListTickets)
		aftersalesGroup.PUT("/tickets/:id", asHandler.UpdateTicket)
		aftersalesGroup.GET("/faq", asHandler.ListFAQs)
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
