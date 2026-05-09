// REQ-20260509-0037 dev-4: store helpers for the new channel-based ChatMessage flow.
//
// The legacy ChatStore in chat_store.go keeps working for the 1-on-1 path;
// once dev-7 ships UI we deprecate the old send endpoint and remove this
// duplication. Until then we add a focused MessageStore that *only* knows
// channel/thread shapes — no session_id field surfaces in the API.
package store

import (
	"github.com/lib/pq"
	"gorm.io/gorm"

	chatmodel "enjoysa-backend/internal/chat/model"
)

type MessageStore struct {
	db *gorm.DB
}

func NewMessageStore(db *gorm.DB) *MessageStore {
	return &MessageStore{db: db}
}

// AppendInput captures the user-facing fields for a new channel message.
type AppendInput struct {
	ChannelID      uint
	ThreadParentID *uint  // nil = main flow; non-nil = thread reply
	SenderType     string // user | ai | human | system
	SenderAgentID  *uint  // ai sender ref
	SenderAdminID  *uint  // human sender ref (P3)
	Mentions       []uint // mentioned agent IDs (in order)
	Content        string
	AlsoInChannel  bool // thread reply also pinned back to channel main
}

// Append inserts a new message and returns the saved row (with ID + CreatedAt).
func (s *MessageStore) Append(in AppendInput) (*chatmodel.ChatMessage, error) {
	role := senderTypeToRole(in.SenderType)

	mentionsArr := make(pq.Int64Array, 0, len(in.Mentions))
	for _, m := range in.Mentions {
		mentionsArr = append(mentionsArr, int64(m))
	}

	cid := in.ChannelID
	msg := chatmodel.ChatMessage{
		Role:           role,
		Content:        in.Content,
		ChannelID:      &cid,
		ThreadParentID: in.ThreadParentID,
		SenderType:     in.SenderType,
		SenderAgentID:  in.SenderAgentID,
		SenderAdminID:  in.SenderAdminID,
		Mentions:       mentionsArr,
		AlsoInChannel:  in.AlsoInChannel,
	}
	if err := s.db.Create(&msg).Error; err != nil {
		return nil, err
	}
	return &msg, nil
}

// ListChannelMain returns the most recent main-flow messages in the channel,
// in chronological (ascending) order suitable for prompt history. Includes
// thread replies that opted in via also_in_channel=TRUE (defect T3).
//
// `before` is an optional cursor (message ID); 0 = "most recent".
func (s *MessageStore) ListChannelMain(channelID uint, before uint, limit int) ([]chatmodel.ChatMessage, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := s.db.Where(`channel_id = ? AND (thread_parent_id IS NULL OR also_in_channel = TRUE)`,
		channelID)
	if before > 0 {
		q = q.Where("id < ?", before)
	}
	var rows []chatmodel.ChatMessage
	err := q.Order("created_at DESC").Limit(limit).Find(&rows).Error
	if err != nil {
		return nil, err
	}
	// Reverse to ascending for prompt history convenience.
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows, nil
}

// ListThreadReplies returns every reply for a thread parent in chronological order.
func (s *MessageStore) ListThreadReplies(parentID uint, limit int) ([]chatmodel.ChatMessage, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var rows []chatmodel.ChatMessage
	err := s.db.Where("thread_parent_id = ?", parentID).
		Order("created_at ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

// Get loads a single message by id (used to validate thread parents).
func (s *MessageStore) Get(id uint) (*chatmodel.ChatMessage, error) {
	var m chatmodel.ChatMessage
	if err := s.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// CountThreadReplies returns the number of replies for a parent message.
// Used by GetChannelMessages to surface the thread-reply count badge.
func (s *MessageStore) CountThreadReplies(parentID uint) (int64, error) {
	var n int64
	err := s.db.Model(&chatmodel.ChatMessage{}).
		Where("thread_parent_id = ?", parentID).Count(&n).Error
	return n, err
}

// CountThreadRepliesBatch returns reply counts keyed by parent_id, for the
// given parent message IDs. Avoids N+1 when listing channel main flow.
func (s *MessageStore) CountThreadRepliesBatch(parentIDs []uint) (map[uint]int64, error) {
	out := make(map[uint]int64, len(parentIDs))
	if len(parentIDs) == 0 {
		return out, nil
	}
	type row struct {
		ParentID uint
		N        int64
	}
	var rows []row
	err := s.db.Raw(`
		SELECT thread_parent_id AS parent_id, COUNT(*) AS n
		FROM chat_messages
		WHERE thread_parent_id IN (?)
		GROUP BY thread_parent_id
	`, parentIDs).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ParentID] = r.N
	}
	return out, nil
}

func senderTypeToRole(senderType string) string {
	switch senderType {
	case "user", "human":
		return "user"
	case "ai":
		return "assistant"
	case "system":
		return "system"
	default:
		return "user"
	}
}
