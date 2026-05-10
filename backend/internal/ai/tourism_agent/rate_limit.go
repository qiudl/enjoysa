// Package tourism_agent orchestrates the tourism domain AI agent
// (REQ-20260510-0002 · 南澳旅游 AI Agent · Phase 1).
//
// 1A 仅落地限流独立桶；后续 1B 引入 agent / tools / prompt / store / etl 等。
package tourism_agent

import (
	aichatmw "enjoysa-backend/internal/aichat/middleware"
)

// RateLimit constants (D1 决议)：tourism agent 单 IP 1/s burst 3。
// 复用 aichatmw.IPRateLimiter，与 /api/v1/ai/* 总桶 (2/s, 5) 串联：
// router.go 中先挂 aiGroup 的 limiter，再在 /tourism 子组挂本 limiter，
// 双层并联让单 IP 实际吞吐不超 1/s，避免 LLM 成本被刷穿。
const (
	rateLimitRPS   = 1.0
	rateLimitBurst = 3
)

// NewRateLimiter 返回 tourism agent 专用的 IP 限流器。
// 1B+ 在 router.go 中实例化并挂到 /api/v1/ai/tourism/* 子组上。
func NewRateLimiter() *aichatmw.IPRateLimiter {
	return aichatmw.NewIPRateLimiter(rateLimitRPS, rateLimitBurst)
}
