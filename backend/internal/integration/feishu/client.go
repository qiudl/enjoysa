package feishu

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ErrNotConfigured signals that no webhook URL is set; callers should respond
// with HTTP 503 (or skip the share entirely).
var ErrNotConfigured = errors.New("feishu webhook not configured")

// Client posts InteractiveCards to a single Feishu group bot webhook.
type Client struct {
	webhookURL string
	httpClient *http.Client
}

// NewClient returns nil when webhookURL is empty, so feature flags can fall
// back to ErrNotConfigured by checking c == nil at the call site.
func NewClient(webhookURL string) *Client {
	if webhookURL == "" {
		return nil
	}
	return &Client{
		webhookURL: webhookURL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

// SendCard posts the card and returns the Feishu message_id when available.
// One short retry is attempted on transient transport errors.
func (c *Client) SendCard(ctx context.Context, card InteractiveCard) (string, error) {
	if c == nil {
		return "", ErrNotConfigured
	}

	payload := BuildCardJSON(card)
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("feishu: marshal card: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		msgID, err := c.postOnce(ctx, body)
		if err == nil {
			return msgID, nil
		}
		lastErr = err
		// Only retry on context-independent transport problems.
		if ctx.Err() != nil {
			break
		}
	}
	return "", lastErr
}

func (c *Client) postOnce(ctx context.Context, body []byte) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.webhookURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("feishu: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("feishu: post: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("feishu: status %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			MessageID string `json:"message_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		// 200 with body we cannot parse is still "delivered" — return without ID.
		return "", nil
	}
	if parsed.Code != 0 {
		return "", fmt.Errorf("feishu: code %d: %s", parsed.Code, parsed.Msg)
	}
	return parsed.Data.MessageID, nil
}
