# Subway Thots Hotel

A browser-first 3D social open-world prototype built with Three.js/Vite and a Python/PostgreSQL-ready world host.

## Client

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Multiplayer world host

```bash
cd server-python
uv venv
uv pip install -r requirements.txt
cp .env.example .env
./.venv/bin/uvicorn main:app --host 0.0.0.0 --port 7076
```

The multiplayer client connects HTTP players to `147.189.172.104:7076` and displays `ONLINE WORLD` when connected. A self-contained Windows/Linux deployment package is available in `vps_connection/`; move that folder to the VPS and run `Host.py` through the included launcher. HTTPS deployments fail closed until `VITE_STH_WORLD_URL` points to a trusted `wss://` endpoint.

For local testing, override the world without editing source:

```text
http://localhost:5173/?world=ws://127.0.0.1:7076
```

## Proximity voice gateway

The browser client includes WebRTC proximity voice with `THREE.PositionalAudio`, a gain fallback, mute controls, speaking indicators, 25-unit hearing distance, and private-room isolation. Start the Socket.io signaling gateway separately:

```bash
cd multiplayer-server
cp .env.example .env
npm install
npm start
```

The development gateway listens on port `7077`. Use both local overrides when testing:

```text
http://localhost:5173/?world=ws://127.0.0.1:7076&voice=http://127.0.0.1:7077
```

Production microphone access requires HTTPS, a TLS-enabled Socket.io URL in `VITE_STH_VOICE_URL`, and a real TURN service for restrictive networks. See `MULTIPLAYER_VOICE.md` for architecture, integration API, Nginx, STUN/TURN, security, and scaling guidance.

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
- Synchronized customized remote avatars with interpolated movement
- Proximity-style online chat UI and persistent browser player identity
- Energy, hunger, and hygiene needs with food, inventory, and sleep recovery
- Playable hotel shifts and a three-stop city courier job with cash/reputation rewards
- Neon storefronts, reflective puddles, street furniture, and an upgraded hotel district

See `WORLD_ARCHITECTURE.md` for the persistent-world roadmap and `VPS_DEPLOYMENT.md` for later hosting notes.
