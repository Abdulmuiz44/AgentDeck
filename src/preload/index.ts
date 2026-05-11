import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../renderer/types';

const api: ElectronAPI = {
  terminal: {
    create: (cwd, command) => ipcRenderer.invoke('terminal:create', cwd, command),
    write: (terminalId, data) => ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId, cols, rows) =>
      ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    kill: (terminalId) => ipcRenderer.invoke('terminal:kill', terminalId),
    onData: (callback) => {
      ipcRenderer.on('terminal:data', (_event, terminalId, data) => {
        callback(terminalId, data);
      });
    },
    onExit: (callback) => {
      ipcRenderer.on('terminal:exit', (_event, terminalId, exitCode) => {
        callback(terminalId, exitCode);
      });
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('terminal:data');
      ipcRenderer.removeAllListeners('terminal:exit');
    },
  },
  workspace: {
    list: () => ipcRenderer.invoke('workspace:list'),
    save: (workspace) => ipcRenderer.invoke('workspace:save', workspace),
    delete: (id) => ipcRenderer.invoke('workspace:delete', id),
  },
  fs: {
    selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),
    readPackageJson: (path) => ipcRenderer.invoke('fs:readPackageJson', path),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
