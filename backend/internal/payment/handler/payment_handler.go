package handler

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"enjoysa-backend/internal/core/logger"
	ordermodel "enjoysa-backend/internal/order/model"
	orderstore "enjoysa-backend/internal/order/store"
	"enjoysa-backend/internal/payment/gateway"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// REQ-20260509-0034: structured error codes — frontend branches on these
// to render the right user message without parsing localized text.
const (
	codePaymentDisabled = "PAYMENT_DISABLED"
	codeStripeError     = "STRIPE_ERROR"
	codeOrderInvalid    = "ORDER_INVALID"
	codeOrderNotFound   = "ORDER_NOT_FOUND"
	codeAccessDenied    = "ACCESS_DENIED"
)

type PaymentHandler struct {
	orderStore     *orderstore.OrderStore
	paymentGateway gateway.PaymentGateway
	frontendURL    string
}

func NewPaymentHandler(
	orderStore *orderstore.OrderStore,
	paymentGateway gateway.PaymentGateway,
	frontendURL string,
) *PaymentHandler {
	return &PaymentHandler{
		orderStore:     orderStore,
		paymentGateway: paymentGateway,
		frontendURL:    frontendURL,
	}
}

type CreateCheckoutRequest struct {
	OrderID uint `json:"order_id" binding:"required"`
}

func (h *PaymentHandler) CreateCheckoutSession(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var req CreateCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, codeOrderInvalid, "Invalid request")
		return
	}

	order, err := h.orderStore.GetByID(req.OrderID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, codeOrderNotFound, "Order not found")
		return
	}
	if order.UserID != userID {
		response.Fail(c, http.StatusForbidden, codeAccessDenied, "Access denied")
		return
	}
	if order.Status != ordermodel.OrderStatusPending {
		response.Fail(c, http.StatusUnprocessableEntity, codeOrderInvalid, "Order is not pending payment")
		return
	}

	// Check if expired
	if order.ExpiresAt != nil && order.ExpiresAt.Before(time.Now()) {
		order.Status = ordermodel.OrderStatusCancelled
		h.orderStore.Update(order)
		response.Fail(c, http.StatusUnprocessableEntity, codeOrderInvalid, "Order has expired")
		return
	}

	if h.paymentGateway == nil {
		// REQ-20260509-0034: 503 + PAYMENT_DISABLED so the frontend can show
		// a "支付服务暂时不可用" toast instead of falling through to a fake
		// success page (the historical bug).
		logger.Errorf("CreateCheckoutSession: payment gateway is nil — Stripe key missing in config")
		response.Fail(c, http.StatusServiceUnavailable, codePaymentDisabled, "Payment service is not configured")
		return
	}

	amountCents := int64(order.TotalPrice * 100)

	sess, err := h.paymentGateway.CreateCheckoutSession(gateway.CheckoutParams{
		OrderNo:     order.OrderNo,
		ProductName: order.ProductName + " - " + order.PackageName,
		Amount:      amountCents,
		Currency:    order.Currency,
		SuccessURL:  fmt.Sprintf("%s/orders/%d?status=success", h.frontendURL, order.ID),
		CancelURL:   fmt.Sprintf("%s/orders/%d?status=cancel", h.frontendURL, order.ID),
	})
	if err != nil {
		logger.Errorf("CreateCheckoutSession: stripe create failed for order %d (%s): %v", order.ID, order.OrderNo, err)
		response.Fail(c, http.StatusBadGateway, codeStripeError, "Failed to create payment session")
		return
	}

	// Save session ID
	order.StripeSessionID = sess.SessionID
	h.orderStore.Update(order)

	logger.Infof("CreateCheckoutSession: order %d (%s) → session %s", order.ID, order.OrderNo, sess.SessionID)

	response.Success(c, gin.H{
		"session_id":   sess.SessionID,
		"checkout_url": sess.URL,
	})
}

func (h *PaymentHandler) StripeWebhook(c *gin.Context) {
	if h.paymentGateway == nil {
		response.BadRequest(c, "Payment not configured")
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		response.BadRequest(c, "Failed to read body")
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	event, err := h.paymentGateway.VerifyWebhookSignature(payload, signature)
	if err != nil {
		logger.Errorf("Webhook signature failed: %v", err)
		response.BadRequest(c, "Invalid signature")
		return
	}

	if event.Type == "checkout.session.completed" {
		order, err := h.orderStore.GetByStripeSessionID(event.SessionID)
		if err != nil {
			logger.Errorf("Order not found for session %s", event.SessionID)
			response.NotFound(c, "Order not found")
			return
		}

		if order.Status == ordermodel.OrderStatusPending {
			now := time.Now()
			order.Status = ordermodel.OrderStatusPaid
			order.PaymentMethod = "stripe"
			order.PaymentTime = &now
			order.PaymentRef = event.PaymentIntentID
			order.StripePaymentIntentID = event.PaymentIntentID
			order.ExpiresAt = nil // No longer expires

			h.orderStore.Update(order)

			h.orderStore.AddHistory(&ordermodel.OrderStatusHistory{
				OrderID:      order.ID,
				FromStatus:   ordermodel.OrderStatusPending,
				ToStatus:     ordermodel.OrderStatusPaid,
				OperatorType: "system",
				Remark:       "Payment received via Stripe",
			})

			logger.Infof("Order %s paid via Stripe", order.OrderNo)
		}
	}

	response.SuccessMessage(c, "ok")
}
