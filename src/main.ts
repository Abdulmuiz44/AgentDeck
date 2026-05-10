import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { spawn } from 'node-pty'
import os from 'os'

let mainWindow: BrowserWindow | null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false, // Disable nodeIntegration for security
    },
  })

  // Load the index.html from the Vite dev server or from the build output
  if (process.env.NODE_ENV === 'development' && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Open the DevTools automatically if in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (os.platform() !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS, re-create a window when the dock icon is clicked and no other windows are open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Create the window when the app is ready
app.whenReady().then(() => {
  createWindow()

  // Handle IPC messages for spawning terminals
  ipcMain.on('pty-spawn', async (event, { command, args = [], cwd = process.cwd() }) => {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
    const ptyProcess = spawn(shell, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: cwd,
      env: process.env as Record<string, string | undefined>,
    })

    const pid = ptyProcess.pid

    // Forward data from pty to renderer
    ptyProcess.onData((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('pty-data', pid, data)
      }
    })

    // Forward exit signal from pty to renderer
    ptyProcess.onExit(() => {
      if (mainWindow) {
        mainWindow.webContents.send('pty-exit', pid)
      }
    })

    // Reply with the PID to the renderer process so it can manage the terminal
    event.reply('pty-spawned', { pid, command, cwd })

    // Store the ptyProcess
    ptyProcesses.set(pid, ptyProcess)
  })

  // Handle IPC messages for sending data to pty
  ipcMain.on('pty-write', (event, { pid, data }) => {
    const ptyProcess = getPtyProcess(pid)
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  // Handle IPC messages for resizing pty
  ipcMain.on('pty-resize', (event, { pid, cols, rows }) => {
    const ptyProcess = getPtyProcess(pid)
    if (ptyProcess) {
      ptyProcess.resize(cols, rows)
    }
  })

  // Handle IPC messages for killing pty
  ipcMain.on('pty-kill', (event, { pid }) => {
    const ptyProcess = getPtyProcess(pid)
    if (ptyProcess) {
      ptyProcess.kill()
      removePtyProcess(pid)
    }
  })
})

// Simple map to store PTY processes
const ptyProcesses: Map<number, import('node-pty').IPty> = new Map()

function getPtyProcess(pid: number) {
  return ptyProcesses.get(pid)
}

function removePtyProcess(pid: number) {
  ptyProcesses.delete(pid)
}
