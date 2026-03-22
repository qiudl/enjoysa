package store

import (
	"enjoysa-backend/internal/usercontact/model"

	"gorm.io/gorm"
)

type UserContactStore struct {
	db *gorm.DB
}

func NewUserContactStore(db *gorm.DB) *UserContactStore {
	return &UserContactStore{db: db}
}

func (s *UserContactStore) ListByUserID(userID uint) ([]model.UserContact, error) {
	var contacts []model.UserContact
	err := s.db.Where("user_id = ?", userID).Order("is_self DESC, created_at ASC").Find(&contacts).Error
	return contacts, err
}

func (s *UserContactStore) CountByUserID(userID uint) (int64, error) {
	var count int64
	err := s.db.Model(&model.UserContact{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

func (s *UserContactStore) GetByID(id, userID uint) (*model.UserContact, error) {
	var contact model.UserContact
	err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&contact).Error
	if err != nil {
		return nil, err
	}
	return &contact, nil
}

func (s *UserContactStore) Create(contact *model.UserContact) error {
	return s.db.Create(contact).Error
}

func (s *UserContactStore) Update(contact *model.UserContact) error {
	return s.db.Save(contact).Error
}

func (s *UserContactStore) FindByName(userID uint, firstName, lastName string) (*model.UserContact, error) {
	var contact model.UserContact
	err := s.db.Where("user_id = ? AND first_name = ? AND last_name = ?", userID, firstName, lastName).First(&contact).Error
	if err != nil {
		return nil, err
	}
	return &contact, nil
}

func (s *UserContactStore) Delete(id, userID uint) error {
	return s.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.UserContact{}).Error
}
