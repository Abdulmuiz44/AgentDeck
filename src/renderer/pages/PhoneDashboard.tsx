import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentAdapterView, ProjectView, ProviderConfigView, SessionView } from '../types';

type Tab = 'home' | 'sessions' | 'projects' | 'providers' | 'agents' | 'settings';
type PhoneDevice = { id: string; name: string; pairedAt: string; lastSeenAt?: string; expiresAt: string };
type Snapshot = { status: { status: string; activeSessions: number; localApiUrl: string }; providers: ProviderConfigView[]; agents: AgentAdapterView[]; projects: ProjectView[]; sessions: SessionView[] };

const API = window.location.origin;
const TOKEN_KEY = 'talocode_phone_token';
const DEVICE_KEY = 'talocode_phone_device';
const LEGACY_TOKEN_KEY = 'agentdeck_phone_token';
const LEGACY_DEVICE_KEY = 'agentdeck_phone_device';

export default function PhoneDashboard() {
  const queryToken = useMemo(() => new URLSearchParams(window.location.search).get('pair') || '', []);
  const [accessToken, setAccessToken] = useState(() => legacyLocalStorageValue(TOKEN_KEY, LEGACY_TOKEN_KEY));
  const [device, setDevice] = useState<PhoneDevice | null>(() => safeStoredDevice());
  const [pairToken, setPairToken] = useState(queryToken);
  const [tab, setTab] = useState<Tab>('home');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<SessionView | null>(null);
  const [logs, setLogs] = useState('');
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const auth = useCallback(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);
  const clearPairing = useCallback((reason: string) => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(DEVICE_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_DEVICE_KEY);
    setAccessToken('');
    setDevice(null);
    setSnapshot(null);
    setMessage(reason);
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const next = await request<Snapshot>('/api/phone/snapshot', { headers: auth() });
      setSnapshot({ ...next, providers: next.providers || [], agents: next.agents || [], projects: next.projects || [], sessions: next.sessions || [] });
      setMessage('');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Phone access failed';
      if (/401|authorization|disabled|revoked|expired/i.test(text)) clearPairing('Phone access was revoked, disabled, or expired. Pair again from the desktop.');
      else setMessage(`Daemon unreachable from this phone: ${text}`);
    }
  }, [accessToken, auth, clearPairing]);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 8000); return () => window.clearInterval(timer); }, [refresh]);

  async function pair() {
    setBusy(true);
    setMessage('Pairing this phone…');
    try {
      const response = await request<{ accessToken: string; device: PhoneDevice }>('/api/remote/pair', { method: 'POST', body: { token: pairToken.trim(), deviceName: navigator.userAgent.includes('Android') ? 'Android Chrome' : 'Phone browser', userAgent: navigator.userAgent } });
      window.localStorage.setItem(TOKEN_KEY, response.accessToken);
      window.localStorage.setItem(DEVICE_KEY, JSON.stringify(response.device));
      setAccessToken(response.accessToken);
      setDevice(response.device);
      setMessage('Phone paired. Keep this browser profile private.');
    } catch (error) {
      setMessage(error instanceof Error ? `Pairing failed: ${error.message}` : 'Pairing failed. Check the token and phone access status.');
    } finally {
      setBusy(false);
    }
  }

  async function sessionAction(sessionId: string, action: 'start' | 'stop' | 'restart') {
    setBusy(true);
    try {
      await request(`/api/sessions/${encodeURIComponent(sessionId)}/${action}`, { method: 'POST', headers: auth() });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to ${action} session`);
    } finally {
      setBusy(false);
    }
  }

  async function openSession(session: SessionView) {
    setSelected(session);
    setTab('sessions');
    try {
      const result = await request<{ text: string }>(`/api/sessions/${encodeURIComponent(session.id)}/logs`, { headers: auth() });
      setLogs(result.text || session.logsTail || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load logs');
    }
  }

  async function logout() {
    await request('/api/remote/logout', { method: 'POST', headers: auth() }).catch(() => undefined);
    clearPairing('This phone is logged out.');
  }

  if (!accessToken) {
    return <main className="phone-shell"><section className="phone-card hero"><div className="brand-mark">T</div><h1>Talocode Phone Control</h1><p>Pair this phone with Talocode only when it is on the same trusted LAN as your desktop. The token is shown by the Talocode daemon only when generated or rotated.</p><label>Pairing token<input value={pairToken} onChange={(event) => setPairToken(event.target.value)} placeholder="Paste token from desktop" autoComplete="one-time-code" /></label><button className="primary touch" disabled={!pairToken.trim() || busy} onClick={() => void pair()}>{busy ? 'Pairing…' : 'Pair this phone'}</button>{message && <p className="warning-text">{message}</p>}</section></main>;
  }

  const sessions = snapshot?.sessions || [];
  const activeSessions = sessions.filter((session) => session.status === 'running');

  return <div className="phone-shell paired"><header className="phone-header"><div><p className="eyebrow">Talocode Phone Control</p><h1>{label(tab)}</h1></div><StatusBadge status={snapshot ? 'online' : 'offline'} /></header>{message && <div className="notice warning">{message}</div>}
    {tab === 'home' && <section className="phone-grid"><PhoneStat title="Talocode daemon" value={snapshot?.status?.status || 'offline'} /><PhoneStat title="Active" value={String(snapshot?.status?.activeSessions || activeSessions.length)} /><PhoneStat title="Projects" value={String(snapshot?.projects.length || 0)} /><PhoneStat title="Providers" value={String(snapshot?.providers.length || 0)} /><div className="phone-card"><h2>Quick actions</h2><button className="touch" onClick={() => setTab('sessions')}>Manage sessions</button><button className="touch" disabled={busy} onClick={() => void refresh()}>Refresh cockpit</button></div><SessionList sessions={sessions.slice(0, 4)} onOpen={openSession} onAction={sessionAction} /></section>}
    {tab === 'sessions' && <section className="phone-grid"><SessionList sessions={sessions} onOpen={openSession} onAction={sessionAction} />{selected && <div className="phone-card"><div className="panel-title"><h2>{selected.agentId}</h2><StatusBadge status={selected.status} /></div><p>{selected.cwd}</p><p className="muted">{selected.providerId} · {selected.model || 'default'} · {selected.mode || 'process'}</p><div className="row"><button disabled={busy} onClick={() => void sessionAction(selected.id, 'start')}>Start</button><button disabled={busy} onClick={() => void sessionAction(selected.id, 'stop')}>Stop</button><button disabled={busy} onClick={() => void sessionAction(selected.id, 'restart')}>Restart</button></div><pre className="logs phone-logs">{logs || 'No logs yet.'}</pre><div className="row"><button onClick={() => void navigator.clipboard?.writeText(logs)}>Copy logs</button><button onClick={() => void openSession(selected)}>Reload logs</button></div><div className="row"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Send input" /><button disabled={busy || !input.trim()} onClick={async () => { await request(`/api/sessions/${selected.id}/input`, { method: 'POST', headers: auth(), body: { data: `${input}\n` } }); setInput(''); }}>Send</button></div></div>}</section>}
    {tab === 'projects' && <section className="phone-grid">{snapshot?.projects.length ? snapshot.projects.map((project) => <div className="phone-card" key={project.id}><h2>{project.name}</h2><p>{project.path}</p><small>{project.sessionsCount || 0} sessions · {project.pathStatus || 'unknown'}</small></div>) : <EmptyCard text="No projects are registered yet. Add projects from the desktop dashboard or CLI." />}</section>}
    {tab === 'providers' && <section className="phone-grid">{snapshot?.providers.length ? snapshot.providers.map((provider) => <div className="phone-card" key={provider.id}><div className="panel-title"><h2>{provider.name}</h2><StatusBadge status={provider.status} /></div><p>{provider.type} · {provider.baseUrl}</p><small>{provider.apiKeyEnvVar ? `Uses ${provider.apiKeyEnvVar}` : 'No API key required'} · {provider.availableModels?.length || 0} models</small></div>) : <EmptyCard text="No providers are configured yet." />}</section>}
    {tab === 'agents' && <section className="phone-grid">{snapshot?.agents.length ? snapshot.agents.map((agent) => <div className="phone-card" key={agent.id}><div className="panel-title"><h2>{agent.displayName}</h2><StatusBadge status={agent.status} /></div><p>{agent.executableNames.join(', ')}</p><small>{agent.installHint || 'Install this tool on the desktop to use it.'}</small></div>) : <EmptyCard text="No agent adapters were returned by the Talocode daemon." />}</section>}
    {tab === 'settings' && <section className="phone-card"><h2>Phone settings</h2><p>Device: {device?.name || 'paired phone'}</p><p>Connection: {window.location.origin}</p><p className="warning-text">Talocode local network access is LAN-only for this MVP. Disable or revoke access from the desktop when finished.</p><button className="touch" onClick={() => void logout()}>Logout this phone</button></section>}
    <nav className="phone-tabs">{(['home', 'sessions', 'projects', 'providers', 'agents', 'settings'] as Tab[]).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{label(item)}</button>)}</nav></div>;
}

function SessionList({ sessions, onOpen, onAction }: { sessions: SessionView[]; onOpen: (session: SessionView) => Promise<void>; onAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<void> }) {
  return <div className="phone-card"><h2>Sessions</h2>{sessions.length ? sessions.map((session) => <div className="list-card" key={session.id}><div className="panel-title"><strong>{session.agentId}</strong><StatusBadge status={session.status} /></div><span>{session.model || 'default model'}</span><small>{session.cwd}</small><div className="row"><button onClick={() => void onAction(session.id, 'start')}>Start</button><button onClick={() => void onAction(session.id, 'stop')}>Stop</button><button onClick={() => void onOpen(session)}>Open</button></div></div>) : <p className="muted">No sessions yet. Create one from the desktop or CLI first.</p>}</div>;
}

function legacyLocalStorageValue(primaryKey: string, legacyKey: string): string {
  const primary = window.localStorage.getItem(primaryKey);
  if (primary) return primary;
  const legacy = window.localStorage.getItem(legacyKey) || '';
  if (legacy) window.localStorage.setItem(primaryKey, legacy);
  return legacy;
}

function safeStoredDevice(): PhoneDevice | null {
  try {
    const stored = legacyLocalStorageValue(DEVICE_KEY, LEGACY_DEVICE_KEY);
    return JSON.parse(stored || 'null') as PhoneDevice | null;
  } catch {
    window.localStorage.removeItem(DEVICE_KEY);
    return null;
  }
}
function EmptyCard({ text }: { text: string }) { return <div className="phone-card"><p className="muted">{text}</p></div>; }
function PhoneStat({ title, value }: { title: string; value: string }) { return <div className="phone-card stat"><span>{title}</span><strong>{value}</strong></div>; }
function StatusBadge({ status }: { status: string }) { return <span className={`status-badge ${status}`}>{status}</span>; }
function label(tab: Tab) { return tab[0].toUpperCase() + tab.slice(1); }

async function request<T>(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { method: init.method || 'GET', headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) }, body: init.body ? JSON.stringify(init.body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload as T;
}
