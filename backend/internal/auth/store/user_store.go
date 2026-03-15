package store

import (
	"enjoysa-backend/internal/models"

	"gorm.io/gorm"
)

type UserStore struct {
	db *gorm.DB
}

func NewUserStore(db *gorm.DB) *UserStore {
	return &UserStore{db: db}
}

func (s *UserStore) GetByID(id uint) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserStore) GetByEmail(email string) (*models.User, error) {
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserStore) GetByGoogleID(googleID string) (*models.User, error) {
	var user models.User
	if err := s.db.Where("google_id = ?", googleID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserStore) Create(user *models.User) error {
	return s.db.Create(user).Error
}

func (s *UserStore) Update(user *models.User) error {
	return s.db.Save(user).Error
}
