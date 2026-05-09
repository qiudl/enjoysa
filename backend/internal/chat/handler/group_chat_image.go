// REQ-20260509-0037 dev-6: image_url → GLM-4V vision OCR for the group-chat
// send pipelines. Mirrors the legacy chat_handler.go FIX #1+#2 path: emit a
// "status" SSE event so the user sees "正在识别图片...", call GLM, fold the
// recognition text into the LLM prompt only (DB stores the user's original
// content unmodified).
package handler

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"

	aichatservice "enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/core/logger"
)

// augmentUserContentWithOCR runs GLM-4V over imageURLs and returns a copy of
// userContent with the recognition result + image markdown appended for the
// LLM to read. Returns userContent unchanged when no images / GLM not wired.
//
// Side effects: emits SSE "status" events while OCR is in progress so the
// frontend can render a "recognising images..." spinner.
func augmentUserContentWithOCR(ctx context.Context, c *gin.Context, glm *aichatservice.GLMClient, imageURLs []string, userContent string) string {
	if glm == nil || len(imageURLs) == 0 {
		return userContent
	}

	writeSSE(c, "status", map[string]any{"content": "正在识别图片..."})

	scheme := "https"
	host := c.Request.Host
	if host == "" {
		host = "enjoysau.com"
	}
	absoluteURLs := make([]string, 0, len(imageURLs))
	for _, u := range imageURLs {
		if strings.HasPrefix(u, "/") {
			u = scheme + "://" + host + u
		}
		absoluteURLs = append(absoluteURLs, u)
	}

	var b strings.Builder
	b.WriteString(userContent)

	description, err := glm.DescribeImages(ctx, absoluteURLs, userContent)
	if err != nil {
		logger.Warnf("[group_chat] GLM OCR failed: %v", err)
		b.WriteString("\n\n[用户上传了图片但识别失败，请基于文字回复]")
	} else {
		b.WriteString("\n\n[AI 图片识别结果: ")
		b.WriteString(description)
		b.WriteString("]")
	}
	for _, u := range imageURLs {
		b.WriteString("\n![图片](")
		b.WriteString(u)
		b.WriteString(")")
	}
	return b.String()
}
