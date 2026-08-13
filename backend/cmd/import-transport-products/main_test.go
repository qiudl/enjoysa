package main

import "testing"

func TestTransportSeedsAreRichAndFeatured(t *testing.T) {
	items := seeds()
	if len(items) != 2 {
		t.Fatalf("got %d products", len(items))
	}
	for i, p := range items {
		if int(p.FeaturedOrder) != i+1 {
			t.Errorf("%s order = %v", p.NameEn, p.FeaturedOrder)
		}
		if len(p.Images) != 5 || len(p.Highlights) < 4 || len(p.FAQs) < 5 || len(p.Packages) < 3 {
			t.Errorf("%s content incomplete", p.NameEn)
		}
		if p.BookingType == "" || p.BookingNoticeZh == "" || p.BookingNoticeEn == "" {
			t.Errorf("%s booking config incomplete", p.NameEn)
		}
	}
}
