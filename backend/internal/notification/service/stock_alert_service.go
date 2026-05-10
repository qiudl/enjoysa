package service

import (
	"fmt"
	"time"

	productmodel "enjoysa-backend/internal/product/model"
	"enjoysa-backend/internal/notification/store"

	"gorm.io/gorm"
)

// StockAlertService — REQ-20260510-0004 — fires "low stock" / "sold out"
// notifications to suppliers after a stock decrement commits. Designed to
// be called fire-and-forget from a goroutine: every error path is silent
// (logged at most), and the service never returns an error.
type StockAlertService struct {
	db            *gorm.DB
	cooldownStore *store.StockAlertCooldownStore
	notifSvc      *NotificationService
}

const stockAlertCooldown = 4 * time.Hour

func NewStockAlertService(
	db *gorm.DB,
	cooldownStore *store.StockAlertCooldownStore,
	notifSvc *NotificationService,
) *StockAlertService {
	return &StockAlertService{
		db:            db,
		cooldownStore: cooldownStore,
		notifSvc:      notifSvc,
	}
}

// MaybeFireAlert reads the package's current stock state and emits an
// inventory_low or inventory_out notification when warranted. Skipped for
// unlimited (-1) packages, packages with low_stock_threshold=0 (alerts
// disabled by ops), and any (package, alertType) pair currently inside
// the cooldown window. Safe to call on any order create — it self-filters.
func (s *StockAlertService) MaybeFireAlert(packageID, productID uint, productName, packageName string, supplierID uint) {
	if s == nil || s.notifSvc == nil || s.cooldownStore == nil || packageID == 0 {
		return
	}

	var pkg productmodel.ProductPackage
	if err := s.db.First(&pkg, packageID).Error; err != nil {
		return
	}
	if pkg.StockTotal == -1 {
		return // unlimited — alerts meaningless
	}
	if pkg.LowStockThreshold == 0 {
		return // ops disabled
	}

	remaining := pkg.StockTotal - pkg.StockSold

	var alertType, title, content string
	switch {
	case remaining <= 0:
		alertType = "inventory_out"
		title = fmt.Sprintf("售罄：%s - %s", productName, packageName)
		content = "套餐已售罄。点击查看商品。"
	case remaining > 0 && remaining <= pkg.LowStockThreshold:
		alertType = "inventory_low"
		title = fmt.Sprintf("库存不足：%s - %s", productName, packageName)
		content = fmt.Sprintf("剩余 %d 份（阈值 %d）。点击查看商品。", remaining, pkg.LowStockThreshold)
	default:
		return // remaining > threshold, no alert needed
	}

	if !s.cooldownStore.TryClaim(packageID, alertType, stockAlertCooldown) {
		return // suppressed
	}

	_ = s.notifSvc.Send("supplier", supplierID, alertType, title, content, "product", productID)
}
