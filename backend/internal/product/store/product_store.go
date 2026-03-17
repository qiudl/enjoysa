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
	return s.db.Save(product).Error
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

func (s *ProductStore) list(filter ProductFilter) ([]model.Product, int64, error) {
	var products []model.Product
	var total int64

	query := s.db.Model(&model.Product{})

	if filter.RegionID > 0 {
		query = query.Where("region_id = ?", filter.RegionID)
	}
	if filter.CategoryID > 0 {
		query = query.Where("category_id = ?", filter.CategoryID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.SupplierID > 0 {
		query = query.Where("supplier_id = ?", filter.SupplierID)
	}
	if filter.Keyword != "" {
		kw := "%" + filter.Keyword + "%"
		query = query.Where("name_zh ILIKE ? OR name_en ILIKE ? OR summary_zh ILIKE ? OR summary_en ILIKE ?", kw, kw, kw, kw)
	}
	if filter.IsFeatured != nil {
		query = query.Where("is_featured = ?", *filter.IsFeatured)
	}

	query.Count(&total)

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
	if err := query.
		Preload("Region").
		Preload("Category").
		Preload("Images", func(db *gorm.DB) *gorm.DB { return db.Where("is_cover = ?", true).Limit(1) }).
		Offset(offset).Limit(pageSize).
		Order("sort_order ASC, id DESC").
		Find(&products).Error; err != nil {
		return nil, 0, err
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
