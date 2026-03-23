package handler

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"time"

	ordermodel "enjoysa-backend/internal/order/model"
	productmodel "enjoysa-backend/internal/product/model"
	settlementmodel "enjoysa-backend/internal/settlement/model"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ExportHandler struct {
	db *gorm.DB
}

func NewExportHandler(db *gorm.DB) *ExportHandler {
	return &ExportHandler{db: db}
}

func getSupplierID(c *gin.Context) uint {
	id, _ := c.Get("supplier_id")
	return id.(uint)
}

func parseDateRange(c *gin.Context) (string, string) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" {
		startDate = time.Now().AddDate(0, -1, 0).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}
	return startDate, endDate
}

func (h *ExportHandler) ExportOrders(c *gin.Context) {
	supplierID := getSupplierID(c)
	startDate, endDate := parseDateRange(c)

	var orders []ordermodel.Order
	query := h.db.Where("supplier_id = ?", supplierID)
	if startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
	}
	if err := query.Order("id DESC").Limit(10000).Find(&orders).Error; err != nil {
		response.ServerError(c, "Failed to query orders")
		return
	}
	if len(orders) == 0 {
		response.BadRequest(c, "No data in selected date range")
		return
	}

	filename := fmt.Sprintf("orders_%s_%s.csv", startDate, endDate)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	w.Write([]string{"Order No", "Product", "Customer", "Travel Date", "Qty", "Unit Price", "Total", "Status", "Created"})

	for _, o := range orders {
		w.Write([]string{
			o.OrderNo,
			o.ProductName,
			o.UserName,
			o.BookingDate.Format("2006-01-02"),
			strconv.Itoa(o.Quantity),
			fmt.Sprintf("%.2f", o.UnitPrice),
			fmt.Sprintf("%.2f", o.TotalPrice),
			string(o.Status),
			o.CreatedAt.Format("2006-01-02"),
		})
	}
	w.Flush()
}

func (h *ExportHandler) ExportSettlements(c *gin.Context) {
	supplierID := getSupplierID(c)

	var settlements []settlementmodel.Settlement
	if err := h.db.Where("supplier_id = ?", supplierID).
		Order("created_at DESC").Limit(10000).
		Find(&settlements).Error; err != nil {
		response.ServerError(c, "Failed to query settlements")
		return
	}
	if len(settlements) == 0 {
		response.BadRequest(c, "No data in selected date range")
		return
	}

	filename := fmt.Sprintf("settlements_%s.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	w.Write([]string{"Settlement No", "Period", "Orders", "Gross", "Commission", "Net", "Status", "Created"})

	for _, s := range settlements {
		w.Write([]string{
			s.SettlementNo,
			s.PeriodStart + " ~ " + s.PeriodEnd,
			strconv.Itoa(s.OrderCount),
			fmt.Sprintf("%.2f", s.GrossAmount),
			fmt.Sprintf("%.2f", s.Commission),
			fmt.Sprintf("%.2f", s.NetAmount),
			s.Status,
			s.CreatedAt.Format("2006-01-02"),
		})
	}
	w.Flush()
}

func (h *ExportHandler) ExportProducts(c *gin.Context) {
	supplierID := getSupplierID(c)

	var products []productmodel.Product
	if err := h.db.Where("supplier_id = ?", supplierID).
		Preload("Category").Preload("Region").
		Order("id DESC").Limit(10000).
		Find(&products).Error; err != nil {
		response.ServerError(c, "Failed to query products")
		return
	}
	if len(products) == 0 {
		response.BadRequest(c, "No data in selected date range")
		return
	}

	filename := fmt.Sprintf("products_%s.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	w.Write([]string{"ID", "Name(EN)", "Name(ZH)", "Category", "Region", "Price", "Status", "Rating", "Reviews", "Created"})

	for _, p := range products {
		categoryName := ""
		if p.Category != nil {
			categoryName = p.Category.NameEn
		}
		regionName := ""
		if p.Region != nil {
			regionName = p.Region.NameEn
		}
		w.Write([]string{
			strconv.FormatUint(uint64(p.ID), 10),
			p.NameEn,
			p.NameZh,
			categoryName,
			regionName,
			fmt.Sprintf("%.2f", p.PriceFrom),
			string(p.Status),
			fmt.Sprintf("%.1f", p.Rating),
			strconv.Itoa(p.ReviewCount),
			p.CreatedAt.Format("2006-01-02"),
		})
	}
	w.Flush()
}
