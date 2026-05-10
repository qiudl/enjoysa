-- REQ-20260510-0011 Phase 2 dev-2A — DB-backed cache for the C-end embedded
-- AI buttons (Explain / FitCheck / Nearby).
--
-- Why a DB cache instead of in-memory LRU only:
--   - the backend currently runs as a single docker compose service, so an
--     in-memory cache would be enough for hit rate, BUT
--   - rolling deploys reset memory every push; a DB cache lets a hot product
--     keep its 6h TTL across restarts (avoids the cold-deploy LLM-cost spike)
--   - cross-replica share when we eventually scale horizontally
--
-- gorm AutoMigrate creates the table from the GORM model on boot, but the
-- expires_at index is a where-clause hot path so we declare it explicitly
-- (per the migrations-not-auto-applied memory: gorm handles columns and
-- simple indexes from struct tags but special indexes / jitter logic stays
-- in raw SQL).

CREATE TABLE IF NOT EXISTS tourism_agent_cache (
  cache_key  VARCHAR(255) PRIMARY KEY,
  value_json JSONB        NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tourism_agent_cache_expires
  ON tourism_agent_cache (expires_at);
