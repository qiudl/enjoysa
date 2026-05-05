package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
)

// GLMClient handles image recognition via GLM-4V-Flash.
type GLMClient struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

// NewGLMClient creates a GLM vision client.
func NewGLMClient(cfg config.AIConfig) *GLMClient {
	if cfg.GLMBaseURL == "" || cfg.GLMAPIKey == "" {
		return nil
	}
	return &GLMClient{
		baseURL: cfg.GLMBaseURL,
		apiKey:  cfg.GLMAPIKey,
		client:  &http.Client{Timeout: 15 * time.Second},
	}
}

// DescribeImages sends images to GLM-4V-Flash and returns text descriptions.
// imageURLs are COS/HTTP URLs; the client downloads and converts to base64.
// Returns a combined description of all images.
func (g *GLMClient) DescribeImages(ctx context.Context, imageURLs []string, userMessage string) (string, error) {
	// Build content array with text + images (max 3 for performance)
	content := []map[string]interface{}{
		{"type": "text", "text": "请详细描述以下图片的内容，包括：可见的文字、UI 元素、按钮、错误信息、页面布局等。用户的问题是：" + userMessage},
	}

	maxImages := 3
	if len(imageURLs) < maxImages {
		maxImages = len(imageURLs)
	}

	for i := 0; i < maxImages; i++ {
		b64, err := downloadAndEncode(imageURLs[i])
		if err != nil {
			logger.Warn("Failed to download image %s: %v", imageURLs[i], err)
			continue
		}
		content = append(content, map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]interface{}{
				"url": "data:image/jpeg;base64," + b64,
			},
		})
	}

	// If no images were successfully encoded, return empty
	if len(content) <= 1 {
		return "", fmt.Errorf("no images could be processed")
	}

	reqBody := map[string]interface{}{
		"model": "glm-4v-flash",
		"messages": []map[string]interface{}{
			{"role": "user", "content": content},
		},
		"max_tokens": 500,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal GLM request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", g.baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create GLM request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.apiKey)

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("GLM request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GLM returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse GLM response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("GLM returned empty choices")
	}

	return result.Choices[0].Message.Content, nil
}

// downloadAndEncode downloads an image URL and returns base64.
func downloadAndEncode(imageURL string) (string, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(imageURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download %d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 3*1024*1024)) // 3MB max
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(data), nil
}
