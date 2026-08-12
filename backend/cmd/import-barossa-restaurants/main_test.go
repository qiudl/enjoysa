package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestSeedsContainExactlyFourNamedRestaurants(t *testing.T) {
	want := []string{"Hentley Farm Restaurant", "fermentAsian", "Appellation at The Louise", "Vintners Bar & Grill"}
	got := seeds()
	if len(got) != len(want) {
		t.Fatalf("seed count = %d, want 4", len(got))
	}
	for i, seed := range got {
		if seed.Name != want[i] {
			t.Errorf("seed %d = %q, want %q", i, seed.Name, want[i])
		}
	}
}

func TestSupplierAndProductDataIsComplete(t *testing.T) {
	for _, seed := range seeds() {
		if seed.Email == "" || seed.Phone == "" || seed.Website == "" || seed.Address == "" || seed.City == "" || seed.PostalCode == "" || seed.Description == "" {
			t.Errorf("supplier %s has incomplete backend fields", seed.Name)
		}
		p := seed.Product
		if p.NameZh == "" || p.NameEn == "" || p.Price <= 0 || p.SummaryZh == "" || p.SummaryEn == "" || p.DescriptionZh == "" || p.DescriptionEn == "" || p.Address == "" || p.ImageFile == "" || p.ImageSource == "" || p.BookingURL == "" {
			t.Errorf("supplier %s has incomplete flagship product", seed.Name)
		}
		if len(p.Packages) == 0 || len(p.Highlights) < 2 || len(p.FAQs) < 2 {
			t.Errorf("product %s lacks packages/highlights/FAQs", p.NameEn)
		}
		images := append([]imageSeed{{p.ImageFile, p.ImageSource}}, galleryFor(p.NameEn)...)
		if len(images) != 5 {
			t.Errorf("product %s has %d images, want 5", p.NameEn, len(images))
		}
		for _, image := range images {
			if image.SourceURL == "" {
				t.Errorf("product %s image %s has no source", p.NameEn, image.File)
			}
			if matches, _ := filepath.Glob(filepath.Join("..", "..", "assets", "barossa-restaurants", image.File)); len(matches) != 1 {
				t.Errorf("product %s image %s missing", p.NameEn, image.File)
			}
		}
	}
}

func TestCustomerCopyDoesNotExposeImportNotes(t *testing.T) {
	forbidden := []string{"官网", "抓取", "草稿", "运营", "复核", "official site", "official menu", "draft", "operator review"}
	for _, seed := range seeds() {
		p := seed.Product
		parts := []string{p.SummaryZh, p.SummaryEn, p.DescriptionZh, p.DescriptionEn}
		for _, x := range p.Packages {
			parts = append(parts, x.NameZh, x.NameEn, x.DescZh, x.DescEn)
		}
		for _, x := range p.Highlights {
			parts = append(parts, x.TitleZh, x.TitleEn, x.DescZh, x.DescEn)
		}
		for _, x := range p.FAQs {
			parts = append(parts, x.QuestionZh, x.QuestionEn, x.AnswerZh, x.AnswerEn)
		}
		copy := strings.ToLower(strings.Join(parts, " "))
		for _, phrase := range forbidden {
			if strings.Contains(copy, phrase) {
				t.Errorf("%s contains %q", p.NameEn, phrase)
			}
		}
	}
}

func TestHentleyUsesExistingSupplierIdentity(t *testing.T) {
	seed := seeds()[0]
	if seed.Name != "Hentley Farm Restaurant" || seed.Email != "reservations@hentleyfarm.com.au" {
		t.Fatalf("unexpected Hentley identity: %#v", seed)
	}
}
