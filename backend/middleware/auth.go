package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"enjoysa-backend/database"
	"enjoysa-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("your-secret-key") // TODO: 从环境变量读取

// Claims JWT claims
type Claims struct {
	UserID   uint   `json:"user_id"`
	UserType string `json:"user_type"` // user, supplier, admin
	jwt.RegisteredClaims
}

// UserAuth 用户认证中间件 (C端)
func UserAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := getTokenFromHeader(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "未登录"})
			c.Abort()
			return
		}

		claims, err := parseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "登录已过期"})
			c.Abort()
			return
		}

		if claims.UserType != "user" {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "无权访问"})
			c.Abort()
			return
		}

		// 获取用户信息
		var user models.User
		if err := database.DB.First(&user, claims.UserID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "用户不存在"})
			c.Abort()
			return
		}

		c.Set("user", &user)
		c.Set("user_id", user.ID)
		c.Next()
	}
}

// SupplierAuth 供应商认证中间件 (B端)
func SupplierAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := getTokenFromHeader(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "未登录"})
			c.Abort()
			return
		}

		claims, err := parseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "登录已过期"})
			c.Abort()
			return
		}

		if claims.UserType != "supplier" {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "无权访问"})
			c.Abort()
			return
		}

		// 获取供应商用户信息
		var supplierUser models.SupplierUser
		if err := database.DB.Preload("Supplier").First(&supplierUser, claims.UserID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "用户不存在"})
			c.Abort()
			return
		}

		c.Set("supplier_user", &supplierUser)
		c.Set("supplier_user_id", supplierUser.ID)
		c.Set("supplier_id", supplierUser.SupplierID)
		c.Next()
	}
}

// AdminAuth 管理员认证中间件 (平台端)
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := getTokenFromHeader(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "未登录"})
			c.Abort()
			return
		}

		claims, err := parseToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "登录已过期"})
			c.Abort()
			return
		}

		if claims.UserType != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "无权访问"})
			c.Abort()
			return
		}

		c.Set("admin_id", claims.UserID)
		c.Next()
	}
}

// getTokenFromHeader 从请求头获取 token
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

// parseToken 解析 token
func parseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// GenerateToken 生成 token
func GenerateToken(userID uint, userType string) (string, error) {
	claims := &Claims{
		UserID:   userID,
		UserType: userType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)), // 7天
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}
