package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestSeedsContainFourEntriesPerRegion(t *testing.T) {
	want := map[string][]string{
		"adelaide-hills":                 {"Hardy's Verandah Restaurant", "The Stirling Hotel", "Red Cacao", "Haus Restaurant"},
		"kangaroo-island":                {"The Islander Estate Vineyards", "Bay of Shoals Estate", "Dudley Wines", "Springs Road Kangaroo Island"},
		"fleurieu-peninsula":             {"The d'Arenberg Cube", "Down The Rabbit Hole Cellar Door and Restaurant", "Anvers Wines - Cellar Door", "Coriole Vineyards Cellar Door and Restaurant"},
		"murray-river-lakes-and-coorong": {"Cafe Mannum", "Mannum Hotel", "Steam Dock Eatery", "Pretoria Hotel"},
	}
	got := seeds()
	if len(got) != 16 {
		t.Fatalf("seed count = %d, want 16", len(got))
	}
	for region, names := range want {
		var actual []string
		for _, seed := range got {
			if seed.RegionSlug == region {
				actual = append(actual, seed.Name)
			}
		}
		if strings.Join(actual, "|") != strings.Join(names, "|") {
			t.Errorf("%s = %v, want %v", region, actual, names)
		}
	}
}

func TestProductsMeetAdminDraftRequirements(t *testing.T) {
	for _, seed := range seeds() {
		p := seed.Product
		if seed.Email == "" || seed.Phone == "" || seed.Website == "" || seed.Address == "" || seed.City == "" || seed.PostalCode == "" || seed.Description == "" {
			t.Errorf("supplier %s incomplete", seed.Name)
		}
		if p.NameZh == "" || p.NameEn == "" || p.Price <= 0 || p.SummaryZh == "" || p.SummaryEn == "" || p.DescriptionZh == "" || p.DescriptionEn == "" || p.BookingURL == "" {
			t.Errorf("product for %s incomplete", seed.Name)
		}
		if len(p.Packages) < 1 || len(p.Highlights) < 2 || len(p.FAQs) < 2 || len(p.Images) != 5 {
			t.Errorf("product %s requires packages, 2 highlights, 2 FAQs and exactly 5 images", p.NameEn)
		}
		for _, image := range p.Images {
			if image.SourceURL == "" {
				t.Errorf("%s image source missing", p.NameEn)
			}
			if matches, _ := filepath.Glob(filepath.Join("..", "..", "assets", "regional-food-drink", image.File)); len(matches) != 1 {
				t.Errorf("asset missing: %s", image.File)
			}
		}
	}
}

func TestCustomerCopyHasNoInternalNotes(t *testing.T) {
	forbidden := []string{"官网", "抓取", "草稿", "运营", "复核", "official site", "draft", "operator review"}
	for _, seed := range seeds() {
		p := seed.Product
		copy := strings.ToLower(strings.Join([]string{p.NameZh, p.NameEn, p.SummaryZh, p.SummaryEn, p.DescriptionZh, p.DescriptionEn}, " "))
		for _, phrase := range forbidden {
			if strings.Contains(copy, phrase) {
				t.Errorf("%s contains %q", p.NameEn, phrase)
			}
		}
	}
}
