package middleware

import (
	"errors"
	"fmt"
	"strings"

	"enjoysa-backend/internal/auth"
	authmodel "enjoysa-backend/internal/auth/model"
	"enjoysa-backend/internal/models"
	rbacmodel "enjoysa-backend/internal/rbac/model"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func JWTAuth(jwtService *auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := getTokenFromHeader(c)
		if err != nil {
			response.Unauthorized(c, "Missing or invalid token")
			c.Abort()
			return
		}

		claims, err := jwtService.ParseToken(tokenStr)
		if err != nil {
			response.Unauthorized(c, "Token expired or invalid")
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_type", claims.UserType)
		c.Next()
	}
}

func UserAuth(jwtService *auth.JWTService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := getTokenFromHeader(c)
		if err != nil {
			response.Unauthorized(c, "Missing or invalid token")
			c.Abort()
			return
		}

		claims, err := jwtService.ParseToken(tokenStr)
		if err != nil {
			response.Unauthorized(c, "Token expired or invalid")
			c.Abort()
			return
		}

		if claims.UserType != "user" {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		var user models.User
		if err := db.First(&user, claims.UserID).Error; err != nil {
			response.Unauthorized(c, "User not found")
			c.Abort()
			return
		}

		if user.Status != "active" {
			response.Forbidden(c, "Account suspended")
			c.Abort()
			return
		}

		c.Set("user", &user)
		c.Set("user_id", user.ID)
		c.Next()
	}
}

func SupplierAuth(jwtService *auth.JWTService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := getTokenFromHeader(c)
		if err != nil {
			response.Unauthorized(c, "Missing or invalid token")
			c.Abort()
			return
		}

		claims, err := jwtService.ParseToken(tokenStr)
		if err != nil {
			response.Unauthorized(c, "Token expired or invalid")
			c.Abort()
			return
		}

		if claims.UserType != "supplier" {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		var su models.SupplierUser
		if err := db.Preload("Supplier").First(&su, claims.UserID).Error; err != nil {
			response.Unauthorized(c, "Supplier user not found")
			c.Abort()
			return
		}

		if su.Status != "active" {
			response.Forbidden(c, "Account suspended")
			c.Abort()
			return
		}

		supplierStatus := ""
		if su.Supplier != nil {
			supplierStatus = su.Supplier.Status
		}

		c.Set("supplier_user", &su)
		c.Set("supplier_user_id", su.ID)
		c.Set("supplier_id", su.SupplierID)
		c.Set("supplier_status", supplierStatus)
		c.Next()
	}
}

// RequireApprovedSupplier blocks access for non-approved suppliers (e.g. pending).
// Must be used after SupplierAuth middleware.
func RequireApprovedSupplier() gin.HandlerFunc {
	return func(c *gin.Context) {
		status, _ := c.Get("supplier_status")
		if status != "approved" {
			response.Forbidden(c, "Supplier not yet approved")
			c.Abort()
			return
		}
		c.Next()
	}
}

func AdminAuth(jwtService *auth.JWTService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		fmt.Printf("[AdminAuth] %s %s | Authorization: %q\n", c.Request.Method, c.Request.URL.Path, authHeader)

		tokenStr, err := getTokenFromHeader(c)
		if err != nil {
			fmt.Printf("[AdminAuth] REJECT: %v\n", err)
			response.Unauthorized(c, "Missing or invalid token")
			c.Abort()
			return
		}

		claims, err := jwtService.ParseToken(tokenStr)
		if err != nil {
			fmt.Printf("[AdminAuth] TOKEN INVALID: %v\n", err)
			response.Unauthorized(c, "Token expired or invalid")
			c.Abort()
			return
		}

		if claims.UserType != "admin" {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		var admin authmodel.Admin
		if err := db.First(&admin, claims.UserID).Error; err != nil {
			response.Unauthorized(c, "Admin not found")
			c.Abort()
			return
		}

		if admin.Status != "active" {
			response.Forbidden(c, "Account suspended")
			c.Abort()
			return
		}

		c.Set("admin", &admin)
		c.Set("admin_id", admin.ID)

		// Read role from admin_roles table (new RBAC), fallback to admin.Role field
		var roleCodes []string
		db.Model(&rbacmodel.SysRole{}).
			Joins("JOIN admin_roles ON admin_roles.role_id = sys_roles.id").
			Where("admin_roles.admin_id = ? AND sys_roles.status = 1", admin.ID).
			Pluck("sys_roles.code", &roleCodes)

		if len(roleCodes) > 0 {
			c.Set("admin_role", roleCodes[0])
			c.Set("admin_role_codes", roleCodes)
		} else {
			c.Set("admin_role", admin.Role)
			c.Set("admin_role_codes", []string{admin.Role})
		}
		c.Next()
	}
}

func RequireAdminRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("admin_role")
		if !exists {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		roleStr, ok := role.(string)
		if !ok {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		for _, r := range roles {
			if roleStr == r {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "Insufficient permissions")
		c.Abort()
	}
}

// OptionalUserAuth sets user context if a valid token is present but does not block unauthenticated requests.
func OptionalUserAuth(jwtService *auth.JWTService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := getTokenFromHeader(c)
		if err != nil {
			c.Next()
			return
		}

		claims, err := jwtService.ParseToken(tokenStr)
		if err != nil || claims.UserType != "user" {
			c.Next()
			return
		}

		var user models.User
		if err := db.First(&user, claims.UserID).Error; err != nil {
			c.Next()
			return
		}

		c.Set("user", &user)
		c.Set("user_id", user.ID)
		c.Next()
	}
}

// OptionalAnyAuth resolves any of user/supplier/admin tokens and injects the
// corresponding context keys, but does NOT block unauthenticated requests.
// Used by chat/send so guests, C-end users, suppliers and admins can all use
// the same endpoint with the AI knowing exactly who is talking.
func OptionalAnyAuth(jwtService *auth.JWTService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := getTokenFromHeader(c)
		if err != nil {
			c.Next()
			return
		}

		claims, err := jwtService.ParseToken(tokenStr)
		if err != nil {
			c.Next()
			return
		}

		switch claims.UserType {
		case "user":
			var user models.User
			if err := db.First(&user, claims.UserID).Error; err == nil && user.Status == "active" {
				c.Set("user", &user)
				c.Set("user_id", user.ID)
			}
		case "supplier":
			var su models.SupplierUser
			if err := db.Preload("Supplier").First(&su, claims.UserID).Error; err == nil && su.Status == "active" {
				c.Set("supplier_user", &su)
				c.Set("supplier_user_id", su.ID)
				c.Set("supplier_id", su.SupplierID)
				if su.Supplier != nil {
					c.Set("supplier_status", su.Supplier.Status)
				}
			}
		case "admin":
			var admin authmodel.Admin
			if err := db.First(&admin, claims.UserID).Error; err == nil && admin.Status == "active" {
				c.Set("admin", &admin)
				c.Set("admin_id", admin.ID)
			}
		}
		c.Next()
	}
}

// APIKeyAuth validates X-Service-Key header for service-to-service calls
func APIKeyAuth(validKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-Service-Key")
		if apiKey == "" {
			response.Unauthorized(c, "Missing service key")
			c.Abort()
			return
		}

		if apiKey != validKey {
			response.Unauthorized(c, "Invalid service key")
			c.Abort()
			return
		}

		c.Set("service_name", "openclaw")
		c.Set("is_service", true)
		c.Next()
	}
}

func getTokenFromHeader(c *gin.Context) (string, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return "", errors.New("missing authorization header")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", errors.New("invalid authorization header format")
	}

	return parts[1], nil
}
