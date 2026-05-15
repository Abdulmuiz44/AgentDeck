import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';

const execFileAsync = promisify(execFile);
const SERVICE_NAME = 'AgentDeck';

export async function runServiceCommand(action: string | undefined): Promise<unknown> {
  if (process.platform !== 'win32') {
    return { ok: false, supported: false, message: 'AgentDeck Windows service commands are only supported on Windows.' };
  }
  switch (action) {
    case 'install': return installService();
    case 'uninstall': return sc(['delete', SERVICE_NAME]);
    case 'start': return sc(['start', SERVICE_NAME]);
    case 'stop': return sc(['stop', SERVICE_NAME]);
    case 'status': return sc(['query', SERVICE_NAME]);
    default: return { ok: false, message: 'Usage: agentdeck service install|uninstall|start|stop|status' };
  }
}

async function installService(): Promise<unknown> {
  const node = process.execPath;
  const cli = resolve(__dirname, 'index.js');
  const binPath = `\"${node}\" \"${cli}\" start`;
  return sc(['create', SERVICE_NAME, `binPath=`, binPath, 'start=', 'auto', 'DisplayName=', 'AgentDeck']);
}

async function sc(args: string[]): Promise<unknown> {
  try {
    const { stdout, stderr } = await execFileAsync('sc.exe', args, { windowsHide: true });
    return { ok: true, command: `sc.exe ${args.join(' ')}`, output: stdout || stderr };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const adminHint = /access is denied|requires elevation/i.test(message) ? 'Run your terminal as Administrator and try again.' : undefined;
    return { ok: false, command: `sc.exe ${args.join(' ')}`, message, adminHint };
  }
}
