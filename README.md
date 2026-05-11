# AgentDeck

**Windows-first desktop workspace for AI coding agents, terminals, dev servers, and test runners.**

AgentDeck lets you manage Codex, Gemini CLI, OpenCode, Kiro CLI, PowerShell, WSL, npm dev servers, and test commands — all in one window with terminal panes side by side.

## Why AgentDeck?

Managing multiple AI coding agents and dev tooling across separate terminal tabs is painful. AgentDeck gives you a single desktop window with:

- **Terminal panes** for each command (xterm.js + node-pty)
- **AI agent launchers** for Codex, Gemini CLI, OpenCode, Kiro CLI
- **npm script detection** — auto-discovers scripts from `package.json`
- **Persistent workspaces** — save and restore your layout
- **Dark mode** from the start, developer-first

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 33 |
| UI | React 19 + TypeScript 5 |
| Bundler | Vite 6 |
| Terminal | xterm.js 5 + node-pty |
| Persistence | Local JSON (`%APPDATA%/AgentDeck/`) |
| Default Shell | PowerShell (WSL supported) |

## Getting Started

### Prerequisites

- **Node.js 20+** and npm
- **Windows** (primary target; macOS and Linux work too)
- **Python** and a C++ compiler (required by `node-pty` on Windows — install via `npm install --global windows-build-tools` or Visual Studio Build Tools)

### Install

```bash
git clone https://github.com/your-org/agentdeck.git
cd agentdeck
npm install
```

### Run (Development)

```bash
npm run dev
```

This starts Vite dev server on `http://localhost:5173` and launches Electron.

### Build

```bash
npm run build
```

Builds the Vite renderer to `dist/renderer/`.

## Usage

1. **Welcome Screen** — Create a new workspace or open a recent one
2. **Workspace Selector** — Name your workspace and pick a project folder. AgentDeck auto-detects `package.json` scripts
3. **Main Workspace** — See your terminal panes in a grid layout
4. **Command Launcher** — Click npm scripts or AI agent commands to open new panes
5. **Settings** — Adjust terminal font size

### Launching Commands

Each button in the command launcher opens a new terminal pane:

| Button | Command |
|--------|---------|
| `npm run dev` | Runs the project's dev server |
| `npm run build` | Runs the build script |
| `npm test` | Runs the test script |
| Codex | `codex` |
| Gemini CLI | `gemini` |
| OpenCode | `opencode` |
| Kiro CLI | `kiro-cli` |
| PowerShell | `powershell.exe` |
| WSL | `wsl` |

### Missing Commands

If an AI CLI is not installed, AgentDeck shows a helpful message with install instructions instead of failing silently.

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, window creation
│   ├── ipc-handlers.ts      # IPC bridge handlers
│   ├── terminal-manager.ts  # node-pty lifecycle
│   └── workspace-store.ts   # JSON persistence
├── preload/
│   └── index.ts             # contextBridge API
└── renderer/                # React app
    ├── App.tsx              # Page router
    ├── App.css              # Dark theme
    ├── types.ts             # Shared types
    ├── pages/               # Welcome, Selector, Workspace, Settings
    ├── components/          # Sidebar, TerminalPane, TerminalGrid, CommandLauncher
    └── hooks/               # useWorkspace, useTerminal
```

## Safety

- No hidden command execution — you must explicitly click to launch
- Commands are shown before execution
- `contextIsolation: true`, `nodeIntegration: false`
- Sandbox disabled only for `node-pty` (required)

## License

MIT

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md).
