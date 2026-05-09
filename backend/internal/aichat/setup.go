package aichat

import (
	"enjoysa-backend/internal/aichat/service"
	"enjoysa-backend/internal/aichat/store"
	"enjoysa-backend/internal/aichat/tools"
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
	productstore "enjoysa-backend/internal/product/store"
	reviewstore "enjoysa-backend/internal/review/store"
	"gorm.io/gorm"
)

// Module holds all AI chat dependencies.
type Module struct {
	LLMClient    *service.LLMClient
	ToolRegistry *service.ToolRegistry
	CacheStore   *store.AICacheStore
}

// seedKnowledgeBase inserts core knowledge entries if the table is empty.
func seedKnowledgeBase(db *gorm.DB) {
	var count int64
	db.Model(&store.KnowledgeEntry{}).Where("source = ?", "seed").Count(&count)
	if count > 0 {
		return // already seeded
	}

	seeds := []store.KnowledgeEntry{
		{Category: "policy", Title: "结算规则", Content: "供应商结算规则：\n1. 结算周期：每月 1 日和 15 日进行结算\n2. 结算范围：已完成状态（completed）的订单\n3. 平台佣金：订单金额的 15%\n4. 结算方式：银行转账至供应商注册时填写的银行账户\n5. 结算时效：结算日后 3-5 个工作日到账\n6. 最低结算金额：$50 AUD，低于此金额累积至下期\n7. 争议处理：如对结算金额有异议，请在结算后 7 天内提交工单", Keywords: "结算,佣金,到账,银行,转账,settlement", Audience: "supplier", Source: "seed", IsActive: true},
		{Category: "policy", Title: "退款政策", Content: "退款规则：\n1. 用户在出行日期前 48 小时可申请全额退款\n2. 出行日期前 24-48 小时可退款 50%\n3. 出行日期前 24 小时内不可退款\n4. 特殊情况（自然灾害/供应商取消）全额退款\n5. 退款处理时效：审核通过后 5-10 个工作日退回原支付方式\n6. 部分退款：支持按人数或项目部分退款", Keywords: "退款,refund,取消,cancel", Audience: "all", Source: "seed", IsActive: true},
		{Category: "policy", Title: "商品审核标准", Content: "商品上架审核标准：\n1. 商品名称：中英文必填，准确描述产品内容\n2. 商品描述：中英文必填，至少 100 字，包含行程安排\n3. 图片要求：至少 3 张高清图片（≥800px），第一张为封面\n4. 价格设置：必须为正数，货币为 AUD\n5. 排期管理：至少设置未来 7 天的可用排期\n6. 合规检查：不含虚假宣传、不含违规内容\n7. 审核时效：提交后 1-2 个工作日完成审核", Keywords: "审核,上架,审核标准,商品要求,review,approve", Audience: "supplier", Source: "seed", IsActive: true},
		{Category: "faq", Title: "如何创建商品", Content: "创建商品步骤：\n1. 进入「商品管理」→ 点击「新建商品」\n2. 填写基本信息：中英文名称、描述、价格、时长\n3. 上传商品图片（至少 3 张）\n4. 设置套餐和价格\n5. 添加亮点和 FAQ\n6. 设置排期和库存\n7. 提交审核，等待平台审批", Keywords: "创建商品,新建,添加产品,how to create", Audience: "supplier", Source: "seed", IsActive: true},
		{Category: "faq", Title: "如何处理退款", Content: "退款处理流程：\n1. 在「售后工单」中查看退款申请\n2. 核实退款原因和订单信息\n3. 点击「同意退款」或「拒绝退款」\n4. 同意退款后金额自动从下期结算中扣除\n5. 如有争议可添加备注说明", Keywords: "退款处理,处理退款,退款流程,refund process", Audience: "supplier", Source: "seed", IsActive: true},
		{Category: "guide", Title: "运营优化建议", Content: "提升销量的运营建议：\n1. 保持商品信息完整（中英文描述、高清图片）\n2. 及时回复用户评价，特别是差评\n3. 合理设置价格，参考同类产品定价\n4. 定期更新排期，确保库存充足\n5. 利用 AI 写手优化商品描述\n6. 关注 AI 简报了解运营趋势", Keywords: "运营,优化,提升销量,tips", Audience: "supplier", Source: "seed", IsActive: true},
		{Category: "rule", Title: "平台违规处罚", Content: "违规处罚规则：\n1. 虚假宣传：下架商品 + 警告\n2. 服务质量投诉超 3 次：限制接单 7 天\n3. 取消率超 10%：降低搜索排名\n4. 严重违规（欺诈/安全事故）：永久封号\n5. 申诉渠道：通过售后工单提交申诉", Keywords: "违规,处罚,封号,申诉", Audience: "supplier", Source: "seed", IsActive: true},
		{Category: "faq", Title: "平台管理操作指南", Content: "管理员常用操作：\n1. 供应商审核：「供应商管理」→ 查看待审核 → 批准/拒绝\n2. 商品审核：「商品审核」→ 查看详情 → 通过/拒绝/强制下架\n3. 退款处理：「订单管理」→ 找到订单 → 「退款」→ 填写金额和原因\n4. 用户管理：「用户管理」→ 搜索用户 → 启用/禁用\n5. 结算管理：「财务管理」→ 查看待结算 → 确认结算", Keywords: "管理操作,审核,管理指南,admin guide", Audience: "admin", Source: "seed", IsActive: true},
		{Category: "guide", Title: "AI 工具使用指南", Content: "畅游南澳AI 工具使用指南：\n\n1. AI 商品写手：进入「商品管理」→「新建/编辑商品」，输入关键词点击「AI 生成」自动生成英文名、中英文描述、亮点和FAQ。\n2. AI 评论回复：「评价管理」页面点击「AI 建议回复」自动生成专业回复。\n3. AI 工单分析：「售后工单」→ 点击工单，AI 自动分析并建议处理方案。\n4. AI 每日简报：Dashboard 自动展示今日订单数、收入、趋势。\n5. 畅游南澳AI 面板：右侧固定面板含对话、动态、工具三个 Tab。\n6. 全屏对话：点击面板全屏按钮进入，支持会话历史。\n\n常见问题：\n- AI 按钮灰色？确保已填写产品中文名和关键词\n- AI 回复慢？通常 3-10 秒返回结果\n- 功能异常？在对话中描述问题，AI 会记录反馈", Keywords: "AI工具,AI写手,AI回复,AI生成,使用指南,怎么用", Audience: "supplier", Source: "seed", IsActive: true},
		{Category: "guide", Title: "技术问题反馈流程", Content: "遇到平台技术问题时：\n1. 先刷新页面（Ctrl+Shift+R 强制刷新）\n2. 清除浏览器缓存后重试\n3. 在右侧 AI 面板描述问题，AI 会记录并提供临时方案\n4. 通过「售后工单」提交技术支持，类型选「系统问题」\n5. 紧急问题联系 tonylai@enjoysau.com.au\n\n常见问题：\n- 页面加载慢：检查网络或稍后重试\n- 按钮无反应：刷新页面\n- 数据不显示：确认账号为「已审核」状态\n- 上传失败：图片最大 10MB，格式 JPG/PNG/WebP/GIF", Keywords: "技术问题,bug,故障,反馈,报错", Audience: "all", Source: "seed", IsActive: true},
	}

	for i := range seeds {
		seeds[i].SortOrder = i
		db.Create(&seeds[i])
	}
	logger.Info("Knowledge base seeded with %d entries", len(seeds))
}

// Setup initializes the AI module and registers all tools.
func Setup(db *gorm.DB, cfg config.AIConfig, ps *productstore.ProductStore, rs *productstore.RegionStore, ss *productstore.ScheduleStore, rvs *reviewstore.ReviewStore) *Module {
	llm := service.NewLLMClient(cfg)
	registry := service.NewToolRegistry()
	cacheStore := store.NewAICacheStore(db)

	// Register C-end tools
	registry.Register(tools.RegisterSearchProducts(ps))
	registry.Register(tools.RegisterProductDetail(ps))
	registry.Register(tools.RegisterRecommendAttractions(ps, rs))
	registry.Register(tools.RegisterCheckAvailability(ss))
	registry.Register(tools.RegisterGetReviews(rvs))

	// Register supplier tools
	registry.Register(tools.RegisterGetOrderStats())
	registry.Register(tools.RegisterListPendingOrders())
	registry.Register(tools.RegisterGetReviewStats())
	registry.Register(tools.RegisterGetRevenueTrend())
	registry.Register(tools.RegisterGetInventoryAlerts())
	registry.Register(tools.RegisterGetSettlementDetail())
	registry.Register(tools.RegisterConfirmOrder())
	registry.Register(tools.RegisterSearchOrders())

	// Register admin tools
	registry.Register(tools.RegisterGetPlatformStats())
	registry.Register(tools.RegisterSearchSuppliers())
	registry.Register(tools.RegisterListPendingProducts())
	registry.Register(tools.RegisterApproveProduct())
	registry.Register(tools.RegisterOfflineProduct())

	// Register knowledge base tool (shared)
	registry.Register(tools.RegisterSearchKnowledge())

	// Register ai-proj integration tools
	if cfg.AIProjBase != "" && cfg.AIProjToken != "" {
		registry.Register(tools.RegisterCreateRequirement(cfg))
		registry.Register(tools.RegisterListRequirements(cfg))
		// REQ-20260506-0062: update_requirement so the LLM can act on
		// "modify / change priority / rename" prompts the chat already
		// instructs it to act on (previously orphaned — no handler
		// existed, so the LLM had no way to fulfill those requests).
		registry.Register(tools.RegisterUpdateRequirement(cfg))
		registry.Register(tools.RegisterUploadImageToRequirement(cfg))
		logger.Info("AI-Proj integration enabled: %s (project %d)", cfg.AIProjBase, cfg.AIProjProjID)
	}

	// Auto-seed knowledge base if empty
	seedKnowledgeBase(db)

	logger.Info("AI module initialized with %d tools: %v", len(registry.GetToolNames()), registry.GetToolNames())

	return &Module{
		LLMClient:    llm,
		ToolRegistry: registry,
		CacheStore:   cacheStore,
	}
}
