package store

import (
	"enjoysa-backend/internal/settlement/model"

	"gorm.io/gorm"
)

type SettlementStore struct {
	db *gorm.DB
}

func NewSettlementStore(db *gorm.DB) *SettlementStore {
	return &SettlementStore{db: db}
}

func (s *SettlementStore) Create(settlement *model.Settlement) error {
	return s.db.Create(settlement).Error
}

func (s *SettlementStore) GetByID(id uint) (*model.Settlement, error) {
	var settlement model.Settlement
	err := s.db.First(&settlement, id).Error
	return &settlement, err
}

func (s *SettlementStore) ListBySupplier(supplierID uint, page, pageSize int) ([]model.Settlement, int64, error) {
	var settlements []model.Settlement
	var total int64

	query := s.db.Model(&model.Settlement{}).Where("supplier_id = ?", supplierID)
	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&settlements).Error
	return settlements, total, err
}

func (s *SettlementStore) ListAll(page, pageSize int, status string) ([]model.Settlement, int64, error) {
	var settlements []model.Settlement
	var total int64

	query := s.db.Model(&model.Settlement{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&settlements).Error
	return settlements, total, err
}

func (s *SettlementStore) UpdateStatus(id uint, status string) error {
	return s.db.Model(&model.Settlement{}).Where("id = ?", id).Update("status", status).Error
}

// Stats returns aggregated settlement statistics
func (s *SettlementStore) Stats() (map[string]interface{}, error) {
	var totalRevenue, pendingSettlement, completedSettlement float64
	var totalCount, pendingCount, completedCount int64

	s.db.Model(&model.Settlement{}).Count(&totalCount)
	s.db.Model(&model.Settlement{}).Where("status = ?", "pending").Count(&pendingCount)
	s.db.Model(&model.Settlement{}).Where("status = ?", "completed").Count(&completedCount)

	s.db.Model(&model.Settlement{}).Select("COALESCE(SUM(gross_amount), 0)").Row().Scan(&totalRevenue)
	s.db.Model(&model.Settlement{}).Where("status = ?", "pending").Select("COALESCE(SUM(net_amount), 0)").Row().Scan(&pendingSettlement)
	s.db.Model(&model.Settlement{}).Where("status = ?", "completed").Select("COALESCE(SUM(net_amount), 0)").Row().Scan(&completedSettlement)

	return map[string]interface{}{
		"total_revenue":        totalRevenue,
		"pending_settlement":   pendingSettlement,
		"completed_settlement": completedSettlement,
		"total_count":          totalCount,
		"pending_count":        pendingCount,
		"completed_count":      completedCount,
	}, nil
}

// SupplierStats returns settlement stats for a specific supplier
func (s *SettlementStore) SupplierStats(supplierID uint) (map[string]interface{}, error) {
	var pending, completed float64
	var pendingCount, completedCount int64

	s.db.Model(&model.Settlement{}).Where("supplier_id = ? AND status = ?", supplierID, "pending").
		Count(&pendingCount).Select("COALESCE(SUM(net_amount), 0)").Row().Scan(&pending)
	s.db.Model(&model.Settlement{}).Where("supplier_id = ? AND status = ?", supplierID, "completed").
		Count(&completedCount).Select("COALESCE(SUM(net_amount), 0)").Row().Scan(&completed)

	return map[string]interface{}{
		"pending_amount":    pending,
		"completed_amount":  completed,
		"pending_count":     pendingCount,
		"completed_count":   completedCount,
	}, nil
}
