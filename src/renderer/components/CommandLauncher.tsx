import { useCallback } from 'react';
import type { Pane, AgentCommand } from '../types';

interface Props {
  projectPath: string;
  npmScripts: string[];
  onAddPane: (pane: Pane) => void;
}

const AGENT_COMMANDS: AgentCommand[] = [
  {
    id: 'codex',
    label: 'Codex',
    command: 'codex',
    check: 'codex',
    help: 'Install Codex: npm install -g @anthropic-ai/codex',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    command: 'gemini',
    check: 'gemini',
    help: 'Install Gemini CLI: npm install -g @google/generative-ai',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    command: 'opencode',
    check: 'opencode',
    help: 'Install OpenCode: npm install -g opencode-ai',
  },
  {
    id: 'kiro',
    label: 'Kiro CLI',
    command: 'kiro-cli',
    check: 'kiro-cli',
    help: 'Install Kiro CLI: npm install -g kiro-cli',
  },
  {
    id: 'powershell',
    label: 'PowerShell',
    command: 'powershell.exe',
    check: 'powershell.exe',
    help: 'PowerShell is built into Windows.',
  },
  {
    id: 'wsl',
    label: 'WSL',
    command: 'wsl',
    check: 'wsl',
    help: 'Install WSL: wsl --install',
  },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function CommandLauncher({ projectPath, npmScripts, onAddPane }: Props) {
  const handleLaunch = useCallback(
    (label: string, command: string) => {
      const fullCommand = command.startsWith('npm ')
        ? command
        : command;

      const newPane: Pane = {
        id: generateId(),
        terminalId: '',
        command: fullCommand,
        label,
        status: 'waiting',
      };
      onAddPane(newPane);
    },
    [onAddPane]
  );

  const handleAgentLaunch = useCallback(
    (agent: AgentCommand) => {
      const newPane: Pane = {
        id: generateId(),
        terminalId: '',
        command: `check:${agent.check}`,
        label: `Check: ${agent.label}`,
        status: 'waiting',
      };
      onAddPane(newPane);

      const launchPane: Pane = {
        id: generateId(),
        terminalId: '',
        command: agent.command,
        label: agent.label,
        status: 'waiting',
      };
      setTimeout(() => onAddPane(launchPane), 500);
    },
    [onAddPane]
  );

  return (
    <div
      style={{
        height: 'var(--launcher-height)',
        minHeight: 'var(--launcher-height)',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 6,
        overflowX: 'auto',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-muted)',
          marginRight: 6,
          whiteSpace: 'nowrap',
        }}
      >
        Launch:
      </span>

      {npmScripts.length > 0 && (
        <>
          <div
            style={{
              width: 1,
              height: 20,
              backgroundColor: 'var(--border-color)',
              margin: '0 4px',
            }}
          />
          {npmScripts.map((script) => {
            const label =
              script === 'dev'
                ? 'npm dev'
                : script === 'build'
                  ? 'npm build'
                  : script === 'test'
                    ? 'npm test'
                    : `npm run ${script}`;
            return (
              <button
                key={script}
                onClick={() => handleLaunch(label, `npm run ${script}`)}
                title={`Run npm run ${script} in ${projectPath}`}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--success)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius)',
                  fontSize: 11,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--success)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
              >
                {label}
              </button>
            );
          })}
        </>
      )}

      <div
        style={{
          width: 1,
          height: 20,
          backgroundColor: 'var(--border-color)',
          margin: '0 4px',
        }}
      />

      {AGENT_COMMANDS.map((agent) => (
        <button
          key={agent.id}
          onClick={() => handleAgentLaunch(agent)}
          title={`${agent.command}\n${agent.help}`}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--accent)',
            padding: '4px 10px',
            borderRadius: 'var(--radius)',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
          }}
        >
          {agent.label}
        </button>
      ))}
    </div>
  );
}
