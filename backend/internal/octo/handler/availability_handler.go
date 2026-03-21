package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	octomodel "enjoysa-backend/internal/octo/model"
	"enjoysa-backend/internal/octo/service"
	octostore "enjoysa-backend/internal/octo/store"
	productstore "enjoysa-backend/internal/product/store"

	"github.com/gin-gonic/gin"
)

// AvailabilityHandler OCTO Availability 端点
type AvailabilityHandler struct {
	scheduleStore *productstore.ScheduleStore
	productStore  *productstore.ProductStore
	availStore    *octostore.AvailabilityStore
}

func NewAvailabilityHandler(
	scheduleStore *productstore.ScheduleStore,
	productStore *productstore.ProductStore,
	availStore *octostore.AvailabilityStore,
) *AvailabilityHandler {
	return &AvailabilityHandler{
		scheduleStore: scheduleStore,
		productStore:  productStore,
		availStore:    availStore,
	}
}

type availabilityRequest struct {
	ProductID      string `json:"productId" binding:"required"`
	OptionID       string `json:"optionId" binding:"required"`
	LocalDateStart string `json:"localDateStart" binding:"required"` // YYYY-MM-DD
	LocalDateEnd   string `json:"localDateEnd" binding:"required"`   // YYYY-MM-DD
}

// Calendar POST /octo/v1/availability/calendar
func (h *AvailabilityHandler) Calendar(c *gin.Context) {
	caps := service.GetCapabilities(c)
	var req availabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": err.Error()})
		return
	}

	productID, optionID, startDate, endDate, err := h.parseParams(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": err.Error()})
		return
	}

	schedules, err := h.scheduleStore.ListByProductAndPackage(productID, optionID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to query availability"})
		return
	}

	// Group by date
	dateMap := make(map[string]bool)
	datePriceMap := make(map[string]int)
	for _, s := range schedules {
		dateStr := s.Date.Format("2006-01-02")
		available := s.AvailableSlots() > 0 && s.Status == "available"
		if existing, ok := dateMap[dateStr]; ok {
			dateMap[dateStr] = existing || available
		} else {
			dateMap[dateStr] = available
		}
		if _, ok := datePriceMap[dateStr]; !ok {
			if s.Price != nil {
				datePriceMap[dateStr] = service.PriceToCents(*s.Price)
			}
		}
	}

	var result []service.OctoCalendarEntry
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		available, exists := dateMap[dateStr]
		status := "CLOSED"
		if exists && available {
			status = "AVAILABLE"
		} else if exists {
			status = "SOLD_OUT"
		}

		entry := service.OctoCalendarEntry{
			LocalDate: dateStr,
			Status:    status,
			Available: available,
		}

		if caps["pricing"] {
			if price, ok := datePriceMap[dateStr]; ok {
				netPrice := int(float64(price) * 0.85)
				entry.Pricing = &service.OctoPricing{
					Original:          price,
					Retail:            price,
					Net:               &netPrice,
					Currency:          "AUD",
					CurrencyPrecision: 2,
				}
			}
		}

		result = append(result, entry)
	}

	c.JSON(http.StatusOK, result)
}

// Check POST /octo/v1/availability
func (h *AvailabilityHandler) Check(c *gin.Context) {
	caps := service.GetCapabilities(c)
	var req availabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": err.Error()})
		return
	}

	productID, optionID, startDate, endDate, err := h.parseParams(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BAD_REQUEST", "message": err.Error()})
		return
	}

	schedules, err := h.scheduleStore.ListByProductAndPackage(productID, optionID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL", "message": "Failed to query availability"})
		return
	}

	loc, _ := time.LoadLocation("Australia/Adelaide")

	var result []service.OctoAvailability
	for _, s := range schedules {
		available := s.AvailableSlots() > 0 && s.Status == "available"
		status := "SOLD_OUT"
		if available {
			status = "AVAILABLE"
		}

		// Generate availability ID and cache it
		availID := fmt.Sprintf("%d-%s-%s", s.ID, s.Date.Format("20060102"), s.TimeSlot)

		// Parse start time
		startTime, _ := time.ParseInLocation("2006-01-02 15:04",
			s.Date.Format("2006-01-02")+" "+s.TimeSlot, loc)
		endTime := startTime.Add(4 * time.Hour) // default 4h duration

		// Fetch product for duration
		product, _ := h.productStore.GetByID(s.ProductID)
		if product != nil {
			minutes := service.ParseDurationMinutesExported(product.Duration)
			if minutes > 0 {
				endTime = startTime.Add(time.Duration(minutes) * time.Minute)
			}
		}

		vacancies := s.AvailableSlots()
		avail := service.OctoAvailability{
			ID:                 availID,
			LocalDateTimeStart: startTime.Format("2006-01-02T15:04:05-07:00"),
			LocalDateTimeEnd:   endTime.Format("2006-01-02T15:04:05-07:00"),
			Status:             status,
			Vacancies:          &vacancies,
			Available:          available,
		}

		if caps["pricing"] {
			price := service.PriceToCents(s.GetPrice())
			netPrice := int(float64(price) * 0.85)
			avail.Pricing = &service.OctoPricing{
				Original:          price,
				Retail:            price,
				Net:               &netPrice,
				Currency:          "AUD",
				CurrencyPrecision: 2,
			}
		}

		// Cache availability ID → schedule mapping
		_ = h.availStore.Cache(&octomodel.OctoAvailabilityCache{
			ID:                availID,
			ProductScheduleID: s.ID,
			ProductID:         s.ProductID,
			OptionID:          s.PackageID,
			LocalDate:         s.Date,
			StartTime:         s.TimeSlot,
			ExpiresAt:         time.Now().Add(24 * time.Hour),
		})

		result = append(result, avail)
	}

	c.JSON(http.StatusOK, result)
}

func (h *AvailabilityHandler) parseParams(req availabilityRequest) (uint, uint, time.Time, time.Time, error) {
	productID, err := strconv.ParseUint(req.ProductID, 10, 64)
	if err != nil {
		return 0, 0, time.Time{}, time.Time{}, fmt.Errorf("invalid productId")
	}
	optionID, err := strconv.ParseUint(req.OptionID, 10, 64)
	if err != nil {
		return 0, 0, time.Time{}, time.Time{}, fmt.Errorf("invalid optionId")
	}
	startDate, err := time.Parse("2006-01-02", req.LocalDateStart)
	if err != nil {
		return 0, 0, time.Time{}, time.Time{}, fmt.Errorf("invalid localDateStart format, expected YYYY-MM-DD")
	}
	endDate, err := time.Parse("2006-01-02", req.LocalDateEnd)
	if err != nil {
		return 0, 0, time.Time{}, time.Time{}, fmt.Errorf("invalid localDateEnd format, expected YYYY-MM-DD")
	}
	return uint(productID), uint(optionID), startDate, endDate, nil
}
