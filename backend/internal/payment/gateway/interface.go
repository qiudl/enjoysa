package gateway

type CheckoutSession struct {
	SessionID  string `json:"session_id"`
	URL        string `json:"url"`
	PaymentRef string `json:"payment_ref"`
}

type CheckoutParams struct {
	OrderNo     string
	ProductName string
	Amount      int64 // in cents
	Currency    string
	SuccessURL  string
	CancelURL   string
}

type WebhookEvent struct {
	Type             string
	SessionID        string
	PaymentIntentID  string
}

type PaymentGateway interface {
	CreateCheckoutSession(params CheckoutParams) (*CheckoutSession, error)
	VerifyWebhookSignature(payload []byte, signature string) (*WebhookEvent, error)
	// Refund issues a refund against the given PaymentIntent. idempotencyKey is
	// forwarded to Stripe as its Idempotency-Key so a retried or concurrent call
	// with the same key never results in a second (double) refund.
	Refund(paymentIntentID string, amount int64, idempotencyKey string) error
}
