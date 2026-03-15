package auth

import (
	"errors"
	"time"

	"enjoysa-backend/internal/core/config"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   uint   `json:"user_id"`
	UserType string `json:"user_type"` // user, supplier, admin
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // seconds
}

type JWTService struct {
	secret        []byte
	accessExpire  time.Duration
	refreshExpire time.Duration
}

func NewJWTService(cfg config.JWTConfig) *JWTService {
	return &JWTService{
		secret:        []byte(cfg.Secret),
		accessExpire:  time.Duration(cfg.AccessExpire) * time.Hour,
		refreshExpire: time.Duration(cfg.RefreshExpire) * time.Hour,
	}
}

func (s *JWTService) GenerateTokenPair(userID uint, userType string) (*TokenPair, error) {
	accessToken, err := s.generateToken(userID, userType, s.accessExpire)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateToken(userID, userType, s.refreshExpire)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.accessExpire.Seconds()),
	}, nil
}

func (s *JWTService) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func (s *JWTService) RefreshToken(refreshTokenStr string) (*TokenPair, error) {
	claims, err := s.ParseToken(refreshTokenStr)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	return s.GenerateTokenPair(claims.UserID, claims.UserType)
}

func (s *JWTService) generateToken(userID uint, userType string, expire time.Duration) (string, error) {
	claims := &Claims{
		UserID:   userID,
		UserType: userType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expire)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}
