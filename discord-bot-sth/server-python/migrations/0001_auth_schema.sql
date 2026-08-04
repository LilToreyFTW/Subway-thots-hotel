-- Subway-Thots-Hotel auth schema — baseline migration (PostgreSQL).
-- SQLite fallback is created automatically via SQLAlchemy metadata.create_all.
-- This file documents the intended production DDL and can be applied with:
--   psql "$DATABASE_URL" -f migrations/0001_auth_schema.sql

CREATE TABLE IF NOT EXISTS users (
    id                      VARCHAR(36) PRIMARY KEY,
    account_status          VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS discord_accounts (
    id                  SERIAL PRIMARY KEY,
    user_id             VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discord_user_id     VARCHAR(32) NOT NULL UNIQUE,
    discord_username    VARCHAR(64),
    discord_global_name VARCHAR(64),
    discord_avatar_hash VARCHAR(64),
    guild_member        BOOLEAN NOT NULL DEFAULT FALSE,
    last_verified_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discord_user_id ON discord_accounts(discord_user_id);

CREATE TABLE IF NOT EXISTS game_profiles (
    id                        SERIAL PRIMARY KEY,
    user_id                   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name              VARCHAR(16) NOT NULL,
    normalized_display_name   VARCHAR(16) NOT NULL UNIQUE,
    name_number               INTEGER NOT NULL,
    full_game_tag             VARCHAR(23) NOT NULL UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_normalized_display_name ON game_profiles(normalized_display_name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_full_game_tag ON game_profiles(full_game_tag);

CREATE TABLE IF NOT EXISTS sessions (
    id              SERIAL PRIMARY KEY,
    token_hash      VARCHAR(64) NOT NULL UNIQUE,
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token      VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at              BIGINT NOT NULL,
    last_seen_at    TIMESTAMPTZ,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_reason  VARCHAR(64),
    user_agent      VARCHAR(256),
    ip_address      VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS websocket_tickets (
    id          SERIAL PRIMARY KEY,
    ticket_id   VARCHAR(64) NOT NULL UNIQUE,
    user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_tag    VARCHAR(23) NOT NULL,
    discord_id  VARCHAR(32) NOT NULL,
    permissions VARCHAR(64) NOT NULL DEFAULT 'player',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at              BIGINT NOT NULL,
    consumed    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS discord_membership_cache (
    id            SERIAL PRIMARY KEY,
    discord_user_id VARCHAR(32) NOT NULL UNIQUE,
    is_member     BOOLEAN NOT NULL DEFAULT FALSE,
    role_ids      TEXT NOT NULL DEFAULT '',
    permission    VARCHAR(16) NOT NULL DEFAULT 'guest',
    cached_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
    id              SERIAL PRIMARY KEY,
    state           VARCHAR(64) NOT NULL UNIQUE,
    pkce_verifier   VARCHAR(128),
    csrf_token      VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at              BIGINT NOT NULL,
    consumed        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS role_mappings (
    id                SERIAL PRIMARY KEY,
    discord_role_id   VARCHAR(32) NOT NULL UNIQUE,
    game_permission   VARCHAR(16) NOT NULL,
    description       VARCHAR(128)
);

CREATE TABLE IF NOT EXISTS account_roles (
    id                SERIAL PRIMARY KEY,
    user_id           VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discord_role_id   VARCHAR(32) NOT NULL,
    game_permission   VARCHAR(16) NOT NULL,
    assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    source            VARCHAR(16) NOT NULL DEFAULT 'discord'
);
CREATE INDEX IF NOT EXISTS idx_account_roles_user ON account_roles(user_id);

CREATE TABLE IF NOT EXISTS bans (
    id                       SERIAL PRIMARY KEY,
    user_id                  VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason                   VARCHAR(512),
    moderator_discord_id     VARCHAR(32),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at               BIGINT,
    active                   BOOLEAN NOT NULL DEFAULT TRUE,
    discord_role_applied     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_bans_user ON bans(user_id);

CREATE TABLE IF NOT EXISTS suspensions (
    id                       SERIAL PRIMARY KEY,
    user_id                  VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason                   VARCHAR(512),
    moderator_discord_id     VARCHAR(32),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at               BIGINT,
    active                   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_suspensions_user ON suspensions(user_id);

CREATE TABLE IF NOT EXISTS rename_history (
    id                        SERIAL PRIMARY KEY,
    user_id                   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_display_name     VARCHAR(16),
    previous_full_game_tag    VARCHAR(23),
    new_display_name          VARCHAR(16) NOT NULL,
    new_full_game_tag         VARCHAR(23) NOT NULL,
    changed_by_discord_id     VARCHAR(32),
    reason                    VARCHAR(256),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_notes (
    id                  SERIAL PRIMARY KEY,
    user_id             VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_discord_id   VARCHAR(32),
    note                VARCHAR(1024) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id                    SERIAL PRIMARY KEY,
    event_type            VARCHAR(48) NOT NULL,
    user_account_id       VARCHAR(36),
    discord_user_id       VARCHAR(32),
    acting_staff_discord_id VARCHAR(32),
    timestamp             TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason                VARCHAR(512),
    metadata_json         TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_account_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp);

CREATE TABLE IF NOT EXISTS login_history (
    id            SERIAL PRIMARY KEY,
    user_id       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outcome       VARCHAR(32) NOT NULL,
    reason        VARCHAR(64),
    ip_hash       VARCHAR(64),
    user_agent    VARCHAR(256),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
