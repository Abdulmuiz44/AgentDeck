import { join } from 'path';
import { homedir } from 'os';
import type { AgentAdapter, SupportedPlatform } from './types';

const platform = process.platform as SupportedPlatform;
const home = homedir();

export const agentAdapters: AgentAdapter[] = [
  {
    id: 'codex-cli',
    displayName: 'Codex CLI',
    executableNames: process.platform === 'win32' ? ['codex.cmd', 'codex.exe', 'codex'] : ['codex'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    configLocations: [join(home, '.codex', 'config.toml')],
    launchCommandTemplate: 'codex --model {{model}}',
    argsTemplate: ['--model', '{{model}}'],
    detectionCommand: 'codex --version',
    docsUrl: 'https://developers.openai.com/codex',
    status: ['win32', 'darwin', 'linux'].includes(platform) ? 'not-installed' : 'unsupported-platform',
  },
  {
    id: 'codex-app',
    displayName: 'Codex App',
    executableNames: process.platform === 'win32' ? ['Codex.exe', 'codex.exe'] : ['codex'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    configLocations: [join(home, '.codex', 'config.toml')],
    launchCommandTemplate: 'codex --model {{model}}',
    argsTemplate: ['--model', '{{model}}'],
    detectionCommand: 'codex --version',
    docsUrl: 'https://openai.com/codex',
    status: ['win32', 'darwin', 'linux'].includes(platform) ? 'not-installed' : 'unsupported-platform',
  },
  {
    id: 'claude-code',
    displayName: 'Claude Code',
    executableNames: process.platform === 'win32' ? ['claude.cmd', 'claude.exe', 'claude'] : ['claude'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    configLocations: [join(home, '.claude')],
    launchCommandTemplate: 'claude',
    argsTemplate: [],
    detectionCommand: 'claude --version',
    docsUrl: 'https://docs.anthropic.com/claude-code',
    status: 'not-installed',
  },
  {
    id: 'opencode',
    displayName: 'OpenCode',
    executableNames: process.platform === 'win32' ? ['opencode.cmd', 'opencode.exe', 'opencode'] : ['opencode'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    configLocations: [join(home, '.config', 'opencode', 'opencode.json')],
    launchCommandTemplate: 'opencode --model {{model}}',
    argsTemplate: ['--model', '{{model}}'],
    detectionCommand: 'opencode --version',
    docsUrl: 'https://opencode.ai/docs',
    status: 'not-installed',
  },
  {
    id: 'gemini-cli',
    displayName: 'Gemini CLI',
    executableNames: process.platform === 'win32' ? ['gemini.cmd', 'gemini.exe', 'gemini'] : ['gemini'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    configLocations: [join(home, '.gemini')],
    launchCommandTemplate: 'gemini',
    argsTemplate: [],
    detectionCommand: 'gemini --version',
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
    status: 'not-installed',
  },
  {
    id: 'ollama',
    displayName: 'Ollama Runtime',
    executableNames: process.platform === 'win32' ? ['ollama.exe', 'ollama'] : ['ollama'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    configLocations: [],
    launchCommandTemplate: 'ollama run {{model}}',
    argsTemplate: ['run', '{{model}}'],
    detectionCommand: 'ollama --version',
    docsUrl: 'https://ollama.com/download',
    status: 'not-installed',
  },
];

export function getAdapter(id: string): AgentAdapter | undefined {
  return agentAdapters.find((adapter) => adapter.id === id);
}

export function renderArgs(template: string[], values: Record<string, string>): string[] {
  return template.map((part) => part.replace(/{{(\w+)}}/g, (_match, key: string) => values[key] || ''));
}

export function renderCommand(adapter: AgentAdapter, executable: string, values: Record<string, string>): string {
  const args = renderArgs(adapter.argsTemplate, values);
  return [executable, ...args].join(' ');
}
