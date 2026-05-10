import { contextBridge, ipcRenderer } from 'electron'

// Define the types for the IPC exposed functions
interface PTYAPI {
  spawn: (options: { command: string, args?: string[], cwd?: string }) => Promise<{ pid: number, command: string, cwd: string }>,
  write: (options: { pid: number, data: string }) => void,
  resize: (options: { pid: number, cols: number, rows: number }) => void,
  kill: (options: { pid: number }) => void,
  onTerminalData: (pid: number, callback: (data: string) => void) => () => void,
  onTerminalExit: (pid: number, callback: () => void) => () => void,
}

const ptyApi: PTYAPI = {
  spawn: (options) => {
    return new Promise((resolve) => {
      ipcRenderer.send('pty-spawn', options)
      ipcRenderer.once('pty-spawned', (_event, result) => {
        resolve(result)
      })
    })
  },
  write: (options) => {
    ipcRenderer.send('pty-write', options)
  },
  resize: (options) => {
    ipcRenderer.send('pty-resize', options)
  },
  kill: (options) => {
    ipcRenderer.send('pty-kill', options)
  },
  onTerminalData: (pid, callback) => {
    const handler = (_event: any, receivedPid: number, data: string) => {
      if (receivedPid === pid) {
        callback(data)
      }
    }
    ipcRenderer.on('pty-data', handler)
    return () => {
      ipcRenderer.removeListener('pty-data', handler)
    }
  },
  onTerminalExit: (pid, callback) => {
    const handler = (_event: any, receivedPid: number) => {
      if (receivedPid === pid) {
        callback()
      }
    }
    ipcRenderer.on('pty-exit', handler)
    return () => {
      ipcRenderer.removeListener('pty-exit', handler)
    }
  },
}

contextBridge.exposeInMainWorld('ptyApi', ptyApi)
