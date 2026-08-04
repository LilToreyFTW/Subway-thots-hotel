# SubwayThotsHotel Online — VPS Connection Package

This folder is self-contained. Move the entire `vps_connection` folder to the VPS and run `Host.py` through the included launcher.

Public world endpoint:

- IP: `147.189.172.104`
- TCP port: `7076`
- Health: `http://147.189.172.104:7076/health`
- WebSocket: `ws://147.189.172.104:7076/ws/sth-city-01`

## Windows VPS (recommended for the current RDP-accessible host)

1. Install Python 3.11+ and enable **Add Python to PATH**.
2. Copy this complete folder onto the VPS.
3. Right-click PowerShell and select **Run as administrator**.
4. Open the folder and run:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\Open-Firewall-7076.ps1
   ```

5. Run `Setup-Host.bat` once, then double-click `Start-Host.bat`.
6. Leave the window running, or configure Task Scheduler/NSSM to start `Start-Host.bat` at boot.
7. In the VPS provider firewall or port-forward panel, also allow inbound **TCP 7076**.

## Linux VPS

```bash
cd vps_connection
chmod +x start-host.sh
./start-host.sh
```

For boot startup, copy `subway-thots-hotel.service` to `/etc/systemd/system/`, adjust its paths if needed, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now subway-thots-hotel
sudo systemctl status subway-thots-hotel
```

Allow the port when UFW is active:

```bash
sudo ufw allow 7076/tcp
```

## Configuration

On first start, `.env.example` is copied to `.env`. Defaults:

```env
WORLD_HOST=0.0.0.0
WORLD_PORT=7076
REGION_TICK_RATE=20
DATABASE_URL=sqlite:///./subway_thots_hotel.db
```

SQLite works immediately. Set `DATABASE_URL` to PostgreSQL later for production persistence. Never expose PostgreSQL publicly.

## Verify from another computer

```text
http://147.189.172.104:7076/health
```

Expected response includes:

```json
{"ok":true,"service":"subway-thots-hotel-world","tickRate":20}
```

HTTP builds of the game client are preconfigured to use this VPS address. Player IDs are protected by a server-issued session token, and absolute client position updates are rejected.

## HTTPS/Vercel warning

A game page loaded over HTTPS cannot connect to plain `ws://` because browsers block mixed content. The client now fails closed with `SECURE HOST REQUIRED` instead of sending player data over an untrusted fallback. If the GitHub build is deployed to Vercel or another HTTPS site, put this host behind a domain with TLS and a reverse proxy, or configure `SSL_CERTFILE` and `SSL_KEYFILE` with a trusted certificate.

Configure the secure endpoint during the Vite/Vercel build:

```env
VITE_STH_WORLD_URL=wss://world.your-domain.example
```

The `?world=` override is accepted only on localhost for development and cannot redirect public players to an arbitrary server.

For initial testing, serve/open the game over HTTP and use the plain WebSocket endpoint above.
