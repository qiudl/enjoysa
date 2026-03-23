package seed

import (
	"fmt"
	"math/rand"

	"enjoysa-backend/internal/models"
	settlementModel "enjoysa-backend/internal/settlement/model"
)

func (s *Seeder) seedSettlements() error {
	// Query approved suppliers from DB
	var suppliers []models.Supplier
	if err := s.db.Where("status = ?", "approved").Find(&suppliers).Error; err != nil {
		return fmt.Errorf("query approved suppliers: %w", err)
	}
	if len(suppliers) == 0 {
		return nil
	}

	// Take up to 10 approved suppliers
	if len(suppliers) > 10 {
		suppliers = suppliers[:10]
	}

	rng := rand.New(rand.NewSource(20260323))

	// 3 months: Jan 2026, Feb 2026, Mar 2026
	months := []struct {
		year      int
		month     int
		label     string
		periodEnd string // last day of month
		status    string
		hasPaidAt bool
	}{
		{2026, 1, "202601", "2026-01-31", "completed", true},
		{2026, 2, "202602", "2026-02-28", "completed", false},
		{2026, 3, "202603", "2026-03-31", "pending", false},
	}

	var settlements []settlementModel.Settlement

	for _, sup := range suppliers {
		for _, m := range months {
			orderCount := 5 + rng.Intn(21) // 5-25
			unitPrice := 80.0 + rng.Float64()*220.0 // 80-300
			grossAmount := float64(orderCount) * unitPrice
			grossAmount = float64(int(grossAmount*100+0.5)) / 100
			commission := float64(int(grossAmount*10+0.5)) / 100 // 10%
			netAmount := float64(int((grossAmount-commission)*100+0.5)) / 100

			var paidAt *string
			if m.hasPaidAt {
				t := fmt.Sprintf("%d-%02d-28 10:00:00", m.year, m.month)
				paidAt = &t
			}

			var remark string
			if m.status == "completed" {
				remark = "Monthly settlement"
			}

			settlements = append(settlements, settlementModel.Settlement{
				SettlementNo: fmt.Sprintf("STL-%s-%d", m.label, sup.ID),
				SupplierID:   sup.ID,
				SupplierName: sup.Name,
				PeriodStart:  fmt.Sprintf("%d-%02d-01", m.year, m.month),
				PeriodEnd:    m.periodEnd,
				OrderCount:   orderCount,
				GrossAmount:  grossAmount,
				Commission:   commission,
				NetAmount:    netAmount,
				Status:       m.status,
				PaidAt:       paidAt,
				Remark:       remark,
			})
		}
	}

	if len(settlements) == 0 {
		return nil
	}

	if err := s.db.CreateInBatches(settlements, 100).Error; err != nil {
		return fmt.Errorf("batch insert settlements: %w", err)
	}

	s.record("settlements", len(settlements))
	return nil
}
