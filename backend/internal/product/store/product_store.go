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
