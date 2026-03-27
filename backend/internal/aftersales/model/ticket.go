package model

import (
	"fmt"
	"math/rand"
	"time"

	"gorm.io/gorm"
)

type TicketType string

const (
	TicketTypeRefund    TicketType = "refund"
	TicketTypeExchange  TicketType = "exchange"
	TicketTypeComplaint TicketType = "complaint"
	TicketTypeInquiry   TicketType = "inquiry"
)

type TicketStatus string

const (
	TicketStatusOpen       TicketStatus = "open"
	TicketStatusProcessing TicketStatus = "processing"
	TicketStatusResolved   TicketStatus = "resolved"
	TicketStatusClosed     TicketStatus = "closed"
)

type TicketPriority string

const (
	TicketPriorityLow    TicketPriority = "low"
	TicketPriorityMedium TicketPriority = "medium"
	TicketPriorityHigh   TicketPriority = "high"
)

type Ticket struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TicketNo    string         `gorm:"uniqueIndex;size:30;not null" json:"ticket_no"`
	OrderID     *uint          `gorm:"index" json:"order_id,omitempty"`
	UserID      *uint          `gorm:"index" json:"user_id,omitempty"`
	Type        TicketType     `gorm:"size:20;index;not null;default:inquiry" json:"type"`
	Status      TicketStatus   `gorm:"size:20;index;not null;default:open" json:"status"`
	Priority    TicketPriority `gorm:"size:10;not null;default:medium" json:"priority"`
	Subject     string         `gorm:"size:200;not null" json:"subject"`
	Description string         `gorm:"type:text" json:"description"`
	Resolution  string         `gorm:"type:text" json:"resolution,omitempty"`
	Source      string         `gorm:"size:20;not null;default:feishu" json:"source"`

	// 联系人信息（飞书用户可能没有 enjoysa 账号）
	ContactName  string `gorm:"size:100" json:"contact_name,omitempty"`
	ContactPhone string `gorm:"size:20" json:"contact_phone,omitempty"`
	ContactEmail string `gorm:"size:100" json:"contact_email,omitempty"`
	FeishuOpenID string `gorm:"size:100;index" json:"feishu_open_id,omitempty"`

	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
}

func (Ticket) TableName() string {
	return "aftersales_tickets"
}

func (t *Ticket) BeforeCreate(tx *gorm.DB) error {
	if t.TicketNo == "" {
		t.TicketNo = GenerateTicketNo()
	}
	return nil
}

func GenerateTicketNo() string {
	now := time.Now()
	return fmt.Sprintf("AS-%s-%04d", now.Format("20060102"), rand.Intn(10000))
}

// TicketNote 工单备注/沟通记录
type TicketNote struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	TicketID  uint      `gorm:"index;not null" json:"ticket_id"`
	Author    string    `gorm:"size:100;not null" json:"author"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	IsSystem  bool      `gorm:"default:false" json:"is_system"`
}

func (TicketNote) TableName() string {
	return "aftersales_ticket_notes"
}

// FAQ 常见问题
type FAQ struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Category string `gorm:"size:50;index;not null" json:"category"`
	Question string `gorm:"size:500;not null" json:"question"`
	Answer   string `gorm:"type:text;not null" json:"answer"`
	SortOrder int   `gorm:"default:0" json:"sort_order"`
	IsActive  bool  `gorm:"default:true" json:"is_active"`
}

func (FAQ) TableName() string {
	return "aftersales_faqs"
}
