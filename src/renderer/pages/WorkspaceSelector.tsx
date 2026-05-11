import { useState, useCallback } from 'react';
import type { Workspace } from '../types';

interface Props {
  onCreated: (workspace: Workspace) => void;
  onBack: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function WorkspaceSelector({ onCreated, onBack }: Props) {
  const [name, setName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [npmScripts, setNpmScripts] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);

  const handleSelectFolder = useCallback(async () => {
    const dir = await window.electronAPI.fs.selectDirectory();
    if (dir) {
      setProjectPath(dir);
      setDetecting(true);
      const pkg = await window.electronAPI.fs.readPackageJson(dir);
      if (pkg && pkg.scripts && typeof pkg.scripts === 'object') {
        setNpmScripts(Object.keys(pkg.scripts));
      } else {
        setNpmScripts([]);
      }
      setDetecting(false);
    }
  }, []);

  const handleCreate = useCallback(() => {
    if (!name.trim() || !projectPath.trim()) return;

    const workspace: Workspace = {
      id: generateId(),
      name: name.trim(),
      projectPath: projectPath.trim(),
      panes: [],
      lastOpened: new Date().toISOString(),
    };

    window.electronAPI.workspace.save(workspace);
    onCreated(workspace);
  }, [name, projectPath, onCreated]);

  const isValid = name.trim().length > 0 && projectPath.trim().length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 24,
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>New Workspace</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Give your workspace a name and choose a project folder
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          width: '100%',
          maxWidth: 440,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}
          >
            Workspace Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My Project"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              fontSize: 14,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}
          >
            Project Folder
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={projectPath}
              readOnly
              placeholder="Click Browse to select a folder"
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                color: projectPath ? 'var(--text-primary)' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                fontSize: 14,
                cursor: 'default',
              }}
            />
            <button
              onClick={handleSelectFolder}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              Browse
            </button>
          </div>
        </div>

        {projectPath && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
            }}
          >
            {detecting ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Detecting project scripts...
              </div>
            ) : npmScripts.length > 0 ? (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--success)',
                    marginBottom: 8,
                  }}
                >
                  ✓ Found {npmScripts.length} npm scripts
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {npmScripts.map((script) => (
                    <span
                      key={script}
                      style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        backgroundColor: 'var(--bg-tertiary)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      npm run {script}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                No package.json found — you can still open terminals manually
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Back
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid}
            style={{
              flex: 1,
              backgroundColor: isValid ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: isValid ? '#ffffff' : 'var(--text-muted)',
              borderRadius: 'var(--radius)',
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            Create Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
