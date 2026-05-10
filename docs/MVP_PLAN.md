# MVP Plan for AgentDeck

This document outlines the Minimum Viable Product (MVP) plan for AgentDeck, detailing the core features and implementation steps required for the initial release.

## Goals

The primary goal of the MVP is to deliver a functional desktop application that allows developers to manage multiple AI coding agents, terminals, and development servers efficiently within a single workspace. The focus is on reducing context switching and providing a streamlined development experience on Windows.

## Key Features & Implementation Strategy

### 1. Workspace Management
-   **Create/Open Workspace:**
    -   A welcome screen will prompt users to create a new workspace or open an existing one.
    -   Creating a new workspace will involve specifying a name and a local project folder path.
    -   The application will store workspace configurations (name, path) locally. A simple JSON file or SQLite database will be used for persistence.
-   **Workspace Selector:**
    -   A dedicated screen or modal will allow users to view and select their saved workspaces.

### 2. Project Integration (package.json detection)
-   **Detection:** Upon opening a workspace, the application will scan the root of the project folder for a `package.json` file.
-   **Script Listing:** If `package.json` is found, the application will parse its `scripts` section.
-   **Quick Launch Buttons:** Detected npm scripts (e.g., `dev`, `build`, `test`) will be presented as clickable buttons in the command launcher or a dedicated section.

### 3. Terminal Pane Implementation
-   **Technology Stack:** `xterm.js` for rendering terminal UIs and `node-pty` for managing pseudoterminals.
-   **Pane Creation:** Each launched command (npm script, AI CLI, shell) will open in a new, resizable terminal pane.
-   **Command Execution:** `node-pty` will be used to spawn child processes for each command, connected to an `xterm.js` instance.
-   **Pane Management:** Functionality to close individual terminal panes will be implemented.
-   **Status Labels:** Each pane will display a status (Idle, Running, Waiting, Error, Done) based on the process state.

### 4. AI Agent Command Launching
-   **Predefined Commands:** Buttons will be available for `codex`, `gemini`, `opencode`, `kiro-cli`.
-   **Error Handling:** If a command is not found (e.g., the CLI is not installed), the application will display a user-friendly error message, providing guidance on how to install the missing tool.

### 5. Shell Support
-   **Default Shell:** On Windows, PowerShell will be the default shell for launching commands.
-   **WSL Support:** The application will detect if WSL is installed and allow users to launch WSL commands (e.g., `wsl -e <command>`).

### 6. UI/UX Design
-   **Theme:** Dark mode first, clean, minimalist design.
-   **Layout:** Sidebar for workspaces/agents, card/pane-based layout for terminal sessions.
-   **Focus:** Developer-centric, calm, powerful, no clutter.

### 7. Persistence
-   **Workspace Metadata:** Store workspace name, project path, and basic layout configuration.
-   **Session Restore:** When the application restarts, it should restore the previously active workspace and its open terminal panes.

## Deliverables Checklist (MVP)

-   [x] Working Electron React TypeScript app scaffold.
-   [x] Terminal pane implementation using xterm.js and node-pty.
-   [x] Local workspace persistence (basic metadata).
-   [ ] Package scripts detection and launch.
-   [x] README.md (Created in previous step).
-   [x] docs/MVP_PLAN.md (This file).
-   [x] docs/ARCHITECTURE.md (To be created).
-   [x] docs/ROADMAP.md (To be created).

## Next Steps

Proceed with creating `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and then begin scaffolding the core application files (`package.json`, Vite config, Electron main/preload, React entry points).