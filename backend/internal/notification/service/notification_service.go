package service

import (
	"enjoysa-backend/internal/notification/model"
	"enjoysa-backend/internal/notification/store"
)

type NotificationService struct {
	store *store.NotificationStore
}

func NewNotificationService(store *store.NotificationStore) *NotificationService {
	return &NotificationService{store: store}
}

func (s *NotificationService) Send(recipientType string, recipientID uint, notifType, title, content, relatedType string, relatedID uint) error {
	notif := &model.Notification{
		RecipientType: recipientType,
		RecipientID:   recipientID,
		Type:          notifType,
		Title:         title,
		Content:       content,
		RelatedType:   relatedType,
		RelatedID:     relatedID,
	}
	return s.store.Create(notif)
}
