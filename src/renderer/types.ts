export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  panes: Pane[];
  lastOpened: string;
}

export interface Pane {
  id: string;
  terminalId: string;
  command: string;
  label: string;
  status: PaneStatus;
}

export type PaneStatus = 'idle' | 'running' | 'waiting' | 'error' | 'done';

export interface AgentCommand {
  id: string;
  label: string;
  command: string;
  check: string;
  help: string;
}

export interface ElectronAPI {
  shell: {
    openExternal(url: string): Promise<void>;
  };
  terminal: {
    create(cwd: string, command: string): Promise<string>;
    write(terminalId: string, data: string): Promise<void>;
    resize(terminalId: string, cols: number, rows: number): Promise<void>;
    kill(terminalId: string): Promise<void>;
    onData(callback: (terminalId: string, data: string) => void): void;
    onExit(callback: (terminalId: string, exitCode: number) => void): void;
    removeAllListeners(): void;
  };
  workspace: {
    list(): Promise<Workspace[]>;
    save(workspace: Workspace): Promise<void>;
    delete(id: string): Promise<void>;
  };
  fs: {
    selectDirectory(): Promise<string | null>;
    readPackageJson(path: string): Promise<Record<string, unknown> | null>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface DaemonHealth {
  status: 'ok';
  version: string;
  platform: string;
  uptime: number;
  dataDir: string;
  providersCount: number;
  projectsCount: number;
  sessionsCount: number;
  detectedAgentsCount: number;
  ptyAvailable?: boolean;
}

export interface ProviderConfigView {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKeyEnvVar?: string;
  isDefault?: boolean;
  availableModels: string[];
  defaultModel?: string;
  modelsLastRefreshedAt?: string;
  supportsOpenAICompatibleApi: boolean;
  status: string;
  updatedAt: string;
}

export interface AgentAdapterView {
  id: string;
  displayName: string;
  executableNames: string[];
  supportedPlatforms: string[];
  configLocations: string[];
  launchCommandTemplate: string;
  detectionCommand: string;
  docsUrl: string;
  status: string;
  installHint?: string;
}

export interface ProjectView {
  id: string;
  name: string;
  path: string;
  notes?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  sessionsCount?: number;
  pathStatus?: string;
}

export interface SessionView {
  id: string;
  projectId: string;
  agentId: string;
  providerId: string;
  model: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  command: string;
  cwd: string;
  logsPath: string;
  mode?: 'process' | 'pty';
  pid?: number;
  processId?: number;
  startedAt?: string;
  stoppedAt?: string;
  terminalCols?: number;
  terminalRows?: number;
  lastOutputAt?: string;
  exitCode?: number | null;
  error?: string;
  logsTail?: string;
}

export interface DiscoveryView {
  id: string;
  name: string;
  adapterId?: string;
  displayName: string;
  executable?: string;
  path?: string;
  version?: string;
  status: string;
  installHint: string;
  docsUrl: string;
  lastCheckedAt: string;
}


export interface RemoteAccessView {
  enabled: boolean;
  localOnly: boolean;
  bindHost: string;
  port: number;
  lanUrls: string[];
  selectedLanUrl?: string;
  pairedDevicesCount: number;
  pairedDevices: Array<{ id: string; name: string; pairedAt: string; lastSeenAt?: string; expiresAt: string; revokedAt?: string }>;
  lastPhoneAccessAt?: string;
  warnings: string[];
  qrPayload?: string;
  pairingToken?: string;
  phoneUrl?: string;
}

export interface ContextPackView {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  includedFiles: string[];
  estimatedTokens: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  cacheHitCount: number;
  cacheMissCount: number;
  status: string;
}

export interface ContextCacheMetaView {
  contextPackId?: string;
  cacheStatus: string;
  estimatedCachedTokens: number;
  estimatedFreshTokens: number;
  estimatedTotalTokens: number;
  estimatedSavingsPercent: number;
  changedFiles: string[];
}

export interface ProjectContextCacheView {
  packs: ContextPackView[];
  stats: {
    totalPacks: number;
    activePacks: number;
    stalePacks: number;
    totalHits: number;
    totalMisses: number;
  };
}

export interface BrowserSessionView {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  startUrl?: string;
  userDataDir: string;
  viewport?: { width: number; height: number };
  headless: boolean;
  notes?: string;
  lastError?: string;
}

export interface BrowserAuditEventView {
  id: string;
  type: string;
  sessionId: string;
  timestamp: string;
  actor: string;
  metadata?: Record<string, unknown>;
}
