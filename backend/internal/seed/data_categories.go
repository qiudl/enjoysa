package seed

import (
	productmodel "enjoysa-backend/internal/product/model"
)

func (s *Seeder) seedCategories() error {
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

	count := 0
	for _, c := range categories {
		result := s.db.Where("slug = ?", c.Slug).FirstOrCreate(&c)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			count++
		} else {
			// Record exists — update fields
			if err := s.db.Model(&productmodel.Category{}).Where("slug = ?", c.Slug).Updates(map[string]interface{}{
				"name_zh":    c.NameZh,
				"name_en":    c.NameEn,
				"icon":       c.Icon,
				"sort_order": c.SortOrder,
			}).Error; err != nil {
				return err
			}
			count++
		}
	}

	s.record("categories", count)
	return nil
}
