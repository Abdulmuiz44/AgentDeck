import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname, join, normalize } from 'path';
import type { AddressInfo } from 'net';
import {
  TalocodeCore,
  TalocodeError,
  parseIntegrationRequest,
  parseProjectPatchRequest,
  parseProjectRequest,
  parseProviderRequest,
  parseSessionInputRequest,
  parseSessionRequest,
  parseSessionResizeRequest,
} from './core';
import { DEFAULT_HOST, DEFAULT_PORT, envValue } from './paths';
import { bearerToken, isLocalRequest, redactSensitive } from './remote';
import type { IntegrationTarget, SessionStatus, SessionStreamEvent } from './types';
import { subscribeSessionEvents } from './session-events';

export interface TalocodeDaemonOptions {
  host?: string;
  port?: number;
  staticDir?: string;
  core?: TalocodeCore;
}

export class TalocodeDaemon {
  private readonly core: TalocodeCore;
  private host: string;
  private readonly port: number;
  private readonly staticDir?: string;
  private server = createServer((req, res) => void this.route(req, res));

  constructor(options: TalocodeDaemonOptions = {}) {
    this.host = options.host || envValue('HOST') || DEFAULT_HOST;
    this.port = Number(options.port || envValue('PORT') || DEFAULT_PORT);
    this.staticDir = options.staticDir;
    this.core = options.core || new TalocodeCore();
  }

  async start(): Promise<void> {
    console.log(`[Talocode] Preparing data directory and store...`);
    await this.core.initialize();
    const remote = await this.core.getRemoteAccess(this.port, this.host);
    if (remote.enabled && remote.bindHost) this.host = remote.bindHost;
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') reject(new Error(`Talocode daemon port ${this.port} is already in use. Set TALOCODE_PORT (or legacy AGENTDECK_PORT) to use another port.`));
        else reject(error);
      });
      this.server.listen(this.port, this.host, () => resolve());
    });
    console.log(`[Talocode] Daemon listening at ${this.url()}`);
  }

  async stop(): Promise<void> {
    await this.core.shutdown();
    await new Promise<void>((resolve, reject) => this.server.close((error) => (error ? reject(error) : resolve())));
    console.log('[Talocode] Daemon stopped cleanly.');
  }

  url(): string {
    const addr = this.server.address() as AddressInfo | null;
    return `http://${this.host}:${addr?.port || this.port}`;
  }

  private async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      setCors(res);
      if (req.method === 'OPTIONS') return sendJson(res, 204, {});
      const url = new URL(req.url || '/', `http://${req.headers.host || `${this.host}:${this.port}`}`);
      const path = url.pathname;
      const localRequest = isLocalRequest(req);
      const phoneDevice = localRequest ? undefined : await this.core.authenticatePhone(bearerToken(req));

      if (req.method === 'GET' && path === '/health') return sendJson(res, 200, await this.core.health());
      if (req.method === 'GET' && path === '/api/status') return sendJson(res, 200, await this.core.status(this.url()));

      if (req.method === 'GET' && path === '/api/remote/access') return sendJson(res, 200, await this.core.getRemoteAccess(this.port, this.host));
      if (req.method === 'POST' && path === '/api/remote/pair') {
        const body = asRecord(await readBody(req));
        return sendJson(res, 200, await this.core.pairPhone(requiredString(body.token, 'token'), optionalString(body.deviceName), optionalString(body.userAgent) || String(req.headers['user-agent'] || '')));
      }
      if (req.method === 'POST' && path === '/api/remote/logout') return sendJson(res, 200, await this.core.logoutPhone(bearerToken(req)));
      if (req.method === 'GET' && path === '/api/remote/me') {
        if (localRequest) return sendJson(res, 200, { local: true });
        if (!phoneDevice) throw new TalocodeError(401, 'Phone authorization is required');
        return sendJson(res, 200, { local: false, device: phoneDevice });
      }
      if (req.method === 'POST' && path === '/api/remote/access/enable') {
        requireLocal(localRequest);
        const body = asRecord(await readBody(req));
        const result = await this.core.enableRemoteAccess(this.port, { publicLanUrl: optionalString(body.publicLanUrl), bindHost: optionalString(body.bindHost) }, this.host);
        if (result.bindHost !== this.host) res.once('finish', () => { void this.rebind(result.bindHost); });
        return sendJson(res, 200, result);
      }
      if (req.method === 'POST' && path === '/api/remote/access/disable') {
        requireLocal(localRequest);
        const result = await this.core.disableRemoteAccess();
        if (this.host !== DEFAULT_HOST) res.once('finish', () => { void this.rebind(DEFAULT_HOST); });
        return sendJson(res, 200, result);
      }
      if (req.method === 'POST' && path === '/api/remote/access/rotate-token') {
        requireLocal(localRequest);
        return sendJson(res, 200, await this.core.rotateRemoteToken(this.port, this.host));
      }
      if (req.method === 'POST' && path === '/api/remote/access/revoke-device') {
        requireLocal(localRequest);
        const body = asRecord(await readBody(req));
        return sendJson(res, 200, await this.core.revokePhoneDevice(requiredString(body.deviceId, 'deviceId')));
      }
      if (!localRequest && path.startsWith('/api/') && !phoneDevice) throw new TalocodeError(401, 'Phone authorization is required');
      if (!localRequest && isRemoteBlocked(path, req.method || 'GET')) throw new TalocodeError(403, 'This API is not available from phone control');

      if (req.method === 'GET' && path === '/api/phone/snapshot') return sendJson(res, 200, await this.core.phoneSafeSnapshot(this.url()));

      if (req.method === 'GET' && path === '/api/providers') return sendJson(res, 200, await this.core.listProviders());
      if (req.method === 'POST' && path === '/api/providers') return sendJson(res, 200, await this.core.upsertProvider(parseProviderRequest(await readBody(req))));
      const providerModelMatch = path.match(/^\/api\/providers\/([^/]+)\/models(?:\/refresh)?$/);
      if (providerModelMatch) {
        const id = decodeURIComponent(providerModelMatch[1]);
        if (req.method === 'GET') return sendJson(res, 200, await this.core.getProviderModels(id));
        if (req.method === 'POST') return sendJson(res, 200, await this.core.refreshProviderModels(id));
      }
      const providerMatch = path.match(/^\/api\/providers\/([^/]+)(?:\/(test|default))?$/);
      if (providerMatch) {
        const id = decodeURIComponent(providerMatch[1]);
        const action = providerMatch[2];
        if (req.method === 'POST' && action === 'test') return sendJson(res, 200, await this.core.testProvider(id));
        if (req.method === 'POST' && action === 'default') return sendJson(res, 200, await this.core.setDefaultProvider(id));
        if (req.method === 'GET' && action === 'models') return sendJson(res, 200, await this.core.getProviderModels(id));
        if (req.method === 'POST' && action === 'models') return sendJson(res, 200, await this.core.refreshProviderModels(id));
        if (req.method === 'DELETE' && !action) return sendJson(res, 200, await this.core.removeProvider(id));
      }

      if (req.method === 'GET' && path === '/api/agents') return sendJson(res, 200, await this.core.listAgents());

      if (req.method === 'GET' && path === '/api/projects') return sendJson(res, 200, await this.core.listProjects());
      if (req.method === 'POST' && path === '/api/projects') return sendJson(res, 200, await this.core.registerProject(parseProjectRequest(await readBody(req))));
      const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch) {
        const id = decodeURIComponent(projectMatch[1]);
        if (req.method === 'GET') return sendJson(res, 200, await this.core.getProject(id));
        if (req.method === 'PATCH') return sendJson(res, 200, await this.core.updateProject(id, parseProjectPatchRequest(await readBody(req))));
        if (req.method === 'DELETE') return sendJson(res, 200, await this.core.deleteProject(id));
      }

      if (req.method === 'GET' && path === '/api/sessions') {
        return sendJson(res, 200, await this.core.listSessions({
          projectId: url.searchParams.get('projectId') || undefined,
          status: (url.searchParams.get('status') || undefined) as SessionStatus | undefined,
        }));
      }
      if (req.method === 'POST' && path === '/api/sessions') return sendJson(res, 200, await this.core.createSession(parseSessionRequest(await readBody(req))));
      const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)(?:\/(start|stop|restart|logs|stream|input|resize))?$/);
      if (sessionMatch) {
        const id = decodeURIComponent(sessionMatch[1]);
        const action = sessionMatch[2];
        if (req.method === 'GET' && !action) return sendJson(res, 200, await this.core.getSession(id));
        if (req.method === 'POST' && action === 'start') return sendJson(res, 200, await this.core.startSession(id));
        if (req.method === 'POST' && action === 'stop') return sendJson(res, 200, await this.core.stopSession(id));
        if (req.method === 'POST' && action === 'restart') return sendJson(res, 200, await this.core.restartSession(id));
        if (req.method === 'GET' && action === 'logs') return sendJson(res, 200, await this.core.getSessionLogs(id));
        if (req.method === 'GET' && action === 'stream') return this.streamSession(id, res);
        if (req.method === 'POST' && action === 'input') {
          const body = parseSessionInputRequest(await readBody(req));
          return sendJson(res, 200, await this.core.sendSessionInput(id, body.data));
        }
        if (req.method === 'POST' && action === 'resize') {
          const body = parseSessionResizeRequest(await readBody(req));
          return sendJson(res, 200, await this.core.resizeSession(id, body.cols, body.rows));
        }
      }

      if (req.method === 'GET' && path === '/api/system/discover') return sendJson(res, 200, await this.core.discover());
      if (req.method === 'POST' && path === '/api/system/discover/refresh') return sendJson(res, 200, await this.core.refreshDiscovery());

      const integrationMatch = path.match(/^\/api\/integrations\/(codex|opencode)\/configure$/);
      if (req.method === 'POST' && integrationMatch) {
        return sendJson(res, 200, await this.core.configureIntegration(integrationMatch[1] as IntegrationTarget, parseIntegrationRequest(await readBody(req))));
      }
      if (req.method === 'POST' && path === '/api/integrations/config/preview') {
        const request = parseIntegrationRequest(await readBody(req));
        if (!request.targetTool) throw new TalocodeError(400, 'targetTool is required');
        return sendJson(res, 200, await this.core.configureIntegration(request.targetTool, { ...request, dryRun: true, writeConfig: false }));
      }
      if (req.method === 'POST' && path === '/api/integrations/config/write') {
        const request = parseIntegrationRequest(await readBody(req));
        if (!request.targetTool) throw new TalocodeError(400, 'targetTool is required');
        return sendJson(res, 200, await this.core.configureIntegration(request.targetTool, { ...request, dryRun: false, writeConfig: true }));
      }

      if (req.method === 'POST' && path === '/api/settings/reset') return sendJson(res, 200, await this.core.resetLocalData());
      if (req.method === 'GET' && path === '/api/settings/export') return sendJson(res, 200, await this.core.exportLocalConfig());

      if (req.method === 'GET' && this.staticDir) {
        const served = await tryServeStatic(this.staticDir, path, res);
        if (served) return;
      }
      return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      const status = error instanceof TalocodeError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'Unknown error';
      return sendJson(res, status, { error: redact(message) });
    }
  }

  private async rebind(host: string): Promise<void> {
    if (host === this.host) return;
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    this.host = host;
    this.server = createServer((req, res) => void this.route(req, res));
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, () => resolve());
    });
    console.log(`[Talocode] Daemon rebound at ${this.url()}`);
  }

  private async streamSession(id: string, res: ServerResponse): Promise<void> {
    const logs = await this.core.getSessionLogs(id).catch(() => ({ text: '' }));
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event: SessionStreamEvent) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    if (logs.text) send({ type: 'output', sessionId: id, timestamp: new Date().toISOString(), data: logs.text });
    const unsubscribe = subscribeSessionEvents(id, send);
    const heartbeat = setInterval(() => send({ type: 'heartbeat', sessionId: id, timestamp: new Date().toISOString() }), 15000);
    res.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }

}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TalocodeError(400, 'Request body must be a JSON object');
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TalocodeError(400, `${field} is required`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function requireLocal(localRequest: boolean): void {
  if (!localRequest) throw new TalocodeError(403, 'This operation is only available from the desktop localhost dashboard or CLI');
}

export function isRemoteBlocked(path: string, method: string): boolean {
  if (method === 'POST' && path === '/api/projects') return true;
  if (method === 'POST' && path === '/api/providers') return true;
  if (method === 'POST' && /^\/api\/providers\/[^/]+\/(test|default)$/.test(path)) return true;
  if (method === 'PATCH' || method === 'DELETE') return true;
  if (path.startsWith('/api/integrations/') || path.startsWith('/api/settings/')) return true;
  if (path.endsWith('/resize')) return true;
  return false;
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    throw new TalocodeError(400, 'Request body must be valid JSON');
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(status === 204 ? undefined : JSON.stringify(data, null, 2));
}

async function tryServeStatic(staticDir: string, requestPath: string, res: ServerResponse): Promise<boolean> {
  const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const candidate = normalize(join(staticDir, relative));
  if (!candidate.startsWith(normalize(staticDir))) return false;
  try {
    const info = await stat(candidate);
    if (!info.isFile()) return false;
    res.writeHead(200, { 'Content-Type': contentType(candidate) });
    createReadStream(candidate).pipe(res);
    return true;
  } catch {
    if (!requestPath.startsWith('/api/') && requestPath !== '/health') {
      const index = join(staticDir, 'index.html');
      try {
        await stat(index);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        createReadStream(index).pipe(res);
        return true;
      } catch {}
    }
    return false;
  }
}

function contentType(file: string): string {
  switch (extname(file)) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    default: return 'application/octet-stream';
  }
}

function redact(input: string): string {
  return redactSensitive(input).replace(/(api[_-]?key|token|secret)=\S+/gi, '$1=[redacted]');
}
