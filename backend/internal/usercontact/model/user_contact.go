package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"time"

	"gorm.io/gorm"
)

type UserContact struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	UserID              uint           `gorm:"index;not null" json:"user_id"`
	FirstName           string         `gorm:"size:50;not null" json:"first_name"`
	LastName            string         `gorm:"size:50;not null" json:"last_name"`
	Email               string         `gorm:"size:100" json:"email"`
	Phone               string         `gorm:"size:20" json:"phone"`
	DateOfBirth         *time.Time     `json:"date_of_birth"`
	Nationality         string         `gorm:"size:50" json:"nationality"`
	PassportNumber      string         `gorm:"size:200" json:"passport_number"` // encrypted
	DefaultType         string         `gorm:"size:10;default:adult" json:"default_type"`
	IsSelf              bool           `gorm:"default:false" json:"is_self"`
	SpecialRequirements string         `gorm:"size:500" json:"special_requirements"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

func (UserContact) TableName() string {
	return "user_contacts"
}

// MaskPassport returns masked passport like "****3456"
func MaskPassport(encrypted string) string {
	decrypted, err := Decrypt(encrypted)
	if err != nil || len(decrypted) == 0 {
		return ""
	}
	if len(decrypted) <= 4 {
		return "****"
	}
	return "****" + decrypted[len(decrypted)-4:]
}

func getEncryptKey() ([]byte, error) {
	key := os.Getenv("CONTACT_ENCRYPT_KEY")
	if key == "" {
		// Fallback: use a default key for development
		key = "enjoysa-dev-encrypt-key-32bytes!"
	}
	if len(key) != 32 {
		return nil, errors.New("CONTACT_ENCRYPT_KEY must be 32 bytes")
	}
	return []byte(key), nil
}

func Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key, err := getEncryptKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(encoded string) (string, error) {
	if encoded == "" {
		return "", nil
	}
	key, err := getEncryptKey()
	if err != nil {
		return "", err
	}
	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
