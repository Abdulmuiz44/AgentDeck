# Roadmap for AgentDeck

This document outlines the future development phases and planned features for AgentDeck beyond the initial MVP.

## Current Phase (MVP)

The MVP focuses on establishing the core functionality for a single-user desktop workspace for managing development tools and AI agents. This includes workspace creation, basic terminal pane management, and integration with common development commands and AI CLIs.

## Phase 2: Enhancements & Polish

This phase will focus on refining the MVP features, improving usability, and adding essential functionalities for a more robust development experience.

### Key Features Planned:

1.  **Advanced Command Management:**
    *   **Customizable Commands:** Allow users to define and save their own custom commands with aliases, arguments, and working directories.
    *   **Environment Variables:** Support for defining and managing environment variables per workspace or per command.
2.  **Enhanced Persistence:**
    *   **Full Session Restore:** Save and restore the exact layout, state, and history of all open terminal panes.
    *   **Project-specific Settings:** Store more granular settings related to specific projects or workspaces.
3.  **Improved UI/UX:**
    *   **Themes and Customization:** More theme options, including user-customizable color schemes and font settings.
    *   **Drag-and-Drop Layout:** Allow users to resize and rearrange terminal panes more fluidly.
    *   **Tabbed Panes:** Option to group multiple terminal sessions within a single tabbed pane.
    *   **Search Functionality:** In-app search for commands, workspaces, and potentially project files (integration with IDE search capabilities).
4.  **AI Agent Integration:**
    *   **Configuration:** Easier setup and configuration for different AI agents (API keys, model selection).
    *   **Multi-Agent Orchestration:** Basic capabilities to run multiple AI agents concurrently on different tasks, or to chain commands between them.
5.  **Status Indicators:**
    *   More detailed and informative status indicators for running processes (e.g., CPU/memory usage, network activity).
    *   Notifications for process completion or errors.

## Phase 3: Advanced Features & Extensibility

This phase will introduce more advanced capabilities, aiming to make AgentDeck a comprehensive development hub and an extensible platform.

### Key Features Planned:

1.  **Multi-User & Collaboration:**
    *   **Shared Workspaces:** Enable teams to collaborate on workspaces, sharing terminal sessions and project configurations in real-time.
    *   **Remote Development:** Support for connecting to remote development environments (e.g., via SSH) and managing them within AgentDeck.

2.  **Deep Project Integration:**
    *   **Code Editor Integration:** Potential for embedding or tightly integrating with popular code editors (e.g., VS Code extensions).
    *   **Intelligent Automation:** Features like automated build/test triggers based on file changes, AI-assisted code generation workflows.

3.  **Extensibility:**
    *   **Plugin System:** Allow third-party developers to create plugins to add new agents, tools, or custom features to AgentDeck.
    *   **API for External Tools:** Provide an API for other applications to interact with AgentDeck.

4.  **Cross-Platform Support:**
    *   Full native support for macOS and Linux, ensuring a consistent experience across major operating systems.

## Technology Considerations for Future Phases

*   **Database:** Explore more robust database solutions for managing complex project data and user configurations (e.g., PostgreSQL, MongoDB) if SQLite becomes a bottleneck.
*   **State Management:** Evaluate more advanced state management solutions if the application complexity outgrows React's Context API or simpler libraries.
*   **Inter-Process Communication:** Potentially explore more sophisticated IPC mechanisms for high-throughput or complex inter-process communication needs.

This roadmap provides a strategic direction for AgentDeck's evolution, from a focused MVP to a feature-rich, extensible development workspace.