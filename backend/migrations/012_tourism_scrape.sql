-- 012_tourism_scrape.sql
-- REQ-20260510-0011 · Phase 2 · 2C — admin-triggered scrape pipeline
--
-- Two tables:
--   tourism_scrape_jobs    — one row per admin-triggered scrape run (job_id, status, counts)
--   tourism_scrape_staging — one row per scraped URL (LLM-extracted JSON awaiting admin review)
--
-- D7 sticks: hand-written SQL, NOT in cmd/server/main.go autoMigrate. Apply
-- via SSH after deploy:
--   docker exec -i postgres psql -U postgres -d enjoysa < migrations/012_tourism_scrape.sql
--
-- D4 application: scrape-job mutex enforced at app level (only one running
-- job per source at a time). DB doesn't enforce — app layer 409s.
-- D5 application: tourism_scrape_staging UNIQUE(source, source_url) so a
-- re-run can't double-insert; app layer SELECT-before-LLM to skip cost.

-- =============================================================================
-- 12.1 scrape jobs — one per admin "Run" click
-- =============================================================================
CREATE TABLE IF NOT EXISTS tourism_scrape_jobs (
    id              VARCHAR(50) PRIMARY KEY,             -- uuid
    source          VARCHAR(50) NOT NULL,                 -- "sa-tourism" (Phase 2 only this source)
    status          VARCHAR(20) NOT NULL DEFAULT 'queued',-- queued | running | completed | failed | partial
    total_urls      INT NOT NULL DEFAULT 0,
    scraped_urls    INT NOT NULL DEFAULT 0,
    extracted_rows  INT NOT NULL DEFAULT 0,               -- new staging rows
    skipped_rows    INT NOT NULL DEFAULT 0,               -- D5 SELECT-before-LLM hits
    error_count     INT NOT NULL DEFAULT 0,
    last_error      TEXT,
    triggered_by    BIGINT,                               -- admin id; NULL when seeded internally
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tourism_scrape_jobs_source_status
    ON tourism_scrape_jobs(source, status);
CREATE INDEX IF NOT EXISTS idx_tourism_scrape_jobs_created_at
    ON tourism_scrape_jobs(created_at DESC);

-- =============================================================================
-- 12.2 scrape staging — LLM-extracted candidates awaiting admin review
-- =============================================================================
-- After scrape: status='pending'. Admin reviews each row and either:
--   - promote → INSERT a new tourism_attractions row, set status='promoted'
--   - reject  → set status='rejected' (we keep the row for audit; could prune later)
-- Re-running scrape: existing (source, source_url) row gets touched_by_job set
-- but data not overwritten unless explicitly forced (avoid clobbering admin
-- edits that happened in-place — though current admin flow doesn't edit
-- staging directly, this leaves the door open).
CREATE TABLE IF NOT EXISTS tourism_scrape_staging (
    id                  BIGSERIAL PRIMARY KEY,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    source              VARCHAR(50) NOT NULL,             -- "sa-tourism"
    source_url          TEXT NOT NULL,
    raw_html_excerpt    TEXT,                              -- first 800 chars for audit
    extracted_payload   JSONB NOT NULL DEFAULT '{}',       -- LLM extraction (attraction shape)
    extraction_confidence VARCHAR(10),                    -- "high" | "medium" | "low"

    status              VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | promoted | rejected
    reviewed_by         BIGINT,                            -- admin id who promoted/rejected
    reviewed_at         TIMESTAMPTZ,
    reject_reason       TEXT,
    promoted_to_id      BIGINT,                            -- tourism_attractions.id when promoted

    scrape_job_id       VARCHAR(50) NOT NULL,              -- FK to tourism_scrape_jobs.id

    -- D5: dedupe at the (source, source_url) layer so re-scrape skips before LLM cost.
    CONSTRAINT uq_tourism_scrape_staging_url UNIQUE (source, source_url)
);
CREATE INDEX IF NOT EXISTS idx_tourism_scrape_staging_status
    ON tourism_scrape_staging(status);
CREATE INDEX IF NOT EXISTS idx_tourism_scrape_staging_job
    ON tourism_scrape_staging(scrape_job_id);
CREATE INDEX IF NOT EXISTS idx_tourism_scrape_staging_created_at
    ON tourism_scrape_staging(created_at DESC);
