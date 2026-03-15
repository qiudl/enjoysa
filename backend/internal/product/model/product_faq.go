package model

import (
	"time"

	"gorm.io/gorm"
)

type ProductFAQ struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ProductID  uint   `gorm:"index;not null" json:"product_id"`
	QuestionZh string `gorm:"size:500" json:"question_zh"`
	QuestionEn string `gorm:"size:500" json:"question_en"`
	AnswerZh   string `gorm:"size:2000" json:"answer_zh"`
	AnswerEn   string `gorm:"size:2000" json:"answer_en"`
	SortOrder  int    `gorm:"default:0" json:"sort_order"`
}

func (ProductFAQ) TableName() string {
	return "product_faqs"
}
