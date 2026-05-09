package store

import (
	"errors"

	"gorm.io/gorm"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// AgentStore reads chat_agents (the global agent registry).
//
// Phase 1 has no admin-side mutations; agents are seeded via the seed package
// (REQ-20260509-0037 dev-2). Defect-analysis R3 — every list/get filters
// `enabled = TRUE` so disabled agents disappear everywhere.
type AgentStore struct {
	db *gorm.DB
}

func NewAgentStore(db *gorm.DB) *AgentStore {
	return &AgentStore{db: db}
}

// ListEnabled returns every active agent, sorted by sort_order then code.
func (s *AgentStore) ListEnabled() ([]chatmodel.ChatAgent, error) {
	var rows []chatmodel.ChatAgent
	err := s.db.Where("enabled = ?", true).
		Order("sort_order ASC, code ASC").Find(&rows).Error
	return rows, err
}

// ListDefaultsInNewChannel returns enabled agents that should join every
// freshly-created channel by default.
func (s *AgentStore) ListDefaultsInNewChannel() ([]chatmodel.ChatAgent, error) {
	var rows []chatmodel.ChatAgent
	err := s.db.Where("enabled = ? AND default_in_new_channel = ?", true, true).
		Order("sort_order ASC, code ASC").Find(&rows).Error
	return rows, err
}

// Get returns an enabled agent by id, or gorm.ErrRecordNotFound.
func (s *AgentStore) Get(id uint) (*chatmodel.ChatAgent, error) {
	var a chatmodel.ChatAgent
	err := s.db.Where("id = ? AND enabled = ?", id, true).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// GetByCode returns an enabled agent by stable code (e.g. customer-service-deepseek).
func (s *AgentStore) GetByCode(code string) (*chatmodel.ChatAgent, error) {
	var a chatmodel.ChatAgent
	err := s.db.Where("code = ? AND enabled = ?", code, true).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}
