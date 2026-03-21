package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	octomodel "enjoysa-backend/internal/octo/model"
	"enjoysa-backend/internal/octo/service"
	octostore "enjoysa-backend/internal/octo/store"
	ordermodel "enjoysa-backend/internal/order/model"
	productmodel "enjoysa-backend/internal/product/model"
	productstore "enjoysa-backend/internal/product/store"

	"github.com/google/uuid"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// BookingHandler OCTO Booking 端点
type BookingHandler struct {
	bookingStore  *octostore.BookingStore
	availStore    *octostore.AvailabilityStore
	scheduleStore *productstore.ScheduleStore
	productStore  *productstore.ProductStore
}

func NewBookingHandler(
	bookingStore *octostore.BookingStore,
	availStore *octostore.AvailabilityStore,
	scheduleStore *productstore.ScheduleStore,
	productStore *productstore.ProductStore,
) *BookingHandler {
	return &BookingHandler{
		bookingStore:  bookingStore,
		availStore:    availStore,
		scheduleStore: scheduleStore,
		productStore:  productStore,
	}
}

// --- Request types ---

type createBookingRequest struct {
	UUID              string              `json:"uuid"`
	ProductID         string              `json:"productId" binding:"required"`
	OptionID          string              `json:"optionId" binding:"required"`
	AvailabilityID    string              `json:"availabilityId"`
	UnitItems         []unitItemRequest   `json:"unitItems" binding:"required"`
	Notes             string              `json:"notes"`
	ExpirationMinutes int                 `json:"expirationMinutes"`
}

type unitItemRequest struct {
	UUID   string `json:"uuid"`
	UnitID string `json:"unitId" binding:"required"`
}

type confirmBookingRequest struct {
	Contact *service.OctoContact `json:"contact"`
	Notes   string               `json:"notes"`
}

type updateBookingRequest struct {
	UnitItems []unitItemRequest    `json:"unitItems"`
	Contact   *service.OctoContact `json:"contact"`
	Notes     string               `json:"notes"`
}

// CreateBooking POST /octo/v1/bookings
func (h *BookingHandler) CreateBooking(c *gin.Context) {
	caps := service.GetCapabilities(c)
	resellerID, _ := c.Get("octo_reseller_id")

	var req createBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": err.Error()})
		return
	}

	productID, err := strconv.ParseUint(req.ProductID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": "Invalid productId"})
		return
	}
	optionID, err := strconv.ParseUint(req.OptionID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": "Invalid optionId"})
		return
	}

	// UUID idempotency
	bookingUUID := req.UUID
	if bookingUUID == "" {
		bookingUUID = uuid.New().String()
	}

	// Check idempotency — if booking with this UUID exists, return it
	existing, _ := h.bookingStore.GetByUUID(bookingUUID)
	if existing != nil {
		resp := h.buildBookingResponse(existing, caps["pricing"])
		c.JSON(http.StatusOK, resp)
		return
	}

	// Validate availability
	var scheduleID uint
	if req.AvailabilityID != "" {
		avail, err := h.availStore.Get(req.AvailabilityID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": "Invalid or expired availabilityId"})
			return
		}
		scheduleID = avail.ProductScheduleID
	}

	quantity := len(req.UnitItems)
	if quantity == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": "unitItems must not be empty"})
		return
	}

	// Serialize unit items
	unitItemsJSON, _ := json.Marshal(req.UnitItems)

	// Expiration
	expMinutes := req.ExpirationMinutes
	if expMinutes <= 0 {
		expMinutes = 30
	}
	expiresAt := time.Now().Add(time.Duration(expMinutes) * time.Minute)

	// Calculate pricing
	var retailPrice, netPrice int
	product, _ := h.productStore.GetByID(uint(productID))
	if product != nil {
		for _, pkg := range product.Packages {
			if pkg.ID == uint(optionID) {
				retailPrice = service.PriceToCents(pkg.Price) * quantity
				netPrice = int(float64(retailPrice) * 0.85)
				break
			}
		}
	}

	// Transaction: check inventory + create booking
	db := h.bookingStore.DB()
	var booking *octomodel.OctoBooking

	txErr := db.Transaction(func(tx *gorm.DB) error {
		if scheduleID > 0 {
			// Lock the schedule row
			var schedule productmodel.ProductSchedule
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				First(&schedule, scheduleID).Error; err != nil {
				return fmt.Errorf("schedule not found")
			}

			if schedule.AvailableSlots() < quantity {
				return fmt.Errorf("insufficient availability, requested %d but only %d available", quantity, schedule.AvailableSlots())
			}

			// Decrement slots
			schedule.BookedSlots += quantity
			if err := tx.Save(&schedule).Error; err != nil {
				return err
			}
		}

		booking = &octomodel.OctoBooking{
			UUID:        bookingUUID,
			ResellerID:  resellerID.(uint),
			ProductID:   uint(productID),
			OptionID:    uint(optionID),
			ScheduleID:  nilIfZero(scheduleID),
			Status:      octomodel.OctoBookingOnHold,
			UnitItems:   string(unitItemsJSON),
			Notes:       req.Notes,
			Currency:    "AUD",
			Quantity:    quantity,
			RetailPrice: retailPrice,
			NetPrice:    netPrice,
			ExpiresAt:   &expiresAt,
		}

		return h.bookingStore.CreateInTx(tx, booking)
	})

	if txErr != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "UNPROCESSABLE", "message": txErr.Error()})
		return
	}

	resp := h.buildBookingResponse(booking, caps["pricing"])
	c.JSON(http.StatusCreated, resp)
}

// ConfirmBooking PUT /octo/v1/bookings/:uuid/confirm
func (h *BookingHandler) ConfirmBooking(c *gin.Context) {
	caps := service.GetCapabilities(c)
	bookingUUID := c.Param("uuid")

	var req confirmBookingRequest
	_ = c.ShouldBindJSON(&req)

	booking, err := h.bookingStore.GetByUUID(bookingUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Booking not found"})
		return
	}

	if booking.Status != octomodel.OctoBookingOnHold {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "UNPROCESSABLE", "message": fmt.Sprintf("Cannot confirm booking in status %s", booking.Status)})
		return
	}

	// Check not expired
	if booking.ExpiresAt != nil && time.Now().After(*booking.ExpiresAt) {
		booking.Status = octomodel.OctoBookingExpired
		_ = h.bookingStore.Update(booking)
		c.JSON(http.StatusGone, gin.H{"error": "GONE", "message": "Booking has expired"})
		return
	}

	now := time.Now()

	// Set contact info
	if req.Contact != nil {
		contactJSON, _ := json.Marshal(req.Contact)
		booking.Contact = string(contactJSON)
	}
	if req.Notes != "" {
		booking.Notes = req.Notes
	}

	// Generate voucher QR code
	qrData := fmt.Sprintf("ENJOYSA:%s", booking.UUID)
	voucher := service.OctoVoucher{
		DeliveryOptions: []service.OctoDeliveryOption{
			{DeliveryFormat: "QRCODE", DeliveryValue: qrData},
		},
	}
	voucherJSON, _ := json.Marshal(voucher)

	booking.Status = octomodel.OctoBookingConfirmed
	booking.ConfirmedAt = &now
	booking.Voucher = string(voucherJSON)

	// Create EnjoySA Order
	db := h.bookingStore.DB()
	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := h.bookingStore.UpdateInTx(tx, booking); err != nil {
			return err
		}

		// Build order from booking
		order := h.buildOrderFromBooking(booking, req.Contact)
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		booking.OrderID = &order.ID
		return h.bookingStore.UpdateInTx(tx, booking)
	})

	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to confirm booking"})
		return
	}

	resp := h.buildBookingResponse(booking, caps["pricing"])
	c.JSON(http.StatusOK, resp)
}

// CancelBooking POST /octo/v1/bookings/:uuid/cancel
func (h *BookingHandler) CancelBooking(c *gin.Context) {
	caps := service.GetCapabilities(c)
	bookingUUID := c.Param("uuid")

	booking, err := h.bookingStore.GetByUUID(bookingUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Booking not found"})
		return
	}

	if booking.Status != octomodel.OctoBookingOnHold && booking.Status != octomodel.OctoBookingConfirmed {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "UNPROCESSABLE", "message": fmt.Sprintf("Cannot cancel booking in status %s", booking.Status)})
		return
	}

	now := time.Now()
	db := h.bookingStore.DB()

	txErr := db.Transaction(func(tx *gorm.DB) error {
		// Release inventory
		if booking.ScheduleID != nil {
			if err := tx.Model(&productmodel.ProductSchedule{}).
				Where("id = ?", *booking.ScheduleID).
				Update("booked_slots", gorm.Expr("GREATEST(booked_slots - ?, 0)", booking.Quantity)).Error; err != nil {
				return err
			}
		}

		booking.Status = octomodel.OctoBookingCancelled
		booking.CancelledAt = &now

		if err := h.bookingStore.UpdateInTx(tx, booking); err != nil {
			return err
		}

		// Cancel corresponding EnjoySA order if exists
		if booking.OrderID != nil {
			return tx.Model(&ordermodel.Order{}).
				Where("id = ?", *booking.OrderID).
				Updates(map[string]interface{}{
					"status":       ordermodel.OrderStatusCancelled,
					"cancelled_at": now,
					"cancel_reason": "Cancelled via OCTO API",
				}).Error
		}
		return nil
	})

	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to cancel booking"})
		return
	}

	resp := h.buildBookingResponse(booking, caps["pricing"])
	c.JSON(http.StatusOK, resp)
}

// GetBooking GET /octo/v1/bookings/:uuid
func (h *BookingHandler) GetBooking(c *gin.Context) {
	caps := service.GetCapabilities(c)
	bookingUUID := c.Param("uuid")

	booking, err := h.bookingStore.GetByUUID(bookingUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Booking not found"})
		return
	}

	resp := h.buildBookingResponse(booking, caps["pricing"])
	c.JSON(http.StatusOK, resp)
}

// ListBookings GET /octo/v1/bookings
func (h *BookingHandler) ListBookings(c *gin.Context) {
	caps := service.GetCapabilities(c)
	resellerID, _ := c.Get("octo_reseller_id")

	var productID *uint
	if pid := c.Query("productId"); pid != "" {
		if id, err := strconv.ParseUint(pid, 10, 64); err == nil {
			uid := uint(id)
			productID = &uid
		}
	}

	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}

	bookings, err := h.bookingStore.List(resellerID.(uint), productID, status, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to list bookings"})
		return
	}

	var result []service.OctoBookingResponse
	for _, b := range bookings {
		result = append(result, h.buildBookingResponse(&b, caps["pricing"]))
	}
	if result == nil {
		result = []service.OctoBookingResponse{}
	}

	c.JSON(http.StatusOK, result)
}

// UpdateBooking PATCH /octo/v1/bookings/:uuid
func (h *BookingHandler) UpdateBooking(c *gin.Context) {
	caps := service.GetCapabilities(c)
	bookingUUID := c.Param("uuid")

	var req updateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": err.Error()})
		return
	}

	booking, err := h.bookingStore.GetByUUID(bookingUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Booking not found"})
		return
	}

	if booking.Status == octomodel.OctoBookingCancelled || booking.Status == octomodel.OctoBookingExpired {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "UNPROCESSABLE", "message": "Cannot update cancelled/expired booking"})
		return
	}

	if req.UnitItems != nil {
		unitItemsJSON, _ := json.Marshal(req.UnitItems)
		booking.UnitItems = string(unitItemsJSON)
		booking.Quantity = len(req.UnitItems)
	}
	if req.Contact != nil {
		contactJSON, _ := json.Marshal(req.Contact)
		booking.Contact = string(contactJSON)
	}
	if req.Notes != "" {
		booking.Notes = req.Notes
	}

	if err := h.bookingStore.Update(booking); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to update booking"})
		return
	}

	resp := h.buildBookingResponse(booking, caps["pricing"])
	c.JSON(http.StatusOK, resp)
}

// ExtendBooking POST /octo/v1/bookings/:uuid/extend
func (h *BookingHandler) ExtendBooking(c *gin.Context) {
	caps := service.GetCapabilities(c)
	bookingUUID := c.Param("uuid")

	booking, err := h.bookingStore.GetByUUID(bookingUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Booking not found"})
		return
	}

	if booking.Status != octomodel.OctoBookingOnHold {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "UNPROCESSABLE", "message": "Can only extend ON_HOLD bookings"})
		return
	}

	newExpiry := time.Now().Add(30 * time.Minute)
	booking.ExpiresAt = &newExpiry

	if err := h.bookingStore.Update(booking); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to extend booking"})
		return
	}

	resp := h.buildBookingResponse(booking, caps["pricing"])
	c.JSON(http.StatusOK, resp)
}

// --- helpers ---

func (h *BookingHandler) buildBookingResponse(b *octomodel.OctoBooking, withPricing bool) service.OctoBookingResponse {
	resp := service.OctoBookingResponse{
		UUID:      b.UUID,
		Status:    string(b.Status),
		ProductID: strconv.FormatUint(uint64(b.ProductID), 10),
		OptionID:  strconv.FormatUint(uint64(b.OptionID), 10),
		Notes:     b.Notes,
		Cancellable: b.Status == octomodel.OctoBookingOnHold || b.Status == octomodel.OctoBookingConfirmed,
	}

	// Unit items
	var items []unitItemRequest
	_ = json.Unmarshal([]byte(b.UnitItems), &items)
	for _, item := range items {
		resp.UnitItems = append(resp.UnitItems, service.OctoUnitItem{
			UUID:   item.UUID,
			UnitID: item.UnitID,
		})
	}
	if resp.UnitItems == nil {
		resp.UnitItems = []service.OctoUnitItem{}
	}

	// Contact
	if b.Contact != "" {
		var contact service.OctoContact
		_ = json.Unmarshal([]byte(b.Contact), &contact)
		resp.Contact = &contact
	}

	// Voucher
	if b.Voucher != "" {
		var voucher service.OctoVoucher
		_ = json.Unmarshal([]byte(b.Voucher), &voucher)
		resp.Voucher = &voucher
	}

	// Timestamps
	if b.ExpiresAt != nil {
		resp.UTCExpiresAt = b.ExpiresAt.UTC().Format(time.RFC3339)
	}
	if b.ConfirmedAt != nil {
		resp.UTCConfirmedAt = b.ConfirmedAt.UTC().Format(time.RFC3339)
	}

	// Pricing
	if withPricing && b.RetailPrice > 0 {
		resp.Pricing = &service.OctoPricing{
			Original:          b.RetailPrice,
			Retail:            b.RetailPrice,
			Net:               &b.NetPrice,
			Currency:          b.Currency,
			CurrencyPrecision: 2,
		}
	}

	return resp
}

func (h *BookingHandler) buildOrderFromBooking(b *octomodel.OctoBooking, contact *service.OctoContact) *ordermodel.Order {
	var contactName, contactEmail, contactPhone string
	if contact != nil {
		contactName = contact.FullName
		contactEmail = contact.EmailAddress
		contactPhone = contact.PhoneNumber
	} else if b.Contact != "" {
		var c service.OctoContact
		_ = json.Unmarshal([]byte(b.Contact), &c)
		contactName = c.FullName
		contactEmail = c.EmailAddress
		contactPhone = c.PhoneNumber
	}

	// Look up product info
	var productName, packageName, timeSlot string
	var supplierID uint
	var unitPrice, totalPrice float64
	var bookingDate time.Time

	product, _ := h.productStore.GetByID(b.ProductID)
	if product != nil {
		productName = product.NameEn
		supplierID = product.SupplierID
		for _, pkg := range product.Packages {
			if pkg.ID == b.OptionID {
				packageName = pkg.NameEn
				unitPrice = pkg.Price
				totalPrice = pkg.Price * float64(b.Quantity)
				break
			}
		}
	}

	// Schedule info
	if b.ScheduleID != nil {
		schedule, _ := h.scheduleStore.GetByID(*b.ScheduleID)
		if schedule != nil {
			bookingDate = schedule.Date
			timeSlot = schedule.TimeSlot
			if schedule.Price != nil {
				unitPrice = *schedule.Price
				totalPrice = *schedule.Price * float64(b.Quantity)
			}
		}
	}

	now := time.Now()
	return &ordermodel.Order{
		Status:          ordermodel.OrderStatusPaid,
		UserID:          1, // system user for channel orders
		SupplierID:      supplierID,
		ProductID:       b.ProductID,
		ProductName:     productName,
		PackageID:       b.OptionID,
		PackageName:     packageName,
		BookingDate:     bookingDate,
		TimeSlot:        timeSlot,
		Quantity:        b.Quantity,
		GuestCount:      b.Quantity,
		UnitPrice:       unitPrice,
		TotalPrice:      totalPrice,
		Currency:        "AUD",
		PaymentMethod:   "trip_com",
		PaymentTime:     &now,
		Channel:         "trip_com",
		ChannelRef:      b.UUID,
		OctoBookingUUID: b.UUID,
		ContactName:     contactName,
		ContactEmail:    contactEmail,
		ContactPhone:    contactPhone,
	}
}

func nilIfZero(v uint) *uint {
	if v == 0 {
		return nil
	}
	return &v
}
