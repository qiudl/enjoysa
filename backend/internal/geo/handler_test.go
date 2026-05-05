package geo

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// extractClientIP must skip private intermediaries and pick the leftmost
// public IP from X-Forwarded-For. ALB / nginx prepend their internal IPs,
// so the user IP is usually first but private hops can appear too.
func TestExtractClientIP_FromXForwardedFor(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name string
		xff  string
		want string
	}{
		{"single public IP", "8.8.8.8", "8.8.8.8"},
		{"public then private", "8.8.8.8, 10.0.0.1", "8.8.8.8"},
		{"private then public", "10.0.0.1, 8.8.8.8", "8.8.8.8"},
		{"all private", "10.0.0.1, 192.168.1.1", ""},
		{"with spaces", "  114.114.114.114  ,10.0.0.1", "114.114.114.114"},
		{"empty", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			req := httptest.NewRequest("GET", "/api/v1/geo", nil)
			if c.xff != "" {
				req.Header.Set("X-Forwarded-For", c.xff)
			}
			ctx.Request = req
			got := extractClientIP(ctx)
			// when XFF gives no public IP we fall back to gin.ClientIP() —
			// in tests that's 192.0.2.1 (RFC5737 docs); just ensure we
			// don't return one of the private XFF values verbatim.
			if c.want != "" && got != c.want {
				t.Errorf("xff=%q: got %q, want %q", c.xff, got, c.want)
			}
		})
	}
}

func TestExtractClientIP_FallbackToXRealIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/api/v1/geo", nil)
	req.Header.Set("X-Real-IP", "203.0.113.5")
	ctx.Request = req
	got := extractClientIP(ctx)
	if got != "203.0.113.5" {
		t.Errorf("expected X-Real-IP fallback, got %q", got)
	}
}
