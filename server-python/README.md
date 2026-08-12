# Subway Thots Hotel Python Host

Local authoritative host for the Three.js client. This is intentionally separate from the frontend so the host can be copied to the VPS later without changing the game client.

## Local run

From this directory:

```bash
uv venv
uv pip install -r requirements.txt
cp .env.example .env
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Health check:

```text
http://127.0.0.1:8000/health
```

WebSocket region endpoint:

```text
ws://127.0.0.1:8000/ws/sth-city-01?player_id=local-player&display_name=BL0WDART
```

## PostgreSQL

Set `DATABASE_URL` to a PostgreSQL URL before launch. Tables are created automatically for this prototype. For production, add Alembic migrations before public deployment.

## Authority model

Anti-cheat is enforced by the host: position, movement, money, inventory,
weapons, health, damage, god mode, noclip, teleport, and admin commands are
server-only state. Invalid input and impossible zone transitions accumulate
strikes; repeated violations close the connection. Violations are written to
the `sth.anti_cheat` logger.

For update work, an operator may create a short-lived HMAC debug token with
`anti_cheat.create_debug_token(player_id, expires_at, secret)`. Configure the
same `ANTI_CHEAT_DEBUG_SECRET` on the host and pass it as `debug_token` in the
WebSocket query. Tokens are bound to the player id, expire, and never come
from the browser.

The client sends input intent. The server clamps movement, owns presence, assigns region state, broadcasts snapshots, and persists player profiles. This is a prototype region host—not yet a horizontally scaled MMO service.
