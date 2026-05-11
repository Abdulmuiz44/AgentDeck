import { useState } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import type { Workspace } from '../types';

interface Props {
  onNewWorkspace: () => void;
  onOpenWorkspace: (workspace: Workspace) => void;
  onSettings: () => void;
}

export default function Welcome({ onNewWorkspace, onOpenWorkspace, onSettings }: Props) {
  const { workspaces, loading, deleteWorkspace } = useWorkspace();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 32,
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 72,
            marginBottom: 8,
            filter: 'grayscale(0.3)',
          }}
        >
          ⌨
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          AgentDeck
        </h1>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            maxWidth: 480,
            lineHeight: 1.6,
          }}
        >
          A Windows-first workspace for running AI coding agents, terminals, dev servers, and test
          runners side by side.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onNewWorkspace}
          style={{
            backgroundColor: 'var(--accent)',
            color: '#ffffff',
            padding: '12px 28px',
            borderRadius: 'var(--radius)',
            fontSize: 15,
            fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent)';
          }}
        >
          New Workspace
        </button>
        <button
          onClick={onSettings}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            padding: '12px 28px',
            borderRadius: 'var(--radius)',
            fontSize: 15,
            fontWeight: 500,
            border: '1px solid var(--border-color)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
        >
          Settings
        </button>
      </div>

      {workspaces.length > 0 && (
        <div style={{ width: '100%', maxWidth: 500 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-muted)',
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            Recent Workspaces
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 16px',
                  cursor: 'pointer',
                }}
                onClick={() => onOpenWorkspace(ws)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ws.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={ws.projectPath}
                  >
                    {ws.projectPath}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkspace(ws.id);
                  }}
                  title="Delete workspace"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                  onMouseEnter={(e2) => {
                    e2.currentTarget.style.color = 'var(--error)';
                  }}
                  onMouseLeave={(e2) => {
                    e2.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
