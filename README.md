# Subway Thots Hotel

A browser-first 3D social open-world prototype built with Three.js/Vite and a Python/PostgreSQL-ready world host.

## Client

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Local Python host

```bash
cd server-python
uv venv
uv pip install -r requirements.txt
cp .env.example .env
./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

The client connects to the local WebSocket region host at `ws://localhost:8000` and displays `ONLINE` when connected.

## Current prototype

- Neon city district and hotel plaza
- Walkable hotel interior
- Five floors and fifty room entries
- Procedural bedroom suites
- Hotel directory
- Adult-only fictional setting with all characters 18+
- Python authoritative WebSocket region host
- PostgreSQL-ready persistence with SQLite local fallback
- Server health, presence, snapshots, movement intent, and chat

See `WORLD_ARCHITECTURE.md` for the persistent-world roadmap and `VPS_DEPLOYMENT.md` for later hosting notes.
