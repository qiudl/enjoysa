package store

import (
	"time"

	"gorm.io/gorm"
)

// KnowledgeEntry mirrors the columns of ai_knowledge_base that we write from
// the share flow. It is intentionally minimal and does not replace the
// hand-curated seeds in migration 004 — those still go via raw SQL.
type KnowledgeEntry struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Category  string `gorm:"size:50;not null" json:"category"`
	Title     string `gorm:"size:200;not null" json:"title"`
	Content   string `gorm:"type:text;not null" json:"content"`
	Keywords  string `gorm:"size:500" json:"keywords,omitempty"`
	Audience  string `gorm:"size:20;not null;default:all" json:"audience"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
	IsActive  bool   `gorm:"default:true" json:"is_active"`

	Source   string `gorm:"size:50;not null;default:manual" json:"source"`
	SourceID *uint  `gorm:"index" json:"source_id,omitempty"`
	Author   string `gorm:"size:100" json:"author,omitempty"`
}

func (KnowledgeEntry) TableName() string { return "ai_knowledge_base" }

// KnowledgeStore writes admin-curated knowledge entries that the
// search_knowledge tool will retrieve via RAG.
type KnowledgeStore struct {
	db *gorm.DB
}

func NewKnowledgeStore(db *gorm.DB) *KnowledgeStore {
	return &KnowledgeStore{db: db}
}

// Create inserts a new knowledge entry and returns its primary key.
// Defaults source="manual" and audience="all" when callers leave them blank.
func (s *KnowledgeStore) Create(entry *KnowledgeEntry) (uint, error) {
	if entry.Source == "" {
		entry.Source = "manual"
	}
	if entry.Audience == "" {
		entry.Audience = "all"
	}
	if entry.Category == "" {
		entry.Category = "share"
	}
	entry.IsActive = true

	if err := s.db.Create(entry).Error; err != nil {
		return 0, err
	}
	return entry.ID, nil
}
