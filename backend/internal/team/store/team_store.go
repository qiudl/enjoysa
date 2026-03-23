package store

import (
	"time"

	"enjoysa-backend/internal/models"
	teammodel "enjoysa-backend/internal/team/model"

	"gorm.io/gorm"
)

type TeamStore struct {
	db *gorm.DB
}

func NewTeamStore(db *gorm.DB) *TeamStore {
	return &TeamStore{db: db}
}

// === Members ===

func (s *TeamStore) ListMembers(supplierID uint) ([]models.SupplierUser, error) {
	var members []models.SupplierUser
	err := s.db.Where("supplier_id = ?", supplierID).Order("created_at ASC").Find(&members).Error
	return members, err
}

func (s *TeamStore) GetMember(id uint, supplierID uint) (*models.SupplierUser, error) {
	var member models.SupplierUser
	err := s.db.Where("id = ? AND supplier_id = ?", id, supplierID).First(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func (s *TeamStore) UpdateRole(id uint, supplierID uint, role string) error {
	return s.db.Model(&models.SupplierUser{}).
		Where("id = ? AND supplier_id = ?", id, supplierID).
		Update("role", role).Error
}

func (s *TeamStore) UpdateStatus(id uint, supplierID uint, status string) error {
	return s.db.Model(&models.SupplierUser{}).
		Where("id = ? AND supplier_id = ?", id, supplierID).
		Update("status", status).Error
}

func (s *TeamStore) RemoveMember(id uint, supplierID uint) error {
	return s.db.Where("id = ? AND supplier_id = ?", id, supplierID).
		Delete(&models.SupplierUser{}).Error
}

func (s *TeamStore) ResetPassword(id uint, supplierID uint, hashedPassword string) error {
	return s.db.Model(&models.SupplierUser{}).
		Where("id = ? AND supplier_id = ?", id, supplierID).
		Update("password", hashedPassword).Error
}

// === Invitations ===

func (s *TeamStore) CreateInvitation(inv *teammodel.SupplierInvitation) error {
	return s.db.Create(inv).Error
}

func (s *TeamStore) ListInvitations(supplierID uint) ([]teammodel.SupplierInvitation, error) {
	var invitations []teammodel.SupplierInvitation
	err := s.db.Where("supplier_id = ?", supplierID).
		Order("created_at DESC").
		Find(&invitations).Error
	return invitations, err
}

func (s *TeamStore) GetInvitationByToken(token string) (*teammodel.SupplierInvitation, error) {
	var inv teammodel.SupplierInvitation
	err := s.db.Where("token = ?", token).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *TeamStore) GetInvitationByID(id uint, supplierID uint) (*teammodel.SupplierInvitation, error) {
	var inv teammodel.SupplierInvitation
	err := s.db.Where("id = ? AND supplier_id = ?", id, supplierID).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *TeamStore) RevokeInvitation(id uint, supplierID uint) error {
	return s.db.Model(&teammodel.SupplierInvitation{}).
		Where("id = ? AND supplier_id = ?", id, supplierID).
		Update("status", "revoked").Error
}

func (s *TeamStore) AcceptInvitation(token string, supplierUser *models.SupplierUser) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&teammodel.SupplierInvitation{}).
			Where("token = ?", token).
			Updates(map[string]interface{}{
				"status":      "accepted",
				"accepted_at": now,
			}).Error; err != nil {
			return err
		}
		return tx.Create(supplierUser).Error
	})
}

func (s *TeamStore) ResendInvitation(id uint, supplierID uint, newToken string, newExpiry time.Time) error {
	return s.db.Model(&teammodel.SupplierInvitation{}).
		Where("id = ? AND supplier_id = ?", id, supplierID).
		Updates(map[string]interface{}{
			"token":      newToken,
			"status":     "pending",
			"expires_at": newExpiry,
		}).Error
}
