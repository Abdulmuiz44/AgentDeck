export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  panes: Pane[];
  lastOpened: string;
}

export interface Pane {
  id: string;
  terminalId: string;
  command: string;
  label: string;
  status: PaneStatus;
}

export type PaneStatus = 'idle' | 'running' | 'waiting' | 'error' | 'done';

export interface AgentCommand {
  id: string;
  label: string;
  command: string;
  check: string;
  help: string;
}

export interface ElectronAPI {
  terminal: {
    create(cwd: string, command: string): Promise<string>;
    write(terminalId: string, data: string): Promise<void>;
    resize(terminalId: string, cols: number, rows: number): Promise<void>;
    kill(terminalId: string): Promise<void>;
    onData(callback: (terminalId: string, data: string) => void): void;
    onExit(callback: (terminalId: string, exitCode: number) => void): void;
    removeAllListeners(): void;
  };
  workspace: {
    list(): Promise<Workspace[]>;
    save(workspace: Workspace): Promise<void>;
    delete(id: string): Promise<void>;
  };
  fs: {
    selectDirectory(): Promise<string | null>;
    readPackageJson(path: string): Promise<Record<string, unknown> | null>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
