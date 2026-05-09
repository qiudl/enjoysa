// Command migrate-chat-groups back-fills the new group-chat schema
// (REQ-20260509-0037 dev-2) for legacy chat_sessions / chat_messages.
//
// For every (user_id, user_type) that has a non-empty session history:
//   1. upsert chat_workspaces (UNIQUE owner_user_id, owner_user_type)
//   2. ensure a #客服-默认 channel (is_default=TRUE) for that workspace
//   3. ensure all default_in_new_channel agents are channel members
//   4. for each old session belonging to that user, attach its messages
//      to the default channel by setting channel_id, sender_type and
//      sender_agent_id (assistant rows → cs agent by default).
//   5. between two merged sessions, insert a system separator row
//      "[已合并自旧会话 #N · 创建于 YYYY-MM-DD]" so the user can tell where
//      one historical conversation ends and the next begins (defect D1).
//
// The script is **idempotent**: every row is updated only if its channel_id
// is still NULL, and every workspace/channel insert uses ON CONFLICT DO
// NOTHING. Re-running is a no-op once the back-fill is complete.
//
// Use --dry-run to print the impact summary without writing.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/core/config"
)

func main() {
	configPath := flag.String("config", "configs/config.yaml", "path to config file")
	dryRun := flag.Bool("dry-run", false, "print summary without writing")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	owners, err := loadDistinctOwners(db)
	if err != nil {
		log.Fatalf("loadOwners: %v", err)
	}
	fmt.Printf("Distinct (user_id, user_type) with sessions: %d\n", len(owners))

	csAgent, techAgent, err := loadAgents(db)
	if err != nil {
		log.Fatalf("loadAgents: %v", err)
	}
	fmt.Printf("Agents: cs=#%d (%s) tech=#%d (%s)\n",
		csAgent.ID, csAgent.Code, techAgent.ID, techAgent.Code)

	totals := summary{}
	start := time.Now()
	for _, o := range owners {
		s, err := migrateOwner(db, o, csAgent, techAgent, *dryRun)
		if err != nil {
			log.Fatalf("owner %d/%s: %v", o.UserID, o.UserType, err)
		}
		totals.add(s)
	}
	fmt.Printf("\n=== %s ===\n", boolStr(*dryRun, "DRY-RUN", "MIGRATED"))
	totals.print()
	fmt.Printf("Elapsed: %s\n", time.Since(start).Round(time.Millisecond))

	if *dryRun {
		os.Exit(0)
	}
}

type ownerKey struct {
	UserID   uint
	UserType string
}

type summary struct {
	workspacesCreated  int
	channelsCreated    int
	membersCreated     int
	separatorsInserted int
	messagesAttached   int
	ownersSkipped      int // already fully migrated
}

func (a *summary) add(b summary) {
	a.workspacesCreated += b.workspacesCreated
	a.channelsCreated += b.channelsCreated
	a.membersCreated += b.membersCreated
	a.separatorsInserted += b.separatorsInserted
	a.messagesAttached += b.messagesAttached
	a.ownersSkipped += b.ownersSkipped
}

func (s summary) print() {
	fmt.Printf("workspaces created : %d\n", s.workspacesCreated)
	fmt.Printf("channels created   : %d\n", s.channelsCreated)
	fmt.Printf("members added      : %d\n", s.membersCreated)
	fmt.Printf("separators added   : %d\n", s.separatorsInserted)
	fmt.Printf("messages attached  : %d\n", s.messagesAttached)
	fmt.Printf("owners no-op       : %d\n", s.ownersSkipped)
}

func loadDistinctOwners(db *gorm.DB) ([]ownerKey, error) {
	var rows []ownerKey
	err := db.Raw(`
		SELECT DISTINCT user_id, user_type
		FROM chat_sessions
		WHERE deleted_at IS NULL
	`).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].UserType != rows[j].UserType {
			return rows[i].UserType < rows[j].UserType
		}
		return rows[i].UserID < rows[j].UserID
	})
	return rows, nil
}

// loadAgents loads cs + tech by code; both must be seeded.
func loadAgents(db *gorm.DB) (cs, tech chatmodel.ChatAgent, err error) {
	if err = db.Where("code = ?", chatmodel.AgentCodeCustomerService).First(&cs).Error; err != nil {
		return cs, tech, fmt.Errorf("cs agent missing — run seed first: %w", err)
	}
	if err = db.Where("code = ?", chatmodel.AgentCodeTechSupport).First(&tech).Error; err != nil {
		return cs, tech, fmt.Errorf("tech agent missing — run seed first: %w", err)
	}
	return cs, tech, nil
}

func migrateOwner(db *gorm.DB, o ownerKey, cs, tech chatmodel.ChatAgent, dryRun bool) (summary, error) {
	s := summary{}

	// Quick short-circuit: any unattached message left for this owner? If 0,
	// owner is already migrated.
	var unattached int64
	err := db.Raw(`
		SELECT COUNT(*) FROM chat_messages m
		JOIN chat_sessions sess ON sess.id = m.session_id
		WHERE sess.user_id = ? AND sess.user_type = ?
		  AND m.channel_id IS NULL
	`, o.UserID, o.UserType).Scan(&unattached).Error
	if err != nil {
		return s, err
	}
	if unattached == 0 {
		s.ownersSkipped++
		return s, nil
	}

	if dryRun {
		// In dry-run, only forecast counts.
		var sessionCount int64
		_ = db.Raw(`
			SELECT COUNT(*) FROM chat_sessions
			WHERE user_id = ? AND user_type = ? AND deleted_at IS NULL
		`, o.UserID, o.UserType).Scan(&sessionCount).Error
		s.workspacesCreated = 1
		s.channelsCreated = 1
		s.membersCreated = 2
		s.separatorsInserted = int(sessionCount) // one separator per session
		s.messagesAttached = int(unattached)
		return s, nil
	}

	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	// 1. Workspace upsert.
	ws := chatmodel.ChatWorkspace{OwnerUserID: o.UserID, OwnerUserType: o.UserType}
	wsCreated, err := upsertWorkspace(tx, &ws)
	if err != nil {
		tx.Rollback()
		return s, err
	}
	if wsCreated {
		s.workspacesCreated++
	}

	// 2. Default channel upsert.
	channel, chCreated, err := upsertDefaultChannel(tx, ws.ID, &cs)
	if err != nil {
		tx.Rollback()
		return s, err
	}
	if chCreated {
		s.channelsCreated++
	}

	// 3. Members upsert.
	for _, ag := range []chatmodel.ChatAgent{cs, tech} {
		added, err := upsertChannelMember(tx, channel.ID, ag.ID)
		if err != nil {
			tx.Rollback()
			return s, err
		}
		if added {
			s.membersCreated++
		}
	}

	// 4 + 5. Walk owner's sessions in chronological order; per session, insert
	//        separator marker + attach all unmigrated messages.
	type sessRow struct {
		ID        uint
		CreatedAt time.Time
	}
	var sessions []sessRow
	err = tx.Raw(`
		SELECT id, created_at FROM chat_sessions
		WHERE user_id = ? AND user_type = ? AND deleted_at IS NULL
		ORDER BY created_at ASC
	`, o.UserID, o.UserType).Scan(&sessions).Error
	if err != nil {
		tx.Rollback()
		return s, err
	}

	for _, sess := range sessions {
		var msgCount int64
		_ = tx.Raw(`
			SELECT COUNT(*) FROM chat_messages
			WHERE session_id = ? AND channel_id IS NULL
		`, sess.ID).Scan(&msgCount).Error
		if msgCount == 0 {
			continue
		}

		// 5. Separator marker (timestamp 1 microsecond before earliest).
		var earliest time.Time
		_ = tx.Raw(`
			SELECT MIN(created_at) FROM chat_messages
			WHERE session_id = ? AND channel_id IS NULL
		`, sess.ID).Scan(&earliest).Error
		separatorTime := earliest.Add(-time.Microsecond)
		separatorContent := fmt.Sprintf("[已合并自旧会话 #%d · 创建于 %s]",
			sess.ID, sess.CreatedAt.Format("2006-01-02"))

		err = tx.Exec(`
			INSERT INTO chat_messages
			    (created_at, session_id, role, content, channel_id, sender_type)
			VALUES (?, 0, 'system', ?, ?, 'system')
		`, separatorTime, separatorContent, channel.ID).Error
		if err != nil {
			tx.Rollback()
			return s, err
		}
		s.separatorsInserted++

		// 4. Attach session's messages (defaults: user→user, assistant→ai cs,
		//    system→system; all become channel main flow).
		res := tx.Exec(`
			UPDATE chat_messages SET
			    channel_id = ?,
			    sender_type = CASE role
			        WHEN 'user' THEN 'user'
			        WHEN 'assistant' THEN 'ai'
			        ELSE 'system'
			    END,
			    sender_agent_id = CASE WHEN role = 'assistant' THEN ? ELSE NULL END
			WHERE session_id = ? AND channel_id IS NULL
		`, channel.ID, cs.ID, sess.ID)
		if res.Error != nil {
			tx.Rollback()
			return s, res.Error
		}
		s.messagesAttached += int(res.RowsAffected)
	}

	if err := tx.Commit().Error; err != nil {
		return s, err
	}
	return s, nil
}

func upsertWorkspace(tx *gorm.DB, ws *chatmodel.ChatWorkspace) (created bool, err error) {
	res := tx.Exec(`
		INSERT INTO chat_workspaces (owner_user_id, owner_user_type, created_at, updated_at)
		VALUES (?, ?, NOW(), NOW())
		ON CONFLICT (owner_user_id, owner_user_type) DO NOTHING
	`, ws.OwnerUserID, ws.OwnerUserType)
	if res.Error != nil {
		return false, res.Error
	}
	created = res.RowsAffected == 1
	// Always re-select to populate the ID for caller use.
	if err := tx.Where("owner_user_id = ? AND owner_user_type = ?",
		ws.OwnerUserID, ws.OwnerUserType).First(ws).Error; err != nil {
		return created, err
	}
	return created, nil
}

func upsertDefaultChannel(tx *gorm.DB, workspaceID uint, defaultAgent *chatmodel.ChatAgent) (chatmodel.ChatChannel, bool, error) {
	var existing chatmodel.ChatChannel
	err := tx.Where("workspace_id = ? AND is_default = ?", workspaceID, true).First(&existing).Error
	if err == nil {
		return existing, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return existing, false, err
	}
	defID := defaultAgent.ID
	c := chatmodel.ChatChannel{
		WorkspaceID:    workspaceID,
		Name:           chatmodel.DefaultChannelName,
		Slug:           chatmodel.DefaultChannelSlug,
		Description:    "默认客服频道（迁移自旧会话）",
		DefaultAgentID: &defID,
		IsDefault:      true,
	}
	if err := tx.Create(&c).Error; err != nil {
		return c, false, err
	}
	return c, true, nil
}

func upsertChannelMember(tx *gorm.DB, channelID, agentID uint) (added bool, err error) {
	var n int64
	if err := tx.Raw(`
		SELECT COUNT(*) FROM chat_channel_members
		WHERE channel_id = ? AND agent_id = ?
	`, channelID, agentID).Scan(&n).Error; err != nil {
		return false, err
	}
	if n > 0 {
		return false, nil
	}
	m := chatmodel.ChatChannelMember{
		ChannelID:  channelID,
		MemberType: "ai",
		AgentID:    &agentID,
	}
	if err := tx.Create(&m).Error; err != nil {
		return false, err
	}
	return true, nil
}

func boolStr(b bool, t, f string) string {
	if b {
		return t
	}
	return f
}
