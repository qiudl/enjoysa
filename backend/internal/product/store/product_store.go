package store

import (
	"errors"
	"sort"

	"enjoysa-backend/internal/product/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrInsufficientStock — REQ-20260509-0035 — surfaced to handler as 422
// INSUFFICIENT_STOCK so the frontend can show a "库存不足" toast.
var ErrInsufficientStock = errors.New("insufficient stock")

// REQ-20260509-0035 Phase 3b — batch stock adjustment sentinel errors. The
// handler maps each to a specific 422 code so the frontend can render the
// right toast (which IDs missing / forbidden / below-sold).
var (
	ErrBatchProductNotFound = errors.New("batch product not found")
	ErrBatchForbidden       = errors.New("batch forbidden")
	ErrBatchBelowSold       = errors.New("batch below sold")
)

// BatchAdjustStockOp — list-page batch toolbar operation set. Mirrors the
// 4 PRD options: 全部 +N / 全部 -N / 全部设为 N / 一键归零.
type BatchAdjustStockOp string

const (
	BatchAdjustStockAdd  BatchAdjustStockOp = "add"
	BatchAdjustStockSub  BatchAdjustStockOp = "sub"
	BatchAdjustStockSet  BatchAdjustStockOp = "set"
	BatchAdjustStockZero BatchAdjustStockOp = "zero"
)

// BatchAdjustStockChange — per-package before/after for the audit trail
// (defect-analysis #4: bulk audit needs per-row detail to support post-hoc
// customer disputes).
type BatchAdjustStockChange struct {
	ProductID uint `json:"product_id"`
	PackageID uint `json:"package_id"`
	Before    int  `json:"before"`
	After     int  `json:"after"`
}

// BatchAdjustStockConflict — populated when a set/zero would push
// stock_total below the package's already-committed stock_sold. Surfaced
// as 422 STOCK_BELOW_SOLD with the full conflict list so ops can decide
// which orders to cancel before retrying.
type BatchAdjustStockConflict struct {
	ProductID      uint `json:"product_id"`
	PackageID      uint `json:"package_id"`
	StockSold      int  `json:"stock_sold"`
	RequestedTotal int  `json:"requested_total"`
}

// BatchAdjustStockResult — summary + change list + conflict list. Returned
// in both success and 422 paths so handler can attach data to the
// response without an extra round-trip.
type BatchAdjustStockResult struct {
	UpdatedProducts     int                        `json:"updated_products"`
	UpdatedPackages     int                        `json:"updated_packages"`
	SkippedUnlimited    int                        `json:"skipped_unlimited"`
	AffectedProductIDs  []uint                     `json:"affected_product_ids"`
	Changes             []BatchAdjustStockChange   `json:"-"`
	MissingIDs          []uint                     `json:"-"`
	ForbiddenIDs        []uint                     `json:"-"`
	ConflictingPackages []BatchAdjustStockConflict `json:"-"`
}

type ProductStore struct {
	db *gorm.DB
}

func NewProductStore(db *gorm.DB) *ProductStore {
	return &ProductStore{db: db}
}

type ProductFilter struct {
	RegionID   uint
	CategoryID uint
	Status     string
	SupplierID uint
	Keyword    string
	IsFeatured *bool
	Page       int
	PageSize   int
}

func (s *ProductStore) Create(product *model.Product) error {
	return s.db.Create(product).Error
}

func (s *ProductStore) Update(product *model.Product) error {
	// FullSaveAssociations 确保 HasMany 关联（Images / Packages / Highlights / FAQs / Schedules）
	// 在 Save 时会被完整 upsert——不开启时新建子行（ID=0）有概率不被持久化，
	// 表现为：管理员/供应商在编辑页上传图片后保存，刷新后图片消失。
	return s.db.Session(&gorm.Session{FullSaveAssociations: true}).Save(product).Error
}

func (s *ProductStore) GetByID(id uint) (*model.Product, error) {
	var product model.Product
	if err := s.db.
		Preload("Supplier").
		Preload("Region").
		Preload("Category").
		Preload("Images", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC") }).
		Preload("Packages", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC") }).
		Preload("Highlights", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC") }).
		Preload("FAQs", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC") }).
		First(&product, id).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (s *ProductStore) Delete(id uint) error {
	return s.db.Delete(&model.Product{}, id).Error
}

func (s *ProductStore) ListPublic(filter ProductFilter) ([]model.Product, int64, error) {
	filter.Status = string(model.ProductStatusApproved)
	return s.list(filter)
}

func (s *ProductStore) ListBySupplier(supplierID uint, filter ProductFilter) ([]model.Product, int64, error) {
	filter.SupplierID = supplierID
	return s.list(filter)
}

func (s *ProductStore) ListAll(filter ProductFilter) ([]model.Product, int64, error) {
	return s.list(filter)
}

func (s *ProductStore) applyFilter(tx *gorm.DB, filter ProductFilter) *gorm.DB {
	if filter.RegionID > 0 {
		tx = tx.Where("region_id = ?", filter.RegionID)
	}
	if filter.CategoryID > 0 {
		tx = tx.Where("category_id = ?", filter.CategoryID)
	}
	if filter.Status != "" {
		tx = tx.Where("status = ?", filter.Status)
	}
	if filter.SupplierID > 0 {
		tx = tx.Where("supplier_id = ?", filter.SupplierID)
	}
	if filter.Keyword != "" {
		kw := "%" + filter.Keyword + "%"
		tx = tx.Where("name_zh ILIKE ? OR name_en ILIKE ? OR summary_zh ILIKE ? OR summary_en ILIKE ?", kw, kw, kw, kw)
	}
	if filter.IsFeatured != nil {
		tx = tx.Where("is_featured = ?", *filter.IsFeatured)
	}
	return tx
}

func (s *ProductStore) list(filter ProductFilter) ([]model.Product, int64, error) {
	var products []model.Product
	var total int64

	// Count with a fresh session
	s.applyFilter(s.db.Model(&model.Product{}), filter).Count(&total)

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize
	// Find products
	query := s.applyFilter(s.db.Session(&gorm.Session{NewDB: true}), filter)
	if err := query.
		Preload("Supplier").
		Preload("Region").
		Preload("Category").
		Offset(offset).Limit(pageSize).
		Order("sort_order ASC, id DESC").
		Find(&products).Error; err != nil {
		return nil, 0, err
	}

	// Manually load cover images for all products
	if len(products) > 0 {
		ids := make([]uint, len(products))
		for i, p := range products {
			ids[i] = p.ID
		}
		var images []model.ProductImage
		s.db.Where("product_id IN ? AND is_cover = ?", ids, true).Find(&images)
		imageMap := make(map[uint][]model.ProductImage)
		for _, img := range images {
			imageMap[img.ProductID] = append(imageMap[img.ProductID], img)
		}
		for i := range products {
			products[i].Images = imageMap[products[i].ID]
		}
	}

	return products, total, nil
}

func (s *ProductStore) UpdateStatus(id uint, status model.ProductStatus) error {
	return s.db.Model(&model.Product{}).Where("id = ?", id).Update("status", status).Error
}

// DB exposes the underlying connection so callers can compose multi-table
// transactions (e.g. submit-for-review enqueues a translation task in the
// same commit as the product status flip).
func (s *ProductStore) DB() *gorm.DB {
	return s.db
}

// translatedColumnByKey maps the abstract field names used by the translation
// pipeline ("name", "summary", "description", "address") to concrete *_zh
// columns on the products table. Unknown keys are dropped silently so a
// future field addition on the LLM side cannot accidentally write to a column
// that doesn't exist.
var translatedColumnByKey = map[string]string{
	"name":        "name_zh",
	"summary":     "summary_zh",
	"description": "description_zh",
	"address":     "address_zh",
}

// translatedColumnByKeyEn is the ZH→EN counterpart used by the admin
// translation pipeline (REQ-20260509-0004). Same canonical keys as the
// EN→ZH map so the prompt and JSON contract stay identical.
var translatedColumnByKeyEn = map[string]string{
	"name":        "name_en",
	"summary":     "summary_en",
	"description": "description_en",
	"address":     "address_en",
}

// UpdateTranslatedFields writes LLM translation results back to the *_zh
// columns. Kept as the EN→ZH default to preserve the existing supplier
// pipeline (REQ-20260508-0002). Implements translation.ProductFieldUpdater
// for backward compatibility — direction-aware updates go through
// UpdateTranslatedFieldsForDirection.
func (s *ProductStore) UpdateTranslatedFields(productID uint, fields map[string]string) error {
	return s.updateTranslatedColumns(productID, fields, translatedColumnByKey, "")
}

// UpdateTranslatedFieldsForDirection writes the LLM output to either *_zh or
// *_en columns based on the translation direction. Worker writeback also
// flips the matching auto_generated_* flag so admin lists can surface
// AI-touched content for review.
//   - zh2en → *_en columns, auto_generated_en=true (REQ-20260509-0004)
//   - en2zh → *_zh columns, auto_generated_zh=true (REQ-20260509-0015)
func (s *ProductStore) UpdateTranslatedFieldsForDirection(productID uint, direction string, fields map[string]string) error {
	if direction == "zh2en" {
		return s.updateTranslatedColumns(productID, fields, translatedColumnByKeyEn, "auto_generated_en")
	}
	return s.updateTranslatedColumns(productID, fields, translatedColumnByKey, "auto_generated_zh")
}

func (s *ProductStore) updateTranslatedColumns(productID uint, fields map[string]string, keyMap map[string]string, markAutoGeneratedColumn string) error {
	if len(fields) == 0 {
		return nil
	}
	updates := make(map[string]interface{}, len(fields)+1)
	for k, v := range fields {
		col, ok := keyMap[k]
		if !ok {
			continue
		}
		updates[col] = v
	}
	if len(updates) == 0 {
		return nil
	}
	if markAutoGeneratedColumn != "" {
		updates[markAutoGeneratedColumn] = true
	}
	return s.db.Model(&model.Product{}).Where("id = ?", productID).Updates(updates).Error
}

// ListZhOnlyProductIDs returns IDs of products with non-empty ZH content but
// at least one core *_en field still empty, excluding admin-locked rows.
// Used by the cmd/backfill-en CLI to enqueue ZH→EN translation for the
// historical inventory in REQ-20260509-0004.
func (s *ProductStore) ListZhOnlyProductIDs(limit int) ([]uint, error) {
	var ids []uint
	tx := s.db.Model(&model.Product{}).
		Where("manual_override_en = false").
		Where("name_zh <> ''").
		Where("(name_en = '' OR description_en = '' OR summary_en = '')").
		Order("id ASC")
	if limit > 0 {
		tx = tx.Limit(limit)
	}
	if err := tx.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

// GetTranslationFlags reads the manual_override_* / auto_generated_* flags
// for the side relevant to the requested direction:
//   - zh2en → returns manual_override_en / auto_generated_en (gate for ZH→EN)
//   - en2zh → returns manual_override_zh / auto_generated_zh (gate for EN→ZH)
//
// Hot path for the translation enqueue gate; reads only the four flag columns
// to skip loading associations.
func (s *ProductStore) GetTranslationFlags(productID uint, direction string) (manualOverride bool, autoGenerated bool, err error) {
	var row struct {
		ManualOverrideEn bool
		AutoGeneratedEn  bool
		ManualOverrideZh bool
		AutoGeneratedZh  bool
	}
	err = s.db.Model(&model.Product{}).
		Select("manual_override_en", "auto_generated_en", "manual_override_zh", "auto_generated_zh").
		Where("id = ?", productID).
		Take(&row).Error
	if err != nil {
		return false, false, err
	}
	if direction == "en2zh" {
		return row.ManualOverrideZh, row.AutoGeneratedZh, nil
	}
	return row.ManualOverrideEn, row.AutoGeneratedEn, nil
}

func (s *ProductStore) RejectWithReason(id uint, reason string) error {
	return s.db.Model(&model.Product{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":        model.ProductStatusRejected,
		"reject_reason": reason,
	}).Error
}

// DeleteRelated deletes all related entities for a product
func (s *ProductStore) DeleteRelated(productID uint) error {
	s.db.Where("product_id = ?", productID).Delete(&model.ProductImage{})
	s.db.Where("product_id = ?", productID).Delete(&model.ProductPackage{})
	s.db.Where("product_id = ?", productID).Delete(&model.ProductHighlight{})
	s.db.Where("product_id = ?", productID).Delete(&model.ProductFAQ{})
	s.db.Where("product_id = ?", productID).Delete(&model.ProductSchedule{})
	return nil
}

// DecrementPackageStock atomically reserves `qty` units from a package
// (REQ-20260509-0035). Uses conditional UPDATE WHERE stock_total = -1 OR
// stock_sold + qty <= stock_total — concurrency-safe without an explicit
// row lock. Returns ErrInsufficientStock if no row matched (sold out or
// not enough remaining). Mirrors ScheduleStore.DecrementSlot pattern.
//
// `tx` lets the caller include this update in the order-creation
// transaction so a failed order create rolls back the reservation.
func (s *ProductStore) DecrementPackageStock(tx *gorm.DB, packageID uint, qty int) error {
	if tx == nil {
		tx = s.db
	}
	res := tx.Model(&model.ProductPackage{}).
		Where("id = ? AND (stock_total = -1 OR stock_sold + ? <= stock_total)", packageID, qty).
		Update("stock_sold", gorm.Expr("stock_sold + ?", qty))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrInsufficientStock
	}
	return nil
}

// IncrementPackageStock refunds `qty` units when an order is cancelled
// (REQ-20260509-0035). Skipped for unlimited packages (stock_total = -1)
// where stock_sold is not tracked. min(0) guard via GREATEST() in case
// of stale data — never go negative.
func (s *ProductStore) IncrementPackageStock(tx *gorm.DB, packageID uint, qty int) error {
	if tx == nil {
		tx = s.db
	}
	return tx.Model(&model.ProductPackage{}).
		Where("id = ? AND stock_total != -1", packageID).
		Update("stock_sold", gorm.Expr("GREATEST(stock_sold - ?, 0)", qty)).Error
}

// BatchAdjustStock applies a batch stock operation to all packages of the
// given product IDs in a single transaction (REQ-20260509-0035 Phase 3b).
//
// owner != nil restricts the batch to products with supplier_id == *owner
// (supplier path). Admin path passes nil.
//
// Concurrency: the package SELECT uses FOR UPDATE + ORDER BY id ASC so
// two concurrent batches with overlapping product IDs always lock rows in
// the same global order, eliminating deadlocks. Order-creation uses a
// conditional UPDATE which takes the same row lock; PostgreSQL serializes
// the two paths so this batch cannot leave the system in a state where
// stock_total < stock_sold mid-flight (defect-analysis #1).
//
// Operation semantics (mirror single-row UpdatePackageStock):
//   - add (value>0): stock_total = -1 silently skipped; else += value
//   - sub (value>0): stock_total = -1 silently skipped; else
//     max(stock_sold, stock_total - value) (never below already-sold)
//   - set (value>=0): all packages overwritten, including -1 unlimited.
//     Returns ErrBatchBelowSold if any package has stock_sold > value.
//   - zero: equivalent to set 0; same below-sold guard.
func (s *ProductStore) BatchAdjustStock(productIDs []uint, op BatchAdjustStockOp, value int, owner *uint) (BatchAdjustStockResult, error) {
	var result BatchAdjustStockResult
	if len(productIDs) == 0 {
		return result, errors.New("empty productIDs")
	}

	// Sorted dedup — defense-in-depth + lock ordering. The handler also
	// sorts but we re-sort here so a misbehaving caller can't bypass it.
	seen := make(map[uint]struct{}, len(productIDs))
	sortedIDs := make([]uint, 0, len(productIDs))
	for _, id := range productIDs {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		sortedIDs = append(sortedIDs, id)
	}
	sort.Slice(sortedIDs, func(i, j int) bool { return sortedIDs[i] < sortedIDs[j] })

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 1) Validate existence + ownership.
		var products []model.Product
		if err := tx.Select("id", "supplier_id").
			Where("id IN ?", sortedIDs).
			Find(&products).Error; err != nil {
			return err
		}
		foundOwner := make(map[uint]uint, len(products))
		for _, p := range products {
			foundOwner[p.ID] = p.SupplierID
		}
		for _, id := range sortedIDs {
			if _, ok := foundOwner[id]; !ok {
				result.MissingIDs = append(result.MissingIDs, id)
			}
		}
		if len(result.MissingIDs) > 0 {
			return ErrBatchProductNotFound
		}
		if owner != nil {
			for _, id := range sortedIDs {
				if foundOwner[id] != *owner {
					result.ForbiddenIDs = append(result.ForbiddenIDs, id)
				}
			}
			if len(result.ForbiddenIDs) > 0 {
				return ErrBatchForbidden
			}
		}

		// 2) Lock all packages with consistent global order.
		var pkgs []model.ProductPackage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("product_id IN ?", sortedIDs).
			Order("id ASC").
			Find(&pkgs).Error; err != nil {
			return err
		}

		// 3) For set/zero, pre-collect ALL below-sold conflicts so the
		// frontend gets the full picture in one shot.
		if op == BatchAdjustStockSet || op == BatchAdjustStockZero {
			target := value
			if op == BatchAdjustStockZero {
				target = 0
			}
			for _, p := range pkgs {
				if target < p.StockSold {
					result.ConflictingPackages = append(result.ConflictingPackages, BatchAdjustStockConflict{
						ProductID:      p.ProductID,
						PackageID:      p.ID,
						StockSold:      p.StockSold,
						RequestedTotal: target,
					})
				}
			}
			if len(result.ConflictingPackages) > 0 {
				return ErrBatchBelowSold
			}
		}

		// 4) Apply per package. Skip unchanged rows so the change list
		// reflects actual writes.
		affected := make(map[uint]struct{})
		for _, p := range pkgs {
			var newTotal int
			switch op {
			case BatchAdjustStockAdd:
				if p.StockTotal == -1 {
					result.SkippedUnlimited++
					continue
				}
				newTotal = p.StockTotal + value
			case BatchAdjustStockSub:
				if p.StockTotal == -1 {
					result.SkippedUnlimited++
					continue
				}
				newTotal = p.StockTotal - value
				if newTotal < p.StockSold {
					newTotal = p.StockSold
				}
			case BatchAdjustStockSet:
				newTotal = value
			case BatchAdjustStockZero:
				newTotal = 0
			default:
				return errors.New("unknown op")
			}
			if newTotal == p.StockTotal {
				continue
			}
			if err := tx.Model(&model.ProductPackage{}).
				Where("id = ?", p.ID).
				Update("stock_total", newTotal).Error; err != nil {
				return err
			}
			result.Changes = append(result.Changes, BatchAdjustStockChange{
				ProductID: p.ProductID,
				PackageID: p.ID,
				Before:    p.StockTotal,
				After:     newTotal,
			})
			result.UpdatedPackages++
			affected[p.ProductID] = struct{}{}
		}

		result.UpdatedProducts = len(affected)
		result.AffectedProductIDs = make([]uint, 0, len(affected))
		for id := range affected {
			result.AffectedProductIDs = append(result.AffectedProductIDs, id)
		}
		sort.Slice(result.AffectedProductIDs, func(i, j int) bool {
			return result.AffectedProductIDs[i] < result.AffectedProductIDs[j]
		})

		return nil
	})

	return result, err
}

// PopulateCreatedByAdminName looks up the admin name for an admin_proxy
// product and stores it on the transient field. Best-effort: silently
// returns when the product was not admin-created, when the admin row is
// missing (deleted via ON DELETE SET NULL), or when the lookup errors.
// Avoids importing internal/auth/* here by hitting the admins table via
// a raw column select.
func (s *ProductStore) PopulateCreatedByAdminName(p *model.Product) {
	if p == nil || p.CreatedVia != "admin_proxy" || p.CreatedByAdminID == nil {
		return
	}
	var name string
	s.db.Table("admins").
		Where("id = ?", *p.CreatedByAdminID).
		Pluck("name", &name)
	p.CreatedByAdminName = name
}
