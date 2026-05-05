-- 004_create_knowledge_base.sql
-- AI knowledge base for platform policies, FAQs, and guides

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    category   VARCHAR(50) NOT NULL,   -- policy, faq, guide, rule
    title      VARCHAR(200) NOT NULL,
    content    TEXT NOT NULL,
    keywords   VARCHAR(500),           -- comma-separated keywords for matching
    audience   VARCHAR(20) NOT NULL DEFAULT 'all', -- supplier, admin, all
    sort_order INTEGER DEFAULT 0,
    is_active  BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_ai_kb_category ON ai_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_ai_kb_audience ON ai_knowledge_base(audience);
CREATE INDEX IF NOT EXISTS idx_ai_kb_active ON ai_knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_kb_deleted_at ON ai_knowledge_base(deleted_at);

-- Seed core knowledge
INSERT INTO ai_knowledge_base (category, title, content, keywords, audience) VALUES
('policy', '结算规则', '供应商结算规则：
1. 结算周期：每月 1 日和 15 日进行结算
2. 结算范围：已完成状态（completed）的订单
3. 平台佣金：订单金额的 15%
4. 结算方式：银行转账至供应商注册时填写的银行账户
5. 结算时效：结算日后 3-5 个工作日到账
6. 最低结算金额：$50 AUD，低于此金额累积至下期
7. 争议处理：如对结算金额有异议，请在结算后 7 天内提交工单', '结算,佣金,到账,银行,转账,settlement', 'supplier'),

('policy', '退款政策', '退款规则：
1. 用户在出行日期前 48 小时可申请全额退款
2. 出行日期前 24-48 小时可退款 50%
3. 出行日期前 24 小时内不可退款
4. 特殊情况（自然灾害/供应商取消）全额退款
5. 退款处理时效：审核通过后 5-10 个工作日退回原支付方式
6. 部分退款：支持按人数或项目部分退款', '退款,refund,取消,cancel', 'all'),

('policy', '商品审核标准', '商品上架审核标准：
1. 商品名称：中英文必填，准确描述产品内容
2. 商品描述：中英文必填，至少 100 字，包含行程安排
3. 图片要求：至少 3 张高清图片（≥800px），第一张为封面
4. 价格设置：必须为正数，货币为 AUD
5. 排期管理：至少设置未来 7 天的可用排期
6. 合规检查：不含虚假宣传、不含违规内容
7. 审核时效：提交后 1-2 个工作日完成审核', '审核,上架,审核标准,商品要求,review,approve', 'supplier'),

('faq', '如何创建商品', '创建商品步骤：
1. 进入「商品管理」→ 点击「新建商品」
2. 填写基本信息：中英文名称、描述、价格、时长
3. 上传商品图片（至少 3 张）
4. 设置套餐和价格
5. 添加亮点和 FAQ
6. 设置排期和库存
7. 提交审核，等待平台审批', '创建商品,新建,添加产品,how to create', 'supplier'),

('faq', '如何处理退款', '退款处理流程：
1. 在「售后工单」中查看退款申请
2. 核实退款原因和订单信息
3. 点击「同意退款」或「拒绝退款」
4. 同意退款后金额自动从下期结算中扣除
5. 如有争议可添加备注说明', '退款处理,处理退款,退款流程,refund process', 'supplier'),

('guide', '运营优化建议', '提升销量的运营建议：
1. 保持商品信息完整（中英文描述、高清图片）
2. 及时回复用户评价，特别是差评
3. 合理设置价格，参考同类产品定价
4. 定期更新排期，确保库存充足
5. 利用 AI 写手优化商品描述
6. 关注 AI 简报了解运营趋势', '运营,优化,提升销量,tips', 'supplier'),

('rule', '平台违规处罚', '违规处罚规则：
1. 虚假宣传：下架商品 + 警告
2. 服务质量投诉超 3 次：限制接单 7 天
3. 取消率超 10%：降低搜索排名
4. 严重违规（欺诈/安全事故）：永久封号
5. 申诉渠道：通过售后工单提交申诉', '违规,处罚,封号,申诉', 'supplier'),

('faq', '平台管理操作指南', '管理员常用操作：
1. 供应商审核：「供应商管理」→ 查看待审核 → 批准/拒绝
2. 商品审核：「商品审核」→ 查看详情 → 通过/拒绝/强制下架
3. 退款处理：「订单管理」→ 找到订单 → 「退款」→ 填写金额和原因
4. 用户管理：「用户管理」→ 搜索用户 → 启用/禁用
5. 结算管理：「财务管理」→ 查看待结算 → 确认结算', '管理操作,审核,管理指南,admin guide', 'admin');
