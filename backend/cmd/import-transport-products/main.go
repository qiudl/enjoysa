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
		// Featured products sort ascending. Keep these curated transport products
		// first while preserving existing recommendations after them.
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
	items := []productSeed{
		{Supplier: "Journey Beyond Rail Expeditions", SupplierType: "travel_agency", Website: "https://www.journeybeyondrail.com.au/The-Ghan/", Email: "travelcentre@journeybeyond.com.au", Phone: "1800 703 357", Region: "adelaide", NameZh: "The Ghan 甘号传奇列车｜阿德莱德出发", NameEn: "The Ghan Legendary Rail Journey from Adelaide", Price: 2490, FeaturedOrder: 1, BookingType: "ghan", Address: "Adelaide Parklands Terminal, Keswick SA 5035", Duration: "2–3 nights", Group: "1–6 guests", SummaryZh: "从阿德莱德登上世界著名的 The Ghan，穿越澳洲红土中心前往 Alice Springs 或 Darwin，享受私人舱房、精致餐饮及沿途下车体验。", SummaryEn: "Board the world-famous Ghan in Adelaide and cross Australia's Red Centre to Alice Springs or Darwin, with a private cabin, fine dining and immersive Off Train Experiences.", DescriptionZh: "The Ghan 自 1929 年起连接澳洲南北，是一段远超交通本身的传奇铁路旅程。从阿德莱德出发，列车驶离葡萄酒乡，深入红土内陆；旅客入住私人卧铺舱房，在餐车享用以澳洲食材搭配本地葡萄酒的全包式餐饮，并按所选路线参加 Clare Valley、Marla、Alice Springs 或 Katherine 等下车体验。页面可选择起点、目的地、日期、人数及 Gold Twin、Gold Premium 或 Platinum 舱房，生成预订信息预览。", DescriptionEn: "Since 1929, The Ghan has linked Australia's south and north in a rail journey that is far more than transport. Depart Adelaide and travel beyond wine country into the Red Centre, relaxing in a private sleeping cabin with all-inclusive dining, Australian wine and route-dependent Off Train Experiences such as Clare Valley, Marla, Alice Springs or Katherine. Select route, date, guests and Gold Twin, Gold Premium or Platinum accommodation to create an enquiry preview.", BookingNoticeZh: "所示价格为每人参考起价，并非实时库存或最终报价。\n实际发车日期、舱房余位、季节价格、单人附加费及下车体验以 Journey Beyond 最终确认为准。\n建议尽早预订；Advance Purchase 等促销票价可能有更严格的更改与取消条件。\n请在预订时告知行动辅助、饮食限制及医疗需求。\n生成预览并确认后，请联系客服完成正式询价和预订。", BookingNoticeEn: "Displayed fares are indicative per-person from-prices, not live inventory or a final quote.\nDeparture dates, cabin availability, seasonal fares, single supplements and Off Train Experiences are subject to Journey Beyond confirmation.\nEarly booking is recommended; promotional fares may have stricter amendment and cancellation conditions.\nAdvise mobility, dietary and medical requirements at enquiry.\nAfter confirming the preview, contact our team to complete the live quote and booking.", Images: []string{"https://journey-beyond-rail.imgix.net/2026/08/The-Ghan-A-D-D-A-Rail-Only-2027.png?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2023/02/JBRE-Accommodation-Platinum-Club-81.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/10/GSR-Ghan-OTE-Simpsons-Gap-Alice-Springs-People-walking-through-gap-2-1024x683-1.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/08/JBRE-The-Ghan-Expedition-Hero-Coober-Pedy-SA-57-scaled.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/08/JBRE-The-Ghan-Hero-Marla-SA-9-scaled-e1642123826857.jpg?fit=crop&w=1600"}, Packages: []packageSeed{{"Gold Twin 双人金品舱", "Gold Twin", "可转换为卧铺的双人舱，配套全包餐饮及下车体验。", "Twin cabin with sleeping berths, all-inclusive dining and Off Train Experiences.", 2490}, {"Gold Premium 豪华金品舱", "Gold Premium", "更宽敞的现代舱房及专属餐饮体验。", "A more spacious contemporary cabin and elevated dining experience.", 2990}, {"Platinum 白金舱", "Platinum", "宽敞白金舱、双人床/双床布局与专属 Platinum Club。", "Spacious cabin with double/twin configuration and exclusive Platinum Club access.", 4590}}, Highlights: []highlightSeed{{"横贯红土中心", "Cross the Red Centre", "从南澳穿越广阔内陆，一路连接 Alice Springs 与 Darwin。", "Travel from South Australia through the vast interior to Alice Springs and Darwin."}, {"全包式列车生活", "All-inclusive onboard experience", "私人卧铺、精致餐饮及澳洲葡萄酒均融入旅程。", "Private sleeping accommodation, regionally inspired dining and Australian wines."}, {"沉浸式下车体验", "Immersive Off Train Experiences", "按路线探索葡萄酒乡、Marla 日出、Alice Springs 或 Katherine。", "Route-dependent discoveries may include wine country, Marla sunrise, Alice Springs or Katherine."}, {"三种舱房等级", "Three cabin levels", "可按预算与空间偏好选择 Gold Twin、Gold Premium 或 Platinum。", "Choose Gold Twin, Gold Premium or Platinum to suit budget and space preferences."}}, FAQs: []faqSeed{{"价格包含什么？", "What is included?", "车上舱房、全程餐饮、精选饮品及路线所列下车体验通常包含在票价内，最终以确认单为准。", "Cabin accommodation, onboard dining, selected beverages and listed Off Train Experiences are generally included, subject to confirmation."}, {"阿德莱德到 Darwin 需要多久？", "How long is Adelaide to Darwin?", "常规 Legendary Ghan 通常为 3 天 2 夜；部分年份或行程可能延长，需按具体发车确认。", "The Legendary Ghan is generally 3 days and 2 nights, though some departures may vary."}, {"可以只到 Alice Springs 吗？", "Can I travel only to Alice Springs?", "可以选择 Adelaide 至 Alice Springs 路段；页面报价为参考价，客服会核对对应日期和舱房。", "Adelaide to Alice Springs sectors can be requested; our team will confirm the date and cabin fare."}, {"需要穿正式服装吗？", "Is formal dress required?", "日间以舒适休闲装为主，晚餐可选择整洁休闲着装，并准备适合下车活动的鞋履。", "Comfortable casual wear suits daytime; smart casual clothing and practical shoes are recommended."}, {"如何完成预订？", "How do I complete the booking?", "填写路线、日期、人数和舱房，生成预览并确认后联系客服，由客服核实实时余位和最终票价。", "Build and confirm your enquiry preview, then contact our team for live availability and final pricing."}}},
		{Supplier: "SeaLink Kangaroo Island", SupplierType: "travel_agency", Website: "https://www.sealink.com.au/kangaroo-island/sealink-kangaroo-island-ferry/", Email: "bookings@sealink.com.au", Phone: "13 13 01", Region: "kangaroo-island", NameZh: "SeaLink 袋鼠岛往返轮渡｜Cape Jervis ⇄ Penneshaw", NameEn: "SeaLink Kangaroo Island Return Ferry — Cape Jervis to Penneshaw", Price: 136, FeaturedOrder: 2, BookingType: "sealink", Address: "Cape Jervis Ferry Terminal / Penneshaw Ferry Terminal", Duration: "45 minutes each way", Group: "1–6 passengers plus vehicle", SummaryZh: "预订 Cape Jervis 与 Penneshaw 之间的 SeaLink 袋鼠岛往返轮渡，可选择出发及返程日期、成人、儿童和携车方案。", SummaryEn: "Plan a return SeaLink ferry crossing between Cape Jervis and Penneshaw with departure and return dates, adults, children and optional vehicle.", DescriptionZh: "SeaLink 以大型双体客滚轮渡连接 Fleurieu Peninsula 的 Cape Jervis 与袋鼠岛 Penneshaw，单程约 45 分钟。页面可选择往返日期、成人、儿童和携车方案后生成预订预览。成人船票单程 A$68、往返 A$136。", DescriptionEn: "SeaLink operates large twin-hulled passenger and vehicle ferries between Cape Jervis and Penneshaw, taking about 45 minutes each way. Select return dates, guests and an optional vehicle to create an enquiry preview. Adult passenger fare is A$68 one way or A$136 return.", BookingNoticeZh: "请至少在开船前 30 分钟办理值船；最终值船时间以确认单为准。\n成人单程票价为 A$68，往返票价为 A$136。\n儿童、车辆、特殊行李和附加费以客服确认的实时价格为准。\n车辆尺寸须包含保险杠、自行车架和车顶架等附件；电动车或混动车请在预订时申报。\n班次可能因天气、维修及码头工程调整。", BookingNoticeEn: "Check in at least 30 minutes before departure.\nAdult fare is A$68 one way or A$136 return.\nChild, vehicle, special item and surcharge pricing is subject to live confirmation.\nDeclare all vehicle dimensions and electric or hybrid vehicles.\nSchedules can change for weather, maintenance or jetty works.", Images: []string{"/uploads/curated-sa-experiences/curated-02-1.jpg", "/uploads/curated-sa-experiences/curated-02-2.jpg", "/uploads/curated-sa-experiences/curated-02-3.jpg", "/uploads/curated-sa-experiences/curated-02-4.jpg", "/uploads/curated-sa-experiences/curated-02-5.jpg"}, Packages: []packageSeed{{"成人单程", "Adult One Way", "成人单程船票。", "Adult one-way passenger fare.", 68}, {"成人往返", "Adult Return", "成人往返船票。", "Adult return passenger fare.", 136}, {"儿童往返（3–14岁）", "Child Return (3–14)", "儿童往返参考价由客服确认。", "Child return fare subject to confirmation.", 51}, {"5米以内车辆往返", "Vehicle up to 5m Return", "不含乘客，最终价格由客服确认。", "Passengers excluded; final price requires confirmation.", 198}}, Highlights: []highlightSeed{{"45 分钟跨海", "45-minute crossing", "快速连接 Cape Jervis 与 Penneshaw。", "A fast crossing between Cape Jervis and Penneshaw."}, {"成人往返 A$136", "A$136 adult return", "成人单程 A$68、往返 A$136。", "Adult fare is A$68 one way or A$136 return."}, {"人车同船", "Passenger and vehicle ferry", "可步行乘船或携带车辆。", "Travel as a walk-on guest or take a vehicle."}, {"舒适船上设施", "Comfortable facilities", "设空调休息室、咖啡吧、户外甲板及无障碍设施。", "Air-conditioned lounges, café, outdoor decks and accessible amenities."}}, FAQs: []faqSeed{{"成人票价是多少？", "What is the adult fare?", "成人单程 A$68，往返 A$136。", "Adult fare is A$68 one way or A$136 return."}, {"船程多久？", "How long is the crossing?", "单程约 45 分钟。", "Approximately 45 minutes each way."}, {"需要提前多久到码头？", "How early should I arrive?", "建议至少提前 30 分钟值船。", "Arrive at least 30 minutes before departure."}, {"可以携带车辆吗？", "Can I take a vehicle?", "可以，车辆最终价格需根据尺寸和日期确认。", "Yes; the final vehicle fare depends on dimensions and date."}, {"如何完成预订？", "How do I complete the booking?", "生成预览后联系客服确认班次与出票。", "Create a preview, then contact our team to confirm sailing and ticketing."}}},
	}
	return append(items, railSeeds()...)
}

func railSeeds() []productSeed {
	commonNoticeZh := "所示价格为每人参考起价，并非实时库存或最终报价。\n发车日期、席位、季节价格及行程内容以 Journey Beyond 最终确认为准。\n促销票价可能有更严格的更改与取消条件。\n生成预览并确认后，请联系客服完成正式预订。"
	commonNoticeEn := "Displayed fares are indicative per-person from-prices, not live inventory or a final quote.\nDeparture dates, seats, seasonal pricing and itinerary are subject to Journey Beyond confirmation.\nPromotional fares may have stricter amendment and cancellation conditions.\nAfter confirming the preview, contact our team to complete the booking."
	commonFAQs := []faqSeed{{"价格是实时的吗？", "Are fares live?", "页面显示参考起价；客服将按日期、路线和舱位确认实时价格。", "Displayed prices are indicative; our team confirms live pricing by date, route and service."}, {"如何完成预订？", "How do I complete the booking?", "填写信息生成预览后联系客服完成出票。", "Create an enquiry preview, then contact our team to complete ticketing."}, {"可以提出饮食或行动辅助需求吗？", "Can I request dietary or mobility assistance?", "可以，请在询价时提前说明，由运营方确认安排。", "Yes. Advise requirements at enquiry so the operator can confirm arrangements."}, {"票价可以更改或取消吗？", "Can fares be changed or cancelled?", "取决于所选票价规则，促销票通常限制更严格。", "Conditions depend on the selected fare; promotional fares are usually more restrictive."}, {"从哪里登车？", "Where do I board?", "Adelaide 行程通常使用 Adelaide Parklands Terminal，最终以确认单为准。", "Adelaide journeys generally use Adelaide Parklands Terminal; follow the final confirmation."}}
	return []productSeed{
		{Supplier: "Journey Beyond Rail Expeditions", SupplierType: "travel_agency", Website: "https://www.journeybeyondrail.com.au/journeys/indian-pacific/", Email: "travelcentre@journeybeyond.com.au", Phone: "1800 703 357", Region: "adelaide", NameZh: "Indian Pacific 印度洋太平洋号｜Adelaide–Perth / Sydney", NameEn: "Indian Pacific Rail Journey via Adelaide", Price: 2690, FeaturedOrder: 3, BookingType: "indian-pacific", Address: "Adelaide Parklands Terminal, Keswick SA 5035", Duration: "2–3 nights", Group: "1–6 guests", SummaryZh: "从 Adelaide 向西横越 Nullarbor 前往 Perth，或向东穿越内陆抵达 Sydney，体验澳洲经典横贯大陆豪华铁路。", SummaryEn: "Travel west from Adelaide across the Nullarbor to Perth or east through inland Australia to Sydney aboard the iconic Indian Pacific.", DescriptionZh: "Indian Pacific 以印度洋与太平洋命名，是澳洲最具代表性的横贯大陆列车。Adelaide 是线路核心停靠点：向西进入广阔 Nullarbor，体验 Cook 与 Rawlinna 等下车活动；向东则经内陆前往 Sydney。Gold Twin、Gold Premium 与 Platinum 舱均提供卧铺体验，长途票价通常包含餐饮、精选饮品及路线对应的下车体验。", DescriptionEn: "Named for the Indian and Pacific oceans, the Indian Pacific is Australia's iconic transcontinental train. Adelaide is a key stop: travel west over the Nullarbor towards Perth with experiences such as Cook and Rawlinna, or east through inland landscapes to Sydney. Gold Twin, Gold Premium and Platinum services combine sleeping accommodation with route-dependent dining, beverages and Off Train Experiences.", BookingNoticeZh: commonNoticeZh, BookingNoticeEn: commonNoticeEn, Images: []string{"https://journey-beyond-rail.imgix.net/2025/10/JBR-Indian-Pacific-Hero-Drone-Lake-Julia-WA-4-2.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2024/09/JBR-Aust-by-Train-Experiences-Rawlinna-162-2.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2025/10/Indian-Pacific-Seppeltsfield-Signature-Dinner-Drone-Barossa-Valley-SA-131.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/10/JBRE-Indian-Pacific-Experience-Rawlinna-WA-1-2.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2023/02/JBRE-Accommodation-Platinum-Club-81.jpg?fit=crop&w=1600"}, Packages: []packageSeed{{"Gold Twin 双人金品舱", "Gold Twin", "私人双人卧铺舱及全包式车上体验。", "Private twin sleeping cabin and all-inclusive onboard experience.", 2690}, {"Gold Premium 豪华金品舱", "Gold Premium", "更宽敞舱房与升级餐饮空间。", "More spacious cabin and elevated dining spaces.", 3590}, {"Platinum 白金舱", "Platinum", "宽敞白金舱及专属 Platinum Club。", "Spacious cabin with exclusive Platinum Club access.", 5490}}, Highlights: []highlightSeed{{"横贯澳洲大陆", "Cross the continent", "连接 Perth、Adelaide 与 Sydney。", "Connect Perth, Adelaide and Sydney."}, {"Nullarbor 风光", "The Nullarbor", "穿越世界闻名的辽阔平原与笔直铁路。", "Cross the immense plain and legendary straight railway."}, {"下车体验", "Off Train Experiences", "按路线探索 Cook、Rawlinna 或南澳酒乡。", "Route-dependent experiences may include Cook, Rawlinna or South Australian wine country."}, {"全包铁路生活", "All-inclusive rail life", "卧铺、餐饮、精选饮品与服务融为一体。", "Sleeping accommodation, dining, selected beverages and service."}}, FAQs: commonFAQs},
		{Supplier: "Journey Beyond Rail Expeditions", SupplierType: "travel_agency", Website: "https://www.journeybeyondrail.com.au/great-southern/", Email: "travelcentre@journeybeyond.com.au", Phone: "1800 703 357", Region: "adelaide", NameZh: "Great Southern 南方号｜Adelaide–Brisbane", NameEn: "Great Southern Rail Journey from Adelaide to Brisbane", Price: 2690, FeaturedOrder: 4, BookingType: "great-southern", Address: "Adelaide Parklands Terminal, Keswick SA 5035", Duration: "3 days / 2 nights", Group: "1–6 guests", SummaryZh: "冬日列车去北方，夏日搭乘 Great Southern 从 Adelaide 前往 Brisbane，沿途探索 Grampians、Canberra 与 Coffs Harbour。", SummaryEn: "Celebrate the Australian summer aboard the Great Southern from Adelaide to Brisbane, with experiences in the Grampians, Canberra and Coffs Harbour.", DescriptionZh: "Great Southern 是 Journey Beyond 的夏季精品铁路，从 Adelaide 穿越澳洲东南部前往 Brisbane。3 天 2 夜的北向行程结合列车上的精致餐饮与 Grampians、Canberra、Coffs Harbour 等沉浸式下车体验。该线路主要在 1–2 月及 12 月运行，适合希望一次串联山地、首都文化与海岸风光的旅客。", DescriptionEn: "The Great Southern is Journey Beyond's signature summer rail journey from Adelaide through south-eastern Australia to Brisbane. The 3-day, 2-night northbound itinerary pairs refined onboard dining with immersive experiences in the Grampians, Canberra and Coffs Harbour. It mainly operates in January, February and December.", BookingNoticeZh: commonNoticeZh + "\nGreat Southern 为季节性列车，通常仅在 1–2 月及 12 月运行。", BookingNoticeEn: commonNoticeEn + "\nGreat Southern is seasonal and generally operates in January, February and December.", Images: []string{"https://journey-beyond-rail.imgix.net/2023/02/00701JBR-Homepage-Graphic-1600x560-12-scaled.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2025/11/Great-Southern-A-B-_-B-A-Rail-Only-2027-scaled.png?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2023/02/JBRE-Accommodation-Gold-Service-Restaurant-AbyT-1.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2021/10/JBRE-Great-Southern-Experience-Coffs-Harbour-Dinner-51.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2023/02/JBRE-Accommodation-Platinum-Club-81.jpg?fit=crop&w=1600"}, Packages: []packageSeed{{"Gold Twin 双人金品舱", "Gold Twin", "Advance Purchase 参考起价。", "Indicative Advance Purchase from-fare.", 2690}, {"Gold Premium 豪华金品舱", "Gold Premium", "更宽敞舱房及升级餐饮体验。", "More spacious cabin and elevated dining.", 3190}, {"Platinum 白金舱", "Platinum", "白金级舱房与专属服务。", "Platinum accommodation and exclusive service.", 6190}}, Highlights: []highlightSeed{{"澳洲夏日铁路", "Australian summer by rail", "以舒适节奏串联南澳与 Queensland。", "Link South Australia and Queensland in summer comfort."}, {"Grampians", "The Grampians", "选择自然步道、观景或品酒体验。", "Choose nature walks, scenic touring or wine tasting."}, {"Canberra", "Canberra", "探索国家首都的艺术、历史与餐饮文化。", "Explore the capital's art, history and culinary culture."}, {"Coffs Harbour", "Coffs Harbour", "感受新州北部海岸与步道。", "Experience the northern NSW coast and boardwalks."}}, FAQs: commonFAQs},
		{Supplier: "Journey Beyond Rail Expeditions", SupplierType: "travel_agency", Website: "https://www.journeybeyondrail.com.au/the-overland/", Email: "travelcentre@journeybeyond.com.au", Phone: "1800 703 357", Region: "adelaide", NameZh: "The Overland 陆上号｜Adelaide–Melbourne 日间列车", NameEn: "The Overland Day Train from Adelaide to Melbourne", Price: 165, FeaturedOrder: 5, BookingType: "overland", Address: "Adelaide Parklands Terminal, Keswick SA 5035", Duration: "Approximately 11–12 hours", Group: "1–6 guests", SummaryZh: "搭乘拥有 135 年历史的 The Overland 日间列车，在 Adelaide 与 Melbourne 之间舒适穿越南澳与 Victoria 乡野。", SummaryEn: "Travel between Adelaide and Melbourne aboard the 135-year-old Overland, a relaxed daylight journey through South Australian and Victorian countryside.", DescriptionZh: "The Overland 已连接 Adelaide、Melbourne 与沿线地区超过 135 年，每周双向运行两班。旅客可选择 Red Standard 或空间更宽裕、含餐饮服务的 Red Premium，在约一整天的旅程中欣赏 mallee 灌木、农田与地区城镇。行李额度最高可达 60kg，实际班次、停靠与服务以运营方确认为准。", DescriptionEn: "The Overland has linked Adelaide, Melbourne and regional communities for more than 135 years, operating twice weekly in each direction. Choose Red Standard or the more spacious Red Premium service for a relaxed full-day journey past mallee scrub, farmland and regional towns. Luggage allowance can be up to 60kg, subject to final confirmation.", BookingNoticeZh: commonNoticeZh + "\n2026 Ready Rail 参考起价：Red Standard A$165、Red Premium A$305。\n列车通常 Adelaide 周日及周四出发，具体日期以时刻表为准。", BookingNoticeEn: commonNoticeEn + "\n2026 Ready Rail from-fares: Red Standard A$165 and Red Premium A$305.\nAdelaide departures are generally Sunday and Thursday, subject to timetable confirmation.", Images: []string{"https://journey-beyond-rail.imgix.net/2024/04/00777JBR-Website-Landing-Page-Overland-1920x1080-V2-1-1.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2025/11/The-Overland-Adelaide-Melbourne-Crop-2027-1.png?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2019/03/overland-redservice2.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2024/02/JBR-The-Overland-2023-Gather-Round-20.jpg?fit=crop&w=1600", "https://journey-beyond-rail.imgix.net/2023/02/JBRE-Accommodation-Gold-Service-Restaurant-AbyT-1.jpg?fit=crop&w=1600"}, Packages: []packageSeed{{"Red Standard Ready Rail", "Red Standard Ready Rail", "舒适半躺座椅与宽裕腿部空间。", "Comfortable reclining seat and generous legroom.", 165}, {"Red Premium Ready Rail", "Red Premium Ready Rail", "更宽敞座位及座位餐饮服务。", "More spacious seating with at-seat meal service.", 305}, {"Red Standard Everyday", "Red Standard Everyday", "灵活度更高的标准座参考票价。", "Indicative more flexible standard fare.", 225}, {"Red Premium Everyday", "Red Premium Everyday", "灵活度更高的优享座参考票价。", "Indicative more flexible premium fare.", 375}}, Highlights: []highlightSeed{{"135 年铁路历史", "135 years of history", "经典列车持续连接两州首府与沿线城镇。", "A classic rail link between two capitals and regional towns."}, {"轻松日间旅程", "Relaxed daylight journey", "无需卧铺，一路欣赏不断变化的乡野。", "Enjoy changing countryside views throughout the day."}, {"两种座席服务", "Two service levels", "可选择 Red Standard 或 Red Premium。", "Choose Red Standard or Red Premium."}, {"宽裕行李额度", "Generous luggage", "适合跨州旅行与较长行程衔接。", "Well suited to interstate travel and longer itineraries."}}, FAQs: commonFAQs},
	}
}
