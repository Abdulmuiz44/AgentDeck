import type { PaneStatus } from '../types';
import '../App.css';

const statusColors: Record<PaneStatus, string> = {
  idle: 'var(--idle)',
  running: 'var(--running)',
  waiting: 'var(--warning)',
  error: 'var(--error)',
  done: 'var(--done)',
};

interface Props {
  status: PaneStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--radius)',
        backgroundColor: `${statusColors[status]}20`,
        color: statusColors[status],
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: statusColors[status],
          animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      {status}
    </span>
  );
}
