# Subway-Thots-Hotel Voice Gateway

Production-oriented Socket.io signaling and spatial-state relay for browser WebRTC voice.

## Run

```bash
cp .env.example .env
npm ci --omit=dev
npm start
```

The default development port is `7077`. Check it with:

```bash
curl http://127.0.0.1:7077/health
```

## Configuration

- `HOST`: bind interface; normally `0.0.0.0` on a VPS.
- `PORT`: HTTP/Socket.io port; default `7077`.
- `CORS_ORIGINS`: comma-separated allowed browser origins. Use the exact HTTPS game origin in production.
- `MAX_LOBBY_SIZE`: hard-capped at 32; default 16 because WebRTC mesh bandwidth grows quadratically.
- `ALLOW_ANONYMOUS`: suitable only for local development. Production should set it to `false`.
- `AUTH_SECRET`: random 32+ character HMAC secret used to verify short-lived player identity tokens. It is mandatory when anonymous access is disabled.

In production, the trusted game backend should generate a short-lived token with `createJoinToken()` from `src/auth.js`. Pass it to `ProximityVoiceClient` as `authToken`; never generate signed identity tokens in browser code.

## Protocol

Client to server:

- `lobby:join`: `{ lobbyCode, playerId, displayName }`, with acknowledgement.
- `player:state`: `{ position: {x,y,z}, rotation, zone, roomId }`, rate limited to 25 Hz.
- `webrtc:signal`: `{ targetId, signal: {description}|{candidate} }`.
- `voice:speaking`: boolean.

Server to client:

- `player:joined`, `player:left`, `player:state`
- `webrtc:signal`: `{ fromId, signal }`
- `voice:speaking`: `{ socketId, playerId, speaking }`

Signals can only be sent to a socket in the sender's lobby. Lobby codes, positions, identities, signaling payload sizes, room capacity, and signaling rate are validated.

## Production

Put this process behind a TLS reverse proxy. Socket.io needs HTTP upgrade support. Do not expose microphone gameplay over plain HTTP; `getUserMedia` requires a secure context except on localhost.

Use the included systemd unit as a template. For multiple gateway instances, add the Socket.io Redis adapter and sticky sessions. This gateway deliberately uses a WebRTC mesh and should remain limited to small social lobbies.
