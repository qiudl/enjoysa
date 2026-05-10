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
	aichatmw "enjoysa-backend/internal/aichat/middleware"
	aichatservice "enjoysa-backend/internal/aichat/service"
	aichatstore "enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/integration/feishu"
	"enjoysa-backend/internal/llmprovider"
	contacthandler "enjoysa-backend/internal/contact/handler"
	contactstore "enjoysa-backend/internal/contact/store"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/geo"
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
	tourismagent "enjoysa-backend/internal/ai/tourism_agent"
	tourismetl "enjoysa-backend/internal/tourism/etl"
	tourismhandler "enjoysa-backend/internal/tourism/handler"
	tourismstore "enjoysa-backend/internal/tourism/store"
	aftersaleshandler "enjoysa-backend/internal/aftersales/handler"
	aftersalesstore "enjoysa-backend/internal/aftersales/store"
	"enjoysa-backend/internal/ai/translate"
	"enjoysa-backend/internal/translation"
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
	FeishuConfig     config.FeishuConfig
	CasbinEnforcer   *casbin.SyncedEnforcer
	AIModule         *aichat.Module
	// TranslationService is optional. When set the router wires it into the
	// supplier product handler; when nil the router builds one inline. The
	// caller (main.go) typically constructs it so it can also start the
	// background worker against the same instance.
	TranslationService *translation.Service
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
	chatGLMVision := aichatservice.NewGLMClient(cfg.AIConfig)
	chatHandler := chathandler.NewChatHandler(chStore, aiService)
	chatHandler.SetToolSupport(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.DB)
	chatHandler.SetGLMClient(chatGLMVision)

	// === Chat v2 (REQ-20260509-0037: workspaces + channels + threads) ===
	wsStore := chatstore.NewWorkspaceStore(cfg.DB)
	chnlStore := chatstore.NewChannelStore(cfg.DB)
	chnlMemberStore := chatstore.NewChannelMemberStore(cfg.DB)
	chatAgentStore := chatstore.NewAgentStore(cfg.DB)
	chatMsgStore := chatstore.NewMessageStore(cfg.DB)
	llmRegistry := llmprovider.SetupRegistry(cfg.AIConfig)
	groupChatHandler := chathandler.NewGroupChatHandler(wsStore, chnlStore, chnlMemberStore, chatAgentStore)
	groupChatHandler.AttachLLMSupport(chatMsgStore, llmRegistry)
	// dev-6: tool registry + GLM-4V vision share the legacy aichat instances.
	groupChatHandler.AttachToolSupport(cfg.AIModule.ToolRegistry, chatGLMVision, cfg.DB)

	// === Chat share (Feishu) ===
	shareStore := chatstore.NewShareStore(cfg.DB)
	kbStore := aichatstore.NewKnowledgeStore(cfg.DB)
	feishuClient := feishu.NewClient(cfg.FeishuConfig.WebhookURL)
	shareHandler := chathandler.NewShareHandler(chStore, shareStore, kbStore, feishuClient, cfg.FrontendURL)

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

	// === Translation pipeline (REQ-20260508-0002 Phase 1) ===
	// EN→ZH translator on top of the existing DeepSeek LLM client. Wires
	// into supplier product submission so a Chinese preview arrives shortly
	// after the supplier hits "Submit for review". The worker that drains
	// the queue is started from main.go (it owns the long-running ctx).
	translationSvc := cfg.TranslationService
	if translationSvc == nil {
		translationStore := translation.NewStore(cfg.DB)
		translator := translate.New(cfg.AIModule.LLMClient, cfg.AIConfig.Model)
		translationSvc = translation.NewService(translationStore, translator, pStore)
	}
	supplierProductHandler.SetTranslationService(translationSvc)
	supplierTranslationHandler := producthandler.NewSupplierTranslationHandler(pStore, translationSvc)
	// REQ-20260509-0004: Admin-side ZH→EN translation. Same translation
	// service / worker as the supplier side; the gate prevents the
	// background worker from clobbering admin-locked English fields.
	translationSvc.SetProductGate(pStore)
	adminTranslationHandler := handler.NewAdminTranslationHandler(cfg.DB, pStore, translationSvc)
	uploadHandler := uploadhandler.NewUploadHandler(cfg.UploadConfig)
	orderHandler := orderhandler.NewOrderHandler(oStore, pStore, scheduleStore, notifSvc)
	supplierOrderHandler := orderhandler.NewSupplierOrderHandler(oStore, pStore, pg)
	paymentHandler := paymenthandler.NewPaymentHandler(oStore, pg, cfg.FrontendURL)
	supplierHandler := supplierhandler.NewSupplierHandler(cfg.DB, oStore, pStore)
	adminHandler := handler.NewAdminHandler(cfg.DB, adminStore, userStore, oStore, pStore, regionStore, categoryStore, auditLogger, notifSvc, aStore, rvStore, slStore, supplierAuditStore)
	// REQ-20260509-0004: wire the same translation service so admin
	// Create / UpdateProduct can fire ZH→EN translation tasks alongside
	// the supplier EN→ZH pipeline.
	adminHandler.SetTranslationService(translationSvc)
	contactHandler := contacthandler.NewContactHandler(cStore)
	userContactHandler := usercontacthandler.NewUserContactHandler(ucStore)
	settingsHandler := settingshandler.NewSettingsHandler(stStore)
	settlementHandler := settlementhandler.NewSettlementHandler(slStore)

	hotelHandler := producthandler.NewHotelHandler(hotelStore)
	homepageHandler := homepage.NewHandler(cfg.DB)

	// === Geo (REQ-20260506-0006): GeoIP-based region detection so the
	// frontend can hide Google login in mainland China where Google is
	// unreachable. Failure to load the embedded xdb is non-fatal — the
	// service degrades to "unknown country" and Google stays enabled. ===
	geoSvc, err := geo.NewService()
	if err != nil {
		// Log and continue with a no-op service; refusing to start the
		// whole server because of geo data corruption is too aggressive.
		logger.Errorf("[geo] init failed, falling back to no-op: %v", err)
		geoSvc = &geo.Service{}
	}
	geoHandler := geo.NewHandler(geoSvc)

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

	// Geo (anonymous): client uses this to decide whether to render
	// Google login. Must be reachable before authentication.
	v1.GET("/geo", geoHandler.Get)

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
	// Chat send supports guests, C-end users, suppliers and admins.
	// OptionalAnyAuth resolves whichever token is present so the AI knows
	// exactly who is talking; missing/invalid tokens fall back to guest.
	v1.POST("/chat/send", middleware.OptionalAnyAuth(cfg.JWTService, cfg.DB), chatHandler.SendMessageStream)

	// Share to Feishu — authenticated only (guests rejected by handler).
	v1.POST("/chat/share", middleware.OptionalAnyAuth(cfg.JWTService, cfg.DB), shareHandler.Send)

	// Authenticated chat routes — accept user/supplier/admin tokens so the
	// ShareModal can pull message history from any logged-in role. Guests
	// are rejected inside the handler via buildChatUser.
	chatGroup := v1.Group("/chat")
	chatGroup.Use(middleware.OptionalAnyAuth(cfg.JWTService, cfg.DB))
	{
		chatGroup.GET("/sessions", chatHandler.ListSessions)
		chatGroup.GET("/sessions/:id/messages", chatHandler.GetMessages)

		// REQ-20260509-0037 dev-3: workspace + channel CRUD.
		// Auth required (handler rejects guests). Ownership enforced per-route
		// inside the handler via ownsChannelInPath (defect-analysis S1).
		chatGroup.GET("/v2/workspace", groupChatHandler.GetWorkspace)
		chatGroup.POST("/channels", groupChatHandler.CreateChannel)
		chatGroup.PATCH("/channels/:id", groupChatHandler.UpdateChannel)
		chatGroup.POST("/channels/:id/archive", groupChatHandler.ArchiveChannel)
		chatGroup.PATCH("/channels/:id/members/:agent_id", groupChatHandler.UpdateMember)

		// dev-4: channel send (SSE).
		chatGroup.POST("/channels/:id/messages", groupChatHandler.SendChannelMessage)

		// dev-5: list channel main flow + thread CRUD.
		chatGroup.GET("/channels/:id/messages", groupChatHandler.GetChannelMessages)
		chatGroup.GET("/threads/:parent_id/messages", groupChatHandler.GetThreadReplies)
		chatGroup.POST("/threads/:parent_id/messages", groupChatHandler.SendThreadMessage)
	}

	// ========================================
	// AI routes (embedded AI features)
	// ========================================
	aiRateLimiter := aichatmw.NewIPRateLimiter(2, 5) // 2 req/s per IP, burst 5
	aiGroup := v1.Group("/ai")
	aiGroup.Use(aiRateLimiter.Middleware())
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

		// Scene ②: Parse Filters (public)
		parseFiltersHandler := aichathandler.NewParseFiltersHandler(cfg.AIModule.LLMClient, cfg.AIModule.CacheStore)
		aiGroup.POST("/parse-filters", parseFiltersHandler.Parse)

		// Scene ⑤: Cart Suggestions (public, optional auth)
		cartSuggestionsHandler := aichathandler.NewCartSuggestionsHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore)
		aiGroup.POST("/cart-suggestions", cartSuggestionsHandler.Suggest)

		// Scene ⑦: Generate Product Content (supplier)
		generateContentHandler := aichathandler.NewGenerateContentHandler(cfg.AIModule.LLMClient, cfg.AIModule.CacheStore)
		aiGroup.POST("/generate-product-content", supplierAuth, generateContentHandler.Generate)

		// Scene ⑨: Review Reply (supplier)
		reviewReplyHandler := aichathandler.NewReviewReplyHandler(cfg.AIModule.LLMClient, cfg.AIModule.CacheStore)
		aiGroup.POST("/review-reply", supplierAuth, reviewReplyHandler.Suggest)

		// Scene ⑥: Travel Reminder (public)
		travelReminderHandler := aichathandler.NewTravelReminderHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore)
		aiGroup.GET("/travel-reminder", travelReminderHandler.Get)

		// Scene ⑧: Supplier Briefing (supplier auth)
		supplierBriefingHandler := aichathandler.NewSupplierBriefingHandler(cfg.AIModule.LLMClient, cfg.AIModule.CacheStore)
		aiGroup.GET("/supplier-briefing", supplierAuth, supplierBriefingHandler.Get)

		// Scene ⑩: Ticket Analysis (supplier auth)
		ticketAnalysisHandler := aichathandler.NewTicketAnalysisHandler(cfg.AIModule.LLMClient, cfg.AIModule.CacheStore)
		aiGroup.POST("/ticket-analysis", supplierAuth, ticketAnalysisHandler.Analyze)

		// Scene ⑪: Product Precheck (admin)
		productPrecheckHandler := aichathandler.NewProductPrecheckHandler(cfg.AIModule.LLMClient, cfg.AIModule.ToolRegistry, cfg.AIModule.CacheStore)
		aiGroup.GET("/product-precheck", adminAuth, productPrecheckHandler.Check)

		// Scene ⑫: Admin Insights (admin)
		adminInsightsHandler := aichathandler.NewAdminInsightsHandler(cfg.AIModule.LLMClient, cfg.AIModule.CacheStore)
		aiGroup.GET("/admin-insights", adminAuth, adminInsightsHandler.Get)

		// Image upload proxy to ai-proj COS (supplier/admin)
		imageUploadHandler := aichathandler.NewImageUploadHandler(cfg.AIConfig)
		if imageUploadHandler != nil {
			// FIX #15: Use OptionalAnyAuth so both supplier and admin can upload
		aiGroup.POST("/upload-image", middleware.OptionalAnyAuth(cfg.JWTService, cfg.DB), imageUploadHandler.Upload)
		}

		// REQ-20260510-0002 · Phase 1 · 1F: tourism agent (supplier/admin
		// embedded "✨ AI 生成" + "💰 AI 建议价格" buttons). Mounted as a
		// sub-group with its own 1/s burst-3 limiter from rate_limit.go so a
		// chatty supplier doesn't starve the other /api/v1/ai/* scenes that
		// share the global 2/s burst-5 limiter.
		tourismAgentLimiter := tourismagent.NewRateLimiter()
		tourGroup := aiGroup.Group("/tourism")
		tourGroup.Use(tourismAgentLimiter.Middleware())
		tourGroup.Use(middleware.OptionalAnyAuth(cfg.JWTService, cfg.DB))
		{
			tourismAgentInst := tourismagent.New(
				llmRegistry.Default(),
				tourismagent.NewGORMStore(cfg.DB),
				cfg.AIConfig.Model,
			)
			tourismAgentHandler := tourismagent.NewHandler(tourismAgentInst)
			tourGroup.POST("/generate-content", tourismAgentHandler.GenerateContent)
			tourGroup.POST("/pricing-suggest", tourismAgentHandler.PricingSuggest)
		}
	}

	// ========================================
	// After-sales handlers (shared between supplier portal + service-to-service)
	// ========================================
	asStore := aftersalesstore.NewTicketStore(cfg.DB)
	asHandler := aftersaleshandler.NewAfterSalesHandler(asStore)

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
		supplierGroup.GET("/chat/shares", shareHandler.ListMine)
		supplierGroup.POST("/aftersales/tickets", asHandler.SupplierCreateTicket)
		supplierGroup.GET("/aftersales/tickets/:id", asHandler.SupplierGetTicket)
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
		// REQ-20260509-0035 Phase 3a: 列表页快速调整库存（绕开 PUT 重型流程）
		supplierProducts.PATCH("/:id/packages/:pkgId/stock", supplierProductHandler.UpdatePackageStock)
		// REQ-20260509-0035 Phase 3b: 列表页批量库存工具栏
		supplierProducts.POST("/batch-stock", supplierProductHandler.BatchAdjustStock)
		supplierProducts.POST("/:id/submit", supplierProductHandler.SubmitForReview)
		supplierProducts.POST("/:id/offline", supplierProductHandler.Offline)
		supplierProducts.POST("/:id/online", supplierProductHandler.Online)
		// REQ-20260508-0002: AI translation (EN→ZH) status & manual retry.
		supplierProducts.GET("/:id/translation-status", supplierTranslationHandler.GetStatus)
		supplierProducts.POST("/:id/translation-retry", supplierTranslationHandler.Retry)
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
		adminGroup.POST("/suppliers", adminHandler.CreateSupplier)
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

		// REQ-20260509-0035 Phase 2: 轻量改库存，绕开 UpdateProduct 的
		// delete-recreate 重型流程（不触发翻译/审核重置）。让运营在列表页
		// 一键调整 stock_total。
		adminGroup.PATCH("/products/:id/packages/:pkgId/stock", adminHandler.UpdatePackageStock)
		// REQ-20260510-0003: admin 数据 hygiene — 重算 stock_sold = SUM(orders) excl. cancelled/refunded
		adminGroup.POST("/products/:id/packages/:pkgId/recompute-stock-sold", adminHandler.RecomputeStockSold)

		// REQ-20260509-0019: 批量审核 + 待审计数。Cap 50 / 请求；返回 per-item
		// status 让前端能显示哪些跳过、哪些成功。pending-counts 给 admin 主页
		// 徽章用（PR-C 接入），仅严格 status=pending。
		adminGroup.POST("/products/batch-approve", adminHandler.BatchApproveProducts)
		adminGroup.POST("/products/batch-reject", adminHandler.BatchRejectProducts)
		// REQ-20260509-0035 Phase 3b: 列表页批量库存工具栏
		adminGroup.POST("/products/batch-stock", adminHandler.BatchAdjustStock)
		adminGroup.GET("/dashboard/pending-counts", adminHandler.GetPendingCounts)

		// REQ-20260509-0004: ZH→EN translation status / retry / regenerate.
		// Admin polls status while editing the product to surface the AI
		// English preview; retry covers an LLM hiccup; regenerate force-
		// runs against the latest ZH content.
		adminGroup.GET("/products/:id/translation-status", adminTranslationHandler.GetStatus)
		adminGroup.POST("/products/:id/translation-retry", adminTranslationHandler.Retry)
		adminGroup.POST("/products/:id/translation-regenerate", adminTranslationHandler.Regenerate)

		// REQ-20260509-0015: EN→ZH translation status / retry / regenerate.
		// Mirror of the ZH→EN trio above; admin ChinesePreview polls these
		// when admin enters English content first and wants the system to
		// generate the Chinese side.
		adminGroup.GET("/products/:id/zh-translation-status", adminTranslationHandler.GetZhStatus)
		adminGroup.POST("/products/:id/zh-translation-retry", adminTranslationHandler.RetryZh)
		adminGroup.POST("/products/:id/zh-translation-regenerate", adminTranslationHandler.RegenerateZh)

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

			// REQ-20260510-0002 · 1C: Tourism knowledge-base CRUD.
			// Mounted under super_admin because the RBAC matrix has no
			// `tourism.manage` authority yet — when we split that out in a
			// follow-up, the route can move to a regular permissioned group
			// without changing the handler shape.
			tourismAdminStore := tourismstore.NewAdminStore(cfg.DB)
			tourismAdminHandler := tourismhandler.NewAdminHandler(tourismAdminStore)
			// REQ-20260510-0002 · 1E: cold-start ETL — admin clicks the
			// "rebuild from products" button on the tourism KB hub and we
			// reverse-extract approved products into experiences +
			// pricing benchmarks. Synchronous; idempotent; preserves any
			// admin IsActive overrides.
			tourismAdminHandler.SetEtlRunner(tourismetl.New(cfg.DB))
			tour := superAdmin.Group("/tourism")
			{
				tour.POST("/etl/run", tourismAdminHandler.RunEtl)
				tour.GET("/attractions", tourismAdminHandler.ListAttractions)
				tour.POST("/attractions", tourismAdminHandler.CreateAttraction)
				tour.GET("/attractions/:id", tourismAdminHandler.GetAttraction)
				tour.PUT("/attractions/:id", tourismAdminHandler.UpdateAttraction)
				tour.DELETE("/attractions/:id", tourismAdminHandler.DeleteAttraction)

				tour.GET("/accommodations", tourismAdminHandler.ListAccommodations)
				tour.POST("/accommodations", tourismAdminHandler.CreateAccommodation)
				tour.GET("/accommodations/:id", tourismAdminHandler.GetAccommodation)
				tour.PUT("/accommodations/:id", tourismAdminHandler.UpdateAccommodation)
				tour.DELETE("/accommodations/:id", tourismAdminHandler.DeleteAccommodation)

				tour.GET("/food", tourismAdminHandler.ListFood)
				tour.POST("/food", tourismAdminHandler.CreateFood)
				tour.GET("/food/:id", tourismAdminHandler.GetFood)
				tour.PUT("/food/:id", tourismAdminHandler.UpdateFood)
				tour.DELETE("/food/:id", tourismAdminHandler.DeleteFood)

				tour.GET("/experiences", tourismAdminHandler.ListExperiences)
				tour.POST("/experiences", tourismAdminHandler.CreateExperience)
				tour.GET("/experiences/:id", tourismAdminHandler.GetExperience)
				tour.PUT("/experiences/:id", tourismAdminHandler.UpdateExperience)
				tour.DELETE("/experiences/:id", tourismAdminHandler.DeleteExperience)

				tour.GET("/pricing-benchmarks", tourismAdminHandler.ListPricingBenchmarks)
				tour.POST("/pricing-benchmarks", tourismAdminHandler.CreatePricingBenchmark)
				tour.GET("/pricing-benchmarks/:id", tourismAdminHandler.GetPricingBenchmark)
				tour.PUT("/pricing-benchmarks/:id", tourismAdminHandler.UpdatePricingBenchmark)
				tour.DELETE("/pricing-benchmarks/:id", tourismAdminHandler.DeletePricingBenchmark)
			}
		}
	}

	// ========================================
	// After-sales API (service-to-service, API Key auth)
	// ========================================

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
