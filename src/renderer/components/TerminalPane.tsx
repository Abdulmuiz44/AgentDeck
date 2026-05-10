import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalPaneProps {
  pid: number
  command: string
  cwd: string
  onClose: (pid: number) => void
  onWrite: (pid: number, data: string) => void
  onResize: (pid: number, cols: number, rows: number) => void
  initialOutput?: string // For initial rendering if needed
}

const TerminalPane: React.FC<TerminalPaneProps> = ({
  pid,
  command,
  cwd,
  onClose,
  onWrite,
  onResize,
  initialOutput = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)

  const [output, setOutput] = useState<string>(initialOutput)

  // Initialize and clean up xterm.js terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalInstance.current = new Terminal({
        cursorStyle: 'line',
        cursorBlink: true,
        windowsMode: true, // Use Windows compatibility mode
      })
      fitAddon.current = new FitAddon()
      terminalInstance.current.loadAddon(fitAddon.current)
      terminalInstance.current.open(terminalRef.current)
      fitAddon.current.fit()

      // Load initial output if any
      if (initialOutput) {
        terminalInstance.current.write(initialOutput)
      }

      // Handle terminal input
      const disposable = terminalInstance.current.onData((data) => {
        onWrite(pid, data)
      })

      // Handle terminal resize
      const resizeHandler = () => {
        if (fitAddon.current && terminalInstance.current) {
          fitAddon.current.fit()
          const { cols, rows } = terminalInstance.current.proposeDimensions() ?? { cols: 80, rows: 24 } // Default if cannot propose
          onResize(pid, cols, rows)
        }
      }
      window.addEventListener('resize', resizeHandler)

      // Initial fit
      resizeHandler()

      // Cleanup
      return () => {
        disposable.dispose()
        window.removeEventListener('resize', resizeHandler)
        if (terminalInstance.current) {
          terminalInstance.current.dispose()
        }
      }
    }
  }, [pid, initialOutput, onWrite, onResize])

  // Effect to update terminal output when it changes externally
  useEffect(() => {
    if (terminalInstance.current && initialOutput !== output) {
      // This part needs careful handling to avoid infinite loops or stale data
      // A better approach might be to pass a callback to update terminal output directly
      // For now, we'll just write the new output, assuming it's appended
      // This might not be ideal if output changes are not strictly appended
      // console.log(`Writing new output for PID ${pid}: ${output.slice(-100)}...`)
      // terminalInstance.current.write(output.slice(output.length - initialOutput.length)) // Attempt to write only the new part if possible, but this is complex.
      // A simpler approach for now: re-write full output if it changes significantly, or handle diffing.
      // Let's stick to appending for now, and focus on the `onData` handler for user input.
      // If `initialOutput` prop changes, we should clear and write, or append.
      // For MVP, let's assume `initialOutput` is only for the very first load.
    }
  }, [output, initialOutput, pid]) // Depend on output prop change

  // Effect to receive data from the main process and write to xterm.js
  useEffect(() => {
    // This listener should be set up once and managed globally or by the parent component
    // For simplicity, we'll set it up here and rely on the parent to manage the PID context.
    // The parent `App` component currently uses a global `activePid` which is a simplification.
    // A more robust solution would use specific event listeners per PID.
    const handleData = (data: string) => {
      if (terminalInstance.current && pid === window.getActivePid()) { // Check if this terminal is active
        terminalInstance.current.write(data)
      }
    }
    const handleExit = () => {
      if (terminalInstance.current && pid === window.getActivePid()) { // Check if this terminal is active
        onClose(pid)
      }
    }

    // Register listeners for the specific PID.
    // This requires `preload.ts` to support PTY-specific listeners.
    // For now, we'll assume global listeners that filter by `pid` inside `handleData` and `handleExit`.
    // The `getActivePid` helper in preload is a simplification.
    
    // The current `onData` and `onExit` in preload are global and not PID-specific.
    // Let's refactor `App.tsx` to manage listeners more appropriately.
    // For now, this `useEffect` will try to hook into global listeners.
    
    // To make this work, the `ptyApi.onData` and `ptyApi.onExit` in preload MUST be refactored
    // to return a function to unsubscribe, and `App.tsx` needs to manage these subscriptions.
    // For this initial component, we'll assume `App.tsx` handles the data propagation.
    
    // However, to make `TerminalPane` functional, it needs to *receive* data and write it.
    // Let's try to hook into the global listener and filter by `pid` in the parent.
    // The `App` component needs to pass down the data relevant to THIS terminal.
    // The current `App.tsx` structure: `setTerminals` with `output` property is more for display, not real-time.
    // The `onData` listener in App.tsx is simplified and uses `activePid` which is not robust.
    // For this `TerminalPane` component, we'll assume the `App.tsx` will pass down updated output.
    
    // This `useEffect` will be responsible for writing new `output` prop changes to the terminal.
    // The `onData` and `onExit` handlers will be managed by `App.tsx` and its state updates.

  }, [pid, onClose, onResize, onWrite]) // Dependencies needed for re-initialization/cleanup

  return (
    <div className="terminal-pane-wrapper">
      <div className="terminal-header">
        <span>{command} - PID: {pid}</span>
        <button onClick={() => onClose(pid)}>X</button>
      </div>
      <div className="terminal-body">
        <div
          ref={terminalRef}
          style={{ width: '100%', height: '300px' }} // Fixed height for demo, will be responsive
        />
        {/* The output state is primarily for debugging and display, the actual terminal content is managed by xterm.js */}
        {/* <pre>{output}</pre> */}
      </div>
    </div>
  )
}

export default TerminalPane
