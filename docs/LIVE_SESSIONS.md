# Live Sessions

## Implemented now

Talocode supports two execution modes:

- `pty`: preferred live terminal mode. Talocode attempts to load optional `node-pty` at runtime, starts the known adapter in the project cwd, streams output through Server-Sent Events, accepts input, and supports resize events.
- `process`: fallback mode using `child_process.spawn` with `shell: false`. Output is still streamed and logged, but terminal behavior is less interactive.

If `node-pty` is not installed or cannot load, Talocode logs a clear fallback message and starts process mode instead.

## API

- `POST /api/sessions` with `mode: "pty" | "process"`
- `POST /api/sessions/:id/start`
- `GET /api/sessions/:id/stream`
- `POST /api/sessions/:id/input` with `{ "data": "..." }`
- `POST /api/sessions/:id/resize` with `{ "cols": 120, "rows": 30 }`
- `GET /api/sessions/:id/logs`

The stream endpoint uses Server-Sent Events and emits `session_started`, `output`, `input_ack`, `resized`, `session_stopped`, `session_failed`, `session_completed`, and `heartbeat` events.

## Dashboard

Open the Sessions page, create a session in PTY or process mode, and click **Create and Start Session**. Selecting a session opens the live terminal panel with controls for reconnecting, clearing the view, copying logs, sending input, and resizing.

## Windows PTY setup

PTY support is optional. For best Windows PTY behavior, use a Node LTS release, install the native build tooling required by `node-pty`, and run `npm install` with optional dependencies enabled. If that fails, process mode remains supported.

## Known limitations

- Process fallback is not a full interactive terminal.
- The dashboard log panel is not a full xterm.js attach session yet.
- Session templates and structured event search are future work.

## Migration from AgentDeck

Talocode started as the AgentDeck prototype. The project has moved to the Talocode brand and repository at https://github.com/talocode/talocode.
