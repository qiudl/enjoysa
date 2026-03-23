package seed

import (
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Pre-computed password hashes (avoids repeated bcrypt)
var (
	AdminPasswordHash    string
	SupplierPasswordHash string
	UserPasswordHash     string
)

func init() {
	AdminPasswordHash = hashPassword("Admin123")
	SupplierPasswordHash = hashPassword("Supplier123")
	UserPasswordHash = hashPassword("User123")
}

func hashPassword(plain string) string {
	hash, _ := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(hash)
}

type Seeder struct {
	db      *gorm.DB
	counts  map[string]int
	startAt time.Time
}

func NewSeeder(db *gorm.DB) *Seeder {
	return &Seeder{
		db:     db,
		counts: make(map[string]int),
	}
}

func (s *Seeder) Clean() error {
	tables := []string{
		"order_status_histories",
		"notifications",
		"settlements",
		"orders",
		"product_schedules",
		"product_faqs",
		"product_highlights",
		"product_packages",
		"product_images",
		"products",
		"supplier_users",
		"suppliers",
		"users",
		"banners",
		"admins",
		"regions",
		"categories",
	}
	for _, t := range tables {
		// Check if table exists before truncating
		var exists bool
		s.db.Raw("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = ?)", t).Scan(&exists)
		if !exists {
			continue
		}
		if err := s.db.Exec(fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE", t)).Error; err != nil {
			return fmt.Errorf("truncate %s: %w", t, err)
		}
	}
	return nil
}

func (s *Seeder) Seed() error {
	s.startAt = time.Now()

	steps := []struct {
		name string
		fn   func() error
	}{
		{"Regions", s.seedRegions},
		{"Categories", s.seedCategories},
		{"Admins", s.seedAdmins},
		{"Suppliers", s.seedSuppliers},
		{"Products", s.seedProducts},
		{"Schedules", s.seedSchedules},
		{"Users", s.seedUsers},
		{"Orders", s.seedOrders},
		{"Settlements", s.seedSettlements},
		{"Hotels", s.seedHotels},
		{"Notifications", s.seedNotifications},
		{"Banners", s.seedBanners},
	}

	for _, step := range steps {
		fmt.Printf("  %-15s ", step.name+"...")
		start := time.Now()
		if err := step.fn(); err != nil {
			fmt.Println("❌")
			return fmt.Errorf("%s: %w", step.name, err)
		}
		fmt.Printf("✅ (%s)\n", time.Since(start).Round(time.Millisecond))
	}
	return nil
}

func (s *Seeder) record(table string, count int) {
	s.counts[table] += count
}

func (s *Seeder) PrintSummary() {
	fmt.Println("\n📊 Seed Summary:")
	fmt.Println("─────────────────────────────")
	total := 0
	order := []string{
		"regions", "categories", "admins",
		"suppliers", "supplier_users",
		"products", "product_images", "product_packages",
		"product_highlights", "product_faqs", "product_schedules",
		"users", "orders", "order_status_histories",
		"hotels", "hotel_images", "hotel_packages",
		"settlements", "notifications", "banners",
	}
	for _, table := range order {
		if count, ok := s.counts[table]; ok {
			fmt.Printf("  %-25s %6d\n", table, count)
			total += count
		}
	}
	fmt.Println("─────────────────────────────")
	fmt.Printf("  %-25s %6d\n", "TOTAL", total)
}
