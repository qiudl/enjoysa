package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/models"
	productmodel "enjoysa-backend/internal/product/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type imageSeed struct{ File, SourceURL string }
type packageSeed struct {
	NameZh, NameEn, DescZh, DescEn string
	Price                          float64
}
type highlightSeed struct{ TitleZh, TitleEn, DescZh, DescEn string }
type faqSeed struct{ QuestionZh, QuestionEn, AnswerZh, AnswerEn string }
type productSeed struct {
	NameZh, NameEn, SummaryZh, SummaryEn, DescriptionZh, DescriptionEn string
	Address, Duration, GroupSize, BookingURL                           string
	Price                                                              float64
	Tags                                                               []string
	Images                                                             []imageSeed
	Packages                                                           []packageSeed
	Highlights                                                         []highlightSeed
	FAQs                                                               []faqSeed
}
type supplierSeed struct {
	RegionSlug, RegionZh, RegionEn                                      string
	Name, Email, Phone, Website, Address, City, PostalCode, Description string
	Product                                                             productSeed
}
type itemResult struct {
	SupplierID uint   `json:"supplier_id"`
	ProductID  uint   `json:"product_id"`
	Name       string `json:"name"`
	Region     string `json:"region"`
}
type result struct {
	CategoryID uint         `json:"category_id"`
	Items      []itemResult `json:"items"`
}

func main() {
	configPath := flag.String("config", "configs/config.yaml", "config file")
	assetDir := flag.String("asset-dir", "assets/luxury-accommodation", "image directory")
	dryRun := flag.Bool("dry-run", false, "print data only")
	flag.Parse()
	if *dryRun {
		_ = json.NewEncoder(os.Stdout).Encode(seeds())
		return
	}
	r, err := run(*configPath, *assetDir)
	if err != nil {
		log.Fatal(err)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(r)
}

func run(configPath, assetDir string) (*result, error) {
	cfg, err := config.Load(configPath)
	if err != nil {
		return nil, err
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	if err := copyImages(assetDir, cfg.Upload.Dir); err != nil {
		return nil, err
	}
	r := &result{}
	err = db.Transaction(func(tx *gorm.DB) error {
		cat, err := upsertCategory(tx)
		if err != nil {
			return err
		}
		r.CategoryID = cat.ID
		for _, s := range seeds() {
			region, err := upsertRegion(tx, s)
			if err != nil {
				return err
			}
			supplier, err := upsertSupplier(tx, s)
			if err != nil {
				return err
			}
			product, err := upsertProduct(tx, s, supplier.ID, region.ID, cat.ID)
			if err != nil {
				return err
			}
			r.Items = append(r.Items, itemResult{supplier.ID, product.ID, product.NameEn, s.RegionSlug})
		}
		return nil
	})
	return r, err
}

func copyImages(assetDir, uploadDir string) error {
	target := filepath.Join(uploadDir, "luxury-accommodation")
	if err := os.MkdirAll(target, 0755); err != nil {
		return err
	}
	for _, s := range seeds() {
		for _, image := range s.Product.Images {
			if filepath.Base(image.File) != image.File {
				return fmt.Errorf("invalid filename %s", image.File)
			}
			data, err := os.ReadFile(filepath.Join(assetDir, image.File))
			if err != nil {
				return err
			}
			if err := os.WriteFile(filepath.Join(target, image.File), data, 0644); err != nil {
				return err
			}
		}
	}
	return nil
}

func upsertCategory(tx *gorm.DB) (*productmodel.Category, error) {
	var x productmodel.Category
	err := tx.Where("slug = ?", "accommodation").First(&x).Error
	if err == nil {
		return &x, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	x = productmodel.Category{Slug: "accommodation", NameZh: "住宿", NameEn: "Accommodation", Icon: "🏨", SortOrder: 7}
	return &x, tx.Create(&x).Error
}
func upsertRegion(tx *gorm.DB, s supplierSeed) (*productmodel.Region, error) {
	var x productmodel.Region
	err := tx.Where("slug = ?", s.RegionSlug).First(&x).Error
	if err == nil {
		return &x, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	x = productmodel.Region{Slug: s.RegionSlug, NameZh: s.RegionZh, NameEn: s.RegionEn, SortOrder: 10}
	return &x, tx.Create(&x).Error
}
func upsertSupplier(tx *gorm.DB, s supplierSeed) (*models.Supplier, error) {
	var x models.Supplier
	err := tx.Where("lower(name) = lower(?)", s.Name).First(&x).Error
	now := time.Now()
	fields := map[string]interface{}{"name": s.Name, "type": "hotel", "status": "approved", "description": s.Description, "email": s.Email, "phone": s.Phone, "website": s.Website, "address": s.Address, "city": s.City, "state": "SA", "postal_code": s.PostalCode, "country": "Australia", "approved_at": now}
	if err == nil {
		return &x, tx.Model(&x).Updates(fields).Error
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	x = models.Supplier{Name: s.Name, Type: "hotel", Status: "approved", Description: s.Description, Email: s.Email, Phone: s.Phone, Website: s.Website, Address: s.Address, City: s.City, State: "SA", PostalCode: s.PostalCode, Country: "Australia", ApprovedAt: &now}
	return &x, tx.Create(&x).Error
}
func upsertProduct(tx *gorm.DB, s supplierSeed, supplierID, regionID, categoryID uint) (*productmodel.Product, error) {
	p := s.Product
	tags, _ := json.Marshal(p.Tags)
	sourceSlug := s.RegionSlug
	if sourceSlug == "fleurieu" {
		sourceSlug = "fleurieu-peninsula"
	}
	if sourceSlug == "murray" {
		sourceSlug = "murray-river-lakes-and-coorong"
	}
	metadata, _ := json.Marshal(map[string]interface{}{"source_page": "https://southaustralia.com/destinations/" + sourceSlug + "/accommodation", "official_product_url": p.BookingURL, "image_sources": p.Images, "collected_at": time.Now().UTC().Format(time.RFC3339)})
	fields := map[string]interface{}{"name_zh": p.NameZh, "name_en": p.NameEn, "supplier_id": supplierID, "region_id": regionID, "category_id": categoryID, "status": productmodel.ProductStatusDraft, "price_from": p.Price, "currency": "AUD", "summary_zh": p.SummaryZh, "summary_en": p.SummaryEn, "description_zh": p.DescriptionZh, "description_en": p.DescriptionEn, "address_zh": p.Address, "address_en": p.Address, "duration": p.Duration, "group_size": p.GroupSize, "tags": string(tags), "metadata": metadata, "created_via": "admin_proxy"}
	var x productmodel.Product
	err := tx.Where("supplier_id = ? AND name_en = ?", supplierID, p.NameEn).First(&x).Error
	if err == gorm.ErrRecordNotFound {
		x = productmodel.Product{NameZh: p.NameZh, NameEn: p.NameEn, SupplierID: supplierID, RegionID: regionID, CategoryID: categoryID, Status: productmodel.ProductStatusDraft, PriceFrom: p.Price, Currency: "AUD", SummaryZh: p.SummaryZh, SummaryEn: p.SummaryEn, DescriptionZh: p.DescriptionZh, DescriptionEn: p.DescriptionEn, AddressZh: p.Address, AddressEn: p.Address, Duration: p.Duration, GroupSize: p.GroupSize, Tags: string(tags), Metadata: metadata, CreatedVia: "admin_proxy"}
		err = tx.Create(&x).Error
	} else if err == nil {
		err = tx.Model(&x).Updates(fields).Error
	}
	if err != nil {
		return nil, err
	}
	for _, m := range []interface{}{&productmodel.ProductImage{}, &productmodel.ProductPackage{}, &productmodel.ProductHighlight{}, &productmodel.ProductFAQ{}} {
		if err := tx.Unscoped().Where("product_id = ?", x.ID).Delete(m).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.Images {
		if err := tx.Create(&productmodel.ProductImage{ProductID: x.ID, URL: "/uploads/luxury-accommodation/" + v.File, IsCover: i == 0, SortOrder: i}).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.Packages {
		if err := tx.Create(&productmodel.ProductPackage{ProductID: x.ID, NameZh: v.NameZh, NameEn: v.NameEn, DescZh: v.DescZh, DescEn: v.DescEn, Price: v.Price, StockTotal: -1, SortOrder: i + 1}).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.Highlights {
		if err := tx.Create(&productmodel.ProductHighlight{ProductID: x.ID, TitleZh: v.TitleZh, TitleEn: v.TitleEn, DescZh: v.DescZh, DescEn: v.DescEn, SortOrder: i + 1}).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.FAQs {
		if err := tx.Create(&productmodel.ProductFAQ{ProductID: x.ID, QuestionZh: v.QuestionZh, QuestionEn: v.QuestionEn, AnswerZh: v.AnswerZh, AnswerEn: v.AnswerEn, SortOrder: i + 1}).Error; err != nil {
			return nil, err
		}
	}
	return &x, nil
}

type rawSeed struct {
	region, rzh, ren, name, email, phone, site, street, city, post, productZh, productEn string
	price                                                                                float64
	group, summaryZh, summaryEn                                                          string
}

func makeSeed(r rawSeed, index int) supplierSeed {
	prefix := fmt.Sprintf("luxury-%02d", index+1)
	images := make([]imageSeed, 5)
	for i := range images {
		images[i] = imageSeed{fmt.Sprintf("%s-%d.jpg", prefix, i+1), imageSources[index][i]}
	}
	address := r.street + ", " + r.city + " SA " + r.post
	descZh := r.summaryZh + " 此套餐采用该住宿公布的最高价房型或高峰期整套入住方案，适合希望获得更高私密性、空间与服务水准的旅客。实际可订日期、最少入住晚数及包含项目以预订确认为准。"
	descEn := r.summaryEn + " This package represents the property's highest-priced room, residence or peak-period whole-property stay, suited to guests seeking greater privacy, space and service. Available dates, minimum stay and inclusions are confirmed at booking."
	p := productSeed{NameZh: r.productZh, NameEn: r.productEn, Price: r.price, SummaryZh: r.summaryZh, SummaryEn: r.summaryEn, DescriptionZh: descZh, DescriptionEn: descEn, Address: address, Duration: "1 night", GroupSize: r.group, BookingURL: r.site, Tags: []string{r.rzh, "豪华住宿", "高端度假"}, Images: images}
	p.Packages = []packageSeed{{r.productZh, r.productEn, "最高价房型或高峰期整套住宿；最终价格与包含项目以所选日期确认为准。", "Highest-priced room or peak-period whole-property stay; final rate and inclusions are confirmed for selected dates.", r.price}}
	p.Highlights = []highlightSeed{{"精选高端住宿", "Premium accommodation", "以空间、景观、私密性与服务体验为核心。", "Selected for space, outlook, privacy and service."}, {"独特地域体验", "Distinctive setting", r.summaryZh, r.summaryEn}}
	p.FAQs = []faqSeed{{"价格包含什么？", "What does the rate include?", "包含项目会随房型、入住日期与套餐变化，请在预订时确认餐饮、接送、活动及附加费用。", "Inclusions vary by room, dates and package. Confirm meals, transfers, activities and surcharges when booking."}, {"入住与取消政策如何确认？", "How are check-in and cancellation terms confirmed?", "入住时间、最少入住晚数、押金及取消条款会在预订确认前列明。", "Check-in time, minimum stay, deposit and cancellation terms are provided before booking confirmation."}}
	return supplierSeed{RegionSlug: r.region, RegionZh: r.rzh, RegionEn: r.ren, Name: r.name, Email: r.email, Phone: r.phone, Website: r.site, Address: r.street, City: r.city, PostalCode: r.post, Description: r.summaryEn, Product: p}
}

func seeds() []supplierSeed {
	raws := []rawSeed{
		{"adelaide", "阿德莱德", "Adelaide", "Brindabella", "hello@brindabellasailing.com.au", "04 1101 0415", "http://www.brindabellasailing.com.au", "750 Victoria Road", "Outer Harbor", "5018", "Brindabella 私享游艇住宿航程", "Brindabella Private Yacht Accommodation Voyage", 1500, "2 guests", "入住传奇 80 英尺竞赛游艇，在阿德莱德海岸享受私密过夜航程。", "Stay aboard the restored 80-foot racing maxi yacht for a private overnight Adelaide coast voyage."},
		{"adelaide", "阿德莱德", "Adelaide", "Large Group House in Pasadena", "support@webnb.me", "04 9882 5105", "https://www.webnb.me/properties/large-group-house-in-pasadena-south-australia/", "79 Quinlan Avenue", "Pasadena", "5042", "Pasadena 八卧室整屋高峰住宿", "Pasadena Eight-Bedroom Peak Whole-House Stay", 1100, "up to 20 guests", "宽敞八卧室住宅配四间浴室，为亲友团体提供充足的共享与休息空间。", "A spacious eight-bedroom, four-bathroom residence with generous shared and private space for groups."},
		{"adelaide", "阿德莱德", "Adelaide", "Westbourne Park Saltpool Hideaway", "support+westbourne@webnb.me", "04 9882 5105", "https://www.webnb.me/properties/westbourne-park-saltpool-hideaway/", "118 Grange Road", "Westbourne Park", "5041", "Westbourne Park 盐水泳池整屋住宿", "Westbourne Park Salt Pool Peak Whole-House Stay", 1200, "up to 16 guests", "在靠近阿德莱德市区的宽敞度假住宅享用私人盐水泳池与团体空间。", "A spacious city-fringe holiday home combining a private saltwater pool with generous group living."},
		{"adelaide", "阿德莱德", "Adelaide", "Mirani's Penthouse", "paul@halcyonadvisors.com.au", "04 1783 7410", "https://southaustralia.com/products/adelaide/accommodation/miranis-penthouse", "1A Mirani Court", "West Lakes Shore", "5020", "Mirani's Penthouse 高峰住宿", "Mirani's Penthouse Peak Stay", 2000, "up to 8 guests", "现代顶层住宅以精致设计、舒适空间和西湖海岸位置呈现奢华城市度假。", "A newly finished penthouse pairs sleek design and modern comfort with a West Lakes Shore setting."},
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "Sequoia Lodge", "stay@sequoialodge.com.au", "08 8130 9230", "https://www.sequoialodge.com.au", "1 Mawson Drive", "Crafers", "5152", "Sequoia 山谷景观套房体验", "Sequoia Valley View Suite Experience", 2299, "2 adults", "成人专属山巅度假村的现代可持续套房，俯瞰 Piccadilly Valley、葡萄园与林地。", "An adults-only contemporary sustainable suite overlooking Piccadilly Valley, vineyards and bushland."},
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "Thorngrove Manor House", "reservations@thorngrove.com.au", "08 8339 6748", "http://www.thorngrove.com.au", "2 Glenside Lane", "Stirling", "5152", "Thorngrove Manor 豪华套房住宿", "Thorngrove Manor Grand Suite Stay", 2599, "2 adults", "入住独具建筑艺术感的浪漫庄园，在 Stirling 山林中享受私密奢华体验。", "A romantic, architecturally distinctive manor retreat offering secluded luxury in leafy Stirling."},
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "Simon Tolley Lodge", "admin@simontolley.com.au", "04 0334 4345", "http://www.simontolleylodge.com.au", "278 Bird in Hand Road", "Woodside", "5244", "Simon Tolley Lodge 葡萄园整屋住宿", "Simon Tolley Lodge Exclusive Vineyard Stay", 1150, "up to 8 guests", "经翻新的精品葡萄园小屋坐落于阿德莱德山葡萄酒乡中心。", "A newly renovated premium vineyard lodge in the heart of Adelaide Hills wine country."},
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "The Castle Keep B&B", "thekeep@thorngrove.com.au", "08 8339 6748", "https://www.stayz.com.au/holiday-rental/p9016429", "2 Glenside Lane", "Stirling", "5152", "Castle Keep 私密城堡住宿", "Castle Keep Private Retreat", 989, "2 adults", "多层城堡式度假屋以 Angaston 白色大理石打造，营造浪漫而独特的私密空间。", "A multi-storey castle-like retreat built from Angaston white marble for an enchanting private escape."},
		{"barossa", "巴罗莎谷", "Barossa Valley", "Tanunda House", "info@tanundahouse.com", "04 1934 6435", "https://www.tanundahouse.com/", "40 Maria Street", "Tanunda", "5352", "Tanunda House 高峰整屋住宿", "Tanunda House Peak Whole-Property Stay", 3000, "up to 16 guests", "位于 Tanunda 中心的豪华整栋宅邸，是亲友探索巴罗莎酒乡的私密据点。", "A luxury whole residence in central Tanunda, designed as a private base for groups exploring Barossa wine country."},
		{"barossa", "巴罗莎谷", "Barossa Valley", "Fine Acres Estate", "enquiries@fineacres.com.au", "04 9855 2220", "https://www.fineacres.com.au/", "303 Vine Vale Road", "Vine Vale", "5352", "Fine Acres Estate 整庄园住宿", "Fine Acres Estate Exclusive Stay", 2000, "up to 12 guests", "由 1880 年代葡萄园农舍焕新而成的豪华庄园，坐落于巴罗莎核心地带。", "A luxury Barossa estate transformed from an 1880s vineyard farmhouse in the heart of Vine Vale."},
		{"barossa", "巴罗莎谷", "Barossa Valley", "The Station at Kapunda", "stay@thestationkapunda.com", "04 0727 4438", "https://www.thestationkapunda.com/", "19 Railway Parade", "Kapunda", "5373", "The Station Kapunda 高峰团体住宿", "The Station at Kapunda Peak Group Stay", 2000, "10-14 guests", "经精心改造的历史车站为 10 至 14 位宾客提供高品质团体住宿。", "A thoughtfully restored historic station providing luxury group accommodation for 10 to 14 guests."},
		{"barossa", "巴罗莎谷", "Barossa Valley", "Gawler Park Estate", "stay@bgrsa.com.au", "04 0739 3596", "https://bgrsa.com.au/gawler-park-estate/", "235 Gawler Park Road", "Angaston", "5353", "Gawler Park Estate 私享庄园住宿", "Gawler Park Estate Exclusive-Use Stay", 2000, "up to 12 guests", "占地 40 公顷的专属庄园在 Angaston 提供高度私密、精致而轻松的奢华住宿。", "An exclusive-use 40-hectare Angaston estate offering privacy, sophistication and effortless luxury."},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "One KI", "stay@onekangarooisland.com.au", "04 0003 3551", "https://www.onekangarooisland.com.au/enquiries", "Lot 205 Mad Mile Track", "Browns Beach", "5222", "One KI 十人高峰全包住宿", "One KI Peak All-Inclusive Stay for Ten", 15570, "up to 10 guests", "袋鼠岛海岸的专属托管度假宅邸，结合全包餐饮、私密空间与开阔海景。", "An exclusive hosted coastal home pairing all-inclusive dining, privacy and expansive Kangaroo Island views."},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Southern Ocean Lodge", "reserve+southern-ocean-lodge@beckons.com", "02 9918 4355", "https://southernoceanlodge.com.au/stay/baillie-pavilion/", "Hanson Bay Road", "Karatta", "5223", "Southern Ocean Lodge Baillie Pavilion", "Southern Ocean Lodge Baillie Pavilion", 18000, "up to 8 guests", "旗舰 Baillie Pavilion 以四间卧室、私人泳池与南大洋全景呈现袋鼠岛顶级住宿。", "The flagship four-bedroom Baillie Pavilion offers a private pool and panoramic Southern Ocean outlooks."},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Sea Dragon Kangaroo Island", "info@seadragonkangarooisland.com", "04 0172 7234", "https://www.seadragonkangarooisland.com", "2575 Cape Willoughby Road", "Willoughby", "5222", "Sea Dragon 私享豪华套餐", "Sea Dragon Private Luxury Package", 4030, "up to 10 guests", "在 Cape Willoughby 的僻静海岸享受自然、野生动物与高品质服务相结合的私密度假。", "A secluded Cape Willoughby escape combining coastal nature, wildlife and premium hospitality."},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Walcowrie", "stay+walcowrie@onekangarooisland.com.au", "04 0003 3551", "https://www.onekangarooisland.com.au/enquiries", "Lot 217 Mad Mile Track", "Browns Beach", "5222", "Walcowrie 十人高峰整屋住宿", "Walcowrie Peak Whole-House Stay for Ten", 3780, "up to 10 guests", "高品质海滨度假住宅以现代设施、海景与宁静环境呈现轻松的袋鼠岛生活。", "A premium beachfront holiday home with modern amenities, ocean views and peaceful coastal living."},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Oasis Houseboat", "oasis@rivermurrayrentals.com.au", "13 0016 0814", "https://www.houseboatbookings.com/departure-points/mannum/oasis-houseboat/oasis/", "Pelican Drive, Berth 11", "Mannum", "5238", "Oasis Houseboat 新年周包船", "Oasis Houseboat New Year Week", 9000, "up to 12 guests", "设计兼顾舒适、风格与实用性的高端船屋，为团体呈现完整墨累河假期。", "A premium houseboat designed for comfort, style and practicality on an extended Murray River escape."},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Greenbanks Family Escape", "stay@rivershackrentals.com.au", "08 8569 1702", "https://www.rivershackrentals.com.au/properties/1-greenbanks-drive-via-murraybridge/", "1 Greenbanks Drive", "Greenbanks", "5253", "Greenbanks Family Escape 高峰住宿", "Greenbanks Family Escape Peak Stay", 3000, "up to 14 guests", "新建的设计师滨水住宅在 Mannum Waters 提供开阔河景与豪华家庭空间。", "A newly built designer waterfront residence offering expansive river views and luxurious family space."},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Safari Lodge", "monarto@monartosafariresort.com", "18 0001 6761", "https://monartosafariresort.com/safari-lodge/", "525 Monarto Road", "Rocky Gully", "5254", "Safari Lodge 顶级野奢套餐", "Safari Lodge Premier Safari Package", 3500, "2 guests", "将野生动物探险的震撼与世界级款待结合，呈现澳大利亚独特野奢体验。", "A luxury safari stay combining the thrill of wildlife with world-class Australian hospitality."},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Willow at Bow Hill", "stay+willow@rivershackrentals.com.au", "08 8569 1702", "https://www.rivershackrentals.com.au/properties/willow-41-providence-drive-bowhill/", "41 Providence Drive", "Bowhill", "5238", "Willow Bow Hill 高峰整屋住宿", "Willow at Bow Hill Peak Whole-House Stay", 2000, "up to 12 guests", "建筑师设计的现代河畔住宅，为家庭与亲友团体带来高品质墨累河生活。", "An architect-designed modern riverfront home delivering a premium Murray River stay for families and groups."},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "Naiko Retreat", "christine@wagtail.net.au", "04 1509 5644", "https://www.naikoretreat.com.au", "48 Jagger Road", "Encounter Bay", "5211", "Naiko Retreat 高峰整屋住宿", "Naiko Retreat Peak Whole-Property Stay", 1950, "up to 6 guests", "由建筑师 Max Pritchard 设计的三卧室奢华度假屋，隔海眺望袋鼠岛。", "A luxury three-bedroom retreat by architect Max Pritchard with views towards Kangaroo Island."},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "The Villa at Naiko at the Bluff", "info@naikoatthebluff.com.au", "04 1509 5644", "https://naikoatthebluff.com.au/", "28 Jagger Road", "Encounter Bay", "5211", "Naiko at the Bluff Villa 高峰住宿", "The Villa at Naiko at the Bluff Peak Stay", 2500, "up to 8 guests", "拥有高度私密性与无遮挡海景的豪华家庭别墅，适合安静而完整的海岸假期。", "A luxurious family villa offering total privacy, uninterrupted coastal views and unhurried relaxation."},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "Absolute Beachfront Cowrie Retreat", "susansweeney@bigpond.com", "04 1939 0530", "https://cowrieretreat.com.au/", "16 Lady Bay Road, Site 21", "Normanville", "5204", "Cowrie Retreat 高峰海滨住宿", "Cowrie Retreat Peak Beachfront Stay", 1950, "up to 6 guests", "从露台沿小径直达海滩，在 Normanville 海岸享受宁静而私密的度假时光。", "Step from the deck onto a path to the beach for a secluded Normanville coastal retreat."},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "The Dune House", "management@norfolkhouse.co", "04 8812 4932", "https://www.norfolkhouse.co/", "6B Commerce Crescent", "Victor Harbor", "5211", "The Dune House 高峰整屋住宿", "The Dune House Peak Whole-Property Stay", 5000, "up to 10 guests", "获奖建筑度假屋隐于 Hindmarsh Island 沙丘，将现代设计与海岸自然景观融为一体。", "An award-winning architectural retreat nestled in the Hindmarsh Island dunes, blending modern design with the coast."},
	}
	out := make([]supplierSeed, len(raws))
	for i, r := range raws {
		out[i] = makeSeed(r, i)
	}
	return out
}

var imageSources = [24][5]string{
	{"https://assets.atdw-online.com.au/images/b627ec7ca3dd3eb2633599b738cc12b6.jpeg", "https://assets.atdw-online.com.au/images/9da26ee6525421852adc5d2f3d20afee.jpeg", "https://assets.atdw-online.com.au/images/70b635cc2dbcdf4059efcff4a83188cd.jpeg", "https://assets.atdw-online.com.au/images/4aac468bfe12ee0875570b0c756fc241.jpeg", "https://assets.atdw-online.com.au/images/b627ec7ca3dd3eb2633599b738cc12b6.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/431b4c160dc4a233d70d829d26081af8.jpeg", "https://assets.atdw-online.com.au/images/ef8af63ac1943539d106e4fe60fc722c.jpeg", "https://assets.atdw-online.com.au/images/1f1ae76cfa192f5424923144de1057ee.jpeg", "https://assets.atdw-online.com.au/images/c268d2468a22c2d94b2762414b55c211.jpeg", "https://assets.atdw-online.com.au/images/431b4c160dc4a233d70d829d26081af8.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/1e4787250f3743df8844144d86089266.jpeg", "https://assets.atdw-online.com.au/images/eb11f30b520f14ff510eb11b5bbd449e.jpeg", "https://assets.atdw-online.com.au/images/8342ee21ae5fb2ad467afaa79fb38c07.jpeg", "https://assets.atdw-online.com.au/images/64c69adc260dd8e63b98f7f92419298c.jpeg", "https://assets.atdw-online.com.au/images/1e4787250f3743df8844144d86089266.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/a6a09313184e51c4deda68170af54ab3.jpeg", "https://assets.atdw-online.com.au/images/a6a09313184e51c4deda68170af54ab3.jpeg?w=1600", "https://assets.atdw-online.com.au/images/a6a09313184e51c4deda68170af54ab3.jpeg?w=1400", "https://assets.atdw-online.com.au/images/a6a09313184e51c4deda68170af54ab3.jpeg?w=1200", "https://assets.atdw-online.com.au/images/a6a09313184e51c4deda68170af54ab3.jpeg?w=1000"},
	{"https://assets.atdw-online.com.au/images/71e0f75d77e54f3d8668628b6ec41bf0.jpeg", "https://assets.atdw-online.com.au/images/22fae83c35e9ae7db5925e24bd98ff1a.jpeg", "https://assets.atdw-online.com.au/images/06b5b45f35bcde7ccd51741927553171.jpeg", "https://assets.atdw-online.com.au/images/1c14b11493043a5fb6522e6831134abe.jpeg", "https://assets.atdw-online.com.au/images/41144c4f765fe21a0aca34654e58f09f.jpeg"},
	{"https://assets.atdw-online.com.au/images/c01a6b70cb020c73354653c829cbbdac.jpeg", "https://assets.atdw-online.com.au/images/1d0f548028279951b82afc7dec9ac74a.jpeg", "https://assets.atdw-online.com.au/images/87ec60b6073656ee006f1f7b6fe21ef0.jpeg", "https://assets.atdw-online.com.au/images/6d17c005129a276d634d55baa4a4cbab.jpeg", "https://assets.atdw-online.com.au/images/c49cf74c779e9d07faefc82e99e8ea58.jpeg"},
	{"https://assets.atdw-online.com.au/images/92e2073d130663c59b5ca6add1099308.jpeg", "https://assets.atdw-online.com.au/images/91ada56bc90b0a2b19972f13c5a12ca2.jpeg", "https://assets.atdw-online.com.au/images/7cd89bbcb7a74d68744f95f767c5ef68.jpeg", "https://assets.atdw-online.com.au/images/a3acd941287275476b81d4805ab0c10f.jpeg", "https://assets.atdw-online.com.au/images/92e2073d130663c59b5ca6add1099308.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/8d7e8fe3442ee15d1499550638b96b42.jpeg", "https://assets.atdw-online.com.au/images/d2fe236f6635256784bb160f6ddf8d0a.jpeg", "https://assets.atdw-online.com.au/images/4fd19cf566d46395e882455b8d35a634.jpeg", "https://assets.atdw-online.com.au/images/eeab5848a5a2dce6bb6eba705618079b.jpeg", "https://assets.atdw-online.com.au/images/8d7e8fe3442ee15d1499550638b96b42.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/22591aca6e0a3d7a17f67737543d6238.jpeg", "https://assets.atdw-online.com.au/images/3942d61259e707a3dd28b1b620b204b2.jpeg", "https://assets.atdw-online.com.au/images/549cc88f1d3370b35569cfb638865047.jpeg", "https://assets.atdw-online.com.au/images/35b711b08d5a5f98bc6f81e61dff5ba8.jpeg", "https://assets.atdw-online.com.au/images/22591aca6e0a3d7a17f67737543d6238.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/3ad56f4c82032c529a113c5f74d26c56.jpeg", "https://assets.atdw-online.com.au/images/037a73f48d5de1c6c2a942b0076b5691.jpeg", "https://assets.atdw-online.com.au/images/365bb6b4b5d21cd8aa41109b93b53e70.jpeg", "https://assets.atdw-online.com.au/images/5d690514e36c289a7d3ba715600b168f.jpeg", "https://assets.atdw-online.com.au/images/3ad56f4c82032c529a113c5f74d26c56.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/64d69c1d0d376511db353b82426e8402.jpeg", "https://assets.atdw-online.com.au/images/6765501e936de9ac9d8f656d518001da.jpeg", "https://assets.atdw-online.com.au/images/1ca0e7fceb0d0668efc6e7497d0e0a34.jpeg", "https://assets.atdw-online.com.au/images/f017632d318c80155fa8aec3285c79a1.jpeg", "https://assets.atdw-online.com.au/images/64d69c1d0d376511db353b82426e8402.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/1cc4a015ea5f0def4d5d314247e9a2ba.jpeg", "https://assets.atdw-online.com.au/images/962edee71f0a195ab89a6d3fbba251c7.jpeg", "https://assets.atdw-online.com.au/images/07a1aafa684b3b9f118f0d29a57ccb5a.jpeg", "https://assets.atdw-online.com.au/images/cd0d2c525698d6e42193cbea3446816c.jpeg", "https://assets.atdw-online.com.au/images/1cc4a015ea5f0def4d5d314247e9a2ba.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/f499aed2e622106492988653bc574307.jpeg", "https://assets.atdw-online.com.au/images/3e41acca34440cd030c47dbf5adacf92.jpeg", "https://assets.atdw-online.com.au/images/bc648d4bbfb45f87b0f019a62b200572.jpeg", "https://assets.atdw-online.com.au/images/b9cc40c519a12ba960bd6f629cbad7b9.jpeg", "https://assets.atdw-online.com.au/images/f499aed2e622106492988653bc574307.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/2db97e5921f2c20d23abf33f194ca14a.jpeg", "https://assets.atdw-online.com.au/images/f1d585ef090153d5ed605d819b133bba.jpeg", "https://assets.atdw-online.com.au/images/e070efd3c5453e3dce9448f6bb335a1a.jpeg", "https://assets.atdw-online.com.au/images/77d625362c3b44d4519c2326eaf3bf23.jpeg", "https://assets.atdw-online.com.au/images/e4fcb782acd99ad12dbda2d7aa1dbdac.jpeg"},
	{"https://assets.atdw-online.com.au/images/ea4e5184535836b6fcddaa6335c51cde.jpeg", "https://assets.atdw-online.com.au/images/60afe45df3c61d98492f4b45a3d82d91.jpeg", "https://assets.atdw-online.com.au/images/8584c2dbecdb84e830d05b6059c06464.jpeg", "https://assets.atdw-online.com.au/images/b4abb4d647ffa3912726122e13c47774.jpeg", "https://assets.atdw-online.com.au/images/ea4e5184535836b6fcddaa6335c51cde.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/90da5804d3a0c262347894430f0c5919.jpeg", "https://assets.atdw-online.com.au/images/70c947e07b41a5936580333966ee308c.jpeg", "https://assets.atdw-online.com.au/images/479fc27a85922d837807bf7dcb5b60b8.jpeg", "https://assets.atdw-online.com.au/images/da8c7173b0fb5ef4dd78f2eeb2ac1200.jpeg", "https://assets.atdw-online.com.au/images/90da5804d3a0c262347894430f0c5919.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/14716cae69654569e493cd717eb9966a.jpeg", "https://assets.atdw-online.com.au/images/12888e8bc37d190a857b0af0a3c006b6.jpeg", "https://assets.atdw-online.com.au/images/14716cae69654569e493cd717eb9966a.jpeg?w=1600", "https://assets.atdw-online.com.au/images/12888e8bc37d190a857b0af0a3c006b6.jpeg?w=1600", "https://assets.atdw-online.com.au/images/14716cae69654569e493cd717eb9966a.jpeg?w=1200"},
	{"https://assets.atdw-online.com.au/images/74d83a4e4bc6b351df165320dc691167.jpeg", "https://assets.atdw-online.com.au/images/2ab194cb0a3befedf656fe2eec626669.jpeg", "https://assets.atdw-online.com.au/images/54b16786ea997aff2d61b647cebc49a0.jpeg", "https://assets.atdw-online.com.au/images/5a4184fa0a464c28f5fa16efad35e6f7.jpeg", "https://assets.atdw-online.com.au/images/74d83a4e4bc6b351df165320dc691167.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/9435a17786a44e0dae51fbdc6cf90b50.jpeg", "https://assets.atdw-online.com.au/images/676eabfa7e874afe4ba26f0294683adf.jpeg", "https://assets.atdw-online.com.au/images/2f50fc044f97e46616d120e7758911cf.jpeg", "https://assets.atdw-online.com.au/images/c17e59263f5de098892d31176c589fb0.jpeg", "https://assets.atdw-online.com.au/images/9435a17786a44e0dae51fbdc6cf90b50.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/38ee4272838d66cacf13efc0c7690264.jpeg", "https://assets.atdw-online.com.au/images/3fb6d062c82cd7fca9f34a6c8e69c0eb.jpeg", "https://assets.atdw-online.com.au/images/847f8bf8a16e982631817151d0b2e78e.jpeg", "https://assets.atdw-online.com.au/images/f76e76b65773cde027b4e6bf50f0862c.jpeg", "https://assets.atdw-online.com.au/images/38ee4272838d66cacf13efc0c7690264.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/021d8eb132b3dc84feb93058a3746dfb.jpeg", "https://assets.atdw-online.com.au/images/b37369e3ba99f3e6dc8d5f186498f1b6.jpeg", "https://assets.atdw-online.com.au/images/5bd5789cf461484da5e5c9e4cbf0b7aa.jpeg", "https://assets.atdw-online.com.au/images/1023789de665559269f447fcf5ae1585.jpeg", "https://assets.atdw-online.com.au/images/021d8eb132b3dc84feb93058a3746dfb.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/e1675174dcbb3260acb44cb5bd9b12a2.jpeg", "https://assets.atdw-online.com.au/images/7719e8bbda0d870718fb7037dc029792.jpeg", "https://assets.atdw-online.com.au/images/645fae42ade2da3f30ba78626cd6cb33.jpeg", "https://assets.atdw-online.com.au/images/af91ef1756813613990f998fb6c5e5f8.jpeg", "https://assets.atdw-online.com.au/images/e1675174dcbb3260acb44cb5bd9b12a2.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/2fe1dbead26edffea9b260d5f7f84db2.jpeg", "https://assets.atdw-online.com.au/images/305cd8e8ebe8d70c271f8eb7a0e3a154.jpeg", "https://assets.atdw-online.com.au/images/6b23528ed8bffedb36fbb546c7963b22.jpeg", "https://assets.atdw-online.com.au/images/f98ee61dc74b35d4d37250118a303ada.jpeg", "https://assets.atdw-online.com.au/images/2fe1dbead26edffea9b260d5f7f84db2.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/1c2c9cc32a6eff8c5411d7ea9c2724a4.jpeg", "https://assets.atdw-online.com.au/images/ffda58b86914ee50c134081557c19302.jpeg", "https://assets.atdw-online.com.au/images/532dcc6816ef4866a211c0fc909ded02.jpeg", "https://assets.atdw-online.com.au/images/abc0e8c7be57726876ea5b1ffc6bdb94.jpeg", "https://assets.atdw-online.com.au/images/1c2c9cc32a6eff8c5411d7ea9c2724a4.jpeg?w=1600"},
}
