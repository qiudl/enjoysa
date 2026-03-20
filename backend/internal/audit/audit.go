package audit

import (
	authmodel "enjoysa-backend/internal/auth/model"
	"enjoysa-backend/internal/audit/model"
	"enjoysa-backend/internal/audit/store"

	"github.com/gin-gonic/gin"
)

// Logger provides a convenient way to record audit logs from handlers.
type Logger struct {
	store *store.AuditStore
}

func NewLogger(s *store.AuditStore) *Logger {
	return &Logger{store: s}
}

// Log records an audit entry. Call this from any handler after a successful operation.
func (l *Logger) Log(c *gin.Context, action, resource string, resourceID uint, detail string) {
	var adminID uint
	var adminName string

	if id, ok := c.Get("admin_id"); ok {
		if v, ok := id.(uint); ok {
			adminID = v
		}
	}
	if admin, ok := c.Get("admin"); ok {
		if a, ok := admin.(*authmodel.Admin); ok {
			adminName = a.Name
		}
	}

	entry := &model.AuditLog{
		AdminID:    adminID,
		AdminName:  adminName,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Detail:     detail,
		IP:         c.ClientIP(),
		UserAgent:  c.GetHeader("User-Agent"),
	}

	// Fire and forget — don't block the request
	go l.store.Create(entry)
}
