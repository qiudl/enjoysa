package store

import (
	"enjoysa-backend/internal/audit/model"

	"gorm.io/gorm"
)

type AuditStore struct {
	db *gorm.DB
}

func NewAuditStore(db *gorm.DB) *AuditStore {
	return &AuditStore{db: db}
}

func (s *AuditStore) Create(log *model.AuditLog) error {
	return s.db.Create(log).Error
}

type ListParams struct {
	Page       int
	PageSize   int
	AdminID    uint
	Action     string
	Resource   string
	StartDate  string
	EndDate    string
}

func (s *AuditStore) List(params ListParams) ([]model.AuditLog, int64, error) {
	var logs []model.AuditLog
	var total int64

	q := s.db.Model(&model.AuditLog{})

	if params.AdminID > 0 {
		q = q.Where("admin_id = ?", params.AdminID)
	}
	if params.Action != "" {
		q = q.Where("action = ?", params.Action)
	}
	if params.Resource != "" {
		q = q.Where("resource = ?", params.Resource)
	}
	if params.StartDate != "" {
		q = q.Where("created_at >= ?", params.StartDate)
	}
	if params.EndDate != "" {
		q = q.Where("created_at <= ?", params.EndDate+" 23:59:59")
	}

	q.Count(&total)

	offset := (params.Page - 1) * params.PageSize
	if err := q.Order("created_at DESC").Offset(offset).Limit(params.PageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}
