package handler

import (
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestUintQuery_Defaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mk := func(query string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/?"+query, nil)
		c.Request.URL.RawQuery = query
		// safety: also via Values
		_, _ = url.ParseQuery(query)
		return c
	}

	if got := uintQuery(mk(""), "before", 0); got != 0 {
		t.Fatalf("missing param: got %d, want 0", got)
	}
	if got := uintQuery(mk("before=42"), "before", 0); got != 42 {
		t.Fatalf("got %d, want 42", got)
	}
	if got := uintQuery(mk("before=abc"), "before", 99); got != 99 {
		t.Fatalf("non-numeric: got %d, want 99 (default)", got)
	}
}

func TestIntQuery_Defaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mk := func(query string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/?"+query, nil)
		c.Request.URL.RawQuery = query
		return c
	}

	if got := intQuery(mk(""), "limit", 50); got != 50 {
		t.Fatalf("missing: got %d, want 50", got)
	}
	if got := intQuery(mk("limit=10"), "limit", 50); got != 10 {
		t.Fatalf("got %d, want 10", got)
	}
	if got := intQuery(mk("limit=xx"), "limit", 50); got != 50 {
		t.Fatalf("non-numeric: got %d, want 50 (default)", got)
	}
}
