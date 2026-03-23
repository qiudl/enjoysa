package seed

import (
	"encoding/json"
	"fmt"

	"enjoysa-backend/internal/models"
	productmodel "enjoysa-backend/internal/product/model"

	"gorm.io/datatypes"
)

type hotelMeta struct {
	StarRating        int        `json:"star_rating"`
	AccommodationType string     `json:"accommodation_type"`
	Facilities        []string   `json:"facilities"`
	CheckInTime       string     `json:"check_in_time"`
	CheckOutTime      string     `json:"check_out_time"`
	DistanceToCenter  float64    `json:"distance_to_center"`
	RoomTypes         []roomType `json:"room_types"`
	TotalRooms        int        `json:"total_rooms"`
}

type roomType struct {
	NameZh    string  `json:"name_zh"`
	NameEn    string  `json:"name_en"`
	Price     float64 `json:"price"`
	MaxGuests int     `json:"max_guests"`
	BedType   string  `json:"bed_type"`
}

type hotelDef struct {
	nameZh, nameEn       string
	regionSlug           string
	supplierIdx          int // index into approved suppliers
	price                float64
	rating               float64
	reviewCount          int
	summaryZh, summaryEn string
	addressZh, addressEn string
	meta                 hotelMeta
	featured             bool
}

func allHotelDefs() []hotelDef {
	return []hotelDef{
		{
			nameZh: "阿德莱德天台花园酒店", nameEn: "Majestic Roof Garden Hotel",
			regionSlug: "adelaide", supplierIdx: 5, price: 189, rating: 4.5, reviewCount: 128,
			summaryZh: "位于阿德莱德市中心的精品酒店，屋顶花园可俯瞰城市天际线", summaryEn: "Boutique hotel in Adelaide CBD with rooftop garden overlooking the city skyline",
			addressZh: "阿德莱德市中心 Frome Street 55号", addressEn: "55 Frome Street, Adelaide CBD",
			featured: true,
			meta: hotelMeta{
				StarRating: 4, AccommodationType: "hotel",
				Facilities: []string{"pool", "parking", "wifi", "breakfast", "restaurant"},
				CheckInTime: "14:00", CheckOutTime: "11:00", DistanceToCenter: 0.5, TotalRooms: 120,
				RoomTypes: []roomType{
					{NameZh: "标准双人间", NameEn: "Standard Double", Price: 189, MaxGuests: 2, BedType: "double"},
					{NameZh: "豪华城景套房", NameEn: "Deluxe City View Suite", Price: 329, MaxGuests: 3, BedType: "king"},
				},
			},
		},
		{
			nameZh: "阿德莱德中央青旅", nameEn: "Adelaide Central YHA",
			regionSlug: "adelaide", supplierIdx: 5, price: 45, rating: 4.0, reviewCount: 256,
			summaryZh: "背包客首选，靠近中央市场和唐人街", summaryEn: "Backpacker favourite near Central Market and Chinatown",
			addressZh: "阿德莱德 Franklin Street 135号", addressEn: "135 Franklin Street, Adelaide",
			meta: hotelMeta{
				StarRating: 2, AccommodationType: "hostel",
				Facilities: []string{"wifi", "parking"},
				CheckInTime: "14:00", CheckOutTime: "10:00", DistanceToCenter: 0.8, TotalRooms: 60,
				RoomTypes: []roomType{
					{NameZh: "多人宿舍床位", NameEn: "Dormitory Bed", Price: 45, MaxGuests: 1, BedType: "single"},
					{NameZh: "私人双人间", NameEn: "Private Double", Price: 110, MaxGuests: 2, BedType: "double"},
				},
			},
		},
		{
			nameZh: "天空之城EOS酒店", nameEn: "Eos by SkyCity",
			regionSlug: "adelaide", supplierIdx: 5, price: 350, rating: 4.8, reviewCount: 89,
			summaryZh: "阿德莱德最高的五星级酒店，360度全景城市景观", summaryEn: "Adelaide's tallest 5-star hotel with 360-degree panoramic city views",
			addressZh: "阿德莱德 North Terrace", addressEn: "North Terrace, Adelaide",
			featured: true,
			meta: hotelMeta{
				StarRating: 5, AccommodationType: "hotel",
				Facilities: []string{"pool", "parking", "wifi", "breakfast", "gym", "restaurant"},
				CheckInTime: "15:00", CheckOutTime: "11:00", DistanceToCenter: 0.2, TotalRooms: 250,
				RoomTypes: []roomType{
					{NameZh: "高级客房", NameEn: "Superior Room", Price: 350, MaxGuests: 2, BedType: "king"},
					{NameZh: "全景套房", NameEn: "Panorama Suite", Price: 680, MaxGuests: 3, BedType: "king"},
				},
			},
		},
		{
			nameZh: "巴罗萨设拉子庄园", nameEn: "Barossa Shiraz Estate",
			regionSlug: "barossa", supplierIdx: 1, price: 280, rating: 4.6, reviewCount: 67,
			summaryZh: "坐落于葡萄园中的独栋度假屋，配私人酒窖", summaryEn: "Standalone holiday house among vineyards with private wine cellar",
			addressZh: "巴罗萨谷 Seppeltsfield Road", addressEn: "Seppeltsfield Road, Barossa Valley",
			meta: hotelMeta{
				StarRating: 4, AccommodationType: "holiday_house",
				Facilities: []string{"parking", "wifi", "breakfast"},
				CheckInTime: "15:00", CheckOutTime: "10:00", DistanceToCenter: 8.0, TotalRooms: 6,
				RoomTypes: []roomType{
					{NameZh: "葡萄园小屋", NameEn: "Vineyard Cottage", Price: 280, MaxGuests: 2, BedType: "queen"},
					{NameZh: "庄园别墅", NameEn: "Estate Villa", Price: 450, MaxGuests: 4, BedType: "king"},
				},
			},
		},
		{
			nameZh: "路易斯酒店", nameEn: "The Louise",
			regionSlug: "barossa", supplierIdx: 1, price: 650, rating: 4.9, reviewCount: 112,
			summaryZh: "巴罗萨谷顶级奢华酒店，配米其林级餐厅Appellation", summaryEn: "Barossa Valley's premier luxury hotel with Michelin-level restaurant Appellation",
			addressZh: "巴罗萨谷 Seppeltsfield Road 375号", addressEn: "375 Seppeltsfield Road, Barossa Valley",
			featured: true,
			meta: hotelMeta{
				StarRating: 5, AccommodationType: "hotel",
				Facilities: []string{"pool", "parking", "wifi", "breakfast", "gym", "restaurant"},
				CheckInTime: "15:00", CheckOutTime: "11:00", DistanceToCenter: 5.0, TotalRooms: 15,
				RoomTypes: []roomType{
					{NameZh: "奢华套房", NameEn: "Luxury Suite", Price: 650, MaxGuests: 2, BedType: "king"},
					{NameZh: "总统套房", NameEn: "Presidential Suite", Price: 1200, MaxGuests: 4, BedType: "king"},
				},
			},
		},
		{
			nameZh: "洛夫蒂山庄", nameEn: "Mount Lofty House",
			regionSlug: "adelaide-hills", supplierIdx: 2, price: 420, rating: 4.7, reviewCount: 95,
			summaryZh: "阿德莱德山上的历史庄园酒店，俯瞰Piccadilly山谷", summaryEn: "Historic estate hotel on Adelaide Hills overlooking Piccadilly Valley",
			addressZh: "阿德莱德山 Mount Lofty Summit Road", addressEn: "Mount Lofty Summit Road, Adelaide Hills",
			featured: true,
			meta: hotelMeta{
				StarRating: 5, AccommodationType: "hotel",
				Facilities: []string{"pool", "parking", "wifi", "breakfast", "restaurant"},
				CheckInTime: "15:00", CheckOutTime: "11:00", DistanceToCenter: 15.0, TotalRooms: 32,
				RoomTypes: []roomType{
					{NameZh: "花园客房", NameEn: "Garden Room", Price: 420, MaxGuests: 2, BedType: "king"},
					{NameZh: "山谷景观套房", NameEn: "Valley View Suite", Price: 620, MaxGuests: 3, BedType: "king"},
				},
			},
		},
		{
			nameZh: "汉多夫客栈", nameEn: "Hahndorf Inn",
			regionSlug: "adelaide-hills", supplierIdx: 2, price: 120, rating: 4.2, reviewCount: 184,
			summaryZh: "德国风情小镇中心的温馨民宿，步行可达所有景点", summaryEn: "Cozy B&B in the heart of German-style Hahndorf, walking distance to all attractions",
			addressZh: "汉多夫 Main Street 35号", addressEn: "35 Main Street, Hahndorf",
			meta: hotelMeta{
				StarRating: 3, AccommodationType: "bnb",
				Facilities: []string{"parking", "wifi", "breakfast"},
				CheckInTime: "14:00", CheckOutTime: "10:00", DistanceToCenter: 0.2, TotalRooms: 12,
				RoomTypes: []roomType{
					{NameZh: "标准双人间", NameEn: "Standard Double", Price: 120, MaxGuests: 2, BedType: "double"},
					{NameZh: "家庭房", NameEn: "Family Room", Price: 180, MaxGuests: 4, BedType: "twin"},
				},
			},
		},
		{
			nameZh: "袋鼠岛海滨酒店", nameEn: "Kangaroo Island Seafront Hotel",
			regionSlug: "kangaroo-island", supplierIdx: 0, price: 220, rating: 4.4, reviewCount: 76,
			summaryZh: "金斯科特海滨一线，推窗即见海豚嬉戏", summaryEn: "Waterfront location in Kingscote, watch dolphins from your window",
			addressZh: "袋鼠岛 金斯科特 Chapman Terrace", addressEn: "Chapman Terrace, Kingscote, Kangaroo Island",
			meta: hotelMeta{
				StarRating: 4, AccommodationType: "hotel",
				Facilities: []string{"parking", "wifi", "breakfast", "restaurant"},
				CheckInTime: "14:00", CheckOutTime: "10:00", DistanceToCenter: 0.5, TotalRooms: 45,
				RoomTypes: []roomType{
					{NameZh: "海景标准间", NameEn: "Ocean View Standard", Price: 220, MaxGuests: 2, BedType: "queen"},
					{NameZh: "海景豪华套房", NameEn: "Ocean View Deluxe Suite", Price: 380, MaxGuests: 3, BedType: "king"},
				},
			},
		},
		{
			nameZh: "南大洋酒店", nameEn: "Southern Ocean Lodge",
			regionSlug: "kangaroo-island", supplierIdx: 0, price: 1200, rating: 4.9, reviewCount: 42,
			summaryZh: "世界级奢华生态酒店，悬崖之上俯瞰南大洋", summaryEn: "World-class luxury eco-lodge perched on cliffs above the Southern Ocean",
			addressZh: "袋鼠岛 Hanson Bay Road", addressEn: "Hanson Bay Road, Kangaroo Island",
			featured: true,
			meta: hotelMeta{
				StarRating: 5, AccommodationType: "hotel",
				Facilities: []string{"pool", "parking", "wifi", "breakfast", "gym", "restaurant"},
				CheckInTime: "15:00", CheckOutTime: "11:00", DistanceToCenter: 50.0, TotalRooms: 21,
				RoomTypes: []roomType{
					{NameZh: "海洋套房", NameEn: "Ocean Retreat", Price: 1200, MaxGuests: 2, BedType: "king"},
					{NameZh: "鹈鹕套房", NameEn: "Osprey Pavilion", Price: 2500, MaxGuests: 2, BedType: "king"},
				},
			},
		},
		{
			nameZh: "维克多港传统汽车旅馆", nameEn: "Victor Harbor Heritage Motor Inn",
			regionSlug: "murray", supplierIdx: 3, price: 110, rating: 3.8, reviewCount: 203,
			summaryZh: "性价比之选，步行可达著名的花岗岩岛马车", summaryEn: "Great value, walking distance to the famous Granite Island horse tram",
			addressZh: "维克多港 Victoria Street 12号", addressEn: "12 Victoria Street, Victor Harbor",
			meta: hotelMeta{
				StarRating: 3, AccommodationType: "hotel",
				Facilities: []string{"parking", "wifi"},
				CheckInTime: "14:00", CheckOutTime: "10:00", DistanceToCenter: 0.5, TotalRooms: 30,
				RoomTypes: []roomType{
					{NameZh: "标准间", NameEn: "Standard Room", Price: 110, MaxGuests: 2, BedType: "queen"},
					{NameZh: "家庭间", NameEn: "Family Room", Price: 155, MaxGuests: 4, BedType: "twin"},
				},
			},
		},
		{
			nameZh: "弗林德斯山脉度假村", nameEn: "Flinders Ranges Resort",
			regionSlug: "flinders", supplierIdx: 3, price: 160, rating: 4.1, reviewCount: 88,
			summaryZh: "紧邻威尔皮纳凹地，沙漠星空下的住宿体验", summaryEn: "Adjacent to Wilpena Pound, stay under desert stars",
			addressZh: "弗林德斯山脉 Wilpena Road", addressEn: "Wilpena Road, Flinders Ranges",
			meta: hotelMeta{
				StarRating: 3, AccommodationType: "hotel",
				Facilities: []string{"parking", "wifi", "restaurant", "pool"},
				CheckInTime: "14:00", CheckOutTime: "10:00", DistanceToCenter: 2.0, TotalRooms: 60,
				RoomTypes: []roomType{
					{NameZh: "标准客房", NameEn: "Standard Room", Price: 160, MaxGuests: 2, BedType: "queen"},
					{NameZh: "家庭别墅", NameEn: "Family Villa", Price: 280, MaxGuests: 5, BedType: "twin"},
				},
			},
		},
		{
			nameZh: "罗布长滩汽车旅馆", nameEn: "Robe Longbeach Motor Inn",
			regionSlug: "limestone-coast", supplierIdx: 6, price: 130, rating: 4.0, reviewCount: 145,
			summaryZh: "石灰岩海岸线上的海滨住宿，靠近龙虾渔港", summaryEn: "Beachside accommodation on the Limestone Coast, near the lobster fishing port",
			addressZh: "罗布 Mundy Terrace 2号", addressEn: "2 Mundy Terrace, Robe",
			meta: hotelMeta{
				StarRating: 3, AccommodationType: "hotel",
				Facilities: []string{"parking", "wifi", "pool"},
				CheckInTime: "14:00", CheckOutTime: "10:00", DistanceToCenter: 0.8, TotalRooms: 28,
				RoomTypes: []roomType{
					{NameZh: "标准间", NameEn: "Standard Room", Price: 130, MaxGuests: 2, BedType: "queen"},
					{NameZh: "海景间", NameEn: "Ocean View Room", Price: 175, MaxGuests: 2, BedType: "queen"},
				},
			},
		},
	}
}

func (s *Seeder) seedHotels() error {
	defs := allHotelDefs()

	// Query accommodation category
	var accomCat productmodel.Category
	if err := s.db.Where("slug = ?", "accommodation").First(&accomCat).Error; err != nil {
		return fmt.Errorf("accommodation category not found (run seedCategories first): %w", err)
	}

	// Query regions
	var regions []productmodel.Region
	if err := s.db.Find(&regions).Error; err != nil {
		return fmt.Errorf("query regions: %w", err)
	}
	regionMap := make(map[string]uint)
	for _, r := range regions {
		regionMap[r.Slug] = r.ID
	}

	// Query approved suppliers
	var suppliers []models.Supplier
	if err := s.db.Where("status = ?", "approved").Order("id ASC").Find(&suppliers).Error; err != nil {
		return fmt.Errorf("query suppliers: %w", err)
	}

	var allImages []productmodel.ProductImage
	var allPackages []productmodel.ProductPackage

	count := 0
	for i, d := range defs {
		regionID, ok := regionMap[d.regionSlug]
		if !ok {
			continue
		}
		supIdx := d.supplierIdx
		if supIdx >= len(suppliers) {
			supIdx = 0
		}

		metaBytes, _ := json.Marshal(d.meta)

		product := productmodel.Product{
			NameZh:     d.nameZh,
			NameEn:     d.nameEn,
			SupplierID: suppliers[supIdx].ID,
			RegionID:   regionID,
			CategoryID: accomCat.ID,
			Status:     productmodel.ProductStatusApproved,
			PriceFrom:  d.price,
			Currency:   "AUD",
			SummaryZh:  d.summaryZh,
			SummaryEn:  d.summaryEn,
			AddressZh:  d.addressZh,
			AddressEn:  d.addressEn,
			Duration:   "Per night",
			Rating:     d.rating,
			ReviewCount: d.reviewCount,
			IsFeatured: d.featured,
			SortOrder:  i + 1,
			Metadata:   datatypes.JSON(metaBytes),
		}

		if err := s.db.Create(&product).Error; err != nil {
			return fmt.Errorf("create hotel %s: %w", d.nameEn, err)
		}

		// Cover image
		allImages = append(allImages, productmodel.ProductImage{
			ProductID: product.ID,
			URL:       unsplashHotel(i),
			SortOrder: 0,
			IsCover:   true,
		})
		// Extra images
		allImages = append(allImages, productmodel.ProductImage{
			ProductID: product.ID,
			URL:       unsplashHotelRoom(i),
			SortOrder: 1,
			IsCover:   false,
		})

		// Packages from room types
		for j, rt := range d.meta.RoomTypes {
			allPackages = append(allPackages, productmodel.ProductPackage{
				ProductID: product.ID,
				NameZh:    rt.NameZh,
				NameEn:    rt.NameEn,
				DescZh:    fmt.Sprintf("最多%d位客人，%s床", rt.MaxGuests, bedTypeZh(rt.BedType)),
				DescEn:    fmt.Sprintf("Up to %d guests, %s bed", rt.MaxGuests, rt.BedType),
				Price:     rt.Price,
				SortOrder: j,
			})
		}

		count++
	}

	if len(allImages) > 0 {
		if err := s.db.CreateInBatches(allImages, 50).Error; err != nil {
			return fmt.Errorf("batch insert hotel images: %w", err)
		}
	}
	if len(allPackages) > 0 {
		if err := s.db.CreateInBatches(allPackages, 50).Error; err != nil {
			return fmt.Errorf("batch insert hotel packages: %w", err)
		}
	}

	s.record("hotels", count)
	s.record("hotel_images", len(allImages))
	s.record("hotel_packages", len(allPackages))
	return nil
}

func bedTypeZh(bt string) string {
	switch bt {
	case "king":
		return "大床"
	case "queen":
		return "大床"
	case "double":
		return "双人床"
	case "twin":
		return "双床"
	case "single":
		return "单人床"
	default:
		return bt
	}
}
