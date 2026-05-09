package service

import (
	"testing"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// helper: ptr to uint
func u(v uint) *uint { return &v }

// helper: build a member row for an agent
func member(channelID, agentID uint, muted bool) chatmodel.ChatChannelMember {
	return chatmodel.ChatChannelMember{
		ChannelID: channelID, MemberType: "ai", AgentID: u(agentID), Muted: muted,
	}
}

func ag(id uint, name string, enabled bool) chatmodel.ChatAgent {
	return chatmodel.ChatAgent{ID: id, Code: name, Name: name, Enabled: enabled}
}

func TestRoute_MentionWinsOverDefault(t *testing.T) {
	cs := ag(1, "cs", true)
	tech := ag(2, "tech", true)
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:        &ch,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false), member(100, 2, false)},
		AllAgents:      []chatmodel.ChatAgent{cs, tech},
		MessageText:    "@tech help",
		Mentions:       []uint{tech.ID},
	})
	if d.Agent == nil || d.Agent.ID != tech.ID {
		t.Fatalf("got %+v, want tech", d.Agent)
	}
	if d.Reason != "mention" {
		t.Fatalf("reason = %q, want mention", d.Reason)
	}
}

func TestRoute_MentionMutedSkipsToFallback(t *testing.T) {
	cs := ag(1, "cs", true)
	tech := ag(2, "tech", true)
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:        &ch,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false), member(100, 2, true)}, // tech muted
		AllAgents:      []chatmodel.ChatAgent{cs, tech},
		Mentions:       []uint{tech.ID},
	})
	// muted mention is skipped; rule 1 has no other candidates → fall to rule 3
	if d.Agent == nil || d.Agent.ID != cs.ID {
		t.Fatalf("got %+v, want fall back to cs", d.Agent)
	}
	if d.Reason != "channel_default" {
		t.Fatalf("reason = %q", d.Reason)
	}
}

func TestRoute_MentionDisabledFallsBack(t *testing.T) {
	cs := ag(1, "cs", true)
	tech := ag(2, "tech", false) // disabled by admin
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:        &ch,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false)},
		AllAgents:      []chatmodel.ChatAgent{cs, tech},
		Mentions:       []uint{tech.ID},
	})
	if d.Agent == nil || d.Agent.ID != cs.ID {
		t.Fatalf("disabled mention should fall back to cs; got %+v", d.Agent)
	}
}

func TestRoute_MentionNonMemberInMainFlowIgnored(t *testing.T) {
	cs := ag(1, "cs", true)
	tech := ag(2, "tech", true) // enabled but NOT a channel member
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:        &ch,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false)}, // tech absent
		AllAgents:      []chatmodel.ChatAgent{cs, tech},
		Mentions:       []uint{tech.ID},
		InThread:       false,
	})
	// In main flow, mentioning non-member is ignored → rule 3 default
	if d.Agent == nil || d.Agent.ID != cs.ID {
		t.Fatalf("non-member mention in main flow should fall back to cs; got %+v reason=%s", d.Agent, d.Reason)
	}
	if d.EphemeralInThread {
		t.Fatal("EphemeralInThread should be false for main flow")
	}
}

func TestRoute_MentionNonMemberInThreadIsEphemeral(t *testing.T) {
	cs := ag(1, "cs", true)
	tech := ag(2, "tech", true)
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:        &ch,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false)}, // tech absent
		AllAgents:      []chatmodel.ChatAgent{cs, tech},
		Mentions:       []uint{tech.ID},
		InThread:       true,
	})
	if d.Agent == nil || d.Agent.ID != tech.ID {
		t.Fatalf("non-member mention in thread should answer ephemerally; got %+v", d.Agent)
	}
	if !d.EphemeralInThread {
		t.Fatal("EphemeralInThread should be true")
	}
}

func TestRoute_ThreadContinuationUsesLastAgentReplier(t *testing.T) {
	// defect-analysis T4: thread fallback is "last agent replier", not parent author.
	cs := ag(1, "cs", true)
	tech := ag(2, "tech", true)
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:        &ch,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false), member(100, 2, false)},
		AllAgents:      []chatmodel.ChatAgent{cs, tech},
		// thread parent was authored by cs; tech then jumped in (mention from earlier turn).
		// Now the user asks a follow-up with no @ — tech should answer (last replier).
		InThread:            true,
		ThreadAgentRepliers: []uint{cs.ID, tech.ID},
	})
	if d.Agent == nil || d.Agent.ID != tech.ID {
		t.Fatalf("thread continuation should pick tech (last replier); got %+v", d.Agent)
	}
	if d.Reason != "thread_continuation" {
		t.Fatalf("reason = %q", d.Reason)
	}
}

func TestRoute_ThreadWithNoAgentSpokenFallsToChannelDefault(t *testing.T) {
	cs := ag(1, "cs", true)
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:             &ch,
		ChannelMembers:      []chatmodel.ChatChannelMember{member(100, 1, false)},
		AllAgents:           []chatmodel.ChatAgent{cs},
		InThread:            true,
		ThreadAgentRepliers: nil,
	})
	if d.Agent == nil || d.Agent.ID != cs.ID {
		t.Fatalf("got %+v", d.Agent)
	}
	if d.Reason != "channel_default" {
		t.Fatalf("reason = %q", d.Reason)
	}
}

func TestRoute_DefaultAgentMutedYieldsNoResponder(t *testing.T) {
	// Defense-in-depth — handler should refuse to mute the default agent
	// (defect R4), but if the DB ever ends up in that state, router must
	// degrade gracefully rather than answering as someone else.
	cs := ag(1, "cs", true)
	ch := chatmodel.ChatChannel{ID: 100, DefaultAgentID: u(cs.ID)}

	d := Route(RouteRequest{
		Channel:        &ch,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, true)}, // muted!
		AllAgents:      []chatmodel.ChatAgent{cs},
	})
	if d.Agent != nil {
		t.Fatalf("expected nil agent when default is muted; got %+v", d.Agent)
	}
	if d.Reason != "no_responder" {
		t.Fatalf("reason = %q, want no_responder", d.Reason)
	}
}

func TestRoute_KeywordSoftHintSuggestsOtherChannel(t *testing.T) {
	cs := ag(1, "cs", true)
	tech := ag(2, "tech", true)
	mainCh := chatmodel.ChatChannel{ID: 100, Name: "客服-默认", DefaultAgentID: u(cs.ID)}
	techCh := chatmodel.ChatChannel{ID: 101, Name: "API-技术", KeywordRules: []string{"API", "bug"}}

	d := Route(RouteRequest{
		Channel:        &mainCh,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false)},
		OtherChannels:  []chatmodel.ChatChannel{techCh},
		AllAgents:      []chatmodel.ChatAgent{cs, tech},
		MessageText:    "我的 api 报错了",
	})
	if d.Agent == nil || d.Agent.ID != cs.ID {
		t.Fatalf("default cs should still answer; got %+v", d.Agent)
	}
	if d.SoftHint != "提示：是否切到 #API-技术？" {
		t.Fatalf("SoftHint = %q", d.SoftHint)
	}
}

func TestRoute_KeywordSoftHintIgnoresArchivedAndCurrent(t *testing.T) {
	cs := ag(1, "cs", true)
	mainCh := chatmodel.ChatChannel{ID: 100, Name: "客服-默认", DefaultAgentID: u(cs.ID), KeywordRules: []string{"API"}}
	archived := chatmodel.ChatChannel{ID: 101, Name: "API-技术", Archived: true, KeywordRules: []string{"API"}}

	d := Route(RouteRequest{
		Channel:        &mainCh,
		ChannelMembers: []chatmodel.ChatChannelMember{member(100, 1, false)},
		OtherChannels:  []chatmodel.ChatChannel{mainCh, archived}, // current + archived
		AllAgents:      []chatmodel.ChatAgent{cs},
		MessageText:    "API 报错",
	})
	if d.SoftHint != "" {
		t.Fatalf("SoftHint should be empty (only current + archived match): got %q", d.SoftHint)
	}
}

func TestRoute_NilChannelGivesNoResponder(t *testing.T) {
	d := Route(RouteRequest{Channel: nil})
	if d.Agent != nil {
		t.Fatal("expected nil agent")
	}
}
