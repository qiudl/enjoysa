package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"enjoysa-backend/internal/models"
	notifservice "enjoysa-backend/internal/notification/service"
	ordermodel "enjoysa-backend/internal/order/model"
	"enjoysa-backend/internal/order/store"
	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// REQ-20260509-0035: structured order error codes — frontend branches on
// these for tailored toast text.
const (
	codeInsufficientStock = "INSUFFICIENT_STOCK"
)

type OrderHandler struct {
	orderStore    *store.OrderStore
	productStore  *productstore.ProductStore
	scheduleStore *productstore.ScheduleStore
	notifSvc      *notifservice.NotificationService
	// REQ-20260510-0004: optional — when wired, the order create path
	// asynchronously fires inventory_low / inventory_out notifications
	// after the stock decrement commits.
	stockAlertSvc *notifservice.StockAlertService
}

func NewOrderHandler(
	orderStore *store.OrderStore,
	productStore *productstore.ProductStore,
	scheduleStore *productstore.ScheduleStore,
	notifSvc *notifservice.NotificationService,
) *OrderHandler {
	return &OrderHandler{
		orderStore:    orderStore,
		productStore:  productStore,
		scheduleStore: scheduleStore,
		notifSvc:      notifSvc,
	}
}

// SetStockAlertService wires up REQ-20260510-0004 inventory alerts.
// Optional so legacy wiring / tests still build without alerts.
func (h *OrderHandler) SetStockAlertService(svc *notifservice.StockAlertService) {
	h.stockAlertSvc = svc
}

type CreateOrderRequest struct {
	ProductID    uint   `json:"product_id" binding:"required"`
	PackageID    uint   `json:"package_id" binding:"required"`
	ScheduleID   *uint  `json:"schedule_id"`
	Quantity     int    `json:"quantity" binding:"required,min=1"`
	GuestCount   int    `json:"guest_count"`
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`
	ContactEmail string `json:"contact_email"`
	UserRemark   string `json:"user_remark"`
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	user := c.MustGet("user").(*models.User)

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Load product
	product, err := h.productStore.GetByID(req.ProductID)
	if err != nil {
		response.NotFound(c, "Product not found")
		return
	}
	if product.Status != "approved" {
		response.BadRequest(c, "Product is not available")
		return
	}

	// Find package
	var unitPrice float64
	var packageName string
	for _, pkg := range product.Packages {
		if pkg.ID == req.PackageID {
			unitPrice = pkg.Price
			packageName = pkg.NameEn
			break
		}
	}
	if unitPrice == 0 {
		response.BadRequest(c, "Package not found")
		return
	}

	// Check schedule if provided
	var bookingDate time.Time
	var timeSlot string
	if req.ScheduleID != nil {
		schedule, err := h.scheduleStore.GetByID(*req.ScheduleID)
		if err != nil {
			response.NotFound(c, "Schedule not found")
			return
		}
		if schedule.ProductID != product.ID {
			response.BadRequest(c, "Schedule does not belong to this product")
			return
		}
		if schedule.AvailableSlots() < req.Quantity {
			response.BadRequest(c, "Not enough available slots")
			return
		}
		bookingDate = schedule.Date
		timeSlot = schedule.TimeSlot
		if schedule.Price != nil {
			unitPrice = *schedule.Price
		}

		// Reserve slots
		if err := h.scheduleStore.DecrementSlot(schedule.ID, req.Quantity); err != nil {
			response.BadRequest(c, "Failed to reserve slots")
			return
		}
	} else {
		bookingDate = time.Now()
	}

	totalPrice := unitPrice * float64(req.Quantity)

	guestCount := req.GuestCount
	if guestCount == 0 {
		guestCount = req.Quantity
	}

	order := &ordermodel.Order{
		Status:       ordermodel.OrderStatusPending,
		UserID:       user.ID,
		UserName:     user.Name,
		UserPhone:    user.Phone,
		UserEmail:    user.Email,
		SupplierID:   product.SupplierID,
		SupplierName: product.Supplier.Name,
		ProductID:    product.ID,
		ProductName:  product.NameEn,
		PackageID:    req.PackageID,
		PackageName:  packageName,
		ScheduleID:   req.ScheduleID,
		BookingDate:  bookingDate,
		TimeSlot:     timeSlot,
		Quantity:     req.Quantity,
		GuestCount:   guestCount,
		UnitPrice:    unitPrice,
		TotalPrice:   totalPrice,
		Currency:     "AUD",
		ContactName:  req.ContactName,
		ContactPhone: req.ContactPhone,
		ContactEmail: req.ContactEmail,
		UserRemark:   req.UserRemark,
	}

	if order.ContactName == "" {
		order.ContactName = user.Name
	}
	if order.ContactEmail == "" {
		order.ContactEmail = user.Email
	}

	// REQ-20260509-0035: 库存预扣 + 订单创建放进同一事务，避免超卖。
	// SELECT FOR UPDATE 风格的条件 UPDATE 在 DecrementPackageStock 内部处理。
	// stock_total = -1 的历史商品自动跳过库存校验（无限量），零回归。
	// 注意：schedule slot dec 保留原行为不在 tx 内（status quo，超出本期范围）。
	err = h.productStore.DB().Transaction(func(tx *gorm.DB) error {
		if err := h.productStore.DecrementPackageStock(tx, req.PackageID, req.Quantity); err != nil {
			return err
		}
		return tx.Create(order).Error
	})
	if errors.Is(err, productstore.ErrInsufficientStock) {
		// schedule 已经预占了 slot，需要回补，否则那个 slot 永远 leak
		if req.ScheduleID != nil {
			h.scheduleStore.IncrementSlot(*req.ScheduleID, req.Quantity)
		}
		response.Fail(c, http.StatusUnprocessableEntity, codeInsufficientStock, "Not enough stock for this package")
		return
	}
	if err != nil {
		if req.ScheduleID != nil {
			h.scheduleStore.IncrementSlot(*req.ScheduleID, req.Quantity)
		}
		response.ServerError(c, "Failed to create order")
		return
	}

	// Record history
	h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      order.ID,
		ToStatus:     ordermodel.OrderStatusPending,
		OperatorID:   &user.ID,
		OperatorType: "user",
		Remark:       "Order created",
	})

	// Notify supplier
	if h.notifSvc != nil {
		_ = h.notifSvc.Send("supplier", order.SupplierID, "new_order",
			"New Order Received",
			fmt.Sprintf("Order #%s for %s — %d unit(s), AUD %.2f", order.OrderNo, order.ProductName, order.Quantity, order.TotalPrice),
			"order", order.ID)
	}

	// REQ-20260510-0004: low-stock / sold-out alert. Fire-and-forget on a
	// goroutine so a slow alert path can't delay the order response, and
	// recover so any panic in the alert pipeline can't crash the server.
	if h.stockAlertSvc != nil && order.PackageID > 0 {
		pkgID := order.PackageID
		productID := order.ProductID
		productName := order.ProductName
		packageName := order.PackageName
		supplierID := order.SupplierID
		go func() {
			defer func() {
				_ = recover()
			}()
			h.stockAlertSvc.MaybeFireAlert(pkgID, productID, productName, packageName, supplierID)
		}()
	}

	response.Created(c, order)
}

func (h *OrderHandler) ListUserOrders(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	orders, total, err := h.orderStore.List(store.OrderFilter{
		UserID:   userID,
		Status:   c.Query("status"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list orders")
		return
	}

	response.Paginated(c, orders, total, page, pageSize)
}

func (h *OrderHandler) GetOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	param := c.Param("id")

	var order *ordermodel.Order
	var err error

	id, parseErr := strconv.ParseUint(param, 10, 32)
	if parseErr == nil {
		order, err = h.orderStore.GetByID(uint(id))
	} else {
		order, err = h.orderStore.GetByOrderNo(param)
	}

	if err != nil {
		response.NotFound(c, "Order not found")
		return
	}
	if order.UserID != userID {
		response.Forbidden(c, "Access denied")
		return
	}

	response.Success(c, order)
}

func (h *OrderHandler) CancelOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	order, err := h.orderStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Order not found")
		return
	}
	if order.UserID != userID {
		response.Forbidden(c, "Access denied")
		return
	}

	if order.Status != ordermodel.OrderStatusPending && order.Status != ordermodel.OrderStatusPaid {
		response.BadRequest(c, "Order cannot be cancelled in current status")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	oldStatus := order.Status
	now := time.Now()
	order.Status = ordermodel.OrderStatusCancelled
	order.CancelledAt = &now
	order.CancelReason = req.Reason

	if err := h.orderStore.Update(order); err != nil {
		response.ServerError(c, "Failed to cancel order")
		return
	}

	// Notify supplier
	if h.notifSvc != nil {
		_ = h.notifSvc.Send("supplier", order.SupplierID, "order_cancelled",
			"Order Cancelled",
			fmt.Sprintf("Order #%s for %s has been cancelled", order.OrderNo, order.ProductName),
			"order", order.ID)
	}

	// Release schedule slots if applicable
	if order.ScheduleID != nil {
		h.scheduleStore.IncrementSlot(*order.ScheduleID, order.Quantity)
	}

	// REQ-20260509-0035: refund package stock so the seat opens back up.
	// stock_total = -1 (unlimited) packages skip refund automatically (the
	// store-level WHERE clause filters them out). GREATEST(0) guard prevents
	// negative stock_sold under stale data.
	if order.PackageID > 0 {
		_ = h.productStore.IncrementPackageStock(nil, order.PackageID, order.Quantity)
	}

	h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      order.ID,
		FromStatus:   oldStatus,
		ToStatus:     ordermodel.OrderStatusCancelled,
		OperatorID:   &userID,
		OperatorType: "user",
		Remark:       req.Reason,
	})

	response.SuccessMessage(c, "Order cancelled")
}

func (h *OrderHandler) GetOrderHistory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	history, err := h.orderStore.GetHistory(uint(id))
	if err != nil {
		response.ServerError(c, "Failed to get history")
		return
	}

	response.Success(c, history)
}
