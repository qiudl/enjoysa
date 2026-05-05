package handler

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UploadHandler struct {
	cfg config.UploadConfig
}

func NewUploadHandler(cfg config.UploadConfig) *UploadHandler {
	return &UploadHandler{cfg: cfg}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "No file uploaded")
		return
	}

	// Check size
	maxSize := int64(h.cfg.MaxSize) * 1024 * 1024
	if file.Size > maxSize {
		response.BadRequest(c, fmt.Sprintf("File too large, max %dMB", h.cfg.MaxSize))
		return
	}

	// Check type
	contentType := file.Header.Get("Content-Type")
	allowed := false
	for _, t := range h.cfg.AllowedTypes {
		if contentType == t {
			allowed = true
			break
		}
	}
	if !allowed {
		response.BadRequest(c, fmt.Sprintf("File type not allowed: %s. Accepted: JPG, PNG, WebP, GIF, PDF", contentType))
		return
	}

	// Generate unique filename with date-based subdirectory
	ext := filepath.Ext(file.Filename)
	dateDir := time.Now().Format("2006/01/02")
	filename := fmt.Sprintf("%s/%s%s", dateDir, uuid.New().String(), ext)
	dst := filepath.Join(h.cfg.Dir, filename)

	// Ensure subdirectory exists
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		response.ServerError(c, "Failed to create upload directory")
		return
	}

	if err := c.SaveUploadedFile(file, dst); err != nil {
		response.ServerError(c, "Failed to save file")
		return
	}

	response.Success(c, gin.H{
		"url": "/uploads/" + filename,
	})
}
