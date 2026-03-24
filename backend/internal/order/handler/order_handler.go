package handler

import (
	"fmt"
	"strconv"
	"time"

	"enjoysa-backend/internal/models"
	notifservice "enjoysa-backend/internal/notification/service"
	ordermodel "enjoysa-backend/internal/order/model"
	"enjoysa-backend/internal/order/store"
	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	orderStore    *store.OrderStore
	productStore  *productstore.ProductStore
	scheduleStore *productstore.ScheduleStore
	notifSvc      *notifservice.NotificationService
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

	if err := h.orderStore.Create(order); err != nil {
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
