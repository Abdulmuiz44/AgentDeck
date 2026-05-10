import React, { useState, useEffect, useRef, useCallback } from 'react'
import TerminalPane from './components/TerminalPane'

interface TerminalState {
  pid: number
  command: string
  cwd: string
  status: 'Idle' | 'Running' | 'Error' | 'Done'
}

function App() {
  const [workspaces] = useState<{ id: string, name: string, path: string }[]>([
    { id: 'ws1', name: 'Project Alpha', path: '/home/user/projects/alpha' },
  ])
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('ws1')
  const [terminals, setTerminals] = useState<{ [pid: number]: TerminalState }>({})
  const [activePid, setActivePid] = useState<number | null>(null)

  const pendingOutputRef = useRef<{ [pid: number]: string[] }>({})
  const cleanupFnsRef = useRef<{ [pid: number]: () => void }>({})

  const handleSpawnTerminal = useCallback(async (command: string, args: string[] = [], cwd?: string) => {
    if (!currentWorkspace) {
      console.error('No workspace selected.')
      return
    }

    const selectedWorkspace = workspaces.find(ws => ws.id === currentWorkspace)
    const workspacePath = cwd || selectedWorkspace?.path || process.cwd()

    try {
      const result = await window.ptyApi.spawn({ command, args, cwd: workspacePath })
      const { pid, command: cmd, cwd: processCwd } = result

      setTerminals(prev => ({
        ...prev,
        [pid]: { pid, command: cmd, cwd: processCwd, status: 'Running' }
      }))
      setActivePid(pid)

      pendingOutputRef.current[pid] = []

      const cleanupData = window.ptyApi.onTerminalData(pid, (data) => {
        const pane = document.getElementById(`terminal-${pid}`)
        if (pane) {
          const event = new CustomEvent('pty-data', { detail: { pid, data } })
          pane.dispatchEvent(event)
        }
      })

      const cleanupExit = window.ptyApi.onTerminalExit(pid, () => {
        setTerminals(prev => {
          const newTerminals = { ...prev }
          if (newTerminals[pid]) {
            newTerminals[pid].status = 'Done'
          }
          return newTerminals
        })
        if (activePid === pid) {
          setActivePid(null)
        }
        cleanupFnsRef.current[pid]?.()
        delete cleanupFnsRef.current[pid]
      })

      cleanupFnsRef.current[pid] = () => {
        cleanupData()
        cleanupExit()
        delete pendingOutputRef.current[pid]
      }
    } catch (error) {
      console.error('Failed to spawn terminal:', error)
    }
  }, [currentWorkspace, workspaces, activePid])

  const handleWriteToTerminal = (pid: number, data: string) => {
    window.ptyApi.write({ pid, data })
  }

  const handleCloseTerminal = (pid: number) => {
    window.ptyApi.kill({ pid })
    cleanupFnsRef.current[pid]?.()
    delete cleanupFnsRef.current[pid]
    delete pendingOutputRef.current[pid]

    setTerminals(prev => {
      const newTerminals = { ...prev }
      delete newTerminals[pid]
      return newTerminals
    })

    if (activePid === pid) {
      setActivePid(null)
    }
  }

  const handleResizeTerminal = (pid: number, cols: number, rows: number) => {
    window.ptyApi.resize({ pid, cols, rows })
  }

  useEffect(() => {
    return () => {
      Object.values(cleanupFnsRef.current).forEach(fn => fn())
    }
  }, [])

  return (
    <div className="app-container">
      <h1>AgentDeck</h1>
      <div className="workspace-info">
        Current Workspace: {workspaces.find(ws => ws.id === currentWorkspace)?.name || 'None'}
      </div>
      
      <div className="main-content">
        <p>Welcome to AgentDeck! This is the main workspace area.</p>
        <button onClick={() => handleSpawnTerminal('bash')}>Launch Bash</button>
        <button onClick={() => handleSpawnTerminal('ls', ['-la'])}>Run ls -la</button>

        <div className="terminal-grid">
          {Object.values(terminals).map(terminal => (
            <TerminalPane 
              key={terminal.pid}
              pid={terminal.pid}
              command={terminal.command}
              cwd={terminal.cwd}
              onClose={handleCloseTerminal}
              onWrite={handleWriteToTerminal}
              onResize={handleResizeTerminal}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default App