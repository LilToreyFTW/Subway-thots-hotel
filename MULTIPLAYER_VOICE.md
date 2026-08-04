# Multiplayer + Proximity Voice Architecture

## Overview

The online mode uses two lightweight services with separate responsibilities:

```text
Browser / Three.js
  ├─ authoritative movement input ── WebSocket ── Python world host :7076
  │                                              ├─ player snapshots
  │                                              ├─ rooms/zones
  │                                              └─ persistent SQLite state
  │
  └─ voice presence + WebRTC signaling ─ Socket.io ─ Node voice gateway :7077
                                                 ├─ public/private lobby membership
                                                 ├─ position/rotation relay for audio
                                                 ├─ SDP/ICE relay
                                                 └─ speaking indicators

Browser A  <================ WebRTC audio ================>  Browser B
                         STUN/TURN traversal
```

Audio never passes through the Socket.io server. Once peers negotiate, Opus audio flows over WebRTC directly or through TURN. The server only relays signaling, lightweight spatial state, and speaking state.

The existing Python world remains the canonical avatar movement service. The Node gateway also relays position and rotation so the voice module can be dropped into a standalone Three.js project without the Python host.

## Files

```text
multiplayer-server/
  src/server.js             Express + Socket.io gateway
  src/validation.js         Lobby/state/signal validation
  test/                     Real Socket.io integration tests
  .env.example
  subway-thots-voice.service

src/multiplayer/
  ProximityVoiceClient.js   WebRTC peer lifecycle, audio, state sync
  proximity.js              Tested distance/zone helpers
  voiceConfig.js            Secure endpoint resolution

test/
  proximity.test.js
  voice-config.test.js
```

## Client lifecycle

1. `ProximityVoiceClient.connect()` opens Socket.io and joins `PUBLIC` or a supplied room code.
2. Existing peers are returned in the join acknowledgement.
3. Each peer owns one `RTCPeerConnection`. Perfect-negotiation collision handling prevents offer glare.
4. Clicking the mic button calls `getUserMedia` and adds/replaces the audio track on every peer.
5. `update()` sends position/rotation at 10 Hz and updates voice distance and speaking indicators.
6. `THREE.PositionalAudio` is attached to the corresponding remote avatar when available.
7. If no Three.js listener/avatar is available, an `HTMLAudioElement` fallback uses squared linear gain.
8. Players in different zones or different private room IDs are forced to zero volume.
9. Peer connections, audio nodes, media tracks, and UI indicators are cleaned up on leave/disconnect.

## Existing game integration

`src/main.js` already performs the integration. The reusable shape is:

```js
const listener = new THREE.AudioListener();
camera.add(listener);

const voice = new ProximityVoiceClient({
  serverUrl: 'https://voice.example.com',
  lobbyCode: 'PUBLIC',
  playerId: account.id,
  displayName: account.tag,
  authToken: shortLivedVoiceToken,
  listener,
  maxDistance: 25,
  iceServers: [
    { urls: 'stun:stun.example.com:3478' },
    {
      urls: 'turns:turn.example.com:5349',
      username: shortLivedUsername,
      credential: shortLivedCredential,
    },
  ],
  getLocalState: () => ({
    position: { x: player.position.x, y: player.position.y, z: player.position.z },
    rotation: player.rotation.y,
    zone: currentZone,
    roomId: currentZone === 'room' ? currentRoomId : null,
  }),
  getRemoteObject: (playerId) => remotePlayers.get(playerId)?.avatar,
});

voice.connect();

// Call once per render frame.
voice.update();

muteButton.onclick = () => voice.toggleMicrophone();
window.addEventListener('beforeunload', () => voice.disconnect(), { once: true });
```

For a project without the Python world host, use these client events to create/interpolate/remove remote avatars:

```js
voice.addEventListener('playerjoined', ({ detail }) => createRemoteAvatar(detail.playerId));
voice.addEventListener('playerstate', ({ detail }) => setRemoteTarget(detail.playerId, detail.position, detail.rotation));
voice.addEventListener('playerleft', ({ detail }) => removeRemoteAvatar(detail.playerId));
voice.addEventListener('speaking', ({ detail }) => setTalkingIcon(detail.playerId, detail.speaking));
```

Interpolate rendered avatars toward the latest state; do not snap meshes on every packet.

## Local development

Terminal 1:

```bash
cd multiplayer-server
cp .env.example .env
npm install
npm start
```

Terminal 2:

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/?world=ws://127.0.0.1:7076&voice=http://127.0.0.1:7077
```

`localhost` and `127.0.0.1` count as secure contexts for development microphone access. Public HTTP does not.

## Production deployment

### Required browser build variables

```env
VITE_STH_WORLD_URL=wss://world.example.com
VITE_STH_VOICE_URL=https://voice.example.com
VITE_STUN_URL=stun:turn.example.com:3478
VITE_TURN_URL=turns:turn.example.com:5349
VITE_TURN_USERNAME=<short-lived username>
VITE_TURN_CREDENTIAL=<short-lived credential>
```

Anything beginning with `VITE_` is visible to users in the browser bundle. Do not put permanent TURN administrator secrets there. Generate time-limited TURN REST credentials from a trusted backend.

### Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name voice.example.com;

    ssl_certificate /etc/letsencrypt/live/voice.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/voice.example.com/privkey.pem;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:7077;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 75s;
    }

    location /health {
        proxy_pass http://127.0.0.1:7077;
    }
}
```

Set `CORS_ORIGINS` to the exact HTTPS game origin, not `*`. Also set `NODE_ENV=production`, `ALLOW_ANONYMOUS=false`, and a random 32+ character `AUTH_SECRET`. A trusted backend can import `createJoinToken()` from `multiplayer-server/src/auth.js` to mint short-lived tokens; the signing secret must never enter the browser bundle.

## STUN and TURN

A public STUN server is suitable only for initial testing. Some carrier, corporate, symmetric-NAT, and restrictive Wi-Fi networks require TURN. Production voice should provide both UDP and TLS TURN routes:

- UDP TURN on 3478 for best latency.
- TLS TURN on 443 or 5349 for restrictive networks.
- Time-limited credentials.
- Regional TURN servers if players are geographically distributed.
- Monitor relay bandwidth; TURN carries the actual audio when direct P2P fails.

Coturn is a common self-hosted choice. Managed services such as Twilio Network Traversal or Cloudflare Calls TURN can reduce operations work.

## Performance and scaling

This implementation uses a peer mesh. With `N` users, each talker can send to `N-1` peers and the room creates roughly `N(N-1)/2` peer connections. Keep social lobbies around 8–16 players. The gateway defaults to 16 and hard-caps configuration at 32.

For larger rooms:

- Use an SFU such as LiveKit, mediasoup, Janus, or ion-sfu.
- Subscribe only to nearby speakers.
- Add interest management/spatial partitions server-side.
- Use the Socket.io Redis adapter plus sticky sessions when scaling signaling horizontally.

Other production checks:

- Authenticate Socket.io connections with short-lived game-session tokens before trusting `playerId`.
- Add moderation: per-player mute/block, report tools, admin disconnect, and abuse logging.
- Gate microphone activation behind explicit user interaction.
- Handle device changes and expose microphone selection.
- Keep Opus mono with echo cancellation/noise suppression for lightweight voice.
- Do not treat relayed client positions as anti-cheat authority; use the world server for gameplay validation.
- Collect WebRTC stats (`getStats`) for RTT, packet loss, jitter, bitrate, and TURN usage.
- Test Chrome, Firefox, Safari, Android, and iOS over different NAT types.
