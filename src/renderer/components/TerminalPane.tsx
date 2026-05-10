import React, { useEffect, useRef } from 'react'
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
}

const TerminalPane: React.FC<TerminalPaneProps> = ({
  pid,
  command,
  cwd,
  onClose,
  onWrite,
  onResize,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (!terminalRef.current || initialized.current) return

    initialized.current = true

    terminalInstance.current = new Terminal({
      cursorStyle: 'line',
      cursorBlink: true,
      convertEol: true,
    })
    fitAddon.current = new FitAddon()
    terminalInstance.current.loadAddon(fitAddon.current)
    terminalInstance.current.open(terminalRef.current)

    const handleData = (data: string) => {
      onWrite(pid, data)
    }

    const handleResize = () => {
      if (fitAddon.current && terminalInstance.current) {
        fitAddon.current.fit()
        const dims = terminalInstance.current.proposeDimensions
        if (dims) {
          onResize(pid, dims.cols || 80, dims.rows || 24)
        }
      }
    }

    terminalInstance.current.onData(handleData)

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && terminalInstance.current) {
        fitAddon.current.fit()
        const dims = terminalInstance.current.proposeDimensions
        if (dims) {
          onResize(pid, dims.cols || 80, dims.rows || 24)
        }
      }
    })

    resizeObserver.observe(terminalRef.current)
    fitAddon.current.fit()
    const dims = terminalInstance.current.proposeDimensions
    if (dims) {
      onResize(pid, dims.cols || 80, dims.rows || 24)
    }

    const handlePtyData = (event: Event) => {
      const customEvent = event as CustomEvent<{ pid: number; data: string }>
      if (customEvent.detail.pid === pid && terminalInstance.current) {
        terminalInstance.current.write(customEvent.detail.data)
      }
    }

    const terminalEl = document.getElementById(`terminal-${pid}`)
    if (terminalEl) {
      terminalEl.addEventListener('pty-data', handlePtyData)
    }

    return () => {
      resizeObserver.disconnect()
      if (terminalEl) {
        terminalEl.removeEventListener('pty-data', handlePtyData)
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose()
      }
      initialized.current = false
    }
  }, [pid, onWrite, onResize])

  return (
    <div className="terminal-pane-wrapper">
      <div className="terminal-header">
        <span>{command} (PID: {pid})</span>
        <button onClick={() => onClose(pid)}>X</button>
      </div>
      <div className="terminal-body">
        <div
          id={`terminal-${pid}`}
          ref={terminalRef}
          style={{ width: '100%', height: '300px' }}
        />
      </div>
    </div>
  )
}

export default TerminalPane