import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import { spawnPty, type PtyProcess } from './agentdeck/pty-adapter';

interface TerminalProcess {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

const terminals = new Map<string, TerminalProcess>();

function getShell(): string {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function getShellArgs(command: string): { shell: string; args: string[] } {
  const isWindows = process.platform === 'win32';
  if (command.startsWith('wsl ')) {
    return { shell: 'wsl.exe', args: [] };
  }
  if (isWindows) {
    return {
      shell: 'powershell.exe',
      args: ['-NoLogo', '-NoExit', '-Command', command],
    };
  }
  return { shell: getShell(), args: ['-c', command] };
}

export function createTerminal(
  cwd: string,
  command: string,
  onData: (terminalId: string, data: string) => void,
  onExit: (terminalId: string, exitCode: number) => void
): string {
  const terminalId = randomUUID();

  if (command.startsWith('check:')) {
    spawnCheckTerminal(terminalId, command, onData, onExit);
    return terminalId;
  }

  const { shell, args } = getShellArgs(command);
  const options = {
    cwd: cwd || process.cwd(),
    cols: 80,
    rows: 24,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
  };
  const pty = spawnPty(shell, args, options);
  if (pty) {
    wirePty(terminalId, pty, onData, onExit);
    return terminalId;
  }

  onData(terminalId, '\r\n[AgentDeck] node-pty is unavailable; using process-mode terminal fallback. Interactive behavior may be limited.\r\n');
  const child = spawn(shell, args, { cwd: options.cwd, env: options.env, shell: false, windowsHide: true });
  wireChild(terminalId, child, onData, onExit);
  return terminalId;
}

function wirePty(terminalId: string, pty: PtyProcess, onData: (terminalId: string, data: string) => void, onExit: (terminalId: string, exitCode: number) => void): void {
  pty.onData((data: string) => onData(terminalId, data));
  pty.onExit(({ exitCode }: { exitCode: number }) => {
    terminals.delete(terminalId);
    onExit(terminalId, exitCode);
  });
  terminals.set(terminalId, pty);
}

function wireChild(terminalId: string, child: ChildProcessWithoutNullStreams, onData: (terminalId: string, data: string) => void, onExit: (terminalId: string, exitCode: number) => void): void {
  child.stdout.on('data', (data: Buffer) => onData(terminalId, data.toString()));
  child.stderr.on('data', (data: Buffer) => onData(terminalId, data.toString()));
  child.on('exit', (code) => {
    terminals.delete(terminalId);
    onExit(terminalId, code ?? 0);
  });
  child.on('error', (error) => {
    terminals.delete(terminalId);
    onData(terminalId, `\r\n[AgentDeck] terminal failed: ${error.message}\r\n`);
    onExit(terminalId, 1);
  });
  terminals.set(terminalId, {
    write(data: string) { child.stdin.write(data); },
    resize() {},
    kill() { child.kill(process.platform === 'win32' ? undefined : 'SIGTERM'); },
  });
}

function spawnCheckTerminal(
  terminalId: string,
  command: string,
  onData: (terminalId: string, data: string) => void,
  onExit: (terminalId: string, exitCode: number) => void
): void {
  const checkTarget = command.replace('check:', '').trim();
  const showHelp = (msg: string) => {
    onData(terminalId, `\r\n\x1b[33m${msg}\x1b[0m\r\n`);
  };

  try {
    const isWindows = process.platform === 'win32';
    const child = spawn(
      isWindows ? 'cmd.exe' : '/bin/sh',
      isWindows
        ? ['/c', `where ${checkTarget} 2>nul || echo NOT_FOUND`]
        : ['-c', `which ${checkTarget} 2>/dev/null || echo NOT_FOUND`],
      { windowsHide: true }
    );

    let output = '';
    child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { output += data.toString(); });
    child.on('exit', () => {
      if (output.includes('NOT_FOUND')) {
        showHelp(`Command '${checkTarget}' not found. Install it first or check your PATH.`);
        onExit(terminalId, 1);
      } else {
        showHelp(`Command '${checkTarget}' is available. Use command launcher to start it.`);
        onExit(terminalId, 0);
      }
      terminals.delete(terminalId);
    });
  } catch {
    showHelp(`Unable to verify command '${checkTarget}'. It may not be installed.`);
    onExit(terminalId, 1);
  }

  terminals.set(terminalId, { write() {}, resize() {}, kill() { terminals.delete(terminalId); } });
}

export function writeToTerminal(terminalId: string, data: string): void {
  terminals.get(terminalId)?.write(data);
}

export function resizeTerminal(terminalId: string, cols: number, rows: number): void {
  terminals.get(terminalId)?.resize(cols, rows);
}

export function killTerminal(terminalId: string): void {
  terminals.get(terminalId)?.kill();
  terminals.delete(terminalId);
}
