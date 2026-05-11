import { useEffect, useRef, useCallback } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import StatusBadge from './StatusBadge';
import type { Pane as PaneType } from '../types';

interface Props {
  pane: PaneType;
  onStatusChange: (paneId: string, status: PaneType['status']) => void;
  onClose: (paneId: string) => void;
  onExit: (paneId: string, exitCode: number) => void;
}

export default function TerminalPane({ pane, onStatusChange, onClose, onExit }: Props) {
  const containerDivRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const prevStatusRef = useRef<PaneType['status']>('idle');

  const { containerRef, createTerminal, status, killTerminal } = useTerminal({
    onExit: (exitCode) => {
      onExit(pane.id, exitCode);
    },
  });

  useEffect(() => {
    if (status !== prevStatusRef.current) {
      prevStatusRef.current = status;
      onStatusChangeRef.current(pane.id, status);
    }
  }, [status, pane.id]);

  const init = useCallback(
    (div: HTMLDivElement) => {
      containerRef(div);
    },
    [containerRef]
  );

  useEffect(() => {
    if (!containerDivRef.current || hasInitialized.current) return;
    hasInitialized.current = true;
    init(containerDivRef.current);

    const tid = pane.terminalId;
    if (tid) {
      createTerminal(pane.terminalId ? '' : '', pane.command);
    } else {
      createTerminal('', pane.command);
    }
  }, [pane.id]);

  const handleClose = useCallback(async () => {
    await killTerminal();
    onClose(pane.id);
  }, [killTerminal, onClose, pane.id]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          minHeight: 32,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pane.label}
          </span>
          <StatusBadge status={status} />
        </div>
        <button
          onClick={handleClose}
          title="Close pane"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            padding: '2px 6px',
            borderRadius: 'var(--radius)',
            fontSize: 16,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          ×
        </button>
      </div>
      <div
        ref={containerDivRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: '4px 8px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
