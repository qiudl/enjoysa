-- REQ-20260509-0037 Phase 1: Slack-style group chat (workspaces + channels + threads).
--
-- New tables:
--   chat_workspaces        — 1 row per (user_id, user_type)
--   chat_agents            — global agent registry (cs/tech/...)
--   chat_channels          — workspace 1:N; user-created topical channels
--   chat_channel_members   — channel 1:N agents (+ admins reserved for P3)
--
-- chat_messages column extensions:
--   channel_id             — every new message belongs to a channel
--   thread_parent_id       — NULL = main flow; non-NULL = thread reply
--   sender_type / sender_agent_id / sender_admin_id
--   mentions               — agent_id[] mentioned in this message
--   also_in_channel        — TRUE = thread reply also pinned to channel main
--
-- Notes:
--   - GORM AutoMigrate adds the 4 new tables and chat_messages columns. This
--     SQL captures the partial indexes, FK ON DELETE behavior, and CHECK
--     constraints that AutoMigrate cannot express (see memory:
--     [migrations/*.sql 不自动跑] — apply this on prod via psql).
--   - Defect-analysis fixes baked in:
--       * T3: idx_msg_channel_main covers also_in_channel=TRUE rows so thread
--             replies cross-posted to channel still appear in the main flow.
--       * T1: thread_parent_id ON DELETE RESTRICT — thread parents cannot be
--             deleted while replies exist (P1 has no delete UX, but seal it
--             at the schema layer now).
--       * D4: chat_channels.is_default for "the un-deletable default channel"
--             — migration script keys off this, never the slug.

BEGIN;

-- 1. Workspaces -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_workspaces (
    id              BIGSERIAL PRIMARY KEY,
    owner_user_id   BIGINT NOT NULL,
    owner_user_type VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_owner UNIQUE (owner_user_id, owner_user_type)
);

-- 2. Agents (global registry) --------------------------------------------
CREATE TABLE IF NOT EXISTS chat_agents (
    id                       BIGSERIAL PRIMARY KEY,
    code                     VARCHAR(40) NOT NULL,
    name                     VARCHAR(50) NOT NULL,
    member_type              VARCHAR(20) NOT NULL DEFAULT 'ai',
    llm_provider             VARCHAR(20),
    llm_model                VARCHAR(60),
    system_prompt            TEXT NOT NULL DEFAULT '',
    tool_keys                TEXT[] NOT NULL DEFAULT '{}',
    avatar_emoji             VARCHAR(8),
    color_hex                VARCHAR(8),
    sort_order               INT NOT NULL DEFAULT 0,
    default_in_new_channel   BOOLEAN NOT NULL DEFAULT TRUE,
    enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_agent_code UNIQUE (code),
    CONSTRAINT chk_agent_member_type CHECK (member_type IN ('ai','human'))
);

-- 3. Channels ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_channels (
    id                BIGSERIAL PRIMARY KEY,
    workspace_id      BIGINT NOT NULL REFERENCES chat_workspaces(id) ON DELETE CASCADE,
    name              VARCHAR(40) NOT NULL,
    slug              VARCHAR(40) NOT NULL,
    description       VARCHAR(200) NOT NULL DEFAULT '',
    default_agent_id  BIGINT REFERENCES chat_agents(id),
    keyword_rules     TEXT[] NOT NULL DEFAULT '{}',
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,
    archived          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_channel_workspace_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_channels_workspace_active
    ON chat_channels (workspace_id)
    WHERE archived = FALSE;

-- One default channel per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_workspace_default
    ON chat_channels (workspace_id)
    WHERE is_default = TRUE;

-- 4. Channel members -----------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_channel_members (
    id           BIGSERIAL PRIMARY KEY,
    channel_id   BIGINT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    member_type  VARCHAR(20) NOT NULL DEFAULT 'ai',
    agent_id     BIGINT REFERENCES chat_agents(id),
    admin_id     BIGINT,
    muted        BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_member_type CHECK (member_type IN ('ai','human')),
    CONSTRAINT chk_member_one_ref CHECK (
        (member_type='ai'    AND agent_id IS NOT NULL AND admin_id IS NULL) OR
        (member_type='human' AND admin_id IS NOT NULL AND agent_id IS NULL)
    )
);

-- An agent can be in a channel at most once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_channel_agent
    ON chat_channel_members (channel_id, agent_id)
    WHERE agent_id IS NOT NULL;

-- An admin can be in a channel at most once (P3).
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_channel_admin
    ON chat_channel_members (channel_id, admin_id)
    WHERE admin_id IS NOT NULL;

-- 5. chat_messages column extensions -------------------------------------
ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS channel_id        BIGINT,
    ADD COLUMN IF NOT EXISTS thread_parent_id  BIGINT,
    ADD COLUMN IF NOT EXISTS sender_type       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS sender_agent_id   BIGINT,
    ADD COLUMN IF NOT EXISTS sender_admin_id   BIGINT,
    ADD COLUMN IF NOT EXISTS mentions          BIGINT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS also_in_channel   BOOLEAN NOT NULL DEFAULT FALSE;

-- Foreign keys (added separately so column adds + FK constraints stay
-- replayable independently if a partial run is interrupted).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_msg_channel') THEN
        ALTER TABLE chat_messages
          ADD CONSTRAINT fk_msg_channel
          FOREIGN KEY (channel_id) REFERENCES chat_channels(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_msg_thread_parent') THEN
        -- T1: RESTRICT so a parent can never vanish from underneath replies.
        ALTER TABLE chat_messages
          ADD CONSTRAINT fk_msg_thread_parent
          FOREIGN KEY (thread_parent_id) REFERENCES chat_messages(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_msg_sender_agent') THEN
        ALTER TABLE chat_messages
          ADD CONSTRAINT fk_msg_sender_agent
          FOREIGN KEY (sender_agent_id) REFERENCES chat_agents(id);
    END IF;
END$$;

-- 6. Partial indexes for hot paths ---------------------------------------
-- Main flow: top-level OR cross-posted thread reply (T3 fix).
CREATE INDEX IF NOT EXISTS idx_msg_channel_main
    ON chat_messages (channel_id, created_at DESC)
    WHERE channel_id IS NOT NULL
      AND (thread_parent_id IS NULL OR also_in_channel = TRUE);

-- Thread expansion: ascending so reply N+1 follows N naturally.
CREATE INDEX IF NOT EXISTS idx_msg_thread
    ON chat_messages (thread_parent_id, created_at)
    WHERE thread_parent_id IS NOT NULL;

-- Mentions reverse lookup ("everywhere I was @-ed").
CREATE INDEX IF NOT EXISTS idx_msg_mentions ON chat_messages USING GIN (mentions);

COMMIT;
