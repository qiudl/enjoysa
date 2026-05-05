package handler

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"encoding/json"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
	"github.com/gin-gonic/gin"
)

// ImageUploadHandler proxies image uploads to ai-proj COS.
type ImageUploadHandler struct {
	aiprojBase  string
	aiprojToken string
	client      *http.Client
}

// NewImageUploadHandler creates a handler; returns nil if ai-proj is not configured.
func NewImageUploadHandler(cfg config.AIConfig) *ImageUploadHandler {
	if cfg.AIProjBase == "" || cfg.AIProjToken == "" {
		return nil
	}
	return &ImageUploadHandler{
		aiprojBase:  cfg.AIProjBase,
		aiprojToken: cfg.AIProjToken,
		client:      &http.Client{Timeout: 30 * time.Second},
	}
}

// Upload handles POST /api/v1/ai/upload-image
// Receives multipart file, forwards to ai-proj /upload/image, returns COS URL.
// Falls back to local /api/v1/upload if ai-proj fails.
func (h *ImageUploadHandler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "file is required"})
		return
	}
	defer file.Close()

	// FIX #17: Validate file type (image only)
	ct := header.Header.Get("Content-Type")
	allowedTypes := map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true, "image/gif": true}
	if !allowedTypes[ct] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "only image files allowed (JPEG/PNG/WebP/GIF)"})
		return
	}

	// Read file content
	fileBytes, err := io.ReadAll(io.LimitReader(file, 3*1024*1024)) // 3MB max
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "failed to read file"})
		return
	}

	// Forward to ai-proj COS
	cosURL, err := h.uploadToAIProj(fileBytes, header.Filename)
	if err != nil {
		logger.Warn("[ImageUpload] ai-proj COS upload failed, falling back to local: %v", err)
		// Fallback: save locally via the existing upload handler
		// Re-set the file for the next handler
		c.JSON(http.StatusOK, gin.H{
			"success":  false,
			"error":    "COS upload failed",
			"fallback": true,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url":     cosURL,
			"storage": "cos",
		},
	})
}

func (h *ImageUploadHandler) uploadToAIProj(fileBytes []byte, filename string) (string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("image", filename)
	if err != nil {
		return "", fmt.Errorf("create form: %w", err)
	}
	if _, err := part.Write(fileBytes); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}
	writer.Close()

	req, err := http.NewRequest("POST", h.aiprojBase+"/upload/image", &buf)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+h.aiprojToken)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := h.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("ai-proj %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}
	if result.Data.URL == "" {
		return "", fmt.Errorf("no url in response")
	}

	return result.Data.URL, nil
}
