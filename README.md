# Talocode Legacy

This repository contains early experiments around local agent orchestration and control-plane ideas.

Talocode has since evolved into an open-source AI tools org for builders.

Current active projects:

- Codra: https://github.com/talocode/codra
- SignalLane: https://github.com/talocode/signallane
- ClientPad: https://github.com/clientpadhq/clientpad

For the current Talocode org profile, visit:
https://github.com/talocode

---

## Historical README

# Talocode

Talocode is a local-first control plane for coding agents.

Run agents on your machine. Control them from desktop or phone. Manage sessions, providers, logs, worktrees, and approvals from one cockpit.

## What is Talocode?

Talocode lets you run coding agents on your machine, control them from desktop or phone, and manage sessions, providers, logs, worktrees, and approvals from one local cockpit.

It provides a desktop dashboard, a local daemon, a local HTTP API, a phone-optimized control surface, provider and model discovery, session logs, generated integration config, and worktree-oriented session workflows without depending on a hosted control plane.

## Features

- Local-first Talocode daemon with a desktop dashboard and CLI.
- Provider registry for Ollama, OpenRouter, OpenAI-compatible endpoints, OpenAI, Anthropic, and Gemini-style providers.
- Coding-agent adapter discovery for installed CLI tools.
- Project and session management with live output, logs, and start/stop/restart actions.
- **Context caching** — hash-based stable-file detection, cache hit/miss tracking, token estimation, and provider-neutral caching layer ready for Anthropic/Gemini prompt caching.
- **Browser runtime** — Playwright-based persistent browser sessions with create/start/stop/restart lifecycle, headless/headed modes, session profiles, storage export, and audit logging.
- Talocode Phone Control for trusted LAN monitoring and session actions.
- Integration config generation that stores environment variable names instead of raw API keys.
- Talocode-managed worktree session patterns documented for safe multi-agent workflows.
- Text/Mermaid architecture documentation with no generated binary architecture assets.

## Quickstart

```bash
npm install
npm run build
npm run test
npm run smoke
```

Start the local daemon:

```bash
talo start
```

Open the dashboard from the CLI:

```bash
talo open
```

`agentdeck` remains temporarily available as a compatibility alias for the same CLI entrypoint.

## CLI

Primary command examples:

```bash
talo status
talo discover
talo providers list
talo providers add --type ollama --name "Ollama Local" --baseUrl http://localhost:11434/v1 --model llama3.1
talo provider add --type openrouter --name OpenRouter --baseUrl https://openrouter.ai/api/v1 --apiKeyEnvVar OPENROUTER_API_KEY --model openai/gpt-4o-mini
talo providers test ollama
talo projects list
talo projects add C:\\code\\my-project
talo sessions list
talo sessions create --projectId <project-id> --agentId codex-cli --providerId ollama --model llama3.1
talo sessions start <session-id>
talo sessions stop <session-id>
talo browser list
talo browser create --name "My Workspace" --startUrl https://example.com
talo browser start <session-id>
talo browser stop <session-id>
talo remote enable
talo worktrees list
```

Backward-compatible alias examples:

```bash
agentdeck start
agentdeck status
```

## Environment variables

Talocode resolves environment variables in this order: `TALOCODE_*`, then legacy `AGENTDECK_*`, then defaults.

- `TALOCODE_HOST` defaults to `127.0.0.1`.
- `TALOCODE_PORT` defaults to `3768`.
- `TALOCODE_URL` points the CLI at another local daemon URL.
- `TALOCODE_DATA_DIR` overrides the local data directory.
- `TALOCODE_BROWSER_RUNTIME_ENABLED` set to `false` to disable browser runtime (default: enabled).
- `TALOCODE_BROWSER_MAX_SESSIONS` max concurrent browser sessions (default: 3).
- `TALOCODE_BROWSER_HEADLESS` set to `true` to run browsers without visible windows by default.
- `TALOCODE_BROWSER_CHANNEL` override browser channel (e.g., `chrome`, `msedge`).
- `TALOCODE_BROWSER_SLOWMO` milliseconds of slow-motion delay for debugging.
- `TALOCODE_BROWSER_VIEWPORT` JSON viewport like `{"width":1280,"height":720}`.

Legacy aliases remain available for now: `AGENTDECK_HOST`, `AGENTDECK_PORT`, `AGENTDECK_URL`, and `AGENTDECK_DATA_DIR`.

## Phone control

Talocode can expose a phone-optimized `/phone` cockpit on your trusted LAN. Phone access is disabled by default. Enable it from **Settings → Talocode Phone Control** or with:

```bash
talo remote enable
```

Pair with the generated one-time token. Paired phones can monitor Talocode sessions, projects, providers, agents, logs, and start/stop/restart existing sessions. See `docs/PHONE_CONTROL.md` and `docs/REMOTE_ACCESS_SECURITY.md`.

## Context caching

Talocode scans project directories for stable files (`AGENTS.md`, `package.json`, `README.md`, `docs/**/*.md`, etc.), hashes their content, and builds context packs. Validate a pack to see which files have changed between agent runs. This operates at the Talocode orchestration layer — it does not call provider-native caching APIs yet, but the foundation is in place for Anthropic Prompt Caching and Google Context Caching. See `docs/context-caching.md` for details.

## Browser runtime

Talocode can manage persistent Playwright-based browser sessions. Each session gets its own Chromium profile, viewport, and headless/headed mode. Sessions persist across restarts, support storage state export, and log every lifecycle event to an append-only audit trail. This is designed for AI agent workflows, persistent web automation, and human takeover of agent-managed browser sessions — not for evasion, scraping, or captcha bypass. Use the Browser tab in the dashboard or the `talo browser` CLI commands.

## Worktree sessions

Talocode-managed worktrees are intended to isolate coding-agent sessions by branch or task. See `docs/WORKTREE_SESSIONS.md` if present and `docs/SESSION_ENGINE.md` for the current session engine behavior.

## Architecture

The architecture documentation is maintained as Markdown and Mermaid text:

- `docs/ARCHITECTURE.md`
- `docs/talocode-architecture.mmd`

Core layers include Access Layer, Talocode Core, Provider Router, Context Cache Layer, Browser Runtime, Execution & Storage, and Talocode-managed worktrees.

## Status

This repository is an MVP-stage local-first control plane. The daemon, dashboard, CLI, phone access, providers, sessions, and smoke tests are designed to stay local and avoid hosted dependencies by default.

## Migration from AgentDeck

Talocode started as the AgentDeck prototype. The project has moved to the Talocode brand and repository at https://github.com/talocode/talocode.

Default data directories now use Talocode naming:

- Windows: `%APPDATA%/Talocode`
- macOS: `~/Library/Application Support/Talocode`
- Linux: `~/.config/talocode`

Migration behavior:

1. `TALOCODE_DATA_DIR` wins when provided.
2. `AGENTDECK_DATA_DIR` is honored as a legacy override when `TALOCODE_DATA_DIR` is not set.
3. Otherwise Talocode uses the new default directory.
4. If an old default AgentDeck directory exists and the new Talocode directory does not, Talocode creates the new directory and copies JSON config files such as `agentdeck.json` to `talocode.json` when safe.
5. Talocode does not delete old AgentDeck data automatically.

## Contributing

Run these checks before submitting changes:

```bash
npm run lint
npm test
npm run build
npm run smoke
```

Do not add generated binary architecture assets. Keep architecture diagrams in Mermaid/text or app-native React/CSS.

## Contact

Email: talocodehq@gmail.com
