package store

import (
	"enjoysa-backend/internal/product/model"

	"gorm.io/gorm"
)

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
	return s.updateTranslatedColumns(productID, fields, translatedColumnByKey, false)
}

// UpdateTranslatedFieldsForDirection writes the LLM output to either *_zh or
// *_en columns based on the translation direction. ZH→EN writes also flip
// auto_generated_en=true so the admin list can surface AI-touched products.
func (s *ProductStore) UpdateTranslatedFieldsForDirection(productID uint, direction string, fields map[string]string) error {
	if direction == "zh2en" {
		return s.updateTranslatedColumns(productID, fields, translatedColumnByKeyEn, true)
	}
	return s.updateTranslatedColumns(productID, fields, translatedColumnByKey, false)
}

func (s *ProductStore) updateTranslatedColumns(productID uint, fields map[string]string, keyMap map[string]string, markAutoGeneratedEn bool) error {
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
	if markAutoGeneratedEn {
		updates["auto_generated_en"] = true
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

// GetTranslationFlags reads just the manual_override_en / auto_generated_en
// flags without loading the whole row + associations. Hot path for the
// translation enqueue gate.
func (s *ProductStore) GetTranslationFlags(productID uint) (manualOverride bool, autoGenerated bool, err error) {
	var row struct {
		ManualOverrideEn bool
		AutoGeneratedEn  bool
	}
	err = s.db.Model(&model.Product{}).
		Select("manual_override_en", "auto_generated_en").
		Where("id = ?", productID).
		Take(&row).Error
	return row.ManualOverrideEn, row.AutoGeneratedEn, err
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
