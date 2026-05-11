import { useCallback, useRef } from 'react';
import TerminalPane from './TerminalPane';
import type { Pane as PaneType } from '../types';

interface Props {
  panes: PaneType[];
  onPanesChange: (panes: PaneType[]) => void;
}

export default function TerminalGrid({ panes, onPanesChange }: Props) {
  const onPanesChangeRef = useRef(onPanesChange);
  onPanesChangeRef.current = onPanesChange;

  const handleStatusChange = useCallback((paneId: string, status: PaneType['status']) => {
    onPanesChangeRef.current(
      panes.map((p) => (p.id === paneId ? { ...p, status } : p))
    );
  }, [panes]);

  const handleClose = useCallback((paneId: string) => {
    onPanesChangeRef.current(panes.filter((p) => p.id !== paneId));
  }, [panes]);

  const handleExit = useCallback((paneId: string, exitCode: number) => {
    onPanesChangeRef.current(
      panes.map((p) =>
        p.id === paneId ? { ...p, status: exitCode === 0 ? 'done' : 'error' } : p
      )
    );
  }, [panes]);

  const getGridStyle = (): React.CSSProperties => {
    const count = panes.length;
    if (count === 0) {
      return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        fontSize: 14,
      };
    }
    const cols = count === 1 ? 1 : 2;
    const rows = Math.ceil(count / cols);
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: 8,
      padding: 8,
      height: '100%',
    };
  };

  if (panes.length === 0) {
    return (
      <div style={getGridStyle()}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>⌨</div>
          <div>No terminal panes open</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Use the command launcher below to start a terminal
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={getGridStyle()}>
      {panes.map((pane) => (
        <TerminalPane
          key={pane.id}
          pane={pane}
          onStatusChange={handleStatusChange}
          onClose={handleClose}
          onExit={handleExit}
        />
      ))}
    </div>
  );
}
