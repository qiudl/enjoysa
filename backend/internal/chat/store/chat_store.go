package store

import (
	"enjoysa-backend/internal/chat/model"

	"gorm.io/gorm"
)

type ChatStore struct {
	db *gorm.DB
}

func NewChatStore(db *gorm.DB) *ChatStore {
	return &ChatStore{db: db}
}

func (s *ChatStore) CreateSession(session *model.ChatSession) error {
	return s.db.Create(session).Error
}

func (s *ChatStore) GetSession(id uint) (*model.ChatSession, error) {
	var session model.ChatSession
	err := s.db.First(&session, id).Error
	return &session, err
}

func (s *ChatStore) ListSessions(userID uint, userType string, limit int) ([]model.ChatSession, error) {
	var sessions []model.ChatSession
	err := s.db.Where("user_id = ? AND user_type = ?", userID, userType).
		Order("updated_at DESC").Limit(limit).Find(&sessions).Error
	return sessions, err
}

func (s *ChatStore) UpdateSessionTitle(id uint, title string) error {
	return s.db.Model(&model.ChatSession{}).Where("id = ?", id).Update("title", title).Error
}

func (s *ChatStore) CreateMessage(msg *model.ChatMessage) error {
	return s.db.Create(msg).Error
}

func (s *ChatStore) ListMessages(sessionID uint) ([]model.ChatMessage, error) {
	var messages []model.ChatMessage
	err := s.db.Where("session_id = ?", sessionID).Order("created_at ASC").Find(&messages).Error
	return messages, err
}

func (s *ChatStore) GetRecentMessages(sessionID uint, limit int) ([]model.ChatMessage, error) {
	var messages []model.ChatMessage
	err := s.db.Where("session_id = ?", sessionID).
		Order("created_at DESC").Limit(limit).Find(&messages).Error
	// Reverse to chronological order
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return messages, err
}
