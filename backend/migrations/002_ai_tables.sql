-- AI Cache (review summaries, briefings, prechecks, etc.)
CREATE TABLE IF NOT EXISTS ai_cache (
    id BIGSERIAL PRIMARY KEY,
    cache_key VARCHAR(200) NOT NULL UNIQUE,
    cache_type VARCHAR(50) NOT NULL,
    result JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_cache(expires_at);

-- AI FAQ Feedback (tracks which answers users find helpful)
CREATE TABLE IF NOT EXISTS ai_faq_feedback (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    helpful BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_faq_feedback_product ON ai_faq_feedback(product_id);

-- AI Metrics (latency, token usage, error tracking per scene)
CREATE TABLE IF NOT EXISTS ai_metrics (
    id BIGSERIAL PRIMARY KEY,
    scene VARCHAR(50) NOT NULL,
    latency_ms INT NOT NULL,
    tokens_used INT DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_scene ON ai_metrics(scene);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_created ON ai_metrics(created_at);
