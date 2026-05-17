import { join } from 'path';
import { getDataDir } from './paths';
import type { BrowserRuntimeConfig } from './types';

export function resolveBrowserRuntimeConfig(env: NodeJS.ProcessEnv = process.env): BrowserRuntimeConfig {
  const dataDir = join(getDataDir(), 'browser-runtime');

  return {
    enabled: env.TALOCODE_BROWSER_RUNTIME_ENABLED !== 'false',
    maxRunningSessions: parseInt(env.TALOCODE_BROWSER_MAX_SESSIONS || '3', 10) || 3,
    defaultHeadless: env.TALOCODE_BROWSER_HEADLESS === 'true',
    browserChannel: env.TALOCODE_BROWSER_CHANNEL || undefined,
    slowMo: env.TALOCODE_BROWSER_SLOWMO ? parseInt(env.TALOCODE_BROWSER_SLOWMO, 10) : undefined,
    defaultViewport: env.TALOCODE_BROWSER_VIEWPORT
      ? JSON.parse(env.TALOCODE_BROWSER_VIEWPORT) as { width: number; height: number }
      : undefined,
    dataDir,
  };
}

export function browserUserDataDir(config: BrowserRuntimeConfig, sessionId: string): string {
  return join(config.dataDir, 'profiles', sessionId);
}
