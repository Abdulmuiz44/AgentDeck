declare module 'electron' {
  export interface IpcMainInvokeEvent { sender: { send(channel: string, ...args: unknown[]): void } }
  export const ipcMain: { handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown): void };
  export const ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<any>;
    send(channel: string, ...args: unknown[]): void;
    on(channel: string, listener: (event: unknown, ...args: any[]) => void): void;
    removeAllListeners(channel: string): void;
  };
  export const contextBridge: { exposeInMainWorld(apiKey: string, api: unknown): void };
  export const dialog: { showOpenDialog(options: unknown): Promise<{ canceled: boolean; filePaths: string[] }> };
  export const app: any;
  export const BrowserWindow: any;
  export const Menu: any;
  export const nativeImage: any;
  export const shell: any;
  export const Tray: any;
}
