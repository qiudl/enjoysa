package seed

import (
	productmodel "enjoysa-backend/internal/product/model"
)

// seedCategories is init-only: categories are managed by admin CMS at runtime
// (admin can edit/add/delete categories from /admin/categories), so seed must
// not overwrite admin changes. If any categories already exist, skip entirely.
func (s *Seeder) seedCategories() error {
	var existing int64
	if err := s.db.Model(&productmodel.Category{}).Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		s.record("categories", 0)
		return nil
	}

	categories := []productmodel.Category{
		{
			Slug:      "day-tours",
			NameZh:    "一日游",
			NameEn:    "Day Tours",
			Icon:      "\U0001F68C", // bus
			SortOrder: 1,
		},
		{
			Slug:      "wine",
			NameZh:    "酒庄品鉴",
			NameEn:    "Wine & Spirits",
			Icon:      "\U0001F377", // wine glass
			SortOrder: 2,
		},
		{
			Slug:      "wildlife",
			NameZh:    "野生动物",
			NameEn:    "Wildlife",
			Icon:      "\U0001F428", // koala
			SortOrder: 3,
		},
		{
			Slug:      "adventure",
			NameZh:    "户外冒险",
			NameEn:    "Adventure",
			Icon:      "\U0001F3D4\uFE0F", // mountain
			SortOrder: 4,
		},
		{
			Slug:      "cruise",
			NameZh:    "游船",
			NameEn:    "Cruises",
			Icon:      "\U0001F6A2", // ship
			SortOrder: 5,
		},
		{
			Slug:      "culture",
			NameZh:    "文化体验",
			NameEn:    "Culture",
			Icon:      "\U0001F3AD", // performing arts
			SortOrder: 6,
		},
		{
			Slug:      "accommodation",
			NameZh:    "住宿",
			NameEn:    "Accommodation",
			Icon:      "\U0001F3E8", // hotel
			SortOrder: 7,
		},
	}

	if err := s.db.Create(&categories).Error; err != nil {
		return err
	}
	s.record("categories", len(categories))
	return nil
}
