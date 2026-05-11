# AgentDeck Roadmap

## v0.1.0 — MVP (Current)

- [x] Electron + React + TypeScript + Vite scaffold
- [x] xterm.js + node-pty terminal integration
- [x] Workspace CRUD (create, open, delete, list)
- [x] JSON persistence in `%APPDATA%/AgentDeck/`
- [x] Package.json script detection
- [x] Quick launch for npm scripts + AI agent CLIs
- [x] Multi-pane terminal grid
- [x] Pane status indicators (Idle, Running, Waiting, Error, Done)
- [x] Missing command detection with install help
- [x] Settings page (font size, default shell)
- [x] Dark mode theme
- [x] Documentation (README, MVP_PLAN, ARCHITECTURE, ROADMAP)

## v0.2.0 — Workspace Enhancements

- [ ] Save and restore exact pane layout (positions, sizes)
- [ ] Pane splitting (horizontal/vertical) via drag handles
- [ ] Rename panes inline
- [ ] Reorder panes via drag and drop
- [ ] Keyboard shortcuts (Ctrl+N new pane, Ctrl+W close pane)
- [ ] Pane zoom/focus mode (maximize single pane temporarily)

## v0.3.0 — Terminal Experience

- [ ] Custom font selection (Cascadia Code, Fira Code, JetBrains Mono)
- [ ] Terminal themes (additional presets beyond dark)
- [ ] Scrollback buffer configuration
- [ ] Copy/paste with right-click context menu
- [ ] Search within terminal output (Ctrl+F)
- [ ] Clear terminal button per pane

## v0.4.0 — Agent Integration

- [ ] Auto-detect installed AI CLIs and highlight available ones
- [ ] Per-agent configuration (API keys, model selection)
- [ ] Agent output parsing (detect errors, suggestions)
- [ ] Session history for agent interactions
- [ ] Cursor, Aider, Claude Code support

## v0.5.0 — DevOps & Infrastructure

- [ ] WSL detection and auto-configuration
- [ ] Git integration (show branch, uncommitted changes per workspace)
- [ ] Environment variable management per workspace
- [ ] Multi-root workspaces (multiple project folders)
- [ ] Docker integration (container status, logs)

## v0.6.0 — Polish & Performance

- [ ] Window state persistence (position, size, maximized)
- [ ] Workspace import/export
- [ ] Auto-update support (electron-updater)
- [ ] Crash reporting
- [ ] Telemetry (opt-in)
- [ ] Performance: lazy loading for inactive panes

## v1.0.0 — Stable Release

- [ ] Comprehensive test suite
- [ ] Signed Windows installer
- [ ] macOS and Linux official support
- [ ] Plugin/extension API
- [ ] Marketplace for community extensions
- [ ] Full accessibility support (screen readers, keyboard nav)
