import { createWriteStream, type WriteStream } from 'fs';
import { mkdir, readFile, stat } from 'fs/promises';
import { basename, resolve, join, win32 } from 'path';
import { randomUUID } from 'crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { TalocodeStore, AgentSession, ProjectRegistration, SessionMode, SessionStatus } from './types';
import { getLogsDir } from './paths';
import { getAdapter, renderArgs, renderCommand } from './agents';
import { discoverAdapter } from './discovery';
import { JsonStore } from './persistence';
import { spawnPty } from './pty-adapter';
import { createSessionEvent, publishSessionEvent } from './session-events';

interface RunningProcess {
  child?: ChildProcessWithoutNullStreams;
  pty?: ReturnType<typeof spawnPty>;
  output: WriteStream;
  mode: SessionMode;
}

const runningProcesses = new Map<string, RunningProcess>();

export function activeSessionIds(): string[] {
  return [...runningProcesses.keys()];
}

export function normalizeProjectPath(inputPath: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? win32.resolve(inputPath) : resolve(inputPath);
}

export function buildSessionLogPath(id: string, logsDir = getLogsDir()): string {
  return join(logsDir, `${id}.log`);
}

export async function validateProjectPath(inputPath: string): Promise<string> {
  const projectPath = normalizeProjectPath(inputPath);
  const info = await stat(projectPath);
  if (!info.isDirectory()) throw new Error('Project path must be a directory');
  return projectPath;
}

export async function projectPathStatus(projectPath: string): Promise<'valid' | 'missing'> {
  try {
    await validateProjectPath(projectPath);
    return 'valid';
  } catch {
    return 'missing';
  }
}

export async function registerProject(store: JsonStore, inputPath: string, description?: string): Promise<ProjectRegistration> {
  const projectPath = await validateProjectPath(inputPath);
  const now = new Date().toISOString();
  let project!: ProjectRegistration;
  await store.update((data) => {
    const existing = data.projects.find((item) => item.path === projectPath);
    if (existing) {
      existing.updatedAt = now;
      existing.lastOpenedAt = now;
      if (description !== undefined) existing.description = description;
      project = existing;
      return;
    }
    project = {
      id: randomUUID(),
      name: basename(projectPath) || projectPath,
      path: projectPath,
      description,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      sessionsCount: 0,
      pathStatus: 'valid',
    };
    data.projects.push(project);
  });
  return project;
}

export async function updateProject(store: JsonStore, id: string, patch: Partial<Pick<ProjectRegistration, 'name' | 'description' | 'path'>>): Promise<ProjectRegistration> {
  let updated: ProjectRegistration | undefined;
  const normalizedPath = patch.path ? await validateProjectPath(patch.path) : undefined;
  await store.update((data) => {
    const project = data.projects.find((item) => item.id === id);
    if (!project) throw new Error('Project not found');
    if (patch.name !== undefined) project.name = patch.name;
    if (patch.description !== undefined) project.description = patch.description;
    if (normalizedPath) project.path = normalizedPath;
    project.updatedAt = new Date().toISOString();
    updated = project;
  });
  if (!updated) throw new Error('Project not found');
  return updated;
}

export async function deleteProject(store: JsonStore, id: string): Promise<{ deleted: boolean }> {
  await store.update((data) => {
    data.projects = data.projects.filter((item) => item.id !== id);
    data.sessions = data.sessions.filter((item) => item.projectId !== id);
  });
  return { deleted: true };
}

export interface CreateSessionInput {
  projectId: string;
  agentId: string;
  providerId: string;
  model?: string;
  mode?: SessionMode;
  terminalCols?: number;
  terminalRows?: number;
}

export async function createSession(store: JsonStore, input: CreateSessionInput): Promise<AgentSession> {
  const data = await store.read();
  const project = data.projects.find((item) => item.id === input.projectId);
  if (!project) throw new Error('Unknown projectId');
  await validateProjectPath(project.path);
  const provider = data.providers.find((item) => item.id === input.providerId);
  if (!provider) throw new Error('Unknown providerId');
  const adapter = getAdapter(input.agentId);
  if (!adapter) throw new Error('Unknown agentId');
  const model = input.model || provider.defaultModel || provider.availableModels[0] || '';
  const discovered = await discoverAdapter(adapter);
  const executable = discovered.path || adapter.executableNames[0];
  const id = randomUUID();
  await mkdir(getLogsDir(), { recursive: true });
  const logsPath = buildSessionLogPath(id);
  const now = new Date().toISOString();
  const session: AgentSession = {
    id,
    projectId: project.id,
    agentId: adapter.id,
    providerId: provider.id,
    model,
    status: 'created',
    mode: input.mode || 'pty',
    createdAt: now,
    updatedAt: now,
    command: renderCommand(adapter, executable, { model }),
    cwd: project.path,
    logsPath,
    terminalCols: input.terminalCols || 120,
    terminalRows: input.terminalRows || 30,
    exitCode: null,
  };
  await store.update((next) => {
    next.sessions.push(session);
  });
  return session;
}

export async function startSession(store: JsonStore, id: string): Promise<AgentSession> {
  if (runningProcesses.has(id)) throw new Error('Session is already running');
  let session = await markSession(store, id, 'starting');
  await validateProjectPath(session.cwd);
  const adapter = getAdapter(session.agentId);
  if (!adapter) {
    await markSession(store, id, 'failed', { error: 'Unknown adapter on session', stoppedAt: new Date().toISOString() });
    throw new Error('Unknown adapter on session');
  }
  const discovered = await discoverAdapter(adapter);
  if (discovered.status !== 'detected' || !discovered.path) {
    const message = `${adapter.displayName} is not installed or not in PATH`;
    await markSession(store, id, 'failed', { error: message, stoppedAt: new Date().toISOString() });
    publishSessionEvent(createSessionEvent({ type: 'session_failed', sessionId: id, status: 'failed', error: message }));
    throw new Error(message);
  }

  await mkdir(getLogsDir(), { recursive: true });
  const output = createWriteStream(session.logsPath, { flags: 'a' });
  const args = renderArgs(adapter.argsTemplate, { model: session.model });
  const startedAt = new Date().toISOString();
  const mode = session.mode || 'pty';
  output.write(`\n[Talocode] ${startedAt} starting (${mode}): ${renderCommand(adapter, discovered.path, { model: session.model })}\n`);

  if (mode === 'pty') {
    const pty = spawnPty(discovered.path, args, { cwd: session.cwd, env: process.env, cols: session.terminalCols || 120, rows: session.terminalRows || 30 });
    if (pty) {
      runningProcesses.set(id, { pty, output, mode: 'pty' });
      pty.onData(async (data) => {
        const redacted = redact(data);
        output.write(redacted);
        publishSessionEvent(createSessionEvent({ type: 'output', sessionId: id, data: redacted }));
        await patchSession(store, id, { lastOutputAt: new Date().toISOString() }).catch(() => undefined);
      });
      pty.onExit(async (event) => {
        runningProcesses.delete(id);
        const stoppedAt = new Date().toISOString();
        output.write(`\n[Talocode] ${stoppedAt} PTY exited with code ${event.exitCode}\n`);
        output.end();
        const status: SessionStatus = event.exitCode === 0 ? 'completed' : 'failed';
        await markSession(store, id, status, { exitCode: event.exitCode, stoppedAt, processId: undefined, pid: undefined });
        publishSessionEvent(createSessionEvent({ type: status === 'completed' ? 'session_completed' : 'session_failed', sessionId: id, status, exitCode: event.exitCode }));
      });
      session = await markSession(store, id, 'running', { startedAt, lastStartedAt: startedAt, exitCode: null, error: undefined, processId: pty.pid, pid: pty.pid, mode: 'pty' });
      publishSessionEvent(createSessionEvent({ type: 'session_started', sessionId: id, status: 'running' }));
      return session;
    }
    output.write('[Talocode] node-pty unavailable; falling back to process mode.\n');
    await patchSession(store, id, { mode: 'process', error: 'PTY unavailable; using process fallback.' });
  }

  const child = spawn(discovered.path, args, { cwd: session.cwd, shell: false, windowsHide: true, env: process.env });
  runningProcesses.set(id, { child, output, mode: 'process' });
  child.stdout.on('data', async (chunk: Buffer) => {
    const data = redact(chunk.toString());
    output.write(data);
    publishSessionEvent(createSessionEvent({ type: 'output', sessionId: id, data }));
    await patchSession(store, id, { lastOutputAt: new Date().toISOString() }).catch(() => undefined);
  });
  child.stderr.on('data', async (chunk: Buffer) => {
    const data = redact(chunk.toString());
    output.write(data);
    publishSessionEvent(createSessionEvent({ type: 'output', sessionId: id, data }));
    await patchSession(store, id, { lastOutputAt: new Date().toISOString() }).catch(() => undefined);
  });
  child.on('exit', async (code) => {
    runningProcesses.delete(id);
    const stoppedAt = new Date().toISOString();
    output.write(`\n[Talocode] ${stoppedAt} exited with code ${code ?? 'null'}\n`);
    output.end();
    const status: SessionStatus = code === 0 ? 'completed' : 'failed';
    await markSession(store, id, status, { exitCode: code, stoppedAt, processId: undefined, pid: undefined });
    publishSessionEvent(createSessionEvent({ type: status === 'completed' ? 'session_completed' : 'session_failed', sessionId: id, status, exitCode: code }));
  });
  child.on('error', async (error) => {
    runningProcesses.delete(id);
    const stoppedAt = new Date().toISOString();
    output.write(`\n[Talocode] ${stoppedAt} error: ${redact(error.message)}\n`);
    output.end();
    await markSession(store, id, 'failed', { error: redact(error.message), stoppedAt, processId: undefined, pid: undefined });
    publishSessionEvent(createSessionEvent({ type: 'session_failed', sessionId: id, status: 'failed', error: redact(error.message) }));
  });

  session = await markSession(store, id, 'running', { startedAt, lastStartedAt: startedAt, exitCode: null, error: undefined, processId: child.pid, pid: child.pid, mode: 'process' });
  publishSessionEvent(createSessionEvent({ type: 'session_started', sessionId: id, status: 'running' }));
  return session;
}

export async function stopSession(store: JsonStore, id: string): Promise<AgentSession> {
  const running = runningProcesses.get(id);
  const stoppedAt = new Date().toISOString();
  if (running) {
    running.output.write(`\n[Talocode] ${stoppedAt} stopping session\n`);
    if (running.pty) running.pty.kill();
    if (running.child) running.child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
    runningProcesses.delete(id);
    running.output.end();
  }
  const session = await markSession(store, id, 'stopped', { processId: undefined, pid: undefined, stoppedAt });
  publishSessionEvent(createSessionEvent({ type: 'session_stopped', sessionId: id, status: 'stopped' }));
  return session;
}

export async function writeSessionInput(store: JsonStore, id: string, data: string): Promise<{ accepted: boolean; mode?: SessionMode }> {
  const running = runningProcesses.get(id);
  if (!running) throw new Error('Session is not running');
  if (running.pty) running.pty.write(data);
  else if (running.child) running.child.stdin.write(data);
  publishSessionEvent(createSessionEvent({ type: 'input_ack', sessionId: id }));
  await patchSession(store, id, { lastOutputAt: new Date().toISOString() }).catch(() => undefined);
  return { accepted: true, mode: running.mode };
}

export async function resizeSession(store: JsonStore, id: string, cols: number, rows: number): Promise<{ resized: boolean; cols: number; rows: number }> {
  const running = runningProcesses.get(id);
  if (running?.pty) running.pty.resize(cols, rows);
  await patchSession(store, id, { terminalCols: cols, terminalRows: rows });
  publishSessionEvent(createSessionEvent({ type: 'resized', sessionId: id, cols, rows }));
  return { resized: Boolean(running?.pty), cols, rows };
}

export async function restartSession(store: JsonStore, id: string): Promise<AgentSession> {
  if (runningProcesses.has(id)) await stopSession(store, id);
  return startSession(store, id);
}

export async function readSessionLogs(store: JsonStore, id: string, tail = 20000): Promise<{ sessionId: string; logsPath: string; text: string }> {
  const data = await store.read();
  const session = data.sessions.find((item) => item.id === id);
  if (!session) throw new Error('Unknown session id');
  let text = '';
  try {
    text = (await readFile(session.logsPath, 'utf-8')).slice(-tail);
  } catch {}
  return { sessionId: id, logsPath: session.logsPath, text };
}

export async function stopAllSessions(store: JsonStore): Promise<void> {
  await Promise.all([...runningProcesses.keys()].map((id) => stopSession(store, id).catch(() => undefined)));
}

async function patchSession(store: JsonStore, id: string, patch: Partial<AgentSession>): Promise<AgentSession> {
  let updated: AgentSession | undefined;
  await store.update((data: TalocodeStore) => {
    const idx = data.sessions.findIndex((item) => item.id === id);
    if (idx < 0) throw new Error('Unknown session id');
    data.sessions[idx] = { ...data.sessions[idx], ...patch, updatedAt: new Date().toISOString() };
    updated = data.sessions[idx];
  });
  if (!updated) throw new Error('Unknown session id');
  return updated;
}

async function markSession(store: JsonStore, id: string, status: SessionStatus, patch: Partial<AgentSession> = {}): Promise<AgentSession> {
  let updated: AgentSession | undefined;
  await store.update((data: TalocodeStore) => {
    const idx = data.sessions.findIndex((item) => item.id === id);
    if (idx < 0) throw new Error('Unknown session id');
    data.sessions[idx] = { ...data.sessions[idx], ...patch, status, updatedAt: new Date().toISOString() };
    updated = data.sessions[idx];
  });
  if (!updated) throw new Error('Unknown session id');
  return updated;
}

function redact(input: string): string {
  return input.replace(/(api[_-]?key|token|secret)=\S+/gi, '$1=[redacted]');
}
