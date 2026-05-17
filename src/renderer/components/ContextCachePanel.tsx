import { useState, useEffect } from 'react';
import type { ContextPackView, ContextCacheMetaView, ProjectContextCacheView } from '../types';

const API = import.meta.env.VITE_TALOCODE_API_URL || 'http://127.0.0.1:3768';

interface Props {
  projectId: string;
  projectName: string;
}

export default function ContextCachePanel({ projectId, projectName }: Props) {
  const [cacheData, setCacheData] = useState<ProjectContextCacheView | null>(null);
  const [meta, setMeta] = useState<ContextCacheMetaView | null>(null);
  const [validating, setValidating] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get<ProjectContextCacheView>(`/api/projects/${projectId}/context-cache`);
      setCacheData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cache data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [projectId]);

  const handleValidate = async () => {
    setValidating(true);
    setError('');
    try {
      const result = await post<{
        fresh: boolean;
        stale: boolean;
        changedFiles: string[];
        pack: ContextPackView | null;
      }>(`/api/projects/${projectId}/context-cache/validate`, {});
      setMeta({
        contextPackId: result.pack?.id,
        cacheStatus: result.fresh ? 'hit' : 'stale',
        estimatedCachedTokens: result.fresh ? (result.pack?.estimatedTokens || 0) : 0,
        estimatedFreshTokens: result.pack?.estimatedTokens || 0,
        estimatedTotalTokens: result.pack?.estimatedTokens || 0,
        estimatedSavingsPercent: result.fresh ? 50 : 0,
        changedFiles: result.changedFiles,
      });
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setError('');
    try {
      await post(`/api/projects/${projectId}/context-cache/rebuild`, {});
      setMeta(null);
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) return <section className="panel cache-panel"><p className="muted">Loading context cache…</p></section>;

  if (error) return <section className="panel cache-panel"><div className="notice warning">{error}</div><button onClick={() => void fetchData()}>Retry</button></section>;

  const activePack = cacheData?.packs.find((p) => p.status === 'active');
  const stalePack = cacheData?.packs.find((p) => p.status === 'stale');
  const displayPack = activePack || stalePack;

  return (
    <section className="panel cache-panel">
      <div className="cache-status-row">
        <h3>Context Cache — {projectName}</h3>
        <div className="cache-actions">
          <button onClick={() => void handleValidate()} disabled={validating || !displayPack}>
            {validating ? 'Validating…' : 'Validate'}
          </button>
          <button className="primary" onClick={() => void handleRebuild()} disabled={rebuilding}>
            {rebuilding ? 'Rebuilding…' : 'Rebuild Cache'}
          </button>
        </div>
      </div>

      {!displayPack && (
        <div className="cache-empty">
          <p className="muted">No context pack built yet. Click "Rebuild Cache" to create one from your project's stable files (AGENTS.md, package.json, README.md, docs/**/*.md, etc.).</p>
        </div>
      )}

      {displayPack && (
        <>
          <div className="cache-status-row">
            <span className="eyebrow">{displayPack.name}</span>
            <StatusBadge status={displayPack.status === 'active' ? 'hit' : displayPack.status === 'stale' ? 'stale' : 'disabled'} />
          </div>
          <p className="muted">{displayPack.description}</p>

          <div className="cache-metrics-grid">
            <div className="stat">
              <span>Est. tokens</span>
              <strong>{displayPack.estimatedTokens.toLocaleString()}</strong>
            </div>
            <div className="stat">
              <span>Est. savings</span>
              <strong>
                {meta?.cacheStatus === 'hit'
                  ? `${meta.estimatedSavingsPercent}%`
                  : displayPack.status === 'active'
                  ? '~50%'
                  : '0%'}
              </strong>
            </div>
            <div className="stat">
              <span>Cache hits</span>
              <strong>{displayPack.cacheHitCount}</strong>
            </div>
            <div className="stat">
              <span>Cache misses</span>
              <strong>{displayPack.cacheMissCount}</strong>
            </div>
          </div>

          {meta && (
            <div className="cache-metrics-grid">
              <div className="stat">
                <span>Cached tokens</span>
                <strong>{meta.estimatedCachedTokens.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Fresh tokens</span>
                <strong>{meta.estimatedFreshTokens.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Total tokens</span>
                <strong>{meta.estimatedTotalTokens.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Status</span>
                <StatusBadge status={meta.cacheStatus} />
              </div>
            </div>
          )}

          <div className="cache-details">
            <span className="muted">Files: {displayPack.includedFiles.length}</span>
            <span className="muted">Last used: {displayPack.lastUsedAt ? new Date(displayPack.lastUsedAt).toLocaleString() : 'never'}</span>
            <span className="muted">Updated: {new Date(displayPack.updatedAt).toLocaleString()}</span>
          </div>

          {meta && meta.changedFiles.length > 0 && (
            <div className="stale-files-list">
              <h4>Changed files ({meta.changedFiles.length})</h4>
              <ul>
                {meta.changedFiles.map((f) => (
                  <li key={f} className="muted">{f}</li>
                ))}
              </ul>
            </div>
          )}

          {(cacheData?.stats.totalPacks ?? 0) > 1 && (
            <div className="cache-details">
              <span className="muted">
                Total packs: {cacheData?.stats.totalPacks} ·
                Active: {cacheData?.stats.activePacks} ·
                Stale: {cacheData?.stats.stalePacks}
              </span>
            </div>
          )}
        </>
      )}
    </section>
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
