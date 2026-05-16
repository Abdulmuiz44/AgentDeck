import { app, Menu, nativeImage, shell, Tray, BrowserWindow } from 'electron';
import { getDataDir, getLogsDir } from './talocode/paths';
import type { TalocodeDaemon } from './talocode/daemon-server';

let tray: any = null;

export function createTalocodeTray(getDaemon: () => TalocodeDaemon | null, controls: { start(): Promise<void>; stop(): Promise<void>; restart(): Promise<void>; openWindow(): void }): void {
  try {
    const image = nativeImage.createEmpty();
    tray = new Tray(image);
    tray.setToolTip('Talocode');
    const refresh = () => {
      const daemon = getDaemon();
      const running = Boolean(daemon);
      tray?.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Talocode', click: controls.openWindow },
        { label: running ? 'Daemon running' : 'Daemon stopped', enabled: false },
        { label: 'Start daemon', enabled: !running, click: () => void controls.start() },
        { label: 'Stop daemon', enabled: running, click: () => void controls.stop().then(refresh) },
        { label: 'Restart daemon', click: () => void controls.restart().then(refresh) },
        { type: 'separator' },
        { label: 'Open logs folder', click: () => void shell.openPath(getLogsDir()) },
        { label: 'Open data folder', click: () => void shell.openPath(getDataDir()) },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ]));
    };
    tray.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.show();
      else controls.openWindow();
    });
    refresh();
  } catch (error) {
    console.warn('Talocode tray unavailable:', error);
  }
}

export function destroyTalocodeTray(): void {
  tray?.destroy();
  tray = null;
}
