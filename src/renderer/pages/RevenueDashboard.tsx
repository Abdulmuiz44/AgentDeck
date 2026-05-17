import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AgentAdapterView,
  DaemonHealth,
  DiscoveryView,
  ProjectView,
  ProviderConfigView,
  RemoteAccessView,
  SessionView,
} from '../types';

type NavId =
  | 'overview'
  | 'workflows'
  | 'worktrees'
  | 'sessions'
  | 'logs'
  | 'approvals'
  | 'integrations'
  | 'pricing'
  | 'team'
  | 'settings';

type BillingCycle = 'monthly' | 'annual';
type BillingPlanId = 'free' | 'pro' | 'team' | 'enterprise';
type ProviderType = 'ollama' | 'openrouter' | 'openai-compatible' | 'openai' | 'anthropic' | 'gemini';
type IconName =
  | 'home'
  | 'workflow'
  | 'branch'
  | 'terminal'
  | 'logs'
  | 'approvals'
  | 'plug'
  | 'dollar'
  | 'users'
  | 'gear'
  | 'arrow-right'
  | 'check'
  | 'shield'
  | 'lock'
  | 'monitor'
  | 'phone'
  | 'folder'
  | 'box'
  | 'calendar'
  | 'brand'
  | 'server'
  | 'clock';

type DaemonStatusView = {
  status: string;
  localApiUrl: string;
  storage: { status: string; dataDir: string; lastError?: string };
  discovery: { detected: number; missing: number; unknown: number; lastCheckedAt?: string };
  activeSessions: number;
  lastError?: string;
};

type BillingVariants = {
  pro: { monthly?: string; annual?: string };
  team: { monthly?: string; annual?: string };
  enterprise: { monthly?: string; annual?: string };
};

type BillingConfigView = {
  provider: 'lemonsqueezy';
  enabled: boolean;
  storeSlug?: string;
  contactSalesUrl?: string;
  successUrl?: string;
  webhookSecret?: string;
  updatedAt: string;
  lastCheckoutAt?: string;
  lastCheckoutPlanId?: BillingPlanId;
  lastCheckoutCycle?: BillingCycle;
  variants: BillingVariants;
  ready: boolean;
  issues: string[];
  checkoutTargets: Record<'pro' | 'team' | 'enterprise', Record<BillingCycle, string | undefined>>;
};

type BillingCheckoutResponse = {
  checkoutUrl: string;
  ready: boolean;
  issues: string[];
  contactSalesUrl?: string;
};

type IntegrationPreview = {
  targetTool?: string;
  targetConfigPath?: string;
  contents?: string;
  dryRun?: boolean;
  written?: boolean;
  backupPath?: string;
};

type WorkflowState = {
  id: 'discovery' | 'provider' | 'project' | 'session' | 'phone';
  step: string;
  title: string;
  description: string;
  action: string;
  icon: IconName;
  complete: boolean;
  nav: NavId;
  run?: () => Promise<void>;
};

type ChecklistItem = {
  id: string;
  title: string;
  detail: string;
  action: string;
};

const API = import.meta.env.VITE_TALOCODE_API_URL || 'http://127.0.0.1:3768';
const REQUEST_TIMEOUT_MS = 8000;
const logoSrc = '/assets/talocode-logo.png';

const navItems: { id: NavId; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'workflows', label: 'Workflows', icon: 'workflow' },
  { id: 'worktrees', label: 'Worktrees', icon: 'branch' },
  { id: 'sessions', label: 'Sessions', icon: 'terminal' },
  { id: 'logs', label: 'Logs', icon: 'logs' },
  { id: 'approvals', label: 'Approvals', icon: 'approvals' },
  { id: 'integrations', label: 'Integrations', icon: 'plug' },
  { id: 'pricing', label: 'Pricing', icon: 'dollar' },
  { id: 'team', label: 'Team', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

const planDefinitions: Record<BillingPlanId, { name: string; description: string; cta: string; features: string[] }> = {
  free: {
    name: 'Free',
    description: 'For individuals exploring local agents.',
    cta: 'Get started',
    features: ['Desktop dashboard', '1 workspace', 'Community support'],
  },
  pro: {
    name: 'Pro',
    description: 'For power users and small teams.',
    cta: 'Open checkout',
    features: ['Unlimited workspaces', 'Phone control', 'Priority support', 'Local-first agent control'],
  },
  team: {
    name: 'Team',
    description: 'For growing teams with advanced needs.',
    cta: 'Open checkout',
    features: ['Role-based workflows', 'Audit visibility', 'SAML-ready model', 'Shared provider management'],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For organizations with scale and compliance.',
    cta: 'Contact sales',
    features: ['Self-hosted deployment', 'Advanced security', 'Dedicated support', 'Private network support'],
  },
};

export default function RevenueDashboard() {
  const [activeNav, setActiveNav] = useState<NavId>('overview');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [status, setStatus] = useState<DaemonStatusView | null>(null);
  const [providers, setProviders] = useState<ProviderConfigView[]>([]);
  const [agents, setAgents] = useState<AgentAdapterView[]>([]);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryView[]>([]);
  const [remoteAccess, setRemoteAccess] = useState<RemoteAccessView | null>(null);
  const [billing, setBilling] = useState<BillingConfigView | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionLogs, setSelectedSessionLogs] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [providerForm, setProviderForm] = useState({
    type: 'ollama' as ProviderType,
    name: 'Ollama Local',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyEnvVar: '',
    defaultModel: '',
  });
  const [projectForm, setProjectForm] = useState({ path: '', description: '' });
  const [sessionForm, setSessionForm] = useState({ projectId: '', agentId: 'codex-cli', providerId: 'ollama', model: '', mode: 'pty' as 'pty' | 'process' });
  const [integrationForm, setIntegrationForm] = useState({ targetTool: 'codex', providerId: 'ollama', model: '' });
  const [integrationResult, setIntegrationResult] = useState<IntegrationPreview | null>(null);
  const [billingForm, setBillingForm] = useState({
    storeSlug: '',
    contactSalesUrl: '',
    successUrl: '',
    proMonthly: '',
    proAnnual: '',
    teamMonthly: '',
    teamAnnual: '',
    enterpriseMonthly: '',
    enterpriseAnnual: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        request<DaemonHealth>('/health'),
        request<DaemonStatusView>('/api/status'),
        request<ProviderConfigView[]>('/api/providers'),
        request<AgentAdapterView[]>('/api/agents'),
        request<ProjectView[]>('/api/projects'),
        request<SessionView[]>('/api/sessions'),
        request<DiscoveryView[]>('/api/system/discover'),
        request<RemoteAccessView>('/api/remote/access'),
        request<BillingConfigView>('/api/billing/config'),
      ]);

      const failures: string[] = [];
      const load = <T,>(index: number, setter: (value: T) => void, label: string) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          setter(result.value as T);
          return;
        }
        failures.push(label);
      };

      load(0, setHealth, 'health');
      load(1, setStatus, 'status');
      load(2, setProviders, 'providers');
      load(3, setAgents, 'agents');
      load(4, setProjects, 'projects');
      load(5, setSessions, 'sessions');
      load(6, setDiscovery, 'discovery');
      load(7, setRemoteAccess, 'phone access');
      load(8, setBilling, 'billing');

      setError('');
      if (!failures.length) setMessage('');
      else if (failures.includes('health') || failures.includes('status')) setMessage(`Talocode is offline at ${API}. Start it with: talo start.`);
      else setMessage(`Some sections could not refresh: ${failures.join(', ')}.`);
    } catch (refreshError) {
      setMessage(`Talocode is offline at ${API}. Start it with: talo start.`);
      setError(asError(refreshError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!billing) return;
    setBillingForm({
      storeSlug: billing.storeSlug || '',
      contactSalesUrl: billing.contactSalesUrl || '',
      successUrl: billing.successUrl || '',
      proMonthly: billing.variants.pro.monthly || '',
      proAnnual: billing.variants.pro.annual || '',
      teamMonthly: billing.variants.team.monthly || '',
      teamAnnual: billing.variants.team.annual || '',
      enterpriseMonthly: billing.variants.enterprise.monthly || '',
      enterpriseAnnual: billing.variants.enterprise.annual || '',
    });
  }, [billing]);

  useEffect(() => {
    if (selectedSessionId || !sessions.length) return;
    setSelectedSessionId(sessions[0].id);
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSelectedSessionLogs('');
      return;
    }
    let cancelled = false;
    void request<{ text: string }>(`/api/sessions/${encodeURIComponent(selectedSessionId)}/logs`)
      .then((result) => {
        if (!cancelled) setSelectedSessionLogs(result.text || '');
      })
      .catch(() => {
        if (!cancelled) setSelectedSessionLogs('');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  useEffect(() => {
    if (!providers.length) return;
    setSessionForm((current) => ({
      ...current,
      providerId: providers.some((provider) => provider.id === current.providerId)
        ? current.providerId
        : providers.find((provider) => provider.isDefault)?.id || providers[0].id,
    }));
    setIntegrationForm((current) => ({
      ...current,
      providerId: providers.some((provider) => provider.id === current.providerId)
        ? current.providerId
        : providers.find((provider) => provider.supportsOpenAICompatibleApi)?.id || providers[0].id,
    }));
  }, [providers]);

  useEffect(() => {
    if (!agents.length) return;
    setSessionForm((current) => ({
      ...current,
      agentId: agents.some((agent) => agent.id === current.agentId) ? current.agentId : agents[0].id,
    }));
  }, [agents]);

  const detectedAgents = useMemo(() => agents.filter((agent) => agent.status === 'detected'), [agents]);
  const configuredProviders = useMemo(() => providers.filter((provider) => provider.status === 'configured'), [providers]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedSessionId) || null, [sessions, selectedSessionId]);
  const integrationProviders = useMemo(() => providers.filter((provider) => provider.supportsOpenAICompatibleApi), [providers]);
  const approvalItems = useMemo<ChecklistItem[]>(() => {
    const items: ChecklistItem[] = [];
    providers
      .filter((provider) => provider.status === 'missing-api-key')
      .forEach((provider) => items.push({
        id: `provider-${provider.id}`,
        title: `${provider.name} needs credentials`,
        detail: provider.apiKeyEnvVar ? `Set ${provider.apiKeyEnvVar} in the daemon environment.` : 'This provider requires additional configuration.',
        action: 'Open integrations',
      }));
    billing?.issues.forEach((issue, index) => items.push({
      id: `billing-${index}`,
      title: 'Billing setup incomplete',
      detail: issue,
      action: 'Open pricing',
    }));
    remoteAccess?.warnings.forEach((warning, index) => items.push({
      id: `remote-${index}`,
      title: 'Phone access warning',
      detail: warning,
      action: 'Open settings',
    }));
    return items;
  }, [billing?.issues, providers, remoteAccess?.warnings]);

  const workflowItems = useMemo<WorkflowState[]>(() => [
    {
      id: 'discovery',
      step: '1',
      title: 'Discover installed agent tools',
      description: 'Refresh PATH detection so Talocode knows which local agents are available.',
      action: 'Refresh discovery',
      icon: 'workflow',
      complete: detectedAgents.length > 0,
      nav: 'workflows',
      run: async () => {
        await runAction(async () => {
          await post('/api/system/discover/refresh', {});
          await refresh();
          setMessage('Discovery refreshed.');
        }, setBusy, setError);
      },
    },
    {
      id: 'provider',
      step: '2',
      title: 'Configure providers',
      description: 'Connect a real model provider and confirm the daemon can use it.',
      action: 'Open integrations',
      icon: 'plug',
      complete: configuredProviders.length > 0,
      nav: 'integrations',
    },
    {
      id: 'project',
      step: '3',
      title: 'Register a project workspace',
      description: 'Point Talocode at a real local repository before launching sessions.',
      action: 'Open worktrees',
      icon: 'folder',
      complete: projects.length > 0,
      nav: 'worktrees',
    },
    {
      id: 'session',
      step: '4',
      title: 'Create a live session',
      description: 'Start or inspect a real agent run from the sessions surface.',
      action: 'Open sessions',
      icon: 'terminal',
      complete: sessions.length > 0,
      nav: 'sessions',
    },
    {
      id: 'phone',
      step: '5',
      title: 'Enable phone control',
      description: 'Turn on LAN access only when you are ready to pair a trusted device.',
      action: remoteAccess?.enabled ? 'Open settings' : 'Enable access',
      icon: 'phone',
      complete: Boolean(remoteAccess?.enabled),
      nav: 'settings',
      run: remoteAccess?.enabled
        ? undefined
        : async () => {
            await runAction(async () => {
              await post('/api/remote/access/enable', {});
              await refresh();
              setMessage('Phone access enabled.');
            }, setBusy, setError);
          },
    },
  ], [configuredProviders.length, detectedAgents.length, projects.length, refresh, remoteAccess?.enabled, sessions.length]);

  const metrics = [
    { title: 'Registered workspaces', value: String(projects.length), detail: status?.storage.dataDir || 'Local storage unavailable', icon: 'folder' as const },
    { title: 'Configured providers', value: String(configuredProviders.length), detail: `${providers.length} total providers`, icon: 'plug' as const },
    { title: 'Detected agents', value: String(detectedAgents.length), detail: `${status?.discovery.missing || 0} missing from PATH`, icon: 'users' as const },
    { title: 'Active sessions', value: String(status?.activeSessions || sessions.filter((session) => session.status === 'running').length), detail: `${sessions.length} stored sessions`, icon: 'monitor' as const },
  ];

  const integrationCards = useMemo(() => {
    const providerCards = providers.slice(0, 6).map((provider) => ({
      id: provider.id,
      name: provider.name,
      category: provider.type,
      detail: provider.defaultModel || provider.baseUrl,
      mark: provider.name.slice(0, 2).toUpperCase(),
      connected: provider.status === 'configured',
    }));
    const billingCard = {
      id: 'lemonsqueezy',
      name: 'Lemon Squeezy',
      category: 'payments',
      detail: billing?.ready ? billing.storeSlug || 'Checkout ready' : 'Billing not configured',
      mark: 'LS',
      connected: Boolean(billing?.ready),
    };
    return [...providerCards, billingCard];
  }, [billing?.ready, billing?.storeSlug, providers]);

  const accountTitle = remoteAccess?.enabled ? `LAN ${remoteAccess.bindHost}` : 'Local operator';
  const accountSubtitle = health ? `${health.platform} desktop` : 'Daemon offline';

  async function browseProjectPath() {
    try {
      const path = await window.electronAPI?.fs?.selectDirectory?.();
      if (path) setProjectForm((current) => ({ ...current, path }));
    } catch (browseError) {
      setError(asError(browseError));
    }
  }

  async function saveProvider() {
    await runAction(async () => {
      await post('/api/providers', {
        type: providerForm.type,
        name: providerForm.name,
        baseUrl: providerForm.baseUrl,
        apiKeyEnvVar: providerForm.apiKeyEnvVar || undefined,
        defaultModel: providerForm.defaultModel || undefined,
      });
      await refresh();
      setMessage(`Saved provider ${providerForm.name}.`);
    }, setBusy, setError);
  }

  async function registerProject() {
    await runAction(async () => {
      await post('/api/projects', {
        path: projectForm.path,
        description: projectForm.description || undefined,
      });
      setProjectForm({ path: '', description: '' });
      await refresh();
      setMessage('Project registered.');
    }, setBusy, setError);
  }

  async function createSession(startNow: boolean) {
    await runAction(async () => {
      const created = await post<SessionView>('/api/sessions', {
        projectId: sessionForm.projectId,
        agentId: sessionForm.agentId,
        providerId: sessionForm.providerId,
        model: sessionForm.model || undefined,
        mode: sessionForm.mode,
      });
      if (startNow) await post(`/api/sessions/${created.id}/start`, {});
      await refresh();
      setSelectedSessionId(created.id);
      setActiveNav('sessions');
      setMessage(startNow ? 'Session created and started.' : 'Session created.');
    }, setBusy, setError);
  }

  async function sessionAction(id: string, action: 'start' | 'stop' | 'restart') {
    await runAction(async () => {
      await post(`/api/sessions/${id}/${action}`, {});
      await refresh();
      setMessage(`Session ${action} requested.`);
    }, setBusy, setError);
  }

  async function openSessionLogs(id: string) {
    setSelectedSessionId(id);
    setActiveNav('logs');
    setMessage('Session logs opened.');
  }

  async function runIntegrationPreview(writeConfig: boolean) {
    await runAction(async () => {
      const payload = {
        targetTool: integrationForm.targetTool,
        providerId: integrationForm.providerId,
        model: integrationForm.model || undefined,
      };
      const result = await post<IntegrationPreview>(writeConfig ? '/api/integrations/config/write' : '/api/integrations/config/preview', payload);
      setIntegrationResult(result);
      setMessage(writeConfig ? 'Integration config written.' : 'Integration config previewed.');
    }, setBusy, setError);
  }

  async function providerAction(id: string, action: 'test' | 'refresh' | 'default' | 'remove') {
    await runAction(async () => {
      if (action === 'test') await post(`/api/providers/${id}/test`, {});
      if (action === 'refresh') await post(`/api/providers/${id}/models/refresh`, {});
      if (action === 'default') await post(`/api/providers/${id}/default`, {});
      if (action === 'remove') await del(`/api/providers/${id}`);
      await refresh();
      setMessage(`Provider action completed: ${action}.`);
    }, setBusy, setError);
  }

  async function saveBillingConfig() {
    await runAction(async () => {
      await patch('/api/billing/config', {
        storeSlug: billingForm.storeSlug || undefined,
        contactSalesUrl: billingForm.contactSalesUrl || undefined,
        successUrl: billingForm.successUrl || undefined,
        variants: {
          pro: { monthly: billingForm.proMonthly || undefined, annual: billingForm.proAnnual || undefined },
          team: { monthly: billingForm.teamMonthly || undefined, annual: billingForm.teamAnnual || undefined },
          enterprise: { monthly: billingForm.enterpriseMonthly || undefined, annual: billingForm.enterpriseAnnual || undefined },
        },
      });
      await refresh();
      setMessage('Billing configuration saved.');
    }, setBusy, setError);
  }

  async function startCheckout(planId: BillingPlanId) {
    if (planId === 'free') {
      setActiveNav('worktrees');
      setMessage('Free plan uses the local dashboard directly.');
      return;
    }
    await runAction(async () => {
      const response = await post<BillingCheckoutResponse>('/api/billing/checkout', {
        planId,
        cycle: billingCycle,
        source: 'talocode-dashboard',
      });
      if (!response.ready && response.issues.length) {
        setError(response.issues.join(' '));
        setActiveNav('pricing');
        return;
      }
      await openExternal(response.checkoutUrl || response.contactSalesUrl || '');
      setMessage(planId === 'enterprise' ? 'Opened contact sales.' : 'Opened Lemon Squeezy checkout.');
    }, setBusy, setError);
  }

  async function remoteAction(path: '/api/remote/access/enable' | '/api/remote/access/disable' | '/api/remote/access/rotate-token') {
    await runAction(async () => {
      await post(path, {});
      await refresh();
      setMessage(path.endsWith('enable') ? 'Phone access enabled.' : path.endsWith('disable') ? 'Phone access disabled.' : 'Pairing token rotated.');
    }, setBusy, setError);
  }

  async function revokeDevice(deviceId: string) {
    await runAction(async () => {
      await post('/api/remote/access/revoke-device', { deviceId });
      await refresh();
      setMessage('Paired device revoked.');
    }, setBusy, setError);
  }

  async function exportConfig() {
    await runAction(async () => {
      const payload = await get<Record<string, unknown>>('/api/settings/export');
      await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
      setMessage('Local config copied to clipboard.');
    }, setBusy, setError);
  }

  async function resetConfig() {
    if (!window.confirm('Reset Talocode local data?')) return;
    await runAction(async () => {
      await post('/api/settings/reset', {});
      await refresh();
      setSelectedSessionId(null);
      setIntegrationResult(null);
      setMessage('Local Talocode data reset.');
    }, setBusy, setError);
  }

  return (
    <div className="revenue-shell without-pricing-rail">
      <aside className="revenue-sidebar">
        <div className="revenue-brand">
          <div className="revenue-logo">
            <img src={logoSrc} alt="Talocode" />
          </div>
          <div className="revenue-brand-copy">
            <h1>Talocode</h1>
            <p>Local-first control plane</p>
          </div>
        </div>

        <nav className="revenue-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button key={item.id} type="button" className={activeNav === item.id ? 'active' : ''} onClick={() => setActiveNav(item.id)}>
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="revenue-status-card revenue-card-button" onClick={() => setActiveNav('settings')}>
          <div className={`status-dot ${health ? 'online' : 'offline'}`} />
          <div>
            <strong>Daemon</strong>
            <p>{health ? 'Running' : 'Offline'}</p>
            <small>{status?.localApiUrl || API}</small>
          </div>
          <Icon name="arrow-right" />
        </button>

        <button type="button" className="revenue-account-card revenue-card-button" onClick={() => setActiveNav('team')}>
          <div className="account-avatar">TC</div>
          <div>
            <strong>{accountTitle}</strong>
            <p>{accountSubtitle}</p>
          </div>
          <Icon name="arrow-right" />
        </button>
      </aside>

      <main className="revenue-main">
        {(message || error || loading) && (
          <section className={`panel dashboard-banner ${error ? 'warning' : ''}`}>
            <strong>{error ? 'Action issue' : loading ? 'Refreshing' : 'Status'}</strong>
            <p>{error || message || 'Refreshing dashboard state...'}</p>
          </section>
        )}

        {activeNav === 'overview' && (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <h1>
                  Local agent control.
                  <br />
                  <span className="hero-line">Built for teams. <span>Monetized by you.</span></span>
                </h1>
                <p>Talocode lets teams run, manage, and monetize coding agents safely on their own infrastructure.</p>

                <div className="chip-row" aria-label="Product benefits">
                  <div className="chip"><Icon name="shield" /><span>Data stays local</span></div>
                  <div className="chip"><Icon name="lock" /><span>Fine-grained permissions</span></div>
                  <div className="chip"><Icon name="monitor" /><span>Session isolation</span></div>
                </div>

                <div className="cta-row">
                  <button type="button" className="cta primary" onClick={() => setActiveNav('pricing')}>
                    Configure billing
                    <Icon name="arrow-right" />
                  </button>
                  <button type="button" className="cta secondary" onClick={() => setActiveNav('sessions')}>
                    Open live sessions
                    <Icon name="calendar" />
                  </button>
                </div>
              </div>
              <div className="hero-pattern" aria-hidden="true" />
            </section>

            <section className="metrics-grid" aria-label="Live Talocode metrics">
              {metrics.map((metric) => <MetricCard key={metric.title} metric={metric} />)}
            </section>

            <section className="content-section">
              <div className="section-heading">
                <div>
                  <h3>Get started from real daemon state</h3>
                  <p>Each step below is derived from your actual Talocode configuration, not placeholder data.</p>
                </div>
                <button type="button" className="inline-link" onClick={() => setActiveNav('workflows')}>
                  Open workflows
                  <Icon name="arrow-right" />
                </button>
              </div>
              <div className="workflow-grid workflow-grid-five">
                {workflowItems.map((workflow) => (
                  <WorkflowStep key={workflow.id} workflow={workflow} onPrimaryAction={() => void (workflow.run ? workflow.run() : Promise.resolve(setActiveNav(workflow.nav)))} />
                ))}
              </div>
            </section>

            <section className="content-section">
              <div className="section-heading section-heading-inline">
                <div>
                  <h3>Connected surfaces</h3>
                  <p>These cards reflect actual provider and billing configuration from the daemon.</p>
                </div>
                <button type="button" className="inline-link" onClick={() => setActiveNav('integrations')}>
                  View integrations
                  <Icon name="arrow-right" />
                </button>
              </div>
              <div className="integration-grid">
                {integrationCards.map((integration) => (
                  <button
                    key={integration.id}
                    type="button"
                    className={`panel integration-card ${integration.connected ? 'connected' : ''}`}
                    onClick={() => setActiveNav(integration.id === 'lemonsqueezy' ? 'pricing' : 'integrations')}
                  >
                    <div className="integration-mark">{integration.mark}</div>
                    <div className="integration-copy">
                      <strong>{integration.name}</strong>
                      <span>{integration.category}</span>
                      <small>{integration.detail}</small>
                    </div>
                    <div className={`integration-state ${integration.connected ? 'on' : 'off'}`}>{integration.connected ? 'Configured' : 'Needs setup'}</div>
                  </button>
                ))}
              </div>

              <div className="trust-strip">
                <div className="trust-item"><Icon name="shield" /><span>{status?.storage.dataDir || 'Local storage path unavailable'}</span></div>
                <div className="trust-item"><Icon name="server" /><span>{remoteAccess?.enabled ? `Phone access on ${remoteAccess.selectedLanUrl}` : 'Phone access disabled'}</span></div>
                <div className="trust-item"><Icon name="brand" /><span>{billing?.ready ? 'Checkout endpoints configured' : 'Billing still needs configuration'}</span></div>
              </div>
            </section>
          </>
        )}

        {activeNav === 'workflows' && (
          <section className="page-stack">
            <PageHeader
              kicker="Workflows"
              title="Operational checklist from live state."
              description="These onboarding steps are computed from real discovery, providers, projects, sessions, and phone access."
              actionLabel="Refresh daemon data"
              onAction={() => void refresh()}
            />
            <div className="workflow-grid workflow-grid-five">
              {workflowItems.map((workflow) => (
                <WorkflowStep key={workflow.id} workflow={workflow} onPrimaryAction={() => void (workflow.run ? workflow.run() : Promise.resolve(setActiveNav(workflow.nav)))} />
              ))}
            </div>
          </section>
        )}

        {activeNav === 'worktrees' && (
          <section className="page-stack">
            <PageHeader
              kicker="Worktrees"
              title="Real project registration and workspace status."
              description="Talocode stores projects here. Register repositories and track path health and session counts."
              actionLabel="Refresh"
              onAction={() => void refresh()}
            />
            <div className="split-dashboard-grid">
              <section className="panel form-panel">
                <h3>Register project</h3>
                <p className="muted">Use an absolute path. Talocode validates it before saving.</p>
                <label>Project path<input value={projectForm.path} onChange={(event) => setProjectForm((current) => ({ ...current, path: event.target.value }))} placeholder="C:\\code\\my-project" /></label>
                <label>Description<input value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional description" /></label>
                <div className="action-row">
                  <button type="button" className="ghost-action compact" onClick={() => void browseProjectPath()}>Browse</button>
                  <button type="button" className="ghost-action compact" onClick={() => void registerProject()} disabled={busy || !projectForm.path.trim()}>Add project</button>
                </div>
              </section>
              <section className="panel content-panel">
                <div className="section-heading section-heading-inline">
                  <div>
                    <h3>Registered projects</h3>
                    <p>{projects.length ? `${projects.length} projects stored locally.` : 'No projects registered yet.'}</p>
                  </div>
                </div>
                <div className="info-grid">
                  {projects.map((project) => (
                    <article key={project.id} className="panel info-card">
                      <div className="info-card-top">
                        <strong>{project.name}</strong>
                        <span className="info-pill">{project.pathStatus || 'unknown'}</span>
                      </div>
                      <p>{project.path}</p>
                      <small>{project.sessionsCount || 0} sessions · {project.description || 'No description'}</small>
                    </article>
                  ))}
                  {!projects.length && <EmptyState title="No workspaces yet." detail="Register a local repository to start creating sessions." />}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeNav === 'sessions' && (
          <section className="page-stack">
            <PageHeader
              kicker="Sessions"
              title="Live sessions on the real daemon."
              description="Create, start, stop, restart, and inspect actual Talocode sessions."
              actionLabel="Open logs"
              onAction={() => selectedSessionId ? void openSessionLogs(selectedSessionId) : setActiveNav('logs')}
            />
            <div className="split-dashboard-grid">
              <section className="panel form-panel">
                <h3>Create session</h3>
                <label>Project<select value={sessionForm.projectId} onChange={(event) => setSessionForm((current) => ({ ...current, projectId: event.target.value }))}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                <label>Agent<select value={sessionForm.agentId} onChange={(event) => setSessionForm((current) => ({ ...current, agentId: event.target.value }))}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select></label>
                <label>Provider<select value={sessionForm.providerId} onChange={(event) => setSessionForm((current) => ({ ...current, providerId: event.target.value }))}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
                <label>Model<input value={sessionForm.model} onChange={(event) => setSessionForm((current) => ({ ...current, model: event.target.value }))} placeholder={providers.find((provider) => provider.id === sessionForm.providerId)?.defaultModel || 'model'} /></label>
                <label>Mode<select value={sessionForm.mode} onChange={(event) => setSessionForm((current) => ({ ...current, mode: event.target.value as 'pty' | 'process' }))}><option value="pty">PTY</option><option value="process">Process</option></select></label>
                <div className="action-row">
                  <button type="button" className="ghost-action compact" onClick={() => void createSession(false)} disabled={busy || !sessionForm.projectId}>Create only</button>
                  <button type="button" className="ghost-action compact" onClick={() => void createSession(true)} disabled={busy || !sessionForm.projectId}>Create and start</button>
                </div>
              </section>
              <section className="panel content-panel">
                <div className="section-heading section-heading-inline">
                  <div>
                    <h3>Stored sessions</h3>
                    <p>{sessions.length ? `${sessions.length} sessions found.` : 'No sessions yet.'}</p>
                  </div>
                </div>
                <div className="session-list-grid">
                  {sessions.map((session) => (
                    <article key={session.id} className={`panel session-list-card ${selectedSessionId === session.id ? 'selected' : ''}`}>
                      <button type="button" className="card-select-overlay" onClick={() => setSelectedSessionId(session.id)} aria-label={`Select ${session.agentId}`} />
                      <div className="info-card-top">
                        <strong>{session.model || session.agentId}</strong>
                        <span className="info-pill">{session.status}</span>
                      </div>
                      <p>{session.providerId} · {session.mode || 'process'}</p>
                      <small>{session.cwd}</small>
                      <div className="action-row">
                        <button type="button" className="ghost-action compact" onClick={() => void sessionAction(session.id, 'start')}>Start</button>
                        <button type="button" className="ghost-action compact" onClick={() => void sessionAction(session.id, 'stop')}>Stop</button>
                        <button type="button" className="ghost-action compact" onClick={() => void sessionAction(session.id, 'restart')}>Restart</button>
                        <button type="button" className="ghost-action compact" onClick={() => void openSessionLogs(session.id)}>Logs</button>
                      </div>
                    </article>
                  ))}
                  {!sessions.length && <EmptyState title="No sessions stored." detail="Create a session once a project and provider are ready." />}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeNav === 'logs' && (
          <section className="page-stack">
            <PageHeader
              kicker="Logs"
              title="Session output from the daemon."
              description="This page reads live session log files from the backend. Nothing here is synthetic."
              actionLabel="Refresh logs"
              onAction={() => selectedSessionId ? void openSessionLogs(selectedSessionId) : void refresh()}
            />
            <div className="split-dashboard-grid">
              <section className="panel content-panel">
                <h3>Sessions</h3>
                <div className="session-list-grid">
                  {sessions.map((session) => (
                    <button key={session.id} type="button" className={`panel log-session-button ${selectedSessionId === session.id ? 'selected' : ''}`} onClick={() => setSelectedSessionId(session.id)}>
                      <strong>{session.model || session.agentId}</strong>
                      <span>{session.status}</span>
                      <small>{session.logsPath}</small>
                    </button>
                  ))}
                  {!sessions.length && <EmptyState title="No session logs available." detail="Create a session first, then return here." />}
                </div>
              </section>
              <section className="panel console-card">
                <div className="info-card-top">
                  <strong>{selectedSession ? `${selectedSession.agentId} log output` : 'No session selected'}</strong>
                  {selectedSession ? <span className="info-pill">{selectedSession.status}</span> : null}
                </div>
                <pre className="logs live-terminal">{selectedSessionLogs || 'No output yet.'}</pre>
              </section>
            </div>
          </section>
        )}

        {activeNav === 'approvals' && (
          <section className="page-stack">
            <PageHeader
              kicker="Approvals"
              title="Real blockers and missing setup."
              description="Talocode does not yet persist a dedicated approvals queue, so this page surfaces actual action blockers from the daemon instead of inventing review items."
            />
            <div className="info-grid">
              {approvalItems.map((item) => (
                <article key={item.id} className="panel info-card">
                  <div className="info-card-top">
                    <strong>{item.title}</strong>
                    <span className="info-pill">needs action</span>
                  </div>
                  <p>{item.detail}</p>
                  <button type="button" className="ghost-action compact" onClick={() => setActiveNav(item.action === 'Open pricing' ? 'pricing' : item.action === 'Open settings' ? 'settings' : 'integrations')}>
                    {item.action}
                  </button>
                </article>
              ))}
              {!approvalItems.length && <EmptyState title="No current blockers." detail="Discovery, providers, billing, and phone access are not reporting outstanding setup issues right now." />}
            </div>
          </section>
        )}

        {activeNav === 'integrations' && (
          <section className="page-stack">
            <PageHeader
              kicker="Integrations"
              title="Provider management and config generation."
              description="Manage actual providers, refresh models, and generate OpenAI-compatible config files from live daemon state."
            />
            <div className="split-dashboard-grid">
              <section className="panel form-panel">
                <h3>Add or update provider</h3>
                <label>Type<select value={providerForm.type} onChange={(event) => setProviderForm((current) => ({ ...current, type: event.target.value as ProviderType }))}><option value="ollama">Ollama</option><option value="openrouter">OpenRouter</option><option value="openai-compatible">OpenAI-compatible</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
                <label>Name<input value={providerForm.name} onChange={(event) => setProviderForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Base URL<input value={providerForm.baseUrl} onChange={(event) => setProviderForm((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
                <label>API key env var<input value={providerForm.apiKeyEnvVar} onChange={(event) => setProviderForm((current) => ({ ...current, apiKeyEnvVar: event.target.value }))} placeholder="OPENROUTER_API_KEY" /></label>
                <label>Default model<input value={providerForm.defaultModel} onChange={(event) => setProviderForm((current) => ({ ...current, defaultModel: event.target.value }))} placeholder="gpt-4o-mini" /></label>
                <button type="button" className="ghost-action compact" onClick={() => void saveProvider()} disabled={busy}>Save provider</button>
              </section>

              <section className="panel form-panel">
                <h3>Generate config</h3>
                <label>Target tool<select value={integrationForm.targetTool} onChange={(event) => setIntegrationForm((current) => ({ ...current, targetTool: event.target.value }))}><option value="codex">Codex</option><option value="opencode">OpenCode</option></select></label>
                <label>Provider<select value={integrationForm.providerId} onChange={(event) => setIntegrationForm((current) => ({ ...current, providerId: event.target.value }))}>{integrationProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
                <label>Model<input value={integrationForm.model} onChange={(event) => setIntegrationForm((current) => ({ ...current, model: event.target.value }))} placeholder="Leave blank for provider default" /></label>
                <div className="action-row">
                  <button type="button" className="ghost-action compact" onClick={() => void runIntegrationPreview(false)} disabled={busy || !integrationProviders.length}>Preview</button>
                  <button type="button" className="ghost-action compact" onClick={() => void runIntegrationPreview(true)} disabled={busy || !integrationProviders.length}>Write config</button>
                </div>
                <pre className="logs integration-preview">{integrationResult ? JSON.stringify(integrationResult, null, 2) : 'No preview yet.'}</pre>
              </section>
            </div>

            <div className="info-grid three">
              {providers.map((provider) => (
                <article key={provider.id} className="panel info-card">
                  <div className="info-card-top">
                    <strong>{provider.name}</strong>
                    <span className="info-pill">{provider.status}</span>
                  </div>
                  <p>{provider.baseUrl}</p>
                  <small>{provider.defaultModel || 'No default model'} · {provider.apiKeyEnvVar || 'No env var'}</small>
                  <div className="action-row">
                    <button type="button" className="ghost-action compact" onClick={() => void providerAction(provider.id, 'test')}>Test</button>
                    <button type="button" className="ghost-action compact" onClick={() => void providerAction(provider.id, 'refresh')}>Refresh models</button>
                    <button type="button" className="ghost-action compact" onClick={() => void providerAction(provider.id, 'default')}>Set default</button>
                    <button type="button" className="ghost-action compact" onClick={() => void providerAction(provider.id, 'remove')}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeNav === 'pricing' && (
          <section className="page-stack">
            <PageHeader
              kicker="Pricing"
              title="Real Lemon Squeezy billing configuration."
              description="This page now reflects actual Talocode billing state. Checkout buttons call the daemon and open real Lemon Squeezy URLs when configuration is complete."
            />

            <section className="panel form-panel">
              <div className="billing-switch page-billing-switch" role="tablist" aria-label="Billing cycle">
                <button type="button" className={billingCycle === 'monthly' ? 'active' : ''} onClick={() => setBillingCycle('monthly')}>Monthly</button>
                <button type="button" className={billingCycle === 'annual' ? 'active' : ''} onClick={() => setBillingCycle('annual')}>Annual <span>(save 20%)</span></button>
              </div>
              <div className="billing-form-grid">
                <label>Store slug<input value={billingForm.storeSlug} onChange={(event) => setBillingForm((current) => ({ ...current, storeSlug: event.target.value }))} placeholder="talocode" /></label>
                <label>Contact sales URL<input value={billingForm.contactSalesUrl} onChange={(event) => setBillingForm((current) => ({ ...current, contactSalesUrl: event.target.value }))} placeholder="https://..." /></label>
                <label>Success URL<input value={billingForm.successUrl} onChange={(event) => setBillingForm((current) => ({ ...current, successUrl: event.target.value }))} placeholder="https://..." /></label>
                <label>Pro monthly variant<input value={billingForm.proMonthly} onChange={(event) => setBillingForm((current) => ({ ...current, proMonthly: event.target.value }))} /></label>
                <label>Pro annual variant<input value={billingForm.proAnnual} onChange={(event) => setBillingForm((current) => ({ ...current, proAnnual: event.target.value }))} /></label>
                <label>Team monthly variant<input value={billingForm.teamMonthly} onChange={(event) => setBillingForm((current) => ({ ...current, teamMonthly: event.target.value }))} /></label>
                <label>Team annual variant<input value={billingForm.teamAnnual} onChange={(event) => setBillingForm((current) => ({ ...current, teamAnnual: event.target.value }))} /></label>
                <label>Enterprise monthly variant<input value={billingForm.enterpriseMonthly} onChange={(event) => setBillingForm((current) => ({ ...current, enterpriseMonthly: event.target.value }))} /></label>
                <label>Enterprise annual variant<input value={billingForm.enterpriseAnnual} onChange={(event) => setBillingForm((current) => ({ ...current, enterpriseAnnual: event.target.value }))} /></label>
              </div>
              <div className="action-row">
                <button type="button" className="ghost-action compact" onClick={() => void saveBillingConfig()} disabled={busy}>Save billing config</button>
                <span className="muted">{billing?.ready ? 'Checkout is ready.' : billing?.issues.join(' ') || 'Billing not configured yet.'}</span>
              </div>
            </section>

            <div className="pricing-page-grid">
              {(['free', 'pro', 'team', 'enterprise'] as BillingPlanId[]).map((planId) => (
                <PricingCard
                  key={planId}
                  planId={planId}
                  billing={billing}
                  billingCycle={billingCycle}
                  onSelect={() => void startCheckout(planId)}
                />
              ))}
            </div>
          </section>
        )}

        {activeNav === 'team' && (
          <section className="page-stack">
            <PageHeader
              kicker="Team"
              title="Local operator and paired devices."
              description="Talocode does not persist a separate people directory yet, so this page shows the real local operator context and any paired phone devices."
            />
            <div className="split-dashboard-grid">
              <section className="panel info-card">
                <div className="info-card-top">
                  <strong>Desktop operator</strong>
                  <span className="info-pill">{health?.platform || 'offline'}</span>
                </div>
                <p>{status?.localApiUrl || API}</p>
                <small>{status?.storage.dataDir || 'No data directory available'}</small>
              </section>
              <section className="panel content-panel">
                <div className="section-heading section-heading-inline">
                  <div>
                    <h3>Paired devices</h3>
                    <p>{remoteAccess?.pairedDevices.length ? `${remoteAccess.pairedDevices.length} device records found.` : 'No paired devices.'}</p>
                  </div>
                </div>
                <div className="info-grid">
                  {remoteAccess?.pairedDevices.map((device) => (
                    <article key={device.id} className="panel info-card">
                      <div className="info-card-top">
                        <strong>{device.name}</strong>
                        <span className="info-pill">{device.revokedAt ? 'revoked' : 'active'}</span>
                      </div>
                      <p>{device.id}</p>
                      <small>Paired {formatDate(device.pairedAt)} · Last seen {device.lastSeenAt ? formatDate(device.lastSeenAt) : 'never'}</small>
                      <button type="button" className="ghost-action compact" onClick={() => void revokeDevice(device.id)}>Revoke</button>
                    </article>
                  ))}
                  {!remoteAccess?.pairedDevices.length && <EmptyState title="No paired devices." detail="Enable phone access in Settings to start pairing a device." />}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeNav === 'settings' && (
          <section className="page-stack">
            <PageHeader
              kicker="Settings"
              title="Daemon, phone access, and local export."
              description="Every control here maps to a real Talocode endpoint or a real local capability."
              actionLabel="Refresh"
              onAction={() => void refresh()}
            />

            <div className="split-dashboard-grid">
              <section className="panel form-panel">
                <h3>Daemon information</h3>
                <div className="settings-facts">
                  <span>API URL</span><strong>{status?.localApiUrl || API}</strong>
                  <span>Version</span><strong>{health?.version || 'unknown'}</strong>
                  <span>Data dir</span><strong>{health?.dataDir || 'unknown'}</strong>
                  <span>Discovery checked</span><strong>{status?.discovery.lastCheckedAt ? formatDate(status.discovery.lastCheckedAt) : 'never'}</strong>
                </div>
                <div className="action-row">
                  <button type="button" className="ghost-action compact" onClick={() => void exportConfig()} disabled={busy}>Copy export</button>
                  <button type="button" className="ghost-action compact" onClick={() => void resetConfig()} disabled={busy}>Reset local data</button>
                </div>
              </section>

              <section className="panel form-panel">
                <h3>Phone control</h3>
                <p className="muted">{remoteAccess?.enabled ? `LAN URL ${remoteAccess.selectedLanUrl || 'pending'}` : 'Phone access is disabled.'}</p>
                {(remoteAccess?.warnings || []).map((warning) => <div key={warning} className="notice warning">{warning}</div>)}
                <div className="action-row">
                  <button type="button" className="ghost-action compact" onClick={() => void remoteAction('/api/remote/access/enable')} disabled={busy}>Enable</button>
                  <button type="button" className="ghost-action compact" onClick={() => void remoteAction('/api/remote/access/disable')} disabled={busy}>Disable</button>
                  <button type="button" className="ghost-action compact" onClick={() => void remoteAction('/api/remote/access/rotate-token')} disabled={busy}>Rotate token</button>
                </div>
                <div className="settings-facts">
                  <span>Bind host</span><strong>{remoteAccess?.bindHost || '127.0.0.1'}</strong>
                  <span>Selected LAN URL</span><strong>{remoteAccess?.selectedLanUrl || 'none'}</strong>
                  <span>Paired devices</span><strong>{String(remoteAccess?.pairedDevicesCount || 0)}</strong>
                  <span>Last phone access</span><strong>{remoteAccess?.lastPhoneAccessAt ? formatDate(remoteAccess.lastPhoneAccessAt) : 'never'}</strong>
                </div>
              </section>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PageHeader({
  kicker,
  title,
  description,
  actionLabel,
  onAction,
}: {
  kicker: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="page-header panel">
      <div className="page-header-copy">
        <p className="pricing-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="inline-link" onClick={onAction}>
          {actionLabel}
          <Icon name="arrow-right" />
        </button>
      ) : null}
    </section>
  );
}

function MetricCard({ metric }: { metric: { title: string; value: string; detail: string; icon: IconName } }) {
  return (
    <article className="panel metric-card">
      <Icon name={metric.icon} />
      <div>
        <h4>{metric.title}</h4>
        <strong>{metric.value}</strong>
        <p>{metric.detail}</p>
      </div>
    </article>
  );
}

function WorkflowStep({
  workflow,
  onPrimaryAction,
}: {
  workflow: WorkflowState;
  onPrimaryAction: () => void;
}) {
  return (
    <article className={`panel workflow-card ${workflow.complete ? 'done' : ''}`}>
      <div className="workflow-step">{workflow.step}</div>
      <Icon name={workflow.icon} />
      <h4>{workflow.title}</h4>
      <p>{workflow.description}</p>
      <button type="button" className="ghost-action" onClick={onPrimaryAction}>
        {workflow.complete ? 'Completed' : workflow.action}
      </button>
    </article>
  );
}

function PricingCard({
  planId,
  billing,
  billingCycle,
  onSelect,
}: {
  planId: BillingPlanId;
  billing: BillingConfigView | null;
  billingCycle: BillingCycle;
  onSelect: () => void;
}) {
  const plan = planDefinitions[planId];
  const statusLabel = pricingStatusLabel(planId, billing, billingCycle);
  return (
    <article className={`pricing-card panel ${planId !== 'free' && billing?.ready ? 'selected' : ''}`}>
      <div className="pricing-card-head">
        <div>
          <h4>{plan.name}</h4>
          <p>{plan.description}</p>
        </div>
        <strong>{statusLabel}</strong>
      </div>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>
            <Icon name="check" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button type="button" className={`pricing-action ${planId !== 'free' && billing?.ready ? 'selected' : ''}`} onClick={onSelect}>
        {plan.cta}
      </button>
    </article>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="panel empty-panel">
      <strong>{title}</strong>
      <p>{detail}</p>
    </article>
  );
}

function pricingStatusLabel(planId: BillingPlanId, billing: BillingConfigView | null, billingCycle: BillingCycle) {
  if (planId === 'free') return 'Local use';
  if (!billing) return 'Loading';
  if (planId === 'enterprise') return billing.contactSalesUrl ? 'Sales ready' : 'Needs sales URL';
  return billing.checkoutTargets[planId][billingCycle] ? 'Checkout ready' : `Missing ${billingCycle} variant`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

async function runAction(action: () => Promise<void>, setBusy: (busy: boolean) => void, setError: (message: string) => void) {
  setBusy(true);
  setError('');
  try {
    await action();
  } catch (error) {
    setError(asError(error));
  } finally {
    setBusy(false);
  }
}

async function openExternal(url: string) {
  if (!url) return;
  if (window.electronAPI?.shell?.openExternal) {
    await window.electronAPI.shell.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function asError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function request<T,>(path: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : init.headers,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? String((payload as { error?: string }).error)
        : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function get<T,>(path: string): Promise<T> {
  return request<T>(path);
}

async function post<T,>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

async function patch<T,>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

async function del<T,>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

function Icon({ name }: { name: IconName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.95,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'home':
      return <svg {...common}><path d="M4 11.5 12 4l8 7.5" /><path d="M6.5 10.75V20h11V10.75" /></svg>;
    case 'workflow':
      return <svg {...common}><path d="M7 5v14" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="12" r="2" /><circle cx="7" cy="17" r="2" /><path d="M9 7h4a4 4 0 0 1 4 4v1" /><path d="M9 17h4a4 4 0 0 0 4-4v-1" /></svg>;
    case 'branch':
      return <svg {...common}><path d="M7 6v8" /><circle cx="7" cy="6" r="2" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /><path d="M7 14c0 2.5 2 4 4 4h4" /><path d="M13 10h2a2 2 0 0 1 2 2v4" /></svg>;
    case 'terminal':
      return <svg {...common}><path d="M5 6h14v12H5z" /><path d="m8 10 2 2-2 2" /><path d="M13 14h3" /></svg>;
    case 'logs':
      return <svg {...common}><path d="M7 5h10v14H7z" /><path d="M9 9h6" /><path d="M9 13h6" /></svg>;
    case 'approvals':
      return <svg {...common}><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'plug':
      return <svg {...common}><path d="M9 3v6" /><path d="M15 3v6" /><path d="M7 9h10" /><path d="M10 9v4a2 2 0 0 0 4 0V9" /><path d="M12 17v4" /></svg>;
    case 'dollar':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7v10" /><path d="M15 9.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1 1.8 3 2 3 1 3 2.5-1.3 2.5-3 2.5-3-.9-3-2" /></svg>;
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="10" r="2.5" /><path d="M4.5 19a4.5 4.5 0 0 1 9 0" /><path d="M14 19a3.5 3.5 0 0 1 5.5-2.9" /></svg>;
    case 'gear':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19 12h2M3 12h2M12 3v2M12 19v2M16.5 7.5l1.4-1.4M6.1 17.9l1.4-1.4M16.5 16.5l1.4 1.4M6.1 6.1l1.4 1.4" /></svg>;
    case 'arrow-right':
      return <svg {...common}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
    case 'check':
      return <svg {...common}><path d="m5 13 4 4L19 7" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6Z" /></svg>;
    case 'lock':
      return <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case 'monitor':
      return <svg {...common}><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M9 19h6" /><path d="M12 16v3" /></svg>;
    case 'phone':
      return <svg {...common}><path d="M8.5 4.5h5L15 8l-1.8 1.8c1.1 2.3 2.8 4 5 5.1L20 13.5v5l-1.8 1.8c-5.9-.6-12-6.7-12.6-12.6Z" /></svg>;
    case 'folder':
      return <svg {...common}><path d="M4 7h6l2 2h8v9H4z" /></svg>;
    case 'box':
      return <svg {...common}><path d="M4.5 8.5 12 4l7.5 4.5L12 13z" /><path d="M4.5 8.5V16.5L12 21l7.5-4.5V8.5" /><path d="M12 13v8" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="4.5" y="6" width="15" height="13" rx="2" /><path d="M8 4v4M16 4v4M4.5 10h15" /></svg>;
    case 'brand':
      return <svg {...common}><path d="M6 7h12" /><path d="M6 17h12" /><path d="M9 7 15 17" /></svg>;
    case 'server':
      return <svg {...common}><rect x="4" y="5" width="16" height="5" rx="1.5" /><rect x="4" y="14" width="16" height="5" rx="1.5" /><path d="M8 7.5h.01M8 16.5h.01" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
    default:
      return null;
  }
}
