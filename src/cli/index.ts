#!/usr/bin/env node
import { spawn } from 'child_process';
import { resolve, join } from 'path';
import { TalocodeDaemon } from '../main/talocode/daemon-server';
import { DEFAULT_HOST, DEFAULT_PORT, envValue } from '../main/talocode/paths';
import { runServiceCommand } from './service';

type Json = Record<string, unknown>;

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const cleanArgs = args.filter((arg) => arg !== '--json');
const baseUrl = envValue('URL') || `http://${envValue('HOST') || DEFAULT_HOST}:${envValue('PORT') || DEFAULT_PORT}`;

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = cleanArgs;
  try {
    switch (command) {
      case 'start': return startDaemon();
      case 'status': return output(await api('/api/status'));
      case 'discover': return output(await api('/api/system/discover/refresh', { method: 'POST' }));
      case 'providers':
      case 'provider':
        return handleProviders(subcommand, rest);
      case 'projects':
      case 'project':
        return handleProjects(subcommand, rest);
      case 'sessions':
      case 'session':
        return handleSessions(subcommand, rest);
      case 'remote':
        return handleRemote(subcommand, rest);
      case 'service':
        return output(await runServiceCommand(subcommand));
      case 'open':
        openUrl(baseUrl);
        console.log(`Opening Talocode dashboard at ${baseUrl}`);
        return;
      default:
        usage();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch failed')) {
      console.error(`Talocode daemon is not reachable at ${baseUrl}. Run "talo start" first.`);
      process.exitCode = 1;
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}


async function handleRemote(subcommand = 'status', rest: string[]): Promise<void> {
  if (subcommand === 'status') return output(await api('/api/remote/access'));
  if (subcommand === 'enable') {
    const flags = parseFlags(rest);
    return output(await api('/api/remote/access/enable', { method: 'POST', body: { publicLanUrl: flags.publicLanUrl, bindHost: flags.bindHost } }));
  }
  if (subcommand === 'disable') return output(await api('/api/remote/access/disable', { method: 'POST' }));
  if (subcommand === 'rotate-token') return output(await api('/api/remote/access/rotate-token', { method: 'POST' }));
  if (subcommand === 'qr') {
    const status = await api('/api/remote/access') as { qrPayload?: string; selectedLanUrl?: string };
    console.log(status.qrPayload || (status.selectedLanUrl ? `${status.selectedLanUrl}/phone` : 'Phone access is disabled. Run talo remote enable first.'));
    return;
  }
  if (subcommand === 'devices') {
    const status = await api('/api/remote/access') as { pairedDevices?: unknown[] };
    return output(status.pairedDevices || []);
  }
  if (subcommand === 'revoke' && rest[0]) return output(await api('/api/remote/access/revoke-device', { method: 'POST', body: { deviceId: rest[0] } }));
  usage();
}

async function handleProviders(subcommand = 'list', rest: string[]): Promise<void> {
  if (subcommand === 'list') return output(await api('/api/providers'));
  if (subcommand === 'add') return output(await api('/api/providers', { method: 'POST', body: parseProvider(rest) }));
  if (subcommand === 'test' && rest[0]) return output(await api(`/api/providers/${encodeURIComponent(rest[0])}/test`, { method: 'POST' }));
  if (subcommand === 'models' && rest[0]) return output(await api(`/api/providers/${encodeURIComponent(rest[0])}/models`));
  if (subcommand === 'refresh-models' && rest[0]) return output(await api(`/api/providers/${encodeURIComponent(rest[0])}/models/refresh`, { method: 'POST' }));
  usage();
}

async function handleProjects(subcommand = 'list', rest: string[]): Promise<void> {
  if (subcommand === 'list') return output(await api('/api/projects'));
  if (subcommand === 'add' && rest[0]) return output(await api('/api/projects', { method: 'POST', body: { path: resolve(rest[0]), description: parseFlags(rest.slice(1)).description } }));
  usage();
}

async function handleSessions(subcommand = 'list', rest: string[]): Promise<void> {
  if (subcommand === 'list') return output(await api('/api/sessions'));
  if (subcommand === 'create') {
    const parsed = parseSession(rest);
    const created = await api('/api/sessions', { method: 'POST', body: parsed }) as { id?: string };
    if (parseFlags(rest).start && created.id) return output(await api(`/api/sessions/${encodeURIComponent(created.id)}/start`, { method: 'POST' }));
    return output(created);
  }
  if (subcommand === 'start' && rest[0]) return output(await api(`/api/sessions/${encodeURIComponent(rest[0])}/start`, { method: 'POST' }));
  if (subcommand === 'stop' && rest[0]) return output(await api(`/api/sessions/${encodeURIComponent(rest[0])}/stop`, { method: 'POST' }));
  if (subcommand === 'restart' && rest[0]) return output(await api(`/api/sessions/${encodeURIComponent(rest[0])}/restart`, { method: 'POST' }));
  if (subcommand === 'logs' && rest[0]) return output(await api(`/api/sessions/${encodeURIComponent(rest[0])}/logs`));
  usage();
}

async function startDaemon(): Promise<void> {
  const staticDir = join(__dirname, '..', 'renderer');
  const daemon = new TalocodeDaemon({ staticDir });
  await daemon.start();
  console.log('Press Ctrl+C to stop.');
  const stop = async () => {
    await daemon.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

async function api(path: string, init: { method?: string; body?: Json } = {}): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || 'GET',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`);
  return payload;
}

function parseProvider(args: string[]): Json {
  const parsed = parseFlags(args);
  const type = String(parsed.type || 'ollama');
  const name = String(parsed.name || (type === 'openrouter' ? 'OpenRouter' : type === 'ollama' ? 'Ollama Local' : 'Custom Provider'));
  return {
    id: parsed.id ? String(parsed.id) : undefined,
    name,
    type,
    baseUrl: parsed.baseUrl ? String(parsed.baseUrl) : undefined,
    apiKeyEnvVar: parsed.apiKeyEnvVar ? String(parsed.apiKeyEnvVar) : undefined,
    defaultModel: parsed.model ? String(parsed.model) : undefined,
    isDefault: parsed.default === true,
  };
}

function parseSession(args: string[]): Json {
  const parsed = parseFlags(args);
  for (const required of ['projectId', 'agentId', 'providerId']) {
    if (!parsed[required]) throw new Error(`--${required} is required`);
  }
  return {
    projectId: String(parsed.projectId),
    agentId: String(parsed.agentId),
    providerId: String(parsed.providerId),
    model: parsed.model ? String(parsed.model) : undefined,
    mode: parsed.mode ? String(parsed.mode) : undefined,
  };
}

function parseFlags(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split('=', 2);
    parsed[key] = inline ?? (args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true);
  }
  return parsed;
}

function output(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (Array.isArray(data)) {
    console.table(data.map((item) => summarize(item as Record<string, unknown>)));
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

function summarize(item: Record<string, unknown>): Record<string, unknown> {
  return {
    id: item.id || item.adapterId || item.providerId || item.sessionId,
    name: item.name || item.displayName || item.model,
    status: item.status || (item.ok === false ? 'error' : item.ok === true ? 'ok' : undefined),
    detail: item.path || item.baseUrl || item.command || item.message || item.version,
  };
}

function openUrl(url: string): void {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const openArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(command, openArgs, { detached: true, stdio: 'ignore' }).unref();
}

function usage(): never {
  console.log(`Talocode CLI

Commands:
  talo start
  talo status [--json]
  talo discover [--json]
  talo remote status|enable|disable|rotate-token|qr|devices|revoke <device-id> [--json]
  talo providers list [--json]
  talo providers add --type ollama|openrouter|openai-compatible [--name NAME] [--baseUrl URL] [--apiKeyEnvVar ENV] [--model MODEL] [--default]
  talo providers test <id>
  talo providers models <id>
  talo providers refresh-models <id>
  talo projects list [--json]
  talo projects add <path> [--description TEXT]
  talo sessions list [--json]
  talo sessions create --projectId ID --agentId ID --providerId ID [--model MODEL] [--mode pty|process] [--start]
  talo sessions start <id>
  talo sessions stop <id>
  talo sessions restart <id>
  talo open

Compatibility alias:
  agentdeck remains temporarily available and maps to the same CLI entrypoint.`);
  process.exit(0);
}

void main();
