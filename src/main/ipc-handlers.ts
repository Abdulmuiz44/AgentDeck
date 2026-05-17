import { ipcMain, dialog, shell } from 'electron';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { listWorkspaces, saveWorkspace, deleteWorkspace } from './workspace-store';
import {
  createTerminal,
  writeToTerminal,
  resizeTerminal,
  killTerminal,
} from './terminal-manager';

export function registerIpcHandlers(): void {
  ipcMain.handle('workspace:list', async () => {
    return listWorkspaces();
  });

  ipcMain.handle('workspace:save', async (_event, workspace) => {
    await saveWorkspace(workspace);
  });

  ipcMain.handle('workspace:delete', async (_event, id: string) => {
    await deleteWorkspace(id);
  });

  ipcMain.handle('fs:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('fs:readPackageJson', async (_event, dirPath: string) => {
    try {
      const raw = await readFile(join(dirPath, 'package.json'), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  ipcMain.handle('terminal:create', (event, cwd: string, command: string) => {
    const webContents = event.sender;

    const onData = (terminalId: string, data: string) => {
      webContents.send('terminal:data', terminalId, data);
    };

    const onExit = (terminalId: string, exitCode: number) => {
      webContents.send('terminal:exit', terminalId, exitCode);
    };

    return createTerminal(cwd, command, onData, onExit);
  });

  ipcMain.handle('terminal:write', (_event, terminalId: string, data: string) => {
    writeToTerminal(terminalId, data);
  });

  ipcMain.handle('terminal:resize', (_event, terminalId: string, cols: number, rows: number) => {
    resizeTerminal(terminalId, cols, rows);
  });

  ipcMain.handle('terminal:kill', (_event, terminalId: string) => {
    killTerminal(terminalId);
  });

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
