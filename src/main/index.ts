import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { AgentDeckDaemon } from './agentdeck/daemon-server';
import { createAgentDeckTray, destroyAgentDeckTray } from './tray';

const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'AgentDeck',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

let daemon: AgentDeckDaemon | null = null;

async function startDaemon(): Promise<void> {
  if (daemon) return;
  daemon = new AgentDeckDaemon({ staticDir: join(__dirname, '../renderer') });
  await daemon.start();
}

async function stopDaemon(): Promise<void> {
  const current = daemon;
  daemon = null;
  await current?.stop();
}

async function restartDaemon(): Promise<void> {
  await stopDaemon();
  await startDaemon();
}

function openMainWindow(): void {
  const existing = BrowserWindow.getAllWindows()[0];
  if (existing) { existing.show(); existing.focus(); return; }
  createWindow();
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  try {
    await startDaemon();
  } catch (error) {
    console.warn('AgentDeck daemon did not start from Electron:', error);
  }
  createWindow();
  createAgentDeckTray(() => daemon, { start: startDaemon, stop: stopDaemon, restart: restartDaemon, openWindow: openMainWindow });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async (event: { preventDefault(): void }) => {
  if (!daemon) return;
  event.preventDefault();
  destroyAgentDeckTray();
  await stopDaemon().catch((error) => console.warn('AgentDeck daemon did not stop cleanly:', error));
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
