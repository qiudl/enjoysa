package store

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// ChannelMemberStore handles agent (and future admin) membership in channels.
type ChannelMemberStore struct {
	db *gorm.DB
}

func NewChannelMemberStore(db *gorm.DB) *ChannelMemberStore {
	return &ChannelMemberStore{db: db}
}

// AddAgent adds the agent to the channel if not already present.
// Returns gorm.ErrRecordNotFound passthrough on FK violation.
func (s *ChannelMemberStore) AddAgent(channelID, agentID uint) error {
	if channelID == 0 || agentID == 0 {
		return fmt.Errorf("channel_member: channelID and agentID required")
	}
	// Skip if already a member.
	var n int64
	if err := s.db.Model(&chatmodel.ChatChannelMember{}).
		Where("channel_id = ? AND agent_id = ?", channelID, agentID).
		Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	return s.db.Create(&chatmodel.ChatChannelMember{
		ChannelID:  channelID,
		MemberType: "ai",
		AgentID:    &agentID,
	}).Error
}

// RemoveAgent drops the agent from the channel. No-op if not a member.
func (s *ChannelMemberStore) RemoveAgent(channelID, agentID uint) error {
	return s.db.Where("channel_id = ? AND agent_id = ?", channelID, agentID).
		Delete(&chatmodel.ChatChannelMember{}).Error
}

// ListAgents returns the agent IDs in the channel along with the muted flag.
func (s *ChannelMemberStore) ListAgents(channelID uint) ([]chatmodel.ChatChannelMember, error) {
	var rows []chatmodel.ChatChannelMember
	err := s.db.Where("channel_id = ? AND member_type = ?", channelID, "ai").
		Order("joined_at ASC").Find(&rows).Error
	return rows, err
}

// SetMute toggles the agent's muted flag inside the channel.
//
// Defect-analysis R4: callers must reject muting the channel's default agent
// (otherwise the channel goes silent). That check lives in the handler so
// store-level callers (e.g. internal jobs) aren't blocked.
func (s *ChannelMemberStore) SetMute(channelID, agentID uint, muted bool) error {
	res := s.db.Model(&chatmodel.ChatChannelMember{}).
		Where("channel_id = ? AND agent_id = ?", channelID, agentID).
		Update("muted", muted)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrMemberNotFound
	}
	return nil
}

// IsMember reports whether the agent currently belongs to the channel.
func (s *ChannelMemberStore) IsMember(channelID, agentID uint) (bool, error) {
	var n int64
	err := s.db.Model(&chatmodel.ChatChannelMember{}).
		Where("channel_id = ? AND agent_id = ?", channelID, agentID).
		Count(&n).Error
	return n > 0, err
}

// IsMuted reports whether the agent's mute flag is true in the channel.
// Returns (false, ErrMemberNotFound) if the agent isn't a member.
func (s *ChannelMemberStore) IsMuted(channelID, agentID uint) (bool, error) {
	var m chatmodel.ChatChannelMember
	err := s.db.Where("channel_id = ? AND agent_id = ?", channelID, agentID).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, ErrMemberNotFound
	}
	if err != nil {
		return false, err
	}
	return m.Muted, nil
}

// ErrMemberNotFound is returned when an operation targets a non-existent member.
var ErrMemberNotFound = errors.New("channel member not found")
