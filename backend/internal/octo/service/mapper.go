package service

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	productmodel "enjoysa-backend/internal/product/model"

	"github.com/gin-gonic/gin"
)

// --- OCTO response structs ---

type OctoProduct struct {
	ID                    string       `json:"id"`
	InternalName          string       `json:"internalName"`
	Locale                string       `json:"locale"`
	TimeZone              string       `json:"timeZone"`
	AllowFreesale         bool         `json:"allowFreesale"`
	InstantConfirmation   bool         `json:"instantConfirmation"`
	InstantDelivery       bool         `json:"instantDelivery"`
	AvailabilityRequired  bool         `json:"availabilityRequired"`
	AvailabilityType      string       `json:"availabilityType"`
	DeliveryFormats       []string     `json:"deliveryFormats"`
	DeliveryMethods       []string     `json:"deliveryMethods"`
	RedemptionMethod      string       `json:"redemptionMethod"`
	Options               []OctoOption `json:"options"`
	Content               *OctoContent `json:"content,omitempty"`
}

type OctoOption struct {
	ID                          string           `json:"id"`
	InternalName                string           `json:"internalName"`
	AvailabilityLocalStartTimes []string         `json:"availabilityLocalStartTimes"`
	CancellationCutoff          string           `json:"cancellationCutoff"`
	CancellationCutoffAmount    int              `json:"cancellationCutoffAmount"`
	CancellationCutoffUnit      string           `json:"cancellationCutoffUnit"`
	RequiredContactFields       []string         `json:"requiredContactFields"`
	Restrictions                *OctoRestriction `json:"restrictions,omitempty"`
	Units                       []OctoUnit       `json:"units"`
}

type OctoUnit struct {
	ID           string        `json:"id"`
	InternalName string        `json:"internalName"`
	Type         string        `json:"type"`
	Restrictions *OctoUnitRestriction `json:"restrictions,omitempty"`
	Pricing      *OctoPricing  `json:"pricing,omitempty"`
}

type OctoRestriction struct {
	MinUnits int `json:"minUnits"`
	MaxUnits int `json:"maxUnits"`
}

type OctoUnitRestriction struct {
	MinAge   int `json:"minAge,omitempty"`
	MaxAge   int `json:"maxAge,omitempty"`
	PaxCount int `json:"paxCount"`
}

type OctoPricing struct {
	Original          int    `json:"original"`
	Retail            int    `json:"retail"`
	Net               *int   `json:"net,omitempty"`
	Currency          string `json:"currency"`
	CurrencyPrecision int    `json:"currencyPrecision"`
}

type OctoContent struct {
	Title            string         `json:"title"`
	ShortDescription string         `json:"shortDescription"`
	Description      string         `json:"description"`
	Features         []OctoFeature  `json:"features,omitempty"`
	FAQs             []OctoFAQ      `json:"faqs,omitempty"`
	Media            []OctoMedia    `json:"media,omitempty"`
	DurationMinutesFrom int        `json:"durationMinutesFrom,omitempty"`
}

type OctoFeature struct {
	Type  string `json:"type"`
	Label string `json:"label"`
}

type OctoFAQ struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type OctoMedia struct {
	Src     string `json:"src"`
	Type    string `json:"type"`
	Rel     string `json:"rel"`
}

// Availability

type OctoAvailability struct {
	ID                 string       `json:"id"`
	LocalDateTimeStart string       `json:"localDateTimeStart"`
	LocalDateTimeEnd   string       `json:"localDateTimeEnd"`
	Status             string       `json:"status"`
	Vacancies          *int         `json:"vacancies,omitempty"`
	Available          bool         `json:"available"`
	Pricing            *OctoPricing `json:"pricing,omitempty"`
}

type OctoCalendarEntry struct {
	LocalDate string       `json:"localDate"`
	Status    string       `json:"status"`
	Available bool         `json:"available"`
	Pricing   *OctoPricing `json:"pricing,omitempty"`
}

// Booking

type OctoBookingResponse struct {
	UUID          string            `json:"uuid"`
	Status        string            `json:"status"`
	ProductID     string            `json:"productId"`
	OptionID      string            `json:"optionId"`
	AvailabilityID string           `json:"availabilityId,omitempty"`
	UnitItems     []OctoUnitItem    `json:"unitItems"`
	Contact       *OctoContact      `json:"contact,omitempty"`
	Notes         string            `json:"notes,omitempty"`
	Voucher       *OctoVoucher      `json:"voucher,omitempty"`
	UTCExpiresAt  string            `json:"utcExpiresAt,omitempty"`
	UTCConfirmedAt string           `json:"utcConfirmedAt,omitempty"`
	Cancellable   bool              `json:"cancellable"`
	Pricing       *OctoPricing      `json:"pricing,omitempty"`
}

type OctoUnitItem struct {
	UUID    string       `json:"uuid"`
	UnitID  string       `json:"unitId"`
	Pricing *OctoPricing `json:"pricing,omitempty"`
}

type OctoContact struct {
	FullName     string `json:"fullName,omitempty"`
	EmailAddress string `json:"emailAddress,omitempty"`
	PhoneNumber  string `json:"phoneNumber,omitempty"`
}

type OctoVoucher struct {
	DeliveryOptions []OctoDeliveryOption `json:"deliveryOptions"`
}

type OctoDeliveryOption struct {
	DeliveryFormat string `json:"deliveryFormat"`
	DeliveryValue  string `json:"deliveryValue"`
}

// --- Mappers ---

// PriceToCents 将 float64 AUD 转为 cents (int)
func PriceToCents(price float64) int {
	return int(math.Round(price * 100))
}

// CentsToPrice 将 cents 转为 float64
func CentsToPrice(cents int) float64 {
	return float64(cents) / 100
}

// MapProductToOcto 将 EnjoySA Product 转为 OCTO Product
func MapProductToOcto(p *productmodel.Product, withContent bool, withPricing bool) OctoProduct {
	product := OctoProduct{
		ID:                   strconv.FormatUint(uint64(p.ID), 10),
		InternalName:         p.NameZh,
		Locale:               "en-US",
		TimeZone:             "Australia/Adelaide",
		AllowFreesale:        false,
		InstantConfirmation:  true,
		InstantDelivery:      true,
		AvailabilityRequired: true,
		AvailabilityType:     "START_TIME",
		DeliveryFormats:      []string{"QRCODE"},
		DeliveryMethods:      []string{"VOUCHER"},
		RedemptionMethod:     "DIGITAL",
	}

	// Map packages to options
	for _, pkg := range p.Packages {
		option := mapPackageToOption(&pkg, p, withPricing)
		product.Options = append(product.Options, option)
	}

	// Content capability
	if withContent {
		product.Content = mapContent(p)
	}

	return product
}

func mapPackageToOption(pkg *productmodel.ProductPackage, p *productmodel.Product, withPricing bool) OctoOption {
	// 从 schedules 中聚合 start times
	startTimes := collectStartTimes(p.Schedules, pkg.ID)
	if len(startTimes) == 0 {
		startTimes = []string{"09:00", "14:00"} // fallback
	}

	retailCents := PriceToCents(pkg.Price)
	netCents := int(float64(retailCents) * 0.85) // 默认 85% net

	option := OctoOption{
		ID:                          strconv.FormatUint(uint64(pkg.ID), 10),
		InternalName:                pkg.NameEn,
		AvailabilityLocalStartTimes: startTimes,
		CancellationCutoff:          "You can cancel up to 24 hours before the experience",
		CancellationCutoffAmount:    24,
		CancellationCutoffUnit:      "hour",
		RequiredContactFields:       []string{"fullName", "emailAddress", "phoneNumber"},
		Restrictions:                &OctoRestriction{MinUnits: 1, MaxUnits: 10},
	}

	// Units: ADULT + CHILD
	adultUnit := OctoUnit{
		ID:           fmt.Sprintf("%d-adult", pkg.ID),
		InternalName: "Adult",
		Type:         "ADULT",
		Restrictions: &OctoUnitRestriction{MinAge: 18, PaxCount: 1},
	}
	childUnit := OctoUnit{
		ID:           fmt.Sprintf("%d-child", pkg.ID),
		InternalName: "Child (5-17)",
		Type:         "CHILD",
		Restrictions: &OctoUnitRestriction{MinAge: 5, MaxAge: 17, PaxCount: 1},
	}

	if withPricing {
		adultUnit.Pricing = &OctoPricing{
			Original:          retailCents,
			Retail:            retailCents,
			Net:               &netCents,
			Currency:          "AUD",
			CurrencyPrecision: 2,
		}
		childNetCents := int(float64(retailCents) * 0.5 * 0.85)
		childRetailCents := int(float64(retailCents) * 0.5)
		childUnit.Pricing = &OctoPricing{
			Original:          childRetailCents,
			Retail:            childRetailCents,
			Net:               &childNetCents,
			Currency:          "AUD",
			CurrencyPrecision: 2,
		}
	}

	option.Units = []OctoUnit{adultUnit, childUnit}
	return option
}

func collectStartTimes(schedules []productmodel.ProductSchedule, packageID uint) []string {
	seen := make(map[string]bool)
	var times []string
	for _, s := range schedules {
		if s.PackageID == packageID && s.TimeSlot != "" && !seen[s.TimeSlot] {
			seen[s.TimeSlot] = true
			times = append(times, s.TimeSlot)
		}
	}
	return times
}

func mapContent(p *productmodel.Product) *OctoContent {
	content := &OctoContent{
		Title:            p.NameEn,
		ShortDescription: p.SummaryEn,
		Description:      p.DescriptionEn,
	}

	// Duration
	content.DurationMinutesFrom = parseDurationMinutes(p.Duration)

	// Highlights → Features
	for _, hl := range p.Highlights {
		content.Features = append(content.Features, OctoFeature{
			Type:  "HIGHLIGHT",
			Label: hl.TitleEn + " — " + hl.DescEn,
		})
	}

	// FAQs
	for _, faq := range p.FAQs {
		content.FAQs = append(content.FAQs, OctoFAQ{
			Question: faq.QuestionEn,
			Answer:   faq.AnswerEn,
		})
	}

	// Images → Media
	for _, img := range p.Images {
		rel := "GALLERY"
		if img.IsCover {
			rel = "COVER"
		}
		content.Media = append(content.Media, OctoMedia{
			Src:  img.URL,
			Type: "image/jpeg",
			Rel:  rel,
		})
	}

	return content
}

func parseDurationMinutes(duration string) int {
	d := strings.ToLower(strings.TrimSpace(duration))
	switch {
	case strings.Contains(d, "full day"):
		return 480
	case strings.Contains(d, "half day"):
		return 240
	case strings.Contains(d, "per night"):
		return 1440
	default:
		// Try "3 hours", "45 min" etc
		d = strings.ReplaceAll(d, "hours", "h")
		d = strings.ReplaceAll(d, "hour", "h")
		d = strings.ReplaceAll(d, "min", "m")
		d = strings.TrimSpace(d)
		if strings.HasSuffix(d, "h") {
			if n, err := strconv.Atoi(strings.TrimSuffix(d, "h")); err == nil {
				return n * 60
			}
		}
		if strings.HasSuffix(d, "m") {
			d = strings.TrimSpace(strings.TrimSuffix(d, "m"))
			if n, err := strconv.Atoi(d); err == nil {
				return n
			}
		}
		// "3h" style
		parts := strings.SplitN(d, " ", 2)
		if len(parts) >= 1 {
			if n, err := strconv.Atoi(parts[0]); err == nil {
				return n * 60
			}
		}
		return 0
	}
}

// ParseDurationMinutesExported 导出版本
func ParseDurationMinutesExported(duration string) int {
	return parseDurationMinutes(duration)
}

// GetCapabilities 从 gin context 获取 capabilities
func GetCapabilities(c *gin.Context) map[string]bool {
	caps, exists := c.Get("octo_capabilities")
	if !exists {
		return make(map[string]bool)
	}
	capMap, ok := caps.(map[string]bool)
	if !ok {
		return make(map[string]bool)
	}
	return capMap
}
