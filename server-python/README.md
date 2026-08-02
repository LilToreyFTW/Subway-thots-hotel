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

The client sends input intent. The server clamps movement, owns presence, assigns region state, broadcasts snapshots, and persists player profiles. This is a prototype region host—not yet a horizontally scaled MMO service.
