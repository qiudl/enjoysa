package store

import (
	"enjoysa-backend/internal/notification/model"

	"gorm.io/gorm"
)

type NotificationStore struct {
	db *gorm.DB
}

func NewNotificationStore(db *gorm.DB) *NotificationStore {
	return &NotificationStore{db: db}
}

type NotifFilter struct {
	IsRead   *bool
	Page     int
	PageSize int
}

func (s *NotificationStore) Create(notif *model.Notification) error {
	return s.db.Create(notif).Error
}

func (s *NotificationStore) List(recipientType string, recipientID uint, filter NotifFilter) ([]model.Notification, int64, error) {
	var notifications []model.Notification
	var total int64

	query := s.db.Model(&model.Notification{}).
		Where("recipient_type = ? AND recipient_id = ?", recipientType, recipientID)

	if filter.IsRead != nil {
		query = query.Where("is_read = ?", *filter.IsRead)
	}

	query.Count(&total)

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize
	if err := query.
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&notifications).Error; err != nil {
		return nil, 0, err
	}

	return notifications, total, nil
}

func (s *NotificationStore) UnreadCount(recipientType string, recipientID uint) (int64, error) {
	var count int64
	err := s.db.Model(&model.Notification{}).
		Where("recipient_type = ? AND recipient_id = ? AND is_read = false", recipientType, recipientID).
		Count(&count).Error
	return count, err
}

func (s *NotificationStore) MarkRead(id uint) error {
	return s.db.Model(&model.Notification{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_read": true,
		"read_at": gorm.Expr("NOW()"),
	}).Error
}

func (s *NotificationStore) MarkAllRead(recipientType string, recipientID uint) error {
	return s.db.Model(&model.Notification{}).
		Where("recipient_type = ? AND recipient_id = ? AND is_read = false", recipientType, recipientID).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": gorm.Expr("NOW()"),
		}).Error
}

func (s *NotificationStore) Delete(id uint) error {
	return s.db.Delete(&model.Notification{}, id).Error
}
