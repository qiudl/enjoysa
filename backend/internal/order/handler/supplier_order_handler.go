package handler

import (
	"errors"
	"fmt"
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

// codeRefundDuplicate is returned (HTTP 409) when a refund is already in
// progress or completed for the order — i.e. a concurrent/duplicate refund
// attempt was rejected. Follows the DOMAIN_CATEGORY_REASON convention.
const codeRefundDuplicate = "ORDER_REFUND_DUPLICATE"

// refundOrphanRetries is how many times the orphan path retries persisting the
// terminal refunded state before giving up and alerting for human reconciliation.
const refundOrphanRetries = 3

// refundAlerter is the subset of the Feishu client the refund path needs. It is
// an interface so the alert *timing* can be unit-tested with a mock
// (*feishu.Client satisfies it).
//   - AlertRefundOrphan: money left Stripe but the terminal state could not be
//     recorded (orphan A — funds at risk).
//   - AlertRefundStuck: Stripe refund failed AND the failure could not be
//     recorded, so the order is stuck in processing (orphan B — no funds moved,
//     but the refund lock blocks retries until a human releases it).
type refundAlerter interface {
	AlertRefundOrphan(orderNo string, amountAUD float64, err error)
	AlertRefundStuck(orderNo string, err error)
}

type SupplierOrderHandler struct {
	orderStore     *store.OrderStore
	productStore   *productstore.ProductStore
	paymentGateway gateway.PaymentGateway
	alerter        refundAlerter
	// persistRefundResult records the post-Stripe order state with a bounded
	// in-request retry to self-heal a transient DB blip. There is intentionally
	// NO background reconciliation job yet — for the soft launch the fallback is
	// the AlertRefund* alerts + manual reconciliation; an automatic reconcile
	// job that sweeps stuck "processing" orders is post-launch backlog.
	// Injectable so tests can drive the "self-healed" vs "could-not-heal"
	// branches deterministically.
	persistRefundResult func(*ordermodel.Order) error
}

func NewSupplierOrderHandler(orderStore *store.OrderStore, productStore *productstore.ProductStore, paymentGateway gateway.PaymentGateway, alerter refundAlerter) *SupplierOrderHandler {
	h := &SupplierOrderHandler{
		orderStore:     orderStore,
		productStore:   productStore,
		paymentGateway: paymentGateway,
		alerter:        alerter,
	}
	h.persistRefundResult = h.persistRefundWithRetry
	return h
}

// persistRefundWithRetry persists the terminal refunded order state, retrying a
// few times with a short backoff to ride out a transient DB blip (the
// reconciliation "self-heal" step). Returns the last error if it never
// succeeds. The backoff is deliberately small and bounded (~50ms+100ms worst
// case) because this runs synchronously in the refund request — long enough to
// span a momentary blip, short enough not to hang the caller; a real outage
// still fails fast and falls through to AlertRefundOrphan.
func (h *SupplierOrderHandler) persistRefundWithRetry(order *ordermodel.Order) error {
	var err error
	for i := 0; i < refundOrphanRetries; i++ {
		if i > 0 {
			time.Sleep(time.Duration(i) * 50 * time.Millisecond)
		}
		if err = h.orderStore.Update(order); err == nil {
			return nil
		}
	}
	return err
}

// refundIdempotencyKey derives a stable Stripe Idempotency-Key from the order
// number so retried/concurrent refunds for the same order never double-refund.
func refundIdempotencyKey(orderNo string) string {
	return "refund-" + orderNo
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

	// Trigger refund (idempotency-keyed so a retried reject can't double-refund).
	if order.StripePaymentIntentID != "" && h.paymentGateway != nil {
		amountCents := int64(math.Round(order.TotalPrice * 100))
		if err := h.paymentGateway.Refund(order.StripePaymentIntentID, amountCents, refundIdempotencyKey(order.OrderNo)); err == nil {
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
	// Early UX validation (the authoritative re-check happens under the row
	// lock in ClaimRefundIntent below, so this is only for friendly errors).
	// Check the duplicate-refund case first: a completed refund leaves the
	// order in status=Refunded, which would otherwise fall into the
	// "not refundable" branch and mask the real reason (it's a duplicate).
	if order.RefundStatus == "processing" || order.RefundStatus == "completed" {
		response.Fail(c, 409, codeRefundDuplicate, "Refund already in progress or completed")
		return
	}
	if order.Status != ordermodel.OrderStatusPaid && order.Status != ordermodel.OrderStatusAccepted {
		response.BadRequest(c, "Order can only be refunded when paid or accepted")
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

	// LAYER 1 — prevention: atomically claim the refund under a row lock so two
	// concurrent requests can never both proceed to call Stripe. The loser of
	// the race (and any retry of an already-claimed refund) is rejected here,
	// before any money moves.
	locked, err := h.orderStore.ClaimRefundIntent(uint(id), req.Type, refundAmount)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrRefundInProgress):
			response.Fail(c, 409, codeRefundDuplicate, "Refund already in progress or completed")
		case errors.Is(err, store.ErrOrderNotRefundable):
			response.BadRequest(c, "Order can only be refunded when paid or accepted")
		default:
			log.Printf("[RefundOrder] ClaimRefundIntent failed for order %d: %v", id, err)
			response.ServerError(c, "Failed to start refund")
		}
		return
	}

	now := time.Now()
	oldStatus := locked.Status
	locked.RefundReason = req.Reason

	// Call Stripe with a stable idempotency key (LAYER 1, gateway side): a
	// retried/concurrent Stripe call with the same key returns the original
	// refund instead of issuing a second one.
	if locked.StripePaymentIntentID != "" && h.paymentGateway != nil {
		amountCents := int64(math.Round(refundAmount * 100))
		if err := h.paymentGateway.Refund(locked.StripePaymentIntentID, amountCents, refundIdempotencyKey(locked.OrderNo)); err != nil {
			log.Printf("[RefundOrder] Stripe refund failed for order %d: %v", locked.ID, err)
			// No money moved. Release the claim by recording "failed" (which
			// ClaimRefundIntent does NOT block, so the customer can retry; the
			// stable idempotency key keeps a later retry safe). Retry the write
			// to ride out a transient DB blip.
			locked.RefundStatus = "failed"
			if perr := h.persistRefundResult(locked); perr != nil {
				// Orphan B: Stripe didn't refund AND we couldn't record the
				// failure, so the order is stuck in processing and the refund
				// lock blocks retries. Funds are safe, but don't go silent —
				// alert so a human can release it.
				log.Printf("[RefundOrder] STUCK: Stripe refund failed and status write failed for order %d (%s): %v", locked.ID, locked.OrderNo, perr)
				h.alerter.AlertRefundStuck(locked.OrderNo, perr)
			}
			response.ServerError(c, "Refund failed, please try again later")
			return
		}
	}

	locked.RefundStatus = "completed"
	locked.RefundedAt = &now
	locked.Status = ordermodel.OrderStatusRefunded

	// LAYER 2 + 3 — the "Stripe succeeded but DB write failed" window. Money is
	// already out of Stripe; persistRefundResult retries to self-heal the
	// terminal state. If it still cannot record it, leave RefundStatus at
	// "processing" (NOT failed — a failed flag would invite a real double
	// refund) and fire the highest-severity alert for human reconciliation.
	if err := h.persistRefundResult(locked); err != nil {
		log.Printf("[RefundOrder] ORPHAN: Stripe refunded but DB update failed for order %d (%s): %v", locked.ID, locked.OrderNo, err)
		h.alerter.AlertRefundOrphan(locked.OrderNo, refundAmount, err)
		response.ServerError(c, "Refund issued but order state could not be saved; flagged for manual reconciliation")
		return
	}

	h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
		OrderID:      locked.ID,
		FromStatus:   oldStatus,
		ToStatus:     locked.Status,
		OperatorID:   &supplierUserID,
		OperatorType: "supplier",
		Remark:       fmt.Sprintf("Refund (%s): %s", req.Type, req.Reason),
	})
	order = locked

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
