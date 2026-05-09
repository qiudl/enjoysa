package seed

import (
	"github.com/lib/pq"

	chatmodel "enjoysa-backend/internal/chat/model"
)

// seedChatAgents seeds the 2 hardcoded Phase-1 agents (REQ-20260509-0037).
// Idempotent: only inserts agents missing by code; never overwrites edits
// (admin CMS in P2 will let users edit agents).
//
// Skipped silently if the chat_agents table doesn't exist yet (e.g. running
// seed before AutoMigrate on a fresh DB).
func (s *Seeder) seedChatAgents() error {
	var exists bool
	s.db.Raw(`SELECT EXISTS (
		SELECT FROM information_schema.tables WHERE table_name='chat_agents'
	)`).Scan(&exists)
	if !exists {
		s.record("chat_agents", 0)
		return nil
	}

	defaults := []chatmodel.ChatAgent{
		{
			Code:                chatmodel.AgentCodeCustomerService,
			Name:                "客服小南",
			MemberType:          "ai",
			LLMProvider:         "deepseek",
			LLMModel:            "deepseek-chat",
			SystemPrompt:        defaultCustomerServicePrompt,
			ToolKeys:            pq.StringArray{"list_orders", "get_order", "refund_order", "faq_search"},
			AvatarEmoji:         "🙋",
			ColorHex:            "#16a34a",
			SortOrder:           10,
			DefaultInNewChannel: true,
			Enabled:             true,
		},
		{
			Code:                chatmodel.AgentCodeTechSupport,
			Name:                "技术阿澳",
			MemberType:          "ai",
			LLMProvider:         "glm",
			LLMModel:            "glm-4-flash",
			SystemPrompt:        defaultTechSupportPrompt,
			ToolKeys:            pq.StringArray{"search_products", "get_product_availability", "troubleshoot_api"},
			AvatarEmoji:         "🛠",
			ColorHex:            "#2563eb",
			SortOrder:           20,
			DefaultInNewChannel: true,
			Enabled:             true,
		},
	}

	inserted := 0
	for _, a := range defaults {
		var existing chatmodel.ChatAgent
		err := s.db.Where("code = ?", a.Code).First(&existing).Error
		if err == nil {
			continue // keep edits
		}
		if err := s.db.Create(&a).Error; err != nil {
			return err
		}
		inserted++
	}
	s.record("chat_agents", inserted)
	return nil
}

const defaultCustomerServicePrompt = `你是 EnjoySA 工作区里的"客服小南"，DeepSeek 模型驱动。专长：售前售后、订单、退款、FAQ。

【群聊规则】
1. 历史以 [客服小南] / [技术阿澳] / [B] 等前缀区分发言人。
2. 看到[技术阿澳]已答的不要重复，可以补充或承上。
3. 用户 @ 你的消息必答；用户没 @ 任何人但消息触发频道默认或关键词时由你答。
4. API、bug、技术报错类问题不要硬答，主动建议 "@技术阿澳" 或 "切到 #API-技术 频道"。

【主题规则】
5. 主题内回复继承父消息上下文，不要重复频道寒暄。
6. 主题里被 @ 的 agent 临时入伙，不修改频道成员表。

【工具】refund 等写工具沿用 REQ-0003/0015/0017/0024 的三层防护 — 同主题不重复 create。`

const defaultTechSupportPrompt = `你是 EnjoySA 工作区里的"技术阿澳"，GLM 模型驱动。专长：API 集成、商品技术、bug 排查。

【群聊规则】
1. 历史以 [客服小南] / [技术阿澳] / [B] 等前缀区分发言人。
2. 看到[客服小南]已答的售后/订单别接管，技术问题再答。
3. 用户 @ 你的消息必答；触发关键词（API/bug/报错/不能用）时由你答。
4. 退款、价格、订单这种业务问题主动让回 "@客服小南" 或 "切到 #客服-默认 频道"。

【主题规则】
5. 主题内回复继承父消息上下文。
6. 主题里被 @ 的 agent 临时入伙，不修改频道成员表。

【工具】使用 search_products / get_product_availability / troubleshoot_api 等技术工具。`
