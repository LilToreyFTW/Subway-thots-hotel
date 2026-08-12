# Subway Thots Hotel Desktop Client

## Architecture

`desktop-client/` wraps the canonical root Vite build. `scripts/prepare-game-build.js` runs `npm run build` at the repository root and copies the generated `dist/` into the Electron package as `game-runtime/`; it does not copy or fork `src/`.

Production game files are served through the secure `sth://game/` protocol. The renderer has `nodeIntegration: false`, `contextIsolation: true`, sandboxing, a narrow preload bridge, navigation filtering, controlled external links, and microphone permission restricted to the packaged game origin.

The packaged client relays multiplayer through the local loopback socket and connects that relay to `wss://world.subwaythotshotel.com`. For a private development host, set `STH_UPSTREAM_WORLD_URL` before launching Electron; do not ship a plaintext public `ws://` endpoint.

## Commands

```bash
npm run desktop:test
npm run desktop:build
npm run desktop:dev
npm run desktop:dist
```

`desktop:dev` starts Vite, waits for port 5173, and launches Electron. `desktop:dist` builds the root game, verifies required files, then uses electron-builder to produce NSIS and portable Windows artifacts.

## Release workflow

`.github/workflows/desktop-release.yml` runs on successful `main` pushes and manual dispatch. It installs both lockfiles, runs root and desktop tests, assigns semantic version `0.1.<GitHub run number>`, builds/verifies the game, builds NSIS + portable artifacts, verifies `latest.yml`, and publishes only after all prior steps succeed.

GitHub Actions uses its built-in `GITHUB_TOKEN` for release publishing. No GitHub token is embedded in the client. Optional Windows signing uses electron-builder's `CSC_LINK` and `CSC_KEY_PASSWORD` secrets; when absent, the artifacts are unsigned and SmartScreen may warn.

## Update flow

1. Launcher checks GitHub Releases shortly after startup and periodically through the updater service.
2. `electron-updater` compares the installed semantic version with the latest published release.
3. `AVAILABLE` makes the button green and shows release notes.
4. Clicking it calls `downloadUpdate()` and renders actual `download-progress` bytes/percentage.
5. `DOWNLOADED` changes the button to `RESTART & INSTALL`.
6. `quitAndInstall()` closes the game safely, installs the verified electron-builder artifact, and restarts the same app ID.
7. If checking fails, the button stays dark and says `UPDATE CHECK FAILED — RETRY`; offline play is not falsely reported as current.

The client never runs Git, `git pull`, downloads a raw repository archive, or overwrites source files. It consumes GitHub Release artifacts and electron-builder metadata (`latest.yml`, blockmaps, hashes).

## Persistence and logs

The stable app ID is `com.liltoreyftw.subwaythotshotel`. Electron keeps localStorage/profile data and desktop settings under the OS-specific `app.getPath('userData')`; updates replace the install directory only. Logs are written to `desktop-client.log` in that user-data directory. Passwords, tokens, TURN credentials, and private messages are not logged.

## Output files

- Installer: `Subway-Thots-Hotel-Setup-<version>-x64.exe`
- Portable build: `Subway-Thots-Hotel-<version>-x64.exe`
- Updater metadata: `latest.yml` and `.blockmap`
- Application executable: `SubwayThotsHotel.exe`

## Troubleshooting

- Run `npm run desktop:build` first if `game-runtime/index.html` is missing.
- A development launcher reports updater offline because GitHub release update checks are only enabled for packaged builds.
- If Windows SmartScreen warns, configure `CSC_LINK` and `CSC_KEY_PASSWORD` in Actions and publish a signed build.
- Keep the same app ID and artifact naming across releases so electron-updater can locate and install updates.
- Do not delete the user-data directory when troubleshooting persistence.

## Manual release

Use GitHub Actions → Desktop Windows Release → Run workflow, or push a tested commit to `main`. The workflow fails before publishing if root tests, desktop tests, game verification, packaging, or artifact verification fails.
