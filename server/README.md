# World server boundary

This folder is reserved for the authoritative region server. The intended production implementation is C#/.NET, but the local WSL environment currently has no `dotnet` executable, so this milestone only defines the protocol and boundaries. Do not treat the client as authoritative multiplayer.

Recommended service split:

- `WorldServer`: WebSocket connections, tick loop, region/entity state.
- `PersistenceApi`: accounts, avatars, inventory, rooms, parcels, moderation records.
- `ScriptRuntime`: sandboxed LSL-like VM with instruction/time budgets.
- `AssetService`: signed asset manifests and CDN/object storage URLs.

Suggested deployment ports on the VPS:

- 80/443: website and HTTPS/WSS reverse proxy
- 30120: WebSocket world gateway (or proxy it behind 443)
- 5432: PostgreSQL bound to localhost only
- 6379: Redis bound to localhost only

The first online slice should be one region, two clients, movement, chat, reconnect, and a visible server-authoritative connection badge.
