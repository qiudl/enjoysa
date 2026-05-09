// Package service routing — REQ-20260509-0037 dev-4.
//
// Routing decides which single Agent answers a user message in a Channel
// (or in a thread inside a Channel). Priority short-circuit (highest first):
//
//   1. mentions  — explicit @ wins. First mention that is enabled and not
//                  muted in this channel responds. Mention pointing to a
//                  non-channel-member agent is allowed only inside a thread
//                  (ephemeral); in main flow it falls back to rule 3.
//   2. thread    — when in a thread (parentMsg != nil), the *last agent
//                  reply in the thread* answers. Falls back to channel
//                  default if no agent has spoken yet (defect-analysis T4).
//   3. default   — channel.default_agent_id, unless muted/disabled.
//   4. (none)    — soft "nobody available" — handler tells the user.
//
// Side effects:
//   - SoftHint: cross-channel keyword match suggests "switch to #X?"
//     without forcing routing (defect-analysis routing rule 3).
//
// The router is pure (no DB / network) — pass it the loaded entities and it
// returns Decision. Stores fetch entities; tests inject fakes directly.
package service

import (
	"strings"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// RouteRequest carries the inputs for routing a single user message.
type RouteRequest struct {
	Channel        *chatmodel.ChatChannel        // current channel; required
	ChannelMembers []chatmodel.ChatChannelMember // current channel members (for mute lookup)
	OtherChannels  []chatmodel.ChatChannel       // sibling channels in the workspace (for keyword soft-hint)
	AllAgents      []chatmodel.ChatAgent         // every enabled agent in the workspace (router won't see disabled)

	MessageText string  // user message (used for keyword matching only)
	Mentions    []uint  // agent IDs explicitly @-ed by the user (in order)

	InThread          bool                    // true if posting inside a thread
	ThreadAgentRepliers []uint                // sender_agent_id of every agent reply in the thread, in order; latest last
}

// Decision is the router's verdict.
type Decision struct {
	Agent             *chatmodel.ChatAgent // responder; nil = "no one to answer"
	Reason            string               // "mention" | "thread_continuation" | "channel_default" | "no_responder"
	EphemeralInThread bool                 // true when responder is not a channel member (mention pulled them in)
	SoftHint          string               // user-facing nudge, e.g. "提示：是否切到 #API-技术？"
}

// Route runs the priority short-circuit and returns a Decision.
func Route(req RouteRequest) Decision {
	if req.Channel == nil {
		return Decision{Reason: "no_responder"}
	}

	agentByID := indexAgents(req.AllAgents)
	memberSet, mutedSet := membershipSets(req.ChannelMembers)
	hint := keywordSoftHint(req.MessageText, req.OtherChannels, req.Channel.ID)

	// Rule 1 — explicit mention.
	for _, mid := range req.Mentions {
		ag, ok := agentByID[mid]
		if !ok || !ag.Enabled {
			continue
		}
		if mutedSet[mid] {
			continue // user explicitly muted this agent in this channel; skip
		}
		if memberSet[mid] {
			return Decision{
				Agent:    ag,
				Reason:   "mention",
				SoftHint: hint,
			}
		}
		// Non-member mention: only honored inside a thread (T2 + R5 spirit).
		if req.InThread {
			return Decision{
				Agent:             ag,
				Reason:            "mention",
				EphemeralInThread: true,
				SoftHint:          hint,
			}
		}
		// Main-flow mention of non-member → ignore, fall through to rules 2/3.
	}

	// Rule 2 — thread continuation: last agent who spoke in the thread answers.
	if req.InThread {
		for i := len(req.ThreadAgentRepliers) - 1; i >= 0; i-- {
			id := req.ThreadAgentRepliers[i]
			ag, ok := agentByID[id]
			if !ok || !ag.Enabled || mutedSet[id] {
				continue
			}
			return Decision{
				Agent:    ag,
				Reason:   "thread_continuation",
				SoftHint: hint,
			}
		}
		// No agent has spoken yet in this thread — fall through to channel default.
	}

	// Rule 3 — channel default agent.
	if req.Channel.DefaultAgentID != nil {
		def := *req.Channel.DefaultAgentID
		ag, ok := agentByID[def]
		if ok && ag.Enabled && !mutedSet[def] {
			return Decision{
				Agent:    ag,
				Reason:   "channel_default",
				SoftHint: hint,
			}
		}
	}

	// Rule 4 — nothing matched.
	return Decision{Reason: "no_responder", SoftHint: hint}
}

// keywordSoftHint scans the message for any sibling channel's keyword_rules
// entry. Returns the first nudge ("提示：是否切到 #X？") or "" if no match.
// Matching is case-insensitive substring; intentionally NOT pushed to SQL
// (defect-analysis S4 — keep keyword matching in Go to avoid LIKE injection).
func keywordSoftHint(messageText string, others []chatmodel.ChatChannel, currentID uint) string {
	if messageText == "" {
		return ""
	}
	lower := strings.ToLower(messageText)
	for i := range others {
		ch := &others[i]
		if ch.ID == currentID || ch.Archived {
			continue
		}
		for _, kw := range ch.KeywordRules {
			kw = strings.TrimSpace(kw)
			if kw == "" {
				continue
			}
			if strings.Contains(lower, strings.ToLower(kw)) {
				return "提示：是否切到 #" + ch.Name + "？"
			}
		}
	}
	return ""
}

func indexAgents(agents []chatmodel.ChatAgent) map[uint]*chatmodel.ChatAgent {
	out := make(map[uint]*chatmodel.ChatAgent, len(agents))
	for i := range agents {
		out[agents[i].ID] = &agents[i]
	}
	return out
}

// membershipSets returns (member, muted) sets keyed by agent_id.
func membershipSets(members []chatmodel.ChatChannelMember) (member, muted map[uint]bool) {
	member = make(map[uint]bool, len(members))
	muted = make(map[uint]bool, len(members))
	for _, m := range members {
		if m.AgentID == nil {
			continue
		}
		id := *m.AgentID
		member[id] = true
		if m.Muted {
			muted[id] = true
		}
	}
	return member, muted
}
