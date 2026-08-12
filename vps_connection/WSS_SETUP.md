# Secure multiplayer endpoint

The Vercel site is served over HTTPS, so browsers require a secure WebSocket
(`wss://`) connection. Production is configured as follows:

- Public health: `https://cyan-squirrel-97200.zap.cloud/health`
- Public game socket: `wss://cyan-squirrel-97200.zap.cloud/ws/sth-city-01`
- Private world process: `http://127.0.0.1:7076`

## Install or repair the Windows VPS host

Open PowerShell as Administrator in:

```text
C:\Users\Administrator\Desktop\vps_connection
```

Then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-Production-Host.ps1
```

The installer creates a Python environment, installs dependencies, downloads
Caddy, opens inbound TCP 443 in Windows Firewall, and installs these automatic
startup tasks:

- `STH-Multiplayer-World`
- `STH-Multiplayer-TLS`

Caddy obtains and renews the TLS certificate over port 443, then proxies secure
WebSocket traffic to the world process on localhost. Port 80 remains available
to the other application already using it on this VPS.

## Frontend configuration

The production URL is built into the Vercel and EXE clients. The equivalent Vite
environment variable is:

```env
VITE_STH_WORLD_URL=wss://cyan-squirrel-97200.zap.cloud
```

If Vercel already has `VITE_STH_WORLD_URL`, set it to that exact value or remove
it so the built-in production value is used, then redeploy. Keep
`VITE_STH_AUTH` unset or set to `off` until the separate Discord authentication
service is intentionally deployed.

## Verify production

Health check:

```powershell
Invoke-RestMethod https://cyan-squirrel-97200.zap.cloud/health
```

WebSocket check with `wscat`:

```powershell
wscat -c "wss://cyan-squirrel-97200.zap.cloud/ws/sth-city-01?player_id=test&display_name=HERMES"
```

The socket should return a `welcome` message and the game should display
`ONLINE WORLD`.

## Local development

Start the world host locally, run the Vite development server from the repository
root, and open the local override:

```text
http://localhost:5173/?world=ws://127.0.0.1:7076
```

The plaintext override is accepted only on localhost and is blocked on public
HTTPS builds.
