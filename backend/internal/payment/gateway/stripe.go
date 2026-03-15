package gateway

import (
	"encoding/json"
	"fmt"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/refund"
	"github.com/stripe/stripe-go/v76/webhook"
)

type StripeGateway struct {
	webhookSecret string
}

func NewStripeGateway(secretKey, webhookSecret string) *StripeGateway {
	stripe.Key = secretKey
	return &StripeGateway{
		webhookSecret: webhookSecret,
	}
}

func (g *StripeGateway) CreateCheckoutSession(params CheckoutParams) (*CheckoutSession, error) {
	sessParams := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(params.Currency),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(params.ProductName),
					},
					UnitAmount: stripe.Int64(params.Amount),
				},
				Quantity: stripe.Int64(1),
			},
		},
		Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
		SuccessURL: stripe.String(params.SuccessURL),
		CancelURL:  stripe.String(params.CancelURL),
		Metadata: map[string]string{
			"order_no": params.OrderNo,
		},
	}

	sess, err := session.New(sessParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create checkout session: %w", err)
	}

	return &CheckoutSession{
		SessionID: sess.ID,
		URL:       sess.URL,
	}, nil
}

func (g *StripeGateway) VerifyWebhookSignature(payload []byte, signature string) (*WebhookEvent, error) {
	event, err := webhook.ConstructEvent(payload, signature, g.webhookSecret)
	if err != nil {
		return nil, fmt.Errorf("webhook signature verification failed: %w", err)
	}

	we := &WebhookEvent{
		Type: string(event.Type),
	}

	if event.Type == "checkout.session.completed" {
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			return nil, fmt.Errorf("failed to parse session: %w", err)
		}
		we.SessionID = sess.ID
		we.PaymentIntentID = sess.PaymentIntent.ID
	}

	return we, nil
}

func (g *StripeGateway) Refund(paymentIntentID string, amount int64) error {
	params := &stripe.RefundParams{
		PaymentIntent: stripe.String(paymentIntentID),
	}
	if amount > 0 {
		params.Amount = stripe.Int64(amount)
	}

	_, err := refund.New(params)
	return err
}
