package seed

import (
	"encoding/json"
	"fmt"

	"enjoysa-backend/internal/homepage"

	"gorm.io/datatypes"
)

func (s *Seeder) seedHomepage() error {
	// === Features (Why Choose Us) ===
	features := []homepage.HomepageFeature{
		{Icon: "🇨🇳", TitleZh: "本地专家", TitleEn: "Local Expert", DescZh: "深耕南澳多年，为您提供最地道的旅行体验", DescEn: "Years of local expertise to provide the most authentic travel experience", SortOrder: 1, Status: "active"},
		{Icon: "💳", TitleZh: "超值价格", TitleEn: "Best Price", DescZh: "直连供应商，去除中间环节，享受最优价格", DescEn: "Direct supplier connections, no middlemen, enjoy the best prices", SortOrder: 2, Status: "active"},
		{Icon: "⭐", TitleZh: "轻松预订", TitleEn: "Easy Booking", DescZh: "即时确认，灵活取消，中文客服全程支持", DescEn: "Instant confirmation, flexible cancellation, bilingual support", SortOrder: 3, Status: "active"},
		{Icon: "💰", TitleZh: "全天候服务", TitleEn: "24/7 Support", DescZh: "中英文双语客服，随时解答您的旅行疑问", DescEn: "Bilingual support team, always ready to assist with your travel needs", SortOrder: 4, Status: "active"},
	}
	for i := range features {
		result := s.db.Where("title_en = ?", features[i].TitleEn).FirstOrCreate(&features[i])
		if result.Error != nil {
			return fmt.Errorf("upsert homepage feature: %w", result.Error)
		}
	}
	s.record("homepage_features", len(features))

	// === Testimonials ===
	testimonials := []homepage.HomepageTestimonial{
		{Source: "manual", AuthorName: "王小明", ContentZh: "袋鼠岛一日游太棒了！导游非常专业，还帮我们拍了很多好看的照片。强烈推荐！", ContentEn: "The Kangaroo Island day tour was amazing! The guide was very professional and took many great photos for us. Highly recommended!", Rating: 5, ProductNameZh: "袋鼠岛一日游", ProductNameEn: "Kangaroo Island Day Tour", SortOrder: 1, Status: "active"},
		{Source: "manual", AuthorName: "Sarah Chen", ContentZh: "巴罗萨酒庄之旅让我和朋友们度过了愉快的一天，品尝了很多优质葡萄酒，还参观了酒庄的酿造过程。", ContentEn: "The Barossa winery tour gave my friends and I a wonderful day. We tasted many quality wines and toured the winemaking process.", Rating: 5, ProductNameZh: "巴罗萨酒庄一日游", ProductNameEn: "Barossa Valley Wine Tour", SortOrder: 2, Status: "active"},
		{Source: "manual", AuthorName: "李婷", ContentZh: "带孩子参加了野生动物园半日游，孩子们特别开心，近距离接触了考拉和袋鼠。客服沟通也非常及时。", ContentEn: "Took the kids on the wildlife park half-day tour. They were so happy to get up close with koalas and kangaroos. Customer service was very responsive.", Rating: 5, ProductNameZh: "克莱兰德野生动物园", ProductNameEn: "Cleland Wildlife Park", SortOrder: 3, Status: "active"},
		{Source: "manual", AuthorName: "Mike Zhang", ContentZh: "阿德莱德城市徒步游很有意义，了解了很多历史文化。价格也很合理，性价比很高。", ContentEn: "The Adelaide city walking tour was very meaningful, learned a lot about history and culture. Great value for money.", Rating: 4, ProductNameZh: "阿德莱德城市徒步", ProductNameEn: "Adelaide City Walking Tour", SortOrder: 4, Status: "active"},
	}
	for i := range testimonials {
		result := s.db.Where("author_name = ? AND product_name_en = ?", testimonials[i].AuthorName, testimonials[i].ProductNameEn).FirstOrCreate(&testimonials[i])
		if result.Error != nil {
			return fmt.Errorf("upsert homepage testimonial: %w", result.Error)
		}
	}
	s.record("homepage_testimonials", len(testimonials))

	// === Partners (repurposed as "Destinations across South Australia" — council badges link to region pages) ===
	// Remove the legacy Unsplash-placeholder partners replaced by this rework so the homepage
	// doesn't show 15 logos (5 stale + 10 new) on already-seeded environments.
	legacyPartnerNames := []string{
		"South Australian Tourism Commission",
		"Tourism Australia",
		"Adelaide Airport",
		"Kangaroo Island Tours",
		"Barossa Wine Region",
	}
	if err := s.db.Where("name IN ?", legacyPartnerNames).Delete(&homepage.HomepagePartner{}).Error; err != nil {
		return fmt.Errorf("delete legacy homepage partners: %w", err)
	}

	partners := []homepage.HomepagePartner{
		{Name: "City of Adelaide", Logo: "/images/councils/adelaide.svg", Website: "/regions/adelaide", SortOrder: 1, Status: "active"},
		{Name: "Adelaide Hills Council", Logo: "/images/councils/adelaide-hills.png", Website: "/regions/adelaide-hills", SortOrder: 2, Status: "active"},
		{Name: "The Barossa Council", Logo: "/images/councils/barossa.png", Website: "/regions/barossa", SortOrder: 3, Status: "active"},
		{Name: "City of Onkaparinga", Logo: "/images/councils/onkaparinga.png", Website: "/regions/fleurieu", SortOrder: 4, Status: "active"},
		{Name: "Alexandrina Council", Logo: "/images/councils/alexandrina.png", Website: "/regions/fleurieu", SortOrder: 5, Status: "active"},
		{Name: "City of Victor Harbor", Logo: "/images/councils/victor-harbor.png", Website: "/regions/fleurieu", SortOrder: 6, Status: "active"},
		{Name: "Yorke Peninsula Council", Logo: "/images/councils/yorke-peninsula.png", Website: "/regions/yorke-peninsula", SortOrder: 7, Status: "active"},
		{Name: "Kangaroo Island Council", Logo: "/images/councils/kangaroo-island.png", Website: "/regions/kangaroo-island", SortOrder: 8, Status: "active"},
		{Name: "Flinders Ranges Council", Logo: "/images/councils/flinders-ranges.jpg", Website: "/regions/flinders", SortOrder: 9, Status: "active"},
		{Name: "City of Mount Gambier", Logo: "/images/councils/mount-gambier.jpg", Website: "/regions/limestone-coast", SortOrder: 10, Status: "active"},
	}
	for i := range partners {
		result := s.db.Where("name = ?", partners[i].Name).FirstOrCreate(&partners[i])
		if result.Error != nil {
			return fmt.Errorf("upsert homepage partner: %w", result.Error)
		}
		// Force-update logo + website + sort_order to current source-of-truth (allows changing Unsplash → /uploads → /images/councils)
		if err := s.db.Model(&homepage.HomepagePartner{}).Where("name = ?", partners[i].Name).Updates(map[string]interface{}{
			"logo":       partners[i].Logo,
			"website":    partners[i].Website,
			"sort_order": partners[i].SortOrder,
			"status":     partners[i].Status,
		}).Error; err != nil {
			return fmt.Errorf("update homepage partner: %w", err)
		}
	}
	s.record("homepage_partners", len(partners))

	// === Modules config ===
	popularCfg, _ := json.Marshal(map[string]int{"limit": 8})
	modules := []homepage.HomepageModule{
		{ModuleKey: "banner", TitleZh: "轮播横幅", TitleEn: "Banner", SortOrder: 1, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "search", TitleZh: "搜索", TitleEn: "Search", SortOrder: 2, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "regions", TitleZh: "热门目的地", TitleEn: "Popular Destinations", SortOrder: 3, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "featured", TitleZh: "精选产品", TitleEn: "Featured Products", SortOrder: 4, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "categories", TitleZh: "体验分类", TitleEn: "Categories", SortOrder: 5, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "features", TitleZh: "为什么选择我们", TitleEn: "Why Choose Us", SortOrder: 6, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "testimonials", TitleZh: "用户评价", TitleEn: "Testimonials", SortOrder: 7, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "partners", TitleZh: "南澳各地", TitleEn: "Destinations", SortOrder: 8, IsVisible: true, Config: datatypes.JSON([]byte("{}"))},
		{ModuleKey: "popular", TitleZh: "热门活动", TitleEn: "Popular Activities", SortOrder: 9, IsVisible: true, Config: datatypes.JSON(popularCfg)},
	}
	for i := range modules {
		result := s.db.Where("module_key = ?", modules[i].ModuleKey).FirstOrCreate(&modules[i])
		if result.Error != nil {
			return fmt.Errorf("upsert homepage module: %w", result.Error)
		}
	}
	s.record("homepage_modules", len(modules))

	return nil
}
