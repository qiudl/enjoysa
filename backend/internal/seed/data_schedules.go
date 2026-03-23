package seed

import (
	"fmt"
	"math/rand"
	"time"

	productModel "enjoysa-backend/internal/product/model"
)

func (s *Seeder) seedSchedules() error {
	// Query all approved products
	var products []productModel.Product
	if err := s.db.Where("status = ?", "approved").Find(&products).Error; err != nil {
		return fmt.Errorf("query approved products: %w", err)
	}
	if len(products) == 0 {
		return nil
	}

	// Query all packages, grouped by product ID (keep first package per product)
	var allPackages []productModel.ProductPackage
	if err := s.db.Order("sort_order ASC, id ASC").Find(&allPackages).Error; err != nil {
		return fmt.Errorf("query packages: %w", err)
	}
	packageByProduct := make(map[uint]productModel.ProductPackage)
	for _, pkg := range allPackages {
		if _, exists := packageByProduct[pkg.ProductID]; !exists {
			packageByProduct[pkg.ProductID] = pkg
		}
	}

	// Fixed seed for reproducibility
	rng := rand.New(rand.NewSource(20260323))

	timeSlots := []string{"09:00", "10:00", "13:00", "14:00"}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startDate := today.AddDate(0, 0, -90)
	endDate := today.AddDate(0, 0, 90)

	var schedules []productModel.ProductSchedule

	for productIdx, product := range products {
		pkg, hasPkg := packageByProduct[product.ID]
		if !hasPkg {
			continue
		}

		basePrice := pkg.Price
		slot := timeSlots[productIdx%len(timeSlots)]

		for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
			totalSlots := 10 + rng.Intn(11) // 10-20

			daysFromToday := int(d.Sub(today).Hours() / 24)
			var bookedSlots int
			var status string

			if daysFromToday < 0 {
				// Past dates: random 2-15, some full
				bookedSlots = 2 + rng.Intn(14)
				if bookedSlots > totalSlots {
					bookedSlots = totalSlots
				}
				status = "closed"
			} else if daysFromToday <= 7 {
				// Future dates close (0-7 days): random 3-10
				bookedSlots = 3 + rng.Intn(8)
				if bookedSlots > totalSlots {
					bookedSlots = totalSlots
				}
				if bookedSlots >= totalSlots {
					status = "full"
				} else {
					status = "available"
				}
			} else {
				// Future dates far: random 0-5
				bookedSlots = rng.Intn(6)
				if bookedSlots > totalSlots {
					bookedSlots = totalSlots
				}
				if bookedSlots >= totalSlots {
					status = "full"
				} else {
					status = "available"
				}
			}

			// Price: package price * (0.9 + rand*0.2) for +/-10% variation
			price := basePrice * (0.9 + rng.Float64()*0.2)
			// Round to 2 decimal places
			price = float64(int(price*100+0.5)) / 100

			schedules = append(schedules, productModel.ProductSchedule{
				ProductID:   product.ID,
				PackageID:   pkg.ID,
				Date:        d,
				TimeSlot:    slot,
				TotalSlots:  totalSlots,
				BookedSlots: bookedSlots,
				Price:       &price,
				Status:      status,
			})
		}
	}

	if len(schedules) == 0 {
		return nil
	}

	// Batch insert for performance (~6300 records)
	if err := s.db.CreateInBatches(schedules, 500).Error; err != nil {
		return fmt.Errorf("batch insert schedules: %w", err)
	}

	s.record("product_schedules", len(schedules))
	return nil
}
