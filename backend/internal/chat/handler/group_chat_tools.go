// REQ-20260509-0037 dev-6: tool registry + 3-layer write protection wiring
// for the group-chat send pipelines.
//
// Group chat reuses the existing aichat tool registry, but with two extra
// constraints:
//   1. agent.tool_keys ∩ user_type — each agent only sees the tools it was
//      seeded with, intersected with the registry's per-role audience filter.
//   2. Three-layer write protection (REQ-20260506-0003 / 0015 / 0017): prompt
//      rules + tool description + per-turn handler dedup. Layer 3 is the
//      duplicateWriteToolBlockResult helper from chat_handler.go — group chat
//      shares it because both files live in package handler.
package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"

	aichatmodel "enjoysa-backend/internal/aichat/model"
	aichatservice "enjoysa-backend/internal/aichat/service"
	chatmodel "enjoysa-backend/internal/chat/model"
	"enjoysa-backend/internal/core/logger"
	"enjoysa-backend/internal/llmprovider"
)

// selectToolsForAgent intersects the agent's tool_keys with the tools the
// registry exposes for the caller's user_type (audience filter). Returns
// nil when the result is empty so callers can pass `nil` to the provider
// (no Tools field == plain stream, no tool-calling).
//
// Empty / unknown keys are silently dropped — seed data may reference tools
// the registry doesn't (yet) register, and the LLM cannot invoke a tool the
// registry doesn't know about anyway.
func selectToolsForAgent(registry *aichatservice.ToolRegistry, agent chatmodel.ChatAgent, userType string) []llmprovider.Tool {
	if registry == nil || len(agent.ToolKeys) == 0 {
		return nil
	}
	allowed := make(map[string]struct{}, len(agent.ToolKeys))
	for _, k := range agent.ToolKeys {
		if k = strings.TrimSpace(k); k != "" {
			allowed[k] = struct{}{}
		}
	}
	if len(allowed) == 0 {
		return nil
	}
	candidates := registry.GetOpenAITools(true, userType)
	out := make([]llmprovider.Tool, 0, len(candidates))
	for _, t := range candidates {
		if _, ok := allowed[t.Function.Name]; !ok {
			continue
		}
		out = append(out, llmprovider.Tool{
			Type: t.Type,
			Function: llmprovider.ToolFunction{
				Name:        t.Function.Name,
				Description: t.Function.Description,
				Parameters:  t.Function.Parameters,
			},
		})
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// buildToolContext mirrors the legacy aichat handler's ToolContext build for
// group chat. SessionID carries the channel id so cross-turn dedup
// (REQ-20260507-0002) treats each channel as its own conversation thread.
func buildToolContext(chatUser *aichatmodel.ChatUser, channelID uint, db interface{}) aichatmodel.ToolContext {
	toolUserID := chatUser.UserID
	if chatUser.UserType == "supplier" && chatUser.SupplierID != nil {
		toolUserID = *chatUser.SupplierID
	}
	sessionID := channelID
	return aichatmodel.ToolContext{
		User:      chatUser,
		UserID:    &toolUserID,
		Language:  "zh",
		DB:        db,
		SessionID: &sessionID,
	}
}

// providerToolLoopResult bundles what the loop produced so callers can
// persist the assistant text + know whether to surface a stream error.
type providerToolLoopResult struct {
	Assembled string
	StreamErr error
}

// runProviderToolLoop is the group-chat counterpart of chat_handler.go's
// streamWithTools. It owns the tool-calling streaming loop:
//
//   1. provider.ChatStream emits "content" + "tool_calls" events.
//   2. When tool_calls fire, append assistant message, dispatch each call
//      through the registry (with per-turn write-tool dedup), feed results
//      back as role=tool messages, loop again.
//   3. Bail out when the LLM returns content with no tool calls, or after
//      maxRounds rounds (defensive cap against infinite loops).
//
// SSE events emitted: "content", "tool_call", "tool_result". The caller
// owns "user", "route", and "done" — runProviderToolLoop never writes them.
func runProviderToolLoop(
	ctx context.Context,
	c *gin.Context,
	provider llmprovider.Provider,
	model string,
	initialMessages []llmprovider.Message,
	tools []llmprovider.Tool,
	registry *aichatservice.ToolRegistry,
	toolCtx aichatmodel.ToolContext,
) providerToolLoopResult {
	llmMessages := append([]llmprovider.Message(nil), initialMessages...)
	var assembled strings.Builder
	const maxRounds = 3

	// Three-layer write protection layer 3: per-turn dedup. Mirrors
	// writeToolCalled in chat_handler.go streamWithTools.
	writeToolCalled := map[string]bool{}

	for round := 0; round <= maxRounds; round++ {
		var pendingToolCalls []llmprovider.ToolCall
		var contentBuf strings.Builder

		streamErr := provider.ChatStream(ctx, llmprovider.Request{
			Model:    model,
			Messages: llmMessages,
			Tools:    tools,
		}, func(ev llmprovider.StreamEvent) bool {
			switch ev.Type {
			case "content":
				if ev.Content != "" {
					contentBuf.WriteString(ev.Content)
					assembled.WriteString(ev.Content)
					writeSSE(c, "content", map[string]any{"content": ev.Content})
				}
			case "tool_calls":
				pendingToolCalls = ev.ToolCalls
			}
			return ctx.Err() == nil
		})
		if streamErr != nil {
			return providerToolLoopResult{Assembled: assembled.String(), StreamErr: streamErr}
		}

		if len(pendingToolCalls) == 0 {
			return providerToolLoopResult{Assembled: assembled.String()}
		}

		// Append assistant message with tool calls so the next round sees
		// the function-calling history (OpenAI tool-calling protocol).
		llmMessages = append(llmMessages, llmprovider.Message{
			Role:      "assistant",
			Content:   contentBuf.String(),
			ToolCalls: pendingToolCalls,
		})

		for _, tc := range pendingToolCalls {
			writeSSE(c, "tool_call", map[string]any{
				"id":        tc.ID,
				"name":      tc.Function.Name,
				"arguments": tc.Function.Arguments,
			})

			var (
				result     interface{}
				durationMs int64
				execErr    error
			)
			if blocked := duplicateWriteToolBlockResult(tc.Function.Name, writeToolCalled); blocked != nil {
				// Layer 3 short-circuit: feed the LLM a structured "duplicate"
				// tool result so it apologizes instead of retrying silently.
				result = blocked
			} else if registry == nil {
				// Defensive: provider asked for a tool but registry isn't
				// wired. Treat as an unknown-tool error so the LLM sees it.
				execErr = fmt.Errorf("tool registry not configured")
			} else {
				result, durationMs, execErr = registry.Execute(tc.Function.Name, tc.Function.Arguments, toolCtx)
				if execErr == nil && isAIChatWriteTool(tc.Function.Name) {
					writeToolCalled[tc.Function.Name] = true
				}
			}

			var resultJSON string
			if execErr != nil {
				errBytes, _ := json.Marshal(map[string]string{"error": execErr.Error()})
				resultJSON = string(errBytes)
			} else {
				rb, _ := json.Marshal(result)
				resultJSON = string(rb)
			}

			writeSSE(c, "tool_result", map[string]any{
				"id":          tc.ID,
				"name":        tc.Function.Name,
				"result":      resultJSON,
				"duration_ms": durationMs,
				"success":     execErr == nil,
			})

			llmMessages = append(llmMessages, llmprovider.Message{
				Role:       "tool",
				Content:    resultJSON,
				ToolCallID: tc.ID,
			})
		}
	}

	logger.Warnf("[group_chat] tool loop reached maxRounds=%d without final response", maxRounds)
	return providerToolLoopResult{Assembled: assembled.String()}
}
