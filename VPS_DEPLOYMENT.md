# VPS deployment notes

Target VPS: `147.189.172.104`

Current live reachability checked from WSL:

- TCP 3389: open
- TCP 80: open
- TCP 22: timed out
- TCP 21/2222/2022/8022: timed out
- TCP 443: timed out during the check

I cannot deploy over SSH until the provider firewall/NAT exposes TCP 22 or another SSH port. RDP is the current reachable administration path.

When access is available, deploy the production world behind HTTPS/WSS. Do not expose PostgreSQL or Redis publicly. Use a reverse proxy on 443 and keep the world gateway on an internal service port.
