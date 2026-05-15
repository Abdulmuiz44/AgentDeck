# Local Development

## Implemented now

- `npm install` installs JavaScript dependencies and treats Electron and `node-pty` as optional so native/binary download failures do not block daemon/process-mode development.
- `npm run lint`, `npm test`, `npm run build`, and `npm run smoke` are the stabilization gates.
- `node dist/cli/index.js start` runs the daemon directly and serves the built dashboard from `dist/renderer`.
- `npm run dev` builds main-process TypeScript, starts Vite, waits for Vite, and launches Electron when the optional Electron package/binary is installed.

## Install

```bash
npm install
```

If optional native PTY support is unavailable, AgentDeck still builds and sessions fall back to process mode. To use PTY on Windows, install a supported Node LTS version and the Windows build tools required by `node-pty`, then reinstall optional dependencies.

## Run the dashboard in development

```bash
npm run dev
```

The Electron app starts the AgentDeck daemon automatically when possible. If Electron was skipped by optional dependency handling, use the daemon/browser workflow instead.

## Run the daemon directly

```bash
npm run build
node dist/cli/index.js start
```

Optional Windows-friendly overrides:

```powershell
$env:AGENTDECK_PORT = "3886"
$env:AGENTDECK_DATA_DIR = "$env:TEMP\AgentDeck Dev"
node dist/cli/index.js start
```

## Useful checks

```bash
npm run lint
npm test
npm run build
npm run smoke
```

## Smoke test endpoints

The automated smoke script verifies `/health`, `/api/status`, `/api/providers`, `/api/agents`, `/api/projects`, `/api/sessions`, `/api/system/discover`, `/api/remote/access`, `/phone`, `/architecture`, and the architecture asset, then runs phone pairing/revoke auth checks.

## Known limitations

- The Electron binary may not be present if optional dependency download was skipped; the CLI daemon remains usable.
- PTY mode depends on `node-pty`; process mode is the supported fallback.
- Windows service install/uninstall requires Administrator rights.
