package handler

import (
	"fmt"
	"io"
	"time"

	"enjoysa-backend/internal/core/logger"
	ordermodel "enjoysa-backend/internal/order/model"
	orderstore "enjoysa-backend/internal/order/store"
	"enjoysa-backend/internal/payment/gateway"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
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
		response.BadRequest(c, "Invalid request")
		return
	}

	order, err := h.orderStore.GetByID(req.OrderID)
	if err != nil {
		response.NotFound(c, "Order not found")
		return
	}
	if order.UserID != userID {
		response.Forbidden(c, "Access denied")
		return
	}
	if order.Status != ordermodel.OrderStatusPending {
		response.BadRequest(c, "Order is not pending payment")
		return
	}

	// Check if expired
	if order.ExpiresAt != nil && order.ExpiresAt.Before(time.Now()) {
		order.Status = ordermodel.OrderStatusCancelled
		h.orderStore.Update(order)
		response.BadRequest(c, "Order has expired")
		return
	}

	if h.paymentGateway == nil {
		response.BadRequest(c, "Payment not configured")
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
		logger.Errorf("Failed to create checkout session: %v", err)
		response.ServerError(c, "Failed to create payment session")
		return
	}

	// Save session ID
	order.StripeSessionID = sess.SessionID
	h.orderStore.Update(order)

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
