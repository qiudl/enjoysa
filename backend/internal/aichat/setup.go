package aichat

import (
	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/aichat/tools"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
	productstore "enjoysa-backend/internal/product/store"
	reviewstore "enjoysa-backend/internal/review/store"
	"gorm.io/gorm"
)

// Module holds all AI chat dependencies.
type Module struct {
	LLMClient    *service.LLMClient
	ToolRegistry *service.ToolRegistry
	CacheStore   *store.AICacheStore
}

// Setup initializes the AI module and registers all tools.
func Setup(db *gorm.DB, cfg config.AIConfig, ps *productstore.ProductStore, rs *productstore.RegionStore, ss *productstore.ScheduleStore, rvs *reviewstore.ReviewStore) *Module {
	llm := service.NewLLMClient(cfg)
	registry := service.NewToolRegistry()
	cacheStore := store.NewAICacheStore(db)

	// Register C-end tools
	registry.Register(tools.RegisterSearchProducts(ps))
	registry.Register(tools.RegisterProductDetail(ps))
	registry.Register(tools.RegisterRecommendAttractions(ps, rs))
	registry.Register(tools.RegisterCheckAvailability(ss))
	registry.Register(tools.RegisterGetReviews(rvs))

	// Register supplier tools
	registry.Register(tools.RegisterGetOrderStats())
	registry.Register(tools.RegisterListPendingOrders())
	registry.Register(tools.RegisterGetReviewStats())
	registry.Register(tools.RegisterGetRevenueTrend())

	// Register admin tools
	registry.Register(tools.RegisterGetPlatformStats())
	registry.Register(tools.RegisterSearchSuppliers())
	registry.Register(tools.RegisterListPendingProducts())

	logger.Info("AI module initialized with %d tools: %v", len(registry.GetToolNames()), registry.GetToolNames())

	return &Module{
		LLMClient:    llm,
		ToolRegistry: registry,
		CacheStore:   cacheStore,
	}
}
