import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3768;

export interface DataDirOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export function envValue(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const talocode = env[`TALOCODE_${name}`];
  if (talocode) return talocode;
  return env[`AGENTDECK_${name}`];
}

export function resolveDataDir(options: DataDirOptions = {}): string {
  const env = options.env || process.env;
  const explicit = envValue('DATA_DIR', env);
  if (explicit) return explicit;
  return defaultTalocodeDataDir(options);
}

export function defaultTalocodeDataDir(options: DataDirOptions = {}): string {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const home = options.homeDir || homedir();
  if (platform === 'win32') {
    const appData = env.APPDATA || join(home, 'AppData', 'Roaming');
    return join(appData, 'Talocode');
  }
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Talocode');
  }
  return join(env.XDG_CONFIG_HOME || join(home, '.config'), 'talocode');
}

export function defaultLegacyAgentDeckDataDir(options: DataDirOptions = {}): string {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const home = options.homeDir || homedir();
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
  return join(getDataDir(), 'talocode.json');
}

export function getLogsDir(): string {
  return join(getDataDir(), 'logs');
}

export function prepareDataDirMigration(options: DataDirOptions = {}): void {
  const env = options.env || process.env;
  if (env.TALOCODE_DATA_DIR || env.AGENTDECK_DATA_DIR) return;
  const next = defaultTalocodeDataDir(options);
  const legacy = defaultLegacyAgentDeckDataDir(options);
  if (existsSync(next) || !existsSync(legacy)) return;

  mkdirSync(next, { recursive: true });
  for (const entry of readdirSync(legacy)) {
    if (!entry.endsWith('.json')) continue;
    const source = join(legacy, entry);
    if (!statSync(source).isFile()) continue;
    const target = join(next, entry === 'agentdeck.json' ? 'talocode.json' : entry.replace(/agentdeck/gi, 'talocode'));
    if (!existsSync(target)) copyFileSync(source, target);
  }
}

export function expandHome(input: string): string {
  if (input === '~') return homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) return join(homedir(), input.slice(2));
  return input;
}
