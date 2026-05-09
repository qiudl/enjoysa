package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
)

// LLMErrorCategory tags an upstream LLM failure so the chat client can show
// actionable text instead of the generic "AI service temporarily unavailable"
// — and so a smoke run can read the category straight from the SSE stream
// without needing prod log access.
//
// The string values are stable: front-end SSE consumers may switch on them
// to pick i18n messages or trigger client-side retry.
type LLMErrorCategory string

const (
	LLMErrCategoryUnknown     LLMErrorCategory = "unknown"
	LLMErrCategoryRateLimited LLMErrorCategory = "rate_limited"   // 429 from upstream or local rate limiter
	LLMErrCategoryAuthFailed  LLMErrorCategory = "auth_failed"    // 401/403 — bad / revoked / expired API key
	LLMErrCategoryBadModel    LLMErrorCategory = "bad_model"      // 400 model not found / unsupported
	LLMErrCategoryUpstream4xx LLMErrorCategory = "upstream_4xx"   // other 4xx
	LLMErrCategoryUpstream5xx LLMErrorCategory = "upstream_5xx"   // 500/502/503/504 from upstream
	LLMErrCategoryNetwork     LLMErrorCategory = "network"        // DNS / connection / TLS / EOF
	LLMErrCategoryTimeout     LLMErrorCategory = "timeout"        // ctx.Done / deadline exceeded
	LLMErrCategoryMarshal     LLMErrorCategory = "marshal_error"  // request body marshal — should never hit
)

// classifyLLMError maps the error returned from
// aichat/service.LLMClient.ChatStreamFunc / ChatJSON to a stable category.
// Always falls through to LLMErrCategoryUnknown rather than panicking on a
// shape we don't recognise.
//
// The matcher uses substring checks against the error string because
// LLMClient wraps errors with fmt.Errorf("LLM returned 401: %s", body) etc.
// — there are no typed sentinel errors to compare with errors.Is.
func classifyLLMError(err error) (LLMErrorCategory, string) {
	if err == nil {
		return LLMErrCategoryUnknown, ""
	}

	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return LLMErrCategoryTimeout, "Request timed out"
	}

	msg := err.Error()
	lower := strings.ToLower(msg)

	switch {
	case strings.Contains(msg, "rate limited"), strings.Contains(msg, "(429)"), strings.Contains(lower, "429"):
		return LLMErrCategoryRateLimited, "DeepSeek rate limit hit, please retry"
	case strings.Contains(msg, "LLM returned 401"), strings.Contains(msg, "LLM returned 403"):
		return LLMErrCategoryAuthFailed, "DeepSeek auth failed, check API key"
	case strings.Contains(msg, "LLM returned 400"):
		// Most common 400 in our context: invalid model name or malformed
		// request. Surface bad_model so future debugging knows where to look
		// first; the body in logs still carries the exact upstream reason.
		return LLMErrCategoryBadModel, "DeepSeek rejected the request (likely invalid model or malformed messages)"
	case strings.Contains(msg, "LLM returned 4"):
		return LLMErrCategoryUpstream4xx, "DeepSeek client error"
	case strings.Contains(msg, "LLM returned 5"):
		return LLMErrCategoryUpstream5xx, "DeepSeek upstream error, please retry"
	case strings.Contains(msg, "LLM request failed"), strings.Contains(msg, "LLM retry failed"),
		strings.Contains(lower, "no such host"), strings.Contains(lower, "connection refused"),
		strings.Contains(lower, "tls"), strings.Contains(lower, "eof"):
		return LLMErrCategoryNetwork, "Network reaching DeepSeek failed"
	case strings.Contains(msg, "marshal request"), strings.Contains(msg, "create request"):
		return LLMErrCategoryMarshal, "Internal request build error"
	default:
		return LLMErrCategoryUnknown, ""
	}
}

// writeStreamErrorEvent emits an SSE `error` event with both the legacy
// generic content (for old clients that ignore unknown fields) and the
// new category + hint pair so smoke tests / debugging UIs can read the
// failure shape directly from the stream. Truncates the upstream message
// at 200 chars to avoid leaking secrets / huge payloads.
func writeStreamErrorEvent(c *gin.Context, err error) {
	cat, hint := classifyLLMError(err)
	rawMsg := err.Error()
	if len(rawMsg) > 200 {
		rawMsg = rawMsg[:200] + "...[truncated]"
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"type":     "error",
		"content":  "AI service temporarily unavailable", // legacy compat
		"category": string(cat),
		"hint":     hint,
		"detail":   rawMsg,
	})
	fmt.Fprintf(c.Writer, "data: %s\n\n", string(payload))
	c.Writer.Flush()
}

