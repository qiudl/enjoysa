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
	Address, Duration, GroupSize, BookingURL, CategorySlug             string
	Price                                                              float64
	Images                                                             []imageSeed
	Packages                                                           []packageSeed
	Highlights                                                         []highlightSeed
	FAQs                                                               []faqSeed
}
type supplierSeed struct {
	RegionSlug, RegionZh, RegionEn, Name, Type, Email, Phone, Website, Address, City, State, PostalCode, Description string
	Products                                                                                                         []productSeed
}
type itemResult struct {
	SupplierID uint   `json:"supplier_id"`
	ProductID  uint   `json:"product_id"`
	Name       string `json:"name"`
}
type result struct {
	Items []itemResult `json:"items"`
}

func main() {
	configPath := flag.String("config", "configs/config.yaml", "config file")
	assetDir := flag.String("asset-dir", "assets/curated-sa-experiences", "image directory")
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
	if err = copyImages(assetDir, cfg.Upload.Dir); err != nil {
		return nil, err
	}
	out := &result{}
	err = db.Transaction(func(tx *gorm.DB) error {
		cats, err := categories(tx)
		if err != nil {
			return err
		}
		for _, s := range seeds() {
			region, err := upsertRegion(tx, s)
			if err != nil {
				return err
			}
			supplier, err := upsertSupplier(tx, s)
			if err != nil {
				return err
			}
			for _, p := range s.Products {
				product, err := upsertProduct(tx, s, p, supplier.ID, region.ID, cats[p.CategorySlug].ID)
				if err != nil {
					return err
				}
				out.Items = append(out.Items, itemResult{supplier.ID, product.ID, product.NameEn})
			}
		}
		return nil
	})
	return out, err
}

func copyImages(assetDir, uploadDir string) error {
	target := filepath.Join(uploadDir, "curated-sa-experiences")
	if err := os.MkdirAll(target, 0755); err != nil {
		return err
	}
	for _, s := range seeds() {
		for _, p := range s.Products {
			for _, v := range p.Images {
				if filepath.Base(v.File) != v.File {
					return fmt.Errorf("invalid filename %s", v.File)
				}
				b, err := os.ReadFile(filepath.Join(assetDir, v.File))
				if err != nil {
					return err
				}
				if err = os.WriteFile(filepath.Join(target, v.File), b, 0644); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func categories(tx *gorm.DB) (map[string]productmodel.Category, error) {
	out := map[string]productmodel.Category{}
	for _, spec := range []productmodel.Category{{Slug: "dining", NameZh: "餐饮美食", NameEn: "Dining", Icon: "utensils", SortOrder: 8}, {Slug: "attractions", NameZh: "景点与体验", NameEn: "Attractions & Experiences", Icon: "ticket", SortOrder: 1}, {Slug: "accommodation", NameZh: "住宿", NameEn: "Accommodation", Icon: "🏨", SortOrder: 7}} {
		var x productmodel.Category
		err := tx.Where("slug = ?", spec.Slug).First(&x).Error
		if err == gorm.ErrRecordNotFound {
			err = tx.Create(&spec).Error
			x = spec
		}
		if err != nil {
			return nil, err
		}
		out[spec.Slug] = x
	}
	return out, nil
}
func upsertRegion(tx *gorm.DB, s supplierSeed) (*productmodel.Region, error) {
	var x productmodel.Region
	err := tx.Unscoped().Where("slug = ?", s.RegionSlug).First(&x).Error
	if err == nil {
		if x.DeletedAt.Valid {
			err = tx.Unscoped().Model(&x).Updates(map[string]interface{}{"deleted_at": nil, "name_zh": s.RegionZh, "name_en": s.RegionEn}).Error
		}
		return &x, err
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	x = productmodel.Region{Slug: s.RegionSlug, NameZh: s.RegionZh, NameEn: s.RegionEn, SortOrder: 10}
	return &x, tx.Create(&x).Error
}
func upsertSupplier(tx *gorm.DB, s supplierSeed) (*models.Supplier, error) {
	var x models.Supplier
	err := tx.Where("lower(name)=lower(?)", s.Name).First(&x).Error
	now := time.Now()
	fields := map[string]interface{}{"name": s.Name, "type": s.Type, "status": "approved", "description": s.Description, "email": s.Email, "phone": s.Phone, "website": s.Website, "address": s.Address, "city": s.City, "state": s.State, "postal_code": s.PostalCode, "country": "Australia", "approved_at": now}
	if err == nil {
		return &x, tx.Model(&x).Updates(fields).Error
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	x = models.Supplier{Name: s.Name, Type: s.Type, Status: "approved", Description: s.Description, Email: s.Email, Phone: s.Phone, Website: s.Website, Address: s.Address, City: s.City, State: s.State, PostalCode: s.PostalCode, Country: "Australia", ApprovedAt: &now}
	return &x, tx.Create(&x).Error
}
func upsertProduct(tx *gorm.DB, s supplierSeed, p productSeed, supplierID, regionID, categoryID uint) (*productmodel.Product, error) {
	tags, _ := json.Marshal([]string{s.RegionZh, p.CategorySlug, "热门体验"})
	meta, _ := json.Marshal(map[string]interface{}{"official_product_url": p.BookingURL, "image_sources": p.Images, "collected_at": time.Now().UTC().Format(time.RFC3339)})
	fields := map[string]interface{}{"name_zh": p.NameZh, "name_en": p.NameEn, "supplier_id": supplierID, "region_id": regionID, "category_id": categoryID, "status": productmodel.ProductStatusDraft, "price_from": p.Price, "currency": "AUD", "summary_zh": p.SummaryZh, "summary_en": p.SummaryEn, "description_zh": p.DescriptionZh, "description_en": p.DescriptionEn, "address_zh": p.Address, "address_en": p.Address, "duration": p.Duration, "group_size": p.GroupSize, "tags": string(tags), "metadata": meta, "created_via": "admin_proxy"}
	var x productmodel.Product
	err := tx.Where("supplier_id=? AND name_en=?", supplierID, p.NameEn).First(&x).Error
	if err == gorm.ErrRecordNotFound {
		x = productmodel.Product{NameZh: p.NameZh, NameEn: p.NameEn, SupplierID: supplierID, RegionID: regionID, CategoryID: categoryID, Status: productmodel.ProductStatusDraft, PriceFrom: p.Price, Currency: "AUD", SummaryZh: p.SummaryZh, SummaryEn: p.SummaryEn, DescriptionZh: p.DescriptionZh, DescriptionEn: p.DescriptionEn, AddressZh: p.Address, AddressEn: p.Address, Duration: p.Duration, GroupSize: p.GroupSize, Tags: string(tags), Metadata: meta, CreatedVia: "admin_proxy"}
		err = tx.Create(&x).Error
	} else if err == nil {
		err = tx.Model(&x).Updates(fields).Error
	}
	if err != nil {
		return nil, err
	}
	for _, m := range []interface{}{&productmodel.ProductImage{}, &productmodel.ProductPackage{}, &productmodel.ProductHighlight{}, &productmodel.ProductFAQ{}} {
		if err = tx.Unscoped().Where("product_id=?", x.ID).Delete(m).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.Images {
		if err = tx.Create(&productmodel.ProductImage{ProductID: x.ID, URL: "/uploads/curated-sa-experiences/" + v.File, IsCover: i == 0, SortOrder: i}).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.Packages {
		if err = tx.Create(&productmodel.ProductPackage{ProductID: x.ID, NameZh: v.NameZh, NameEn: v.NameEn, DescZh: v.DescZh, DescEn: v.DescEn, Price: v.Price, StockTotal: -1, SortOrder: i + 1}).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.Highlights {
		if err = tx.Create(&productmodel.ProductHighlight{ProductID: x.ID, TitleZh: v.TitleZh, TitleEn: v.TitleEn, DescZh: v.DescZh, DescEn: v.DescEn, SortOrder: i + 1}).Error; err != nil {
			return nil, err
		}
	}
	for i, v := range p.FAQs {
		if err = tx.Create(&productmodel.ProductFAQ{ProductID: x.ID, QuestionZh: v.QuestionZh, QuestionEn: v.QuestionEn, AnswerZh: v.AnswerZh, AnswerEn: v.AnswerEn, SortOrder: i + 1}).Error; err != nil {
			return nil, err
		}
	}
	return &x, nil
}

type rawProduct struct {
	nameZh, nameEn                                       string
	price                                                float64
	duration, group, category, summaryZh, summaryEn, url string
}
type rawSupplier struct {
	region, rzh, ren, name, typ, email, phone, site, address, city, state, post, desc string
	products                                                                          []rawProduct
}

func product(r rawProduct, address, source string, index *int) productSeed {
	*index++
	prefix := fmt.Sprintf("curated-%02d", *index)
	imgs := make([]imageSeed, 5)
	for i := range imgs {
		imgs[i] = imageSeed{fmt.Sprintf("%s-%d.jpg", prefix, i+1), imageSources[*index-1][i]}
	}
	dz := r.summaryZh + " 行程或餐饮内容会因日期、天气、季节与供应情况调整，预订确认时将列明最终包含项目、集合时间及适用条件。"
	de := r.summaryEn + " Itinerary or inclusions may vary with date, weather, season and availability. Final inclusions, meeting time and applicable conditions are provided at confirmation."
	return productSeed{NameZh: r.nameZh, NameEn: r.nameEn, Price: r.price, Duration: r.duration, GroupSize: r.group, CategorySlug: r.category, SummaryZh: r.summaryZh, SummaryEn: r.summaryEn, DescriptionZh: dz, DescriptionEn: de, Address: address, BookingURL: r.url, Images: imgs, Packages: []packageSeed{{r.nameZh, r.nameEn, r.summaryZh, r.summaryEn, r.price}}, Highlights: []highlightSeed{{"招牌体验", "Signature experience", "选择该场所具有代表性的热门产品。", "A popular product representative of the venue."}, {"本地特色", "Local character", r.summaryZh, r.summaryEn}}, FAQs: []faqSeed{{"需要提前预订吗？", "Is advance booking required?", "建议提前预订，热门日期可能售罄。", "Advance booking is recommended as popular dates may sell out."}, {"价格和行程会变化吗？", "Can rates or arrangements change?", "价格、开放时间及包含项目以预订确认时的信息为准。", "Rates, operating times and inclusions are subject to confirmation when booking."}}}
}

var imageSources = [17][5]string{
	{"https://starofgreece.com.au/wp-content/uploads/home-hero.jpg", "https://starofgreece.com.au/wp-content/uploads/home-parallax.jpg", "https://starofgreece.com.au/wp-content/uploads/home1.jpg", "https://starofgreece.com.au/wp-content/uploads/home2.jpg", "https://starofgreece.com.au/wp-content/uploads/home3.jpg"},
	{"https://assets.atdw-online.com.au/images/35248ff8dd0ac3f1eec1e9818d7c979c.jpeg", "https://assets.atdw-online.com.au/images/d4c3d62e8855d9f1bd1489f6f37815a1.jpeg", "https://assets.atdw-online.com.au/images/fc89438293221f312ba43a2911e16fab.jpeg", "https://assets.atdw-online.com.au/images/35248ff8dd0ac3f1eec1e9818d7c979c.jpeg?w=1600", "https://assets.atdw-online.com.au/images/d4c3d62e8855d9f1bd1489f6f37815a1.jpeg?w=1600"},
	{"https://ozonehotelki.com.au/wp-content/uploads/2025/02/aurora-ozone-hotel-kangaroo-dining-64.jpg", "https://ozonehotelki.com.au/wp-content/uploads/2025/02/aurora-ozone-hotel-kangaroo-dining-61-2048x1366.jpg", "https://ozonehotelki.com.au/wp-content/uploads/2025/02/aurora-ozone-hotel-kangaroo-dining-64-2048x1366.jpg", "https://ozonehotelki.com.au/wp-content/uploads/2025/02/aurora-ozone-hotel-kangaroo-dining-61-1536x1024.jpg", "https://ozonehotelki.com.au/wp-content/uploads/2025/02/aurora-ozone-hotel-kangaroo-dining-64-1536x1024.jpg"},
	{"https://assets.atdw-online.com.au/images/01b11a5f5c0ce047926011a143afff05.jpeg", "https://assets.atdw-online.com.au/images/3b0a558bbacfe06d22476b26d5015f88.jpeg", "https://assets.atdw-online.com.au/images/6e0d1e20f5e5699c01113250da3d6869.jpeg", "https://assets.atdw-online.com.au/images/cacc25fcf9481f9239a84b10430bd672.jpeg", "https://assets.atdw-online.com.au/images/01b11a5f5c0ce047926011a143afff05.jpeg?w=1600"},
	{"https://www.barn.com.au/wp-content/uploads/2017/07/20170413-DSC_3333-768x512.jpg", "https://www.barn.com.au/wp-content/uploads/2017/07/20170413-DSC_3334-768x512.jpg", "https://www.barn.com.au/wp-content/uploads/2017/07/20170413-DSC_3348-768x512.jpg", "https://www.barn.com.au/wp-content/uploads/2017/07/20170413-DSC_3378-768x512.jpg", "https://www.barn.com.au/wp-content/uploads/2017/07/20170413-DSC_3414-768x512.jpg"},
	{"https://assets.atdw-online.com.au/images/2d6c7e525b78557041023929d1daa2b0.jpeg", "https://assets.atdw-online.com.au/images/95c64133cd8f5f8fd6d1bf1bfc6c80d2.jpeg", "https://assets.atdw-online.com.au/images/a865a4f56080c6c9fa3aab5dcc871abd.jpeg", "https://assets.atdw-online.com.au/images/c658de41318e2c743bde1021e5bda5c9.jpeg", "https://assets.atdw-online.com.au/images/2d6c7e525b78557041023929d1daa2b0.jpeg?w=1600"},
	{"https://account.ayersrockresort.com.au/sites/default/files/2025-05/terrace_room_1_king_bed_1219_5.jpg", "https://www.voyages.com.au/sites/default/files/styles/1290x720/public/2020-09/UKTNP_ULURU_TA_49%201.jpg", "https://account.ayersrockresort.com.au/sites/default/files/2025-08/ww_updated_hero_-ready.jpg", "https://account.ayersrockresort.com.au/sites/default/files/2025-05/terrace_room_1_king_bed_1219_5.jpg?x=1", "https://www.voyages.com.au/sites/default/files/styles/1290x720/public/2020-09/UKTNP_ULURU_TA_49%201.jpg?x=1"},
	{"https://account.ayersrockresort.com.au/sites/default/files/2025-05/321_-_deluxe_rock_view_room_-_two_double_beds_11.jpg", "https://www.voyages.com.au/sites/default/files/styles/1290x720/public/2020-09/UKTNP_ULURU_TA_49%201.jpg", "https://account.ayersrockresort.com.au/sites/default/files/2025-08/ww_updated_hero_-ready.jpg", "https://account.ayersrockresort.com.au/sites/default/files/2025-05/321_-_deluxe_rock_view_room_-_two_double_beds_11.jpg?x=1", "https://www.voyages.com.au/sites/default/files/styles/1290x720/public/2020-09/UKTNP_ULURU_TA_49%201.jpg?x=2"},
	{"https://account.ayersrockresort.com.au/sites/default/files/2025-05/arr_outback_hotel_standard_room.jpg", "https://www.voyages.com.au/sites/default/files/styles/1290x720/public/2020-09/UKTNP_ULURU_TA_49%201.jpg", "https://account.ayersrockresort.com.au/sites/default/files/2025-08/ww_updated_hero_-ready.jpg", "https://account.ayersrockresort.com.au/sites/default/files/2025-05/arr_outback_hotel_standard_room.jpg?x=1", "https://www.voyages.com.au/sites/default/files/styles/1290x720/public/2020-09/UKTNP_ULURU_TA_49%201.jpg?x=3"},
	{"https://images.squarespace-cdn.com/content/v1/6a34c861611f20689566ec08/254fcb54-225b-42fa-802b-239e6a956a23/KOALA+CABINS-WEB+RES-18.jpg", "https://images.squarespace-cdn.com/content/v1/6a34c861611f20689566ec08/1a46a6b9-ce56-46e0-9b5c-a2d14211adfa/20250705_095422%280%29.jpg", "https://images.squarespace-cdn.com/content/v1/6a34c861611f20689566ec08/333ee163-4feb-46d1-a259-2b678c701134/openart-562b9827-3469-4c51-99df-3e8bd766474e.png", "https://images.squarespace-cdn.com/content/v1/6a34c861611f20689566ec08/254fcb54-225b-42fa-802b-239e6a956a23/KOALA+CABINS-WEB+RES-18.jpg?format=1500w", "https://images.squarespace-cdn.com/content/v1/6a34c861611f20689566ec08/1a46a6b9-ce56-46e0-9b5c-a2d14211adfa/20250705_095422%280%29.jpg?format=1500w"},
	{"https://assets.atdw-online.com.au/images/14d4db6d5833e1c6e0adf44ac17b7802.jpeg", "https://assets.atdw-online.com.au/images/2947900ab40a3c42c22f82bc1bfa4ca6.jpeg", "https://assets.atdw-online.com.au/images/4be97367a66594c39456299cdbfa841d.jpeg", "https://assets.atdw-online.com.au/images/8823d93dd2f83f12a6f0f41074da74bd.jpeg", "https://assets.atdw-online.com.au/images/aa703891a0d0e0732af7c53ba2caee0b.jpeg"},
	{"https://dolphinsanctuarykayaktours.com.au/wp-content/uploads/2019/12/info1.jpg", "https://dolphinsanctuarykayaktours.com.au/wp-content/uploads/2019/12/cta2.jpg", "https://dolphinsanctuarykayaktours.com.au/wp-content/uploads/2019/12/cta5-1.jpg", "https://dolphinsanctuarykayaktours.com.au/wp-content/uploads/2019/12/info1-1024x664.jpg", "https://dolphinsanctuarykayaktours.com.au/wp-content/uploads/2019/12/info1-768x498.jpg"},
	{"https://apimedia.tfehotels.com/media-green/filer_public/a3/ac/a3acf8aa-5246-4ad0-8fb9-0b2df93651f0/adina-apartment-hotel-adelaide-exterior-03-2018-2.jpg", "https://apimedia.tfehotels.com/media-green/optimized/01/68/0168d79a-0d7b-4859-b5e3-355811eab074/adina-apartment-hotel-adelaide-entrance-01-2018-1024w.jpg", "https://apimedia.tfehotels.com/media-green/optimized/01/68/0168d79a-0d7b-4859-b5e3-355811eab074/adina-apartment-hotel-adelaide-entrance-01-2018-1216w.jpg", "https://apimedia.tfehotels.com/media-green/optimized/01/68/0168d79a-0d7b-4859-b5e3-355811eab074/adina-apartment-hotel-adelaide-entrance-01-2018-1408w.jpg", "https://apimedia.tfehotels.com/media-green/optimized/01/68/0168d79a-0d7b-4859-b5e3-355811eab074/adina-apartment-hotel-adelaide-entrance-01-2018-1500w.jpg"},
	{"https://static.wixstatic.com/media/205ae0_e79287dad9da460db0bb427afacb5f6d~mv2_d_5184_3456_s_4_2.jpeg/v1/crop/x_170,y_0,w_4844,h_3456/fill/w_1326,h_946,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/stonegrill_JPEG.jpeg", "https://static.wixstatic.com/media/205ae0_42c9149682f3419b9219de2a6cb8e74d~mv2_d_6000_4000_s_4_2.jpeg/v1/crop/x_197,y_0,w_5607,h_4000/fill/w_1326,h_946,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/E38BF211-5430-4871-9C9F-97BD3CEADF6F_JPEG.jpeg", "https://static.wixstatic.com/media/205ae0_e7f8e63aee7d4187bbe5d11fd109c697~mv2_d_4000_6000_s_4_2.jpeg/v1/crop/x_0,y_2478,w_4000,h_2852/fill/w_1326,h_946,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/24384DAA-1E6A-476C-9328-ED120B76D55D_JPEG.jpeg", "https://static.wixstatic.com/media/80f2d2_732ec26fb3044a8aa46f32ff0e96415c~mv2.jpeg/v1/crop/x_111,y_1385,w_2800,h_1997/fill/w_1326,h_946,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/IMG_0776.jpeg", "https://static.wixstatic.com/media/80f2d2_a5e68eea1ea1461b9747841e33279fc8~mv2.jpg/v1/crop/x_0,y_365,w_1179,h_841/fill/w_1179,h_841,al_c,q_85,enc_avif,quality_auto/IMG_9460.jpg"},
	{"https://shop.thebend.com.au/cdn/shop/files/Shopify-Merch-Hotlaps-graphics-Mustang.jpg", "https://shop.thebend.com.au/cdn/shop/files/Mustang-1_24deed4e-82a3-4f14-850c-5d065786b82a.jpg", "https://shop.thebend.com.au/cdn/shop/files/Mustang-2.jpg", "https://shop.thebend.com.au/cdn/shop/files/Experiences-1.jpg", "https://shop.thebend.com.au/cdn/shop/files/Shopify-Merch-Drive-graphics-Mustang.jpg"},
	{"https://assets.atdw-online.com.au/images/7fc28d8a9e3c84cbe5e7754b6d2980f1.jpeg", "https://assets.atdw-online.com.au/images/9d0b832c09a4eabcfdb35d6da381f8e7.jpeg", "https://assets.atdw-online.com.au/images/ba2cdfdb86c8bdac80cc0289c9cdd860.jpeg", "https://assets.atdw-online.com.au/images/cea818e8c48fe09c11bcadaf84e3d18d.jpeg", "https://www.jugglehouse.com.au/wp-content/uploads/2026/06/Home-Page-Tile-Stargazing-Generic.jpg"},
	{"https://i0.wp.com/rotor-sport.com.au/wp-content/uploads/2024/02/Gyroplane-Training-1.png?w=526&ssl=1", "https://i0.wp.com/rotor-sport.com.au/wp-content/uploads/2024/02/Eclipse-Gyroplane.png?w=515&ssl=1", "https://i0.wp.com/rotor-sport.com.au/wp-content/uploads/2023/12/combo-flight.jpg?resize=450%2C397&ssl=1", "https://i0.wp.com/rotor-sport.com.au/wp-content/uploads/2024/02/Aircraft-Controls-Rotor-Sport-Flight-Training.png?fit=707%2C397&ssl=1", "https://i0.wp.com/rotor-sport.com.au/wp-content/uploads/2024/02/Gyroplane-Training-1.png?resize=450%2C492&ssl=1"},
}

func seeds() []supplierSeed {
	raws := []rawSupplier{
		{"fleurieu", "菲尔半岛", "Fleurieu Peninsula", "Star of Greece", "restaurant", "info@starofgreece.com.au", "08 8557 7420", "https://starofgreece.com.au/", "1 Esplanade", "Port Willunga", "SA", "5173", "Clifftop restaurant focused on fresh local produce, seafood and Fleurieu wines.", []rawProduct{{"Star of Greece 主厨分享菜单加甜点", "Star of Greece Chef's Menu with Dessert", 109, "2.5 hours", "10+ guests", "dining", "在 Port Willunga 悬崖海景餐厅享用以本地海鲜与当季食材制作的分享菜单及甜点。", "A shared chef's menu and dessert showcasing local seafood and seasonal produce above Port Willunga beach.", "https://starofgreece.com.au/functions/"}}},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "SeaLink Kangaroo Island", "travel_agency", "bookings@sealink.com.au", "13 13 01", "https://www.sealink.com.au/kangaroo-island/", "Level 3, 26 Flinders Street", "Adelaide", "SA", "5000", "Ferry, coach touring and holiday packages connecting visitors with Kangaroo Island.", []rawProduct{{"SeaLink 袋鼠岛精华一日游", "SeaLink Kangaroo Island Experience Day Tour", 237, "16 hours", "1-48", "attractions", "乘渡轮与豪华巴士探索 Seal Bay、Remarkable Rocks、Admirals Arch 和岛上野生动物。", "Travel by ferry and coach to Seal Bay, Remarkable Rocks, Admirals Arch and signature island wildlife stops.", "https://www.sealink.com.au/kangaroo-island/things-to-do/heres-the-best-way-to-explore-kangaroo-island-in-a-day/"}}},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Aurora Ozone Hotel Kangaroo Island", "restaurant", "reservations@ozonehotelki.com.au", "08 8553 2011", "https://ozonehotelki.com.au/", "67 Chapman Terrace", "Kingscote", "SA", "5223", "Waterfront Kingscote hotel with Parsons Restaurant overlooking Nepean Bay.", []rawProduct{{"Parsons Restaurant 袋鼠岛海鲜晚餐", "Parsons Restaurant Kangaroo Island Seafood Dinner", 49, "2 hours", "1-10", "dining", "面向 Nepean Bay 的海滨餐厅，以新鲜海鲜和袋鼠岛本地农产为主。", "Waterfront dining over Nepean Bay focused on fresh seafood and locally sourced Kangaroo Island produce.", "https://ozonehotelki.com.au/parsons-restaurant-kingscote-ki/"}}},
		{"limestone-coast", "石灰岩海岸", "Limestone Coast", "Naracoorte Caves National Park", "attraction", "naracoortecaves@sa.gov.au", "08 8760 1210", "https://www.naracoortecaves.sa.gov.au/", "89 Wonambi Road", "Naracoorte", "SA", "5271", "World Heritage cave system preserving an outstanding fossil record of Australia's megafauna.", []rawProduct{{"Victoria Fossil Cave 世界遗产导览", "Victoria Fossil Cave Guided Tour", 40.5, "1 hour", "1-20", "attractions", "穿越钟乳石洞室抵达化石厅，了解巨型动物骨骼、发掘方法与世界遗产价值。", "Walk through decorated chambers to the Fossil Chamber and discover megafauna, excavation and World Heritage science.", "https://www.naracoortecaves.sa.gov.au/discover/under-the-ground/victoria-fossil-cave"}}},
		{"limestone-coast", "石灰岩海岸", "Limestone Coast", "The Barn Accommodation", "hotel", "info@barn.com.au", "08 8726 9999", "https://www.barn.com.au/", "747 Glenelg River Road", "OB Flat", "SA", "5290", "Country accommodation in five acres of landscaped gardens near Mount Gambier.", []rawProduct{{"The Barn Premier King Spa Suite", "The Barn Premier King Suite with Spa", 350, "1 night", "up to 3 guests", "accommodation", "入住 43–48 平方米开放式套房，享用特大床、私人露台及双人转角按摩浴缸。", "Stay in a 43–48 square metre open-plan suite with king bed, private patio and two-person corner spa.", "https://www.barn.com.au/"}}},
		{"limestone-coast", "石灰岩海岸", "Limestone Coast", "Mayura Station", "restaurant", "wagyusteakhouse@mayurastation.com", "04 2728 4775", "https://www.mayurastation.com/", "941 Canunda Frontage Road", "Millicent", "SA", "5280", "Award-winning full-blood Wagyu producer and intimate farm-based steakhouse.", []rawProduct{{"Mayura Station 四道式和牛主厨餐桌", "Mayura Station Four-Course Wagyu Chef's Table", 160, "3 hours", "2-16", "dining", "在开放式烤台前体验四道式全血和牛菜单，由主厨介绍不同部位与烹饪方式。", "A four-course full-blood Wagyu menu at the open grill, with the chef presenting cuts and cooking styles.", "https://www.mayurastation.com/media-kit/tasting-room/"}}},
		{"uluru", "乌鲁鲁", "Uluru", "Ayers Rock Resort", "hotel", "reservations@voyages.com.au", "1300 134 044", "https://www.ayersrockresort.com.au/", "Yulara Drive", "Yulara", "NT", "0872", "A collection of hotels and experiences near Uluru-Kata Tjuta National Park.", []rawProduct{{"Sails in the Desert 五星露台房", "Sails in the Desert 5-Star Terrace Room", 590, "1 night", "2 guests", "accommodation", "五星级沙漠度假酒店露台房，以原住民艺术、精致空间与每日早餐呈现高端红土中心体验。", "A five-star terrace room combining Indigenous art, refined comfort and daily breakfast in the Red Centre.", "https://www.ayersrockresort.com.au/accommodation/sails-in-the-desert"}, {"Desert Gardens 4.5 星岩景豪华房", "Desert Gardens 4.5-Star Deluxe Rock View Room", 530, "1 night", "2 guests", "accommodation", "入住度假村内可从客房欣赏乌鲁鲁景观的 4.5 星豪华岩景房。", "Stay in a 4.5-star deluxe room offering the resort's distinctive in-room view towards Uluru.", "https://www.ayersrockresort.com.au/accommodation/desert-gardens-hotel"}, {"Outback Hotel 3.5 星标准房", "Outback Hotel 3.5-Star Standard Room", 300, "1 night", "2 guests", "accommodation", "以轻松澳洲内陆氛围、实用舒适设施和度假村服务满足高性价比住宿需求。", "A relaxed 3.5-star room combining practical comfort, Outback character and access to resort amenities.", "https://www.ayersrockresort.com.au/accommodation/outback-hotel"}}},
		{"kangaroo-island", "袋鼠岛", "Kangaroo Island", "Kangaroo Island Wildlife Park", "attraction", "info@kangarooislandwildlifepark.com", "04 3933 3430", "https://kangarooislandwildlifepark.com/", "3115 South Coast Road", "Seal Bay", "SA", "5223", "Family wildlife park and rescue centre on Kangaroo Island's south coast.", []rawProduct{{"袋鼠岛野生动物公园考拉体验", "Kangaroo Island Wildlife Park and Koala Experience", 60, "3 hours", "1-10", "attractions", "参观南岸野生动物园，近距离认识考拉、袋鼠、澳洲野生动物与救护保育工作。", "Visit the south-coast wildlife park for close encounters with koalas, kangaroos and Australian wildlife conservation.", "https://kangarooislandwildlifepark.com/"}}},
		{"adelaide", "阿德莱德", "Adelaide", "Port River Cruises", "attraction", "info@portrivercruises.com.au", "08 7082 9608", "https://portrivercruises.com.au/", "1 McLaren Wharf", "Port Adelaide", "SA", "5015", "Guided small-group marine cruises through the Adelaide Dolphin Sanctuary and Port River.", []rawProduct{{"两小时海豚与海事巡航", "2-Hour Dolphin and Maritime Cruise", 75, "2 hours", "1-32", "attractions", "沿 Port River 探索海豚保护区、海事历史、红树林生态与船舶遗迹。", "Cruise the Port River through dolphin habitat, maritime landmarks, ancient mangroves and shipwreck history.", "https://portrivercruises.com.au/"}}},
		{"adelaide", "阿德莱德", "Adelaide", "Dolphin Sanctuary Kayak Tours", "attraction", "info@dolphinkayak.com.au", "04 1902 2354", "https://dolphinsanctuarykayaktours.com.au/", "Lot 204 Garden Island Road", "Port Adelaide", "SA", "5015", "Guided eco-kayak tours through Garden Island mangroves, dolphin habitat and shipwrecks.", []rawProduct{{"阿德莱德海豚保护区双人皮划艇导览", "Adelaide Dolphin Sanctuary Guided Double Kayak Tour", 80, "up to 3 hours", "2 guests", "attractions", "在海洋生物向导带领下划入万年红树林水道，探索海豚栖息地与沉船遗迹。", "Paddle with a marine-life guide through ancient mangrove creeks, dolphin habitat and shipwreck sites.", "https://dolphinsanctuarykayaktours.com.au/"}}},
		{"adelaide", "阿德莱德", "Adelaide", "Adina Apartment Hotel Adelaide Treasury", "hotel", "adelaide@adina.com.au", "08 8112 0000", "https://adinahotels.com/en/apartments/adelaide-treasury/", "2 Flinders Street", "Adelaide", "SA", "5000", "Heritage apartment hotel overlooking Victoria Square in Adelaide CBD.", []rawProduct{{"Adina Treasury Premier Grand 两卧室公寓", "Adina Treasury Premier Grand Two-Bedroom Apartment", 223, "1 night", "4-5 guests", "accommodation", "入住 82 平方米历史建筑公寓，设两间卧室、两间浴室、厨房和宽敞起居空间。", "An 82-square-metre heritage apartment with two bedrooms, two bathrooms, kitchen and generous living space.", "https://adinahotels.com/en/apartments/adelaide-treasury/"}}},
		{"barossa", "巴罗莎谷", "Barossa Valley", "Kingsford Hotel", "restaurant", "functions@kingsfordhotel.com.au", "08 8522 1687", "https://www.kingsfordhotel.com.au/", "32 Murray Street", "Gawler", "SA", "5118", "Historic Gawler hotel known for pub dining, live entertainment and stone-grill steaks.", []rawProduct{{"Kingsford Stonegrill Surf & Turf", "Kingsford Stonegrill Surf and Turf", 52, "1.5 hours", "1 guest", "dining", "在 400°C 火山石上按个人喜好烹制牛排，搭配南澳大虾、薯条、蔬菜与奶油蒜香酱。", "Cook steak to your liking on a 400°C volcanic stone, served with South Australian prawns, chips, vegetables and garlic cream sauce.", "https://www.kingsfordhotel.com.au/eat"}}},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "The Bend Motorsport Park", "attraction", "experiences@thebend.com.au", "08 8165 5700", "https://www.thebend.com.au/", "543 Dukes Highway", "Tailem Bend", "SA", "5260", "World-class motorsport precinct offering circuit events, track rides and driving experiences.", []rawProduct{{"The Bend V8 Mustang 极速乘坐体验", "The Bend V8 Mustang Hot Lap Experience", 199, "3 laps", "1 passenger", "attractions", "由专业赛车手驾驶赛道化 V8 Mustang，完成三圈高速赛道乘坐体验，无需驾照。", "Ride three high-speed circuit laps beside a professional driver in a track-prepared V8 Mustang; no licence required.", "https://shop.thebend.com.au/pages/experience-builder"}}},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Juggle House Experiences", "travel_agency", "bookings@jugglehouse.com.au", "04 8004 3778", "https://www.jugglehouse.com.au/", "4 Randell Street", "Mannum", "SA", "5238", "Award-winning hosted tours across the Murraylands and River Murray International Dark Sky Reserve.", []rawProduct{{"Dark Sky Gold Stars 日落晚餐与观星", "Dark Sky Gold Stars Sunset Dinner and Stargazing", 299, "6 hours", "1-10", "attractions", "从 Mannum 出发，结合河畔晚餐、暗夜保护区交通与天文学家带领的望远镜观星。", "Depart Mannum for dinner, hosted Dark Sky Reserve transport and telescope stargazing with an astronomer.", "https://www.rivermurraydarkskytours.com.au/"}}},
		{"murray", "墨累河", "Murray River, Lakes and Coorong", "Rotor-Sport Australia", "attraction", "info@rotor-sport.com.au", "04 0880 0154", "https://rotor-sport.com.au/", "214 Pallamana Road", "Pallamana", "SA", "5254", "Gyroplane and fixed-wing flight school offering hands-on aviation experiences in the Murraylands.", []rawProduct{{"Rotor-Sport 30 分钟旋翼机飞行", "Rotor-Sport 30-Minute Gyroplane Flight", 195, "30 minutes", "1 participant", "attractions", "在教练陪同下体验旋翼机起飞、空中操控与降落，俯瞰 Murraylands 开阔景观。", "Take off, fly and land with an instructor in a hands-on gyroplane experience over the Murraylands.", "https://rotor-sport.com.au/"}}},
	}
	out := make([]supplierSeed, 0, len(raws))
	idx := 0
	for _, r := range raws {
		address := r.address + ", " + r.city + " " + r.state + " " + r.post
		s := supplierSeed{RegionSlug: r.region, RegionZh: r.rzh, RegionEn: r.ren, Name: r.name, Type: r.typ, Email: r.email, Phone: r.phone, Website: r.site, Address: r.address, City: r.city, State: r.state, PostalCode: r.post, Description: r.desc}
		for _, p := range r.products {
			s.Products = append(s.Products, product(p, address, p.url, &idx))
		}
		out = append(out, s)
	}
	return out
}
