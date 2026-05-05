package geo

import (
	"net"
	"strings"

	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// Handler exposes GET /api/v1/geo for the frontend to learn the request's
// region and decide whether to render Google login entries.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Get is the HTTP handler. The endpoint is intentionally anonymous —
// region info is not sensitive and we want it available before the user
// has logged in.
func (h *Handler) Get(c *gin.Context) {
	ip := extractClientIP(c)
	res := h.svc.Lookup(ip)
	response.Success(c, res)
}

// extractClientIP walks X-Forwarded-For (set by AWS ALB / nginx) and picks
// the leftmost public IP. Falls back to X-Real-IP, then to gin's ClientIP.
// Private/loopback IPs in the chain are skipped — those are intermediaries.
func extractClientIP(c *gin.Context) string {
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		for _, p := range strings.Split(xff, ",") {
			candidate := strings.TrimSpace(p)
			if candidate == "" {
				continue
			}
			parsed := net.ParseIP(candidate)
			if parsed == nil {
				continue
			}
			if !isPrivateOrLoopback(parsed) {
				return candidate
			}
		}
	}
	if rip := strings.TrimSpace(c.GetHeader("X-Real-IP")); rip != "" {
		return rip
	}
	return c.ClientIP()
}
