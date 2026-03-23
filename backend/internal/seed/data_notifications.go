package seed

import (
	"fmt"
	"math/rand"
	"time"

	"enjoysa-backend/internal/models"
	notificationModel "enjoysa-backend/internal/notification/model"
)

func (s *Seeder) seedNotifications() error {
	// Skip if notifications table doesn't exist (created by GORM AutoMigrate)
	var exists bool
	s.db.Raw("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications')").Scan(&exists)
	if !exists {
		s.record("notifications", 0)
		return nil
	}

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
	now := time.Now()

	// Notification templates per type
	type notifTemplate struct {
		nType       string
		title       string
		content     string
		relatedType string
	}

	newOrderTemplates := []notifTemplate{
		{
			nType:       "new_order",
			title:       "New Booking Received",
			content:     "You have a new order #ORD-2026-0001. A customer has booked your tour package for 2 adults.",
			relatedType: "order",
		},
		{
			nType:       "new_order",
			title:       "New Order Notification",
			content:     "You have a new order #ORD-2026-0042. Please review and confirm the booking within 24 hours.",
			relatedType: "order",
		},
		{
			nType:       "new_order",
			title:       "Booking Confirmed by Customer",
			content:     "A new booking #ORD-2026-0088 has been placed and paid. Check your dashboard for details.",
			relatedType: "order",
		},
	}

	cancelledTemplates := []notifTemplate{
		{
			nType:       "order_cancelled",
			title:       "Order Cancelled",
			content:     "Order #ORD-2026-0015 has been cancelled by the customer. A refund has been initiated.",
			relatedType: "order",
		},
		{
			nType:       "order_cancelled",
			title:       "Booking Cancellation Notice",
			content:     "Order #ORD-2026-0063 has been cancelled. The time slot is now available for other customers.",
			relatedType: "order",
		},
	}

	productApprovedTemplates := []notifTemplate{
		{
			nType:       "product_approved",
			title:       "Product Approved",
			content:     "Your product 'Kangaroo Island Day Tour' has been approved and is now live on the platform.",
			relatedType: "product",
		},
		{
			nType:       "product_approved",
			title:       "Listing Now Active",
			content:     "Your product 'Barossa Valley Wine Tasting' has been approved by our team. Customers can now book it.",
			relatedType: "product",
		},
	}

	productRejectedTemplates := []notifTemplate{
		{
			nType:       "product_rejected",
			title:       "Product Needs Revision",
			content:     "Your product 'Adelaide Hills Hike' needs revision. Please update the description and resubmit for review.",
			relatedType: "product",
		},
	}

	reviewTemplates := []notifTemplate{
		{
			nType:       "new_review",
			title:       "New Customer Review",
			content:     "New customer review for 'Murray River Cruise': 5 stars - 'Amazing experience, highly recommended!'",
			relatedType: "product",
		},
		{
			nType:       "new_review",
			title:       "Review Posted",
			content:     "New customer review for 'Wildlife Encounter Tour': 4 stars - 'Great tour guide, wonderful animals.'",
			relatedType: "product",
		},
	}

	settlementTemplates := []notifTemplate{
		{
			nType:       "settlement",
			title:       "Settlement Processed",
			content:     "Settlement STL-202601 has been processed. The net amount has been transferred to your bank account.",
			relatedType: "settlement",
		},
		{
			nType:       "settlement",
			title:       "Payment Completed",
			content:     "Settlement STL-202602 has been completed. Please check your bank statement for the deposit.",
			relatedType: "settlement",
		},
	}

	// Build the 12 templates per supplier in the specified order
	allTemplates := make([]notifTemplate, 0, 12)
	allTemplates = append(allTemplates, newOrderTemplates...)      // 3
	allTemplates = append(allTemplates, cancelledTemplates...)      // 2
	allTemplates = append(allTemplates, productApprovedTemplates...) // 2
	allTemplates = append(allTemplates, productRejectedTemplates...) // 1
	allTemplates = append(allTemplates, reviewTemplates...)          // 2
	allTemplates = append(allTemplates, settlementTemplates...)      // 2

	var notifications []notificationModel.Notification

	for _, sup := range suppliers {
		for _, tmpl := range allTemplates {
			// Random created_at within last 30 days
			daysAgo := rng.Intn(30)
			hoursAgo := rng.Intn(24)
			minutesAgo := rng.Intn(60)
			createdAt := now.AddDate(0, 0, -daysAgo).Add(-time.Duration(hoursAgo)*time.Hour - time.Duration(minutesAgo)*time.Minute)

			// 60% read, 40% unread
			isRead := rng.Float64() < 0.60
			var readAt *time.Time
			if isRead {
				// Read sometime after creation, within 0-48 hours
				readDelay := time.Duration(rng.Intn(48*60)) * time.Minute
				t := createdAt.Add(readDelay)
				if t.After(now) {
					t = now
				}
				readAt = &t
			}

			// Related ID: use supplier ID as a base for a plausible random ID
			relatedID := uint(rng.Intn(50) + 1)

			notifications = append(notifications, notificationModel.Notification{
				RecipientType: "supplier",
				RecipientID:   sup.ID,
				Type:          tmpl.nType,
				Title:         tmpl.title,
				Content:       tmpl.content,
				RelatedType:   tmpl.relatedType,
				RelatedID:     relatedID,
				IsRead:        isRead,
				ReadAt:        readAt,
				CreatedAt:     createdAt,
			})
		}
	}

	if len(notifications) == 0 {
		return nil
	}

	if err := s.db.CreateInBatches(notifications, 100).Error; err != nil {
		return fmt.Errorf("batch insert notifications: %w", err)
	}

	s.record("notifications", len(notifications))
	return nil
}
