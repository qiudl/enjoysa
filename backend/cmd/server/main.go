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
	"enjoysa-backend/internal/rbac"
	rbacmodel "enjoysa-backend/internal/rbac/model"
	"enjoysa-backend/internal/router"
	settingsmodel "enjoysa-backend/internal/settings/model"
	settlementmodel "enjoysa-backend/internal/settlement/model"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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

	// Seed data
	seedData(db)

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

	// Setup router
	r := router.Setup(router.Config{
		FrontendURL:    cfg.Server.FrontendURL,
		DB:             db,
		JWTService:     jwtService,
		UploadConfig:   cfg.Upload,
		StripeConfig:   cfg.Stripe,
		ResendConfig:   cfg.Resend,
		AIConfig:         cfg.AI,
		AfterSalesConfig: cfg.AfterSales,
		CasbinEnforcer:   enforcer,
	})

	// Start expired order cleanup
	oStore := orderstore.NewOrderStore(db)
	ctx, cancel := context.WithCancel(context.Background())
	go expiredOrderCleanup(ctx, oStore)

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
		&aftersalesmodel.FAQ{},
		// Homepage CMS
		&homepage.HomepageFeature{},
		&homepage.HomepageTestimonial{},
		&homepage.HomepagePartner{},
		&homepage.HomepageModule{},
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

func seedData(db *gorm.DB) {
	// If seed tool has already been run (>5 suppliers), skip server seeding
	// to avoid overriding seed tool's richer data set.
	var supplierCount int64
	db.Model(&models.Supplier{}).Count(&supplierCount)
	if supplierCount > 5 {
		return
	}

	seedAdmin(db)
	seedSupplier(db)
	seedRegions(db)
	seedCategories(db)
	seedTestData(db)
}

func seedAdmin(db *gorm.DB) {
	var count int64
	db.Model(&authmodel.Admin{}).Count(&count)
	if count > 0 {
		return
	}
	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte("Admin@2026"), bcrypt.DefaultCost)
	db.Create(&authmodel.Admin{
		Email:    "admin@enjoysa.com.au",
		Password: string(hashedPwd),
		Name:     "Super Admin",
		Role:     "super_admin",
		Status:   "active",
	})
	logger.Info("Seeded admin: admin@enjoysa.com.au / Admin@2026")
}

func seedSupplier(db *gorm.DB) {
	var count int64
	db.Model(&models.Supplier{}).Count(&count)
	if count > 0 {
		return
	}
	supplier := &models.Supplier{
		Name:    "Test Tours SA",
		Type:    "travel_agency",
		Status:  "approved",
		Email:   "supplier@test.com",
		Phone:   "+61 8 1234 5678",
		City:    "Adelaide",
		State:   "South Australia",
		Country: "Australia",
	}
	db.Create(supplier)

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte("Test1234!"), bcrypt.DefaultCost)
	db.Create(&models.SupplierUser{
		SupplierID: supplier.ID,
		Email:      "supplier@test.com",
		Password:   string(hashedPwd),
		Name:       "Test Supplier Admin",
		Role:       "admin",
		Status:     "active",
	})
	logger.Info("Seeded test supplier: supplier@test.com / Test1234!")
}

func seedRegions(db *gorm.DB) {
	regions := []productmodel.Region{
		{Slug: "adelaide", NameZh: "阿德莱德", NameEn: "Adelaide",
			DescZh: "南澳首府，融合城市漫游、夜生活与历史港口风情。从移动酒吧到板球场攀登，从奔富酒庄到港口海豚巡游，体验阿德莱德的多元魅力。",
			DescEn: "South Australia's capital city blends urban exploration, vibrant nightlife, and historic port charm. From mobile bars to stadium rooftop climbs, from Penfolds to dolphin cruises.",
			TaglineZh: "城市漫游、夜生活与历史港口", TaglineEn: "City life, nightlife & historic port",
			Image: "https://assets.atdw-online.com.au/images/a413083a58fc524373c90042fa3d6f21.jpeg?fit=crop&w=613&h=631&sharp=10&rot=360", SortOrder: 1, AttractionCount: 5},
		{Slug: "adelaide-hills", NameZh: "阿德莱德山", NameEn: "Adelaide Hills",
			DescZh: "距离市中心仅20分钟车程的绿色后花园。德国小镇步行、抱考拉拍照、茱莉蔻农场导览、季节性草莓采摘，适合全家出游。",
			DescEn: "A green retreat just 20 minutes from the city. German village walks, koala encounters, Jurlique farm tours, and seasonal strawberry picking - perfect for families.",
			TaglineZh: "德国小镇与采摘", TaglineEn: "German village & farm experiences",
			Image: "https://assets.atdw-online.com.au/images/be1841acfaf8aba566e6c0930326a2d9.jpeg?fit=crop&w=613&h=631&sharp=10&rot=360", SortOrder: 2, AttractionCount: 4},
		{Slug: "barossa", NameZh: "巴罗萨", NameEn: "Barossa",
			DescZh: "世界顶级葡萄酒产区，汇聚了澳洲最著名的酒庄。晨间热气球俯瞰葡萄园，品尝出生年份的陈年波特酒，享受庄园式住宿。",
			DescEn: "A world-class wine region home to Australia's most famous wineries. Morning balloon rides over vineyards, birth-year port tastings, and estate-style accommodations.",
			TaglineZh: "顶级酒庄与热气球", TaglineEn: "Premium wineries & hot air balloons",
			Image: "https://assets.atdw-online.com.au/images/f41b1d4d4a4b58b9cc9909c6df142509.jpeg?fit=crop&w=613&h=631&sharp=10&rot=360", SortOrder: 3, AttractionCount: 3},
		{Slug: "fleurieu", NameZh: "菲儿半岛", NameEn: "Fleurieu Peninsula",
			DescZh: "超现实主义建筑与南洋海岸线的完美结合。黛伦堡魔方调酒体验、野生海豚畅游、快艇观海狮、羊驼农场平衡车导览。",
			DescEn: "Where surreal architecture meets the Southern Ocean coastline. Wine blending at the Cube, wild dolphin swims, sea lion speedboat tours, and alpaca farm segway rides.",
			TaglineZh: "艺术酒庄与海滩", TaglineEn: "Art wineries & beaches",
			Image: "https://assets.atdw-online.com.au/images/ad5498e704591af223b1f1d4c78202ef.jpeg?fit=crop&w=613&h=331&sharp=10&rot=360", SortOrder: 4, AttractionCount: 4},
		{Slug: "kangaroo-island", NameZh: "袋鼠岛", NameEn: "Kangaroo Island",
			DescZh: "澳洲第三大岛屿，野生动物的天堂。与海豚同游、金酒调酒课、渡轮快速预订，探索南澳最原始的自然风光。",
			DescEn: "Australia's third-largest island and a wildlife paradise. Swim with dolphins, blend your own gin, and book ferry crossings to explore South Australia's wildest landscapes.",
			TaglineZh: "野生动物奇观", TaglineEn: "Wildlife wonders",
			Image: "https://assets.atdw-online.com.au/images/8fece3c3b536aa1c5fc89c2537b9823e.jpeg?fit=crop&w=613&h=331&sharp=10&rot=360", SortOrder: 5, AttractionCount: 3},
		{Slug: "murray-river", NameZh: "墨累河与石灰岩海岸", NameEn: "Murray River & Limestone Coast",
			DescZh: "澳洲最长河流沿岸的野生动物园住宿与蒸汽船巡游，以及南澳最神秘的地质奇观——地下岩洞探险与网红蓝色天坑浮潜。",
			DescEn: "Safari resort stays and paddle steamer cruises along Australia's longest river, plus South Australia's most mysterious geological wonders — underground caves and blue sinkhole snorkeling.",
			TaglineZh: "野生动物园、河流巡游与天坑浮潜", TaglineEn: "Safari parks, river cruises & sinkhole snorkeling",
			Image: "https://assets.atdw-online.com.au/images/7ca06bc66c184d7d0aca65bacb1e69b5.jpeg?fit=crop&w=613&h=631&sharp=10&rot=360", SortOrder: 6, AttractionCount: 5},
	}

	// Upsert: update existing regions or create new ones
	for i := range regions {
		var existing productmodel.Region
		if err := db.Where("slug = ?", regions[i].Slug).First(&existing).Error; err == nil {
			// Update existing record
			db.Model(&existing).Updates(map[string]interface{}{
				"name_zh":          regions[i].NameZh,
				"name_en":          regions[i].NameEn,
				"desc_zh":          regions[i].DescZh,
				"desc_en":          regions[i].DescEn,
				"tagline_zh":       regions[i].TaglineZh,
				"tagline_en":       regions[i].TaglineEn,
				"image":            regions[i].Image,
				"sort_order":       regions[i].SortOrder,
				"attraction_count": regions[i].AttractionCount,
			})
		} else {
			db.Create(&regions[i])
		}
	}

	// Soft-delete old regions that no longer exist (e.g. standalone limestone-coast)
	validSlugs := make([]string, len(regions))
	for i, r := range regions {
		validSlugs[i] = r.Slug
	}
	db.Where("slug NOT IN ?", validSlugs).Delete(&productmodel.Region{})

	// Migrate products from old limestone-coast region to murray-river
	var murrayRegion productmodel.Region
	if db.Where("slug = ?", "murray-river").First(&murrayRegion).Error == nil {
		var oldLC productmodel.Region
		if db.Unscoped().Where("slug = ?", "limestone-coast").First(&oldLC).Error == nil {
			db.Model(&productmodel.Product{}).Where("region_id = ?", oldLC.ID).Update("region_id", murrayRegion.ID)
		}
	}

	// Migrate products from old fleurieu-peninsula slug if it was renamed
	var fleurieuRegion productmodel.Region
	if db.Where("slug = ?", "fleurieu").First(&fleurieuRegion).Error == nil {
		var oldFP productmodel.Region
		if db.Unscoped().Where("slug = ? AND id != ?", "fleurieu-peninsula", fleurieuRegion.ID).First(&oldFP).Error == nil {
			db.Model(&productmodel.Product{}).Where("region_id = ?", oldFP.ID).Update("region_id", fleurieuRegion.ID)
		}
	}

	logger.Info("Synced regions")
}

func seedCategories(db *gorm.DB) {
	categories := []productmodel.Category{
		{Slug: "attractions", NameZh: "景点体验", NameEn: "Attractions & Experiences", Icon: "compass", SortOrder: 1},
		{Slug: "food-wine", NameZh: "美食美酒", NameEn: "Food & Wine", Icon: "wine", SortOrder: 2},
		{Slug: "accommodation", NameZh: "特色住宿", NameEn: "Unique Stays", Icon: "home", SortOrder: 3},
	}

	// Upsert: update existing categories or create new ones
	for i := range categories {
		var existing productmodel.Category
		if err := db.Where("slug = ?", categories[i].Slug).First(&existing).Error; err == nil {
			db.Model(&existing).Updates(map[string]interface{}{
				"name_zh":    categories[i].NameZh,
				"name_en":    categories[i].NameEn,
				"icon":       categories[i].Icon,
				"sort_order": categories[i].SortOrder,
			})
		} else {
			db.Create(&categories[i])
		}
	}

	// Soft-delete old categories that no longer exist
	validSlugs := make([]string, len(categories))
	for i, c := range categories {
		validSlugs[i] = c.Slug
	}
	db.Where("slug NOT IN ?", validSlugs).Delete(&productmodel.Category{})

	logger.Info("Synced categories")
}

// seedTestData creates a comprehensive set of test data: users, suppliers, products, and orders.
func seedTestData(db *gorm.DB) {
	var orderCount int64
	db.Model(&ordermodel.Order{}).Count(&orderCount)
	if orderCount > 0 {
		return
	}

	logger.Info("Seeding test data...")
	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte("Test1234!"), bcrypt.DefaultCost)
	pwd := string(hashedPwd)
	now := time.Now()

	// ── 1. C-end users ──────────────────────────────────────────
	users := []*models.User{
		{Email: "alice@test.com", Password: pwd, Name: "Alice Chen", Status: "active", EmailVerified: true, Language: "zh"},
		{Email: "bob@test.com", Password: pwd, Name: "Bob Wang", Status: "active", EmailVerified: true, Language: "en"},
		{Email: "carol@test.com", Password: pwd, Name: "Carol Li", Status: "active", EmailVerified: true, Language: "zh"},
		{Email: "david@test.com", Password: pwd, Name: "David Zhang", Status: "active", EmailVerified: true, Language: "en"},
		{Email: "emma@test.com", Password: pwd, Name: "Emma Liu", Status: "active", EmailVerified: true, Language: "zh"},
	}
	for _, u := range users {
		db.Create(u)
	}
	logger.Infof("Seeded %d test users", len(users))

	// ── 2. Suppliers + SupplierUsers ────────────────────────────
	approvedAt := now.Add(-30 * 24 * time.Hour)
	adminID := uint(1)
	suppliers := []*models.Supplier{
		{Name: "Barossa Wine Adventures", Type: "travel_agency", Status: "approved", Email: "barossa@supplier.test", Phone: "+61 8 8563 0001", City: "Tanunda", State: "South Australia", Country: "Australia", ApprovedAt: &approvedAt, ApprovedBy: &adminID},
		{Name: "KI Wildlife Tours", Type: "attraction", Status: "approved", Email: "ki@supplier.test", Phone: "+61 8 8553 0002", City: "Kingscote", State: "South Australia", Country: "Australia", ApprovedAt: &approvedAt, ApprovedBy: &adminID},
		{Name: "Adelaide Food Walks", Type: "restaurant", Status: "approved", Email: "food@supplier.test", Phone: "+61 8 8231 0003", City: "Adelaide", State: "South Australia", Country: "Australia", ApprovedAt: &approvedAt, ApprovedBy: &adminID},
		{Name: "SA Luxury Transfers", Type: "car_rental", Status: "approved", Email: "transfer@supplier.test", Phone: "+61 8 8234 0004", City: "Adelaide", State: "South Australia", Country: "Australia", ApprovedAt: &approvedAt, ApprovedBy: &adminID},
		{Name: "Fleurieu Beach House", Type: "hotel", Status: "approved", Email: "fleurieu@supplier.test", Phone: "+61 8 8556 0005", City: "Victor Harbor", State: "South Australia", Country: "Australia", ApprovedAt: &approvedAt, ApprovedBy: &adminID},
	}
	for _, s := range suppliers {
		db.Create(s)
	}

	sEmails := []string{"barossa@supplier.test", "ki@supplier.test", "food@supplier.test", "transfer@supplier.test", "fleurieu@supplier.test"}
	sNames := []string{"Barossa Admin", "KI Admin", "Food Walk Admin", "Transfer Admin", "Fleurieu Admin"}
	for i, s := range suppliers {
		db.Create(&models.SupplierUser{
			SupplierID: s.ID,
			Email:      sEmails[i],
			Password:   pwd,
			Name:       sNames[i],
			Role:       "admin",
			Status:     "active",
		})
	}
	logger.Infof("Seeded %d test suppliers with users", len(suppliers))

	// ── 3. Look up regions & categories ─────────────────────────
	var regionAdelaide, regionBarossa, regionFleurieu, regionKI productmodel.Region
	db.Where("slug = ?", "adelaide").First(&regionAdelaide)
	db.Where("slug = ?", "barossa").First(&regionBarossa)
	db.Where("slug = ?", "fleurieu").First(&regionFleurieu)
	db.Where("slug = ?", "kangaroo-island").First(&regionKI)

	var catAttractions, catFoodWine, catAccom productmodel.Category
	db.Where("slug = ?", "attractions").First(&catAttractions)
	db.Where("slug = ?", "food-wine").First(&catFoodWine)
	db.Where("slug = ?", "accommodation").First(&catAccom)

	// ── 4. Products ─────────────────────────────────────────────
	products := []*productmodel.Product{
		{
			NameZh: "巴罗萨精品酒庄之旅", NameEn: "Barossa Premium Winery Tour",
			SupplierID: suppliers[0].ID, RegionID: regionBarossa.ID, CategoryID: catFoodWine.ID,
			Status: productmodel.ProductStatusApproved, PriceFrom: 199,
			SummaryZh:     "探访巴罗萨谷三家顶级酒庄，品鉴20余款佳酿",
			SummaryEn:     "Visit 3 premium Barossa wineries and taste 20+ wines",
			DescriptionZh: "巴罗萨谷是澳大利亚最著名的葡萄酒产区之一。本行程将带您深入探访三家风格各异的精品酒庄，在酿酒师的陪同下品鉴超过20款佳酿，并享用配酒午餐。",
			DescriptionEn: "The Barossa Valley is one of Australia's most renowned wine regions. This tour takes you to three distinctive boutique wineries where you'll taste 20+ wines guided by winemakers, paired with a gourmet lunch.",
			AddressZh:     "巴罗萨谷, 南澳大利亚", AddressEn: "Barossa Valley, South Australia",
			Duration: "Full day", GroupSize: "2-12", Tags: `["wine","barossa","premium"]`, IsFeatured: true,
		},
		{
			NameZh: "袋鼠岛野生动物探索", NameEn: "Kangaroo Island Wildlife Discovery",
			SupplierID: suppliers[1].ID, RegionID: regionKI.ID, CategoryID: catAttractions.ID,
			Status: productmodel.ProductStatusApproved, PriceFrom: 289,
			SummaryZh:     "近距离接触海豹、考拉、袋鼠等澳洲独特野生动物",
			SummaryEn:     "Get up close with seals, koalas, kangaroos and more Australian wildlife",
			DescriptionZh: "袋鼠岛是澳大利亚最重要的野生动物栖息地之一。专业自然向导将带您探访海豹湾、汉森湾等知名景点，近距离观察野生海豹、考拉和袋鼠。",
			DescriptionEn: "Kangaroo Island is one of Australia's premier wildlife destinations. Your expert naturalist guide will take you to Seal Bay, Hanson Bay and more, for close encounters with wild seals, koalas and kangaroos.",
			AddressZh:     "袋鼠岛, 南澳大利亚", AddressEn: "Kangaroo Island, South Australia",
			Duration: "Full day", GroupSize: "4-16", Tags: `["wildlife","nature","kangaroo-island"]`, IsFeatured: true,
		},
		{
			NameZh: "阿德莱德美食漫步", NameEn: "Adelaide Central Market Food Walk",
			SupplierID: suppliers[2].ID, RegionID: regionAdelaide.ID, CategoryID: catFoodWine.ID,
			Status: productmodel.ProductStatusApproved, PriceFrom: 89,
			SummaryZh:     "在阿德莱德中央市场品尝本地特色美食，感受南澳味道",
			SummaryEn:     "Taste local specialties at Adelaide Central Market and discover SA flavours",
			DescriptionZh: "阿德莱德中央市场是南半球最大的生鲜市场之一。本次美食之旅将带您探索超过80个摊位中的精华，品尝奶酪、橄榄油、巧克力等本地特产。",
			DescriptionEn: "Adelaide Central Market is one of the largest fresh produce markets in the Southern Hemisphere. This food walk explores the best of 80+ stalls, tasting cheese, olive oil, chocolate and local specialties.",
			AddressZh:     "阿德莱德中央市场, 南澳大利亚", AddressEn: "Adelaide Central Market, South Australia",
			Duration: "3 hours", GroupSize: "2-10", Tags: `["food","market","adelaide"]`,
		},
		{
			NameZh: "机场豪华接送服务", NameEn: "Airport Luxury Transfer",
			SupplierID: suppliers[3].ID, RegionID: regionAdelaide.ID, CategoryID: catAttractions.ID,
			Status: productmodel.ProductStatusApproved, PriceFrom: 120,
			SummaryZh:     "阿德莱德机场至市区/酒店的豪华专车接送",
			SummaryEn:     "Luxury private transfer between Adelaide Airport and city/hotel",
			DescriptionZh: "提供阿德莱德机场与市区之间的豪华私人接送服务。配备专业司机和高端车辆，提供接机牌迎接、行李搬运等贴心服务。",
			DescriptionEn: "Premium private transfer service between Adelaide Airport and the city. Professional chauffeur with luxury vehicle, meet-and-greet with name board, and full luggage assistance.",
			AddressZh:     "阿德莱德机场, 南澳大利亚", AddressEn: "Adelaide Airport, South Australia",
			Duration: "45 min", GroupSize: "1-4", Tags: `["transfer","airport","luxury"]`,
		},
		{
			NameZh: "弗勒里厄海滨度假屋", NameEn: "Fleurieu Beachfront Holiday House",
			SupplierID: suppliers[4].ID, RegionID: regionFleurieu.ID, CategoryID: catAccom.ID,
			Status: productmodel.ProductStatusApproved, PriceFrom: 250,
			SummaryZh:     "坐落于弗勒里厄半岛海滨的精品度假屋，尽享海景",
			SummaryEn:     "Boutique beachfront holiday house on the Fleurieu Peninsula with ocean views",
			DescriptionZh: "这座精品度假屋坐落在弗勒里厄半岛的黄金海岸线上，拥有无敌海景。三卧室配置可容纳6人，配备全套厨房设施和私人花园。步行即达海滩。",
			DescriptionEn: "This boutique holiday house sits on the Fleurieu Peninsula's golden coastline with stunning ocean views. Three bedrooms sleeping 6 guests, fully equipped kitchen and private garden. Beach at your doorstep.",
			AddressZh:     "维克多港, 弗勒里厄半岛, 南澳大利亚", AddressEn: "Victor Harbor, Fleurieu Peninsula, South Australia",
			Duration: "Per night", GroupSize: "1-6", Tags: `["beach","accommodation","fleurieu"]`, IsFeatured: true,
		},
	}
	for _, p := range products {
		db.Create(p)
	}
	logger.Infof("Seeded %d test products", len(products))

	// ── 5. Packages (2 per product) ─────────────────────────────
	type pkgDef struct{ nameZh, nameEn, descZh, descEn string; price float64 }
	pkgDefs := [][2]pkgDef{
		{
			{"标准品鉴之旅", "Standard Tasting Tour", "参观3家酒庄，品鉴15款葡萄酒", "Visit 3 wineries, taste 15 wines", 199},
			{"VIP尊享之旅", "VIP Premium Tour", "参观3家酒庄，品鉴20+款葡萄酒，含配酒午餐", "Visit 3 wineries, taste 20+ wines with paired lunch", 399},
		},
		{
			{"半日探索", "Half Day Discovery", "上午出发，游览海豹湾和猛禽中心", "Morning departure, visit Seal Bay and Raptor Domain", 289},
			{"全日冒险", "Full Day Adventure", "全天行程，含午餐和所有主要景点", "Full day with lunch and all major wildlife sites", 489},
		},
		{
			{"市场漫步", "Market Walk", "2小时导览，品尝8种特色美食", "2-hour guided walk, taste 8 specialty foods", 89},
			{"美食午餐套餐", "Walk + Lunch Combo", "市场导览加精选餐厅午餐", "Market walk plus lunch at selected restaurant", 149},
		},
		{
			{"单程接送", "One Way Transfer", "机场至市区或市区至机场单程", "Airport to city or city to airport one way", 120},
			{"往返接送", "Return Transfer", "机场与市区往返接送", "Round trip airport-city transfer", 220},
		},
		{
			{"平日住宿", "Weekday Stay", "周一至周四每晚", "Monday to Thursday per night", 250},
			{"周末住宿", "Weekend Stay", "周五至周日每晚", "Friday to Sunday per night", 320},
		},
	}

	// packages[productIdx][0..1] holds the created package records
	pkgs := make([][2]productmodel.ProductPackage, len(products))
	for i, p := range products {
		for j := 0; j < 2; j++ {
			d := pkgDefs[i][j]
			pkg := productmodel.ProductPackage{
				ProductID: p.ID, NameZh: d.nameZh, NameEn: d.nameEn,
				DescZh: d.descZh, DescEn: d.descEn, Price: d.price, SortOrder: j + 1,
			}
			db.Create(&pkg)
			pkgs[i][j] = pkg
		}
	}

	// ── 6. Images (2 per product) ───────────────────────────────
	imageURLs := [][2]string{
		{"https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=600&fit=crop"},
		{"https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1425082661507-d6d2cceb1230?w=800&h=600&fit=crop"},
		{"https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop"},
		{"https://images.unsplash.com/photo-1549317661-bd32c8ce0afe?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&h=600&fit=crop"},
		{"https://images.unsplash.com/photo-1499793983394-12dec65a14a7?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop"},
	}
	for i, p := range products {
		db.Create(&productmodel.ProductImage{ProductID: p.ID, URL: imageURLs[i][0], SortOrder: 1, IsCover: true})
		db.Create(&productmodel.ProductImage{ProductID: p.ID, URL: imageURLs[i][1], SortOrder: 2})
	}

	// ── 7. Highlights (3 per product) ───────────────────────────
	type hl struct{ titleZh, titleEn, descZh, descEn string }
	hlDefs := [][3]hl{
		{
			{"专业品鉴", "Expert Tasting", "由酿酒师亲自指导品鉴", "Wine tasting guided by winemakers"},
			{"美食午餐", "Gourmet Lunch", "搭配当地佳酿的精致午餐", "Elegant lunch paired with local wines"},
			{"小团出行", "Small Group", "最多12人，个性化体验", "Max 12 guests for a personalised experience"},
		},
		{
			{"野生动物", "Wildlife Encounters", "近距离观察海豹、考拉、袋鼠", "Get close to seals, koalas and kangaroos"},
			{"壮丽风光", "Stunning Scenery", "神奇岩石和旗舰拱门等地标", "Remarkable Rocks and Admirals Arch landmarks"},
			{"专业向导", "Expert Naturalist", "经验丰富的自然学家全程陪同", "Experienced naturalist guide throughout"},
		},
		{
			{"本地风味", "Local Flavours", "品尝南澳特色奶酪、橄榄油和巧克力", "Taste SA cheese, olive oil and chocolate"},
			{"文化体验", "Cultural Insights", "了解市场150年历史", "Learn about 150 years of market history"},
			{"小团体验", "Small Group", "最多10人确保优质互动", "Max 10 guests for quality interaction"},
		},
		{
			{"豪华车辆", "Luxury Vehicles", "奔驰/宝马高端商务车", "Mercedes/BMW premium business vehicles"},
			{"接机服务", "Meet & Greet", "举牌迎接，协助行李", "Name board welcome with luggage assistance"},
			{"灵活预订", "Flexible Booking", "支持航班延误免费等待", "Free waiting for flight delays"},
		},
		{
			{"海景无敌", "Ocean Views", "180度全海景，日落美不胜收", "180° ocean views with stunning sunsets"},
			{"设施齐全", "Fully Equipped", "全套厨房、洗衣机、WiFi", "Full kitchen, laundry, WiFi included"},
			{"私人空间", "Private Access", "私人花园直通海滩", "Private garden with direct beach access"},
		},
	}
	for i, p := range products {
		for j, h := range hlDefs[i] {
			db.Create(&productmodel.ProductHighlight{
				ProductID: p.ID, TitleZh: h.titleZh, TitleEn: h.titleEn,
				DescZh: h.descZh, DescEn: h.descEn, SortOrder: j + 1,
			})
		}
	}

	// ── 8. FAQs (2 per product) ─────────────────────────────────
	type fq struct{ qZh, qEn, aZh, aEn string }
	fqDefs := [][2]fq{
		{
			{"包含午餐吗？", "Is lunch included?", "VIP尊享套餐包含配酒午餐，标准套餐不含午餐。", "Lunch is included in the VIP Premium package but not in the Standard package."},
			{"需要自己开车吗？", "Do I need to drive?", "不需要，我们提供全程接送服务。", "No, we provide full pick-up and drop-off service."},
		},
		{
			{"适合儿童吗？", "Is it suitable for children?", "适合5岁以上儿童参加。", "Suitable for children aged 5 and above."},
			{"包含渡轮费用吗？", "Is the ferry included?", "是的，往返渡轮费用已包含在价格中。", "Yes, return ferry costs are included in the price."},
		},
		{
			{"有素食选项吗？", "Are there vegetarian options?", "有的，请在预订时告知饮食需求。", "Yes, please let us know your dietary requirements when booking."},
			{"下雨天照常进行吗？", "Does it run in the rain?", "市场在室内，风雨无阻。", "The market is indoors, so it runs rain or shine."},
		},
		{
			{"航班延误怎么办？", "What if my flight is delayed?", "我们实时追踪航班信息，免费等待最多60分钟。", "We track flights in real time and wait free of charge for up to 60 minutes."},
			{"可以放多少行李？", "How much luggage can I bring?", "标准可放4个大行李箱，如需更多空间请提前告知。", "Standard fits 4 large suitcases. Please let us know if you need more space."},
		},
		{
			{"最少住几晚？", "What is the minimum stay?", "最少2晚起订。", "Minimum 2 nights booking required."},
			{"提供床品和毛巾吗？", "Are linen and towels provided?", "是的，所有床品、毛巾和基本洗浴用品均已提供。", "Yes, all linen, towels and basic toiletries are provided."},
		},
	}
	for i, p := range products {
		for j, f := range fqDefs[i] {
			db.Create(&productmodel.ProductFAQ{
				ProductID: p.ID, QuestionZh: f.qZh, QuestionEn: f.qEn,
				AnswerZh: f.aZh, AnswerEn: f.aEn, SortOrder: j + 1,
			})
		}
	}

	// ── 9. Schedules (14 days × 2 time slots × 2 packages per product) ──
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	timeSlots := []string{"09:00", "14:00"}
	for i, p := range products {
		for pi := 0; pi < 2; pi++ {
			pkg := pkgs[i][pi]
			for d := 0; d < 14; d++ {
				date := today.AddDate(0, 0, d)
				for _, slot := range timeSlots {
					db.Create(&productmodel.ProductSchedule{
						ProductID:   p.ID,
						PackageID:   pkg.ID,
						Date:        date,
						TimeSlot:    slot,
						TotalSlots:  10,
						BookedSlots: 0,
						Status:      "available",
					})
				}
			}
		}
	}
	logger.Info("Seeded product schedules (14 days × 2 slots × 2 packages × 5 products)")

	// ── 10. Orders (10 completed) ───────────────────────────────
	type orderSpec struct {
		userIdx, productIdx, pkgIdx, daysAgo, quantity int
	}
	orderSpecs := []orderSpec{
		{0, 0, 0, 25, 2}, // Alice  → Barossa Standard
		{1, 1, 0, 22, 3}, // Bob    → KI Half Day
		{2, 2, 0, 20, 2}, // Carol  → Food Walk
		{3, 3, 1, 18, 1}, // David  → Transfer Return
		{4, 4, 0, 15, 1}, // Emma   → Beach House Weekday
		{0, 2, 1, 13, 4}, // Alice  → Food Walk + Lunch
		{1, 4, 1, 10, 1}, // Bob    → Beach House Weekend
		{2, 0, 1, 8, 2},  // Carol  → Barossa VIP
		{3, 1, 1, 5, 2},  // David  → KI Full Day
		{4, 3, 0, 3, 1},  // Emma   → Transfer One Way
	}

	for idx, spec := range orderSpecs {
		u := users[spec.userIdx]
		p := products[spec.productIdx]
		pkg := pkgs[spec.productIdx][spec.pkgIdx]
		s := suppliers[spec.productIdx]

		bookDate := today.AddDate(0, 0, -spec.daysAgo)
		totalPrice := pkg.Price * float64(spec.quantity)

		payTime := bookDate.Add(-2 * 24 * time.Hour)
		acceptTime := payTime.Add(1 * time.Hour)
		completeTime := bookDate.Add(18 * time.Hour)
		expiry := payTime.Add(-29 * time.Minute)

		orderNo := fmt.Sprintf("ES%s%06d", bookDate.Format("20060102"), 100001+idx)

		order := &ordermodel.Order{
			OrderNo:       orderNo,
			Status:        ordermodel.OrderStatusCompleted,
			UserID:        u.ID,
			UserName:      u.Name,
			UserEmail:     u.Email,
			SupplierID:    s.ID,
			SupplierName:  s.Name,
			ProductID:     p.ID,
			ProductName:   p.NameEn,
			PackageID:     pkg.ID,
			PackageName:   pkg.NameEn,
			BookingDate:   bookDate,
			TimeSlot:      "09:00",
			Quantity:      spec.quantity,
			GuestCount:    spec.quantity,
			UnitPrice:     pkg.Price,
			TotalPrice:    totalPrice,
			Currency:      "AUD",
			PaymentMethod: "stripe",
			PaymentTime:   &payTime,
			PaymentRef:    fmt.Sprintf("pi_test_%d", 300001+idx),
			ExpiresAt:     &expiry,
			AcceptedAt:    &acceptTime,
			CompletedAt:   &completeTime,
			ContactName:   u.Name,
			ContactEmail:  u.Email,
		}
		db.Create(order)

		// Status history: pending → paid → accepted → completed
		createTime := payTime.Add(-30 * time.Minute)
		histories := []ordermodel.OrderStatusHistory{
			{OrderID: order.ID, FromStatus: "", ToStatus: ordermodel.OrderStatusPending, OperatorType: "user", Remark: "Order created", CreatedAt: createTime},
			{OrderID: order.ID, FromStatus: ordermodel.OrderStatusPending, ToStatus: ordermodel.OrderStatusPaid, OperatorType: "system", Remark: "Payment confirmed", CreatedAt: payTime},
			{OrderID: order.ID, FromStatus: ordermodel.OrderStatusPaid, ToStatus: ordermodel.OrderStatusAccepted, OperatorType: "supplier", Remark: "Supplier accepted", CreatedAt: acceptTime},
			{OrderID: order.ID, FromStatus: ordermodel.OrderStatusAccepted, ToStatus: ordermodel.OrderStatusCompleted, OperatorType: "system", Remark: "Service completed", CreatedAt: completeTime},
		}
		for _, h := range histories {
			db.Create(&h)
		}
	}
	logger.Infof("Seeded 10 test orders with status histories")

	logger.Info("Test data seeding completed!")
}
