export type ProviderType = 'ollama' | 'openrouter' | 'openai-compatible' | 'openai' | 'anthropic' | 'gemini';
export type ProviderStatus = 'configured' | 'missing-api-key' | 'unconfigured' | 'unavailable' | 'testing' | 'error';
export type AdapterStatus = 'detected' | 'missing' | 'unknown' | 'unsupported-platform' | 'not-installed';
export type SessionStatus = 'created' | 'starting' | 'running' | 'stopped' | 'failed' | 'completed' | 'exited' | 'error';
export type SessionMode = 'process' | 'pty';
export type SupportedPlatform = 'win32' | 'darwin' | 'linux';
export type IntegrationTarget = 'codex' | 'opencode';
export type BillingPlanId = 'free' | 'pro' | 'team' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyEnvVar?: string;
  availableModels: string[];
  defaultModel?: string;
  modelsLastRefreshedAt?: string;
  supportsOpenAICompatibleApi: boolean;
  status: ProviderStatus;
  updatedAt: string;
  isDefault?: boolean;
}

export interface ProviderTestResult {
  providerId: string;
  ok: boolean;
  status: ProviderStatus;
  message: string;
  models?: string[];
  checkedAt: string;
}

export interface AgentAdapter {
  id: string;
  displayName: string;
  executableNames: string[];
  supportedPlatforms: SupportedPlatform[];
  configLocations: string[];
  launchCommandTemplate: string;
  argsTemplate: string[];
  detectionCommand: string;
  docsUrl: string;
  status: AdapterStatus;
  installHint?: string;
}

export interface ToolDiscoveryResult {
  id: string;
  name: string;
  adapterId?: string;
  displayName: string;
  executable?: string;
  path?: string;
  version?: string;
  status: AdapterStatus;
  installHint: string;
  docsUrl: string;
  lastCheckedAt: string;
}

export interface ProjectRegistration {
  id: string;
  name: string;
  path: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  sessionsCount?: number;
  pathStatus?: 'valid' | 'missing';
}

export interface AgentSession {
  id: string;
  projectId: string;
  agentId: string;
  providerId: string;
  model: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  command: string;
  cwd: string;
  logsPath: string;
  mode: SessionMode;
  pid?: number;
  processId?: number;
  startedAt?: string;
  stoppedAt?: string;
  terminalCols?: number;
  terminalRows?: number;
  lastOutputAt?: string;
  exitCode?: number | null;
  error?: string;
}

export interface LanAddressCandidate {
  address: string;
  interfaceName: string;
  priority: number;
}

export interface PairedPhoneDevice {
  id: string;
  name: string;
  userAgent?: string;
  accessTokenHash: string;
  pairedAt: string;
  lastSeenAt?: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface RemoteAccessSettings {
  phoneAccessEnabled: boolean;
  bindHost: string;
  publicLanUrl?: string;
  pairingTokenHash?: string;
  pairingTokenCreatedAt?: string;
  pairedDevices: PairedPhoneDevice[];
  allowedOrigins?: string[];
  lastPhoneAccessAt?: string;
}

export interface UserSettings {
  host: string;
  port: number;
  dashboardUrl: string;
  defaultProviderId?: string;
  remoteAccess: RemoteAccessSettings;
}

export interface RemoteAccessStatus {
  enabled: boolean;
  localOnly: boolean;
  bindHost: string;
  port: number;
  lanUrls: string[];
  selectedLanUrl?: string;
  pairedDevicesCount: number;
  pairedDevices: Array<Omit<PairedPhoneDevice, 'accessTokenHash'>>;
  lastPhoneAccessAt?: string;
  warnings: string[];
  qrPayload?: string;
  qrCodeDataUrl?: string;
}

export interface RemoteAccessTokenResponse extends RemoteAccessStatus {
  pairingToken: string;
  phoneUrl: string;
}

export interface PhonePairingResponse {
  accessToken: string;
  deviceId: string;
  expiresAt: string;
  device: Omit<PairedPhoneDevice, 'accessTokenHash'>;
}


export interface IntegrationRecord {
  id: string;
  targetTool: IntegrationTarget;
  providerId: string;
  model: string;
  targetConfigPath: string;
  dryRun: boolean;
  written: boolean;
  backupPath?: string;
  createdAt: string;
}

export interface BillingVariantConfig {
  monthly?: string;
  annual?: string;
}

export interface BillingWebhookEvent {
  receivedAt: string;
  eventName?: string;
  signatureVerified: boolean;
  payload: unknown;
}

export interface BillingSettings {
  provider: 'lemonsqueezy';
  enabled: boolean;
  storeSlug?: string;
  variants: Record<Exclude<BillingPlanId, 'free'>, BillingVariantConfig>;
  contactSalesUrl?: string;
  successUrl?: string;
  webhookSecret?: string;
  lastCheckoutAt?: string;
  lastCheckoutPlanId?: BillingPlanId;
  lastCheckoutCycle?: BillingCycle;
  lastWebhookEvent?: BillingWebhookEvent;
  updatedAt: string;
}

export interface BillingCheckoutRequest {
  planId: BillingPlanId;
  cycle?: BillingCycle;
  seats?: number;
  email?: string;
  name?: string;
  source?: string;
}

export interface BillingCheckoutResponse {
  checkoutUrl: string;
  planId: BillingPlanId;
  cycle: BillingCycle;
  provider: 'lemonsqueezy';
  ready: boolean;
  issues: string[];
  storeSlug?: string;
  variantId?: string;
  contactSalesUrl?: string;
}

export interface DiscoveryCache {
  tools: ToolDiscoveryResult[];
  lastCheckedAt?: string;
}

export interface TalocodeStore {
  providers: ProviderConfig[];
  projects: ProjectRegistration[];
  sessions: AgentSession[];
  settings: UserSettings;
  integrationConfigs: IntegrationRecord[];
  billing: BillingSettings;
  discoveryCache?: DiscoveryCache;
  lastError?: string;
}

export interface HealthStatus {
  status: 'ok';
  version: string;
  platform: NodeJS.Platform;
  uptime: number;
  dataDir: string;
  providersCount: number;
  projectsCount: number;
  sessionsCount: number;
  detectedAgentsCount: number;
  ptyAvailable: boolean;
}

export interface DaemonStatus {
  status: 'ok' | 'degraded';
  localApiUrl: string;
  storage: {
    status: 'ok' | 'error';
    dataDir: string;
    lastError?: string;
  };
  discovery: {
    detected: number;
    missing: number;
    unknown: number;
    lastCheckedAt?: string;
  };
  activeSessions: number;
  lastError?: string;
}

export type SessionStreamEventType = 'session_started' | 'output' | 'input_ack' | 'resized' | 'session_stopped' | 'session_failed' | 'session_completed' | 'heartbeat';

export interface SessionStreamEvent {
  type: SessionStreamEventType;
  sessionId: string;
  timestamp: string;
  data?: string;
  status?: SessionStatus;
  exitCode?: number | null;
  error?: string;
  cols?: number;
  rows?: number;
}

export interface SessionOutputEvent extends SessionStreamEvent {
  type: 'output';
  data: string;
}

export interface SessionLifecycleEvent extends SessionStreamEvent {
  type: 'session_started' | 'session_stopped' | 'session_failed' | 'session_completed';
  status: SessionStatus;
}

export interface SessionInputRequest {
  data: string;
}

export interface SessionResizeRequest {
  cols: number;
  rows: number;
}
