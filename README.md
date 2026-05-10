# AgentDeck

AgentDeck is a Windows-first desktop workspace for builders running multiple AI coding agents, terminals, dev servers, and test runners side by side.

It is inspired by the pain of managing Codex, Gemini CLI, OpenCode, Kiro CLI, PowerShell, WSL, npm dev servers, and test commands across too many terminal tabs.

## Vision
To provide a seamless, integrated, and powerful desktop environment for AI-assisted software development, reducing context switching and improving developer productivity.

## MVP Scope
The Minimum Viable Product (MVP) for AgentDeck will focus on core functionality to enable developers to manage multiple development tools and AI agents within a single desktop application. Key features include:

1.  **Workspace Management:**
    *   Create new workspaces with a name and a local project folder path.
    *   Open and select from existing workspaces.
    *   Persist basic workspace metadata locally (e.g., using JSON or SQLite).
2.  **Project Integration:**
    *   Detect `package.json` files within the selected project folder.
    *   Automatically list and provide quick launch buttons for detected npm scripts (e.g., `dev`, `build`, `test`).
3.  **Terminal Panes:**
    *   Launch specified commands (npm scripts, AI CLI tools, shells) in dedicated, resizable terminal panes.
    *   Implement terminal pane management using `xterm.js` and `node-pty`.
    *   Support for closing individual terminal panes.
4.  **AI Agent Command Launching:**
    *   Provide quick launch buttons for common AI coding agent CLIs: `codex`, `gemini`, `opencode`, `kiro-cli`.
    *   Handle cases where an AI CLI is not installed by showing a helpful error message directing the user to installation instructions.
5.  **Shell Support:**
    *   Default to PowerShell as the shell on Windows.
    *   Support launching Windows Subsystem for Linux (WSL) commands if WSL is detected.
6.  **UI/UX:**
    *   Clean, dark-mode-first design focused on developers.
    *   No clutter, calm but powerful interface.
    *   Use a sidebar for workspaces and agents.
    *   Use cards or panes for terminal sessions.
    *   Show simple status labels for each pane: Idle, Running, Waiting, Error, Done.
7.  **Persistence:**
    *   Save and restore the layout and state of the workspace sessions.

## Installation (for development)
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AgentDeck
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Roadmap
- **Phase 1 (MVP):** Implement core features as defined in the MVP Scope.
- **Phase 2 (Enhancements):**
    - Advanced configuration for terminal commands.
    - Integration with more AI agents and development tools.
    - Customizable status indicators.
    - Improved workspace saving and restoring capabilities.
    - Cross-platform support (macOS, Linux).
- **Phase 3 (Advanced Features):**
    - Multi-agent orchestration.
    - Project-wide search and refactoring tools.
    - Real-time collaboration features.
    - Plugin system for extensibility.
