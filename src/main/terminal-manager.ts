import { spawn, IPty } from 'node-pty';
import { randomUUID } from 'crypto';

const terminals = new Map<string, IPty>();

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

  const pty = spawn(shell, args, {
    cwd: cwd || process.cwd(),
    cols: 80,
    rows: 24,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
    handleFlowControl: true,
  });

  pty.onData((data: string) => {
    onData(terminalId, data);
  });

  pty.onExit(({ exitCode }: { exitCode: number }) => {
    terminals.delete(terminalId);
    onExit(terminalId, exitCode);
  });

  terminals.set(terminalId, pty);
  return terminalId;
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
    const checkCmd = isWindows ? 'where' : 'which';
    const child = spawn(
      isWindows ? 'cmd.exe' : '/bin/sh',
      isWindows
        ? ['/c', `where ${checkTarget} 2>nul || echo NOT_FOUND`]
        : ['-c', `which ${checkTarget} 2>/dev/null || echo NOT_FOUND`],
      {
        cols: 80,
        rows: 5,
      }
    );

    let output = '';
    child.onData((data: string) => {
      output += data;
    });

    child.onExit(() => {
      if (output.includes('NOT_FOUND')) {
        showHelp(`Command '${checkTarget}' not found. Install it first or check your PATH.`);
        onExit(terminalId, 1);
      } else {
        showHelp(`Command '${checkTarget}' is available. Use command launcher to start it.`);
        onExit(terminalId, 0);
      }
    });
  } catch {
    showHelp(`Unable to verify command '${checkTarget}'. It may not be installed.`);
    onExit(terminalId, 1);
  }

  terminals.set(terminalId, null as unknown as IPty);
}

export function writeToTerminal(terminalId: string, data: string): void {
  const pty = terminals.get(terminalId);
  if (pty) {
    pty.write(data);
  }
}

export function resizeTerminal(terminalId: string, cols: number, rows: number): void {
  const pty = terminals.get(terminalId);
  if (pty) {
    pty.resize(cols, rows);
  }
}

export function killTerminal(terminalId: string): void {
  const pty = terminals.get(terminalId);
  if (pty) {
    pty.kill();
    terminals.delete(terminalId);
  }
}
