import type { Workspace, Pane } from '../types';

interface Props {
  workspace: Workspace;
  panes: Pane[];
  onBack: () => void;
  onSettings: () => void;
}

export default function Sidebar({ workspace, panes, onBack, onSettings }: Props) {
  return (
    <div
      style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h1
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          AgentDeck
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{workspace.name}</div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={workspace.projectPath}
        >
          {workspace.projectPath}
        </div>
      </div>

      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          Terminal Panes
        </div>
        {panes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No panes open</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {panes.map((pane) => (
              <div
                key={pane.id}
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--bg-tertiary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={`${pane.label} — ${pane.command}`}
              >
                {pane.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <button
          onClick={onSettings}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            padding: '6px 10px',
            borderRadius: 'var(--radius)',
            textAlign: 'left',
            fontSize: 13,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ⚙ Settings
        </button>
        <button
          onClick={onBack}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            padding: '6px 10px',
            borderRadius: 'var(--radius)',
            textAlign: 'left',
            fontSize: 13,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ← Switch Workspace
        </button>
      </div>
    </div>
  );
}
