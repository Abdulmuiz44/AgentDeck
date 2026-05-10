import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import * as os from 'os'
import { spawn, IPty } from 'node-pty'

let mainWindow: BrowserWindow | null
const ptyProcesses: Map<number, IPty> = new Map()

function getPtyProcess(pid: number) {
  return ptyProcesses.get(pid)
}

function removePtyProcess(pid: number) {
  ptyProcesses.delete(pid)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development' && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('window-all-closed', () => {
  if (os.platform() !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  createWindow()

  ipcMain.on('pty-spawn', (event, { command, args = [], cwd = os.homedir() }) => {
    try {
      const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
      const execCommand = os.platform() === 'win32' ? command : (command.startsWith('/') ? command : `/${command}`)
      const spawnArgs = os.platform() === 'win32' ? ['-Command', command, ...args] : args

      const ptyProcess = spawn(os.platform() === 'win32' ? shell : execCommand, spawnArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: cwd,
        env: process.env as Record<string, string | undefined>,
      })

      const pid = ptyProcess.pid

      ptyProcess.onData((data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty-data', pid, data)
        }
      })

      ptyProcess.onExit(({ exitCode }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty-exit', pid, exitCode)
        }
        removePtyProcess(pid)
      })

      ptyProcesses.set(pid, ptyProcess)
      event.reply('pty-spawned', { pid, command, cwd })
    } catch (error: any) {
      event.reply('pty-spawned', { error: error.message || 'Failed to spawn terminal' })
    }
  })

  ipcMain.on('pty-write', (_event, { pid, data }) => {
    const ptyProcess = getPtyProcess(pid)
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  ipcMain.on('pty-resize', (_event, { pid, cols, rows }) => {
    const ptyProcess = getPtyProcess(pid)
    if (ptyProcess) {
      ptyProcess.resize(cols, rows)
    }
  })

  ipcMain.on('pty-kill', (_event, { pid }) => {
    const ptyProcess = getPtyProcess(pid)
    if (ptyProcess) {
      ptyProcess.kill()
      removePtyProcess(pid)
    }
  })
})