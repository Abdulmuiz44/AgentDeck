# Architecture for AgentDeck

This document outlines the architectural design for AgentDeck, focusing on the recommended technology stack and the interactions between different components.

## Core Technologies

*   **Desktop Framework:** Electron
    *   Provides a framework to build cross-platform desktop applications using web technologies.
    *   Manages the main process (Node.js environment) and renderer processes (Chromium-based browser windows).
*   **Frontend Framework:** React (with TypeScript)
    *   For building the user interface, managing components, state, and UI logic.
    *   TypeScript will be used for static typing, improving code quality and maintainability.
*   **Build Tool:** Vite
    *   A fast, modern build tool for React applications, offering rapid development server startup and optimized builds.
*   **Terminal Emulation:** xterm.js
    *   A powerful, in-browser JavaScript component that provides a fully functional terminal emulator.
*   **Pseudoterminal (pty) Handling:** node-pty
    *   A Node.js library for spawning pseudoterminals, enabling the application to interact with shell processes.
*   **Persistence:** Local JSON files or SQLite
    *   For storing workspace configurations, application settings, and session states.

## Project Structure Overview

The project will follow a standard structure for Electron applications with a React frontend:

```
AgentDeck/
├── public/
├── src/
│   ├── main.ts         # Electron main process
│   ├── preload.ts      # Electron preload script
│   └── renderer/
│       ├── index.tsx     # React app entry point
│       ├── App.tsx       # Main App component
│       ├── components/   # Reusable UI components (e.g., TerminalPane, CommandLauncher)
│       ├── hooks/        # Custom React hooks
│       ├── utils/\      # Utility functions
│       └── styles/       # Global styles and themes
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MVP_PLAN.md
│   └── ROADMAP.md
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Component Interactions

1.  **Main Process (`src/main.ts`):**
    *   Manages the Electron application lifecycle (creating windows, handling events).
    *   Creates the browser window for the React application.
    *   Manages IPC (Inter-Process Communication) channels to communicate with the renderer process.
    *   Handles native Node.js operations, such as spawning shell processes via `node-pty` and file system operations for persistence.

2.  **Preload Script (`src/preload.ts`):**
    *   Acts as a bridge between the main process and the renderer process.
    *   Exposes Node.js APIs and specific functions (e.g., `node-pty` functions, file I/O) to the renderer process securely via `contextBridge`.

3.  **Renderer Process (React App - `src/renderer/`):
    *   **`index.tsx`:** The entry point for the React application, rendering the `App` component.
    *   **`App.tsx`:** The root component that orchestrates the overall layout, including the sidebar, workspace selector, and the main workspace area with terminal panes.
    *   **`WorkspaceSelector.tsx`:** Handles displaying and selecting saved workspaces.
    *   **`CommandLauncher.tsx`:** Contains buttons for predefined commands (npm scripts, AI CLIs, shells) and an input for custom commands.
    *   **`TerminalPane.tsx`:** A reusable component that encapsulates `xterm.js` for rendering terminal output and interacts with `node-pty` (via preload script) to send input and receive output.
    *   **State Management:** React's Context API or a simple state management library (like Zustand or Jotai) can be used for managing application state (e.g., list of open panes, current workspace, command statuses).
    *   **Persistence:** The renderer process will communicate with the main process via IPC to save and load workspace configurations and session states.

## Data Flow Example (Launching a Command)

1.  User clicks an `npm run dev` button in `CommandLauncher.tsx`.
2.  `CommandLauncher.tsx` triggers an IPC message to the main process via the preload script, requesting to spawn a new terminal with the command `npm run dev`.
3.  The **Main Process (`src/main.ts`)** receives the IPC message.
4.  It uses `node-pty` to spawn a new pseudoterminal process (e.g., `powershell.exe` on Windows, with `npm run dev` as an argument).
5.  The main process establishes communication channels between the pseudoterminal and the renderer process.
6.  It sends an IPC message back to the renderer process, providing a new terminal ID and potentially connection details.
7.  The **Renderer Process** receives the message and creates a new `TerminalPane.tsx` component, passing the terminal ID.
8.  `TerminalPane.tsx` initializes an `xterm.js` instance and connects it to the pseudoterminal via the preload script. It displays the terminal output and handles user input, sending it back to the main process via IPC.

## Security Considerations

*   **IPC Sandboxing:** All communication between the main and renderer processes must be carefully managed using Electron's IPC mechanisms (`contextBridge`) to prevent the renderer process from accessing Node.js APIs directly and to validate all incoming data.
*   **Command Execution:** Only explicitly defined or user-typed commands should be executed. Input sanitization is crucial for custom commands to prevent command injection vulnerabilities.
*   **File Access:** File system operations for persistence should be restricted to authorized directories and validated paths.

This architecture provides a robust foundation for AgentDeck, leveraging modern web technologies within the Electron framework to deliver a powerful desktop development experience.