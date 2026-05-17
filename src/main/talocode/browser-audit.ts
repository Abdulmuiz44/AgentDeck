import { appendFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { getDataDir } from './paths';
import type { BrowserAuditEvent, BrowserAuditEventType } from './types';

const auditLogPath = join(getDataDir(), 'browser-audit.jsonl');

export async function appendAuditEvent(
  type: BrowserAuditEventType,
  sessionId: string,
  actor: 'user' | 'agent' | 'system' = 'system',
  metadata?: Record<string, unknown>,
): Promise<BrowserAuditEvent> {
  const event: BrowserAuditEvent = {
    id: randomUUID(),
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    actor,
    metadata,
  };

  await mkdir(dirname(auditLogPath), { recursive: true });
  await appendFile(auditLogPath, JSON.stringify(event) + '\n', 'utf-8');

  return event;
}
