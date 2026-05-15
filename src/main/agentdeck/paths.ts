import { homedir } from 'os';
import { join } from 'path';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3768;

export interface DataDirOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export function resolveDataDir(options: DataDirOptions = {}): string {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const home = options.homeDir || homedir();
  if (env.AGENTDECK_DATA_DIR) return env.AGENTDECK_DATA_DIR;
  if (platform === 'win32') {
    const appData = env.APPDATA || join(home, 'AppData', 'Roaming');
    return join(appData, 'AgentDeck');
  }
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'AgentDeck');
  }
  return join(env.XDG_CONFIG_HOME || join(home, '.config'), 'agentdeck');
}

export function getDataDir(): string {
  return resolveDataDir();
}

export function getStorePath(): string {
  return join(getDataDir(), 'agentdeck.json');
}

export function getLogsDir(): string {
  return join(getDataDir(), 'logs');
}

export function expandHome(input: string): string {
  if (input === '~') return homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) return join(homedir(), input.slice(2));
  return input;
}
