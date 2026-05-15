# Roadmap

## Implemented now

- Local daemon, HTTP API, CLI, desktop dashboard, and static dashboard serving.
- Provider/project/agent/session registries with JSON persistence.
- PATH-based discovery and known adapter launch metadata.
- Session create/start/stop/restart, process fallback, optional PTY, log capture, and SSE output streaming.
- Codex/OpenCode OpenAI-compatible config generation with dry-run and backup behavior.
- LAN-only Phone Control MVP with pairing, hashed tokens, paired-device revocation, and `/phone` dashboard.
- Windows service/tray foundations that fail gracefully when unsupported/unavailable.
- Automated lint/test/build/smoke scripts.

## Partial/fallback behavior

- `node-pty` and Electron are optional dependencies for install reliability; daemon and process mode continue without them.
- Windows service commands use `sc.exe` directly and are not a full signed installer.
- Tray state refreshes on menu actions but does not yet poll daemon health continuously.
- Native QR image rendering is not implemented; Phone Control shows a QR payload/URL.
- Anthropic/Gemini are provider placeholders for future native routing.

## Near-term hardening

- Native QR rendering and terminal QR output.
- Signed Windows installer and service recovery policy.
- Packaged tray icon and health polling.
- Per-device phone permissions and audit log.
- Better xterm.js session attach/fit integration.
- Structured session event replay and log search.

## Later phases

- Optional secure cloud relay/sync for off-LAN phone control.
- Team dashboards and policy sharing.
- Secure OS keychain-backed secret references.
- Provider/model compatibility recommendations.
