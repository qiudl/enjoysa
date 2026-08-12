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

const sourcePage = "https://southaustralia.com/destinations/barossa/food-and-drink"

type supplierSeed struct {
	Name, Email, Phone, Website, Address, City, PostalCode, Description string
	Product                                                             productSeed
}

type productSeed struct {
	NameZh, NameEn, SummaryZh, SummaryEn, DescriptionZh, DescriptionEn string
	Address, Duration, GroupSize, ImageFile, ImageSource, BookingURL   string
	Price                                                              float64
	Tags                                                               []string
	Packages                                                           []packageSeed
	Highlights                                                         []highlightSeed
	FAQs                                                               []faqSeed
}

type packageSeed struct {
	NameZh, NameEn, DescZh, DescEn string
	Price                          float64
}
type highlightSeed struct{ TitleZh, TitleEn, DescZh, DescEn string }
type faqSeed struct{ QuestionZh, QuestionEn, AnswerZh, AnswerEn string }
type imageSeed struct{ File, SourceURL string }

type result struct {
	RegionID   uint             `json:"region_id"`
	CategoryID uint             `json:"category_id"`
	Suppliers  []supplierResult `json:"suppliers"`
}
type supplierResult struct {
	Name        string `json:"name"`
	ProductName string `json:"product_name"`
	SupplierID  uint   `json:"supplier_id"`
	ProductID   uint   `json:"product_id"`
}

func main() {
	configPath := flag.String("config", "configs/config.yaml", "config file")
	assetDir := flag.String("asset-dir", "assets/barossa-restaurants", "bundled image directory")
	dryRun := flag.Bool("dry-run", false, "print records without writing")
	flag.Parse()
	if *dryRun {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(seeds()); err != nil {
			log.Fatal(err)
		}
		return
	}
	res, err := run(*configPath, *assetDir)
	if err != nil {
		log.Fatal(err)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(res); err != nil {
		log.Fatal(err)
	}
}

func run(configPath, assetDir string) (*result, error) {
	cfg, err := config.Load(configPath)
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	if err := copyImages(assetDir, cfg.Upload.Dir); err != nil {
		return nil, err
	}
	res := &result{}
	err = db.Transaction(func(tx *gorm.DB) error {
		region, err := upsertRegion(tx)
		if err != nil {
			return err
		}
		category, err := upsertCategory(tx)
		if err != nil {
			return err
		}
		res.RegionID, res.CategoryID = region.ID, category.ID
		for _, seed := range seeds() {
			supplier, err := upsertSupplier(tx, seed)
			if err != nil {
				return err
			}
			product, err := upsertProduct(tx, seed.Product, supplier.ID, region.ID, category.ID)
			if err != nil {
				return err
			}
			res.Suppliers = append(res.Suppliers, supplierResult{Name: supplier.Name, SupplierID: supplier.ID, ProductName: product.NameEn, ProductID: product.ID})
		}
		return nil
	})
	return res, err
}

func copyImages(assetDir, uploadDir string) error {
	target := filepath.Join(uploadDir, "barossa-restaurants")
	if err := os.MkdirAll(target, 0o755); err != nil {
		return err
	}
	for _, seed := range seeds() {
		images := append([]imageSeed{{seed.Product.ImageFile, seed.Product.ImageSource}}, galleryFor(seed.Product.NameEn)...)
		for _, image := range images {
			if filepath.Base(image.File) != image.File {
				return fmt.Errorf("invalid image filename %q", image.File)
			}
			data, err := os.ReadFile(filepath.Join(assetDir, image.File))
			if err != nil {
				return fmt.Errorf("read %s: %w", image.File, err)
			}
			if err := os.WriteFile(filepath.Join(target, image.File), data, 0o644); err != nil {
				return fmt.Errorf("write %s: %w", image.File, err)
			}
		}
	}
	return nil
}

func upsertRegion(tx *gorm.DB) (*productmodel.Region, error) {
	var region productmodel.Region
	err := tx.Where("slug = ?", "barossa").First(&region).Error
	if err == nil {
		return &region, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	region = productmodel.Region{Slug: "barossa", NameZh: "芭罗莎谷", NameEn: "Barossa", SortOrder: 3}
	return &region, tx.Create(&region).Error
}

func upsertCategory(tx *gorm.DB) (*productmodel.Category, error) {
	var category productmodel.Category
	err := tx.Where("slug = ?", "dining").First(&category).Error
	if err == nil {
		return &category, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	category = productmodel.Category{Slug: "dining", NameZh: "餐饮美食", NameEn: "Dining", Icon: "utensils", SortOrder: 8}
	return &category, tx.Create(&category).Error
}

func upsertSupplier(tx *gorm.DB, seed supplierSeed) (*models.Supplier, error) {
	var supplier models.Supplier
	err := tx.Where("email = ? OR lower(name) = lower(?)", seed.Email, seed.Name).First(&supplier).Error
	if err == gorm.ErrRecordNotFound && seed.Name == "Hentley Farm Restaurant" {
		err = tx.Where("lower(name) = ?", "hentley farm").First(&supplier).Error
	}
	now := time.Now()
	fields := map[string]interface{}{"name": seed.Name, "type": "restaurant", "status": "approved", "description": seed.Description, "email": seed.Email, "phone": seed.Phone, "website": seed.Website, "address": seed.Address, "city": seed.City, "state": "SA", "postal_code": seed.PostalCode, "country": "Australia", "approved_at": now}
	if err == nil {
		if err := tx.Model(&supplier).Updates(fields).Error; err != nil {
			return nil, fmt.Errorf("update supplier %s: %w", seed.Name, err)
		}
		return &supplier, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	supplier = models.Supplier{Name: seed.Name, Type: "restaurant", Status: "approved", Description: seed.Description, Email: seed.Email, Phone: seed.Phone, Website: seed.Website, Address: seed.Address, City: seed.City, State: "SA", PostalCode: seed.PostalCode, Country: "Australia", ApprovedAt: &now}
	if err := tx.Create(&supplier).Error; err != nil {
		return nil, fmt.Errorf("create supplier %s: %w", seed.Name, err)
	}
	return &supplier, nil
}

func upsertProduct(tx *gorm.DB, seed productSeed, supplierID, regionID, categoryID uint) (*productmodel.Product, error) {
	tags, _ := json.Marshal(seed.Tags)
	imageSources := append([]imageSeed{{seed.ImageFile, seed.ImageSource}}, galleryFor(seed.NameEn)...)
	metadata, _ := json.Marshal(map[string]interface{}{"source_page": sourcePage, "official_product_url": seed.BookingURL, "official_image_sources": imageSources, "collected_at": time.Now().UTC().Format(time.RFC3339)})
	fields := map[string]interface{}{"name_zh": seed.NameZh, "name_en": seed.NameEn, "supplier_id": supplierID, "region_id": regionID, "category_id": categoryID, "status": productmodel.ProductStatusDraft, "price_from": seed.Price, "currency": "AUD", "summary_zh": seed.SummaryZh, "summary_en": seed.SummaryEn, "description_zh": seed.DescriptionZh, "description_en": seed.DescriptionEn, "address_zh": seed.Address, "address_en": seed.Address, "duration": seed.Duration, "group_size": seed.GroupSize, "tags": string(tags), "metadata": metadata, "created_via": "admin_proxy"}
	var product productmodel.Product
	err := tx.Where("supplier_id = ? AND name_en = ?", supplierID, seed.NameEn).First(&product).Error
	if err == gorm.ErrRecordNotFound {
		product = productmodel.Product{NameZh: seed.NameZh, NameEn: seed.NameEn, SupplierID: supplierID, RegionID: regionID, CategoryID: categoryID, Status: productmodel.ProductStatusDraft, PriceFrom: seed.Price, Currency: "AUD", SummaryZh: seed.SummaryZh, SummaryEn: seed.SummaryEn, DescriptionZh: seed.DescriptionZh, DescriptionEn: seed.DescriptionEn, AddressZh: seed.Address, AddressEn: seed.Address, Duration: seed.Duration, GroupSize: seed.GroupSize, Tags: string(tags), Metadata: metadata, CreatedVia: "admin_proxy"}
		if err := tx.Create(&product).Error; err != nil {
			return nil, fmt.Errorf("create product %s: %w", seed.NameEn, err)
		}
	} else if err != nil {
		return nil, err
	} else if err := tx.Model(&product).Updates(fields).Error; err != nil {
		return nil, fmt.Errorf("update product %s: %w", seed.NameEn, err)
	}
	if err := replaceAssociations(tx, product.ID); err != nil {
		return nil, err
	}
	image := productmodel.ProductImage{ProductID: product.ID, URL: "/uploads/barossa-restaurants/" + seed.ImageFile, IsCover: true, SortOrder: 0}
	if err := tx.Create(&image).Error; err != nil {
		return nil, err
	}
	for i, gallery := range galleryFor(seed.NameEn) {
		image := productmodel.ProductImage{ProductID: product.ID, URL: "/uploads/barossa-restaurants/" + gallery.File, IsCover: false, SortOrder: i + 1}
		if err := tx.Create(&image).Error; err != nil {
			return nil, err
		}
	}
	for i, p := range seed.Packages {
		record := productmodel.ProductPackage{ProductID: product.ID, NameZh: p.NameZh, NameEn: p.NameEn, DescZh: p.DescZh, DescEn: p.DescEn, Price: p.Price, StockTotal: -1, SortOrder: i + 1}
		if err := tx.Create(&record).Error; err != nil {
			return nil, err
		}
	}
	for i, h := range seed.Highlights {
		record := productmodel.ProductHighlight{ProductID: product.ID, TitleZh: h.TitleZh, TitleEn: h.TitleEn, DescZh: h.DescZh, DescEn: h.DescEn, SortOrder: i + 1}
		if err := tx.Create(&record).Error; err != nil {
			return nil, err
		}
	}
	for i, f := range seed.FAQs {
		record := productmodel.ProductFAQ{ProductID: product.ID, QuestionZh: f.QuestionZh, QuestionEn: f.QuestionEn, AnswerZh: f.AnswerZh, AnswerEn: f.AnswerEn, SortOrder: i + 1}
		if err := tx.Create(&record).Error; err != nil {
			return nil, err
		}
	}
	return &product, nil
}

func replaceAssociations(tx *gorm.DB, id uint) error {
	for _, model := range []interface{}{&productmodel.ProductImage{}, &productmodel.ProductPackage{}, &productmodel.ProductHighlight{}, &productmodel.ProductFAQ{}} {
		if err := tx.Unscoped().Where("product_id = ?", id).Delete(model).Error; err != nil {
			return err
		}
	}
	return nil
}

func galleryFor(productName string) []imageSeed {
	return map[string][]imageSeed{
		"Hentley Farm Discovery Tasting Menu": {
			{"hentley-gallery-wine.jpg", "https://hentleyfarm.com.au/cdn/shop/collections/HentleyFarm-AUG22-0061-web.jpg?v=1747034503&width=1480"},
			{"hentley-gallery-sparkling.jpg", "https://hentleyfarm.com.au/cdn/shop/collections/HentleyFarm-JUL22-0112-web.jpg?v=1747034038&width=1480"},
			{"hentley-gallery-kitchen.jpg", "https://hentleyfarm.com.au/cdn/shop/files/DSC04761.jpg?v=1736731114&width=1200"},
			{"hentley-gallery-dining.jpg", "https://hentleyfarm.com.au/cdn/shop/files/DSC04792-Enhanced-NR_f5fc25ef-ba73-4f26-a7a2-0cd33c8b1559.jpg?v=1736730996&width=1200"},
		},
		"fermentAsian Chef's Tasting Menu": {
			{"fermentasian-gallery-restaurant.jpg", "https://fermentasian.com.au/wp-content/uploads/2015/11/restaurant-2-1024x683.jpg"},
			{"fermentasian-gallery-wine-room.jpg", "https://fermentasian.com.au/wp-content/uploads/2015/11/wine-room-675x1024.jpg"},
			{"fermentasian-gallery-chef.jpg", "https://fermentasian.com.au/wp-content/uploads/2015/02/Tuoi-Do-lg.jpg"},
			{"fermentasian-gallery-garden.jpg", "https://fermentasian.com.au/wp-content/uploads/2016/01/garden-10.jpg"},
		},
		"Appellation Tasting Menu": {
			{"appellation-gallery-dish.jpg", "https://thelouise.com.au/wp-content/uploads/2025/08/The-cuisine-Left.jpg"},
			{"appellation-gallery-course.jpg", "https://thelouise.com.au/wp-content/uploads/2025/08/The-cuisine-Right.jpg"},
			{"appellation-gallery-dining-room.jpg", "https://thelouise.com.au/wp-content/uploads/2025/08/The-space-Left.jpg"},
			{"appellation-gallery-wine-cellar.jpg", "https://thelouise.com.au/wp-content/uploads/2025/08/The-winelist-Right.jpg"},
		},
		"Vintners Four Course Menu": {
			{"vintners-gallery-sunset.jpg", "https://static.wixstatic.com/media/851d2f_08155afa08e24316a2186cb288eccaba~mv2.jpg"},
			{"vintners-gallery-dish.jpg", "https://static.wixstatic.com/media/851d2f_b9496839b298409f874456ab0759fb71~mv2.jpg"},
			{"vintners-gallery-kitchen.png", "https://static.wixstatic.com/media/851d2f_e2b9f185dc414e29a19d13bd7875ebf6~mv2.png"},
			{"vintners-gallery-dessert.jpg", "https://static.wixstatic.com/media/851d2f_9a5a12352c7e46f98c047214a16ec71f~mv2.jpg"},
		},
	}[productName]
}

func seeds() []supplierSeed {
	return []supplierSeed{
		{Name: "Hentley Farm Restaurant", Email: "reservations@hentleyfarm.com.au", Phone: "+61 8 8562 8427", Website: "https://hentleyfarm.com.au/pages/restaurant", Address: "Corner Gerald Roberts Road and Jenke Road", City: "Seppeltsfield", PostalCode: "5355", Description: "Vineyard restaurant at Hentley Farm offering seasonal tasting menus shaped around refined technique and estate wines.", Product: productSeed{NameZh: "Hentley Farm Discovery 品鉴菜单", NameEn: "Hentley Farm Discovery Tasting Menu", Price: 270, SummaryZh: "在 Seppeltsfield 葡萄园中享用多道式季节品鉴菜单。", SummaryEn: "A multi-course seasonal tasting menu in Hentley Farm's Seppeltsfield vineyard.", DescriptionZh: "Discovery Tasting Menu 以经典烹饪技法呈现季节食材，通过层次丰富的多道菜品连接美食与 Hentley Farm 酒款。用餐约 3.5 小时，可另选 Luxury Wine Pairing。", DescriptionEn: "The Discovery Tasting Menu uses classical technique and seasonal ingredients across a layered multi-course experience designed to complement Hentley Farm wines. Allow approximately 3.5 hours, with an optional Luxury Wine Pairing.", Address: "Corner Gerald Roberts Road and Jenke Road, Seppeltsfield SA 5355", Duration: "3.5 hours", GroupSize: "1-6", ImageFile: "hentley-discovery.jpg", ImageSource: "https://hentleyfarm.com.au/cdn/shop/collections/HentleyFarm-JUL22-0186-web.jpg?v=1747034639&width=1480", BookingURL: "https://hentleyfarm.com.au/pages/restaurant", Tags: []string{"芭罗莎谷", "品鉴菜单", "葡萄园餐厅", "季节菜单"}, Packages: []packageSeed{{"Discovery 品鉴菜单（每位）", "Discovery Tasting Menu (per person)", "多道式季节品鉴菜单。", "Multi-course seasonal tasting menu.", 270}, {"Luxury 葡萄酒搭配（每位）", "Luxury Wine Pairing (per person)", "精选 Hentley Farm 葡萄酒搭配。", "Curated Hentley Farm wine pairing.", 155}}, Highlights: []highlightSeed{{"葡萄园景观", "Vineyard setting", "俯瞰 Greenock Creek 与 Beauty Shiraz 葡萄园。", "Views across Greenock Creek and the Beauty Shiraz vineyard."}, {"季节多道式菜单", "Seasonal multi-course menu", "以经典技法呈现平衡而富有层次的当季菜品。", "Seasonal dishes shaped by classical technique, balance and layered flavour."}}, FAQs: []faqSeed{{"需要预留多长时间？", "How long should guests allow?", "建议预留约 3.5 小时。", "Allow approximately 3.5 hours."}, {"可以照顾饮食限制吗？", "Can dietary restrictions be accommodated?", "请至少提前 14 天告知过敏情况；餐厅会尽力配合饮食需求。", "Advise allergies at least 14 days ahead; the restaurant will assist with dietary requirements where possible."}}}},
		{Name: "fermentAsian", Email: "bookings@fermentasian.com.au", Phone: "+61 8 8563 0765", Website: "https://fermentasian.com.au/", Address: "90 Murray Street", City: "Tanunda", PostalCode: "5352", Description: "Modern Southeast Asian restaurant in Tanunda, pairing Vietnamese-led flavours with Barossa produce and an extensive wine list.", Product: productSeed{NameZh: "fermentAsian 主厨品鉴菜单", NameEn: "fermentAsian Chef's Tasting Menu", Price: 92, SummaryZh: "融合越南与东南亚风味、芭罗莎本地食材的主厨品鉴菜单。", SummaryEn: "A chef's tasting menu combining Vietnamese and Southeast Asian flavours with Barossa produce.", DescriptionZh: "Chef's Tasting Menu 以多道菜呈现 fermentAsian 的现代东南亚烹饪，包括焦糖猪肉、南澳大虾、芭罗莎鸡肉和 Wagyu 牛颊等代表性风味。可咨询葡萄酒搭配，并可提前告知过敏或素食需求。", DescriptionEn: "The Chef's Tasting Menu presents fermentAsian's modern Southeast Asian cooking across multiple courses, with flavours such as caramelised pork, South Australian prawns, Barossa chicken and Wagyu beef cheek. Wine matching is available by enquiry, and allergy or vegetarian requirements should be advised.", Address: "90 Murray Street, Tanunda SA 5352", ImageFile: "fermentasian-chefs-tasting.jpg", ImageSource: "https://fermentasian.com.au/wp-content/uploads/2015/11/restaurant-home-2-1024x447.jpg", BookingURL: "https://fermentasian.com.au/contact-us/", Tags: []string{"芭罗莎谷", "越南菜", "东南亚风味", "品鉴菜单"}, Packages: []packageSeed{{"主厨品鉴菜单（每位）", "Chef's Tasting Menu (per person)", "多道式主厨品鉴菜单，价格含 GST。", "Multi-course chef's tasting menu; GST included.", 92}}, Highlights: []highlightSeed{{"现代东南亚风味", "Modern Southeast Asian flavours", "将越南风味与芭罗莎优质农产相结合。", "Vietnamese-led flavours meet premium Barossa produce."}, {"本地食材", "Regional ingredients", "菜单包含南澳大虾、芭罗莎鸡肉等当地食材。", "Features regional ingredients such as South Australian prawns and Barossa chicken."}}, FAQs: []faqSeed{{"可以安排素食或过敏需求吗？", "Can vegetarian or allergy requirements be accommodated?", "请在预订时告知过敏情况或咨询素食选项。", "Advise allergies when booking or ask about vegetarian options."}, {"可以自带葡萄酒吗？", "Is BYO wine available?", "可自带瓶装葡萄酒，每 750ml 收取 AUD 26；周五和周六晚不提供 BYO。", "Bottled wine BYO is AUD 26 per 750ml; BYO is unavailable on Friday and Saturday nights."}}}},
		{Name: "Appellation at The Louise", Email: "stay@thelouise.com.au", Phone: "+61 8 8562 2722", Website: "https://thelouise.com.au/dine/appellation/", Address: "375 Seppeltsfield Road", City: "Marananga", PostalCode: "5355", Description: "Fine dining restaurant at The Louise celebrating seasonal Barossa produce, kitchen-garden ingredients and regional wines.", Product: productSeed{NameZh: "Appellation 季节品鉴菜单", NameEn: "Appellation Tasting Menu", Price: 175, SummaryZh: "以芭罗莎当季农产和厨园食材为灵感的精致晚餐品鉴菜单。", SummaryEn: "A fine dining tasting menu inspired by seasonal Barossa produce and the kitchen garden.", DescriptionZh: "Appellation 的品鉴菜单以芭罗莎季节、土地与社区为灵感，选用厨园及当地农户的新鲜食材，在葡萄园与山丘景观中呈现当代澳大利亚精致餐饮。可另加配套葡萄酒。", DescriptionEn: "Appellation's tasting menu follows the Barossa seasons, landscape and community, using kitchen-garden produce and ingredients from local growers in a contemporary Australian fine dining experience overlooking vineyards and rolling hills. Matched wines are optional.", Address: "375 Seppeltsfield Road, Marananga SA 5355", ImageFile: "appellation-tasting.jpg", ImageSource: "https://thelouise.com.au/wp-content/uploads/2025/08/Banner-Appellation.jpg", BookingURL: "https://thelouise.com.au/dine/appellation/", Tags: []string{"芭罗莎谷", "精致餐饮", "品鉴菜单", "当季食材", "葡萄园景观"}, Packages: []packageSeed{{"Appellation 品鉴菜单（每位）", "Appellation Tasting Menu (per person)", "以当地当季食材呈现的晚餐品鉴菜单。", "Dinner tasting menu shaped by local seasonal produce.", 175}, {"配套葡萄酒（每位）", "Matched wines (per person)", "搭配芭罗莎及南澳精选葡萄酒。", "Matched wines from the Barossa and South Australia.", 85}}, Highlights: []highlightSeed{{"从厨园到餐桌", "Kitchen garden to table", "运用厨园和芭罗莎当地种植者的当季食材。", "Seasonal ingredients from the kitchen garden and Barossa growers."}, {"葡萄园景观", "Vineyard views", "明亮餐厅面向葡萄园与连绵山丘。", "A light-filled dining room overlooking vineyards and rolling hills."}}, FAQs: []faqSeed{{"非住客可以预订吗？", "Can non-resident guests book?", "可以，非住客需提前预订晚餐。", "Yes. Advance dinner reservations are essential for non-resident guests."}, {"儿童可以用餐吗？", "Are children welcome?", "餐厅欢迎 10 岁及以上儿童。", "Children aged 10 and over are welcome."}}}},
		{Name: "Vintners Bar & Grill", Email: "enquiries@vintners.com.au", Phone: "+61 8 8564 2488", Website: "https://www.vintners.com.au/", Address: "752 Stockwell Road", City: "Angaston", PostalCode: "5353", Description: "Long-running Barossa restaurant among the vineyards, serving contemporary Australian food with regional ingredients and an extensive wine list.", Product: productSeed{NameZh: "Vintners 四道式菜单", NameEn: "Vintners Four Course Menu", Price: 115, SummaryZh: "从当季菜单中选择四道菜的现代澳大利亚餐饮体验。", SummaryEn: "A four-course contemporary Australian dining experience selected from the seasonal menu.", DescriptionZh: "Vintners 四道式菜单让客人从当季小菜、主菜与甜点中组合完整用餐体验，菜品以芭罗莎及南澳食材为基础，并搭配丰富的本地与进口酒单。预订时请告知饮食限制。", DescriptionEn: "The Vintners Four Course Menu lets guests compose a complete meal from seasonal smaller plates, main courses and desserts, centred on Barossa and South Australian ingredients with an extensive local and imported wine list. Advise dietary restrictions when booking.", Address: "752 Stockwell Road, Angaston SA 5353", ImageFile: "vintners-four-course.jpg", ImageSource: "https://static.wixstatic.com/media/b3c01a_3d319ba575f64cdd977160ea7dc7ffca~mv2.jpg", BookingURL: "https://www.vintners.com.au/", Tags: []string{"芭罗莎谷", "现代澳大利亚菜", "四道式菜单", "葡萄园餐厅"}, Packages: []packageSeed{{"四道式菜单（每位）", "Four Course Menu (per person)", "从当季菜单中选择四道菜。", "Choose four courses from the seasonal menu.", 115}}, Highlights: []highlightSeed{{"当代澳大利亚菜", "Contemporary Australian dining", "以现代手法呈现芭罗莎传统与新食材。", "A modern approach to traditional and new Barossa ingredients."}, {"葡萄园餐厅", "Among the vineyards", "提供随季节变化的室内与户外用餐体验。", "Indoor and alfresco dining options change with the seasons."}}, FAQs: []faqSeed{{"什么时候供应？", "When is the menu available?", "午餐每天 12:00–14:30；晚餐周一至周六 18:00–21:00。", "Lunch is served daily 12:00–14:30; dinner is Monday to Saturday 18:00–21:00."}, {"可以自带葡萄酒吗？", "Is BYO wine available?", "可以，自带葡萄酒每 750ml 收取 AUD 30。", "Yes. Wine BYO is AUD 30 per 750ml."}}}},
	}
}
