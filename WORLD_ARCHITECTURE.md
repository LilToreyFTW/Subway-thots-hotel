# Subway Thots Hotel — Persistent Open-World Architecture

## Product direction

Subway Thots Hotel is a persistent 3D social world: the city is the public region, the hotel is the first owned/social venue, and rooms are instanced spaces that players can decorate and invite others into. All characters and users are adults (18+). The game should support fashion, nightlife, social events, property ownership, user-created objects, and consent-first interactions without requiring explicit sexual content.

## Stack decision

The current client remains a browser-first Three.js/Vite client. A native C++ viewer is not needed for the first release and would slow iteration. If a native client becomes necessary later, it can consume the same network protocol.

- Client: Three.js + JavaScript/TypeScript, GLB assets, DOM UI.
- Region server: C#/.NET authoritative simulation service when a .NET SDK is available on the deployment machine.
- Realtime transport: WebSocket protocol with snapshots, input commands, interest management, and region transfer.
- Persistence API: ASP.NET Core service backed by PostgreSQL.
- Presence/cache: Redis for sessions, matchmaking, and transient room presence.
- Scripting: a sandboxed LSL-like bytecode/VM layer. Never execute arbitrary user C#, Lua, or JavaScript inside the server process.
- Build/deploy: Python scripts for asset processing, validation, packaging, and repeatable deployment.
- VPS: `147.189.172.104`, currently reachable for RDP (3389) and web (80); SSH (22) is currently blocked from this environment.

## Region model

The first production region is `sth-city-01`:

- City plaza and streets
- Subway arrival hub
- Subway Thots Hotel lobby
- Five hotel floors
- Fifty suite instances
- Nightlife venues and event points

The browser should stream only nearby entities and region chunks. Do not attempt to render 1,000 players in one draw region. Use region/parcel interest management and crowd LODs.

## Server authority

The client sends intent, never truth:

- input: movement intent, emotes, interaction requests
- server: validates position, permissions, ownership, cooldowns, inventory, and script effects
- server broadcasts: authoritative player transforms, avatar appearance, object updates, chat/presence events

LocalStorage is suitable only for offline UI preferences. Currency, ownership, inventory, moderation state, and room permissions belong on the server.

## LSL-like object scripting

Objects get a restricted script with:

- event handlers: `state_entry`, `touch_start`, `listen`, `timer`
- bounded instructions and execution time
- explicit capabilities: text, animation request, object transform request, inventory lookup
- parcel/owner permission checks
- no filesystem, process, network, reflection, or arbitrary code execution

Start with a small parser/bytecode format and add language features only after replayable server tests exist.

## Delivery phases

1. **Foundation:** current 3D client, city/hotel regions, camera, movement, room directory, asset manifest.
2. **Online slice:** one authoritative region server, login/session, two-player presence, chat, reconnect, server snapshots.
3. **Social world:** accounts, avatars, emotes, friends, moderation, private rooms, property permissions.
4. **Creator economy:** object placement, inventory, parcel ownership, sandboxed object scripts, publishing/versioning.
5. **Scale:** region sharding, interest management, CDN assets, Redis presence, PostgreSQL persistence, observability.

## Non-negotiable safeguards

- 18+ age gate and adult-only fictional characters.
- Consent-first interaction states and block/report controls.
- Server-side moderation and audit logs.
- No arbitrary user code on the VPS.
- Rate limits on chat, object scripts, inventory, and interaction requests.
- Backups before migrations or deployment changes.
