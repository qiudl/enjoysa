package main

import (
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	productmodel "enjoysa-backend/internal/product/model"
)

func TestRequirementProvenanceUsesCurrentRequirement(t *testing.T) {
	if requirementID != "REQ-20260811-0049" {
		t.Fatalf("requirementID = %q, want REQ-20260811-0049", requirementID)
	}
}

func TestFineDiningImportsOnlyContainRetainedDraftProducts(t *testing.T) {
	want := []struct {
		id   uint
		name string
	}{
		{39, "Restaurant Botanic Dining Experience"},
		{42, "Restaurant Botanic Chef's Table Degustation"},
		{40, "Magill Estate Restaurant Signature Menu"},
		{45, "Magill Estate Restaurant Lunch Tasting Menu"},
		{47, "OZIN Chef's Selection Tasting Menu"},
	}

	var got []struct {
		id   uint
		name string
	}
	for _, record := range fineDiningImports() {
		for _, product := range record.Products {
			got = append(got, struct {
				id   uint
				name string
			}{product.ProductID, product.NameEn})
		}
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("import scope mismatch\n got: %q\nwant: %q", got, want)
	}
}

func TestProductUpdatesDoNotOverwriteOperationalFields(t *testing.T) {
	seed := fineDiningImports()[0].Products[0]
	updates, err := productUpdates(seed, 34, 1, 4)
	if err != nil {
		t.Fatal(err)
	}

	required := []string{"name_zh", "name_en", "supplier_id", "region_id", "category_id", "status", "price_from", "currency", "summary_zh", "summary_en", "description_zh", "description_en", "address_zh", "address_en", "duration", "group_size", "tags", "metadata", "created_via"}
	for _, field := range required {
		if _, ok := updates[field]; !ok {
			t.Errorf("required field %q missing", field)
		}
	}

	for _, field := range []string{"rating", "review_count", "is_featured", "sort_order", "octo_enabled", "octo_synced_at", "created_by_admin_id", "auto_generated_en", "manual_override_en", "auto_generated_zh", "manual_override_zh"} {
		if _, ok := updates[field]; ok {
			t.Errorf("operational field %q must not be overwritten", field)
		}
	}
	if got := updates["status"]; got != productmodel.ProductStatusDraft {
		t.Errorf("status = %v, want draft", got)
	}
}

func TestRetainedDraftProductsHaveBundledCoverImages(t *testing.T) {
	for _, record := range fineDiningImports() {
		for _, product := range record.Products {
			if product.ImageFile == "" {
				t.Errorf("%s has no bundled cover image", product.NameEn)
				continue
			}
			if matches, err := filepath.Glob(filepath.Join("..", "..", "assets", "fine-dining", product.ImageFile)); err != nil || len(matches) != 1 {
				t.Errorf("%s cover image %q not found", product.NameEn, product.ImageFile)
			}
		}
	}
}

func TestRetainedProductsHaveAtLeastTwoOfficialGalleryImages(t *testing.T) {
	for _, record := range fineDiningImports() {
		for _, product := range record.Products {
			if len(product.OfficialImages) < 2 {
				t.Errorf("%s has %d official images, want at least 2", product.NameEn, len(product.OfficialImages))
			}
			for _, image := range product.OfficialImages {
				if image.File == "" || image.SourceURL == "" {
					t.Errorf("%s has incomplete official image provenance", product.NameEn)
				}
				if matches, err := filepath.Glob(filepath.Join("..", "..", "assets", "fine-dining", image.File)); err != nil || len(matches) != 1 {
					t.Errorf("%s official image %q not found", product.NameEn, image.File)
				}
			}
		}
	}
}

func TestCustomerDescriptionsExcludeInternalOperationalCopy(t *testing.T) {
	internalPhrases := []string{
		"草稿", "运营复核", "后台代录", "再上架", "后上架",
		"admin-created draft", "this draft", "review before publishing", "operational review",
	}
	for _, record := range fineDiningImports() {
		for _, product := range record.Products {
			for _, description := range []string{product.DescriptionZh, product.DescriptionEn} {
				lower := strings.ToLower(description)
				for _, phrase := range internalPhrases {
					if strings.Contains(lower, strings.ToLower(phrase)) {
						t.Errorf("%s customer description contains internal phrase %q", product.NameEn, phrase)
					}
				}
			}
		}
	}
}
