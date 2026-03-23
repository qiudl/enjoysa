package seed

import (
	"fmt"

	bannerModel "enjoysa-backend/internal/admin/handler"
)

func (s *Seeder) seedBanners() error {
	banners := []bannerModel.Banner{
		{
			TitleEn:    "Explore Kangaroo Island",
			TitleZh:    "探索袋鼠岛",
			SubtitleEn: "Discover Australia's Wildlife Paradise",
			SubtitleZh: "发现澳大利亚的野生动物天堂",
			Image:      bannerImage(0),
			LinkURL:    "/destinations/kangaroo-island",
			SortOrder:  1,
			Status:     "active",
		},
		{
			TitleEn:    "Barossa Wine Country",
			TitleZh:    "巴罗萨葡萄酒乡",
			SubtitleEn: "World-Class Wines, Unforgettable Experiences",
			SubtitleZh: "世界级美酒，难忘体验",
			Image:      bannerImage(1),
			LinkURL:    "/categories/wine",
			SortOrder:  2,
			Status:     "active",
		},
		{
			TitleEn:    "Adelaide City Highlights",
			TitleZh:    "阿德莱德城市精华",
			SubtitleEn: "Culture, Food & Urban Adventures",
			SubtitleZh: "文化、美食与城市探险",
			Image:      bannerImage(2),
			LinkURL:    "/destinations/adelaide",
			SortOrder:  3,
			Status:     "active",
		},
		{
			TitleEn:    "Murray River Adventure",
			TitleZh:    "墨累河探险",
			SubtitleEn: "Cruise Through Australia's Heartland",
			SubtitleZh: "穿越澳大利亚腹地",
			Image:      bannerImage(3),
			LinkURL:    "/destinations/murray",
			SortOrder:  4,
			Status:     "active",
		},
		{
			TitleEn:    "South Australia Wildlife",
			TitleZh:    "南澳野生动物",
			SubtitleEn: "Get Up Close with Iconic Australian Animals",
			SubtitleZh: "与澳洲标志性动物亲密接触",
			Image:      bannerImage(4),
			LinkURL:    "/categories/wildlife",
			SortOrder:  5,
			Status:     "active",
		},
	}

	if err := s.db.Create(&banners).Error; err != nil {
		return fmt.Errorf("insert banners: %w", err)
	}

	s.record("banners", len(banners))
	return nil
}
