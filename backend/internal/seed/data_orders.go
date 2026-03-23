package seed

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"enjoysa-backend/internal/models"
	ordermodel "enjoysa-backend/internal/order/model"
	productmodel "enjoysa-backend/internal/product/model"
)

func (s *Seeder) seedOrders() error {
	// ── Query prerequisite data ──────────────────────────────────────────

	var products []productmodel.Product
	if err := s.db.Where("status = ?", "approved").Find(&products).Error; err != nil {
		return fmt.Errorf("query products: %w", err)
	}
	if len(products) == 0 {
		return fmt.Errorf("no approved products found")
	}

	var packages []productmodel.ProductPackage
	if err := s.db.Find(&packages).Error; err != nil {
		return fmt.Errorf("query packages: %w", err)
	}
	pkgByProduct := make(map[uint][]productmodel.ProductPackage)
	for _, pkg := range packages {
		pkgByProduct[pkg.ProductID] = append(pkgByProduct[pkg.ProductID], pkg)
	}

	var schedules []productmodel.ProductSchedule
	if err := s.db.Find(&schedules).Error; err != nil {
		return fmt.Errorf("query schedules: %w", err)
	}
	// schedulesByProductDate: productID -> date-string -> schedule
	schedulesByProductDate := make(map[uint]map[string]productmodel.ProductSchedule)
	for _, sch := range schedules {
		dateKey := sch.Date.Format("2006-01-02")
		if _, ok := schedulesByProductDate[sch.ProductID]; !ok {
			schedulesByProductDate[sch.ProductID] = make(map[string]productmodel.ProductSchedule)
		}
		schedulesByProductDate[sch.ProductID][dateKey] = sch
	}

	var activeUsers []models.User
	if err := s.db.Where("status = ?", "active").Find(&activeUsers).Error; err != nil {
		return fmt.Errorf("query users: %w", err)
	}
	if len(activeUsers) == 0 {
		return fmt.Errorf("no active users found")
	}

	var suppliers []models.Supplier
	if err := s.db.Where("status = ?", "approved").Find(&suppliers).Error; err != nil {
		return fmt.Errorf("query suppliers: %w", err)
	}
	supplierByID := make(map[uint]models.Supplier)
	for _, sup := range suppliers {
		supplierByID[sup.ID] = sup
	}

	// ── Helpers ──────────────────────────────────────────────────────────

	rng := rand.New(rand.NewSource(20260323))
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	orderNoSet := make(map[string]struct{})
	genOrderNo := func(bookingDate time.Time) string {
		for {
			no := fmt.Sprintf("ORD%s%05d", bookingDate.Format("20060102"), rng.Intn(100000))
			if _, exists := orderNoSet[no]; !exists {
				orderNoSet[no] = struct{}{}
				return no
			}
		}
	}

	randomDate := func(from, to time.Time) time.Time {
		days := int(to.Sub(from).Hours() / 24)
		if days <= 0 {
			return from
		}
		return from.AddDate(0, 0, rng.Intn(days))
	}

	roundPrice := func(v float64) float64 {
		return math.Round(v*100) / 100
	}

	cancelReasons := []string{
		"Schedule conflict",
		"Weather conditions",
		"Change of plans",
		"Found better option",
		"Personal emergency",
		"Group size changed",
	}

	refundReasons := []string{
		"Customer requested",
		"Service not as described",
		"Weather cancellation",
		"Supplier unavailable",
		"Booking error",
	}

	// ── Status distribution ──────────────────────────────────────────────
	//  completed:200  accepted:100  pending:80  cancelled:70  refunded:50

	type statusSpec struct {
		status ordermodel.OrderStatus
		count  int
	}
	specs := []statusSpec{
		{ordermodel.OrderStatusCompleted, 200},
		{ordermodel.OrderStatusAccepted, 100},
		{ordermodel.OrderStatusPending, 80},
		{ordermodel.OrderStatusCancelled, 70},
		{ordermodel.OrderStatusRefunded, 50},
	}

	orders := make([]ordermodel.Order, 0, 500)
	// We will build histories after order creation so we can reference IDs.
	type historyTemplate struct {
		orderIdx int // index in orders slice
		records  []ordermodel.OrderStatusHistory
	}
	historyTemplates := make([]historyTemplate, 0, 500)

	globalIdx := 0

	for _, spec := range specs {
		for i := 0; i < spec.count; i++ {
			// ── Pick random product, package, user ───────────────────────

			product := products[rng.Intn(len(products))]
			pkgList := pkgByProduct[product.ID]
			if len(pkgList) == 0 {
				// fallback: pick another product that has packages
				for _, p := range products {
					if len(pkgByProduct[p.ID]) > 0 {
						product = p
						pkgList = pkgByProduct[p.ID]
						break
					}
				}
			}
			pkg := pkgList[rng.Intn(len(pkgList))]
			user := activeUsers[rng.Intn(len(activeUsers))]
			supplier := supplierByID[product.SupplierID]

			// ── Booking date based on status ─────────────────────────────

			var bookingDate time.Time
			switch spec.status {
			case ordermodel.OrderStatusCompleted:
				bookingDate = randomDate(today.AddDate(0, 0, -90), today.AddDate(0, 0, -7))
			case ordermodel.OrderStatusAccepted:
				bookingDate = randomDate(today.AddDate(0, 0, -7), today.AddDate(0, 0, 14))
			case ordermodel.OrderStatusPending:
				bookingDate = randomDate(today, today.AddDate(0, 0, 30))
			case ordermodel.OrderStatusCancelled:
				bookingDate = randomDate(today.AddDate(0, 0, -60), today.AddDate(0, 0, -7))
			case ordermodel.OrderStatusRefunded:
				bookingDate = randomDate(today.AddDate(0, 0, -90), today.AddDate(0, 0, -14))
			}

			// ── Find matching schedule ───────────────────────────────────

			var scheduleID *uint
			dateKey := bookingDate.Format("2006-01-02")
			if schMap, ok := schedulesByProductDate[product.ID]; ok {
				if sch, ok := schMap[dateKey]; ok {
					scheduleID = &sch.ID
				}
			}

			// ── Quantity / price ─────────────────────────────────────────

			quantity := 1 + rng.Intn(4)    // 1-4
			guestCount := quantity * (1 + rng.Intn(3)) // quantity * (1-3)
			unitPrice := pkg.Price
			totalPrice := roundPrice(unitPrice * float64(quantity))

			// Special cases for completed orders
			if spec.status == ordermodel.OrderStatusCompleted {
				// 3 zero-amount orders
				if i < 3 {
					unitPrice = 0
					totalPrice = 0
				}
				// 5 large orders (> 10000 AUD)
				if i >= 3 && i < 8 {
					unitPrice = 2500 + roundPrice(rng.Float64()*500)
					quantity = 4 + rng.Intn(3) // 4-6
					guestCount = quantity * (2 + rng.Intn(2))
					totalPrice = roundPrice(unitPrice * float64(quantity))
				}
			}

			// ── Payment ──────────────────────────────────────────────────

			var paymentMethod string
			var paymentTime *time.Time
			if totalPrice > 0 && spec.status != ordermodel.OrderStatusPending {
				paymentMethod = "stripe"
				pt := bookingDate.Add(-time.Duration(1+rng.Intn(7)) * 24 * time.Hour)
				paymentTime = &pt
			}

			// ── Build order ──────────────────────────────────────────────

			order := ordermodel.Order{
				OrderNo:      genOrderNo(bookingDate),
				Status:       spec.status,
				UserID:       user.ID,
				UserName:     user.Name,
				UserPhone:    user.Phone,
				UserEmail:    user.Email,
				SupplierID:   supplier.ID,
				SupplierName: supplier.Name,
				ProductID:    product.ID,
				ProductName:  product.NameEn,
				PackageID:    pkg.ID,
				PackageName:  pkg.NameEn,
				ScheduleID:   scheduleID,
				BookingDate:  bookingDate,
				Quantity:     quantity,
				GuestCount:   guestCount,
				UnitPrice:    unitPrice,
				TotalPrice:   totalPrice,
				Currency:     "AUD",
				PaymentMethod: paymentMethod,
				PaymentTime:   paymentTime,
				ContactName:  user.Name,
				ContactPhone: user.Phone,
				ContactEmail: user.Email,
			}

			// ── Status-specific fields ───────────────────────────────────

			switch spec.status {
			case ordermodel.OrderStatusAccepted:
				t := bookingDate.Add(-time.Duration(1+rng.Intn(5)) * 24 * time.Hour)
				order.AcceptedAt = &t

			case ordermodel.OrderStatusCompleted:
				at := bookingDate.Add(-time.Duration(1+rng.Intn(5)) * 24 * time.Hour)
				order.AcceptedAt = &at
				ct := bookingDate.Add(time.Duration(rng.Intn(3)) * time.Hour)
				order.CompletedAt = &ct

			case ordermodel.OrderStatusCancelled:
				ct := bookingDate.Add(time.Duration(rng.Intn(4)) * 24 * time.Hour)
				order.CancelledAt = &ct
				if rng.Float64() < 0.5 {
					order.CancelReason = cancelReasons[rng.Intn(len(cancelReasons))]
				}

			case ordermodel.OrderStatusRefunded:
				at := bookingDate.Add(-time.Duration(1+rng.Intn(5)) * 24 * time.Hour)
				order.AcceptedAt = &at
				rt := bookingDate.Add(time.Duration(1+rng.Intn(5)) * 24 * time.Hour)
				order.RefundedAt = &rt
				order.RefundReason = refundReasons[rng.Intn(len(refundReasons))]
				order.RefundStatus = "completed"
				if rng.Float64() < 0.7 {
					// full refund
					order.RefundAmount = totalPrice
					order.RefundType = "full"
				} else {
					// partial refund: 50-80% of total
					pct := 0.5 + rng.Float64()*0.3
					order.RefundAmount = roundPrice(totalPrice * pct)
					order.RefundType = "partial"
				}
			}

			// ── Set CreatedAt to something realistic ─────────────────────

			if paymentTime != nil {
				order.CreatedAt = paymentTime.Add(-time.Duration(rng.Intn(60)) * time.Minute)
			} else {
				order.CreatedAt = bookingDate.Add(-time.Duration(1+rng.Intn(14)) * 24 * time.Hour)
			}

			orders = append(orders, order)

			// ── Build status history templates ───────────────────────────

			ht := historyTemplate{orderIdx: globalIdx}
			baseTime := order.CreatedAt

			switch spec.status {
			case ordermodel.OrderStatusPending:
				ht.records = []ordermodel.OrderStatusHistory{
					{FromStatus: "", ToStatus: ordermodel.OrderStatusPending, OperatorType: "system", Remark: "Order created", CreatedAt: baseTime},
				}

			case ordermodel.OrderStatusAccepted:
				t1 := baseTime
				t2 := t1.Add(time.Duration(5+rng.Intn(30)) * time.Minute)
				t3 := t2.Add(time.Duration(1+rng.Intn(24)) * time.Hour)
				ht.records = []ordermodel.OrderStatusHistory{
					{FromStatus: "", ToStatus: ordermodel.OrderStatusPending, OperatorType: "system", Remark: "Order created", CreatedAt: t1},
					{FromStatus: ordermodel.OrderStatusPending, ToStatus: ordermodel.OrderStatusPaid, OperatorType: "system", Remark: "Payment confirmed via Stripe", CreatedAt: t2},
					{FromStatus: ordermodel.OrderStatusPaid, ToStatus: ordermodel.OrderStatusAccepted, OperatorType: "supplier", Remark: "Supplier accepted the order", CreatedAt: t3},
				}

			case ordermodel.OrderStatusCompleted:
				t1 := baseTime
				t2 := t1.Add(time.Duration(5+rng.Intn(30)) * time.Minute)
				t3 := t2.Add(time.Duration(1+rng.Intn(24)) * time.Hour)
				t4 := t3.Add(time.Duration(1+rng.Intn(72)) * time.Hour)
				ht.records = []ordermodel.OrderStatusHistory{
					{FromStatus: "", ToStatus: ordermodel.OrderStatusPending, OperatorType: "system", Remark: "Order created", CreatedAt: t1},
					{FromStatus: ordermodel.OrderStatusPending, ToStatus: ordermodel.OrderStatusPaid, OperatorType: "system", Remark: "Payment confirmed via Stripe", CreatedAt: t2},
					{FromStatus: ordermodel.OrderStatusPaid, ToStatus: ordermodel.OrderStatusAccepted, OperatorType: "supplier", Remark: "Supplier accepted the order", CreatedAt: t3},
					{FromStatus: ordermodel.OrderStatusAccepted, ToStatus: ordermodel.OrderStatusCompleted, OperatorType: "system", Remark: "Service completed", CreatedAt: t4},
				}

			case ordermodel.OrderStatusCancelled:
				t1 := baseTime
				t2 := t1.Add(time.Duration(5+rng.Intn(30)) * time.Minute)
				t3 := t2.Add(time.Duration(1+rng.Intn(48)) * time.Hour)
				remark := "Order cancelled by user"
				if order.CancelReason != "" {
					remark = "Cancelled: " + order.CancelReason
				}
				ht.records = []ordermodel.OrderStatusHistory{
					{FromStatus: "", ToStatus: ordermodel.OrderStatusPending, OperatorType: "system", Remark: "Order created", CreatedAt: t1},
					{FromStatus: ordermodel.OrderStatusPending, ToStatus: ordermodel.OrderStatusPaid, OperatorType: "system", Remark: "Payment confirmed via Stripe", CreatedAt: t2},
					{FromStatus: ordermodel.OrderStatusPaid, ToStatus: ordermodel.OrderStatusCancelled, OperatorType: "user", Remark: remark, CreatedAt: t3},
				}

			case ordermodel.OrderStatusRefunded:
				t1 := baseTime
				t2 := t1.Add(time.Duration(5+rng.Intn(30)) * time.Minute)
				t3 := t2.Add(time.Duration(1+rng.Intn(24)) * time.Hour)
				t4 := t3.Add(time.Duration(24+rng.Intn(96)) * time.Hour)
				ht.records = []ordermodel.OrderStatusHistory{
					{FromStatus: "", ToStatus: ordermodel.OrderStatusPending, OperatorType: "system", Remark: "Order created", CreatedAt: t1},
					{FromStatus: ordermodel.OrderStatusPending, ToStatus: ordermodel.OrderStatusPaid, OperatorType: "system", Remark: "Payment confirmed via Stripe", CreatedAt: t2},
					{FromStatus: ordermodel.OrderStatusPaid, ToStatus: ordermodel.OrderStatusAccepted, OperatorType: "supplier", Remark: "Supplier accepted the order", CreatedAt: t3},
					{FromStatus: ordermodel.OrderStatusAccepted, ToStatus: ordermodel.OrderStatusRefunded, OperatorType: "system", Remark: "Refund processed: " + order.RefundReason, CreatedAt: t4},
				}
			}

			historyTemplates = append(historyTemplates, ht)
			globalIdx++
		}
	}

	// ── Batch insert orders ──────────────────────────────────────────────

	if err := s.db.CreateInBatches(orders, 100).Error; err != nil {
		return fmt.Errorf("batch insert orders: %w", err)
	}
	s.record("orders", len(orders))

	// ── Build and batch insert histories (now that orders have IDs) ──────

	var allHistories []ordermodel.OrderStatusHistory
	for _, ht := range historyTemplates {
		orderID := orders[ht.orderIdx].ID
		for _, h := range ht.records {
			h.OrderID = orderID
			allHistories = append(allHistories, h)
		}
	}

	if err := s.db.CreateInBatches(allHistories, 200).Error; err != nil {
		return fmt.Errorf("batch insert order status histories: %w", err)
	}
	s.record("order_status_histories", len(allHistories))

	return nil
}
