-- 005_chat_message_share.sql
-- Records of ai-chat conversations shared to external IM channels (Feishu first).
-- Also extends ai_knowledge_base so that admin-shared content can be backfilled
-- into the knowledge base for RAG retrieval.

CREATE TABLE IF NOT EXISTS chat_message_shares (
    id              SERIAL PRIMARY KEY,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    session_id      INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    user_type       VARCHAR(20) NOT NULL,        -- user | supplier | admin
    supplier_id     INTEGER,                      -- only set for supplier sharers
    message_ids     TEXT NOT NULL,                -- JSON array of chat_message ids
    note            VARCHAR(500),                 -- optional sender remark

    channel         VARCHAR(20) NOT NULL DEFAULT 'feishu',  -- feishu | wecom | dingtalk
    added_to_kb     BOOLEAN NOT NULL DEFAULT FALSE,         -- admin-only flag
    kb_knowledge_id INTEGER,                                -- ai_knowledge_base.id

    success         BOOLEAN NOT NULL DEFAULT FALSE,
    error_message   VARCHAR(500),
    feishu_msg_id   VARCHAR(100)                  -- echo from feishu for traceback
);

CREATE INDEX IF NOT EXISTS idx_chat_share_user ON chat_message_shares(user_id, user_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_share_supplier ON chat_message_shares(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_share_session ON chat_message_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_share_kb ON chat_message_shares(kb_knowledge_id) WHERE kb_knowledge_id IS NOT NULL;

-- Extend ai_knowledge_base so RAG entries can carry provenance.
ALTER TABLE ai_knowledge_base
    ADD COLUMN IF NOT EXISTS source     VARCHAR(50)  NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS source_id  INTEGER,
    ADD COLUMN IF NOT EXISTS author     VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_ai_kb_source ON ai_knowledge_base(source);
