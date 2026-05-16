import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentAdapterView, DaemonHealth, DiscoveryView, ProjectView, ProviderConfigView, RemoteAccessView, SessionView } from '../types';

type Page = 'home' | 'architecture' | 'providers' | 'agents' | 'projects' | 'sessions' | 'integrations' | 'settings';

type DaemonStatusView = {
  status: string;
  localApiUrl: string;
  storage: { status: string; dataDir: string; lastError?: string };
  discovery: { detected: number; missing: number; unknown: number; lastCheckedAt?: string };
  activeSessions: number;
  lastError?: string;
};

const API = import.meta.env.VITE_TALOCODE_API_URL || 'http://127.0.0.1:3768';
const pages: Page[] = ['home', 'architecture', 'providers', 'agents', 'projects', 'sessions', 'integrations', 'settings'];

export default function Dashboard() {
  const [page, setPage] = useState<Page>(window.location.pathname === '/architecture' ? 'architecture' : 'home');
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [status, setStatus] = useState<DaemonStatusView | null>(null);
  const [providers, setProviders] = useState<ProviderConfigView[]>([]);
  const [agents, setAgents] = useState<AgentAdapterView[]>([]);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryView[]>([]);
  const [remoteAccess, setRemoteAccess] = useState<RemoteAccessView | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHealth, nextStatus, nextProviders, nextAgents, nextProjects, nextSessions, nextDiscovery, nextRemoteAccess] = await Promise.all([
        get<DaemonHealth>('/health'),
        get<DaemonStatusView>('/api/status'),
        get<ProviderConfigView[]>('/api/providers'),
        get<AgentAdapterView[]>('/api/agents'),
        get<ProjectView[]>('/api/projects'),
        get<SessionView[]>('/api/sessions'),
        get<DiscoveryView[]>('/api/system/discover'),
        get<RemoteAccessView>('/api/remote/access'),
      ]);
      setHealth(nextHealth);
      setStatus(nextStatus);
      setProviders(nextProviders);
      setAgents(nextAgents);
      setProjects(nextProjects);
      setSessions(nextSessions);
      setDiscovery(nextDiscovery);
      setRemoteAccess(nextRemoteAccess);
      setMessage('');
    } catch {
      setMessage(`Daemon is offline. Start it with: talo start (${API})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const detected = discovery.filter((item) => item.status === 'detected');
  const recentSessions = [...sessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5);

  return (
    <div className="dashboard-shell">
      <aside className="cockpit-sidebar">
        <div className="brand-block"><div className="brand-mark">T</div><div><h1>Talocode</h1><span>Local-first control plane for coding agents</span></div></div>
        <nav>{pages.map((item) => <button key={item} className={page === item ? 'active' : ''} onClick={() => setPage(item)}>{label(item)}</button>)}</nav>
        <div className="daemon-pill"><StatusBadge status={health ? 'online' : 'offline'} /> {health ? `${health.platform} · v${health.version}` : 'Daemon offline'}</div>
      </aside>
      <main className="cockpit-main">
        <header className="topbar"><div><p className="eyebrow">Windows-first orchestration layer</p><h2>{label(page)}</h2></div><div className="topbar-actions"><span className="muted">{status?.localApiUrl || API}</span><button className="primary" onClick={() => void refresh()}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></header>
        {message && <div className="notice warning">{message}</div>}
        {page === 'home' && <Home health={health} status={status} providers={providers} detected={detected} projects={projects} sessions={recentSessions} remoteAccess={remoteAccess} onNavigate={setPage} onRemoteChanged={refresh} />}
        {page === 'architecture' && <Architecture />}
        {page === 'providers' && <Providers providers={providers} onChanged={refresh} />}
        {page === 'agents' && <Agents agents={agents} discovery={discovery} onChanged={refresh} />}
        {page === 'projects' && <Projects projects={projects} onChanged={refresh} />}
        {page === 'sessions' && <Sessions sessions={sessions} projects={projects} providers={providers} agents={agents} ptyAvailable={health?.ptyAvailable !== false} onChanged={refresh} />}
        {page === 'integrations' && <Integrations providers={providers} />}
        {page === 'settings' && <SettingsPanel health={health} status={status} remoteAccess={remoteAccess} onChanged={refresh} />}
      </main>
    </div>
  );
}

function Home({ health, status, providers, detected, projects, sessions, remoteAccess, onNavigate, onRemoteChanged }: { health: DaemonHealth | null; status: DaemonStatusView | null; providers: ProviderConfigView[]; detected: DiscoveryView[]; projects: ProjectView[]; sessions: SessionView[]; remoteAccess: RemoteAccessView | null; onNavigate: (page: Page) => void; onRemoteChanged: () => Promise<void> }) {
  return <div className="grid-page">
    <Stat title="Daemon" value={health ? 'Online' : 'Offline'} detail={health ? `${health.platform} · ${health.uptime}s uptime` : 'Run talo start'} />
    <Stat title="Detected tools" value={String(detected.length)} detail={`${status?.discovery.missing || 0} missing · last ${status?.discovery.lastCheckedAt ? new Date(status.discovery.lastCheckedAt).toLocaleTimeString() : 'never'}`} />
    <Stat title="Providers" value={String(providers.length)} detail={`${providers.filter((p) => p.status === 'configured').length} configured · default ${providers.find((p) => p.isDefault)?.name || 'unset'}`} />
    <Stat title="Active sessions" value={String(status?.activeSessions || sessions.filter((s) => s.status === 'running').length)} detail={`${sessions.length} recent sessions loaded`} />
    <section className="panel wide"><h3>Recent sessions</h3><CardList items={sessions.map((s) => ({ title: s.model || s.agentId, meta: `${s.agentId} · ${s.status}`, detail: s.cwd }))} /></section>
    <section className="panel wide"><h3>Registered projects</h3><CardList items={projects.slice(0, 5).map((p) => ({ title: p.name, meta: `${p.pathStatus || 'valid'} · ${p.sessionsCount || 0} sessions`, detail: p.path }))} /></section>
    <section className="panel wide"><h3>Quick actions</h3><div className="quick-links"><button onClick={() => onNavigate('architecture')}>View architecture</button><button onClick={() => onNavigate('agents')}>Discover tools</button><button onClick={() => onNavigate('providers')}>Configure providers</button><button onClick={() => onNavigate('sessions')}>Create session</button><button className="primary" onClick={async () => { if (!remoteAccess?.enabled) await post('/api/remote/access/enable', {}); onNavigate('settings'); await onRemoteChanged(); }}>{remoteAccess?.enabled ? 'Open phone pairing QR' : 'Enable phone control'}</button></div>{remoteAccess?.enabled && <p className="warning-text">Phone control is enabled at {remoteAccess.selectedLanUrl || 'LAN URL pending'}.</p>}</section>
  </div>;
}

function Architecture() {
  const sections = [
    { title: 'Access Layer', items: ['Phone Control', 'Desktop Dashboard', 'CLI', 'Local API Clients'], detail: 'Every surface talks to the same Talocode local API and daemon.' },
    { title: 'Talocode Core', items: ['Daemon / Background Service', 'Local HTTP API', 'Session Manager', 'Project & Config Manager', 'Discovery Engine'], detail: 'Core orchestration owns state, lifecycle, discovery, status, and safe config generation.' },
    { title: 'Agent Adapter Registry', items: ['Codex CLI', 'Codex App', 'Claude Code', 'OpenCode', 'Gemini CLI', 'Ollama Runtime'], detail: 'Known adapters define executable names, launch arguments, supported platforms, docs, and detection behavior.' },
    { title: 'Provider Router', items: ['Ollama Local', 'OpenRouter', 'Custom OpenAI-Compatible', 'Anthropic', 'Gemini'], detail: 'Providers share normalized metadata and secret-safe environment variable references.' },
    { title: 'Execution & Storage Layer', items: ['Local Project Paths', 'Talocode-managed worktrees', 'Child Processes / Agent Sessions', 'Logs & Session History', 'Settings / Local Persistence'], detail: 'Sessions run in validated project directories and persist logs/settings under the OS app-data directory.' },
    { title: 'Outcomes', items: ['Discover installed tools', 'Configure providers', 'Launch and resume sessions', 'Generate Codex/OpenCode configs', 'Manage projects across devices'], detail: 'Talocode turns local tools and providers into a cockpit that works from desktop, CLI, API, and phone.' },
  ];
  return <div className="architecture-page"><section className="panel hero-panel"><p className="eyebrow">Mermaid source of truth</p><h3>Talocode Architecture</h3><p className="muted">The architecture diagram is text-based in <code>docs/talocode-architecture.mmd</code> so PRs stay reviewable. The dashboard renders the same structure as React/CSS cards instead of binary image assets.</p></section><div className="architecture-map">{sections.map((section, index) => <section className="panel architecture-card" key={section.title}><div className="architecture-step">{index + 1}</div><h3>{section.title}</h3><p className="muted">{section.detail}</p><div className="architecture-items">{section.items.map((item) => <span key={item}>{item}</span>)}</div></section>)}</div></div>;
}

function Providers({ providers, onChanged }: { providers: ProviderConfigView[]; onChanged: () => Promise<void> }) {
  const [type, setType] = useState('ollama');
  const [name, setName] = useState('Ollama Local');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState('');
  const [model, setModel] = useState('');
  const [result, setResult] = useState('');
  return <div className="split-page"><section className="panel"><h3>Add or update provider</h3><div className="form-grid">
    <label>Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="ollama">Ollama</option><option value="openrouter">OpenRouter</option><option value="openai-compatible">OpenAI-compatible</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic placeholder</option><option value="gemini">Gemini placeholder</option></select></label>
    <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Base URL<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></label><label>API key env var<input value={apiKeyEnvVar} onChange={(e) => setApiKeyEnvVar(e.target.value)} placeholder="OPENROUTER_API_KEY" /></label><label>Default model<input value={model} onChange={(e) => setModel(e.target.value)} /></label>
    <button className="primary" onClick={async () => { await post('/api/providers', { type, name, baseUrl, apiKeyEnvVar: apiKeyEnvVar || undefined, defaultModel: model || undefined }); await onChanged(); }}>Save provider</button>{result && <p className="muted">{result}</p>}
  </div></section><section className="panel"><h3>Providers</h3><div className="card-list">{providers.map((p) => <div className="list-card" key={p.id}><div className="panel-title"><strong>{p.name}</strong><StatusBadge status={p.isDefault ? 'default' : p.status} /></div><span>{p.type} · {p.baseUrl}</span><small>{p.defaultModel || 'No default model'} · {p.availableModels?.length || 0} models {p.apiKeyEnvVar ? `· env ${p.apiKeyEnvVar}` : '· no API key required'}</small>{p.status === 'missing-api-key' && <small className="warning-text">Missing environment variable: {p.apiKeyEnvVar}</small>}<div className="row"><button onClick={async () => setResult(JSON.stringify(await post(`/api/providers/${p.id}/test`, {}), null, 2))}>Test</button><button onClick={async () => { setResult(JSON.stringify(await post(`/api/providers/${p.id}/models/refresh`, {}), null, 2)); await onChanged(); }}>Refresh models</button><button onClick={async () => { await post(`/api/providers/${p.id}/default`, {}); await onChanged(); }}>Set default</button><button onClick={async () => { await del(`/api/providers/${p.id}`); await onChanged(); }}>Remove</button></div></div>)}</div></section></div>;
}

function Agents({ agents, discovery, onChanged }: { agents: AgentAdapterView[]; discovery: DiscoveryView[]; onChanged: () => Promise<void> }) {
  const agentIds = new Set(agents.map((agent) => agent.id));
  const tools = [...discovery.filter((tool) => agentIds.has(tool.id)), ...discovery.filter((tool) => !agentIds.has(tool.id))];
  return <div className="architecture-page"><section className="panel"><div className="panel-title"><h3>Discovery</h3><button className="primary" onClick={async () => { await post('/api/system/discover/refresh', {}); await onChanged(); }}>Refresh discovery</button></div><p className="muted">Checks PATH with {navigator.platform.toLowerCase().includes('win') ? 'where' : 'which'} and collects versions with timeouts.</p></section><div className="card-grid">{tools.map((tool) => <section className="panel" key={tool.id}><div className="panel-title"><h3>{tool.name || tool.displayName}</h3><StatusBadge status={tool.status} /></div><p className="muted">Executable: {tool.path || tool.executable || 'Not found'}</p><p className="muted">Version: {tool.version || 'Unknown'}</p><p className="muted">Hint: {tool.installHint}</p><a href={tool.docsUrl}>Docs</a></section>)}</div></div>;
}

function Projects({ projects, onChanged }: { projects: ProjectView[]; onChanged: () => Promise<void> }) {
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  return <div className="split-page"><section className="panel"><h3>Register project</h3><p className="muted">Use an absolute path. Talocode validates that it exists before saving.</p><input value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\\code\\my-app" /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" /><button className="primary" onClick={async () => { await post('/api/projects', { path, description }); setPath(''); setDescription(''); await onChanged(); }}>Add project</button></section><section className="panel"><h3>Projects</h3><div className="card-list">{projects.map((p) => <div className="list-card" key={p.id}><div className="panel-title"><strong>{p.name}</strong><StatusBadge status={p.pathStatus || 'valid'} /></div><span>{p.path}</span><small>{p.sessionsCount || 0} sessions · {p.description || 'No description'}</small><div className="row"><button onClick={async () => { await del(`/api/projects/${p.id}`); await onChanged(); }}>Remove</button></div></div>)}</div></section></div>;
}

function Sessions({ sessions, projects, providers, agents, ptyAvailable, onChanged }: { sessions: SessionView[]; projects: ProjectView[]; providers: ProviderConfigView[]; agents: AgentAdapterView[]; ptyAvailable: boolean; onChanged: () => Promise<void> }) {
  const [projectId, setProjectId] = useState('');
  const [agentId, setAgentId] = useState('codex-cli');
  const [providerId, setProviderId] = useState('ollama');
  const [model, setModel] = useState('');
  const [mode, setMode] = useState('pty');
  const [selected, setSelected] = useState<SessionView | null>(null);
  const [logs, setLogs] = useState('');
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const currentProvider = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId]);
  const currentAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const commandPreview = `${currentAgent?.executableNames?.[0] || agentId} ${model || currentProvider?.defaultModel || ''}`.trim();

  useEffect(() => {
    if (!selected) return;
    const events = new EventSource(`${API}/api/sessions/${selected.id}/stream`);
    events.onmessage = (event) => appendEvent(event.data);
    for (const eventName of ['output', 'session_started', 'session_stopped', 'session_failed', 'session_completed', 'input_ack', 'resized']) {
      events.addEventListener(eventName, (event) => appendEvent((event as MessageEvent).data));
    }
    return () => events.close();
  }, [selected?.id]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = document.querySelector('.logs.live-terminal');
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll]);

  function appendEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as { type: string; data?: string; status?: string; error?: string; exitCode?: number | null };
      if (event.type === 'output' && event.data) setLogs((prev) => prev + event.data);
      if (event.type.startsWith('session_')) setLogs((prev) => `${prev}\n[${event.type}] ${event.status || ''} ${event.error || ''} ${event.exitCode ?? ''}\n`);
    } catch {}
  }

  async function createSession(startNow: boolean) {
    const created = await post<SessionView>('/api/sessions', { projectId, agentId, providerId, model: model || undefined, mode });
    setSelected(created);
    await onChanged();
    if (startNow) {
      const started = await post<SessionView>(`/api/sessions/${created.id}/start`, {});
      setSelected(started);
      await onChanged();
    }
  }

  async function selectSession(s: SessionView) {
    const full = await get<SessionView>(`/api/sessions/${s.id}`);
    setSelected(full);
    setLogs(full.logsTail || '');
  }

  return <div className="split-page"><section className="panel"><h3>Create live session</h3><div className="form-grid"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select project</option>{projects.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Agent<select value={agentId} onChange={(e) => setAgentId(e.target.value)}>{agents.map((a) => <option value={a.id} key={a.id}>{a.displayName}</option>)}</select></label><label>Provider<select value={providerId} onChange={(e) => setProviderId(e.target.value)}>{providers.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Model<input value={model} onChange={(e) => setModel(e.target.value)} placeholder={currentProvider?.defaultModel || 'model'} /></label><label>Mode<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="pty">PTY live terminal</option><option value="process">Process fallback</option></select></label><div className="notice"><strong>Command preview:</strong> {commandPreview || 'Select an agent'}<br/><span className="muted">cwd: {selectedProject?.path || 'Select a project'}</span></div>{!ptyAvailable && mode === 'pty' && <div className="notice warning">node-pty is unavailable. Talocode will fall back to process mode; install Windows build tools and reinstall optional dependencies for PTY support.</div>}{currentAgent?.status !== 'detected' && <div className="notice warning">Selected agent may not be detected. Start will fail until it is installed in PATH.</div>}{currentProvider?.status === 'missing-api-key' && <div className="notice warning">Provider env var missing: {currentProvider.apiKeyEnvVar}</div>}<button className="primary" onClick={() => void createSession(true)}>Create and Start Session</button><button onClick={() => void createSession(false)}>Create Only</button></div></section><section className="panel"><h3>Recent sessions</h3>{sessions.map((s) => <div className="list-card" key={s.id} onClick={() => void selectSession(s)}><div className="panel-title"><strong>{s.model || s.agentId}</strong><StatusBadge status={s.status === 'running' ? 'live' : s.status} /></div><span>{s.agentId} · {s.providerId} · {s.mode || 'process'}</span><small>{s.command}</small><div className="row"><button onClick={async (e) => { e.stopPropagation(); await post(`/api/sessions/${s.id}/start`, {}); await onChanged(); }}>Start</button><button onClick={async (e) => { e.stopPropagation(); await post(`/api/sessions/${s.id}/stop`, {}); await onChanged(); }}>Stop</button><button onClick={async (e) => { e.stopPropagation(); await post(`/api/sessions/${s.id}/restart`, {}); await onChanged(); }}>Restart</button><button onClick={async (e) => { e.stopPropagation(); await selectSession(s); }}>Open</button></div></div>)}</section>{selected && <section className="panel wide"><div className="panel-title"><h3>{selected.agentId} · {selected.model || 'default model'}</h3><StatusBadge status={selected.status === 'running' ? 'live' : selected.status} /></div><p className="muted">Project: {selected.cwd} · Provider: {selected.providerId} · PID: {selected.pid || selected.processId || 'n/a'} · Logs: {selected.logsPath}</p>{selected.error && <div className="notice warning">{selected.error}</div>}<div className="row"><label><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll</label><button onClick={() => setLogs('')}>Clear view</button><button onClick={() => void selectSession(selected)}>Reconnect</button><button onClick={() => void navigator.clipboard?.writeText(logs)}>Copy logs</button></div><pre className="logs live-terminal">{logs || 'No live output yet. Start the session or reconnect to stream output.'}</pre><div className="row"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter') { await post(`/api/sessions/${selected.id}/input`, { data: `${input}\n` }); setInput(''); } }} placeholder="Type input and press Enter" /><button className="primary" onClick={async () => { await post(`/api/sessions/${selected.id}/input`, { data: `${input}\n` }); setInput(''); }}>Send</button><button onClick={() => void post(`/api/sessions/${selected.id}/resize`, { cols: 120, rows: 30 })}>Resize 120×30</button></div>{selected.mode === 'process' && <p className="muted">Process mode fallback is active. PTY features may be limited if node-pty is unavailable.</p>}</section>}</div>;
}

function Integrations({ providers }: { providers: ProviderConfigView[] }) {
  const [targetTool, setTargetTool] = useState('codex');
  const [providerId, setProviderId] = useState('ollama');
  const [model, setModel] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const body = { targetTool, providerId, model: model || undefined };
  return <div className="split-page"><section className="panel"><h3>OpenAI-compatible config</h3><p className="muted">Preview first. Writes create timestamped backups and use env-var references only.</p><div className="form-grid"><label>Tool<select value={targetTool} onChange={(e) => setTargetTool(e.target.value)}><option value="codex">Codex</option><option value="opencode">OpenCode</option></select></label><label>Provider<select value={providerId} onChange={(e) => setProviderId(e.target.value)}>{providers.filter((p) => p.supportsOpenAICompatibleApi).map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Model<input value={model} onChange={(e) => setModel(e.target.value)} /></label><button className="primary" onClick={async () => setResult(await post('/api/integrations/config/preview', body))}>Preview</button><button onClick={async () => setResult(await post('/api/integrations/config/write', body))}>Write with backup</button></div></section><section className="panel"><h3>Generated config</h3><pre className="logs">{result ? JSON.stringify(result, null, 2) : 'Choose a provider and preview config.'}</pre></section></div>;
}

function SettingsPanel({ health, status, remoteAccess, onChanged }: { health: DaemonHealth | null; status: DaemonStatusView | null; remoteAccess: RemoteAccessView | null; onChanged: () => Promise<void> }) {
  const [exported, setExported] = useState('');
  const [lastToken, setLastToken] = useState<RemoteAccessView | null>(null);
  async function remoteAction(path: string) {
    const result = await post<RemoteAccessView>(path, {});
    if ('pairingToken' in result) setLastToken(result);
    await onChanged();
  }
  async function revoke(deviceId: string) {
    await post('/api/remote/access/revoke-device', { deviceId });
    await onChanged();
  }
  return <div className="split-page"><section className="panel"><h3>Settings</h3><p>Talocode API URL: {status?.localApiUrl || API}</p><p>Version: {health?.version || 'unknown'} · Platform: {health?.platform || 'unknown'}</p><p>Talocode data directory: {health?.dataDir || 'Unknown until daemon is online'}</p><p className="muted">Secrets are referenced by environment variable name and are never stored as raw values.</p><div className="row"><button onClick={async () => setExported(JSON.stringify(await get('/api/settings/export'), null, 2))}>Export local config</button><button onClick={async () => { if (window.confirm('Reset Talocode local data?')) await post('/api/settings/reset', {}); }}>Reset local data</button></div>{exported && <pre className="logs">{exported}</pre>}</section><section className="panel"><h3>Talocode Phone Control</h3><div className="phone-control"><StatusBadge status={remoteAccess?.enabled ? 'running' : 'stopped'} /><p className="muted">Enable LAN phone control only on trusted networks. Pairing tokens are shown only when generated or rotated.</p>{remoteAccess?.warnings.map((warning) => <div className="notice warning" key={warning}>{warning}</div>)}<p>Selected LAN URL: {remoteAccess?.selectedLanUrl || 'No LAN URL detected'}</p><CardList items={(remoteAccess?.lanUrls || []).map((url) => ({ title: url, meta: 'LAN candidate', detail: url === remoteAccess?.selectedLanUrl ? 'selected' : 'candidate' }))} /><div className="row"><button className="primary" onClick={() => void remoteAction('/api/remote/access/enable')}>Enable phone access</button><button onClick={() => void remoteAction('/api/remote/access/disable')}>Disable</button><button onClick={() => void remoteAction('/api/remote/access/rotate-token')}>Rotate token</button></div>{lastToken?.pairingToken && <div className="token-box"><strong>Pairing token (shown once)</strong><code>{lastToken.pairingToken}</code><strong>Phone URL</strong><code>{lastToken.phoneUrl}</code><div className="qr-placeholder">QR payload:<br />{lastToken.qrPayload}</div><button onClick={() => void navigator.clipboard?.writeText(lastToken.phoneUrl || '')}>Copy phone URL</button></div>}<h4>Paired devices</h4>{(remoteAccess?.pairedDevices || []).map((device) => <div className="list-card" key={device.id}><div className="panel-title"><strong>{device.name}</strong><StatusBadge status={device.revokedAt ? 'stopped' : 'running'} /></div><small>{device.id} · paired {new Date(device.pairedAt).toLocaleString()} · last {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'never'}</small><button onClick={() => void revoke(device.id)}>Revoke device</button></div>)}</div></section></div>;
}

function Stat({ title, value, detail }: { title: string; value: string; detail: string }) { return <section className="panel stat"><span>{title}</span><strong>{value}</strong><p>{detail}</p></section>; }
function StatusBadge({ status }: { status: string }) { return <span className={`status-badge ${status}`}>{status}</span>; }
function CardList({ items }: { items: { title: string; meta: string; detail: string }[] }) { return <div className="card-list">{items.length ? items.map((item) => <div className="list-card" key={`${item.title}-${item.meta}`}><strong>{item.title}</strong><span>{item.meta}</span><small>{item.detail}</small></div>) : <p className="muted">Nothing here yet.</p>}</div>; }
function label(page: Page) { return page === 'architecture' ? 'Architecture' : page[0].toUpperCase() + page.slice(1); }
async function get<T>(path: string): Promise<T> { const r = await fetch(`${API}${path}`); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function post<T>(path: string, body: unknown): Promise<T> { const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function del<T>(path: string): Promise<T> { const r = await fetch(`${API}${path}`, { method: 'DELETE' }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
