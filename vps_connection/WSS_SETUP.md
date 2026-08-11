# WSS endpoint setup — fix the "SECURE HOST REQUIRED" error

The game client is served over HTTPS (Vercel / any HTTPS host). Browsers block
mixed content, so it refuses the hardcoded plaintext `ws://147.189.172.104:7076`.
`src/main.js` therefore leaves `WORLD_URL` null on HTTPS pages and shows:

    WORLD - This HTTPS build needs a trusted wss:// endpoint configured by the host.

Fix: put the world host behind TLS so the client can use `wss://`.

====================================================================
STEP 1 — Point a domain at the VPS
====================================================================
In your DNS provider, add an A record:

    world.YOURDOMAIN.com   A   147.189.172.104

(Replace YOURDOMAIN.com with whatever domain you control. The game only needs
the subdomain; it does not need to match the Vercel frontend domain.)

====================================================================
STEP 2 — Terminate TLS in front of the world host
====================================================================
The world host (Host.py -> world_server.py) already runs on 127.0.0.1:7076
(plaintext). Put a TLS terminator in front of it. Two options:

--- OPTION A: Caddy (recommended, Windows VPS, auto-TLS) ---
1. Download caddy.exe (https://caddyserver.com) onto the VPS.
2. Save the included `Caddyfile` (edit the domain) next to it.
3. Open firewall: TCP 80 + TCP 443 (provider + Windows Firewall).
4. Run:  `caddy run --config Caddyfile`
   (or `caddy start` for background; wrap in NSSM/Task Scheduler for boot.)
Caddy issues + renews the cert automatically. Done.

--- OPTION B: nginx (alt) ---
1. Use the included `nginx-wss.conf` (edit domain + cert paths).
2. Issue certs with certbot (Linux) or win-acme (Windows).
3. Open firewall: TCP 80 + TCP 443.
4. `nginx -s reload`.
Remember to renew certs (certbot renew cron / win-acme task).

--- OPTION C: native uvicorn TLS (no proxy, needs 443 OR custom port) ---
If you'd rather not run a proxy, enable TLS directly in the world host by adding
to its `.env` (see step 4) and restarting Host.py:

    SSL_CERTFILE=/path/to/fullchain.pem
    SSL_KEYFILE=/path/to/privkey.pem

Then clients connect to `wss://world.YOURDOMAIN.com:7076` (port 7076 already open).
Let's Encrypt still needs port 80 reachable for the cert challenge.

====================================================================
STEP 3 — Tell the game client the wss:// URL
====================================================================
Set this build environment variable wherever you build/deploy the frontend:

    VITE_STH_WORLD_URL=wss://world.YOURDOMAIN.com

- Vercel: Project → Settings → Environment Variables → add it, then redeploy.
- Local build: add it to a `.env` / `.env.production` file at the repo root
  (Vite reads VITE_-prefixed vars at build time), then `npm run build`.

After deploy, the client reads it via `import.meta.env.VITE_STH_WORLD_URL` and
shows `ONLINE WORLD` instead of `SECURE HOST REQUIRED`.

NOTE: changing VITE_ vars requires a REBUILD + REDEPLOY. They are baked in at
build time, not read at runtime.

====================================================================
STEP 4 — World host .env (and the NEXT error you'll hit)
====================================================================
The deploy bundle copies `.env.example` -> `.env` on first start. Contents:

    WORLD_HOST=0.0.0.0
    WORLD_PORT=7076
    REGION_TICK_RATE=20
    DATABASE_URL=sqlite:///./subway_thots_hotel.db

If you use Caddy/nginx (Options A/B), LEAVE SSL_* unset — the proxy does TLS and
talks plaintext to 127.0.0.1:7076. Only set SSL_* for Option C.

IMPORTANT — the live VPS host currently answers the socket with:
    {"type":"auth_failed","reason":"invalid_ticket"}
That means the RUNNING world server has auth-ticket enforcement on
(STH_REQUIRE_AUTH_TICKET). The repo's vps_connection/world_server.py does NOT
have that gate, so restarting the host from this repo removes it. If you are
running the server-python/main.py variant instead, add to the world host .env:

    STH_REQUIRE_AUTH_TICKET=false

...then restart the host, or players will connect via wss:// but get kicked
with "SESSION AUTH FAILED".

====================================================================
STEP 5 — Verify
====================================================================
From any machine (the proxy must be up):

    # TLS handshake + WebSocket upgrade over wss://
    # (use wscat, or the browser console once the game is deployed)
    wscat -c "wss://world.YOURDOMAIN.com/ws/sth-city-01?player_id=test&display_name=HERMES"

Expected: a `{"type":"welcome",...}` frame (if ticket enforcement is off) or a
clean `auth_failed` only if STEP 4 wasn't applied. The game's bottom-left status
will read `ONLINE WORLD`.

====================================================================
QUICK LOCAL PROOF (no TLS, no domain) — dev only
====================================================================
Run the game over plain HTTP on localhost and pass the override:

    npm run dev
    # open:
    http://localhost:5173/?world=ws://147.189.172.104:7076

On http:// the insecure ws:// fallback is allowed, so it connects to the live
VPS host — proving reachability. This override is BLOCKED on HTTPS builds.
