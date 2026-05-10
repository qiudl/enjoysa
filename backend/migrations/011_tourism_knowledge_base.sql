-- 011_tourism_knowledge_base.sql
-- REQ-20260510-0002: 南澳旅游 AI Agent · Phase 1 知识库底座
--
-- 5 张表：tourism_attractions / accommodations / food / experiences / pricing_benchmarks
-- 与 004_create_knowledge_base.sql 的 ai_knowledge_base（平台政策/FAQ KB）完全独立。
--
-- D7 决议：本批表不走 GORM AutoMigrate，仅靠本 SQL + 后续 migrations 维护。
-- 加列、改字段、加 partial index/CHECK 都必须在本目录追加 SQL 并 SSH prod 手跑。
-- D2 决议：attractions/accommodations/food/experiences 默认 is_active=FALSE，
-- admin 手动启用；search_knowledge 工具仅返回 is_active=true。

-- =============================================================================
-- 2.1 景点
-- =============================================================================
CREATE TABLE IF NOT EXISTS tourism_attractions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    name_zh                  VARCHAR(255) NOT NULL,
    name_en                  VARCHAR(255),
    council                  VARCHAR(100),                    -- Adelaide Hills, Barossa, Eyre Peninsula...
    category                 VARCHAR(50),                     -- nature, urban, history, food, wine, family
    tags                     TEXT[] NOT NULL DEFAULT '{}',    -- 玩法标签
    price_range_min          NUMERIC(10,2),
    price_range_max          NUMERIC(10,2),
    typical_duration_minutes INT,
    best_seasons             TEXT[] NOT NULL DEFAULT '{}',    -- spring/summer/autumn/winter/year_round
    description              TEXT,
    source                   VARCHAR(50),                     -- product_etl | admin_manual | scraped
    source_ref               VARCHAR(255),                    -- 来源 product_id 或 URL
    is_active                BOOLEAN NOT NULL DEFAULT FALSE   -- D2: 冷启动入库默认 false
);
CREATE INDEX IF NOT EXISTS idx_tourism_attractions_council    ON tourism_attractions(council);
CREATE INDEX IF NOT EXISTS idx_tourism_attractions_category   ON tourism_attractions(category);
CREATE INDEX IF NOT EXISTS idx_tourism_attractions_active     ON tourism_attractions(is_active);
CREATE INDEX IF NOT EXISTS idx_tourism_attractions_deleted_at ON tourism_attractions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tourism_attractions_tags_gin   ON tourism_attractions USING GIN(tags);

-- =============================================================================
-- 2.2 酒店/民宿
-- =============================================================================
CREATE TABLE IF NOT EXISTS tourism_accommodations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    name_zh         VARCHAR(255) NOT NULL,
    name_en         VARCHAR(255),
    council         VARCHAR(100),
    star_rating     SMALLINT,
    price_range_min NUMERIC(10,2),
    price_range_max NUMERIC(10,2),
    room_types      TEXT[] NOT NULL DEFAULT '{}',
    features        TEXT[] NOT NULL DEFAULT '{}',
    address         TEXT,
    source          VARCHAR(50),
    source_ref      VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_tourism_accommodations_council    ON tourism_accommodations(council);
CREATE INDEX IF NOT EXISTS idx_tourism_accommodations_active     ON tourism_accommodations(is_active);
CREATE INDEX IF NOT EXISTS idx_tourism_accommodations_deleted_at ON tourism_accommodations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tourism_accommodations_features_gin ON tourism_accommodations USING GIN(features);

-- =============================================================================
-- 2.3 美食/餐厅
-- =============================================================================
CREATE TABLE IF NOT EXISTS tourism_food (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    name_zh           VARCHAR(255) NOT NULL,
    name_en           VARCHAR(255),
    council           VARCHAR(100),
    cuisine           VARCHAR(50),
    price_range_min   NUMERIC(10,2),
    price_range_max   NUMERIC(10,2),
    signature_dishes  TEXT[] NOT NULL DEFAULT '{}',
    address           TEXT,
    source            VARCHAR(50),
    source_ref        VARCHAR(255),
    is_active         BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_tourism_food_council    ON tourism_food(council);
CREATE INDEX IF NOT EXISTS idx_tourism_food_cuisine    ON tourism_food(cuisine);
CREATE INDEX IF NOT EXISTS idx_tourism_food_active     ON tourism_food(is_active);
CREATE INDEX IF NOT EXISTS idx_tourism_food_deleted_at ON tourism_food(deleted_at);

-- =============================================================================
-- 2.4 体验型项目（红酒品鉴 / 考拉抱抱 / 邮轮等）
-- =============================================================================
CREATE TABLE IF NOT EXISTS tourism_experiences (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    name_zh                  VARCHAR(255) NOT NULL,
    name_en                  VARCHAR(255),
    council                  VARCHAR(100),
    category                 VARCHAR(50),                  -- wine | wildlife | cruise | hike | cultural ...
    price_range_min          NUMERIC(10,2),
    price_range_max          NUMERIC(10,2),
    typical_duration_minutes INT,
    best_seasons             TEXT[] NOT NULL DEFAULT '{}',
    description              TEXT,
    source                   VARCHAR(50),
    source_ref               VARCHAR(255),
    is_active                BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_tourism_experiences_council    ON tourism_experiences(council);
CREATE INDEX IF NOT EXISTS idx_tourism_experiences_category   ON tourism_experiences(category);
CREATE INDEX IF NOT EXISTS idx_tourism_experiences_active     ON tourism_experiences(is_active);
CREATE INDEX IF NOT EXISTS idx_tourism_experiences_deleted_at ON tourism_experiences(deleted_at);

-- =============================================================================
-- 2.5 价格行情（pricing_benchmarks）
-- =============================================================================
-- 维度：(category, council, duration_bucket, season)
-- 聚合：median + p25 + p75 + sample_size，由 admin 后台手动 recompute（本期不做 cron）
-- D4 决议：sample_size < 3 → 调用方返回 insufficient_data；3-4 → confidence=low；
--          5-11 → normal；>=12 → high。confidence 由调用方按 sample_size 推导，不存表。
CREATE TABLE IF NOT EXISTS tourism_pricing_benchmarks (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    category        VARCHAR(50) NOT NULL,
    council         VARCHAR(100) NOT NULL,
    duration_bucket VARCHAR(20) NOT NULL,         -- half_day | full_day | multi_day
    season          VARCHAR(20) NOT NULL DEFAULT 'year_round',

    median_price    NUMERIC(10,2),
    p25             NUMERIC(10,2),
    p75             NUMERIC(10,2),
    sample_size     INT NOT NULL DEFAULT 0,
    currency        CHAR(3) NOT NULL DEFAULT 'AUD',
    computed_at     TIMESTAMPTZ,

    CONSTRAINT uq_pricing_benchmarks_dim
        UNIQUE (category, council, duration_bucket, season)
);
CREATE INDEX IF NOT EXISTS idx_pricing_benchmarks_lookup
    ON tourism_pricing_benchmarks(category, council, duration_bucket);
