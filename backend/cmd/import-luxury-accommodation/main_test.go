package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestFourHighestPricedPropertiesPerRegion(t *testing.T) {
	want := map[string][]string{
		"adelaide":        {"Brindabella", "Large Group House in Pasadena", "Westbourne Park Saltpool Hideaway", "Mirani's Penthouse"},
		"adelaide-hills":  {"Sequoia Lodge", "Thorngrove Manor House", "Simon Tolley Lodge", "The Castle Keep B&B"},
		"barossa":         {"Tanunda House", "Fine Acres Estate", "The Station at Kapunda", "Gawler Park Estate"},
		"kangaroo-island": {"One KI", "Southern Ocean Lodge", "Sea Dragon Kangaroo Island", "Walcowrie"},
		"murray":          {"Oasis Houseboat", "Greenbanks Family Escape", "Safari Lodge", "Willow at Bow Hill"},
		"fleurieu":        {"Naiko Retreat", "The Villa at Naiko at the Bluff", "Absolute Beachfront Cowrie Retreat", "The Dune House"},
	}
	got := seeds()
	if len(got) != 24 {
		t.Fatalf("seed count = %d, want 24", len(got))
	}
	for region, names := range want {
		var actual []string
		for _, s := range got {
			if s.RegionSlug == region {
				actual = append(actual, s.Name)
			}
		}
		if strings.Join(actual, "|") != strings.Join(names, "|") {
			t.Errorf("%s = %v, want %v", region, actual, names)
		}
	}
}

func TestAccommodationDraftsAreComplete(t *testing.T) {
	for _, s := range seeds() {
		p := s.Product
		if s.Email == "" || s.Phone == "" || s.Website == "" || s.Address == "" || s.City == "" || s.PostalCode == "" {
			t.Errorf("supplier %s incomplete", s.Name)
		}
		if p.NameZh == "" || p.NameEn == "" || p.Price <= 0 || p.SummaryZh == "" || p.SummaryEn == "" || p.DescriptionZh == "" || p.DescriptionEn == "" || p.BookingURL == "" {
			t.Errorf("product %s incomplete", p.NameEn)
		}
		if len(p.Images) != 5 || len(p.Packages) < 1 || len(p.Highlights) < 2 || len(p.FAQs) < 2 {
			t.Errorf("product %s does not meet content format", p.NameEn)
		}
		for _, image := range p.Images {
			if image.SourceURL == "" {
				t.Errorf("image source missing for %s", p.NameEn)
			}
			if matches, _ := filepath.Glob(filepath.Join("..", "..", "assets", "luxury-accommodation", image.File)); len(matches) != 1 {
				t.Errorf("asset missing: %s", image.File)
			}
		}
	}
}

func TestCustomerCopyDoesNotExposeInternalNotes(t *testing.T) {
	bad := []string{"官网", "抓取", "草稿", "运营", "复核", "official site", "draft", "operator review"}
	for _, s := range seeds() {
		p := s.Product
		copy := strings.ToLower(strings.Join([]string{p.SummaryZh, p.SummaryEn, p.DescriptionZh, p.DescriptionEn}, " "))
		for _, x := range bad {
			if strings.Contains(copy, x) {
				t.Errorf("%s contains %q", p.NameEn, x)
			}
		}
	}
}
