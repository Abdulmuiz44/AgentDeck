import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type { AgentDeckStore } from './types';
import { DEFAULT_HOST, DEFAULT_PORT, getStorePath } from './paths';
import { defaultProviders } from './providers';

export function defaultStore(): AgentDeckStore {
  return {
    providers: defaultProviders(),
    projects: [],
    sessions: [],
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
    discoveryCache: { tools: [] },
  };
}

export class JsonStore {
  constructor(private readonly storePath = getStorePath()) {}

  async ensure(): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
  }

  async read(): Promise<AgentDeckStore> {
    await this.ensure();
    try {
      const raw = await readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AgentDeckStore>;
      const defaults = defaultStore();
      return {
        providers: parsed.providers?.length ? parsed.providers : defaults.providers,
        projects: parsed.projects || [],
        sessions: parsed.sessions || [],
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
        discoveryCache: parsed.discoveryCache || defaults.discoveryCache,
        lastError: parsed.lastError,
      };
    } catch {
      const store = defaultStore();
      await this.write(store);
      return store;
    }
  }

  async write(store: AgentDeckStore): Promise<void> {
    await this.ensure();
    const tmp = `${this.storePath}.tmp`;
    await writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
    await rename(tmp, this.storePath);
  }

  async update(mutator: (store: AgentDeckStore) => void | Promise<void>): Promise<AgentDeckStore> {
    const store = await this.read();
    await mutator(store);
    await this.write(store);
    return store;
  }
}
