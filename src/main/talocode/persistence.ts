import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { TalocodeStore } from './types';
import { DEFAULT_HOST, DEFAULT_PORT, getStorePath, getDataDir, prepareDataDirMigration } from './paths';
import { defaultProviders } from './providers';
import { defaultBillingSettings } from './billing';
import { resolveBrowserRuntimeConfig } from './browser-config';

export function defaultStore(): TalocodeStore {
  return {
    providers: defaultProviders(),
    projects: [],
    sessions: [],
    contextPacks: [],
    browserSessions: [],
    browserRuntimeConfig: resolveBrowserRuntimeConfig(),
    settings: {
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      dashboardUrl: `http://${DEFAULT_HOST}:${DEFAULT_PORT}`,
      defaultProviderId: 'ollama',
      remoteAccess: {
        phoneAccessEnabled: false,
        bindHost: DEFAULT_HOST,
        pairedDevices: [],
        allowedOrigins: [],
      },
    },
    integrationConfigs: [],
    billing: defaultBillingSettings(),
    discoveryCache: { tools: [] },
  };
}

export class JsonStore {
  constructor(private readonly storePath = getStorePath()) {}

  async ensure(): Promise<void> {
    if (resolve(this.storePath) === resolve(getStorePath())) prepareDataDirMigration();
    await mkdir(dirname(this.storePath), { recursive: true });
  }

  async read(): Promise<TalocodeStore> {
    await this.ensure();
    try {
      const raw = await readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<TalocodeStore>;
      const defaults = defaultStore();
      return {
        providers: parsed.providers?.length ? parsed.providers : defaults.providers,
        projects: parsed.projects || [],
        sessions: parsed.sessions || [],
        contextPacks: parsed.contextPacks || [],
        browserSessions: parsed.browserSessions || [],
        browserRuntimeConfig: parsed.browserRuntimeConfig || defaults.browserRuntimeConfig,
        settings: {
          ...defaults.settings,
          ...(parsed.settings || {}),
          remoteAccess: {
            ...defaults.settings.remoteAccess,
            ...((parsed.settings || {}).remoteAccess || {}),
            pairedDevices: ((parsed.settings || {}).remoteAccess?.pairedDevices || []),
          },
        },
        integrationConfigs: parsed.integrationConfigs || [],
        billing: {
          ...defaults.billing,
          ...(parsed.billing || {}),
          variants: {
            ...defaults.billing.variants,
            ...((parsed.billing || {}).variants || {}),
          },
        },
        discoveryCache: parsed.discoveryCache || defaults.discoveryCache,
        lastError: parsed.lastError,
      };
    } catch {
      const store = defaultStore();
      await this.write(store);
      return store;
    }
  }

  async write(store: TalocodeStore): Promise<void> {
    await this.ensure();
    const tmp = `${this.storePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
    await rename(tmp, this.storePath);
  }

  async update(mutator: (store: TalocodeStore) => void | Promise<void>): Promise<TalocodeStore> {
    const store = await this.read();
    await mutator(store);
    await this.write(store);
    return store;
  }
}
