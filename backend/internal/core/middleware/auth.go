package middleware

import (
	"errors"
	"strings"

	"enjoysa-backend/internal/auth"
	authmodel "enjoysa-backend/internal/auth/model"
	"enjoysa-backend/internal/models"
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

		c.Set("supplier_user", &su)
		c.Set("supplier_user_id", su.ID)
		c.Set("supplier_id", su.SupplierID)
		c.Next()
	}
}

func AdminAuth(jwtService *auth.JWTService, db *gorm.DB) gin.HandlerFunc {
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
		c.Set("admin_role", admin.Role)
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
