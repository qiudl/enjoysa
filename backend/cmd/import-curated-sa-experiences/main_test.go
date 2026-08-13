package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestRequestedSuppliersAndProducts(t *testing.T) {
	want := map[string]int{
		"Star of Greece":                          1,
		"SeaLink Kangaroo Island":                 1,
		"Aurora Ozone Hotel Kangaroo Island":      1,
		"Naracoorte Caves National Park":          1,
		"The Barn Accommodation":                  1,
		"Mayura Station":                          1,
		"Ayers Rock Resort":                       3,
		"Kangaroo Island Wildlife Park":           1,
		"Port River Cruises":                      1,
		"Dolphin Sanctuary Kayak Tours":           1,
		"Adina Apartment Hotel Adelaide Treasury": 1,
		"Kingsford Hotel":                         1,
		"The Bend Motorsport Park":                1,
		"Juggle House Experiences":                1,
		"Rotor-Sport Australia":                   1,
	}
	got := seeds()
	if len(got) != 15 {
		t.Fatalf("supplier count = %d, want 15", len(got))
	}
	products := 0
	for _, s := range got {
		products += len(s.Products)
		if len(s.Products) != want[s.Name] {
			t.Errorf("%s products = %d, want %d", s.Name, len(s.Products), want[s.Name])
		}
	}
	if products != 17 {
		t.Fatalf("product count = %d, want 17", products)
	}
}

func TestDraftContentFormatIsComplete(t *testing.T) {
	for _, s := range seeds() {
		if s.Name == "" || s.Email == "" || s.Phone == "" || s.Website == "" || s.Address == "" || s.City == "" || s.PostalCode == "" {
			t.Errorf("supplier incomplete: %s", s.Name)
		}
		for _, p := range s.Products {
			if p.NameZh == "" || p.NameEn == "" || p.Price <= 0 || p.SummaryZh == "" || p.SummaryEn == "" || p.DescriptionZh == "" || p.DescriptionEn == "" || p.BookingURL == "" {
				t.Errorf("product incomplete: %s", p.NameEn)
			}
			if len(p.Images) != 5 || len(p.Packages) < 1 || len(p.Highlights) < 2 || len(p.FAQs) < 2 {
				t.Errorf("content counts incomplete: %s", p.NameEn)
			}
			for _, image := range p.Images {
				if image.SourceURL == "" {
					t.Errorf("source missing: %s", p.NameEn)
				}
				if matches, _ := filepath.Glob(filepath.Join("..", "..", "assets", "curated-sa-experiences", image.File)); len(matches) != 1 {
					t.Errorf("asset missing: %s", image.File)
				}
			}
		}
	}
}

func TestCustomerCopyHasNoInternalNotes(t *testing.T) {
	bad := []string{"官网", "抓取", "草稿", "运营", "复核", "official site", "draft", "operator review"}
	for _, s := range seeds() {
		for _, p := range s.Products {
			copy := strings.ToLower(strings.Join([]string{p.SummaryZh, p.SummaryEn, p.DescriptionZh, p.DescriptionEn}, " "))
			for _, x := range bad {
				if strings.Contains(copy, x) {
					t.Errorf("%s contains %q", p.NameEn, x)
				}
			}
		}
	}
}

func TestUluruHasFiveFourAndThreeStarProducts(t *testing.T) {
	for _, s := range seeds() {
		if s.Name == "Ayers Rock Resort" {
			joined := ""
			for _, p := range s.Products {
				joined += p.NameEn + "|"
			}
			for _, want := range []string{"5-Star", "4.5-Star", "3.5-Star"} {
				if !strings.Contains(joined, want) {
					t.Errorf("Uluru products missing %s", want)
				}
			}
			return
		}
	}
	t.Fatal("Ayers Rock Resort missing")
}
