# AgentDeck MVP Plan

## Vision
AgentDeck is a Windows-first desktop workspace for developers running multiple AI coding agents, terminals, dev servers, and test runners side by side in a single window.

## MVP Goal
Create the smallest useful desktop app where a developer can:
1. Create or open a project workspace
2. Select a local project folder
3. Detect `package.json` scripts if present
4. Launch terminal panes for common commands
5. Launch AI coding agent CLI commands (codex, gemini, opencode, kiro-cli)
6. Save workspace layout locally
7. Restore previous workspace sessions
8. Show status labels per pane: Idle, Running, Waiting, Error, Done

## Tech Stack
- **Desktop shell:** Electron 33
- **UI:** React 19 + TypeScript 5
- **Bundler:** Vite 6 with @vitejs/plugin-react
- **Terminal:** xterm.js 5 + xterm-addon-fit
- **PTY:** node-pty 1.x
- **Persistence:** Local JSON in `%APPDATA%/AgentDeck/`
- **Default Shell:** PowerShell (WSL optional)

## Screens

| Screen | Purpose |
|--------|---------|
| Welcome | First launch — create/open workspace |
| Workspace Selector | Configure new workspace (name, path, scripts) |
| Main Workspace | Terminal grid + sidebar + command launcher |
| Settings | Terminal font size, shell preferences |

## MVP Feature Checklist

### Workspace Management
- [x] Create workspace with name and project path
- [x] Store workspace config locally (JSON)
- [x] Open existing workspace
- [x] List recent workspaces on Welcome screen

### Package Detection
- [x] Read project's `package.json`
- [x] Extract and display npm scripts
- [x] Provide quick-launch buttons for each script

### Terminal Panes
- [x] Open any command in its own xterm.js terminal pane
- [x] Multi-pane grid layout (auto-arranged)
- [x] Close individual panes
- [x] Status indicators per pane (Idle, Running, Waiting, Error, Done)

### Quick Launch Commands
- [x] npm run dev, build, test (from detected scripts)
- [x] codex, gemini, opencode, kiro-cli
- [x] powershell, wsl

### Error Handling
- [x] Missing CLI shows helpful install message via `check:` prefixed pane
- [x] Commands shown as button labels before execution
- [x] No auto-execution

### Persistence
- [x] Save workspace on every pane change
- [x] Restore workspace list on reopen
- [x] Workspace data stored as JSON

## Out of Scope (MVP)
- Full terminal emulator features (tabs, splits, search)
- SSH connections
- Remote workspaces
- Plugin system
- Workspace sharing
- Custom keybindings
- Advanced layout saving/restoring
