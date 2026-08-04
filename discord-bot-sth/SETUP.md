# Subway-Thots-Hotel — Discord Authentication & Community Management

A complete, production-ready authentication and community system for the
Subway-Thots-Hotel Three.js game. Players must authenticate through **official
Discord OAuth2** and remain members of your Discord server to play. The system
covers:

- Discord OAuth2 login (PKCE + state, guild-membership + role verification)
- Server-generated 6-digit game tags (`Slizzy#738665`), permanently linked to the
  verified Discord account
- Membership enforcement (cached, with periodic re-checks; revokes access on leave)
- Discord role → game-permission mapping (owner/admin/moderator/staff/player/banned)
- A Discord bot with staff slash commands + event-driven membership sync
- A modular Three.js frontend auth flow (no secrets in the browser)
- A FastAPI backend with WebSocket ticket auth, audit logging, rate limiting
- PostgreSQL-ready schema with SQLite local fallback

---

## 1. Architecture

```
discord-bot-sth/
  server-python/                # FastAPI auth API + Discord bot (shared DB)
    main.py                     # FastAPI app (auth API + authenticated WS)
    config.py                   # env config + permission mapping
    database.py                 # engine/session + migrations entry
    security.py                 # HMAC tokens, CSRF, rate limiting
    discord_http.py             # Discord REST client (mockable)
    auth/                       # oauth, sessions, middleware, permissions, membership
    api/                        # auth_routes, account_routes, player_routes, admin_routes, ws_routes
    discord_bot/                # bot.py + commands/ + events/
    models/                     # SQLAlchemy ORM tables
    services/                   # account, discord, membership, moderation, websocket, audit
    migrations/                 # SQL + Python bootstrap migration
    tests/                      # pytest suite (mocked Discord)
    .env.example
    requirements.txt
  frontend/                     # modular auth UI (auth/ + ui/)
    src/
      auth/                     # AuthClient, DiscordLogin, SessionManager, AuthGuard, AccountSetup
      ui/                       # LoginScreen, PlayerNameScreen, DiscordProfileCard,
                                #   MembershipRequiredModal, AccountStatusModal
      index.js                  # bootstrap entry
      auth.css
```

The auth backend shares the **same database** as the existing world host
(`server-python/main.py`). The world host's `/ws/{region_id}` endpoint has an
**optional, env-gated** ticket check (`STH_REQUIRE_AUTH_TICKET`) so enabling auth
never breaks current local play.

---

## 2. Create the Discord application & bot

1. Go to https://discord.com/developers/applications → **New Application**.
   Name it `Subway-Thots-Hotel`.
2. **OAuth2 → General**:
   - Copy **Client ID** → `DISCORD_CLIENT_ID` / `DISCORD_APPLICATION_ID`.
   - **Reset Secret** → copy → `DISCORD_CLIENT_SECRET`.
   - **Redirects**: add exactly
     `http://147.189.172.104/7076/auth/discord/callback`
     (use `http://localhost:7076/auth/discord/callback` for local dev).
3. **Bot** → **Add Bot**:
   - Copy the bot **token** (reset if needed) → `DISCORD_BOT_TOKEN`.
   - **Privileged Gateway Intents**: enable **SERVER MEMBERS INTENT**
     (required for join/leave/role events). **MESSAGE CONTENT** is NOT needed
     (we use slash commands).
4. **OAuth2 → URL Generator** (or Bot invite):
   - Scopes: `bot`, `applications.commands`.
   - Bot Permissions: `Manage Roles` (to assign/remove the verified/banned role),
     `Send Messages`, `Embed Links`, `View Channels`, `Read Message History`.
   - Open the generated URL and invite the bot to your guild.
5. Copy the **Guild (Server) ID** (Server Settings → Widget/App Settings, or
   enable Developer Mode and right-click the server) → `DISCORD_GUILD_ID`.
6. Create the roles **Owner, Admin, Staff, Moderator, Player, Verified, Banned**
   in the guild and copy each role ID (Developer Mode → Copy Role ID) into the
   matching `DISCORD_*_ROLE_ID` env vars. Ensure the bot's highest role is *above*
   the roles it must manage (especially Verified and Banned).
7. Create the four channels (audit, registration, moderation, announcement) and
   copy their IDs into `DISCORD_*_CHANNEL_ID`.

> The bot needs a **role position above** the Verified/Banned roles it manages,
> and the `Manage Roles` permission, or role assignment will fail (logged, not fatal).

---

## 3. Configure `.env`

```bash
cd discord-bot-sth/server-python
cp .env.example .env
# then edit .env and fill in the real secrets/ids
```

Generate secrets:

```bash
python -c "import secrets; print(secrets.token_hex(32))"   # SESSION_SECRET
python -c "import secrets; print(secrets.token_hex(32))"   # AUTH_SECRET
```

**Never** put real `.env` in git (already ignored). The bot token, client secret,
and DB credentials must never appear in the frontend.

---

## 4. Database

**Local (SQLite, default):**

```bash
# DATABASE_URL defaults to sqlite:///./subway_thots_hotel.db
python migrations/0001_baseline.py     # creates tables + seeds role mappings
```

**Production (PostgreSQL):**

```bash
export DATABASE_URL="postgresql+psycopg://sth_user:PASSWORD@localhost:5432/sth"
psql "$DATABASE_URL" -f migrations/0001_auth_schema.sql
python migrations/0001_baseline.py
```

Tables created: `users`, `discord_accounts`, `game_profiles`, `sessions`,
`websocket_tickets`, `discord_membership_cache`, `oauth_states`, `role_mappings`,
`account_roles`, `bans`, `suspensions`, `rename_history`, `moderation_notes`,
`audit_logs`, `login_history`. Uniqueness constraints enforce one account per
Discord ID, unique normalized game name, unique full tag, unique name number, and
single active OAuth state / WebSocket ticket.

---

## 5. Install dependencies

Using `uv` (matches the existing project):

```bash
cd discord-bot-sth/server-python
uv venv
uv pip install -r requirements.txt
```

Or with pip:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

---

## 6. Run the services

**Auth API + authenticated WebSocket (terminal 1):**

```bash
cd discord-bot-sth/server-python
uv run uvicorn main:app --host 0.0.0.0 --port 7076
# or: .venv/bin/uvicorn main:app --host 0.0.0.0 --port 7076
```

**Discord bot (terminal 2):**

```bash
cd discord-bot-sth/server-python
uv run python -m discord_bot.bot
# or: .venv/bin/python -m discord_bot.bot
```

**Existing world host + voice gateway** (optional, unchanged):

```bash
cd server-python && uv run uvicorn main:app --host 0.0.0.0 --port 7076
cd ../multiplayer-server && npm install && npm start
```

**Frontend (terminal 3):**

```bash
cd Subway-thots-hotel          # project root
npm install
npm run dev                    # Vite dev server proxies /api -> :7076
```

To enable the auth UI in the browser, set the env for Vite:

```bash
VITE_STH_AUTH=on npm run dev
```

The existing local gamertag flow remains the default when `VITE_STH_AUTH` is unset.

---

## 7. Enable ticket enforcement on the world host (production)

After the auth backend + bot are live, set in the world host's environment:

```bash
STH_REQUIRE_AUTH_TICKET=true
```

The world host will then require a short-lived ticket (issued by
`POST /account/ws-ticket`) on `?ticket=...`. Without it, connections are closed
with `auth_failed`. Leave it `false` (default) to keep the open local flow.

---

## 8. HTTPS deployment

The browser must be served over HTTPS and the backend behind the same origin (or a
trusted `wss://`). Set:

```bash
COOKIE_SECURE=true
COOKIE_SAMESITE=none   # when cross-site cookies are required; same-site is safer
FRONTEND_URL=https://your-game.example
DISCORD_REDIRECT_URI=https://your-game.example/auth/discord/callback
```

Terminate TLS at a reverse proxy (Nginx/Caddy) and proxy `/api` (and `/ws`) to
the uvicorn backend. The README notes the game already fails closed until
`VITE_STH_WORLD_URL` points to a trusted `wss://` endpoint.

---

## 9. Slash commands (after bot is invited)

All `/player` and `/server` commands are **ephemeral** (staff-only visible).

| Command | Description |
|---|---|
| `/player lookup <target>` | Look up a player by mention, Discord id, account id, name, or tag |
| `/player verify <target>` | Show verification + membership status |
| `/player unlink <target>` | Delete an account (admin only) |
| `/player rename <target> <new_name>` | Change a player's game name (logs staff) |
| `/player suspend <target> [hours] [reason]` | Suspend (timed or indefinite) |
| `/player unsuspend <target>` | Lift suspension |
| `/player ban <target> [hours] [reason]` | Ban (optional Discord banned role) |
| `/player unban <target>` | Lift ban |
| `/player kick <target>` | Disconnect + revoke sessions (no ban) |
| `/player rolesync <target>` | Re-sync Discord roles → game permissions |
| `/player sessions <target>` | Count active sessions |
| `/player force-logout <target>` | Revoke all sessions |
| `/player notes <target> <note>` | Add a moderation note |
| `/server status` | Accounts + online sessions |
| `/server online` | List online players (tags) |
| `/server announce <message>` | Announce to Discord + in-game |
| `/server maintenance [on/off]` | Toggle maintenance (admin) |
| `/server registrations` | Total registered accounts |
| `/server audit` | Recent audit-log entries |

`/moderation ban|unban|suspend|unsuspend|kick|force-logout` mirrors the
player sub-actions under a dedicated namespace.

---

## 10. Security summary

- **OAuth2 state + PKCE** prevent CSRF/replay; states are single-use + TTL.
- **HttpOnly, SameSite cookies** hold the opaque session token; an additional
  signed JWT + CSRF header protects state-changing requests.
- **Discord ID is the permanent identity key**; usernames are re-synced on change.
- **Membership cached** (configurable TTL) — Discord is never called per movement.
- **WebSocket tickets** are short-lived, single-use, HMAC-signed; long-lived
  access tokens are never placed in URLs.
- **Permission checks happen server-side** on every admin action; the owner is
  derived centrally from `GAME_OWNER_DISCORD_USER_ID` (no scattered bypasses).
- **ORM/parameterized queries** (SQLAlchemy) prevent SQL injection.
- **Rate limiting** on login/signup; generic public errors (no secret leakage).
- **Audit logging** for every security event; tokens/secrets/IPs are never logged.
- **No Discord secrets in the frontend** — only the server-generated authorize URL
  and the backend-verified identity are used.

---

## 11. Troubleshooting

- **"membership_required" on login** — the player is not in the guild, or the
  redirect URI / guild ID is wrong. Check `DISCORD_GUILD_ID` and the invite.
- **"role_required"** — the player lacks the Player/Verified role. The bot can
  auto-assign Verified after signup if it has `Manage Roles` and is positioned
  above the Verified role.
- **Bot commands missing** — slash commands sync on startup to the guild; ensure
  the bot has `applications.commands` scope and was reinvited after adding it.
- **Role assignment fails** — bot role must be higher than the target role, and
  the bot needs `Manage Roles`.
- **Tickets rejected by world host** — confirm `STH_REQUIRE_AUTH_TICKET` matches
  whether the auth backend is issuing tickets, and that both share the same DB.
- **DB "already exists" on migrate** — migrations are idempotent; safe to re-run.

---

## 12. Testing

```bash
cd discord-bot-sth/server-python
uv pip install pytest httpx
uv run pytest -q
```

All Discord calls are mocked; no network requests are made. Tests cover:
successful login, invalid state, not-in-server, missing role, auto role assign,
duplicate Discord account, duplicate/case-insensitive/ reserved/invalid names,
banned/suspended login, membership loss mid-session, WS ticket replay/expiry,
session revocation, owner permission, username change without identity loss,
unauthorized admin command, Discord API outage, and DB outage handling.
