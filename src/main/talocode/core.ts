import { randomUUID } from 'crypto';
import { getStorePath } from './paths';
import { agentAdapters } from './agents';
import { BrowserRuntime } from './browser-runtime';
import { resolveBrowserRuntimeConfig } from './browser-config';
import { generateOpenAICompatibleConfig, writeOpenAICompatibleConfig } from './config-generator';
import { buildContextPack, computeCacheMeta, rebuildContextPackFn, validateContextPack } from './context-cache';
import { discoverTools } from './discovery';
import { DEFAULT_HOST, DEFAULT_PORT, envValue, getDataDir } from './paths';
import { JsonStore } from './persistence';
import { isPtyAvailable } from './pty-adapter';
import { normalizeProvider, redactProvider } from './providers';
import { activeDevices, buildLanUrls, buildPhoneUrl, buildWarnings, generateToken, hashToken, isLocalOnlyHost, redactSensitive, verifyToken, PHONE_SESSION_DAYS } from './remote';
import {
  activeSessionIds,
  createSession,
  deleteProject,
  projectPathStatus,
  readSessionLogs,
  registerProject,
  resizeSession,
  writeSessionInput,
  restartSession,
  startSession,
  stopAllSessions,
  stopSession,
  updateProject,
} from './sessions';
import type {
  AgentAdapter,
  AgentSession,
  BrowserAuditEvent,
  BrowserSession,
  ContextCacheMeta,
  ContextPack,
  DaemonStatus,
  HealthStatus,
  IntegrationTarget,
  ProjectRegistration,
  ProviderConfig,
  PhonePairingResponse,
  ProviderTestResult,
  RemoteAccessStatus,
  RemoteAccessTokenResponse,
  SessionStatus,
  TalocodeStore,
  ToolDiscoveryResult,
} from './types';

export interface AddProviderRequest {
  id?: string;
  name?: string;
  type?: ProviderConfig['type'];
  baseUrl?: string;
  apiKeyEnvVar?: string;
  availableModels?: string[];
  defaultModel?: string;
  supportsOpenAICompatibleApi?: boolean;
  status?: ProviderConfig['status'];
  isDefault?: boolean;
}

export interface RegisterProjectRequest {
  path: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  path?: string;
}

export interface CreateSessionRequest {
  projectId: string;
  agentId: string;
  providerId: string;
  model?: string;
  mode?: 'process' | 'pty';
  terminalCols?: number;
  terminalRows?: number;
}

export interface ConfigureIntegrationRequest {
  providerId?: string;
  provider?: string;
  model?: string;
  targetConfigPath?: string;
  dryRun?: boolean;
  writeConfig?: boolean;
  targetTool?: IntegrationTarget;
  baseUrl?: string;
  apiKeyEnvVar?: string;
}

const started = Date.now();
const version = process.env.npm_package_version || '0.1.0';

export class TalocodeCore {
  private lastError: string | undefined;
  private browserRuntime: BrowserRuntime | undefined;

  constructor(private readonly store = new JsonStore()) {}

  private getBrowserRuntime(): BrowserRuntime {
    if (!this.browserRuntime) {
      this.browserRuntime = new BrowserRuntime({
        read: async () => {
          const s = await this.store.read();
          return { browserSessions: s.browserSessions, browserRuntimeConfig: s.browserRuntimeConfig };
        },
        write: async (mutator) => {
          await this.store.update((s) => {
            const subset = { browserSessions: s.browserSessions, browserRuntimeConfig: s.browserRuntimeConfig };
            mutator(subset);
            s.browserSessions = subset.browserSessions;
            s.browserRuntimeConfig = subset.browserRuntimeConfig;
          });
        },
      });
    }
    return this.browserRuntime;
  }

  async initialize(): Promise<void> {
    await this.store.ensure();
    const data = await this.store.read();
    await this.store.update((next) => {
      next.sessions = next.sessions.map((session) => session.status === 'running' || session.status === 'starting'
        ? { ...session, status: 'stopped', processId: undefined, updatedAt: new Date().toISOString(), error: 'Daemon restarted while session was active' }
        : session);
      if (!next.settings.defaultProviderId) next.settings.defaultProviderId = data.providers.find((provider) => provider.isDefault)?.id || 'ollama';
    });
  }

  async shutdown(): Promise<void> {
    await stopAllSessions(this.store);
    if (this.browserRuntime) {
      await this.browserRuntime.shutdown();
    }
  }

  async health(): Promise<HealthStatus> {
    const data = await this.store.read();
    const cachedTools = data.discoveryCache?.tools || [];
    return {
      status: 'ok',
      version,
      platform: process.platform,
      uptime: Math.round((Date.now() - started) / 1000),
      dataDir: getDataDir(),
      providersCount: data.providers.length,
      projectsCount: data.projects.length,
      sessionsCount: data.sessions.length,
      detectedAgentsCount: cachedTools.filter((tool) => tool.status === 'detected' && agentAdapters.some((adapter) => adapter.id === tool.id)).length,
      ptyAvailable: isPtyAvailable(),
    };
  }

  async status(localApiUrl = `http://${envValue('HOST') || DEFAULT_HOST}:${envValue('PORT') || DEFAULT_PORT}`): Promise<DaemonStatus> {
    const data = await this.store.read();
    const tools = data.discoveryCache?.tools || [];
    const activeSessions = activeSessionIds().length;
    const storageOk = Boolean(getStorePath());
    return {
      status: this.lastError ? 'degraded' : 'ok',
      localApiUrl,
      storage: {
        status: storageOk ? 'ok' : 'error',
        dataDir: getDataDir(),
        lastError: this.lastError,
      },
      discovery: {
        detected: tools.filter((tool) => tool.status === 'detected').length,
        missing: tools.filter((tool) => tool.status === 'missing' || tool.status === 'not-installed').length,
        unknown: tools.filter((tool) => tool.status === 'unknown').length,
        lastCheckedAt: data.discoveryCache?.lastCheckedAt,
      },
      activeSessions,
      lastError: this.lastError,
    };
  }

  async listProviders(): Promise<ProviderConfig[]> {
    const data = await this.store.read();
    return markDefaultProviders(data.providers.map(redactProvider), data.settings.defaultProviderId);
  }

  async upsertProvider(request: AddProviderRequest): Promise<ProviderConfig> {
    const provider = normalizeProvider(request);
    await this.store.update((data) => {
      const idx = data.providers.findIndex((item) => item.id === provider.id);
      if (request.isDefault) {
        data.settings.defaultProviderId = provider.id;
        data.providers.forEach((item) => { item.isDefault = item.id === provider.id; });
        provider.isDefault = true;
      }
      if (idx >= 0) data.providers[idx] = { ...data.providers[idx], ...provider };
      else data.providers.push(provider);
    });
    return redactProvider(provider);
  }

  async removeProvider(id: string): Promise<{ deleted: boolean }> {
    await this.store.update((data) => {
      data.providers = data.providers.filter((provider) => provider.id !== id);
      if (data.settings.defaultProviderId === id) data.settings.defaultProviderId = data.providers[0]?.id;
    });
    return { deleted: true };
  }

  async setDefaultProvider(id: string): Promise<ProviderConfig> {
    let provider: ProviderConfig | undefined;
    await this.store.update((data) => {
      provider = data.providers.find((item) => item.id === id);
      if (!provider) throw new TalocodeError(404, 'Provider not found');
      data.settings.defaultProviderId = id;
      data.providers.forEach((item) => { item.isDefault = item.id === id; });
    });
    return redactProvider(provider!);
  }

  async testProvider(id: string): Promise<ProviderTestResult> {
    const data = await this.store.read();
    const provider = data.providers.find((item) => item.id === id);
    if (!provider) throw new TalocodeError(404, 'Provider not found');
    const checkedAt = new Date().toISOString();
    try {
      if (provider.type === 'ollama') {
        const url = provider.baseUrl.replace(/\/v1\/?$/, '/api/tags');
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
        const body = await response.json() as { models?: Array<{ name?: string }> };
        const models = body.models?.map((model) => model.name).filter((name): name is string => Boolean(name)) || [];
        await this.updateProviderModels(id, models, models[0]);
        return { providerId: id, ok: true, status: 'configured', message: `Connected to Ollama (${models.length} models).`, models, checkedAt };
      }
      if (provider.supportsOpenAICompatibleApi) {
        if (provider.apiKeyEnvVar && !process.env[provider.apiKeyEnvVar]) {
          return { providerId: id, ok: false, status: 'missing-api-key', message: `${provider.apiKeyEnvVar} is not set in the daemon environment.`, checkedAt };
        }
        const headers: Record<string, string> = {};
        if (provider.apiKeyEnvVar && process.env[provider.apiKeyEnvVar]) headers.Authorization = `Bearer ${process.env[provider.apiKeyEnvVar]}`;
        const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, { headers, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
        const body = await response.json() as { data?: Array<{ id?: string }> };
        const models = body.data?.map((model) => model.id).filter((model): model is string => Boolean(model)) || [];
        await this.updateProviderModels(id, models, models[0]);
        return { providerId: id, ok: true, status: 'configured', message: `Connection OK (${models.length} models).`, models, checkedAt };
      }
      return { providerId: id, ok: false, status: 'unavailable', message: 'Connection test is not implemented for this provider type yet.', checkedAt };
    } catch (error) {
      let message = error instanceof Error ? redact(error.message) : 'Provider test failed';
      if (provider.type === 'ollama' && message === 'fetch failed') message = `Ollama is not reachable at ${provider.baseUrl}. Is Ollama running?`;
      return { providerId: id, ok: false, status: 'error', message, checkedAt };
    }
  }

  async getProviderModels(id: string): Promise<{ providerId: string; models: string[]; defaultModel?: string; modelsLastRefreshedAt?: string }> {
    const data = await this.store.read();
    const provider = data.providers.find((item) => item.id === id);
    if (!provider) throw new TalocodeError(404, 'Provider not found');
    return { providerId: id, models: provider.availableModels, defaultModel: provider.defaultModel, modelsLastRefreshedAt: provider.modelsLastRefreshedAt };
  }

  async refreshProviderModels(id: string): Promise<ProviderTestResult> {
    return this.testProvider(id);
  }

  async listAgents(): Promise<AgentAdapter[]> {
    const discovered = await this.discover(true);
    return agentAdapters.map((adapter) => ({
      ...adapter,
      status: discovered.find((item) => item.id === adapter.id)?.status || adapter.status,
    }));
  }

  async listProjects(): Promise<ProjectRegistration[]> {
    const data = await this.store.read();
    return Promise.all(data.projects.map((project) => this.decorateProject(project, data.sessions)));
  }

  async getProject(id: string): Promise<ProjectRegistration & { sessions: AgentSession[] }> {
    const data = await this.store.read();
    const project = data.projects.find((item) => item.id === id);
    if (!project) throw new TalocodeError(404, 'Project not found');
    return { ...(await this.decorateProject(project, data.sessions)), sessions: data.sessions.filter((session) => session.projectId === id) };
  }

  async registerProject(request: RegisterProjectRequest): Promise<ProjectRegistration> {
    assertString(request.path, 'path');
    return registerProject(this.store, request.path, request.description);
  }

  async updateProject(id: string, request: UpdateProjectRequest): Promise<ProjectRegistration> {
    return updateProject(this.store, id, request);
  }

  async deleteProject(id: string): Promise<{ deleted: boolean }> {
    return deleteProject(this.store, id);
  }

  async getProjectContextCache(projectId: string): Promise<{
    packs: ContextPack[];
    stats: { totalPacks: number; activePacks: number; stalePacks: number; totalHits: number; totalMisses: number };
  }> {
    const data = await this.store.read();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new TalocodeError(404, 'Project not found');
    const packs = data.contextPacks.filter((p) => p.projectId === projectId);
    return {
      packs,
      stats: {
        totalPacks: packs.length,
        activePacks: packs.filter((p) => p.status === 'active').length,
        stalePacks: packs.filter((p) => p.status === 'stale').length,
        totalHits: packs.reduce((sum, p) => sum + p.cacheHitCount, 0),
        totalMisses: packs.reduce((sum, p) => sum + p.cacheMissCount, 0),
      },
    };
  }

  async rebuildContextPack(projectId: string): Promise<ContextPack> {
    const data = await this.store.read();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new TalocodeError(404, 'Project not found');
    const existing = data.contextPacks.find((p) => p.projectId === projectId && p.status !== 'archived');
    let pack: ContextPack;
    if (existing) {
      pack = await rebuildContextPackFn(existing, project.path);
    } else {
      pack = await buildContextPack(projectId, project.path);
    }
    await this.store.update((next) => {
      const idx = next.contextPacks.findIndex((p) => p.id === pack.id);
      if (idx >= 0) {
        next.contextPacks[idx] = pack;
      } else {
        next.contextPacks.push(pack);
      }
    });
    return pack;
  }

  async validateContextPack(projectId: string): Promise<{
    fresh: boolean;
    stale: boolean;
    changedFiles: string[];
    pack: ContextPack | null;
  }> {
    const data = await this.store.read();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new TalocodeError(404, 'Project not found');
    const pack = data.contextPacks.find((p) => p.projectId === projectId && p.status === 'active');
    if (!pack) {
      return { fresh: false, stale: false, changedFiles: [], pack: null };
    }
    const { fresh, changedFiles } = await validateContextPack(pack, project.path);
    const now = new Date().toISOString();
    if (!fresh) {
      await this.store.update((next) => {
        const p = next.contextPacks.find((p2) => p2.id === pack.id);
        if (p) {
          p.status = 'stale';
          p.cacheMissCount += 1;
          p.updatedAt = now;
        }
      });
      return { fresh: false, stale: true, changedFiles, pack: { ...pack, status: 'stale' } };
    }
    await this.store.update((next) => {
      const p = next.contextPacks.find((p2) => p2.id === pack.id);
      if (p) {
        p.cacheHitCount += 1;
        p.lastUsedAt = now;
      }
    });
    return { fresh: true, stale: false, changedFiles: [], pack };
  }

  async getSessionCacheMeta(sessionId: string): Promise<ContextCacheMeta> {
    const data = await this.store.read();
    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) throw new TalocodeError(404, 'Session not found');
    const project = data.projects.find((p) => p.id === session.projectId);
    const pack = data.contextPacks.find((p) => p.projectId === session.projectId && p.status === 'active');
    if (!pack || !project) {
      return {
        cacheStatus: 'disabled',
        estimatedCachedTokens: 0,
        estimatedFreshTokens: 0,
        estimatedTotalTokens: 0,
        estimatedSavingsPercent: 0,
        changedFiles: [],
      };
    }
    const meta = await computeCacheMeta(pack, project.path);
    const now = new Date().toISOString();
    await this.store.update((next) => {
      const p = next.contextPacks.find((p2) => p2.id === pack.id);
      if (p) {
        p.lastUsedAt = now;
        if (meta.cacheStatus === 'hit') p.cacheHitCount += 1;
        else p.cacheMissCount += 1;
      }
    });
    return meta;
  }

  async listBrowserSessions(): Promise<BrowserSession[]> {
    return this.getBrowserRuntime().listSessions();
  }

  async getBrowserSession(id: string): Promise<BrowserSession> {
    return this.getBrowserRuntime().getSession(id);
  }

  async createBrowserSession(input: {
    name: string;
    startUrl?: string;
    headless?: boolean;
    viewport?: { width: number; height: number };
    notes?: string;
  }): Promise<BrowserSession> {
    return this.getBrowserRuntime().createSession(input);
  }

  async updateBrowserSession(id: string, patch: {
    name?: string;
    startUrl?: string;
    notes?: string;
  }): Promise<BrowserSession> {
    return this.getBrowserRuntime().updateSession(id, patch);
  }

  async deleteBrowserSession(id: string): Promise<{ deleted: boolean }> {
    return this.getBrowserRuntime().deleteSession(id);
  }

  async startBrowserSession(id: string): Promise<BrowserSession> {
    return this.getBrowserRuntime().startSession(id);
  }

  async stopBrowserSession(id: string): Promise<BrowserSession> {
    return this.getBrowserRuntime().stopSession(id);
  }

  async restartBrowserSession(id: string): Promise<BrowserSession> {
    return this.getBrowserRuntime().restartSession(id);
  }

  async openBrowserPage(id: string, url: string): Promise<{ opened: boolean }> {
    await this.getBrowserRuntime().openPage(id, url);
    return { opened: true };
  }

  async getBrowserSessionState(id: string): Promise<{ running: boolean; status: string; activePagesCount: number }> {
    return this.getBrowserRuntime().getSessionState(id);
  }

  async exportBrowserStorageState(id: string): Promise<unknown> {
    return this.getBrowserRuntime().exportSessionStorageState(id);
  }

  async clearBrowserSessionData(id: string): Promise<{ cleared: boolean }> {
    return this.getBrowserRuntime().clearSessionData(id);
  }

  async getBrowserAuditLog(): Promise<BrowserAuditEvent[]> {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const { getDataDir } = await import('./paths');
    const path = join(getDataDir(), 'browser-audit.jsonl');
    try {
      const raw = await readFile(path, 'utf-8');
      return raw
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as BrowserAuditEvent)
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 100);
    } catch {
      return [];
    }
  }

  async listSessions(filters: { projectId?: string; status?: SessionStatus } = {}): Promise<AgentSession[]> {
    const data = await this.store.read();
    return data.sessions
      .filter((session) => !filters.projectId || session.projectId === filters.projectId)
      .filter((session) => !filters.status || session.status === filters.status)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async createSession(request: CreateSessionRequest): Promise<AgentSession> {
    assertString(request.projectId, 'projectId');
    assertString(request.agentId, 'agentId');
    assertString(request.providerId, 'providerId');
    return createSession(this.store, request);
  }

  async getSession(id: string): Promise<AgentSession & { logsTail: string }> {
    const data = await this.store.read();
    const session = data.sessions.find((item) => item.id === id);
    if (!session) throw new TalocodeError(404, 'Session not found');
    const logs = await readSessionLogs(this.store, id, 8000);
    return { ...session, logsTail: logs.text };
  }

  async startSession(id: string): Promise<AgentSession> {
    return startSession(this.store, id);
  }

  async stopSession(id: string): Promise<AgentSession> {
    return stopSession(this.store, id);
  }

  async restartSession(id: string): Promise<AgentSession> {
    return restartSession(this.store, id);
  }

  async getSessionLogs(id: string): Promise<{ sessionId: string; logsPath: string; text: string }> {
    return readSessionLogs(this.store, id);
  }

  async sendSessionInput(id: string, data: string): Promise<{ accepted: boolean; mode?: 'process' | 'pty' }> {
    assertString(data, 'data');
    return writeSessionInput(this.store, id, data);
  }

  async resizeSession(id: string, cols: number, rows: number): Promise<{ resized: boolean; cols: number; rows: number }> {
    if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 20 || rows < 5) throw new TalocodeError(400, 'Invalid terminal size');
    return resizeSession(this.store, id, Math.floor(cols), Math.floor(rows));
  }

  async discover(useCache = true): Promise<ToolDiscoveryResult[]> {
    const data = await this.store.read();
    if (useCache && data.discoveryCache?.tools?.length) return data.discoveryCache.tools;
    return this.refreshDiscovery();
  }

  async refreshDiscovery(): Promise<ToolDiscoveryResult[]> {
    const tools = await discoverTools();
    const lastCheckedAt = new Date().toISOString();
    await this.store.update((next) => {
      next.discoveryCache = { tools, lastCheckedAt };
    });
    return tools;
  }

  async configureIntegration(targetTool: IntegrationTarget, request: ConfigureIntegrationRequest): Promise<ReturnType<typeof generateOpenAICompatibleConfig> & { dryRun: boolean; written: boolean; backupPath?: string }> {
    const provider = await this.providerForIntegration(request);
    const input = {
      providerName: provider.name,
      baseUrl: request.baseUrl || provider.baseUrl,
      model: request.model || provider.defaultModel || provider.availableModels[0] || 'default',
      apiKeyEnvVar: request.apiKeyEnvVar || provider.apiKeyEnvVar,
      targetTool,
      targetConfigPath: request.targetConfigPath,
      dryRun: request.dryRun !== false,
    };
    const shouldWrite = request.writeConfig === true || request.dryRun === false;
    const result = shouldWrite
      ? await writeOpenAICompatibleConfig({ ...input, dryRun: false })
      : { ...generateOpenAICompatibleConfig(input), dryRun: true, written: false };

    await this.store.update((next) => {
      next.integrationConfigs.push({
        id: randomUUID(),
        targetTool,
        providerId: provider.id,
        model: input.model,
        targetConfigPath: result.targetConfigPath,
        dryRun: result.dryRun,
        written: result.written,
        backupPath: result.backupPath,
        createdAt: new Date().toISOString(),
      });
    });
    return result;
  }


  async getRemoteAccess(port = DEFAULT_PORT, currentBindHost?: string): Promise<RemoteAccessStatus> {
    const data = await this.store.read();
    const remote = data.settings.remoteAccess;
    const lanUrls = buildLanUrls(port, remote.publicLanUrl);
    const selectedLanUrl = remote.publicLanUrl || lanUrls[0];
    const safeDevices = remote.pairedDevices.map(({ accessTokenHash, ...device }) => device);
    return {
      enabled: remote.phoneAccessEnabled,
      localOnly: isLocalOnlyHost(currentBindHost || remote.bindHost),
      bindHost: remote.bindHost,
      port,
      lanUrls,
      selectedLanUrl,
      pairedDevicesCount: activeDevices(remote.pairedDevices).length,
      pairedDevices: safeDevices,
      lastPhoneAccessAt: remote.lastPhoneAccessAt,
      warnings: buildWarnings(remote, lanUrls, currentBindHost),
      qrPayload: remote.phoneAccessEnabled && selectedLanUrl ? buildPhoneUrl(selectedLanUrl) : undefined,
    };
  }

  async enableRemoteAccess(port = DEFAULT_PORT, request: { publicLanUrl?: string; bindHost?: string } = {}, currentBindHost?: string): Promise<RemoteAccessTokenResponse> {
    const pairingToken = generateToken();
    const now = new Date().toISOString();
    let publicLanUrl = request.publicLanUrl;
    let bindHost = request.bindHost || '0.0.0.0';
    await this.store.update((data) => {
      publicLanUrl = publicLanUrl || data.settings.remoteAccess.publicLanUrl;
      bindHost = bindHost || data.settings.remoteAccess.bindHost || '0.0.0.0';
      data.settings.remoteAccess = {
        ...data.settings.remoteAccess,
        phoneAccessEnabled: true,
        bindHost,
        publicLanUrl,
        pairingTokenHash: hashToken(pairingToken),
        pairingTokenCreatedAt: now,
      };
      data.settings.host = bindHost;
    });
    const status = await this.getRemoteAccess(port, currentBindHost);
    const selectedLanUrl = publicLanUrl || status.selectedLanUrl || `http://127.0.0.1:${port}`;
    const phoneUrl = buildPhoneUrl(selectedLanUrl, pairingToken);
    return { ...status, selectedLanUrl, pairingToken, phoneUrl, qrPayload: phoneUrl };
  }

  async disableRemoteAccess(): Promise<{ disabled: true }> {
    await this.store.update((data) => {
      data.settings.remoteAccess.phoneAccessEnabled = false;
      data.settings.remoteAccess.pairingTokenHash = undefined;
      data.settings.remoteAccess.pairingTokenCreatedAt = undefined;
      data.settings.remoteAccess.pairedDevices = data.settings.remoteAccess.pairedDevices.map((device) => ({ ...device, revokedAt: device.revokedAt || new Date().toISOString() }));
      data.settings.remoteAccess.bindHost = DEFAULT_HOST;
      data.settings.host = DEFAULT_HOST;
    });
    return { disabled: true };
  }

  async rotateRemoteToken(port = DEFAULT_PORT, currentBindHost?: string): Promise<RemoteAccessTokenResponse> {
    const data = await this.store.read();
    if (!data.settings.remoteAccess.phoneAccessEnabled) throw new TalocodeError(400, 'Phone access is not enabled');
    return this.enableRemoteAccess(port, { publicLanUrl: data.settings.remoteAccess.publicLanUrl, bindHost: data.settings.remoteAccess.bindHost }, currentBindHost);
  }

  async pairPhone(token: string, deviceName?: string, userAgent?: string): Promise<PhonePairingResponse> {
    const now = new Date();
    const accessToken = generateToken(32);
    const deviceId = randomUUID();
    const expiresAt = new Date(now.getTime() + PHONE_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const pairedAt = now.toISOString();
    let paired: PhonePairingResponse['device'] | undefined;
    await this.store.update((data) => {
      const remote = data.settings.remoteAccess;
      if (!remote.phoneAccessEnabled) throw new TalocodeError(403, 'Phone access is disabled');
      if (!verifyToken(token, remote.pairingTokenHash)) throw new TalocodeError(401, 'Invalid or expired pairing token');
      const device = {
        id: deviceId,
        name: deviceName || 'Phone browser',
        userAgent: userAgent ? redactSensitive(userAgent).slice(0, 240) : undefined,
        accessTokenHash: hashToken(accessToken),
        pairedAt,
        lastSeenAt: pairedAt,
        expiresAt,
      };
      remote.pairedDevices.push(device);
      remote.pairingTokenHash = undefined;
      remote.pairingTokenCreatedAt = undefined;
      remote.lastPhoneAccessAt = pairedAt;
      paired = (({ accessTokenHash, ...safe }) => safe)(device);
    });
    return { accessToken, deviceId, expiresAt, device: paired! };
  }

  async authenticatePhone(accessToken?: string): Promise<PhonePairingResponse['device'] | undefined> {
    if (!accessToken) return undefined;
    const now = new Date().toISOString();
    let matched: PhonePairingResponse['device'] | undefined;
    await this.store.update((data) => {
      const remote = data.settings.remoteAccess;
      if (!remote.phoneAccessEnabled) return;
      const device = remote.pairedDevices.find((item) => !item.revokedAt && Date.parse(item.expiresAt) > Date.now() && verifyToken(accessToken, item.accessTokenHash));
      if (!device) return;
      device.lastSeenAt = now;
      remote.lastPhoneAccessAt = now;
      matched = (({ accessTokenHash, ...safe }) => safe)(device);
    });
    return matched;
  }

  async logoutPhone(accessToken?: string): Promise<{ loggedOut: boolean }> {
    if (!accessToken) return { loggedOut: false };
    await this.store.update((data) => {
      const device = data.settings.remoteAccess.pairedDevices.find((item) => verifyToken(accessToken, item.accessTokenHash));
      if (device) device.revokedAt = new Date().toISOString();
    });
    return { loggedOut: true };
  }

  async revokePhoneDevice(id: string): Promise<{ revoked: boolean }> {
    let revoked = false;
    await this.store.update((data) => {
      const device = data.settings.remoteAccess.pairedDevices.find((item) => item.id === id);
      if (device) {
        device.revokedAt = new Date().toISOString();
        revoked = true;
      }
    });
    if (!revoked) throw new TalocodeError(404, 'Paired device not found');
    return { revoked };
  }

  async phoneSafeSnapshot(localApiUrl?: string): Promise<Record<string, unknown>> {
    const [status, providers, agents, projects, sessions] = await Promise.all([
      this.status(localApiUrl),
      this.listProviders(),
      this.listAgents(),
      this.listProjects(),
      this.listSessions(),
    ]);
    return { status, providers, agents, projects, sessions };
  }

  async resetLocalData(): Promise<{ reset: boolean }> {
    await this.store.write({ ...(await import('./persistence')).defaultStore() });
    return { reset: true };
  }

  async exportLocalConfig(): Promise<unknown> {
    const data = await this.store.read();
    return { ...data, providers: data.providers.map(redactProvider) };
  }

  private async providerForIntegration(request: ConfigureIntegrationRequest): Promise<ProviderConfig> {
    const data = await this.store.read();
    const provider = data.providers.find((item) => item.id === request.providerId) || data.providers.find((item) => item.id === request.provider);
    if (!provider) throw new TalocodeError(404, 'Provider not found');
    if (!provider.supportsOpenAICompatibleApi) throw new TalocodeError(400, 'Provider does not support OpenAI-compatible configuration');
    return provider;
  }

  private async updateProviderModels(id: string, models: string[], defaultModel?: string): Promise<void> {
    await this.store.update((data) => {
      const provider = data.providers.find((item) => item.id === id);
      if (!provider) return;
      provider.availableModels = models;
      provider.defaultModel = provider.defaultModel || defaultModel;
      provider.status = 'configured';
      provider.modelsLastRefreshedAt = new Date().toISOString();
      provider.updatedAt = new Date().toISOString();
    });
  }

  private async decorateProject(project: ProjectRegistration, sessions: AgentSession[]): Promise<ProjectRegistration> {
    return {
      ...project,
      sessionsCount: sessions.filter((session) => session.projectId === project.id).length,
      pathStatus: await projectPathStatus(project.path),
    };
  }
}

export class TalocodeError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TalocodeError(400, 'Request body must be a JSON object');
  return value as Record<string, unknown>;
}

export function parseProviderRequest(value: unknown): AddProviderRequest {
  const body = asObject(value);
  return {
    id: optionalString(body.id, 'id'),
    name: optionalString(body.name, 'name'),
    type: optionalString(body.type, 'type') as ProviderConfig['type'] | undefined,
    baseUrl: optionalString(body.baseUrl, 'baseUrl'),
    apiKeyEnvVar: optionalString(body.apiKeyEnvVar, 'apiKeyEnvVar'),
    defaultModel: optionalString(body.defaultModel, 'defaultModel'),
    status: optionalString(body.status, 'status') as ProviderConfig['status'] | undefined,
    supportsOpenAICompatibleApi: optionalBoolean(body.supportsOpenAICompatibleApi, 'supportsOpenAICompatibleApi'),
    availableModels: optionalStringArray(body.availableModels, 'availableModels'),
    isDefault: optionalBoolean(body.isDefault, 'isDefault'),
  };
}

export function parseProjectRequest(value: unknown): RegisterProjectRequest {
  const body = asObject(value);
  return { path: requiredString(body.path, 'path'), description: optionalString(body.description, 'description') || optionalString(body.notes, 'notes') };
}

export function parseProjectPatchRequest(value: unknown): UpdateProjectRequest {
  const body = asObject(value);
  return {
    name: optionalString(body.name, 'name'),
    description: optionalString(body.description, 'description'),
    path: optionalString(body.path, 'path'),
  };
}

export function parseSessionRequest(value: unknown): CreateSessionRequest {
  const body = asObject(value);
  return {
    projectId: requiredString(body.projectId, 'projectId'),
    agentId: requiredString(body.agentId, 'agentId'),
    providerId: requiredString(body.providerId, 'providerId'),
    model: optionalString(body.model, 'model'),
    mode: optionalString(body.mode, 'mode') as 'process' | 'pty' | undefined,
    terminalCols: optionalNumber(body.terminalCols, 'terminalCols'),
    terminalRows: optionalNumber(body.terminalRows, 'terminalRows'),
  };
}

export function parseIntegrationRequest(value: unknown): ConfigureIntegrationRequest {
  const body = asObject(value);
  return {
    providerId: optionalString(body.providerId, 'providerId'),
    provider: optionalString(body.provider, 'provider'),
    model: optionalString(body.model, 'model'),
    targetConfigPath: optionalString(body.targetConfigPath, 'targetConfigPath'),
    dryRun: optionalBoolean(body.dryRun, 'dryRun'),
    writeConfig: optionalBoolean(body.writeConfig, 'writeConfig'),
    targetTool: optionalString(body.targetTool, 'targetTool') as IntegrationTarget | undefined,
    baseUrl: optionalString(body.baseUrl, 'baseUrl'),
    apiKeyEnvVar: optionalString(body.apiKeyEnvVar, 'apiKeyEnvVar'),
  };
}


export function parseSessionInputRequest(value: unknown): { data: string } {
  const body = asObject(value);
  return { data: requiredString(body.data, 'data') };
}

export function parseSessionResizeRequest(value: unknown): { cols: number; rows: number } {
  const body = asObject(value);
  return { cols: requiredNumber(body.cols, 'cols'), rows: requiredNumber(body.rows, 'rows') };
}

function markDefaultProviders(providers: ProviderConfig[], defaultProviderId?: string): ProviderConfig[] {
  return providers.map((provider) => ({ ...provider, isDefault: provider.id === defaultProviderId || provider.isDefault }));
}

function requiredString(value: unknown, field: string): string {
  assertString(value, field);
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  assertString(value, field);
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TalocodeError(400, `${field} must be a number`);
  return value;
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredNumber(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new TalocodeError(400, `${field} must be a boolean`);
  return value;
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new TalocodeError(400, `${field} must be an array of strings`);
  return value;
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new TalocodeError(400, `${field} is required`);
}

function redact(input: string): string {
  return input.replace(/(api[_-]?key|token|secret)=\S+/gi, '$1=[redacted]');
}
