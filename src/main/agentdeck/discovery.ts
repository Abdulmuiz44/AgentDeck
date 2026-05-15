import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AgentAdapter, ToolDiscoveryResult } from './types';
import { agentAdapters } from './agents';

const execFileAsync = promisify(execFile);
const VERSION_TIMEOUT_MS = 5000;

interface ToolDefinition {
  id: string;
  name: string;
  executableNames: string[];
  versionArgs: string[];
  docsUrl: string;
  installHint: string;
  adapter?: AgentAdapter;
}

const platformExecutables = (base: string): string[] => (process.platform === 'win32' ? [`${base}.cmd`, `${base}.exe`, base] : [base]);

export function allToolDefinitions(): ToolDefinition[] {
  const adapterTools = agentAdapters.map((adapter) => ({
    id: adapter.id,
    name: adapter.displayName,
    executableNames: adapter.executableNames,
    versionArgs: adapter.detectionCommand.split(' ').slice(1),
    docsUrl: adapter.docsUrl,
    installHint: adapter.installHint || `Install ${adapter.displayName} and ensure it is available in PATH.`,
    adapter,
  }));

  return [
    ...adapterTools,
    { id: 'node', name: 'Node.js', executableNames: ['node'], versionArgs: ['--version'], docsUrl: 'https://nodejs.org/', installHint: 'Install Node.js LTS.' },
    { id: 'npm', name: 'npm', executableNames: platformExecutables('npm'), versionArgs: ['--version'], docsUrl: 'https://docs.npmjs.com/', installHint: 'Install npm with Node.js.' },
    { id: 'pnpm', name: 'pnpm', executableNames: platformExecutables('pnpm'), versionArgs: ['--version'], docsUrl: 'https://pnpm.io/installation', installHint: 'Install pnpm and ensure it is in PATH.' },
    { id: 'git', name: 'Git', executableNames: ['git'], versionArgs: ['--version'], docsUrl: 'https://git-scm.com/downloads', installHint: 'Install Git and ensure it is in PATH.' },
    { id: 'python', name: 'Python', executableNames: process.platform === 'win32' ? ['python.exe', 'python', 'py.exe'] : ['python3', 'python'], versionArgs: ['--version'], docsUrl: 'https://www.python.org/downloads/', installHint: 'Install Python and ensure it is in PATH.' },
    { id: 'powershell', name: 'PowerShell', executableNames: process.platform === 'win32' ? ['pwsh.exe', 'powershell.exe', 'pwsh'] : ['pwsh'], versionArgs: ['--version'], docsUrl: 'https://learn.microsoft.com/powershell/', installHint: 'Install PowerShell 7 or use Windows PowerShell.' },
    { id: 'windows-terminal', name: 'Windows Terminal', executableNames: process.platform === 'win32' ? ['wt.exe', 'wt'] : ['wt'], versionArgs: ['--version'], docsUrl: 'https://learn.microsoft.com/windows/terminal/', installHint: 'Install Windows Terminal from Microsoft Store or winget.' },
  ];
}

async function commandPath(name: string): Promise<string | undefined> {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(lookup, [name], { timeout: 3000, windowsHide: true });
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0];
  } catch {
    return undefined;
  }
}

async function commandVersion(executablePath: string, args: string[]): Promise<string | undefined> {
  if (!args.length) return undefined;
  try {
    const { stdout, stderr } = await execFileAsync(executablePath, args, { timeout: VERSION_TIMEOUT_MS, windowsHide: true });
    return (stdout || stderr).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0];
  } catch {
    return undefined;
  }
}

export async function discoverTool(tool: ToolDefinition): Promise<ToolDiscoveryResult> {
  const lastCheckedAt = new Date().toISOString();
  if (tool.adapter && !tool.adapter.supportedPlatforms.includes(process.platform as never)) {
    return {
      id: tool.id,
      name: tool.name,
      adapterId: tool.adapter.id,
      displayName: tool.name,
      status: 'unsupported-platform',
      installHint: tool.installHint,
      docsUrl: tool.docsUrl,
      lastCheckedAt,
    };
  }

  for (const executable of tool.executableNames) {
    const path = await commandPath(executable);
    if (path) {
      const version = await commandVersion(path, tool.versionArgs);
      return {
        id: tool.id,
        name: tool.name,
        adapterId: tool.adapter?.id,
        displayName: tool.name,
        executable,
        path,
        version,
        status: 'detected',
        installHint: tool.installHint,
        docsUrl: tool.docsUrl,
        lastCheckedAt,
      };
    }
  }

  return {
    id: tool.id,
    name: tool.name,
    adapterId: tool.adapter?.id,
    displayName: tool.name,
    status: 'missing',
    installHint: tool.installHint,
    docsUrl: tool.docsUrl,
    lastCheckedAt,
  };
}

export async function discoverAdapter(adapter: AgentAdapter): Promise<ToolDiscoveryResult> {
  return discoverTool({
    id: adapter.id,
    name: adapter.displayName,
    executableNames: adapter.executableNames,
    versionArgs: adapter.detectionCommand.split(' ').slice(1),
    docsUrl: adapter.docsUrl,
    installHint: adapter.installHint || `Install ${adapter.displayName} and ensure it is available in PATH.`,
    adapter,
  });
}

export async function discoverTools(): Promise<ToolDiscoveryResult[]> {
  return Promise.all(allToolDefinitions().map(discoverTool));
}
