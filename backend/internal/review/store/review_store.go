package store

import (
	"enjoysa-backend/internal/review/model"

	"gorm.io/gorm"
)

type ReviewStore struct {
	db *gorm.DB
}

func NewReviewStore(db *gorm.DB) *ReviewStore {
	return &ReviewStore{db: db}
}

type ReviewFilter struct {
	SupplierID uint
	ProductID  uint
	Status     string
	Rating     int
	HasReply   *bool
	Page       int
	PageSize   int
}

func (s *ReviewStore) Create(review *model.Review) error {
	return s.db.Create(review).Error
}

func (s *ReviewStore) GetByID(id uint) (*model.Review, error) {
	var review model.Review
	if err := s.db.Preload("User").Preload("Product").First(&review, id).Error; err != nil {
		return nil, err
	}
	return &review, nil
}

func (s *ReviewStore) GetByOrderID(orderID uint) (*model.Review, error) {
	var review model.Review
	if err := s.db.Where("order_id = ?", orderID).First(&review).Error; err != nil {
		return nil, err
	}
	return &review, nil
}

func (s *ReviewStore) ListBySupplier(filter ReviewFilter) ([]model.Review, int64, error) {
	var reviews []model.Review
	var total int64

	query := s.db.Model(&model.Review{}).Where("supplier_id = ?", filter.SupplierID)

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Rating > 0 {
		query = query.Where("rating = ?", filter.Rating)
	}
	if filter.HasReply != nil {
		if *filter.HasReply {
			query = query.Where("reply != ''")
		} else {
			query = query.Where("reply = '' OR reply IS NULL")
		}
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
		Preload("User").
		Preload("Product").
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	return reviews, total, nil
}

func (s *ReviewStore) ListByProduct(productID uint, page, pageSize int) ([]model.Review, int64, error) {
	var reviews []model.Review
	var total int64

	query := s.db.Model(&model.Review{}).
		Where("product_id = ? AND status = ?", productID, "published")

	query.Count(&total)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.
		Preload("User").
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	return reviews, total, nil
}

func (s *ReviewStore) GetStats(supplierID uint) (*model.ReviewStats, error) {
	var stats model.ReviewStats

	// Total and average
	row := s.db.Model(&model.Review{}).
		Where("supplier_id = ?", supplierID).
		Select("COUNT(*) as total_reviews, COALESCE(AVG(rating), 0) as avg_rating").
		Row()
	if err := row.Scan(&stats.TotalReviews, &stats.AvgRating); err != nil {
		return nil, err
	}

	// Replied count
	s.db.Model(&model.Review{}).
		Where("supplier_id = ? AND reply != '' AND reply IS NOT NULL", supplierID).
		Count(new(int64)).Row().Scan(&stats.RepliedCount)

	if stats.TotalReviews > 0 {
		stats.ReplyRate = float64(stats.RepliedCount) / float64(stats.TotalReviews) * 100
	}

	// Rating distribution
	type ratingCount struct {
		Rating int
		Count  int
	}
	var counts []ratingCount
	s.db.Model(&model.Review{}).
		Where("supplier_id = ?", supplierID).
		Select("rating, COUNT(*) as count").
		Group("rating").
		Find(&counts)

	for _, rc := range counts {
		switch rc.Rating {
		case 5:
			stats.Rating5 = rc.Count
		case 4:
			stats.Rating4 = rc.Count
		case 3:
			stats.Rating3 = rc.Count
		case 2:
			stats.Rating2 = rc.Count
		case 1:
			stats.Rating1 = rc.Count
		}
	}

	return &stats, nil
}

func (s *ReviewStore) UpdateReply(id uint, reply string, repliedBy uint) error {
	return s.db.Model(&model.Review{}).Where("id = ?", id).Updates(map[string]interface{}{
		"reply":      reply,
		"replied_at": gorm.Expr("NOW()"),
		"replied_by": repliedBy,
	}).Error
}

func (s *ReviewStore) UpdateStatus(id uint, status string) error {
	return s.db.Model(&model.Review{}).Where("id = ?", id).Update("status", status).Error
}

func (s *ReviewStore) ListAll(page, pageSize int, status string) ([]model.Review, int64, error) {
	var reviews []model.Review
	var total int64

	query := s.db.Model(&model.Review{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.
		Preload("User").
		Preload("Product").
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	return reviews, total, nil
}
