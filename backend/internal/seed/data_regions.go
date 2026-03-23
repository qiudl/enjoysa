package seed

import (
	productmodel "enjoysa-backend/internal/product/model"
)

func (s *Seeder) seedRegions() error {
	regions := []productmodel.Region{
		{
			Slug:            "adelaide",
			NameZh:          "阿德莱德",
			NameEn:          "Adelaide",
			DescZh:          "南澳大利亚州首府，以其优雅的殖民时期建筑、世界级的美食美酒和充满活力的艺术文化而闻名。城市紧凑而精致，步行即可探索中央市场、北大街文化区和托伦斯河畔的迷人风光。",
			DescEn:          "Capital of South Australia, renowned for its elegant colonial architecture, world-class food and wine scene, and vibrant arts culture. Compact yet sophisticated, the city offers the Central Market, North Terrace cultural precinct, and the charming River Torrens—all within walking distance.",
			TaglineZh:       "优雅之都，美食与文化的交汇",
			TaglineEn:       "An Elegant City Where Food Meets Culture",
			Image:           regionImage(0),
			SortOrder:       1,
			AttractionCount: 25,
		},
		{
			Slug:            "adelaide-hills",
			NameZh:          "阿德莱德山",
			NameEn:          "Adelaide Hills",
			DescZh:          "距市中心仅20分钟车程的世外桃源，蜿蜒的山路两旁是迷人的德国小镇汉多夫、精品酒庄和苹果园。凉爽的气候孕育了顶级的灰皮诺和霞多丽葡萄酒。",
			DescEn:          "A paradise just 20 minutes from the city centre, with winding roads lined by the charming German village of Hahndorf, boutique wineries, and apple orchards. The cool climate produces exceptional Pinot Grigio and Chardonnay wines.",
			TaglineZh:       "城市旁的山间秘境",
			TaglineEn:       "A Mountain Retreat Next to the City",
			Image:           regionImage(1),
			SortOrder:       2,
			AttractionCount: 18,
		},
		{
			Slug:            "barossa",
			NameZh:          "芭罗莎谷",
			NameEn:          "Barossa Valley",
			DescZh:          "澳大利亚最著名的葡萄酒产区之一，拥有超过150家酒庄和80多个酒窖。这片有着近180年酿酒历史的土地出产享誉全球的设拉子红酒，同时保留着浓厚的德国移民文化遗产。",
			DescEn:          "One of Australia's most celebrated wine regions, home to over 150 wineries and 80+ cellar doors. With nearly 180 years of winemaking history, the valley produces world-renowned Shiraz while preserving a rich German heritage culture.",
			TaglineZh:       "世界级葡萄酒的故乡",
			TaglineEn:       "Home of World-Class Wine",
			Image:           regionImage(2),
			SortOrder:       3,
			AttractionCount: 22,
		},
		{
			Slug:            "kangaroo-island",
			NameZh:          "袋鼠岛",
			NameEn:          "Kangaroo Island",
			DescZh:          "澳大利亚第三大岛屿，被誉为'没有围栏的动物园'。这里栖息着海豹、海狮、考拉和多种珍稀鸟类。弗林德斯·蔡斯国家公园中的神奇岩石和旗舰拱门是大自然的鬼斧神工之作。",
			DescEn:          "Australia's third-largest island, known as a 'zoo without fences.' Home to seals, sea lions, koalas, and rare bird species. The Remarkable Rocks and Admirals Arch in Flinders Chase National Park are stunning natural masterpieces.",
			TaglineZh:       "没有围栏的动物园",
			TaglineEn:       "A Zoo Without Fences",
			Image:           regionImage(3),
			SortOrder:       4,
			AttractionCount: 20,
		},
		{
			Slug:            "flinders",
			NameZh:          "弗林德斯山脉",
			NameEn:          "Flinders Ranges",
			DescZh:          "南澳内陆最壮观的山脉，拥有超过5亿年的地质历史。标志性的维凭拿庞德是一座天然的巨型圆形剧场，而伊卡拉国家公园保存着丰富的原住民岩画和远古化石遗迹。",
			DescEn:          "South Australia's most spectacular outback ranges, with over 500 million years of geological history. The iconic Wilpena Pound is a natural amphitheatre, while Ikara-Flinders Ranges National Park preserves rich Aboriginal rock art and ancient fossil sites.",
			TaglineZh:       "五亿年的地质奇观",
			TaglineEn:       "500 Million Years of Geological Wonder",
			Image:           regionImage(4),
			SortOrder:       5,
			AttractionCount: 15,
		},
		{
			Slug:            "murray",
			NameZh:          "墨累河",
			NameEn:          "Murray River",
			DescZh:          "澳大利亚最长的河流蜿蜒流经南澳，沿岸是迷人的河畔小镇、柑橘果园和葡萄酒产区。在这里可以乘坐百年蒸汽船巡游，探索湿地生态，或在星空下露营。",
			DescEn:          "Australia's longest river winds through South Australia, past charming riverside towns, citrus orchards, and wine regions. Cruise on a century-old paddle steamer, explore wetland ecosystems, or camp under the stars along its banks.",
			TaglineZh:       "在百年蒸汽船上漫游",
			TaglineEn:       "Cruise Along a Timeless River",
			Image:           regionImage(5),
			SortOrder:       6,
			AttractionCount: 12,
		},
		{
			Slug:            "limestone-coast",
			NameZh:          "石灰岩海岸",
			NameEn:          "Limestone Coast",
			DescZh:          "以壮观的石灰岩地貌和蔚蓝的海岸线著称，纳拉库特洞穴是世界遗产级的化石遗址。库纳瓦拉出产顶级的赤霞珠葡萄酒，而蓝湖火山口湖会在季节变换中呈现神秘的钴蓝色。",
			DescEn:          "Known for dramatic limestone formations and azure coastline. Naracoorte Caves is a World Heritage fossil site. Coonawarra produces premium Cabernet Sauvignon, and the Blue Lake crater lake transforms to a mysterious cobalt blue with seasonal changes.",
			TaglineZh:       "世界遗产与蔚蓝海岸",
			TaglineEn:       "World Heritage Meets Azure Shores",
			Image:           regionImage(6),
			SortOrder:       7,
			AttractionCount: 14,
		},
	}

	count := 0
	for _, r := range regions {
		result := s.db.Where("slug = ?", r.Slug).FirstOrCreate(&r)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			count++
		} else {
			// Record exists — update fields
			if err := s.db.Model(&productmodel.Region{}).Where("slug = ?", r.Slug).Updates(map[string]interface{}{
				"name_zh":          r.NameZh,
				"name_en":          r.NameEn,
				"desc_zh":          r.DescZh,
				"desc_en":          r.DescEn,
				"tagline_zh":       r.TaglineZh,
				"tagline_en":       r.TaglineEn,
				"image":            r.Image,
				"sort_order":       r.SortOrder,
				"attraction_count": r.AttractionCount,
			}).Error; err != nil {
				return err
			}
			count++
		}
	}

	s.record("regions", count)
	return nil
}
