import { mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { resolveBrowserRuntimeConfig, browserUserDataDir } from './browser-config';
import { appendAuditEvent } from './browser-audit';
import type { BrowserSession, BrowserSessionStatus, BrowserRuntimeConfig } from './types';

export interface BrowserRuntimeStore {
  read(): Promise<{ browserSessions: BrowserSession[]; browserRuntimeConfig: BrowserRuntimeConfig }>;
  write(update: (data: { browserSessions: BrowserSession[]; browserRuntimeConfig: BrowserRuntimeConfig }) => void | Promise<void>): Promise<void>;
}

interface RunningSession {
  context: PlaywrightContext;
  page: PlaywrightPage;
}

interface PlaywrightPage {
  goto(url: string, opts?: Record<string, unknown>): Promise<void>;
}

interface PlaywrightContext {
  pages(): PlaywrightPage[];
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
  storageState(): Promise<unknown>;
}

interface PlaywrightModule {
  chromium: {
    launchPersistentContext(userDataDir: string, options?: Record<string, unknown>): Promise<PlaywrightContext>;
  };
}

export class BrowserRuntime {
  private running = new Map<string, RunningSession>();
  private config: BrowserRuntimeConfig;

  constructor(
    private readonly store: BrowserRuntimeStore,
    config?: BrowserRuntimeConfig,
  ) {
    this.config = config || resolveBrowserRuntimeConfig();
  }

  getConfig(): BrowserRuntimeConfig {
    return { ...this.config };
  }

  isAvailable(): boolean {
    try {
      require.resolve('playwright');
      return true;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<BrowserSession[]> {
    const data = await this.store.read();
    return [...data.browserSessions].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  }

  async getSession(id: string): Promise<BrowserSession> {
    const data = await this.store.read();
    const session = data.browserSessions.find((s) => s.id === id);
    if (!session) throw new BrowserRuntimeError(404, 'Browser session not found');
    return session;
  }

  async createSession(input: {
    name: string;
    startUrl?: string;
    headless?: boolean;
    viewport?: { width: number; height: number };
    notes?: string;
  }): Promise<BrowserSession> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const session: BrowserSession = {
      id,
      name: input.name || 'Untitled Session',
      status: 'stopped',
      createdAt: now,
      updatedAt: now,
      startUrl: input.startUrl,
      userDataDir: browserUserDataDir(this.config, id),
      viewport: input.viewport || this.config.defaultViewport,
      headless: input.headless ?? this.config.defaultHeadless,
      notes: input.notes,
    };

    await mkdir(session.userDataDir, { recursive: true });

    await this.store.write(async (data) => {
      data.browserSessions.push(session);
    });

    await appendAuditEvent('browser.session.created', id, 'user');

    return session;
  }

  async updateSession(
    id: string,
    patch: { name?: string; startUrl?: string; notes?: string },
  ): Promise<BrowserSession> {
    let updated: BrowserSession | undefined;
    await this.store.write((data) => {
      const session = data.browserSessions.find((s) => s.id === id);
      if (!session) throw new BrowserRuntimeError(404, 'Browser session not found');
      if (patch.name !== undefined) session.name = patch.name;
      if (patch.startUrl !== undefined) session.startUrl = patch.startUrl;
      if (patch.notes !== undefined) session.notes = patch.notes;
      session.updatedAt = new Date().toISOString();
      updated = { ...session };
    });
    return updated!;
  }

  async deleteSession(id: string): Promise<{ deleted: boolean }> {
    const session = await this.getSession(id);
    if (session.status === 'running' || session.status === 'starting') {
      await this.stopSession(id);
    }

    try {
      await rm(session.userDataDir, { recursive: true, force: true });
    } catch {
      /* non-fatal: profile dir may not exist */
    }

    await this.store.write((data) => {
      const idx = data.browserSessions.findIndex((s) => s.id === id);
      if (idx >= 0) data.browserSessions.splice(idx, 1);
    });

    await appendAuditEvent('browser.session.deleted', id, 'user');

    return { deleted: true };
  }

  async startSession(id: string): Promise<BrowserSession> {
    if (!this.config.enabled) {
      throw new BrowserRuntimeError(403, 'Browser runtime is disabled');
    }

    const data = await this.store.read();
    const session = data.browserSessions.find((s) => s.id === id);
    if (!session) throw new BrowserRuntimeError(404, 'Browser session not found');

    if (session.status === 'running' || session.status === 'starting') {
      throw new BrowserRuntimeError(409, 'Session is already running');
    }

    const runningCount = this.running.size;
    if (runningCount >= this.config.maxRunningSessions) {
      throw new BrowserRuntimeError(429, `Maximum running sessions reached (${this.config.maxRunningSessions})`);
    }

    let playwrightModule: PlaywrightModule;
    try {
      playwrightModule = require('playwright') as PlaywrightModule;
    } catch {
      throw new BrowserRuntimeError(500, 'Playwright is not installed. Run: npm install playwright && npx playwright install chromium');
    }

    await this.setSessionStatus(id, 'starting');

    try {
      const context = await playwrightModule.chromium.launchPersistentContext(
        session.userDataDir,
        {
          headless: session.headless,
          viewport: session.viewport || undefined,
          slowMo: this.config.slowMo,
          channel: this.config.browserChannel as 'chrome' | 'msedge' | undefined,
        },
      );

      const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

      if (session.startUrl) {
        await page.goto(session.startUrl, { waitUntil: 'domcontentloaded' }).catch(() => {
          /* non-fatal: URL may be invalid */
        });
      }

      this.running.set(id, { context, page });

      const now = new Date().toISOString();
      await this.store.write((storeData) => {
        const s = storeData.browserSessions.find((bs) => bs.id === id);
        if (s) {
          s.status = 'running';
          s.lastStartedAt = now;
          s.updatedAt = now;
          s.lastError = undefined;
        }
      });

      await appendAuditEvent('browser.session.started', id, 'user');
      if (session.startUrl) {
        await appendAuditEvent('browser.session.opened_url', id, 'system', { url: session.startUrl });
      }

      return { ...session, status: 'running', lastStartedAt: now };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to launch browser';
      await this.setSessionError(id, message);
      throw new BrowserRuntimeError(500, message);
    }
  }

  async stopSession(id: string): Promise<BrowserSession> {
    const data = await this.store.read();
    const session = data.browserSessions.find((s) => s.id === id);
    if (!session) throw new BrowserRuntimeError(404, 'Browser session not found');

    if (session.status !== 'running' && session.status !== 'starting') {
      throw new BrowserRuntimeError(409, 'Session is not running');
    }

    await this.setSessionStatus(id, 'stopping');

    const running = this.running.get(id);
    if (running) {
      try {
        await running.context.close();
      } catch { /* browser may already be closed */ }
      this.running.delete(id);
    }

    const now = new Date().toISOString();
    await this.store.write((storeData) => {
      const s = storeData.browserSessions.find((bs) => bs.id === id);
      if (s) {
        s.status = 'stopped';
        s.lastStoppedAt = now;
        s.updatedAt = now;
        s.lastError = undefined;
      }
    });

    await appendAuditEvent('browser.session.stopped', id, 'user');

    return { ...session, status: 'stopped', lastStoppedAt: now };
  }

  async restartSession(id: string): Promise<BrowserSession> {
    const data = await this.store.read();
    const session = data.browserSessions.find((s) => s.id === id);
    if (!session) throw new BrowserRuntimeError(404, 'Browser session not found');

    if (session.status === 'running' || session.status === 'starting') {
      await this.stopSession(id);
    }

    await appendAuditEvent('browser.session.restarted', id, 'user');

    return this.startSession(id);
  }

  async openPage(id: string, url: string): Promise<void> {
    if (!url || typeof url !== 'string') {
      throw new BrowserRuntimeError(400, 'URL is required');
    }

    try {
      new URL(url);
    } catch {
      throw new BrowserRuntimeError(400, 'Invalid URL');
    }

    const running = this.running.get(id);
    if (!running) throw new BrowserRuntimeError(409, 'Session is not running');

    try {
      await running.page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to navigate';
      throw new BrowserRuntimeError(500, message);
    }

    await appendAuditEvent('browser.session.opened_url', id, 'user', { url });
  }

  async getSessionState(id: string): Promise<{ running: boolean; status: BrowserSessionStatus; activePagesCount: number }> {
    await this.getSession(id);
    const running = this.running.get(id);
    if (!running) return { running: false, status: 'stopped', activePagesCount: 0 };

    const ctx = running.context;
    return {
      running: true,
      status: 'running',
      activePagesCount: ctx.pages().length,
    };
  }

  async exportSessionStorageState(id: string): Promise<unknown> {
    const running = this.running.get(id);
    if (!running) throw new BrowserRuntimeError(409, 'Session is not running');

    const state = await running.context.storageState();

    await appendAuditEvent('browser.session.storage_exported', id, 'user');

    return state;
  }

  async clearSessionData(id: string): Promise<{ cleared: boolean }> {
    const session = await this.getSession(id);
    if (session.status === 'running' || session.status === 'starting') {
      await this.stopSession(id);
    }

    try {
      await rm(session.userDataDir, { recursive: true, force: true });
    } catch { /* may not exist */ }

    await mkdir(session.userDataDir, { recursive: true });
    await appendAuditEvent('browser.session.data_cleared', id, 'user');

    return { cleared: true };
  }

  async takeOverSession(id: string): Promise<{ takeoverAvailable: boolean }> {
    const session = await this.getSession(id);
    if (session.status !== 'running') {
      return { takeoverAvailable: false };
    }
    return { takeoverAvailable: !session.headless };
  }

  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [id] of this.running) {
      const running = this.running.get(id);
      if (running) {
        promises.push(
          running.context.close().catch(() => {}),
        );
      }
    }
    await Promise.allSettled(promises);
    this.running.clear();
  }

  private async setSessionStatus(id: string, status: BrowserSessionStatus): Promise<void> {
    const now = new Date().toISOString();
    await this.store.write((data) => {
      const s = data.browserSessions.find((bs) => bs.id === id);
      if (s) {
        s.status = status;
        s.updatedAt = now;
      }
    });
  }

  private async setSessionError(id: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await this.store.write((data) => {
      const s = data.browserSessions.find((bs) => bs.id === id);
      if (s) {
        s.status = 'error';
        s.lastError = error;
        s.updatedAt = now;
      }
    });
    await appendAuditEvent('browser.session.error', id, 'system', { error });
  }
}

export class BrowserRuntimeError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
