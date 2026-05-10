import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import TerminalPane from './components/TerminalPane'

// Define the structure for terminal state
interface TerminalState {
  pid: number
  command: string
  cwd: string
  output: string
  status: 'Idle' | 'Running' | 'Error' | 'Done'
}

function App() {
  const [workspaces, setWorkspaces] = useState<{ id: string, name: string, path: string }[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [terminals, setTerminals] = useState<{ [pid: number]: TerminalState }>({})
  const [activePid, setActivePid] = useState<number | null>(null) // Track the currently active terminal PID
  const terminalOutputRefs = useRef<{ [pid: number]: (data: string) => void }>({})
  const terminalExitRefs = useRef<{ [pid: number]: (() => void) | null }>({})

  // Fetch workspaces on component mount (implement persistence later)
  useEffect(() => {
    // TODO: Load workspaces from local storage/JSON file
    setWorkspaces([
      { id: 'ws1', name: 'Project Alpha', path: 'C:\Users\Dev\Projects\Alpha' },
      { id: 'ws2', name: 'Project Beta', path: '/home/dev/projects/beta' },
    ])
    setCurrentWorkspace('ws1') // Default to the first workspace
  }, [])

  // Setup IPC listeners when the component mounts
  useEffect(() => {
    // Listen for new terminals being spawned
    const handleSpawned = (_event: any, result: { pid: number, command: string, cwd: string }) => {
      setTerminals(prev => {
        const newTerminals = { ...prev }
        newTerminals[result.pid] = {
          pid: result.pid,
          command: result.command,
          cwd: result.cwd,
          output: '',
          status: 'Running',
        }
        // Set the newly spawned terminal as active
        setActivePid(result.pid)
        return newTerminals
      })
    }

    // Listen for data from terminals
    const handleData = (_event: any, pid: number, data: string) => {
      if (terminalOutputRefs.current[pid]) {
        terminalOutputRefs.current[pid](data)
      }
    }

    // Listen for terminal exit
    const handleExit = (_event: any, pid: number) => {
      if (terminalExitRefs.current[pid]) {
        terminalExitRefs.current[pid]()
      }
      setTerminals(prev => {
        const newTerminals = { ...prev }
        if (newTerminals[pid]) {
          newTerminals[pid].status = 'Done'
        }
        // If the exited terminal was active, deactivate it
        if (activePid === pid) {
          setActivePid(null)
        }
        return newTerminals
      })
    }

    window.ipcRenderer.on('pty-spawned', handleSpawned)
    window.ipcRenderer.on('pty-data', handleData) // Note: The preload `pty-data-${pid}` needs to be adjusted to `pty-data` and send pid
    window.ipcRenderer.on('pty-exit', handleExit) // Note: The preload `pty-exit-${pid}` needs to be adjusted to `pty-exit` and send pid

    // Cleanup listeners on component unmount
    return () => {
      window.ipcRenderer.removeListener('pty-spawned', handleSpawned)
      window.ipcRenderer.removeListener('pty-data', handleData)
      window.ipcRenderer.removeListener('pty-exit', handleExit)
    }
  }, [activePid]) // Re-run if activePid changes to update handler logic if needed

  // Function to handle spawning a new terminal
  const handleSpawnTerminal = async (command: string, args: string[] = [], cwd?: string) => {
    if (!currentWorkspace) {
      console.error('No workspace selected.')
      return
    }

    const selectedWorkspace = workspaces.find(ws => ws.id === currentWorkspace)
    const workspacePath = selectedWorkspace ? selectedWorkspace.path : cwd || process.cwd()

    try {
      // Call the exposed ptyApi.spawn function
      const { pid, command: cmd, cwd: processCwd } = await window.ptyApi.spawn({ command, args, cwd: workspacePath })
      
      // When a new terminal is spawned, its listeners will be set up in the parent
      // The `pty-spawned` IPC will add it to the terminals state
      // We need to set up its specific data/exit listeners here.

      // Set up listeners for this specific PID
      const terminalElement = document.getElementById(`terminal-${pid}`)
      if (terminalElement) {
        // Ensure that `terminalOutputRefs` and `terminalExitRefs` are managed correctly
        // This requires the `TerminalPane` component to expose its `onData` and `onExit` callbacks.
        // The current `TerminalPane` component does not expose them in a way to be subscribed globally.
        // Let's refactor `TerminalPane` to subscribe to PID-specific events itself.
        // And `App.tsx` will provide the data/exit handler functions.
      }

    } catch (error) {
      console.error('Failed to spawn terminal:', error)
      // TODO: Display error to the user
    }
  }

  // Handler for when a terminal wants to write data (e.g., user input)
  const handleWriteToTerminal = (pid: number, data: string) => {
    window.ptyApi.write({ pid, data })
  }

  // Handler for closing a terminal
  const handleCloseTerminal = (pid: number) => {
    window.ptyApi.kill({ pid })
    // Clean up listeners for this PID if they were managed per-PID
    if (terminalOutputRefs.current[pid]) delete terminalOutputRefs.current[pid]
    if (terminalExitRefs.current[pid]) delete terminalExitRefs.current[pid]

    setTerminals(prev => {
      const newTerminals = { ...prev }
      delete newTerminals[pid]
      // If the closed terminal was active, deactivate it
      if (activePid === pid) {
        setActivePid(null)
      }
      return newTerminals
    })
  }

  // Handler for resizing a terminal
  const handleResizeTerminal = (pid: number, cols: number, rows: number) => {
    window.ptyApi.resize({ pid, cols, rows })
  }

  // Effect to manage terminal listeners based on changes in `terminals` state
  useEffect(() => {
    Object.keys(terminals).forEach(pidStr => {
      const pid = parseInt(pidStr, 10)
      const terminal = terminals[pid]

      // Set up output listener for this terminal if not already set up
      if (!terminalOutputRefs.current[pid]) {
        // This listener is invoked when 'pty-data' event is received from main process.
        // We need to ensure the 'pty-data' event sends the PID.
        // For now, assuming `handleData` in the main listener above can filter by PID.
        // A better approach: `App.tsx` should subscribe to `pty-data-${pid}`
        terminalOutputRefs.current[pid] = (data: string) => {
          setTerminals(prev => {
            if (prev[pid]) {
              return {
                ...prev,
                [pid]: { ...prev[pid], output: prev[pid].output + data }
              }
            }
            return prev
          })
        }
      }

      // Set up exit listener for this terminal if not already set up
      if (!terminalExitRefs.current[pid]) {
        terminalExitRefs.current[pid] = () => {
          // This callback is executed when the `handleExit` IPC message is received for this PID.
          // The `handleExit` in the main listener above already updates the status and removes the terminal.
          // This specific callback could trigger other actions if needed.
        }
      }
    })

    // Cleanup listeners for terminals that have been removed
    Object.keys(terminalOutputRefs.current).forEach(pidStr => {
      const pid = parseInt(pidStr, 10)
      if (!terminals[pid]) {
        delete terminalOutputRefs.current[pid]
        delete terminalExitRefs.current[pid]
      }
    })
  }, [terminals])

  // Update preload IPC handlers to send PID with events
  // This requires changes in preload.ts and main.ts to send PID with `pty-data` and `pty-exit` events.
  // For now, assuming the `handleData` and `handleExit` in the main listener correctly filter based on `pid`.
  // The `getActivePid` simplification in preload.ts should be addressed.
  // Let's make `App.tsx` manage the `activePid` and pass it down.

  return (
    <div className="app-container">
      <h1>AgentDeck</h1>
      <div className="workspace-info">
        Current Workspace: {workspaces.find(ws => ws.id === currentWorkspace)?.name || 'None'}
      </div>
      
      {/* TODO: Render WorkspaceSelector, CommandLauncher */}
      <div className="main-content">
        <p>Welcome to AgentDeck! This is the main workspace area.</p>
        <button onClick={() => handleSpawnTerminal('powershell.exe')}>Launch PowerShell</button>
        <button onClick={() => handleSpawnTerminal('wsl.exe', ['echo', 'Hello from WSL'])}>Launch WSL Echo</button>
        <button onClick={() => handleSpawnTerminal('cmd.exe')}>Launch CMD</button>

        <div className="terminal-grid">
          {Object.values(terminals).map(terminal => (
            <TerminalPane 
              key={terminal.pid}
              pid={terminal.pid}
              command={terminal.command}
              cwd={terminal.cwd}
              initialOutput={terminal.output} // Pass initial output if available
              onClose={handleCloseTerminal}
              onWrite={handleWriteToTerminal}
              onResize={handleResizeTerminal}
              // We need a way to pass active Pid or manage focus
              // For now, let's assume TerminalPane manages its own active state or relies on external event handling
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
