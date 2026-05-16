# Session Engine

## Implemented now

A session represents one agent run attached to a project, agent adapter, provider, model, command, cwd, and log file.

## Lifecycle

- `created`: session record exists but has not launched.
- `starting`: Talocode is preparing the process.
- `running`: child process is active.
- `stopped`: user stopped the process or the daemon restarted.
- `completed`: process exited with code `0`.
- `failed`: process exited non-zero or failed to launch.

## Endpoints

- `GET /api/sessions`
- `GET /api/sessions?projectId=<id>`
- `GET /api/sessions?status=running`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions/:id/start`
- `POST /api/sessions/:id/stop`
- `POST /api/sessions/:id/restart`
- `GET /api/sessions/:id/logs`
- `GET /api/sessions/:id/stream`
- `POST /api/sessions/:id/input`
- `POST /api/sessions/:id/resize`

## Logs and paths

Logs are written under the Talocode data directory at `logs/<session-id>.log`. Windows data defaults to `%APPDATA%\Talocode`; paths with spaces are supported by Node path APIs and no shell interpolation is used for known adapter launches.

## Safety

Talocode only starts known adapters, validates project directories, and launches processes with `shell: false` to reduce command-injection risk.

## Partial/fallback behavior

PTY mode uses optional `node-pty` when available and falls back to process mode when unavailable. Process mode captures output and accepts stdin, but it is not a full terminal emulator.

## Next phase

Add templates, structured event replay, searchable timelines, and deeper xterm.js attachment.

## Migration from AgentDeck

Talocode started as the AgentDeck prototype. The project has moved to the Talocode brand and repository at https://github.com/talocode/talocode.
