package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"time"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/models"
	productmodel "enjoysa-backend/internal/product/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type packageSeed struct {
	Zh, En, DescZh, DescEn string
	Price                  float64
}
type highlightSeed struct{ Zh, En, DescZh, DescEn string }
type faqSeed struct{ Zh, En, AnswerZh, AnswerEn string }
type productSeed struct {
	Supplier, SupplierType, Website, Email, Phone, Region, NameZh, NameEn, SummaryZh, SummaryEn, DescriptionZh, DescriptionEn, Address, Duration, Group, BookingNoticeZh, BookingNoticeEn, BookingType string
	Price, FeaturedOrder                                                                                                                                                                               float64
	Images                                                                                                                                                                                             []string
	Packages                                                                                                                                                                                           []packageSeed
	Highlights                                                                                                                                                                                         []highlightSeed
	FAQs                                                                                                                                                                                               []faqSeed
}

func main() {
	configPath := flag.String("config", "configs/config.yaml", "config file")
	flag.Parse()
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	ids := []uint{}
	err = db.Transaction(func(tx *gorm.DB) error {
		for _, seed := range seeds() {
			id, err := upsert(tx, seed)
			if err != nil {
				return err
			}
			ids = append(ids, id)
		}
		// Featured products sort ascending. Keep these two at 1 and 2 while
		// preserving the relative order of all existing recommendations after them.
		return tx.Model(&productmodel.Product{}).
			Where("is_featured = ? AND id NOT IN ? AND sort_order < ?", true, ids, 10).
			Update("sort_order", gorm.Expr("sort_order + 10")).Error
	})
	if err != nil {
		log.Fatal(err)
	}
	b, _ := json.Marshal(map[string]interface{}{"product_ids": ids})
	fmt.Println(string(b))
}

func upsert(tx *gorm.DB, s productSeed) (uint, error) {
	var supplier models.Supplier
	if err := tx.Where("lower(name)=lower(?)", s.Supplier).First(&supplier).Error; err == gorm.ErrRecordNotFound {
		now := time.Now()
		supplier = models.Supplier{Name: s.Supplier, Type: s.SupplierType, Status: "approved", Website: s.Website, Email: s.Email, Phone: s.Phone, Country: "Australia", ApprovedAt: &now}
		if err = tx.Create(&supplier).Error; err != nil {
			return 0, err
		}
	} else if err != nil {
		return 0, err
	}
	var region productmodel.Region
	if err := tx.Where("slug=?", s.Region).First(&region).Error; err != nil {
		return 0, err
	}
	var category productmodel.Category
	if err := tx.Where("slug=?", "attractions").First(&category).Error; err != nil {
		return 0, err
	}
	metadata, _ := json.Marshal(map[string]interface{}{"booking_experience": s.BookingType, "official_product_url": s.Website, "sources": []string{s.Website}, "pricing_note": "Indicative from-prices only; live availability and final fare require operator confirmation."})
	tags, _ := json.Marshal([]string{"交通票务", "精选推荐", s.BookingType})
	order := int(s.FeaturedOrder)
	fields := map[string]interface{}{"name_zh": s.NameZh, "name_en": s.NameEn, "supplier_id": supplier.ID, "region_id": region.ID, "category_id": category.ID, "status": "approved", "price_from": s.Price, "currency": "AUD", "summary_zh": s.SummaryZh, "summary_en": s.SummaryEn, "description_zh": s.DescriptionZh, "description_en": s.DescriptionEn, "booking_notice_zh": s.BookingNoticeZh, "booking_notice_en": s.BookingNoticeEn, "address_zh": s.Address, "address_en": s.Address, "duration": s.Duration, "group_size": s.Group, "tags": string(tags), "metadata": metadata, "is_featured": true, "sort_order": order, "created_via": "admin_proxy"}
	var product productmodel.Product
	err := tx.Where("name_en=?", s.NameEn).First(&product).Error
	if err == gorm.ErrRecordNotFound {
		product = productmodel.Product{NameZh: s.NameZh, NameEn: s.NameEn, SupplierID: supplier.ID, RegionID: region.ID, CategoryID: category.ID, Status: "approved", PriceFrom: s.Price, Currency: "AUD", SummaryZh: s.SummaryZh, SummaryEn: s.SummaryEn, DescriptionZh: s.DescriptionZh, DescriptionEn: s.DescriptionEn, BookingNoticeZh: s.BookingNoticeZh, BookingNoticeEn: s.BookingNoticeEn, AddressZh: s.Address, AddressEn: s.Address, Duration: s.Duration, GroupSize: s.Group, Tags: string(tags), Metadata: metadata, IsFeatured: true, SortOrder: order, CreatedVia: "admin_proxy"}
		if err = tx.Create(&product).Error; err != nil {
			return 0, err
		}
	} else if err != nil {
		return 0, err
	} else if err = tx.Model(&product).Updates(fields).Error; err != nil {
		return 0, err
	}
	for _, m := range []interface{}{&productmodel.ProductImage{}, &productmodel.ProductPackage{}, &productmodel.ProductHighlight{}, &productmodel.ProductFAQ{}} {
		if err = tx.Unscoped().Where("product_id=?", product.ID).Delete(m).Error; err != nil {
			return 0, err
		}
	}
	for i, v := range s.Images {
		if err = tx.Create(&productmodel.ProductImage{ProductID: product.ID, URL: v, SortOrder: i, IsCover: i == 0}).Error; err != nil {
			return 0, err
		}
	}
	for i, v := range s.Packages {
		if err = tx.Create(&productmodel.ProductPackage{ProductID: product.ID, NameZh: v.Zh, NameEn: v.En, DescZh: v.DescZh, DescEn: v.DescEn, Price: v.Price, SortOrder: i + 1, StockTotal: -1}).Error; err != nil {
			return 0, err
		}
	}
	for i, v := range s.Highlights {
		if err = tx.Create(&productmodel.ProductHighlight{ProductID: product.ID, TitleZh: v.Zh, TitleEn: v.En, DescZh: v.DescZh, DescEn: v.DescEn, SortOrder: i + 1}).Error; err != nil {
			return 0, err
		}
	}
	for i, v := range s.FAQs {
		if err = tx.Create(&productmodel.ProductFAQ{ProductID: product.ID, QuestionZh: v.Zh, QuestionEn: v.En, AnswerZh: v.AnswerZh, AnswerEn: v.AnswerEn, SortOrder: i + 1}).Error; err != nil {
			return 0, err
		}
	}
	return product.ID, nil
}

func seeds() []productSeed {
	return []productSeed{
		{Supplier: "Journey Beyond Rail Expeditions", SupplierType: "travel_agency", Website: "https://www.journeybeyondrail.com.au/The-Ghan/", Email: "travelcentre@journeybeyond.com.au", Phone: "1800 703 357", Region: "adelaide", NameZh: "The Ghan 甘号传奇列车｜阿德莱德出发", NameEn: "The Ghan Legendary Rail Journey from Adelaide", Price: 2490, FeaturedOrder: 1, BookingType: "ghan", Address: "Adelaide Parklands Terminal, Keswick SA 5035", Duration: "2–3 nights", Group: "1–6 guests", SummaryZh: "从阿德莱德登上世界著名的 The Ghan，穿越澳洲红土中心前往 Alice Springs 或 Darwin，享受私人舱房、精致餐饮及沿途下车体验。", SummaryEn: "Board the world-famous Ghan in Adelaide and cross Australia's Red Centre to Alice Springs or Darwin, with a private cabin, fine dining and immersive Off Train Experiences.", DescriptionZh: "The Ghan 自 1929 年起连接澳洲南北，是一段远超交通本身的传奇铁路旅程。从阿德莱德出发，列车驶离葡萄酒乡，深入红土内陆；旅客入住私人卧铺舱房，在餐车享用以澳洲食材搭配本地葡萄酒的全包式餐饮，并按所选路线参加 Clare Valley、Marla、Alice Springs 或 Katherine 等下车体验。页面可选择起点、目的地、日期、人数及 Gold Twin、Gold Premium 或 Platinum 舱房，生成预订信息预览。", DescriptionEn: "Since 1929, The Ghan has linked Australia's south and north in a rail journey that is far more than transport. Depart Adelaide and travel beyond wine country into the Red Centre, relaxing in a private sleeping cabin with all-inclusive dining, Australian wine and route-dependent Off Train Experiences such as Clare Valley, Marla, Alice Springs or Katherine. Select route, date, guests and Gold Twin, Gold Premium or Platinum accommodation to create an enquiry preview.", BookingNoticeZh: "所示价格为每人参考起价，并非实时库存或最终报价。\n实际发车日期、舱房余位、季节价格、单人附加费及下车体验以 Journey Beyond 最终确认为准。\n建议尽早预订；Advance Purchase 等促销票价可能有更严格的更改与取消条件。\n请在预订时告知行动辅助、饮食限制及医疗需求。\n生成预览并确认后，请联系客服完成正式询价和预订。", BookingNoticeEn: "Displayed fares are indicative per-person from-prices, not live inventory or a final quote.\nDeparture dates, cabin availability, seasonal fares, single supplements and Off Train Experiences are subject to Journey Beyond confirmation.\nEarly booking is recommended; promotional fares may have stricter amendment and cancellation conditions.\nAdvise mobility, dietary and medical requirements at enquiry.\nAfter confirming the preview, contact our team to complete the live quote and booking.", Images: []string{"https://journey-beyond-rail.imgix.net/2026/08/The-Ghan-A-D-D-A-Rail-Only-2027.png?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2023/02/JBRE-Accommodation-Platinum-Club-81.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/10/GSR-Ghan-OTE-Simpsons-Gap-Alice-Springs-People-walking-through-gap-2-1024x683-1.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/08/JBRE-The-Ghan-Expedition-Hero-Coober-Pedy-SA-57-scaled.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/08/JBRE-The-Ghan-Hero-Marla-SA-9-scaled-e1642123826857.jpg?fit=crop&w=1600"}, Packages: []packageSeed{{"Gold Twin 双人金品舱", "Gold Twin", "可转换为卧铺的双人舱，配套全包餐饮及下车体验。", "Twin cabin with sleeping berths, all-inclusive dining and Off Train Experiences.", 2490}, {"Gold Premium 豪华金品舱", "Gold Premium", "更宽敞的现代舱房及专属餐饮体验。", "A more spacious contemporary cabin and elevated dining experience.", 2990}, {"Platinum 白金舱", "Platinum", "宽敞白金舱、双人床/双床布局与专属 Platinum Club。", "Spacious cabin with double/twin configuration and exclusive Platinum Club access.", 4590}}, Highlights: []highlightSeed{{"横贯红土中心", "Cross the Red Centre", "从南澳穿越广阔内陆，一路连接 Alice Springs 与 Darwin。", "Travel from South Australia through the vast interior to Alice Springs and Darwin."}, {"全包式列车生活", "All-inclusive onboard experience", "私人卧铺、精致餐饮及澳洲葡萄酒均融入旅程。", "Private sleeping accommodation, regionally inspired dining and Australian wines."}, {"沉浸式下车体验", "Immersive Off Train Experiences", "按路线探索葡萄酒乡、Marla 日出、Alice Springs 或 Katherine。", "Route-dependent discoveries may include wine country, Marla sunrise, Alice Springs or Katherine."}, {"三种舱房等级", "Three cabin levels", "可按预算与空间偏好选择 Gold Twin、Gold Premium 或 Platinum。", "Choose Gold Twin, Gold Premium or Platinum to suit budget and space preferences."}}, FAQs: []faqSeed{{"价格包含什么？", "What is included?", "车上舱房、全程餐饮、精选饮品及路线所列下车体验通常包含在票价内，最终以确认单为准。", "Cabin accommodation, onboard dining, selected beverages and listed Off Train Experiences are generally included, subject to confirmation."}, {"阿德莱德到 Darwin 需要多久？", "How long is Adelaide to Darwin?", "常规 Legendary Ghan 通常为 3 天 2 夜；部分年份或行程可能延长，需按具体发车确认。", "The Legendary Ghan is generally 3 days and 2 nights, though some departures may vary."}, {"可以只到 Alice Springs 吗？", "Can I travel only to Alice Springs?", "可以选择 Adelaide 至 Alice Springs 路段；页面报价为参考价，客服会核对对应日期和舱房。", "Adelaide to Alice Springs sectors can be requested; our team will confirm the date and cabin fare."}, {"需要穿正式服装吗？", "Is formal dress required?", "日间以舒适休闲装为主，晚餐可选择整洁休闲着装，并准备适合下车活动的鞋履。", "Comfortable casual wear suits daytime; smart casual clothing and practical shoes are recommended."}, {"如何完成预订？", "How do I complete the booking?", "填写路线、日期、人数和舱房，生成预览并确认后联系客服，由客服核实实时余位和最终票价。", "Build and confirm your enquiry preview, then contact our team for live availability and final pricing."}}},
		{Supplier: "SeaLink Kangaroo Island", SupplierType: "travel_agency", Website: "https://www.sealink.com.au/kangaroo-island/sealink-kangaroo-island-ferry/", Email: "bookings@sealink.com.au", Phone: "13 13 01", Region: "kangaroo-island", NameZh: "SeaLink 袋鼠岛往返轮渡｜Cape Jervis ⇄ Penneshaw", NameEn: "SeaLink Kangaroo Island Return Ferry — Cape Jervis to Penneshaw", Price: 98, FeaturedOrder: 2, BookingType: "sealink", Address: "Cape Jervis Ferry Terminal / Penneshaw Ferry Terminal", Duration: "45 minutes each way", Group: "1–6 passengers plus vehicle", SummaryZh: "预订 Cape Jervis 与 Penneshaw 之间的 SeaLink 袋鼠岛往返轮渡，可选择出发及返程日期、成人、儿童和携车方案。", SummaryEn: "Plan a return SeaLink ferry crossing between Cape Jervis and Penneshaw with departure and return dates, adults, children and optional vehicle.", DescriptionZh: "SeaLink 以大型双体客滚轮渡连接 Fleurieu Peninsula 的 Cape Jervis 与袋鼠岛 Penneshaw，单程航行约 45 分钟，旺季每日每方向最多可运行 12 班。船上设空调休息室、咖啡厅式座位、持牌咖啡吧、户外观景甲板、无障碍洗手间及婴儿护理设施。可选择步行乘客、5 米以内车辆或摩托车，填写往返日期和人数后生成参考预订预览。", DescriptionEn: "SeaLink operates large twin-hulled passenger and vehicle ferries between Cape Jervis on the Fleurieu Peninsula and Penneshaw on Kangaroo Island. Each crossing takes about 45 minutes, with up to 12 services each way during peak periods. Onboard facilities include air-conditioned lounges, café-style seating, a licensed café, outdoor viewing decks, accessible bathrooms and baby-change facilities. Choose passenger-only travel, a vehicle up to 5m or a motorbike, then add return dates and guests to create an enquiry preview.", BookingNoticeZh: "请至少在开船前 30 分钟办理值船；最终值船时间以确认单为准。\n成人参考起价为单程 A$49，3–14 岁儿童单程 A$25.50，0–2 岁婴儿免费；往返参考价按两程计算。\n车辆价格会因日期、需求、尺寸及临时燃油附加费变化；页面金额仅供预览。\n车辆尺寸须包含保险杠、自行车架和车顶架等附件；电动车或混动车请在预订时申报。\n轮渡通常每日运行（圣诞节除外），班次可能因天气、维修及码头工程调整。\n确认预览后请联系客服核实班次、实时票价和余位。", BookingNoticeEn: "Check in at least 30 minutes before departure; the final requirement appears on your confirmation.\nIndicative one-way from-fares are A$49 per adult and A$25.50 per child aged 3–14; infants 0–2 travel free. Return estimates use two sectors.\nVehicle fares vary by date, demand, dimensions and applicable fuel surcharges; displayed totals are previews only.\nVehicle measurements include attachments, and electric or hybrid vehicles must be declared.\nFerries generally operate daily except Christmas Day, but schedules can change for weather, maintenance or jetty works.\nAfter confirming the preview, contact our team for live sailing times, fares and availability.", Images: []string{"/uploads/curated-sa-experiences/curated-02-1.jpg", "/uploads/curated-sa-experiences/curated-02-2.jpg", "/uploads/curated-sa-experiences/curated-02-3.jpg", "/uploads/curated-sa-experiences/curated-02-4.jpg", "/uploads/curated-sa-experiences/curated-02-5.jpg"}, Packages: []packageSeed{{"成人往返", "Adult Return", "成人往返参考起价；动态价格以确认时为准。", "Indicative adult return from-fare; dynamic pricing applies.", 98}, {"儿童往返（3–14岁）", "Child Return (3–14)", "儿童往返参考起价。", "Indicative child return from-fare.", 51}, {"5米以内车辆往返", "Vehicle up to 5m Return", "车辆参考起价，不含乘客；旺季及附加费另计。", "Indicative vehicle-only return from-fare; passengers and surcharges additional.", 198}, {"摩托车往返", "Motorbike Return", "摩托车往返参考起价，不含乘客。", "Indicative motorbike return from-fare; passengers additional.", 76}}, Highlights: []highlightSeed{{"45 分钟跨海", "45-minute crossing", "快速跨越 Backstairs Passage，连接 Cape Jervis 与 Penneshaw。", "Cross Backstairs Passage between Cape Jervis and Penneshaw in about 45 minutes."}, {"每日多班", "Multiple daily sailings", "旺季每方向每日最多约 12 班，方便衔接袋鼠岛行程。", "Up to around 12 sailings each way during peak periods."}, {"人车同船", "Passenger and vehicle ferry", "可选择步行乘船，也可携带汽车、露营车或摩托车。", "Travel as a walk-on guest or take a car, campervan or motorbike."}, {"舒适船上设施", "Comfortable onboard facilities", "设空调休息室、持牌咖啡吧、户外甲板及无障碍设施。", "Air-conditioned lounges, licensed café, outdoor decks and accessible amenities."}}, FAQs: []faqSeed{{"船程多久？", "How long is the crossing?", "Cape Jervis 至 Penneshaw 单程约 45 分钟。", "The Cape Jervis to Penneshaw crossing takes approximately 45 minutes."}, {"需要提前多久到码头？", "How early should I arrive?", "官网建议至少提前 30 分钟值船；携车旅客请按确认单要求预留更多时间。", "SeaLink advises checking in at least 30 minutes before departure; vehicle guests should follow their confirmation."}, {"儿童如何计价？", "How are children priced?", "3–14 岁适用儿童票，0–2 岁婴儿免费；证件与最终价格以确认要求为准。", "Child fares apply from age 3 to 14 and infants aged 0–2 travel free, subject to confirmation requirements."}, {"可以携带车辆吗？", "Can I take a vehicle?", "可以。页面支持 5 米以内车辆和摩托车预览；更长车辆、拖车或特殊尺寸请联系客服。", "Yes. The preview supports vehicles up to 5m and motorbikes; larger or combined vehicles require assistance."}, {"船上有餐饮和无障碍设施吗？", "Are food and accessible facilities available?", "船上设持牌咖啡吧、空调休息室、无障碍卫生间，并可在预订时申请登船协助。", "Ferries have a licensed café, air-conditioned lounges and accessible bathrooms; boarding assistance can be requested."}, {"价格为什么可能变化？", "Why can the fare change?", "SeaLink 对部分日期采用动态价格，且可能有燃油附加费；客服会在正式预订前确认最终金额。", "SeaLink may use demand-based pricing and fuel surcharges; our team confirms the final amount before booking."}}},
	}
}
