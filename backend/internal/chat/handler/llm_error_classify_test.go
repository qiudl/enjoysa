package handler

import (
	"context"
	"errors"
	"fmt"
	"testing"
)

// llm_client.go wraps every upstream failure with fmt.Errorf into one of a
// small set of message shapes. classifyLLMError must put each into a stable
// category so the SSE error event can carry actionable info to the client
// without leaking the full message and without panicking on shapes we never
// expected.

func TestClassifyLLMError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		wantCat  LLMErrorCategory
		wantHint string // empty means "any non-empty acceptable" (we just check non-empty)
	}{
		{"nil", nil, LLMErrCategoryUnknown, ""},

		// LLMClient produces these wrapped strings (see llm_client.go):
		{"local rate limited", fmt.Errorf("rate limited: %w", errors.New("limiter")), LLMErrCategoryRateLimited, "anything"},
		{"upstream 429", fmt.Errorf("LLM rate limited (429)"), LLMErrCategoryRateLimited, "anything"},
		{"upstream 401", fmt.Errorf("LLM returned 401: invalid api key"), LLMErrCategoryAuthFailed, "anything"},
		{"upstream 403", fmt.Errorf("LLM returned 403: forbidden"), LLMErrCategoryAuthFailed, "anything"},
		{"upstream 400", fmt.Errorf("LLM returned 400: model not found"), LLMErrCategoryBadModel, "anything"},
		{"upstream 404", fmt.Errorf("LLM returned 404: not found"), LLMErrCategoryUpstream4xx, "anything"},
		{"upstream 502", fmt.Errorf("LLM returned 502: bad gateway"), LLMErrCategoryUpstream5xx, "anything"},
		{"upstream 503", fmt.Errorf("LLM returned 503: unavailable"), LLMErrCategoryUpstream5xx, "anything"},
		{"network req failed", fmt.Errorf("LLM request failed: %w", errors.New("dial tcp: connection refused")), LLMErrCategoryNetwork, "anything"},
		{"network retry failed", fmt.Errorf("LLM retry failed: %w", errors.New("EOF")), LLMErrCategoryNetwork, "anything"},
		{"marshal request", fmt.Errorf("marshal request: %w", errors.New("invalid char")), LLMErrCategoryMarshal, "anything"},

		// stdlib context errors:
		{"deadline", context.DeadlineExceeded, LLMErrCategoryTimeout, "anything"},
		{"canceled", context.Canceled, LLMErrCategoryTimeout, "anything"},

		// Unknown shape — must not panic, falls through to unknown.
		{"random", errors.New("something we never expected"), LLMErrCategoryUnknown, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotCat, gotHint := classifyLLMError(tt.err)
			if gotCat != tt.wantCat {
				t.Errorf("category: got %q want %q", gotCat, tt.wantCat)
			}
			if tt.wantHint == "anything" && gotHint == "" {
				t.Errorf("hint should be non-empty for category %q", gotCat)
			}
			if tt.wantHint == "" && gotHint != "" {
				t.Errorf("hint should be empty for category %q, got %q", gotCat, gotHint)
			}
		})
	}
}
