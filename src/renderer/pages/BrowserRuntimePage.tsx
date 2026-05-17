import { useState, useEffect } from 'react';
import type { BrowserSessionView, BrowserAuditEventView } from '../types';

const API = import.meta.env.VITE_TALOCODE_API_URL || 'http://127.0.0.1:3768';

export default function BrowserRuntimePage() {
  const [sessions, setSessions] = useState<BrowserSessionView[]>([]);
  const [audit, setAudit] = useState<BrowserAuditEventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const [name, setName] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [headless, setHeadless] = useState(false);
  const [notes, setNotes] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, a] = await Promise.all([
        get<BrowserSessionView[]>('/api/browser/sessions'),
        get<BrowserAuditEventView[]>('/api/browser/audit').catch(() => [] as BrowserAuditEventView[]),
      ]);
      setSessions(s);
      setAudit(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const handleCreate = async () => {
    try {
      await post('/api/browser/sessions', { name, startUrl: startUrl || undefined, headless, notes: notes || undefined });
      setName('');
      setStartUrl('');
      setHeadless(false);
      setNotes('');
      setShowCreate(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const handleAction = async (id: string, action: string) => {
    setError('');
    try {
      if (action === 'open') {
        await post(`/api/browser/sessions/${id}/open`, { url: urlInput || 'about:blank' });
        setUrlInput('');
      } else {
        await post(`/api/browser/sessions/${id}/${action}`, {});
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this browser session? This will remove all browser profile data.')) return;
    try {
      await del(`/api/browser/sessions/${id}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading) return <div className="browser-page"><p className="muted">Loading browser sessions…</p></div>;

  return (
    <div className="browser-page">
      <div className="browser-header">
        <div>
          <p className="eyebrow">Talocode Feature</p>
          <h2>Browser Runtime</h2>
          <p className="muted">Local browser sessions for AI agents, persistent workflows, and human takeover. Not for evasion, scraping, or captcha bypass.</p>
        </div>
        <div className="browser-header-actions">
          <button onClick={() => { setShowCreate(!showCreate); setError(''); }}>
            {showCreate ? 'Cancel' : 'New Session'}
          </button>
          <button onClick={() => { setShowAudit(!showAudit); void refresh(); }}>
            {showAudit ? 'Hide Audit' : 'Audit Log'}
          </button>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
      </div>

      {error && <div className="notice warning">{error}</div>}

      {showCreate && (
        <section className="panel browser-create-panel">
          <h3>Create Browser Session</h3>
          <div className="form-grid">
            <label>Session name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Workspace" /></label>
            <label>Start URL (optional)<input value={startUrl} onChange={(e) => setStartUrl(e.target.value)} placeholder="https://example.com" /></label>
            <label>Notes (optional)<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="QA testing session" /></label>
            <label className="checkbox-label">
              <input type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} />
              Headless (no visible browser window)
            </label>
            <button className="primary" onClick={() => void handleCreate()} disabled={!name.trim()}>Create Session</button>
          </div>
        </section>
      )}

      {showAudit && (
        <section className="panel browser-audit-panel">
          <h3>Audit Log</h3>
          {audit.length === 0 && <p className="muted">No audit events recorded yet.</p>}
          <div className="browser-audit-list">
            {audit.slice(0, 50).map((e) => (
              <div className="browser-audit-item" key={e.id}>
                <StatusBadge status={e.type.replace('browser.session.', '')} />
                <span className="muted">{new Date(e.timestamp).toLocaleString()}</span>
                <span>{e.actor}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel browser-actions-bar">
        <label>Open URL in selected session:</label>
        <div className="row">
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com" />
          <button onClick={() => activeSessionId && handleAction(activeSessionId, 'open')} disabled={!activeSessionId || !urlInput.trim()}>
            Open URL
          </button>
        </div>
        <p className="muted">Human takeover available when the browser window is open and headless is off.</p>
      </section>

      {sessions.length === 0 && !showCreate && (
        <section className="panel">
          <p className="muted">No browser sessions yet. Create one to get started.</p>
        </section>
      )}

      <div className="browser-session-list">
        {sessions.map((s) => (
          <section className={`panel browser-session-card ${activeSessionId === s.id ? 'active' : ''}`} key={s.id} onClick={() => setActiveSessionId(s.id === activeSessionId ? null : s.id)}>
            <div className="browser-session-header">
              <div>
                <strong>{s.name}</strong>
                <StatusBadge status={s.status} />
              </div>
              <span className="muted">{s.headless ? 'headless' : 'headed'}</span>
            </div>

            <div className="browser-session-meta">
              {s.startUrl && <span className="muted">Start: {s.startUrl}</span>}
              {s.lastStartedAt && <span className="muted">Started: {new Date(s.lastStartedAt).toLocaleString()}</span>}
              {s.lastStoppedAt && <span className="muted">Stopped: {new Date(s.lastStoppedAt).toLocaleString()}</span>}
              {s.notes && <span className="muted">Notes: {s.notes}</span>}
              {s.lastError && <span className="warning-text">Error: {s.lastError}</span>}
            </div>

            <div className="row browser-session-actions">
              {s.status === 'stopped' || s.status === 'error' ? (
                <button className="primary" onClick={(e) => { e.stopPropagation(); void handleAction(s.id, 'start'); }}>Start</button>
              ) : s.status === 'running' ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); void handleAction(s.id, 'stop'); }}>Stop</button>
                  <button onClick={(e) => { e.stopPropagation(); void handleAction(s.id, 'restart'); }}>Restart</button>
                </>
              ) : null}
              <button onClick={(e) => { e.stopPropagation(); void handleDelete(s.id); }}>Delete</button>
              <button onClick={(e) => { e.stopPropagation(); void post(`/api/browser/sessions/${s.id}/clear-data`, {}).then(() => refresh()); }}>
                Clear Data
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function del<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
