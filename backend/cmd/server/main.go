package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"enjoysa-backend/internal/ai/translate"
	"enjoysa-backend/internal/aichat"
	aimodel "enjoysa-backend/internal/aichat/model"
	aichatstore "enjoysa-backend/internal/aichat/store"
	adminhandler "enjoysa-backend/internal/admin/handler"
	auditmodel "enjoysa-backend/internal/audit/model"
	"enjoysa-backend/internal/auth"
	authmodel "enjoysa-backend/internal/auth/model"
	contactmodel "enjoysa-backend/internal/contact/model"
	"enjoysa-backend/internal/core/cache"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/database"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/models"
	aftersalesmodel "enjoysa-backend/internal/aftersales/model"
	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/homepage"
	notifmodel "enjoysa-backend/internal/notification/model"
	octomodel "enjoysa-backend/internal/octo/model"
	ordermodel "enjoysa-backend/internal/order/model"
	reviewmodel "enjoysa-backend/internal/review/model"
	suppliermodel "enjoysa-backend/internal/supplier/model"
	teammodel "enjoysa-backend/internal/team/model"
	usercontactmodel "enjoysa-backend/internal/usercontact/model"
	orderstore "enjoysa-backend/internal/order/store"
	productmodel "enjoysa-backend/internal/product/model"
	productstore "enjoysa-backend/internal/product/store"
	reviewstore "enjoysa-backend/internal/review/store"
	"enjoysa-backend/internal/rbac"
	rbacmodel "enjoysa-backend/internal/rbac/model"
	"enjoysa-backend/internal/router"
	settingsmodel "enjoysa-backend/internal/settings/model"
	settlementmodel "enjoysa-backend/internal/settlement/model"
	"enjoysa-backend/internal/translation"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func main() {
	configPath := flag.String("config", "configs/config.yaml", "path to config file")
	flag.Parse()

	// Load config
	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Init logger
	if err := logger.Init(cfg.Log); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Set gin mode
	gin.SetMode(cfg.Server.Mode)

	// Init database
	db, err := database.Init(cfg.Database)
	if err != nil {
		logger.Fatalf("Failed to init database: %v", err)
	}

	// Auto migrate
	if err := autoMigrate(db); err != nil {
		logger.Fatalf("Failed to migrate: %v", err)
	}

	// Init Redis (optional)
	cache.Init(cfg.Redis)
	defer cache.Close()

	// Init Casbin enforcer
	enforcer, err := rbac.NewCasbinEnforcer(db)
	if err != nil {
		logger.Fatalf("Failed to init Casbin enforcer: %v", err)
	}

	// Seed RBAC data (roles, menus, policies)
	rbac.SeedRBAC(db, enforcer)
	rbac.RepairPolicies(db, enforcer)

	// Create uploads dir
	if err := os.MkdirAll(cfg.Upload.Dir, 0755); err != nil {
		logger.Fatalf("Failed to create upload dir: %v", err)
	}

	// Init JWT service
	jwtService := auth.NewJWTService(cfg.JWT)

	// Init AI module
	aiModule := aichat.Setup(
		db, cfg.AI,
		productstore.NewProductStore(db),
		productstore.NewRegionStore(db),
		productstore.NewScheduleStore(db),
		reviewstore.NewReviewStore(db),
	)

	// Build translation service here so the same instance feeds both the
	// router (handlers) and the background worker (main.go owns ctx).
	translationStore := translation.NewStore(db)
	translator := translate.New(aiModule.LLMClient, cfg.AI.Model)
	productStore := productstore.NewProductStore(db)
	translationSvc := translation.NewService(translationStore, translator, productStore)

	// Setup router
	r := router.Setup(router.Config{
		FrontendURL:        cfg.Server.FrontendURL,
		DB:                 db,
		JWTService:         jwtService,
		UploadConfig:       cfg.Upload,
		StripeConfig:       cfg.Stripe,
		ResendConfig:       cfg.Resend,
		AIConfig:           cfg.AI,
		AfterSalesConfig:   cfg.AfterSales,
		FeishuConfig:       cfg.Feishu,
		CasbinEnforcer:     enforcer,
		AIModule:           aiModule,
		TranslationService: translationSvc,
	})

	// Start expired order cleanup + translation worker
	oStore := orderstore.NewOrderStore(db)
	ctx, cancel := context.WithCancel(context.Background())
	go expiredOrderCleanup(ctx, oStore)
	translation.StartWorker(ctx, translationSvc)

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	go func() {
		logger.Infof("Server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Server failed: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")
	cancel() // stop background tasks

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatalf("Server forced to shutdown: %v", err)
	}

	sqlDB, _ := db.DB()
	if sqlDB != nil {
		_ = sqlDB.Close()
	}

	logger.Info("Server exited")
}

func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		// Shared models
		&models.User{},
		&models.Supplier{},
		&models.SupplierUser{},
		// Auth
		&authmodel.Admin{},
		&authmodel.PasswordResetToken{},
		// Product
		&productmodel.Region{},
		&productmodel.Category{},
		&productmodel.Product{},
		&productmodel.ProductImage{},
		&productmodel.ProductPackage{},
		&productmodel.ProductHighlight{},
		&productmodel.ProductFAQ{},
		&productmodel.ProductSchedule{},
		// Order
		&ordermodel.Order{},
		&ordermodel.OrderStatusHistory{},
		// Admin
		&adminhandler.Banner{},
		// Contact
		&contactmodel.ContactMessage{},
		// Settings
		&settingsmodel.Setting{},
		// Settlement
		&settlementmodel.Settlement{},
		// RBAC
		&rbacmodel.SysRole{},
		&rbacmodel.SysMenu{},
		&rbacmodel.SysRoleMenu{},
		&rbacmodel.AdminRole{},
		// Audit
		&auditmodel.AuditLog{},
		// OCTO (Trip.com Connect)
		&octomodel.OctoReseller{},
		&octomodel.OctoBooking{},
		&octomodel.OctoAvailabilityCache{},
		// Supplier audit
		&suppliermodel.SupplierAuditLog{},
		// Chat
		&chatmodel.ChatSession{},
		&chatmodel.ChatMessage{},
		&chatmodel.ChatMessageShare{},
		// User contacts
		&usercontactmodel.UserContact{},
		// Reviews
		&reviewmodel.Review{},
		// Notifications
		&notifmodel.Notification{},
		// Team invitations
		&teammodel.SupplierInvitation{},
		// After-sales
		&aftersalesmodel.Ticket{},
		&aftersalesmodel.TicketNote{},
		&aftersalesmodel.TicketAttachment{},
		&aftersalesmodel.FAQ{},
		// AI
		&aimodel.AICache{},
		&aimodel.AIFaqFeedback{},
		&aimodel.AIMetric{},
		&aichatstore.KnowledgeEntry{},
		// Homepage CMS
		&homepage.HomepageFeature{},
		&homepage.HomepageTestimonial{},
		&homepage.HomepagePartner{},
		&homepage.HomepageModule{},
		// Translation pipeline (REQ-20260508-0002)
		&translation.TranslationTask{},
	)
}

func expiredOrderCleanup(ctx context.Context, oStore *orderstore.OrderStore) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			count, err := oStore.CancelExpired()
			if err != nil {
				logger.Errorf("Failed to cancel expired orders: %v", err)
			} else if count > 0 {
				logger.Infof("Cancelled %d expired orders", count)
			}
		}
	}
}

