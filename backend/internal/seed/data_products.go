package seed

import (
	"fmt"

	productmodel "enjoysa-backend/internal/product/model"
	"enjoysa-backend/internal/models"
)

// productDef holds all data needed to seed one product + its related records.
type productDef struct {
	nameZh, nameEn       string
	supplierIdx          int // index into sorted approved suppliers
	regionSlug           string
	categorySlug         string
	status               productmodel.ProductStatus
	priceFrom            float64
	summaryZh, summaryEn string
	descZh, descEn       string
	addressZh, addressEn string
	duration, groupSize  string
	tags                 string
	isFeatured           bool
	// packages [2]
	pkgNames   [2][2]string // [i][zh,en]
	pkgDescs   [2][2]string
	pkgPrices  [2]float64
	// highlights [2]
	hlTitles [2][2]string
	hlDescs  [2][2]string
	// faqs [2] (second may be empty)
	faqQ [2][2]string
	faqA [2][2]string
}

func (s *Seeder) seedProducts() error {
	// ── Load suppliers, regions, categories ──
	var suppliers []models.Supplier
	if err := s.db.Where("status = ?", "approved").Order("id ASC").Find(&suppliers).Error; err != nil {
		return fmt.Errorf("query suppliers: %w", err)
	}
	if len(suppliers) == 0 {
		return fmt.Errorf("no approved suppliers found – seed suppliers first")
	}

	var regions []productmodel.Region
	if err := s.db.Find(&regions).Error; err != nil {
		return err
	}
	regionBySlug := make(map[string]uint)
	for _, r := range regions {
		regionBySlug[r.Slug] = r.ID
	}

	var categories []productmodel.Category
	if err := s.db.Find(&categories).Error; err != nil {
		return err
	}
	catBySlug := make(map[string]uint)
	for _, c := range categories {
		catBySlug[c.Slug] = c.ID
	}

	defs := allProductDefs()

	var (
		allProducts   []productmodel.Product
		allImages     []productmodel.ProductImage
		allPackages   []productmodel.ProductPackage
		allHighlights []productmodel.ProductHighlight
		allFAQs       []productmodel.ProductFAQ
	)

	for _, d := range defs {
		supIdx := d.supplierIdx
		if supIdx >= len(suppliers) {
			supIdx = supIdx % len(suppliers)
		}
		sup := suppliers[supIdx]

		p := productmodel.Product{
			NameZh:        d.nameZh,
			NameEn:        d.nameEn,
			SupplierID:    sup.ID,
			RegionID:      regionBySlug[d.regionSlug],
			CategoryID:    catBySlug[d.categorySlug],
			Status:        d.status,
			PriceFrom:     d.priceFrom,
			SummaryZh:     d.summaryZh,
			SummaryEn:     d.summaryEn,
			DescriptionZh: d.descZh,
			DescriptionEn: d.descEn,
			AddressZh:     d.addressZh,
			AddressEn:     d.addressEn,
			Duration:      d.duration,
			GroupSize:     d.groupSize,
			Tags:          d.tags,
			IsFeatured:    d.isFeatured,
		}

		if err := s.db.Create(&p).Error; err != nil {
			return fmt.Errorf("create product %s: %w", d.nameEn, err)
		}
		allProducts = append(allProducts, p)

		// Images (3 per product)
		pidx := len(allProducts) - 1
		for j := 0; j < 3; j++ {
			allImages = append(allImages, productmodel.ProductImage{
				ProductID: p.ID,
				URL:       productImage(d.supplierIdx, pidx, j),
				SortOrder: j + 1,
				IsCover:   j == 0,
			})
		}

		// Packages (2 per product)
		for j := 0; j < 2; j++ {
			allPackages = append(allPackages, productmodel.ProductPackage{
				ProductID: p.ID,
				NameZh:    d.pkgNames[j][0],
				NameEn:    d.pkgNames[j][1],
				DescZh:    d.pkgDescs[j][0],
				DescEn:    d.pkgDescs[j][1],
				Price:     d.pkgPrices[j],
				SortOrder: j + 1,
			})
		}

		// Highlights (2 per product)
		for j := 0; j < 2; j++ {
			allHighlights = append(allHighlights, productmodel.ProductHighlight{
				ProductID: p.ID,
				TitleZh:   d.hlTitles[j][0],
				TitleEn:   d.hlTitles[j][1],
				DescZh:    d.hlDescs[j][0],
				DescEn:    d.hlDescs[j][1],
				SortOrder: j + 1,
			})
		}

		// FAQs (1-2 per product)
		for j := 0; j < 2; j++ {
			if d.faqQ[j][0] == "" {
				break
			}
			allFAQs = append(allFAQs, productmodel.ProductFAQ{
				ProductID:  p.ID,
				QuestionZh: d.faqQ[j][0],
				QuestionEn: d.faqQ[j][1],
				AnswerZh:   d.faqA[j][0],
				AnswerEn:   d.faqA[j][1],
				SortOrder:  j + 1,
			})
		}
	}

	// Batch insert related records
	if err := s.db.CreateInBatches(allImages, 100).Error; err != nil {
		return fmt.Errorf("batch insert images: %w", err)
	}
	if err := s.db.CreateInBatches(allPackages, 100).Error; err != nil {
		return fmt.Errorf("batch insert packages: %w", err)
	}
	if err := s.db.CreateInBatches(allHighlights, 100).Error; err != nil {
		return fmt.Errorf("batch insert highlights: %w", err)
	}
	if err := s.db.CreateInBatches(allFAQs, 100).Error; err != nil {
		return fmt.Errorf("batch insert faqs: %w", err)
	}

	s.record("products", len(allProducts))
	s.record("product_images", len(allImages))
	s.record("product_packages", len(allPackages))
	s.record("product_highlights", len(allHighlights))
	s.record("product_faqs", len(allFAQs))
	return nil
}
