package handler

import (
	"log"
	"math"
	"strconv"
	"time"

	ordermodel "enjoysa-backend/internal/order/model"
	"enjoysa-backend/internal/order/store"
	"enjoysa-backend/internal/payment/gateway"
	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type SupplierOrderHandler struct {
	orderStore     *store.OrderStore
	productStore   *productstore.ProductStore
	paymentGateway gateway.PaymentGateway
}

func NewSupplierOrderHandler(orderStore *store.OrderStore, productStore *productstore.ProductStore, paymentGateway gateway.PaymentGateway) *SupplierOrderHandler {
	return &SupplierOrderHandler{
		orderStore:     orderStore,
		productStore:   productStore,
		paymentGateway: paymentGateway,
	}
}

func (h *SupplierOrderHandler) ListOrders(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	orders, total, err := h.orderStore.List(store.OrderFilter{
		SupplierID: supplierID,
		Status:     c.Query("status"),
		Channel:    c.Query("channel"),
		Keyword:    c.Query("keyword"),
		StartDate:  c.Query("start_date"),
		EndDate:    c.Query("end_date"),
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		response.ServerError(c, "Failed to list orders")
		return
	}

	response.Paginated(c, orders, total, page, pageSize)
}

func (h *SupplierOrderHandler) GetOrder(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
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
	if order.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	response.Success(c, order)
}

func (h *SupplierOrderHandler) GetStats(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)

	stats, err := h.orderStore.GetStats(supplierID)
	if err != nil {
		response.ServerError(c, "Failed to get stats")
		return
	}

	response.Success(c, stats)
}

func (h *SupplierOrderHandler) AcceptOrder(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
	supplierUserID := c.MustGet("supplier_user_id").(uint)
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
	if order.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}
	if order.Status != ordermodel.OrderStatusPaid {
		response.BadRequest(c, "Order can only be accepted when paid")
		return
	}

	now := time.Now()
	order.Status = ordermodel.OrderStatusAccepted
	order.AcceptedAt = &now
	order.AcceptedBy = &supplierUserID

	if err := h.orderStore.UpdateWithStatus(order, ordermodel.OrderStatusPaid); err != nil {
		response.BadRequest(c, "Order status has been changed by another operation")
		return
	}

	h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      order.ID,
		FromStatus:   ordermodel.OrderStatusPaid,
		ToStatus:     ordermodel.OrderStatusAccepted,
		OperatorID:   &supplierUserID,
		OperatorType: "supplier",
		Remark:       "Order accepted",
	})

	response.SuccessMessage(c, "Order accepted")
}

func (h *SupplierOrderHandler) RejectOrder(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
	supplierUserID := c.MustGet("supplier_user_id").(uint)
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
	if order.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}
	if order.Status != ordermodel.OrderStatusPaid {
		response.BadRequest(c, "Order can only be rejected when paid")
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Reason is required")
		return
	}

	now := time.Now()
	order.Status = ordermodel.OrderStatusCancelled
	order.RejectedAt = &now
	order.RejectReason = req.Reason

	// Trigger refund
	if order.StripePaymentIntentID != "" && h.paymentGateway != nil {
		amountCents := int64(math.Round(order.TotalPrice * 100))
		if err := h.paymentGateway.Refund(order.StripePaymentIntentID, amountCents); err == nil {
			order.Status = ordermodel.OrderStatusRefunded
			order.RefundedAt = &now
			order.RefundAmount = order.TotalPrice
		}
	}

	if err := h.orderStore.Update(order); err != nil {
		response.ServerError(c, "Failed to reject order")
		return
	}

	// REQ-20260509-0035: refund package stock when supplier rejects.
	if order.PackageID > 0 && h.productStore != nil {
		_ = h.productStore.IncrementPackageStock(nil, order.PackageID, order.Quantity)
	}

	h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      order.ID,
		FromStatus:   ordermodel.OrderStatusPaid,
		ToStatus:     order.Status,
		OperatorID:   &supplierUserID,
		OperatorType: "supplier",
		Remark:       "Rejected: " + req.Reason,
	})

	response.SuccessMessage(c, "Order rejected")
}

func (h *SupplierOrderHandler) CompleteOrder(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
	supplierUserID := c.MustGet("supplier_user_id").(uint)
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
	if order.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}
	if order.Status != ordermodel.OrderStatusAccepted && order.Status != ordermodel.OrderStatusProcessing {
		response.BadRequest(c, "Order can only be completed when accepted or processing")
		return
	}

	oldStatus := order.Status
	now := time.Now()
	order.Status = ordermodel.OrderStatusCompleted
	order.CompletedAt = &now

	if err := h.orderStore.Update(order); err != nil {
		response.ServerError(c, "Failed to complete order")
		return
	}

	h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      order.ID,
		FromStatus:   oldStatus,
		ToStatus:     ordermodel.OrderStatusCompleted,
		OperatorID:   &supplierUserID,
		OperatorType: "supplier",
		Remark:       "Order completed",
	})

	response.SuccessMessage(c, "Order completed")
}

func (h *SupplierOrderHandler) RefundOrder(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
	supplierUserID := c.MustGet("supplier_user_id").(uint)
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
	if order.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}
	if order.Status != ordermodel.OrderStatusPaid && order.Status != ordermodel.OrderStatusAccepted {
		response.BadRequest(c, "Order can only be refunded when paid or accepted")
		return
	}

	// Idempotency: reject if refund already in progress or completed
	if order.RefundStatus == "processing" || order.RefundStatus == "completed" {
		response.BadRequest(c, "Refund already in progress or completed")
		return
	}

	var req struct {
		Amount float64 `json:"amount"`
		Reason string  `json:"reason" binding:"required"`
		Type   string  `json:"type" binding:"required,oneof=full partial"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	refundAmount := order.TotalPrice
	if req.Type == "partial" {
		if req.Amount <= 0 || req.Amount > order.TotalPrice {
			response.BadRequest(c, "Invalid refund amount")
			return
		}
		refundAmount = req.Amount
	}

	now := time.Now()
	oldStatus := order.Status
	order.RefundType = req.Type
	order.RefundReason = req.Reason
	order.RefundStatus = "processing"
	order.RefundAmount = refundAmount

	// Persist processing status before calling Stripe
	if err := h.orderStore.Update(order); err != nil {
		response.ServerError(c, "Failed to update order")
		return
	}

	if order.StripePaymentIntentID != "" && h.paymentGateway != nil {
		amountCents := int64(math.Round(refundAmount * 100))
		if err := h.paymentGateway.Refund(order.StripePaymentIntentID, amountCents); err != nil {
			log.Printf("[RefundOrder] Stripe refund failed for order %d: %v", order.ID, err)
			order.RefundStatus = "failed"
			if updateErr := h.orderStore.Update(order); updateErr != nil {
				log.Printf("[RefundOrder] Failed to update refund_status=failed for order %d: %v", order.ID, updateErr)
			}
			response.ServerError(c, "Refund failed, please try again later")
			return
		}
	}

	order.RefundStatus = "completed"
	order.RefundedAt = &now
	order.Status = ordermodel.OrderStatusRefunded

	if err := h.orderStore.Update(order); err != nil {
		log.Printf("[RefundOrder] Stripe refunded but DB update failed for order %d: %v", order.ID, err)
		response.ServerError(c, "Failed to update order")
		return
	}

	h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      order.ID,
		FromStatus:   oldStatus,
		ToStatus:     order.Status,
		OperatorID:   &supplierUserID,
		OperatorType: "supplier",
		Remark:       "Refund (" + req.Type + "): " + req.Reason,
	})

	response.Success(c, order)
}

func (h *SupplierOrderHandler) UpdateRemark(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
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
	if order.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	var req struct {
		SupplierRemark string `json:"supplier_remark"`
		InternalNote   string `json:"internal_note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	order.SupplierRemark = req.SupplierRemark
	order.InternalNote = req.InternalNote

	if err := h.orderStore.Update(order); err != nil {
		response.ServerError(c, "Failed to update remark")
		return
	}

	response.Success(c, order)
}

func (h *SupplierOrderHandler) GetHistory(c *gin.Context) {
	supplierID := c.MustGet("supplier_id").(uint)
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
	if order.SupplierID != supplierID {
		response.Forbidden(c, "Access denied")
		return
	}

	history, err := h.orderStore.GetHistory(uint(id))
	if err != nil {
		response.ServerError(c, "Failed to get history")
		return
	}

	response.Success(c, history)
}
