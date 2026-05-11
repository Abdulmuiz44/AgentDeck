# AgentDeck Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────┐
│              Electron Main Process           │
│                                              │
│  ┌─────────────┐  ┌───────────────────────┐  │
│  │ Window Mgr  │  │    IPC Handlers       │  │
│  └─────────────┘  └───────────┬───────────┘  │
│                               │               │
│  ┌────────────────────────────▼────────────┐  │
│  │         Terminal Manager                │  │
│  │  Map<terminalId, IPty>                  │  │
│  │  - createTerminal(cwd, cmd)             │  │
│  │  - writeToTerminal(id, data)            │  │
│  │  - resizeTerminal(id, cols, rows)       │  │
│  │  - killTerminal(id)                     │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │         Workspace Store                 │  │
│  │  %APPDATA%/AgentDeck/workspaces.json    │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────▼───────────────────────┐
│              Preload Script                   │
│  contextBridge.exposeInMainWorld(             │
│    'electronAPI', {                           │
│      terminal: { create, write, resize, kill, │
│                  onData, onExit },           │
│      workspace: { list, save, delete },       │
│      fs: { selectDirectory, readPackageJson } │
│    }                                          │
│  )                                            │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│              Renderer (React)                 │
│                                               │
│  App.tsx (page router)                        │
│  ├── Welcome.tsx                              │
│  ├── WorkspaceSelector.tsx                    │
│  ├── Workspace.tsx                            │
│  │   ├── Sidebar.tsx                          │
│  │   ├── TerminalGrid.tsx                     │
│  │   │   └── TerminalPane.tsx (xterm.js)     │
│  │   └── CommandLauncher.tsx                  │
│  └── Settings.tsx                             │
└───────────────────────────────────────────────┘
```

## Terminal Data Flow

```
User clicks "npm run dev"
  │
  ▼
CommandLauncher calls onAddPane(newPane)
  │
  ▼
WorkspaceView adds pane to state, TerminalGrid re-renders
  │
  ▼
TerminalPane mounts, calls useTerminal.createTerminal(cwd, "npm run dev")
  │
  ▼
[IPC invoke 'terminal:create']
  │
  ▼
TerminalManager.createTerminal()
  │ spawns node-pty at cwd with powershell -Command "npm run dev"
  │ assigns randomUUID as terminalId
  │
  ▼
Returns terminalId → TerminalPane stores it
  │
  ▼
PTY stdout → ipcRenderer.on('terminal:data') → xterm.write(data)
xterm.onData → ipcRenderer.invoke('terminal:write') → PTY.write(data)
  │
  ▼
PTY exit → ipcRenderer.on('terminal:exit') → StatusBadge shows 'done' or 'error'
```

## Workspace Persistence

```
Save:                                          Load:
Panels change → debounced save                 App opens
  │                                              │
  ▼                                              ▼
ipc: 'workspace:save'                         ipc: 'workspace:list'
  │                                              │
  ▼                                              ▼
workspace-store.ts                            workspace-store.ts
readFile(workspaces.json)                     readFile(workspaces.json)
merge/update workspace                        return sorted workspaces
writeFile(workspaces.json)                      │
                                                 ▼
                                              Welcome.tsx displays list
```

## Key Design Decisions

### JSON over SQLite
- No native build dependencies beyond node-pty
- Single file per workspace store — trivial to inspect and debug
- Sufficient for expected MVP data volume (<100 panes)
- Can migrate to SQLite if needed later

### Plain Vite + Electron (no wrappers)
- Simpler build tooling compared to electron-forge or electron-vite
- Standard `npm run dev` → Vite + Electron concurrently
- Build: `vite build` produces `dist/renderer/`, main/preload compiled by `tsc`

### node-pty in Main Process
- Required: node-pty is a native Node.js addon, cannot run in renderer
- IPC bridge is minimal: terminalId + data strings
- Resize events delegated from renderer to main

### Missing Command Detection
- `check:<command>` prefix triggers a lightweight `where`/`which` check
- If found → "Command available, use launcher to start"
- If missing → shows install instructions in terminal output

## Security Model
- `contextIsolation: true` — renderer cannot access Node.js APIs directly
- `nodeIntegration: false` — no require() in renderer
- `sandbox: false` — required for node-pty (native module)
- All commands are user-initiated via explicit button clicks
- Content Security Policy in index.html restricts script sources

## File Listing

```
src/main/index.ts               Electron app entry
src/main/ipc-handlers.ts        All IPC handle registrations
src/main/terminal-manager.ts    node-pty spawn/resize/kill + check logic
src/main/workspace-store.ts     JSON file read/write
src/preload/index.ts            contextBridge API surface
src/renderer/index.tsx          ReactDOM entry
src/renderer/App.tsx            Page router + state
src/renderer/App.css            Global dark theme CSS
src/renderer/types.ts           TypeScript interfaces
src/renderer/vite-env.d.ts      Vite + Electron type augmentations
src/renderer/hooks/useWorkspace.ts   Workspace CRUD hook
src/renderer/hooks/useTerminal.ts    xterm.js lifecycle hook
src/renderer/pages/Welcome.tsx       Welcome/landing screen
src/renderer/pages/WorkspaceSelector.tsx  New workspace form
src/renderer/pages/Workspace.tsx          Main workspace layout
src/renderer/pages/Settings.tsx           Settings panel
src/renderer/components/Sidebar.tsx        Left nav sidebar
src/renderer/components/TerminalPane.tsx   Single xterm pane
src/renderer/components/TerminalGrid.tsx   Multi-pane grid layout
src/renderer/components/CommandLauncher.tsx Bottom command bar
src/renderer/components/StatusBadge.tsx    Pane status indicator
```
