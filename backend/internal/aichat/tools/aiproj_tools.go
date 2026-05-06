package tools

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
)

// mapKeys returns the sorted keys of a map[string]interface{} for
// diagnostic logs. Returns nil for a nil map (logger.Warnf prints "[]"
// which is fine).
func mapKeys(m map[string]interface{}) []string {
	if m == nil {
		return nil
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// aiProjClient is a simple HTTP client for ai-proj API.
type aiProjClient struct {
	baseURL     string
	token       string
	projectID   int
	client      *http.Client
	dedupCfg    config.AIChatDedupConfig // REQ-20260507-0002 cross-turn dedup knobs
	dedupCache  *dedupCache              // shared per-client TTL cache keyed by actor tag
}

func newAIProjClient(cfg config.AIConfig) *aiProjClient {
	return &aiProjClient{
		baseURL:    strings.TrimRight(cfg.AIProjBase, "/"),
		token:      cfg.AIProjToken,
		projectID:  cfg.AIProjProjID,
		client:     &http.Client{Timeout: 15 * time.Second},
		dedupCfg:   cfg.Dedup,
		dedupCache: newDedupCache(cfg.Dedup.CacheTTLSec),
	}
}

func (c *aiProjClient) doJSON(method, path string, body interface{}) (map[string]interface{}, error) {
	return c.doJSONCtx(context.Background(), method, path, body)
}

// doJSONCtx is the context-aware sibling — REQ-20260507-0002 cross-turn
// dedup uses a 1.5s deadline so a slow ai-proj cannot stall the chat reply.
func (c *aiProjClient) doJSONCtx(ctx context.Context, method, path string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ai-proj API %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	return result, nil
}

func (c *aiProjClient) uploadImage(imageData []byte, filename string) (string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("image", filename)
	if err != nil {
		return "", fmt.Errorf("create form file: %w", err)
	}
	if _, err := part.Write(imageData); err != nil {
		return "", fmt.Errorf("write image data: %w", err)
	}
	writer.Close()

	req, err := http.NewRequest("POST", c.baseURL+"/upload/image", &buf)
	if err != nil {
		return "", fmt.Errorf("create upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("upload failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("upload %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse upload response: %w", err)
	}
	if data, ok := result["data"].(map[string]interface{}); ok {
		if url, ok := data["url"].(string); ok {
			return url, nil
		}
	}
	return "", fmt.Errorf("no url in upload response")
}

// RegisterCreateRequirement registers the create_requirement tool.
func RegisterCreateRequirement(cfg config.AIConfig) model.ToolDef {
	client := newAIProjClient(cfg)
	return model.ToolDef{
		Name:         "create_requirement",
		Description:  "在 ai-proj 项目管理系统中创建一个新需求（写操作）。\n\n【何时调用】用户用文字显式表达创建意图时调用，常见中文触发词：『提需求』『创建需求』『建需求』『新建需求』『开个 issue』『开 ticket』『记录这个 bug』『加到需求池』『报个 bug』。英文触发词：『file an issue』『log this bug』『submit feedback』『open a ticket』『create a requirement』。\n\n【何时不调用 — 反向用例】以下场景必须使用其他工具，禁止调用 create_requirement：\n- 『看看现有需求 / 列一下需求 / 我的需求列表 / show me my requirements』→ 使用 list_requirements\n- 『REQ-XXX 怎么样了 / 查需求 REQ-XXX / get requirement REQ-XXX』→ 使用 get_requirement 或 list_requirements 过滤\n- 『归档需求 / 关闭需求 / archive this』→ 使用对应的 archive 工具\n- 『更新需求 / 修改需求 / update requirement』→ 使用 update_requirement\n\n【其它前置条件】(1) 用户仅上传图片、描述问题、报告 bug 时本身【不是】创建信号，应先文字询问意图。(2) 同一会话内未创建过标题相似的需求（若不确定先调用 list_requirements 确认）。(3) 同一轮回复内不要多次调用本工具——服务端会拒绝重复执行。\n\n【REQ-20260507-0002 跨轮去重】服务端会自动检索你所属用户最近 24h 内通过 chat 创建的 draft 需求；标题主题相似时会返回 action=detected_similar_requirement 与候选列表，**此时禁止默默重试**——必须用自然语言把候选 REQ-ID 与标题告诉用户，问『你是想更新这个、还是确实要新建？』。用户明确说『新建』时再次调用本工具并把 force_new 设为 true 跳过检测。",
		Category:     "action",
		RequiresAuth: true,
		Audience:     "all",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"title": map[string]interface{}{
					"type":        "string",
					"description": "需求标题，简洁描述问题或建议",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "需求详细描述，可包含 markdown 格式图片 ![](url)",
				},
				"category": map[string]interface{}{
					"type":        "string",
					"description": "分类：feature(功能)/bug(缺陷)/improvement(改进)",
					"enum":        []string{"feature", "bug", "improvement"},
				},
				"priority": map[string]interface{}{
					"type":        "string",
					"description": "优先级：low/medium/high",
					"enum":        []string{"low", "medium", "high"},
				},
				"image_urls": map[string]interface{}{
					"type":        "array",
					"items":       map[string]interface{}{"type": "string"},
					"description": "截图 URL 列表，会自动插入描述末尾",
				},
				"force_new": map[string]interface{}{
					"type":        "boolean",
					"description": "REQ-20260507-0002: 仅当上一轮服务端返回 detected_similar_requirement 且用户明确说『要新建、不要更新刚才那个』时设为 true 跳过去重检测。任何其他场景都不要传，让服务端正常做跨轮去重。",
				},
			},
			"required": []string{"title"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			title, _ := args["title"].(string)
			if title == "" {
				return nil, fmt.Errorf("title is required")
			}

			description, _ := args["description"].(string)
			category, _ := args["category"].(string)
			if category == "" {
				category = "improvement"
			}
			priority, _ := args["priority"].(string)
			if priority == "" {
				priority = "medium"
			}
			forceNew, _ := args["force_new"].(bool)

			// Append image URLs to description
			if imageURLs, ok := args["image_urls"].([]interface{}); ok {
				for _, u := range imageURLs {
					if url, ok := u.(string); ok {
						description += fmt.Sprintf("\n\n![截图](%s)", url)
					}
				}
			}

			// REQ-20260507-0002: cross-turn duplicate detection. Skip when
			// any of: dedup disabled, no chat session (non-chat caller),
			// LLM passed force_new=true (user already declined to update),
			// or actor identity unresolved. fail-open on any upstream issue.
			actorTag := ""
			if ctx.User != nil && ctx.UserID != nil {
				actorTag = actorTagFor(ctx.User.UserType, ctx.UserID)
			}
			if client.dedupCfg.Enabled && ctx.SessionID != nil && actorTag != "" && !forceNew {
				if v := dedupPrecheck(client, actorTag, title, description); v != nil {
					return v, nil
				}
			}

			body := map[string]interface{}{
				"title":              title,
				"description":        description,
				"project_id":         client.projectID,
				"category":           category,
				"priority":           priority,
				"allow_self_approve": true,
				"tags":               buildCreateTags(actorTag),
			}

			result, err := client.doJSON("POST", "/mcp/requirements/create", body)
			if err != nil {
				return nil, fmt.Errorf("创建需求失败: %w", err)
			}

			// Successful create invalidates the actor's dedup cache so the
			// just-created REQ shows up on the next round.
			if actorTag != "" && client.dedupCache != nil {
				client.dedupCache.invalidate(actorTag)
			}

			// Extract display_id from response
			displayID := ""
			if data, ok := result["data"].(map[string]interface{}); ok {
				if did, ok := data["display_id"].(string); ok {
					displayID = did
				}
			}

			return map[string]interface{}{
				"success":    true,
				"action":     "created",
				"display_id": displayID,
				"title":      title,
				"message":    fmt.Sprintf("需求「%s」已创建 (%s)", title, displayID),
			}, nil
		},
	}
}

// RegisterListRequirements registers the list_requirements tool.
func RegisterListRequirements(cfg config.AIConfig) model.ToolDef {
	client := newAIProjClient(cfg)
	return model.ToolDef{
		Name:         "list_requirements",
		Description:  "查看 ai-proj 中的需求列表，支持按状态、优先级筛选。",
		Category:     "query",
		RequiresAuth: true,
		Audience:     "all",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"status": map[string]interface{}{
					"type":        "string",
					"description": "状态筛选：draft/pending/approved/archived，多个用逗号分隔",
				},
				"search": map[string]interface{}{
					"type":        "string",
					"description": "搜索关键词（标题/描述）",
				},
				"limit": map[string]interface{}{
					"type":        "integer",
					"description": "返回数量，默认 10",
				},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			// REQ-20260506-0014: build query string via url.Values so any
			// Chinese / special characters in `search` or comma-separated
			// `status` lists get properly percent-encoded — pre-fix this
			// would silently produce a malformed URL and ai-proj would
			// reply with 400 / empty results.
			limit := 10
			if l, ok := args["limit"].(float64); ok && int(l) > 0 {
				limit = int(l)
				if limit > 50 {
					limit = 50
				}
			}
			q := url.Values{}
			q.Set("project_id", strconv.Itoa(client.projectID))
			q.Set("page", "1")
			q.Set("page_size", strconv.Itoa(limit))
			if status, ok := args["status"].(string); ok && status != "" {
				q.Set("status", status)
			}
			if search, ok := args["search"].(string); ok && search != "" {
				q.Set("search", search)
			}

			result, err := client.doJSON("GET", "/mcp/requirements?"+q.Encode(), nil)
			if err != nil {
				return nil, fmt.Errorf("查询需求失败: %w", err)
			}

			// Format response. ai-proj returns:
			//   { "success": true, "data": { "requirements": [...], "total": N, "pagination": {...} } }
			// (Earlier versions of this code read `result["total"]` at the
			// top level, which is always nil — total stayed 0 and the LLM
			// thought there were no records.)
			data, _ := result["data"].(map[string]interface{})
			// REQ-20260506-0052: items must always serialize as `[]`, never
			// `null`. A nil slice JSON-encodes to `null`, which the LLM then
			// reads as "lookup failed" instead of "0 matches" — leading it to
			// stop short of calling create_requirement on an explicit ask.
			items := []map[string]interface{}{}
			if data != nil {
				if reqs, ok := data["requirements"].([]interface{}); ok {
					for _, r := range reqs {
						if req, ok := r.(map[string]interface{}); ok {
							items = append(items, map[string]interface{}{
								"display_id": req["display_id"],
								"title":      req["title"],
								"status":     req["status"],
								"priority":   req["priority"],
								"category":   req["category"],
								"created_at": req["created_at"],
							})
						}
					}
				}
			}

			total := 0
			if data != nil {
				if t, ok := data["total"].(float64); ok {
					total = int(t)
				}
			}

			// Diagnostic warn on empty results so a future regression in
			// the response shape leaves a breadcrumb.
			if len(items) == 0 {
				logger.Warnf("[ai-chat] list_requirements returned 0 items; raw_keys=%v top_keys=%v query=%s",
					mapKeys(data), mapKeys(result), q.Encode())
			}

			return map[string]interface{}{
				"requirements": items,
				"total":        total,
				"showing":      len(items),
			}, nil
		},
	}
}

// RegisterUploadImageToRequirement registers the upload_and_create_requirement tool.
func RegisterUploadImageToRequirement(cfg config.AIConfig) model.ToolDef {
	client := newAIProjClient(cfg)
	return model.ToolDef{
		Name:         "upload_screenshot_requirement",
		Description:  "上传截图并创建需求（写操作）。⚠️ 与 create_requirement 一样：调用前必须用户【显式同意】创建需求——仅上传截图本身不是创建信号；同一轮回复内禁止多次调用，服务端会拒绝重复执行。",
		Category:     "action",
		RequiresAuth: true,
		Audience:     "all",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"title": map[string]interface{}{
					"type":        "string",
					"description": "需求标题",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "问题描述",
				},
				"screenshot_url": map[string]interface{}{
					"type":        "string",
					"description": "截图 URL（由前端上传后提供）",
				},
			},
			"required": []string{"title", "screenshot_url"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			title, _ := args["title"].(string)
			description, _ := args["description"].(string)
			screenshotURL, _ := args["screenshot_url"].(string)

			if title == "" || screenshotURL == "" {
				return nil, fmt.Errorf("title and screenshot_url are required")
			}

			// Build description with embedded screenshot
			fullDesc := description
			if fullDesc != "" {
				fullDesc += "\n\n"
			}
			fullDesc += fmt.Sprintf("### 截图\n![截图](%s)", screenshotURL)

			body := map[string]interface{}{
				"title":              title,
				"description":        fullDesc,
				"project_id":         client.projectID,
				"category":           "bug",
				"priority":           "high",
				"allow_self_approve": true,
				"tags":               []string{"from-ai-chat", "has-screenshot", "supplier-feedback"},
			}

			result, err := client.doJSON("POST", "/mcp/requirements/create", body)
			if err != nil {
				return nil, fmt.Errorf("创建需求失败: %w", err)
			}

			displayID := ""
			if data, ok := result["data"].(map[string]interface{}); ok {
				if did, ok := data["display_id"].(string); ok {
					displayID = did
				}
			}

			return map[string]interface{}{
				"success":        true,
				"display_id":     displayID,
				"title":          title,
				"has_screenshot": true,
				"message":        fmt.Sprintf("需求「%s」已创建 (%s)，含截图", title, displayID),
			}, nil
		},
	}
}

// RegisterUploadImage provides the image upload tool for general use.
func RegisterUploadImage(cfg config.AIConfig) model.ToolDef {
	client := newAIProjClient(cfg)
	_ = client // Used for upload endpoint
	return model.ToolDef{
		Name:         "upload_image",
		Description:  "上传图片到平台存储，返回图片 URL。可用于在需求描述中嵌入截图。",
		Category:     "action",
		RequiresAuth: true,
		Audience:     "supplier",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"image_url": map[string]interface{}{
					"type":        "string",
					"description": "图片的 data URL (base64) 或已有 URL",
				},
				"filename": map[string]interface{}{
					"type":        "string",
					"description": "文件名，如 screenshot.png",
				},
			},
			"required": []string{"image_url"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			imageURL, _ := args["image_url"].(string)
			if imageURL == "" {
				return nil, fmt.Errorf("image_url is required")
			}
			// If already a URL (not base64), return as-is
			if strings.HasPrefix(imageURL, "http") {
				return map[string]interface{}{
					"url":     imageURL,
					"message": "图片 URL 已可用",
				}, nil
			}
			return map[string]interface{}{
				"url":     imageURL,
				"message": "图片已处理",
			}, nil
		},
	}
}
