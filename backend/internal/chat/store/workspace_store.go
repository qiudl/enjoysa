package store

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// WorkspaceStore handles per-(user_id, user_type) chat_workspaces.
type WorkspaceStore struct {
	db *gorm.DB
}

func NewWorkspaceStore(db *gorm.DB) *WorkspaceStore {
	return &WorkspaceStore{db: db}
}

// GetOrCreateForUser returns the workspace for (ownerUserID, ownerUserType),
// creating it on first call. Concurrent first-touches from multiple tabs are
// handled via INSERT ... ON CONFLICT DO NOTHING (defect-analysis D2).
func (s *WorkspaceStore) GetOrCreateForUser(ownerUserID uint, ownerUserType string) (*chatmodel.ChatWorkspace, error) {
	if ownerUserID == 0 || ownerUserType == "" {
		return nil, fmt.Errorf("workspace: ownerUserID and ownerUserType are required")
	}

	if err := s.db.Exec(`
		INSERT INTO chat_workspaces (owner_user_id, owner_user_type, created_at, updated_at)
		VALUES (?, ?, NOW(), NOW())
		ON CONFLICT (owner_user_id, owner_user_type) DO NOTHING
	`, ownerUserID, ownerUserType).Error; err != nil {
		return nil, err
	}

	var ws chatmodel.ChatWorkspace
	err := s.db.Where("owner_user_id = ? AND owner_user_type = ?", ownerUserID, ownerUserType).
		First(&ws).Error
	if err != nil {
		return nil, err
	}
	return &ws, nil
}

// Get loads a workspace by primary key.
func (s *WorkspaceStore) Get(id uint) (*chatmodel.ChatWorkspace, error) {
	var ws chatmodel.ChatWorkspace
	if err := s.db.First(&ws, id).Error; err != nil {
		return nil, err
	}
	return &ws, nil
}

// IsOwnedBy verifies the workspace belongs to (ownerUserID, ownerUserType).
// Used by RequireOwnedChannel middleware (defect-analysis S1).
func (s *WorkspaceStore) IsOwnedBy(workspaceID, ownerUserID uint, ownerUserType string) (bool, error) {
	var ws chatmodel.ChatWorkspace
	err := s.db.Where("id = ? AND owner_user_id = ? AND owner_user_type = ?",
		workspaceID, ownerUserID, ownerUserType).First(&ws).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
