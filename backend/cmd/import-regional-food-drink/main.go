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
	assetDir := flag.String("asset-dir", "assets/regional-food-drink", "image directory")
	dryRun := flag.Bool("dry-run", false, "print data only")
	flag.Parse()
	if *dryRun {
		json.NewEncoder(os.Stdout).Encode(seeds())
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
	target := filepath.Join(uploadDir, "regional-food-drink")
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
	err := tx.Where("slug = ?", "food-wine").First(&x).Error
	if err == nil {
		return &x, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	x = productmodel.Category{Slug: "food-wine", NameZh: "美食美酒", NameEn: "Food & Wine", Icon: "wine", SortOrder: 2}
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
	err := tx.Where("email = ? OR lower(name) = lower(?)", s.Email, s.Name).First(&x).Error
	now := time.Now()
	fields := map[string]interface{}{"name": s.Name, "type": "restaurant", "status": "approved", "description": s.Description, "email": s.Email, "phone": s.Phone, "website": s.Website, "address": s.Address, "city": s.City, "state": "SA", "postal_code": s.PostalCode, "country": "Australia", "approved_at": now}
	if err == nil {
		return &x, tx.Model(&x).Updates(fields).Error
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	x = models.Supplier{Name: s.Name, Type: "restaurant", Status: "approved", Description: s.Description, Email: s.Email, Phone: s.Phone, Website: s.Website, Address: s.Address, City: s.City, State: "SA", PostalCode: s.PostalCode, Country: "Australia", ApprovedAt: &now}
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
	metadata, _ := json.Marshal(map[string]interface{}{"source_page": "https://southaustralia.com/destinations/" + sourceSlug + "/food-and-drink", "official_product_url": p.BookingURL, "image_sources": p.Images, "collected_at": time.Now().UTC().Format(time.RFC3339)})
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
		if err := tx.Create(&productmodel.ProductImage{ProductID: x.ID, URL: "/uploads/regional-food-drink/" + v.File, IsCover: i == 0, SortOrder: i}).Error; err != nil {
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
	duration, group, summaryZh, summaryEn, descZh, descEn, booking                       string
}

func makeSeed(r rawSeed, index int) supplierSeed {
	prefix := fmt.Sprintf("regional-%02d", index+1)
	images := make([]imageSeed, 5)
	for i := range images {
		images[i] = imageSeed{fmt.Sprintf("%s-%d.jpg", prefix, i+1), imageSources[index][i]}
	}
	return supplierSeed{RegionSlug: r.region, RegionZh: r.rzh, RegionEn: r.ren, Name: r.name, Email: r.email, Phone: r.phone, Website: r.site, Address: r.street, City: r.city, PostalCode: r.post, Description: r.summaryEn, Product: productSeed{NameZh: r.productZh, NameEn: r.productEn, Price: r.price, SummaryZh: r.summaryZh, SummaryEn: r.summaryEn, DescriptionZh: r.descZh, DescriptionEn: r.descEn, Address: r.street + ", " + r.city + " SA " + r.post, Duration: r.duration, GroupSize: r.group, BookingURL: r.booking, Tags: []string{r.rzh, "美食美酒", r.productZh}, Images: images, Packages: []packageSeed{{r.productZh + "（每位）", r.productEn + " (per person)", r.summaryZh, r.summaryEn, r.price}}, Highlights: []highlightSeed{{"地区风味", "Regional character", "体验当地食材、风土与待客之道。", "Discover local produce, place and hospitality."}, {"精选体验", "Curated experience", r.summaryZh, r.summaryEn}}, FAQs: []faqSeed{{"需要提前预订吗？", "Is advance booking required?", "建议提前预订，尤其是周末及节假日。", "Advance booking is recommended, especially on weekends and public holidays."}, {"可以照顾饮食需求吗？", "Can dietary requirements be accommodated?", "请在预订时告知过敏及饮食需求，场地方会确认可提供的安排。", "Advise allergies and dietary requirements when booking so the venue can confirm available options."}}}}
}

func seeds() []supplierSeed {
	raws := []rawSeed{
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "Hardy's Verandah Restaurant", "dine@hardysverandah.com.au", "+61 8 8130 9292", "https://www.hardysverandah.com.au", "1 Mawson Drive", "Crafers", "5152", "Hardy's Verandah 季节品鉴菜单", "Hardy's Verandah Seasonal Tasting Menu", 249, "3 hours", "1-8", "在 Mount Lofty Estate 享用以南澳当季食材为核心的精致品鉴菜单。", "A refined tasting menu centred on seasonal South Australian produce at Mount Lofty Estate.", "多道式菜单将阿德莱德山景观、当季农产与现代澳大利亚烹饪结合，并可搭配精选葡萄酒。", "A multi-course menu brings together Adelaide Hills views, seasonal produce and modern Australian cooking, with optional matched wines.", "https://www.hardysverandah.com.au"},
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "The Stirling Hotel", "admin@stirlinghotel.com.au", "+61 8 8339 2345", "https://www.stirlinghotel.com.au", "52 Mount Barker Road", "Stirling", "5152", "Stirling Hotel 餐厅双道式套餐", "Stirling Hotel Dining Room Two Course Menu", 75, "2 hours", "1-10", "在 Stirling 花园村中心享用季节性双道式餐饮。", "Seasonal two-course dining in the heart of Stirling's garden village.", "从餐厅当季菜单选择前菜与主菜或主菜与甜点，搭配本地酒单与温暖山地氛围。", "Choose entrée and main or main and dessert from the seasonal dining-room menu, complemented by local wines and a welcoming Hills setting.", "https://www.stirlinghotel.com.au"},
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "Red Cacao", "info@redcacao.com.au", "+61 8 8339 3128", "https://redcacao.com.au", "Shop 3, 41 Mount Barker Road", "Stirling", "5152", "Red Cacao 巧克力与咖啡体验", "Red Cacao Chocolate and Coffee Experience", 32, "1 hour", "1-6", "品尝手工巧克力与精选咖啡的特色搭配。", "Taste artisan chocolates paired with a coffee selection.", "由阿德莱德山巧克力师制作的精品巧克力，搭配所选咖啡豆，呈现可可与烘焙风味的层次。", "Premium chocolates made by Adelaide Hills chocolatiers are paired with selected coffee to explore layers of cacao and roast character.", "https://redcacao.com.au"},
		{"adelaide-hills", "阿德莱德山", "Adelaide Hills", "Haus Restaurant", "functions@thehausgroup.com.au", "+61 8 8388 7555", "https://haushahndorf.com.au", "38A Main Street", "Hahndorf", "5245", "Haus 德式分享盛宴", "Haus German Feast", 145.9, "2 hours", "4 people", "四人共享猪肘、炸肉排、德式香肠与经典配菜。", "A four-person feast of pork knuckle, schnitzel, German sausages and classic sides.", "丰盛拼盘包含脆皮猪肘、鸡肉炸排、多款德式香肠、烟熏猪排、酸菜、红甘蓝、土豆泥和椒盐卷饼。", "The generous platter includes crispy pork knuckle, chicken schnitzel, German sausages, smoked pork, sauerkraut, red cabbage, mash and pretzels.", "https://haushahndorf.com.au"},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "The Islander Estate Vineyards", "cellardoor@iev.com.au", "+61 8 8553 9008", "https://iev.com.au", "78 Gum Creek Road", "Cygnet River", "5223", "Islander Estate 甲板美食体验", "Islander Estate Gourmet on the Deck", 55, "1.5 hours", "2 people", "旗舰葡萄酒品鉴搭配南澳奶酪、熟食与袋鼠岛美食拼盘。", "A flagship wine tasting with South Australian cheese, charcuterie and Kangaroo Island produce.", "在 Cygnet River 私密品酒室参加专业带领的旗舰酒款品鉴，并在甲板享用本地美食拼盘。", "Enjoy a hosted flagship tasting at the intimate Cygnet River tasting room followed by a regional gourmet platter on the deck.", "https://iev.com.au/food-and-wine-experiences/"},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Bay of Shoals Estate", "manager@bayofshoalswines.com.au", "+61 447 118 162", "https://www.bayofshoalswines.com.au", "49 Cordes Road", "Kingscote", "5223", "Bay of Shoals 海鲜拼盘与品酒", "Bay of Shoals Seafood Platter and Wine Tasting", 87.5, "2 hours", "2 people", "海鲜拼盘搭配六款庄园葡萄酒的引导式品鉴。", "A seafood platter paired with a guided tasting of six estate wines.", "享用大虾、生蚝、烟熏鱼类及配菜，并品鉴六款与海鲜相配的 Bay of Shoals 葡萄酒及一杯所选酒款。", "Enjoy prawns, oysters, smoked seafood and accompaniments with six Bay of Shoals wines selected for seafood and a glass of your preferred wine.", "https://www.bayofshoalswines.com.au/product/shoals-platter-for-2/"},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Dudley Wines", "info@dudleywines.com", "+61 8 8553 1333", "https://www.dudleywines.com.au", "1153 Cape Willoughby Road", "Cuttlefish Bay", "5222", "Dudley Wines 悬崖品酒套餐", "Dudley Wines Clifftop Wine Flight", 16, "1 hour", "1-8", "在悬崖酒窖品尝五款袋鼠岛葡萄酒。", "Taste five Kangaroo Island wines at the clifftop cellar door.", "自助品酒板包含五款葡萄酒，可一边按自己的节奏品鉴，一边欣赏 Backstairs Passage 的海岸景色。", "The self-guided flight includes five wines to enjoy at your own pace with coastal views across Backstairs Passage.", "https://www.dudleywines.com.au/cellar-door"},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Springs Road Kangaroo Island", "cellardoor@springsroad.com.au", "+61 499 918 448", "https://bosworthwines.com.au/springs-road-wines/", "183 Springs Road", "Cygnet River", "5223", "Springs Road 精品葡萄酒与奶酪品鉴", "Springs Road Premium Wine and Cheese Tasting", 30, "1 hour", "2 people", "庄园酒款引导品鉴搭配奶酪和饼干。", "A guided estate wine tasting complemented by cheese and crackers.", "品尝 Springs Road 与 Little Island 系列，包括限量 Terre Napoleon Shiraz，并带走两只品牌品酒杯。", "Taste Springs Road and Little Island wines including the limited Terre Napoleon Shiraz, with two branded tasting glasses to take home.", "https://bosworthwines.com.au/springs-road-wines/"},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "The d'Arenberg Cube", "wine@darenberg.com.au", "+61 8 8329 4888", "https://www.darenberg.com.au/the-experience/", "58 Osborn Road", "McLaren Vale", "5171", "d'Arenberg Cube 调配实验室", "d'Arenberg Cube Blending Bench", 120, "75 minutes", "1-10", "亲手调配并装瓶一瓶属于自己的葡萄酒。", "Blend and bottle a wine of your own at the d'Arenberg Cube.", "在互动式调配台扮演酿酒师，尝试不同比例的酒液，完成命名与标签，并带走一瓶 750ml 自创调配酒。", "Play winemaker at an interactive bench, experiment with blending proportions, name and label the result, and take home a 750ml bottle.", "https://www.darenberg.com.au/tasting-room/"},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "Down The Rabbit Hole Cellar Door and Restaurant", "goodtimes@downtherabbitholewines.com.au", "+61 448 764 956", "https://downtherabbitholewines.com.au", "233 Binney Road", "McLaren Vale", "5171", "Fiore 意式分享午餐", "Fiore Italian Shared Lunch", 95, "2 hours", "1-14", "以有机、当季与本地食材呈现的丰盛意式分享午餐。", "A generous Italian shared lunch focused on organic, seasonal and local produce.", "厨师以意大利各地传统为灵感，将餐厅花园与本地优质食材组成多道共享菜肴，适合悠闲享用。", "Inspired by Italy's diverse regions, the chef presents multiple sharing courses using garden and premium local produce for a leisurely lunch.", "https://downtherabbitholewines.com.au/pages/fiore-restaurant"},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "Anvers Wines - Cellar Door", "bookings@anvers.com.au", "+61 8 7085 0615", "https://www.anvers.com.au/pages/cellar-door", "633 Razorback Road", "Kangarilla", "5157", "Discover Anvers 品酒体验", "Discover Anvers Wine Tasting", 15, "45 minutes", "1-8", "在改建自老乳品厂的酒窖品尝 Anvers 精选酒款。", "Taste a selection of Anvers wines in a cellar door converted from an old dairy.", "由酒窖团队介绍 Razorback Road 与精品系列的风格、葡萄园与酿造方法，感受南阿德莱德山的凉爽气候。", "The cellar-door team introduces the style, vineyards and winemaking behind Razorback Road and limited-release wines from the cool southern Adelaide Hills.", "https://www.anvers.com.au/pages/cellar-door"},
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "Coriole Vineyards Cellar Door and Restaurant", "contact@coriole.com", "+61 8 8323 8305", "https://www.coriole.com", "79 Chaffeys Road", "McLaren Vale", "5171", "Coriole 季节共享菜单", "Coriole Seasonal Sharing Menu", 85, "2.5 hours", "2-12", "以庄园菜园和南澳农产为灵感的季节共享菜单。", "A seasonal sharing menu inspired by the estate garden and South Australian produce.", "从自制面包与 Coriole 橄榄开始，搭配熟食、当季前菜、主菜、配菜与厨师甜点，菜式随供应季节调整。", "Begin with house-made bread and Coriole olives, followed by charcuterie, seasonal starters, a main, sides and chef's dessert, changing with availability.", "https://www.coriole.com"},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Cafe Mannum", "reception@mannummotel.com.au", "+61 8 8569 1808", "https://www.mannummotel.com.au/dining-breakfast-coffee/", "76 Cliff Street", "Mannum", "5238", "Cafe Mannum 河景早餐", "Cafe Mannum Riverside Breakfast", 28, "1.5 hours", "1-10", "在大片河景窗前享用以新鲜食材制作的早餐。", "Breakfast made with fresh ingredients beside broad Murray River views.", "在 Mannum Motel 的河景咖啡馆享用早餐、咖啡与饮品，可选择室内大窗景观或户外座位感受河畔生活。", "Enjoy breakfast, coffee and drinks at Mannum Motel's riverside café, choosing broad indoor views or outdoor seating by the river.", "https://www.mannummotel.com.au/dining-breakfast-coffee/"},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Mannum Hotel", "hotel.mannum@bigpond.com", "+61 8 8569 1008", "https://mannumhotel.com.au", "15 Randell Street", "Mannum", "5238", "Mannum Hotel 经典炸肉排套餐", "Mannum Hotel Classic Schnitzel Meal", 26, "1.5 hours", "1-12", "河镇酒店的手工裹粉鸡肉或牛肉炸排配薯条与沙拉。", "A hand-crumbed chicken or beef schnitzel with chips and salad at a riverside town hotel.", "选择全份手工裹粉鸡肉或牛肉炸排，搭配薯条、沙拉及所选酱汁，体验轻松的 Mannum 酒店用餐。", "Choose a full hand-crumbed chicken or beef schnitzel with chips, salad and a selected sauce for relaxed Mannum hotel dining.", "https://mannumhotel.com.au"},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Steam Dock Eatery", "orders@steamdockeateryonline.com.au", "+61 8 7512 3648", "https://steamdockeateryonline.com.au", "67 Adelaide Road, Shop 1", "Mannum", "5238", "Steam Dock 手工汉堡套餐", "Steam Dock Homemade Burger Meal", 18, "1 hour", "1-8", "家庭经营餐厅的手工汉堡、薯条与饮品组合。", "A homemade burger, chips and drink from a family-run Mannum eatery.", "选择现做牛肉或鸡肉汉堡，搭配酥脆薯条与饮品，适合在探索 Mannum 途中轻松享用。", "Choose a freshly prepared beef or chicken burger with crisp chips and a drink for an easy meal while exploring Mannum.", "https://steamdockeateryonline.com.au"},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Pretoria Hotel", "info@pretoriahotel.com.au", "+61 8 8569 1109", "https://www.pretoriahotel.com.au", "50 Randell Street", "Mannum", "5238", "Pretoria Hotel 河景小酒馆主餐", "Pretoria Hotel Riverview Bistro Main", 32, "1.5 hours", "1-12", "俯瞰墨累河、选用当季食材的乡村小酒馆主餐。", "A seasonal country-bistro main overlooking the Murray River.", "在 Riverview Bar & Bistro 从酒馆经典和当季主菜中选择一款，搭配河景、乡村待客氛围与精选南澳饮品。", "Choose a pub classic or seasonal main at the Riverview Bar & Bistro, with river views, country hospitality and a South Australian drinks selection.", "https://www.pretoriahotel.com.au/eat-and-drink/"},
	}
	out := make([]supplierSeed, len(raws))
	for i, r := range raws {
		out[i] = makeSeed(r, i)
	}
	return out
}

var imageSources = [16][5]string{
	{"https://www.mtloftyhouse.com.au/wp-content/uploads/2022/07/Mount-Lofty-House-Hardys-Verandah-Restaurant-3.jpg", "https://assets.atdw-online.com.au/images/06fa82f025afe0dcf568cbcbd44f482a.jpeg", "https://assets.atdw-online.com.au/images/1d7444f1ed34a734ef6fe0e0141e970c.jpeg", "https://assets.atdw-online.com.au/images/41674b8ae4fb73874960f98c703a61d0.jpeg", "https://assets.atdw-online.com.au/images/f646b8227b7e410cec69d5dd2ac5452a.jpeg"},
	{"https://assets.atdw-online.com.au/images/6126d47bdc1ece0a51def834d4ee204d.jpeg", "https://assets.atdw-online.com.au/images/6ac6a02a22a7b1b7fe6018af0d6a2542.jpeg", "https://assets.atdw-online.com.au/images/89e85d212f2ecddc4bc274a3affc3aa9.jpeg", "https://assets.atdw-online.com.au/images/cfa7d64252131a322780627517404d56.jpeg", "https://assets.atdw-online.com.au/images/6126d47bdc1ece0a51def834d4ee204d.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/0aa0ec471e523e46146e829496845240.jpeg", "https://assets.atdw-online.com.au/images/12d2857ae84719ab995687f83fe56908.jpeg", "https://assets.atdw-online.com.au/images/605efcfb3c6e2d44f566d36714cda1a4.jpeg", "https://assets.atdw-online.com.au/images/aea409a953a528a7f3713f376ccce7ea.jpeg", "https://assets.atdw-online.com.au/images/0aa0ec471e523e46146e829496845240.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/a172483f7acab55c50edb49e0c729acd.jpeg", "https://assets.atdw-online.com.au/images/e4550f0796d1df6bdba47cd8d4ff47a0.jpeg", "https://assets.atdw-online.com.au/images/e9b44b600d3112610f3d6d9a15077b9e.jpeg", "https://assets.atdw-online.com.au/images/ef73c79dc857adf97e921767383b103c.jpeg", "https://assets.atdw-online.com.au/images/a172483f7acab55c50edb49e0c729acd.jpeg?w=1600"},
	{"https://iev.com.au/wp-content/uploads/2025/07/MG_7524.webp", "https://iev.com.au/wp-content/uploads/2025/07/Visit.webp", "https://iev.com.au/wp-content/uploads/2025/07/Story.jpg", "https://iev.com.au/wp-content/uploads/2025/07/Book-Experiences.webp", "https://iev.com.au/wp-content/uploads/2025/07/News-Guides-to-KI.webp"},
	{"https://www.bayofshoalswines.com.au/wp-content/uploads/2020/05/Website2-1200x801.jpg", "https://assets.atdw-online.com.au/images/16fa3f67e6353dbbfdadb5a35f0be6ac.jpeg", "https://assets.atdw-online.com.au/images/36658e3278aeb41ade30b532258834dd.jpeg", "https://assets.atdw-online.com.au/images/aebc840597ebf5caf07fd9c5c7f59795.jpeg", "https://assets.atdw-online.com.au/images/d65cb2520871ff603ae6bd5fed1f5bc5.jpeg"},
	{"https://assets.atdw-online.com.au/images/36c00f45be2078a21c30cac0c44f55ee.jpeg", "https://assets.atdw-online.com.au/images/599cbd27b577f1419fb1c4ea14c8c2fd.jpeg", "https://assets.atdw-online.com.au/images/5db5e76dfe21d8791434cf6727cf6af4.jpeg", "https://assets.atdw-online.com.au/images/c1f3b742c834b9df9810f44f92a3363e.jpeg", "https://fusws.api.aspedia.io/dudley-website/Cellar%20Door/girls%20on%20deck%20edited.jpg"},
	{"https://assets.atdw-online.com.au/images/81d0913bf4705bc88df368db37c4e46f.jpeg", "https://assets.atdw-online.com.au/images/86603d569beadffac24571b6cb08dfdc.jpeg", "https://assets.atdw-online.com.au/images/bbfd11959f19a4ff2f8ada6340213cf9.jpeg", "https://assets.atdw-online.com.au/images/ec996f5c90484fa3cdf303c9d09dcc01.jpeg", "https://bosworthwines.com.au/wp-content/uploads/2025/01/Little-Island-Wine-club_web-1199x800.jpg"},
	{"https://assets.atdw-online.com.au/images/4ff363a1d668e3331fd35f5a3396fe64.jpeg", "https://assets.atdw-online.com.au/images/89168b542acc4d9182a845a813baea7b.jpeg", "https://assets.atdw-online.com.au/images/ad5498e704591af223b1f1d4c78202ef.jpeg", "https://assets.atdw-online.com.au/images/b6aec546ec13888ef4d322c2f579e495.jpeg", "https://assets.atdw-online.com.au/images/4ff363a1d668e3331fd35f5a3396fe64.jpeg?w=1600"},
	{"https://assets.atdw-online.com.au/images/1b2a7b02b8739b27306958273dec4f01.jpeg", "https://assets.atdw-online.com.au/images/67a8f5cdec2b8dfde7692ca46b70d9d8.jpeg", "https://assets.atdw-online.com.au/images/e7e7c4b52a7a668c6c6bf34382c9b618.jpeg", "https://assets.atdw-online.com.au/images/edde4bd22d80aa93e5da0f7c83dae2f1.jpeg", "https://downtherabbitholewines.com.au/cdn/shop/files/Website-Social-Sharing-001.jpg?v=1718605064"},
	{"https://assets.atdw-online.com.au/images/45d3e30d2c675da00a2b7254b0ad3c37.jpeg", "https://assets.atdw-online.com.au/images/50835b615def2a4aaa5041f88e73597e.jpeg", "https://assets.atdw-online.com.au/images/d9b2782da14c98d9d8c04be2a94b6b4f.jpeg", "https://assets.atdw-online.com.au/images/efe4afb10afeac9a1b8214a6ac12db0c.jpeg", "https://www.anvers.com.au/cdn/shop/files/Anvers_Wines_Restaurant_Outside_1200x.webp?v=1652419200"},
	{"https://assets.atdw-online.com.au/images/4f9e32795acbd45c7ab760615e0b4f57.jpeg", "https://assets.atdw-online.com.au/images/5179062c152d6f02ec7c1310bb5890b1.jpeg", "https://assets.atdw-online.com.au/images/a9b3ad7e00d30ab6ef9480dbde016548.jpeg", "https://assets.atdw-online.com.au/images/c902c00fa87cd40c83213e3ca45e7ed7.jpeg", "https://www.coriole.com/cdn/shop/files/Coriole_courtyard_restaurant_1a.jpg?v=1781141181&width=1600"},
	{"https://mannum.mymedia.delivery/400x266/p/o/wp-content/uploads/2021/11/IMG_3375.jpeg", "https://mannum.mymedia.delivery/400x266/p/o/wp-content/uploads/2021/11/MG_7142.jpg", "https://mannum.mymedia.delivery/400x266/p/o/wp-content/uploads/2023/03/Girl-with-Milkshake.jpg", "https://mannum.mymedia.delivery/400x266/p/o/wp-content/uploads/2023/03/IMG_1276.jpeg", "https://mannum.mymedia.delivery/400x266/p/o/wp-content/uploads/2023/03/Outdoor.jpg"},
	{"https://mannumhotel.com.au/webimages/dining.webp", "https://mannumhotel.com.au/webimages/header1.webp", "https://mannumhotel.com.au/webimages/bar.webp", "https://mannumhotel.com.au/webimages/header2.webp", "https://mannumhotel.com.au/webimages/welcome.webp"},
	{"https://assets.foodhub.com/images/thumbnails/coffee_grill_seafood_001_1280.jpg", "https://assets.foodhub.com/images/thumbnails/coffee_grill_seafood_001_692x306.jpg", "https://assets.foodhub.com/static/9f863fbf1193b691492db56406edb8ca/img/1652074940phpFQFmoZ.jpg", "https://assets.foodhub.com/static/9f863fbf1193b691492db56406edb8ca/img/1652074940phpTr4XWj.jpg", "https://assets.atdw-online.com.au/images/e89e900e2498a6db68d803385a9ecdee.jpeg"},
	{"https://assets.atdw-online.com.au/images/aaaf5ea689e8d84b5f351af010ada412.jpeg", "https://assets.atdw-online.com.au/images/e5a292ddb748e6bf22b3d89679549e50.jpeg", "https://assets.atdw-online.com.au/images/f5a43f2ac9e5bec28996b883b598b026.jpeg", "https://assets.atdw-online.com.au/images/fbaf762b8d27c20e382aeb5a97ed1a66.jpeg", "https://assets.atdw-online.com.au/images/aaaf5ea689e8d84b5f351af010ada412.jpeg?w=1600"},
}
