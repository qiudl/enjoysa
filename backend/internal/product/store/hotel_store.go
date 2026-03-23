package store

import (
	"fmt"
	"strings"

	"enjoysa-backend/internal/product/model"

	"gorm.io/gorm"
)

type HotelStore struct {
	db *gorm.DB
}

func NewHotelStore(db *gorm.DB) *HotelStore {
	return &HotelStore{db: db}
}

type HotelFilter struct {
	RegionID          uint
	Keyword           string
	MinPrice          float64
	MaxPrice          float64
	StarRatings       []int    // e.g. [4, 5]
	AccommodationTypes []string // e.g. ["hotel", "bnb"]
	Facilities        []string // e.g. ["pool", "wifi"]
	SortBy            string   // recommend, price_asc, price_desc, rating, distance
	Page              int
	PageSize          int
}

func (s *HotelStore) Search(filter HotelFilter) ([]model.Product, int64, error) {
	// Find accommodation category ID
	var cat model.Category
	if err := s.db.Where("slug = ?", "accommodation").First(&cat).Error; err != nil {
		return nil, 0, fmt.Errorf("accommodation category not found: %w", err)
	}

	tx := s.db.Model(&model.Product{}).Where("category_id = ? AND status = ?", cat.ID, "approved")

	if filter.RegionID > 0 {
		tx = tx.Where("region_id = ?", filter.RegionID)
	}
	if filter.Keyword != "" {
		kw := "%" + filter.Keyword + "%"
		tx = tx.Where("(name_zh ILIKE ? OR name_en ILIKE ? OR address_zh ILIKE ? OR address_en ILIKE ?)", kw, kw, kw, kw)
	}
	if filter.MinPrice > 0 {
		tx = tx.Where("price_from >= ?", filter.MinPrice)
	}
	if filter.MaxPrice > 0 {
		tx = tx.Where("price_from <= ?", filter.MaxPrice)
	}
	if len(filter.StarRatings) > 0 {
		placeholders := make([]string, len(filter.StarRatings))
		for i, r := range filter.StarRatings {
			placeholders[i] = fmt.Sprintf("'%d'", r)
		}
		tx = tx.Where("metadata->>'star_rating' IN (" + strings.Join(placeholders, ",") + ")")
	}
	if len(filter.AccommodationTypes) > 0 {
		tx = tx.Where("metadata->>'accommodation_type' IN ?", filter.AccommodationTypes)
	}
	if len(filter.Facilities) > 0 {
		for _, f := range filter.Facilities {
			tx = tx.Where("metadata->'facilities' @> ?", fmt.Sprintf(`["%s"]`, f))
		}
	}

	var total int64
	tx.Count(&total)

	// Sorting
	switch filter.SortBy {
	case "price_asc":
		tx = tx.Order("price_from ASC")
	case "price_desc":
		tx = tx.Order("price_from DESC")
	case "rating":
		tx = tx.Order("rating DESC")
	case "distance":
		tx = tx.Order("COALESCE((metadata->>'distance_to_center')::float, 999) ASC")
	default:
		tx = tx.Order("sort_order ASC, rating DESC, id DESC")
	}

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

	var products []model.Product
	if err := tx.
		Preload("Supplier").
		Preload("Region").
		Preload("Category").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&products).Error; err != nil {
		return nil, 0, err
	}

	// Load cover images
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
