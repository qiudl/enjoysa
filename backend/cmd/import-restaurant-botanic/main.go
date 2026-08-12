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
	"gorm.io/gorm/logger"
)

const requirementID = "REQ-20260811-0049"

type importResult struct {
	CategoryID uint             `json:"category_id"`
	RegionID   uint             `json:"region_id"`
	Suppliers  []supplierResult `json:"suppliers"`
}

type supplierResult struct {
	Name       string          `json:"name"`
	SupplierID uint            `json:"supplier_id"`
	Products   []productResult `json:"products"`
}

type productResult struct {
	Name      string `json:"name"`
	ProductID uint   `json:"product_id"`
}

type diningImport struct {
	Supplier supplierSeed
	Products []productSeed
}

type supplierSeed struct {
	Name        string
	Email       string
	Phone       string
	Website     string
	Address     string
	City        string
	State       string
	PostalCode  string
	Description string
}

type productSeed struct {
	ProductID      uint
	NameZh         string
	NameEn         string
	PriceFrom      float64
	SummaryZh      string
	SummaryEn      string
	DescriptionZh  string
	DescriptionEn  string
	Address        string
	Duration       string
	GroupSize      string
	Tags           []string
	Packages       []packageSeed
	Highlights     []highlightSeed
	FAQs           []faqSeed
	Metadata       map[string]interface{}
	ImageFile      string
	OfficialImages []officialImageSeed
}

type officialImageSeed struct {
	File      string
	SourceURL string
}

type packageSeed struct {
	NameZh string
	NameEn string
	DescZh string
	DescEn string
	Price  float64
}

type highlightSeed struct {
	TitleZh string
	TitleEn string
	DescZh  string
	DescEn  string
}

type faqSeed struct {
	QuestionZh string
	QuestionEn string
	AnswerZh   string
	AnswerEn   string
}

func main() {
	configPath := flag.String("config", "configs/config.yaml", "path to config file")
	assetDir := flag.String("asset-dir", "assets/fine-dining", "directory containing bundled product cover images")
	dryRun := flag.Bool("dry-run", false, "print the records that would be imported without writing to DB")
	verbose := flag.Bool("verbose", false, "print SQL logs")
	flag.Parse()

	if *dryRun {
		if err := printDryRun(); err != nil {
			log.Fatal(err)
		}
		return
	}

	result, err := run(*configPath, *assetDir, *verbose)
	if err != nil {
		log.Fatal(err)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(result); err != nil {
		log.Fatal(err)
	}
}

func run(configPath string, assetDir string, verbose bool) (*importResult, error) {
	cfg, err := config.Load(configPath)
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	logLevel := logger.Silent
	if verbose {
		logLevel = logger.Info
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	if err := prepareCoverImages(assetDir, cfg.Upload.Dir); err != nil {
		return nil, err
	}

	var result importResult
	err = db.Transaction(func(tx *gorm.DB) error {
		category, err := upsertDiningCategory(tx)
		if err != nil {
			return err
		}
		region, err := upsertAdelaideRegion(tx)
		if err != nil {
			return err
		}
		result.CategoryID = category.ID
		result.RegionID = region.ID

		for _, record := range fineDiningImports() {
			supplier, err := upsertSupplier(tx, record.Supplier)
			if err != nil {
				return err
			}
			supplierResult := supplierResult{
				Name:       supplier.Name,
				SupplierID: supplier.ID,
			}
			for _, seed := range record.Products {
				product, err := upsertProduct(tx, seed, supplier.ID, region.ID, category.ID)
				if err != nil {
					return err
				}
				supplierResult.Products = append(supplierResult.Products, productResult{
					Name:      product.NameEn,
					ProductID: product.ID,
				})
			}
			result.Suppliers = append(result.Suppliers, supplierResult)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func prepareCoverImages(assetDir string, uploadDir string) error {
	targetDir := filepath.Join(uploadDir, "fine-dining")
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return fmt.Errorf("create fine-dining upload directory: %w", err)
	}
	for _, record := range fineDiningImports() {
		for _, product := range record.Products {
			files := []string{product.ImageFile}
			for _, image := range product.OfficialImages {
				files = append(files, image.File)
			}
			for _, file := range files {
				if file == "" || filepath.Base(file) != file {
					return fmt.Errorf("invalid image filename for %s", product.NameEn)
				}
				contents, err := os.ReadFile(filepath.Join(assetDir, file))
				if err != nil {
					return fmt.Errorf("read image for %s: %w", product.NameEn, err)
				}
				if err := os.WriteFile(filepath.Join(targetDir, file), contents, 0o644); err != nil {
					return fmt.Errorf("write image for %s: %w", product.NameEn, err)
				}
			}
		}
	}
	return nil
}

func upsertDiningCategory(tx *gorm.DB) (*productmodel.Category, error) {
	category := productmodel.Category{
		Slug:      "dining",
		NameZh:    "餐饮美食",
		NameEn:    "Dining",
		Icon:      "utensils",
		SortOrder: 8,
	}
	var existing productmodel.Category
	err := tx.Where("slug = ?", category.Slug).First(&existing).Error
	if err == nil {
		if err := tx.Model(&existing).Updates(map[string]interface{}{
			"name_zh":    category.NameZh,
			"name_en":    category.NameEn,
			"icon":       category.Icon,
			"sort_order": category.SortOrder,
		}).Error; err != nil {
			return nil, fmt.Errorf("update dining category: %w", err)
		}
		return &existing, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("query dining category: %w", err)
	}
	if err := tx.Create(&category).Error; err != nil {
		return nil, fmt.Errorf("create dining category: %w", err)
	}
	return &category, nil
}

func upsertAdelaideRegion(tx *gorm.DB) (*productmodel.Region, error) {
	region := productmodel.Region{
		Slug:      "adelaide",
		NameZh:    "阿德莱德",
		NameEn:    "Adelaide",
		SortOrder: 1,
	}
	var existing productmodel.Region
	err := tx.Where("slug = ?", region.Slug).First(&existing).Error
	if err == nil {
		return &existing, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("query adelaide region: %w", err)
	}
	if err := tx.Create(&region).Error; err != nil {
		return nil, fmt.Errorf("create adelaide region: %w", err)
	}
	return &region, nil
}

func upsertSupplier(tx *gorm.DB, seed supplierSeed) (*models.Supplier, error) {
	now := time.Now()
	supplier := models.Supplier{
		Name:        seed.Name,
		Type:        "restaurant",
		Status:      "approved",
		Description: seed.Description,
		Email:       seed.Email,
		Phone:       seed.Phone,
		Website:     seed.Website,
		Address:     seed.Address,
		City:        seed.City,
		State:       seed.State,
		PostalCode:  seed.PostalCode,
		Country:     "Australia",
		ApprovedAt:  &now,
	}
	var existing models.Supplier
	err := tx.Where("email = ?", supplier.Email).First(&existing).Error
	if err == nil {
		if err := tx.Model(&existing).Updates(map[string]interface{}{
			"name":        supplier.Name,
			"type":        supplier.Type,
			"status":      supplier.Status,
			"description": supplier.Description,
			"phone":       supplier.Phone,
			"website":     supplier.Website,
			"address":     supplier.Address,
			"city":        supplier.City,
			"state":       supplier.State,
			"postal_code": supplier.PostalCode,
			"country":     supplier.Country,
			"approved_at": supplier.ApprovedAt,
		}).Error; err != nil {
			return nil, fmt.Errorf("update supplier %s: %w", supplier.Name, err)
		}
		return &existing, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("query supplier %s: %w", supplier.Name, err)
	}
	if err := tx.Create(&supplier).Error; err != nil {
		return nil, fmt.Errorf("create supplier %s: %w", supplier.Name, err)
	}
	return &supplier, nil
}

func upsertProduct(tx *gorm.DB, seed productSeed, supplierID uint, regionID uint, categoryID uint) (*productmodel.Product, error) {
	updates, err := productUpdates(seed, supplierID, regionID, categoryID)
	if err != nil {
		return nil, err
	}

	product := productmodel.Product{
		NameZh:        seed.NameZh,
		NameEn:        seed.NameEn,
		SupplierID:    supplierID,
		RegionID:      regionID,
		CategoryID:    categoryID,
		Status:        productmodel.ProductStatusDraft,
		PriceFrom:     seed.PriceFrom,
		Currency:      "AUD",
		SummaryZh:     seed.SummaryZh,
		SummaryEn:     seed.SummaryEn,
		DescriptionZh: seed.DescriptionZh,
		DescriptionEn: seed.DescriptionEn,
		AddressZh:     seed.Address,
		AddressEn:     seed.Address,
		Duration:      seed.Duration,
		GroupSize:     seed.GroupSize,
		Tags:          updates["tags"].(string),
		Metadata:      updates["metadata"].([]byte),
		CreatedVia:    "admin_proxy",
	}
	product.Images = []productmodel.ProductImage{{
		URL:       "/uploads/fine-dining/" + seed.ImageFile,
		SortOrder: 0,
		IsCover:   true,
	}}
	for idx, image := range seed.OfficialImages {
		product.Images = append(product.Images, productmodel.ProductImage{
			URL:       "/uploads/fine-dining/" + image.File,
			SortOrder: idx + 1,
			IsCover:   false,
		})
	}
	for idx, pkg := range seed.Packages {
		product.Packages = append(product.Packages, productmodel.ProductPackage{
			NameZh:     pkg.NameZh,
			NameEn:     pkg.NameEn,
			DescZh:     pkg.DescZh,
			DescEn:     pkg.DescEn,
			Price:      pkg.Price,
			SortOrder:  idx + 1,
			StockTotal: -1,
		})
	}
	for idx, h := range seed.Highlights {
		product.Highlights = append(product.Highlights, productmodel.ProductHighlight{
			TitleZh:   h.TitleZh,
			TitleEn:   h.TitleEn,
			DescZh:    h.DescZh,
			DescEn:    h.DescEn,
			SortOrder: idx + 1,
		})
	}
	for idx, f := range seed.FAQs {
		product.FAQs = append(product.FAQs, productmodel.ProductFAQ{
			QuestionZh: f.QuestionZh,
			QuestionEn: f.QuestionEn,
			AnswerZh:   f.AnswerZh,
			AnswerEn:   f.AnswerEn,
			SortOrder:  idx + 1,
		})
	}

	var existing productmodel.Product
	err = tx.First(&existing, seed.ProductID).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("target product %d (%s) does not exist", seed.ProductID, seed.NameEn)
	}
	if err != nil {
		return nil, fmt.Errorf("query target product %d: %w", seed.ProductID, err)
	}
	if existing.SupplierID != supplierID || existing.NameEn != seed.NameEn {
		return nil, fmt.Errorf("target product %d identity mismatch: supplier=%d name=%q", seed.ProductID, existing.SupplierID, existing.NameEn)
	}
	if err := replaceProductAssociations(tx, existing.ID); err != nil {
		return nil, err
	}
	if err := tx.Model(&existing).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("update product %s: %w", product.NameEn, err)
	}
	for idx := range product.Images {
		product.Images[idx].ProductID = existing.ID
	}
	for idx := range product.Packages {
		product.Packages[idx].ProductID = existing.ID
	}
	for idx := range product.Highlights {
		product.Highlights[idx].ProductID = existing.ID
	}
	for idx := range product.FAQs {
		product.FAQs[idx].ProductID = existing.ID
	}
	if err := tx.Create(&product.Images).Error; err != nil {
		return nil, fmt.Errorf("create images for %s: %w", product.NameEn, err)
	}
	if err := tx.Create(&product.Packages).Error; err != nil {
		return nil, fmt.Errorf("create packages for %s: %w", product.NameEn, err)
	}
	if len(product.Highlights) > 0 {
		if err := tx.Create(&product.Highlights).Error; err != nil {
			return nil, fmt.Errorf("create highlights for %s: %w", product.NameEn, err)
		}
	}
	if len(product.FAQs) > 0 {
		if err := tx.Create(&product.FAQs).Error; err != nil {
			return nil, fmt.Errorf("create faqs for %s: %w", product.NameEn, err)
		}
	}
	if err := tx.First(&existing, existing.ID).Error; err != nil {
		return nil, fmt.Errorf("reload product %s: %w", product.NameEn, err)
	}
	return &existing, nil
}

func productUpdates(seed productSeed, supplierID uint, regionID uint, categoryID uint) (map[string]interface{}, error) {
	tags, err := json.Marshal(seed.Tags)
	if err != nil {
		return nil, fmt.Errorf("encode tags for %s: %w", seed.NameEn, err)
	}
	metadataSource := make(map[string]interface{}, len(seed.Metadata)+1)
	for key, value := range seed.Metadata {
		metadataSource[key] = value
	}
	officialImageSources := make([]map[string]string, 0, len(seed.OfficialImages))
	for _, image := range seed.OfficialImages {
		officialImageSources = append(officialImageSources, map[string]string{
			"file":       image.File,
			"source_url": image.SourceURL,
		})
	}
	metadataSource["official_image_sources"] = officialImageSources
	metadata, err := json.Marshal(metadataSource)
	if err != nil {
		return nil, fmt.Errorf("encode metadata for %s: %w", seed.NameEn, err)
	}
	return map[string]interface{}{
		"name_zh":        seed.NameZh,
		"name_en":        seed.NameEn,
		"supplier_id":    supplierID,
		"region_id":      regionID,
		"category_id":    categoryID,
		"status":         productmodel.ProductStatusDraft,
		"price_from":     seed.PriceFrom,
		"currency":       "AUD",
		"summary_zh":     seed.SummaryZh,
		"summary_en":     seed.SummaryEn,
		"description_zh": seed.DescriptionZh,
		"description_en": seed.DescriptionEn,
		"address_zh":     seed.Address,
		"address_en":     seed.Address,
		"duration":       seed.Duration,
		"group_size":     seed.GroupSize,
		"tags":           string(tags),
		"metadata":       []byte(metadata),
		"created_via":    "admin_proxy",
	}, nil
}

func replaceProductAssociations(tx *gorm.DB, productID uint) error {
	if err := tx.Unscoped().Where("product_id = ?", productID).Delete(&productmodel.ProductImage{}).Error; err != nil {
		return fmt.Errorf("replace images: %w", err)
	}
	if err := tx.Unscoped().Where("product_id = ?", productID).Delete(&productmodel.ProductPackage{}).Error; err != nil {
		return fmt.Errorf("replace packages: %w", err)
	}
	if err := tx.Unscoped().Where("product_id = ?", productID).Delete(&productmodel.ProductHighlight{}).Error; err != nil {
		return fmt.Errorf("replace highlights: %w", err)
	}
	if err := tx.Unscoped().Where("product_id = ?", productID).Delete(&productmodel.ProductFAQ{}).Error; err != nil {
		return fmt.Errorf("replace faqs: %w", err)
	}
	return nil
}

func fineDiningImports() []diningImport {
	collectedAt := time.Now().UTC().Format(time.RFC3339)
	return []diningImport{
		restaurantBotanic(collectedAt),
		penfoldsMagillEstate(collectedAt),
		ozinRestaurant(collectedAt),
	}
}

func restaurantBotanic(collectedAt string) diningImport {
	return diningImport{
		Supplier: supplierSeed{
			Name:        "Restaurant Botanic",
			Email:       "info@restaurantbotanic.com.au",
			Phone:       "+61 8 8223 3526",
			Website:     "https://restaurantbotanic.com.au/",
			Address:     "Friends Gate, Plane Tree Drive",
			City:        "Adelaide",
			State:       "SA",
			PostalCode:  "5000",
			Description: "Modern Australian fine dining in Adelaide Botanic Garden, focused on native ingredients, seasonal produce, and a multi-sensory degustation experience.",
		},
		Products: []productSeed{{
			NameZh:        "Restaurant Botanic 品鉴菜单体验",
			ProductID:     39,
			NameEn:        "Restaurant Botanic Dining Experience",
			PriceFrom:     315,
			SummaryZh:     "位于阿德莱德植物园内的现代澳大利亚精致餐饮，提供以原生食材和当季风味为核心的品鉴菜单体验。",
			SummaryEn:     "A modern Australian fine dining experience in Adelaide Botanic Garden, centred on native ingredients, seasonality, and a degustation menu.",
			DescriptionZh: "Restaurant Botanic 的 Dining Experience 以多道式品鉴菜单呈现澳大利亚原生食材、当季农产和植物园环境。菜单价为 AUD 315/人，可另选酒水或无酒精配餐。在宁静园景环绕的餐厅内，每道菜都结合季节风味、自然灵感与现代澳大利亚烹饪技法。",
			DescriptionEn: "Restaurant Botanic's Dining Experience presents Australian native ingredients, seasonal produce, and the Adelaide Botanic Garden setting through a degustation menu. The menu is AUD 315 per person, with optional wine and non-alcoholic pairings. Each course brings together seasonal flavours, nature-led inspiration, and modern Australian technique in a tranquil garden setting.",
			Address:       "Friends Gate, Plane Tree Drive, Adelaide SA 5000",
			Duration:      "3.5 hours",
			GroupSize:     "1-6",
			Tags:          []string{"精致餐饮", "现代澳大利亚菜", "原生食材", "品鉴菜单", "阿德莱德植物园"},
			Packages: []packageSeed{{
				NameZh: "品鉴菜单（每位）",
				NameEn: "Degustation menu (per person)",
				DescZh: "官网公开菜单价；预订时需全额支付，饮品配餐另计。",
				DescEn: "Public menu price; full payment is required when booking. Beverage pairings are additional.",
				Price:  315,
			}, restaurantBotanicPairing("The Temperance 非酒精配餐", "The Temperance non-alcoholic pairing", 145), restaurantBotanicPairing("The Botanic 酒水配餐", "The Botanic beverage pairing", 205), restaurantBotanicPairing("The Sommelier's Reserve 酒水配餐", "The Sommelier's Reserve beverage pairing", 375), restaurantBotanicPairing("The Cellar Selection 酒水配餐", "The Cellar Selection beverage pairing", 650)},
			Highlights: []highlightSeed{
				{TitleZh: "植物园内精致餐饮", TitleEn: "Fine dining in the Botanic Garden", DescZh: "餐厅位于 Adelaide Botanic Garden，餐区面向园景。", DescEn: "Located in Adelaide Botanic Garden with dining spaces overlooking the gardens."},
				{TitleZh: "原生食材与当季菜单", TitleEn: "Native ingredients and seasonal menu", DescZh: "菜单围绕澳大利亚原生食材、当季农产和可持续理念设计。", DescEn: "Menus are shaped around Australian native ingredients, seasonal produce, and sustainability."},
			},
			FAQs: []faqSeed{
				{QuestionZh: "体验预计多长时间？", QuestionEn: "How long should guests allow?", AnswerZh: "建议为完整用餐体验预留约 3.5 小时。", AnswerEn: "Allow approximately 3.5 hours for the full dining experience."},
				{QuestionZh: "最多可以预订几位？", QuestionEn: "What is the maximum booking size?", AnswerZh: "每笔预订最多可安排 6 位客人。", AnswerEn: "Reservations can accommodate up to 6 guests per booking."},
			},
			Metadata: sourceMetadata(collectedAt, []string{
				"https://southaustralia.com/destinations/adelaide/food-and-drink",
				"https://restaurantbotanic.com.au/",
				"https://restaurantbotanic.com.au/dining-experience/",
				"https://restaurantbotanic.com.au/food-beverages/",
				"https://www.restaurantbotanic.com.au/reservations",
			}, "https://www.restaurantbotanic.com.au/reservations", map[string]interface{}{
				"payment":          "Full payment of menus is required at the time of booking.",
				"refund_policy":    "Official site states all sales are final and non-refundable.",
				"transfer_allowed": true,
			}, []string{"opening_hours", "live_availability", "final booking/cancellation wording"}),
			ImageFile: "product-39-dining-experience.jpg",
			OfficialImages: []officialImageSeed{
				{File: "product-39-official-dish.jpg", SourceURL: "https://restaurantbotanic.com.au/wp-content/uploads/2025/06/Restaurant_Botanic_Food_Scaled_Home.jpg"},
				{File: "product-39-official-course.jpg", SourceURL: "https://restaurantbotanic.com.au/wp-content/uploads/2025/05/Restaurant_Botanic_Plate4_Food_Dining_Scaled.jpg"},
			},
		}, restaurantBotanicChefTable(collectedAt)},
	}
}

func restaurantBotanicPairing(nameZh string, nameEn string, price float64) packageSeed {
	return packageSeed{
		NameZh: nameZh,
		NameEn: nameEn,
		DescZh: "官网公开列出的可选配餐附加价格；需与基础菜单同时预订。",
		DescEn: "Official optional pairing add-on price; booked with the base menu.",
		Price:  price,
	}
}

func restaurantBotanicChefTable(collectedAt string) productSeed {
	return productSeed{
		NameZh:        "Restaurant Botanic 厨师桌品鉴体验",
		ProductID:     42,
		NameEn:        "Restaurant Botanic Chef's Table Degustation",
		PriceFrom:     315,
		SummaryZh:     "坐在开放式厨房旁的厨师桌，观看厨师团队完成多道式品鉴菜单。",
		SummaryEn:     "A chef's table degustation seated around the open kitchen.",
		DescriptionZh: "Chef's Table 是 Restaurant Botanic 的沉浸式品鉴体验，客人坐在环绕开放厨房的餐台旁，近距离观看厨师团队烹调和摆盘。菜单价为 AUD 315/人，并可选择多档酒水或无酒精配餐，在植物园景致与厨房剧场感之间享用完整品鉴菜单。",
		DescriptionEn: "The Chef's Table is an immersive degustation experience seated at the counter surrounding the open kitchen, offering a close view of the team preparing and plating each course. The menu is AUD 315 per person, with optional wine and non-alcoholic pairings, combining kitchen theatre with the Adelaide Botanic Garden setting.",
		Address:       "Friends Gate, Plane Tree Drive, Adelaide SA 5000",
		Duration:      "3.5 hours",
		GroupSize:     "1-6",
		Tags:          []string{"厨师桌", "开放式厨房", "精致餐饮", "品鉴菜单", "阿德莱德植物园"},
		Packages: []packageSeed{{
			NameZh: "厨师桌品鉴菜单（每位）",
			NameEn: "Chef's Table degustation menu (per person)",
			DescZh: "厨师桌完整品鉴菜单，每位 AUD 315；实际席位以预订时可选场次为准。",
			DescEn: "The full Chef's Table degustation menu is AUD 315 per person; seating is subject to availability when booking.",
			Price:  315,
		}, restaurantBotanicPairing("The Temperance 非酒精配餐", "The Temperance non-alcoholic pairing", 145), restaurantBotanicPairing("The Botanic 酒水配餐", "The Botanic beverage pairing", 205), restaurantBotanicPairing("The Sommelier's Reserve 酒水配餐", "The Sommelier's Reserve beverage pairing", 375), restaurantBotanicPairing("The Cellar Selection 酒水配餐", "The Cellar Selection beverage pairing", 650)},
		Highlights: []highlightSeed{
			{TitleZh: "开放厨房视角", TitleEn: "Open-kitchen counter", DescZh: "客人可近距离观看厨师团队制作和摆盘。", DescEn: "Guests watch the kitchen team prepare and plate each course up close."},
			{TitleZh: "沉浸式品鉴", TitleEn: "Immersive degustation", DescZh: "将厨房剧场感与植物园环境结合。", DescEn: "Combines kitchen theatre with the Botanic Garden setting."},
		},
		FAQs: []faqSeed{
			{QuestionZh: "厨师桌使用什么座椅？", QuestionEn: "What seating is used at the Chef's Table?", AnswerZh: "厨师桌配有常规桌高的餐椅，座位环绕开放式厨房。", AnswerEn: "The Chef's Table uses regular table-height dining chairs arranged around the open kitchen."},
			{QuestionZh: "体验预计多长时间？", QuestionEn: "How long should guests allow?", AnswerZh: "建议为完整品鉴体验预留约 3.5 小时。", AnswerEn: "Allow approximately 3.5 hours for the full degustation experience."},
		},
		Metadata: sourceMetadata(collectedAt, []string{
			"https://restaurantbotanic.com.au/dining-experience/",
			"https://www.restaurantbotanic.com.au/reservations",
		}, "https://www.restaurantbotanic.com.au/reservations", map[string]interface{}{
			"payment":          "Full payment of menus is required at the time of booking.",
			"refund_policy":    "Official site states all sales are final and non-refundable.",
			"transfer_allowed": true,
		}, []string{"live_availability", "chef_table_price_confirmation", "final booking/cancellation wording"}),
		ImageFile: "product-42-chefs-table.jpg",
		OfficialImages: []officialImageSeed{
			{File: "product-42-official-dish.jpg", SourceURL: "https://restaurantbotanic.com.au/wp-content/uploads/2025/06/Restaurant_Botanic_Food_Scaled_Jan2.jpg"},
			{File: "product-42-official-dessert.jpg", SourceURL: "https://restaurantbotanic.com.au/wp-content/uploads/2025/05/Restaurant_Botanic_Plate8_Food_Dining_Scaled.jpg"},
		},
	}
}

func restaurantBotanicCoreMenu(collectedAt string) productSeed {
	return productSeed{
		NameZh:        "Restaurant Botanic 午间 Core Menu",
		NameEn:        "Restaurant Botanic Core Menu Lunch",
		PriceFrom:     0,
		SummaryZh:     "午餐限定的三道式 Core Menu，作为 Restaurant Botanic 风味和服务的精简表达。",
		SummaryEn:     "A lunch-only three-course Core Menu offering a shorter expression of Restaurant Botanic.",
		DescriptionZh: "官网介绍 Core Menu 为午餐限定三道式体验，适合希望以较短时间体验 Restaurant Botanic 的客人。当前可抓取公开文本未确认 Core Menu 固定价格，因此以 0 元占位草稿保存，需运营补全价格、可订日期和条款后再上架。",
		DescriptionEn: "The official site describes the Core Menu as a lunch-only three-course experience for a shorter daytime expression of Restaurant Botanic. No fixed public price was confirmed in crawlable text, so this draft uses a zero-price placeholder pending review.",
		Address:       "Friends Gate, Plane Tree Drive, Adelaide SA 5000",
		Duration:      "",
		GroupSize:     "",
		Tags:          []string{"午餐", "三道式菜单", "精致餐饮", "当季菜单", "阿德莱德植物园"},
		Packages: []packageSeed{{
			NameZh: "Core Menu 午餐（价格待复核）",
			NameEn: "Core Menu lunch (price to be reviewed)",
			DescZh: "官网说明为午餐限定三道式菜单；固定价格需运营复核。",
			DescEn: "Officially described as a lunch-only three-course menu; fixed price requires operator review.",
			Price:  0,
		}},
		Highlights: []highlightSeed{
			{TitleZh: "午餐限定", TitleEn: "Lunch only", DescZh: "官网说明 Core Menu 仅午餐供应。", DescEn: "The official site states the Core Menu is available for lunch only."},
			{TitleZh: "三道式精简体验", TitleEn: "Three-course shorter expression", DescZh: "以三道式菜单呈现餐厅的风味和服务。", DescEn: "Presents the restaurant's flavours and hospitality through a three-course menu."},
		},
		Metadata: sourceMetadata(collectedAt, []string{
			"https://restaurantbotanic.com.au/dining-experience/",
			"https://restaurantbotanic.com.au/food-beverages/",
		}, "https://www.restaurantbotanic.com.au/reservations", map[string]interface{}{
			"availability": "Lunch only, per official site.",
		}, []string{"fixed package price", "duration", "group_size", "live_availability", "image_usage_permission", "booking/cancellation terms"}),
	}
}

func penfoldsMagillEstate(collectedAt string) diningImport {
	return diningImport{
		Supplier: supplierSeed{
			Name:        "Penfolds Magill Estate Restaurant",
			Email:       "mer@magillestate.com.au",
			Phone:       "+61 8 8301 5551",
			Website:     "https://www.magillestaterestaurant.com/",
			Address:     "78 Penfold Road",
			City:        "Magill",
			State:       "SA",
			PostalCode:  "5072",
			Description: "Fine dining restaurant at Penfolds' Magill Estate, pairing contemporary seasonal food with the estate's wine collection and Adelaide foothills views.",
		},
		Products: []productSeed{{
			NameZh:        "Magill Estate 餐酒搭配体验",
			ProductID:     40,
			NameEn:        "Magill Estate Restaurant Signature Menu",
			PriceFrom:     295,
			SummaryZh:     "Penfolds Magill Estate Restaurant 的 Signature Menu 精致餐饮体验，可选 Penfolds 葡萄酒搭配。",
			SummaryEn:     "The Signature Menu fine dining experience at Penfolds Magill Estate Restaurant, with optional Penfolds wine pairings.",
			DescriptionZh: "Magill Estate Restaurant 位于 Penfolds 的精神故乡，将当代精致餐饮、酒窖藏酒与阿德莱德山麓葡萄园景观融为一体。Signature Menu 为 AUD 295/人，可选 Icon Wine Pairing AUD 350/人或 Sommeliers Wine Pairing AUD 210/人。",
			DescriptionEn: "Magill Estate Restaurant sits at the spiritual home of Penfolds, bringing together contemporary fine dining, cellar wines, and views across the estate's vines and Adelaide foothills. The Signature Menu is AUD 295 per person, with an optional Icon Wine Pairing at AUD 350 or Sommeliers Wine Pairing at AUD 210.",
			Address:       "78 Penfold Road, Magill SA 5072",
			Duration:      "",
			GroupSize:     "",
			Tags:          []string{"精致餐饮", "Penfolds", "葡萄酒配餐", "当季菜单", "Magill Estate"},
			Packages: []packageSeed{
				{NameZh: "Signature Menu（每位）", NameEn: "Signature Menu (per person)", DescZh: "官网菜单区公开价格。", DescEn: "Public price listed in the official menu section.", Price: 295},
				{NameZh: "侍酒师葡萄酒搭配（每位）", NameEn: "Sommeliers Wine Pairing (per person)", DescZh: "官网菜单区公开列出的可选葡萄酒搭配。", DescEn: "Optional wine pairing listed in the official menu section.", Price: 210},
				{NameZh: "Icon 葡萄酒搭配（每位）", NameEn: "Icon Wine Pairing (per person)", DescZh: "官网菜单区公开列出的可选葡萄酒搭配。", DescEn: "Optional wine pairing listed in the official menu section.", Price: 350},
			},
			Highlights: []highlightSeed{
				{TitleZh: "Penfolds 酒庄精致餐饮", TitleEn: "Fine dining at Penfolds", DescZh: "餐厅位于 Penfolds Magill Estate，可结合酒庄历史与餐饮体验。", DescEn: "Located at Penfolds Magill Estate, pairing winery heritage with fine dining."},
				{TitleZh: "两档葡萄酒搭配", TitleEn: "Two wine pairing options", DescZh: "官网列出 Sommelier's 与 Icon 两档酒水搭配。", DescEn: "The official site lists Sommelier's and Icon wine pairing options."},
			},
			FAQs: []faqSeed{
				{QuestionZh: "可以 BYO 自带酒吗？", QuestionEn: "Is BYO available?", AnswerZh: "餐厅不提供 BYO 自带酒服务。", AnswerEn: "BYO is not available at Magill Estate Restaurant."},
				{QuestionZh: "有哪些葡萄酒搭配？", QuestionEn: "What wine pairings are available?", AnswerZh: "可选侍酒师葡萄酒搭配 AUD 210/人，或 Icon 葡萄酒搭配 AUD 350/人。", AnswerEn: "Choose the Sommeliers Wine Pairing at AUD 210 per person or the Icon Wine Pairing at AUD 350 per person."},
			},
			Metadata: sourceMetadata(collectedAt, []string{
				"https://southaustralia.com/destinations/adelaide/food-and-drink",
				"https://us.penfolds.com/pages/magill-estate-restaurant",
				"https://www.magillestaterestaurant.com/",
			}, "https://www.magillestaterestaurant.com/", map[string]interface{}{
				"opening_hours": "Dinner Wednesday-Saturday from 18:00; lunch Saturday-Sunday from 12:00, per collected data supplied in REQ discussion.",
				"wine_pairings_aud": map[string]float64{
					"Sommeliers Wine Pairing": 210,
					"Icon Wine Pairing":       350,
				},
			}, []string{"duration", "group_size", "live_availability", "booking/cancellation terms"}),
			ImageFile: "product-40-signature-menu.jpg",
			OfficialImages: []officialImageSeed{
				{File: "product-40-official-vineyard-view.png", SourceURL: "https://www.penfolds.com/dw/image/v2/BDBN_PRD/on/demandware.static/-/Library-Sites-PenfoldsSharedLibrary/default/dwb94a2502/1-Images/Banner/1920x560-Desktop-Banner/1920x560-Penfolds-Magill-Estate-Restaurant-View.png?sfrm=png"},
				{File: "product-40-official-chef.png", SourceURL: "https://www.penfolds.com/dw/image/v2/BDBN_PRD/on/demandware.static/-/Library-Sites-PenfoldsSharedLibrary/default/dwcdeb8732/1-Images/Square/840x840/840x840-Magill-Estate-Restaurant-Chef-Scott.png?sfrm=png"},
			},
		}, penfoldsLunchTasting(collectedAt)},
	}
}

func penfoldsLunchTasting(collectedAt string) productSeed {
	return productSeed{
		NameZh:        "Magill Estate 午餐品鉴菜单",
		ProductID:     45,
		NameEn:        "Magill Estate Restaurant Lunch Tasting Menu",
		PriceFrom:     230,
		SummaryZh:     "周末午餐供应的 Lunch Tasting Menu，可选 Penfolds 葡萄酒搭配。",
		SummaryEn:     "A weekend lunch tasting menu at Magill Estate Restaurant, with optional Penfolds wine pairings.",
		DescriptionZh: "Lunch Tasting Menu 为 AUD 230/人，于周六和周日 12:00 起供应。午间品鉴体验以当季菜品搭配 Penfolds 酒款，可选 Icon Wine Pairing AUD 350/人或 Sommeliers Wine Pairing AUD 210/人。",
		DescriptionEn: "The Lunch Tasting Menu is AUD 230 per person and is served from 12:00 on Saturday and Sunday. This seasonal daytime dining experience can be paired with Penfolds wines, with an optional Icon Wine Pairing at AUD 350 or Sommeliers Wine Pairing at AUD 210.",
		Address:       "78 Penfold Road, Magill SA 5072",
		Tags:          []string{"午餐", "品鉴菜单", "Penfolds", "葡萄酒配餐", "Magill Estate"},
		Packages: []packageSeed{
			{NameZh: "Lunch Tasting Menu（每位）", NameEn: "Lunch Tasting Menu (per person)", DescZh: "官网菜单区公开价格。", DescEn: "Public price listed in the official menu section.", Price: 230},
			{NameZh: "侍酒师葡萄酒搭配（每位）", NameEn: "Sommeliers Wine Pairing (per person)", DescZh: "官网菜单区公开列出的可选葡萄酒搭配。", DescEn: "Optional wine pairing listed in the official menu section.", Price: 210},
			{NameZh: "Icon 葡萄酒搭配（每位）", NameEn: "Icon Wine Pairing (per person)", DescZh: "官网菜单区公开列出的可选葡萄酒搭配。", DescEn: "Optional wine pairing listed in the official menu section.", Price: 350},
		},
		Highlights: []highlightSeed{
			{TitleZh: "周末午餐", TitleEn: "Weekend lunch", DescZh: "官网显示午餐周六、周日 12:00 起。", DescEn: "The official site lists lunch Saturday and Sunday from 12:00."},
			{TitleZh: "Penfolds 配餐", TitleEn: "Penfolds pairings", DescZh: "可选两档葡萄酒搭配。", DescEn: "Two optional wine pairing tiers are available."},
		},
		FAQs: []faqSeed{
			{QuestionZh: "午餐菜单什么时候供应？", QuestionEn: "When is the lunch menu available?", AnswerZh: "Lunch Tasting Menu 于周六和周日 12:00 起供应。", AnswerEn: "The Lunch Tasting Menu is served from 12:00 on Saturday and Sunday."},
			{QuestionZh: "可以搭配葡萄酒吗？", QuestionEn: "Are wine pairings available?", AnswerZh: "可选侍酒师葡萄酒搭配 AUD 210/人，或 Icon 葡萄酒搭配 AUD 350/人。", AnswerEn: "Choose the Sommeliers Wine Pairing at AUD 210 per person or the Icon Wine Pairing at AUD 350 per person."},
		},
		Metadata: sourceMetadata(collectedAt, []string{"https://www.magillestaterestaurant.com/"}, "https://www.sevenrooms.com/reservations/magillestaterestaurant", map[string]interface{}{
			"opening_hours": "Lunch Saturday-Sunday from 12:00.",
			"surcharges":    "Official site notes 12.5% public holiday surcharge and 10% Sunday surcharge.",
		}, []string{"duration", "group_size", "live_availability", "booking/cancellation terms"}),
		ImageFile: "product-45-lunch-tasting.jpg",
		OfficialImages: []officialImageSeed{
			{File: "product-45-official-entrance.png", SourceURL: "https://www.penfolds.com/dw/image/v2/BDBN_PRD/on/demandware.static/-/Library-Sites-PenfoldsSharedLibrary/default/dw3aedbed1/1-Images/Landscape/840x450/840x450-Magill-Estate-Restaurant-Entrance.png?sfrm=png"},
			{File: "product-45-official-wine-cellar.png", SourceURL: "https://www.penfolds.com/dw/image/v2/BDBN_PRD/on/demandware.static/-/Library-Sites-PenfoldsSharedLibrary/default/dw56fe01fb/1-Images/Landscape/840x450/840x450-Magill-Estate-Restaurant-Wine-Fridge.png?sfrm=png"},
		},
	}
}

func penfoldsPrivateEvents(collectedAt string) productSeed {
	return productSeed{
		NameZh:        "Magill Estate 私人活动与包场",
		NameEn:        "Magill Estate Restaurant Private Events",
		PriceFrom:     0,
		SummaryZh:     "Magill Estate Restaurant 私人活动、公司活动和包场餐饮询价服务。",
		SummaryEn:     "Private dining, functions, and events enquiry service at Magill Estate Restaurant.",
		DescriptionZh: "官网提供私人活动/ functions 邮箱联系方式，但未公开固定套餐价。本记录以询价型草稿保存，需运营补全人数范围、菜单价、场地费、取消政策和图片授权后再上架。",
		DescriptionEn: "The official site provides contact details for private events/functions but does not publish fixed package pricing. This enquiry-style draft requires review of capacity, menu pricing, venue fees, cancellation policy, and image permissions.",
		Address:       "78 Penfold Road, Magill SA 5072",
		Tags:          []string{"私人活动", "包场", "公司活动", "Penfolds", "精致餐饮"},
		Packages: []packageSeed{{
			NameZh: "私人活动询价（价格待复核）",
			NameEn: "Private event enquiry (price to be reviewed)",
			DescZh: "官网未公开固定活动套餐价；需运营询价。",
			DescEn: "No fixed public event package price; operator enquiry required.",
			Price:  0,
		}},
		Highlights: []highlightSeed{
			{TitleZh: "酒庄餐厅活动", TitleEn: "Winery restaurant events", DescZh: "适合私人活动、公司活动和特殊聚会询价。", DescEn: "Suitable for private functions, corporate events, and special gatherings by enquiry."},
		},
		Metadata: sourceMetadata(collectedAt, []string{"https://www.magillestaterestaurant.com/"}, "mailto:mer@magillrestaurant.com", map[string]interface{}{
			"contact": "Private events/functions enquiries via mer@magillrestaurant.com.",
		}, []string{"fixed package price", "capacity", "duration", "live_availability", "image_usage_permission", "booking/cancellation terms"}),
	}
}

func ozinRestaurant(collectedAt string) diningImport {
	return diningImport{
		Supplier: supplierSeed{
			Name:        "OZIN Restaurant",
			Email:       "hello@ozinrestaurant.com.au",
			Phone:       "+61 8 8432 5331",
			Website:     "https://www.ozinrestaurant.com.au/",
			Address:     "6 East Terrace",
			City:        "Adelaide",
			State:       "SA",
			PostalCode:  "5000",
			Description: "Adelaide East End restaurant focused on coal-fired cooking, seasonal South Australian produce, cocktails, and international flavours.",
		},
		Products: []productSeed{ozinChefsSelection(collectedAt)},
	}
}

func ozinChefsSelection(collectedAt string) productSeed {
	return productSeed{
		NameZh:        "OZIN Chef's Selection Tasting Menu",
		ProductID:     47,
		NameEn:        "OZIN Chef's Selection Tasting Menu",
		PriceFrom:     80,
		SummaryZh:     "由餐厅从菜单中代选多道菜品的品鉴菜单，甜点包含在内。",
		SummaryEn:     "A chef-selected tasting menu chosen from across OZIN's menu, including dessert.",
		DescriptionZh: "Chef's Selection Tasting Menu 为 AUD 80/人，由 OZIN 团队从菜单中代选多道菜品并包含甜点，让客人轻松分享炭火烹调与国际风味。6 人及以上预订需选择该菜单，另可加 AUD 20/人升级海鲜选项。",
		DescriptionEn: "The Chef's Selection Tasting Menu is AUD 80 per person, with the OZIN team choosing a selection of dishes from across the menu, including dessert, for an easy shared experience of coal-fired cooking and international flavours. It is required for bookings of 6 or more, with a seafood option available for an additional AUD 20 per person.",
		Address:       "6 East Terrace, Adelaide SA 5000",
		Tags:          []string{"品鉴菜单", "炭烤", "南澳本地食材", "多人预订", "East End"},
		Packages: []packageSeed{
			{NameZh: "Chef's Selection Tasting Menu（每位）", NameEn: "Chef's Selection Tasting Menu (per person)", DescZh: "官网菜单图片公开价格；6 人及以上预订需选择。", DescEn: "Public price from the official food menu image; required for bookings of 6 or more.", Price: 80},
			{NameZh: "海鲜选项附加（每位）", NameEn: "Seafood option add-on (per person)", DescZh: "官网菜单图片列出可加 AUD 20/人升级海鲜选项。", DescEn: "Official menu image lists a seafood option at an additional AUD 20 per person.", Price: 20},
		},
		Highlights: []highlightSeed{
			{TitleZh: "餐厅代选菜单", TitleEn: "Chef-selected dishes", DescZh: "餐厅从菜单中代选多道菜品，减少点餐决策。", DescEn: "The team chooses dishes from across the menu on the guest's behalf."},
			{TitleZh: "适合多人", TitleEn: "Suited to groups", DescZh: "官网说明 6 人及以上预订需选择该菜单。", DescEn: "The official menu notes this tasting menu is required for bookings of 6 or more."},
		},
		FAQs: []faqSeed{
			{QuestionZh: "6 人及以上可以单点吗？", QuestionEn: "Can groups of 6 or more order a la carte?", AnswerZh: "6 人及以上的预订需选择 Chef's Selection Tasting Menu。", AnswerEn: "Bookings of 6 or more are required to choose the Chef's Selection Tasting Menu."},
			{QuestionZh: "可以升级海鲜选项吗？", QuestionEn: "Is a seafood option available?", AnswerZh: "可以，每位加 AUD 20 即可选择海鲜升级。", AnswerEn: "Yes. A seafood option is available for an additional AUD 20 per person."},
			{QuestionZh: "有饮食禁忌或过敏怎么办？", QuestionEn: "What if I have dietary requirements or allergies?", AnswerZh: "请在预订时告知饮食需求或过敏情况。厨房会尽力协助，但无法保证与所有过敏原完全隔离。", AnswerEn: "Share dietary requirements or allergies when booking. The kitchen will assist where possible but cannot guarantee complete separation from all allergens."},
		},
		Metadata: sourceMetadata(collectedAt, []string{"https://www.ozinrestaurant.com.au/food-menu"}, "https://bookings.nowbookit.com/?accountid=aa4ac0a9-72e5-45af-9c83-e24677227011&venueid=12484&theme=light&colors=hex,000000,dbc475", map[string]interface{}{
			"menu_image":   "https://www.ozinrestaurant.com.au/assets/img/menu/food-menu-13-feb.jpg",
			"group_rule":   "Required for all bookings of 6 or more.",
			"allergy_note": "Official menu notes dietary requirements should be discussed and complete allergen separation cannot be guaranteed.",
		}, []string{"duration", "live_availability", "booking/cancellation terms"}),
		ImageFile: "product-47-chefs-selection.jpg",
		OfficialImages: []officialImageSeed{
			{File: "product-47-official-dining-room.jpg", SourceURL: "https://www.ozinrestaurant.com.au/assets/new-img/new-gallery/img-1.jpg"},
			{File: "product-47-official-food.jpg", SourceURL: "https://www.ozinrestaurant.com.au/assets/new-img/new-gallery/img-20.jpg"},
		},
	}
}

func ozinPrivateEvents(collectedAt string) productSeed {
	return productSeed{
		NameZh:        "OZIN 私人活动与包场",
		NameEn:        "OZIN Private Dining and Events",
		PriceFrom:     0,
		SummaryZh:     "OZIN 私人活动和包场询价，适合最多 70 人坐席或 100 人站立鸡尾酒活动。",
		SummaryEn:     "Private dining and exclusive event enquiries at OZIN, for seated events up to 70 or cocktail events up to 100.",
		DescriptionZh: "OZIN 官网 Events 页面说明可承接最多 70 人坐席活动或 100 人站立鸡尾酒活动，并可定制菜单和体验。官网未公开固定套餐价，因此以询价型草稿保存，需运营补全价格、菜单、定金、取消政策和图片授权后再上架。",
		DescriptionEn: "OZIN's official Events page states it can host seated events for up to 70 guests or stand-up cocktail events for up to 100, with customised menus and experiences. No fixed public package price is listed, so this enquiry-style draft requires review before publishing.",
		Address:       "6 East Terrace, Adelaide SA 5000",
		GroupSize:     "1-100",
		Tags:          []string{"私人活动", "包场", "鸡尾酒活动", "炭烤", "East End"},
		Packages: []packageSeed{{
			NameZh: "私人活动询价（价格待复核）",
			NameEn: "Private event enquiry (price to be reviewed)",
			DescZh: "官网未公开固定活动套餐价；需运营询价。",
			DescEn: "No fixed public event package price; operator enquiry required.",
			Price:  0,
		}},
		Highlights: []highlightSeed{
			{TitleZh: "坐席最多 70 人", TitleEn: "Seated events up to 70", DescZh: "官网说明可承接最多 70 人坐席活动。", DescEn: "The official site states seated events can accommodate up to 70 guests."},
			{TitleZh: "站立鸡尾酒最多 100 人", TitleEn: "Cocktail events up to 100", DescZh: "官网说明可承接最多 100 人站立鸡尾酒活动。", DescEn: "The official site states stand-up cocktail events can accommodate up to 100 guests."},
		},
		Metadata: sourceMetadata(collectedAt, []string{"https://www.ozinrestaurant.com.au/events"}, "https://www.ozinrestaurant.com.au/events#enquire-section", map[string]interface{}{
			"capacity": map[string]int{"seated": 70, "cocktail": 100},
		}, []string{"fixed package price", "duration", "live_availability", "deposit/cancellation terms", "image_usage_permission"}),
	}
}

func sourceMetadata(collectedAt string, sourceURLs []string, bookingURL string, extra map[string]interface{}, needsReview []string) map[string]interface{} {
	return map[string]interface{}{
		"source": map[string]interface{}{
			"requirement_id": requirementID,
			"source_urls":    sourceURLs,
			"booking_url":    bookingURL,
			"collected_at":   collectedAt,
		},
		"field_sources": map[string]string{
			"name":        "official website",
			"address":     "official website",
			"phone":       "official website",
			"email":       "official website",
			"price_from":  "official website where available",
			"booking_url": "official website",
		},
		"booking_terms": extra,
		"needs_review":  needsReview,
	}
}

func printDryRun() error {
	var payload []map[string]interface{}
	for _, record := range fineDiningImports() {
		var products []map[string]interface{}
		for _, product := range record.Products {
			var packages []string
			for _, pkg := range product.Packages {
				packages = append(packages, pkg.NameEn)
			}
			products = append(products, map[string]interface{}{
				"name_zh":         product.NameZh,
				"name_en":         product.NameEn,
				"status":          "draft",
				"price_from":      product.PriceFrom,
				"currency":        "AUD",
				"packages":        packages,
				"cover_image":     "/uploads/fine-dining/" + product.ImageFile,
				"official_images": product.OfficialImages,
			})
		}
		payload = append(payload, map[string]interface{}{
			"supplier": map[string]interface{}{
				"name":   record.Supplier.Name,
				"email":  record.Supplier.Email,
				"status": "approved",
			},
			"products": products,
		})
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(map[string]interface{}{
		"category": map[string]interface{}{
			"slug": "dining", "name_zh": "餐饮美食", "name_en": "Dining",
		},
		"records": payload,
	})
}
