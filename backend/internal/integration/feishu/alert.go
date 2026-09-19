package feishu

import (
	"context"
	"fmt"
	"time"
)

// SendAlert posts a plain-text financial alert to the Feishu group webhook.
// It is a no-op when the client is nil (webhook not configured).
func (c *Client) SendAlert(title, body string) error {
	if c == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	card := InteractiveCard{
		Title:     "🚨 " + title,
		Question:  body,
		Answer:    "",
		Sender:    "EnjoySA System",
		Timestamp: time.Now(),
	}
	_, err := c.SendCard(ctx, card)
	return err
}

// AlertRefundOrphan is called when Stripe has already issued a refund but the
// subsequent DB update failed — money is out but the order record is stuck in
// processing. This is the highest-severity financial alert.
func (c *Client) AlertRefundOrphan(orderNo string, amountAUD float64, err error) {
	msg := fmt.Sprintf(
		"訂單 %s：Stripe 退款已成功（AUD %.2f），但 DB update 失敗 → RefundStatus 卡在 processing。需人工核對訂單狀態。錯誤：%v",
		orderNo, amountAUD, err,
	)
	_ = c.SendAlert("退款孤兒 — 人工核對", msg)
}

// AlertStripeWebhookSigFail is called when Stripe webhook signature verification
// fails — could indicate a replay attack or misconfigured webhook secret.
func (c *Client) AlertStripeWebhookSigFail(remoteAddr string, err error) {
	msg := fmt.Sprintf("Stripe webhook 驗簽失敗（來源 %s）：%v", remoteAddr, err)
	_ = c.SendAlert("Stripe Webhook 驗簽失敗", msg)
}

// AlertStripeOrderMissing is called when Stripe fires checkout.session.completed
// but no matching order is found — payment received with no order to fulfill.
func (c *Client) AlertStripeOrderMissing(sessionID string) {
	msg := fmt.Sprintf("Stripe session %s 已完成付款，但找不到對應訂單 — 資金在 Stripe，平台無記錄。需人工核查。", sessionID)
	_ = c.SendAlert("Stripe 付款無訂單匹配", msg)
}
