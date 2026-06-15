package store

// Tests for the admin product-edit fix (REQ: admin "confirm & submit" → 500 +
// data corruption). UpdateWithRelated must (a) replace child entities, and
// (b) NOT re-save the BelongsTo parents (Supplier/Region/Category) — re-saving a
// stale preloaded association is what both 500'd the edit and mutated tables an
// edit shouldn't touch.

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"enjoysa-backend/internal/models"
	"enjoysa-backend/internal/product/model"
)

func setupProductStore(t *testing.T) (*ProductStore, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Supplier{}, &model.Region{}, &model.Category{}, &model.Product{},
		&model.ProductImage{}, &model.ProductPackage{}, &model.ProductHighlight{},
		&model.ProductFAQ{}, &model.ProductSchedule{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	db.Create(&models.Supplier{Name: "Original"}) // id 1
	db.Create(&model.Region{})                    // id 1
	db.Create(&model.Category{})                  // id 1
	return NewProductStore(db), db
}

func seedProductWithPackages(t *testing.T, db *gorm.DB, pkgs ...model.ProductPackage) *model.Product {
	t.Helper()
	p := &model.Product{NameZh: "P", NameEn: "P", SupplierID: 1, RegionID: 1, CategoryID: 1, Packages: pkgs}
	if err := db.Session(&gorm.Session{FullSaveAssociations: true}).Create(p).Error; err != nil {
		t.Fatalf("seed product: %v", err)
	}
	return p
}

func TestUpdateWithRelated_ReplacesChildren(t *testing.T) {
	s, db := setupProductStore(t)
	p := seedProductWithPackages(t, db,
		model.ProductPackage{NameZh: "old1", NameEn: "old1", Price: 10},
		model.ProductPackage{NameZh: "old2", NameEn: "old2", Price: 20},
	)

	// Edit: replace the two packages with a single new one + change a field.
	p.NameZh = "P-edited"
	p.Packages = []model.ProductPackage{{ProductID: p.ID, NameZh: "new1", NameEn: "new1", Price: 30}}
	if err := s.UpdateWithRelated(p); err != nil {
		t.Fatalf("UpdateWithRelated: %v", err)
	}

	var pkgs []model.ProductPackage
	db.Where("product_id = ?", p.ID).Find(&pkgs) // soft-deleted old ones are excluded
	if len(pkgs) != 1 || pkgs[0].NameZh != "new1" {
		t.Fatalf("packages = %+v, want exactly [new1]", pkgs)
	}
	var got model.Product
	db.First(&got, p.ID)
	if got.NameZh != "P-edited" {
		t.Fatalf("product name = %q, want P-edited", got.NameZh)
	}
}

func TestUpdateWithRelated_DoesNotMutateBelongsTo(t *testing.T) {
	s, db := setupProductStore(t)
	p := seedProductWithPackages(t, db, model.ProductPackage{NameZh: "pkg", NameEn: "pkg", Price: 10})

	// Simulate a stale/changed preloaded BelongsTo object (as GetByID would load,
	// then the handler mutates SupplierID without refreshing product.Supplier).
	p.Supplier = &models.Supplier{ID: 1, Name: "Mutated"}
	p.NameZh = "P-edited"
	if err := s.UpdateWithRelated(p); err != nil {
		t.Fatalf("UpdateWithRelated: %v", err)
	}

	var sup models.Supplier
	db.First(&sup, 1)
	if sup.Name != "Original" {
		t.Fatalf("supplier name = %q, want Original — BelongsTo must NOT be re-saved", sup.Name)
	}
}

// Bare Update (used by e.g. review_handler recomputing rating) must also NOT
// re-save the BelongsTo parents — same .Omit guard as UpdateWithRelated.
func TestUpdate_DoesNotMutateBelongsTo(t *testing.T) {
	s, db := setupProductStore(t)
	p := seedProductWithPackages(t, db, model.ProductPackage{NameZh: "pkg", NameEn: "pkg", Price: 10})

	p.Supplier = &models.Supplier{ID: 1, Name: "Mutated"} // stale preloaded parent
	p.ReviewCount = 1                                      // a review_handler-style field change
	if err := s.Update(p); err != nil {
		t.Fatalf("Update: %v", err)
	}

	var sup models.Supplier
	db.First(&sup, 1)
	if sup.Name != "Original" {
		t.Fatalf("supplier name = %q, want Original — bare Update must NOT re-save BelongsTo", sup.Name)
	}
}
