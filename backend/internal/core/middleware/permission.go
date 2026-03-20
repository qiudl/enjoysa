package middleware

import (
	"strconv"
	"strings"

	"enjoysa-backend/pkg/response"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
)

// RequirePermission checks Casbin policies for the current admin.
func RequirePermission(enforcer *casbin.SyncedEnforcer) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("admin_role")
		if !exists {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		roleStr := role.(string)

		// super_admin bypasses all checks (also handled in Casbin matcher)
		if roleStr == "super_admin" {
			c.Next()
			return
		}

		// Extract API path: remove /api/v1 prefix
		path := c.Request.URL.Path
		path = extractAPIPath(path)
		method := c.Request.Method

		// Try checking by admin ID (uses grouping policies)
		adminID, _ := c.Get("admin_id")
		sub := strconv.FormatUint(uint64(adminID.(uint)), 10)

		allowed, err := enforcer.Enforce(sub, path, method)
		if err != nil || !allowed {
			// Fallback: try checking by role code directly
			allowed, _ = enforcer.Enforce(roleStr, path, method)
		}

		if !allowed {
			response.Forbidden(c, "Insufficient permissions")
			c.Abort()
			return
		}

		c.Next()
	}
}

// extractAPIPath strips the /api/v1 prefix from the request path.
func extractAPIPath(path string) string {
	if strings.HasPrefix(path, "/api/v1") {
		path = strings.TrimPrefix(path, "/api/v1")
	}
	if path == "" {
		path = "/"
	}
	return path
}
