package model

import "time"

// ChatChannelMember is membership of an Agent (or Admin in P3) in a Channel.
type ChatChannelMember struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ChannelID  uint      `gorm:"not null;index" json:"channel_id"`
	MemberType string    `gorm:"size:20;not null;default:ai" json:"member_type"` // ai | human
	AgentID    *uint     `json:"agent_id"`                                       // ai member ref
	AdminID    *uint     `json:"admin_id"`                                       // human member ref (P3)
	Muted      bool      `gorm:"not null;default:false" json:"muted"`
	JoinedAt   time.Time `gorm:"not null;default:now()" json:"joined_at"`
}

func (ChatChannelMember) TableName() string { return "chat_channel_members" }
