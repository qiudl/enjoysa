package store

import (
	"encoding/json"
	"log"

	"enjoysa-backend/internal/supplier/model"

	"github.com/gin-gonic/gin"
)

// SupplierAuditLogger 供应商审计日志记录器
type SupplierAuditLogger struct {
	store *AuditLogStore
}

func NewSupplierAuditLogger(store *AuditLogStore) *SupplierAuditLogger {
	return &SupplierAuditLogger{store: store}
}

func (l *SupplierAuditLogger) Log(c *gin.Context, action, resourceType string, resourceID uint, resourceName string, detail interface{}) {
	supplierID, _ := c.Get("supplier_id")
	userID, _ := c.Get("supplier_user_id")
	userName, _ := c.Get("supplier_user_name")

	sid, _ := supplierID.(uint)
	uid, _ := userID.(uint)
	uname, _ := userName.(string)

	detailJSON := ""
	if detail != nil {
		if b, err := json.Marshal(detail); err == nil {
			detailJSON = string(b)
		}
	}

	entry := &model.SupplierAuditLog{
		SupplierID:   sid,
		UserID:       uid,
		UserName:     uname,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ResourceName: resourceName,
		Detail:       detailJSON,
		IP:           c.ClientIP(),
		UserAgent:    c.GetHeader("User-Agent"),
	}

	// Fire and forget with error logging
	go func() {
		if err := l.store.Create(entry); err != nil {
			log.Printf("[SupplierAuditLogger] Failed to write audit log: %v", err)
		}
	}()
}
