package middleware

import (
	"net/http"
	"strings"

	"enjoysa-backend/internal/octo/store"

	"github.com/gin-gonic/gin"
)

const (
	ContextKeyReseller     = "octo_reseller"
	ContextKeyResellerID   = "octo_reseller_id"
	ContextKeyCapabilities = "octo_capabilities"
)

// OctoAuth 验证 OCTO Bearer Token 并注入分销商信息
func OctoAuth(resellerStore *store.ResellerStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "Missing Authorization header",
			})
			return
		}

		// Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "Invalid Authorization header format, expected: Bearer {token}",
			})
			return
		}

		token := strings.TrimSpace(parts[1])
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "Empty bearer token",
			})
			return
		}

		reseller, err := resellerStore.FindByAPIKey(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "FORBIDDEN",
				"message": "Invalid or deactivated API key",
			})
			return
		}

		c.Set(ContextKeyReseller, reseller)
		c.Set(ContextKeyResellerID, reseller.ID)
		c.Next()
	}
}

// OctoCapabilities 解析 Octo-Capabilities header
func OctoCapabilities() gin.HandlerFunc {
	return func(c *gin.Context) {
		caps := parseCapabilities(c)
		c.Set(ContextKeyCapabilities, caps)
		c.Next()
	}
}

// parseCapabilities 从 Header 或 Query 参数解析请求的能力
func parseCapabilities(c *gin.Context) map[string]bool {
	caps := make(map[string]bool)

	// 从 Octo-Capabilities header 解析
	header := c.GetHeader("Octo-Capabilities")
	if header != "" {
		for _, cap := range strings.Split(header, ",") {
			cap = strings.TrimSpace(cap)
			if cap != "" {
				caps[cap] = true
			}
		}
	}

	// 从 _capabilities query 参数解析
	query := c.Query("_capabilities")
	if query != "" {
		for _, cap := range strings.Split(query, ",") {
			cap = strings.TrimSpace(cap)
			if cap != "" {
				caps[cap] = true
			}
		}
	}

	return caps
}

// HasCapability 检查当前请求是否包含指定能力
func HasCapability(c *gin.Context, capability string) bool {
	caps, exists := c.Get(ContextKeyCapabilities)
	if !exists {
		return false
	}
	capMap, ok := caps.(map[string]bool)
	if !ok {
		return false
	}
	return capMap[capability]
}
