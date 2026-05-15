export interface PtyProcess {
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(callback: (data: string) => void): void;
  onExit(callback: (event: { exitCode: number; signal?: number }) => void): void;
}

export interface PtySpawnOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  cols: number;
  rows: number;
}

interface NodePtyModule {
  spawn(file: string, args: string[], options: PtySpawnOptions & { name?: string }): PtyProcess;
}

let cached: NodePtyModule | null | undefined;

export function loadNodePty(): NodePtyModule | null {
  if (cached !== undefined) return cached;
  try {
    const req = eval('require') as NodeRequire;
    cached = req('node-pty') as NodePtyModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isPtyAvailable(): boolean {
  return loadNodePty() !== null;
}

export function spawnPty(file: string, args: string[], options: PtySpawnOptions): PtyProcess | null {
  const pty = loadNodePty();
  if (!pty) return null;
  return pty.spawn(file, args, { ...options, name: process.platform === 'win32' ? 'xterm-256color' : 'xterm-color' });
}
