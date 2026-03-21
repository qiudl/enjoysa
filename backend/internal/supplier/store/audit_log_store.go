package store

import (
	"enjoysa-backend/internal/supplier/model"
	"gorm.io/gorm"
)

type AuditLogStore struct {
	db *gorm.DB
}

func NewAuditLogStore(db *gorm.DB) *AuditLogStore {
	return &AuditLogStore{db: db}
}

func (s *AuditLogStore) Create(log *model.SupplierAuditLog) error {
	return s.db.Create(log).Error
}

type AuditLogFilter struct {
	SupplierID   uint
	Action       string
	ResourceType string
	Page         int
	PageSize     int
}

func (s *AuditLogStore) List(filter AuditLogFilter) ([]model.SupplierAuditLog, int64, error) {
	var logs []model.SupplierAuditLog
	var total int64

	query := s.db.Model(&model.SupplierAuditLog{})
	if filter.SupplierID > 0 {
		query = query.Where("supplier_id = ?", filter.SupplierID)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.ResourceType != "" {
		query = query.Where("resource_type = ?", filter.ResourceType)
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

	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&logs).Error
	return logs, total, err
}
