package model

import "time"

// TicketAttachment 工单凭证图片/附件，关联到 ticket 上的图片 URL 列表。
// 图片本身经由 /api/v1/ai/upload-image 上传到 ai-proj COS（或 local fallback），
// 这里只存可访问的 URL。
type TicketAttachment struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	TicketID uint   `gorm:"index;not null" json:"ticket_id"`
	FileURL  string `gorm:"size:500;not null" json:"file_url"`
	FileName string `gorm:"size:200" json:"file_name,omitempty"`
}

func (TicketAttachment) TableName() string {
	return "aftersales_ticket_attachments"
}
