package store

import (
	"errors"
	"fmt"
	"strings"
	"unicode"

	"github.com/lib/pq"
	"gorm.io/gorm"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// ChannelStore handles workspace-scoped chat_channels CRUD.
type ChannelStore struct {
	db *gorm.DB
}

func NewChannelStore(db *gorm.DB) *ChannelStore {
	return &ChannelStore{db: db}
}

// CreateInput is the user-provided shape for ChannelStore.Create.
type CreateInput struct {
	Name           string
	Description    string
	DefaultAgentID uint
	KeywordRules   []string
	IsDefault      bool
}

// Create inserts a new channel. Slug is derived from name and disambiguated
// on conflict (defect-analysis D3): "退款" → "tuikuan", or "tuikuan-2", etc.
//
// The first channel for a workspace is typically created with IsDefault=true
// (the un-deletable #客服-默认). Subsequent calls reject IsDefault=true via
// the partial unique index `uq_channel_workspace_default`.
func (s *ChannelStore) Create(workspaceID uint, in CreateInput) (*chatmodel.ChatChannel, error) {
	if workspaceID == 0 {
		return nil, fmt.Errorf("channel: workspaceID required")
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, fmt.Errorf("channel: name required")
	}
	if in.DefaultAgentID == 0 {
		return nil, fmt.Errorf("channel: at least one agent required (default_agent_id)")
	}

	baseSlug := slugify(name)
	if baseSlug == "" {
		baseSlug = "channel"
	}
	slug, err := s.uniqueSlug(workspaceID, baseSlug)
	if err != nil {
		return nil, err
	}

	defID := in.DefaultAgentID
	rules := in.KeywordRules
	if rules == nil {
		rules = []string{}
	}
	c := chatmodel.ChatChannel{
		WorkspaceID:    workspaceID,
		Name:           name,
		Slug:           slug,
		Description:    strings.TrimSpace(in.Description),
		DefaultAgentID: &defID,
		KeywordRules:   pq.StringArray(rules),
		IsDefault:      in.IsDefault,
	}
	if err := s.db.Create(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

// ListByWorkspace returns active (or all when includeArchived) channels.
func (s *ChannelStore) ListByWorkspace(workspaceID uint, includeArchived bool) ([]chatmodel.ChatChannel, error) {
	var rows []chatmodel.ChatChannel
	q := s.db.Where("workspace_id = ?", workspaceID)
	if !includeArchived {
		q = q.Where("archived = ?", false)
	}
	err := q.Order("is_default DESC, name ASC").Find(&rows).Error
	return rows, err
}

// Get returns a channel by id.
func (s *ChannelStore) Get(id uint) (*chatmodel.ChatChannel, error) {
	var c chatmodel.ChatChannel
	if err := s.db.First(&c, id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

// GetBySlug locates a channel within a workspace by URL slug.
func (s *ChannelStore) GetBySlug(workspaceID uint, slug string) (*chatmodel.ChatChannel, error) {
	var c chatmodel.ChatChannel
	err := s.db.Where("workspace_id = ? AND slug = ?", workspaceID, slug).First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// UpdateInput captures editable channel fields.
type UpdateInput struct {
	Name           *string
	Description    *string
	DefaultAgentID *uint
	KeywordRules   *[]string
}

// Update mutates editable fields. is_default is intentionally *not* mutable
// (defect-analysis D4 — the migration script keys off is_default).
func (s *ChannelStore) Update(id uint, in UpdateInput) (*chatmodel.ChatChannel, error) {
	updates := map[string]any{}
	if in.Name != nil {
		name := strings.TrimSpace(*in.Name)
		if name == "" {
			return nil, fmt.Errorf("channel: name cannot be empty")
		}
		updates["name"] = name
	}
	if in.Description != nil {
		updates["description"] = strings.TrimSpace(*in.Description)
	}
	if in.DefaultAgentID != nil {
		if *in.DefaultAgentID == 0 {
			return nil, fmt.Errorf("channel: default_agent_id cannot be 0 (channel must always have a default)")
		}
		updates["default_agent_id"] = *in.DefaultAgentID
	}
	if in.KeywordRules != nil {
		updates["keyword_rules"] = pq.StringArray(*in.KeywordRules)
	}
	if len(updates) == 0 {
		return s.Get(id)
	}
	updates["updated_at"] = gorm.Expr("NOW()")
	if err := s.db.Model(&chatmodel.ChatChannel{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.Get(id)
}

// Archive soft-hides a channel from the sidebar (data preserved).
// Rejects archiving the default channel (defect-analysis D4).
func (s *ChannelStore) Archive(id uint) error {
	c, err := s.Get(id)
	if err != nil {
		return err
	}
	if c.IsDefault {
		return ErrCannotArchiveDefault
	}
	return s.db.Model(&chatmodel.ChatChannel{}).Where("id = ?", id).
		Updates(map[string]any{"archived": true, "updated_at": gorm.Expr("NOW()")}).Error
}

// Unarchive flips archived back to FALSE.
func (s *ChannelStore) Unarchive(id uint) error {
	return s.db.Model(&chatmodel.ChatChannel{}).Where("id = ?", id).
		Updates(map[string]any{"archived": false, "updated_at": gorm.Expr("NOW()")}).Error
}

// ErrCannotArchiveDefault is returned by Archive when targeting is_default=TRUE.
var ErrCannotArchiveDefault = errors.New("default channel cannot be archived")

// uniqueSlug appends -2/-3/... until the slug is unique within workspace.
func (s *ChannelStore) uniqueSlug(workspaceID uint, base string) (string, error) {
	slug := base
	for n := 2; ; n++ {
		var count int64
		if err := s.db.Model(&chatmodel.ChatChannel{}).
			Where("workspace_id = ? AND slug = ?", workspaceID, slug).
			Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, n)
		if n > 100 { // pathological — bail rather than spin forever
			return "", fmt.Errorf("channel: failed to find unique slug for %q after 100 tries", base)
		}
	}
}

// slugify maps any (latin or CJK) channel name to a URL-safe slug.
// CJK and other non-ASCII chars are dropped — if the entire name is CJK,
// the caller's slug is "" and we fall back to "channel-N" via uniqueSlug.
//
// (Pinyin transliteration is out of scope for P1; users see Chinese in the
// sidebar and slug only matters for direct-link URLs.)
func slugify(name string) string {
	var b strings.Builder
	for _, r := range name {
		switch {
		case unicode.IsLetter(r) && r < 128:
			b.WriteRune(unicode.ToLower(r))
		case unicode.IsDigit(r):
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_':
			if b.Len() > 0 {
				last := b.String()[b.Len()-1]
				if last != '-' {
					b.WriteByte('-')
				}
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 40 {
		out = strings.TrimRight(out[:40], "-")
	}
	return out
}
