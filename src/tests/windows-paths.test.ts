import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, win32 } from 'path';
import { buildConfigBackupPath, writeOpenAICompatibleConfig } from '../main/agentdeck/config-generator';
import { resolveDataDir } from '../main/agentdeck/paths';
import { buildSessionLogPath, normalizeProjectPath, validateProjectPath } from '../main/agentdeck/sessions';

test('normalizes Windows-style project paths without losing drive or spaces', () => {
  const normalized = normalizeProjectPath('C:\\Users\\Name With Spaces\\project', 'win32');
  assert.equal(normalized, 'C:\\Users\\Name With Spaces\\project');
  assert.equal(win32.isAbsolute(normalized), true);
});

test('validates project paths with spaces and rejects missing paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agentdeck path with spaces '));
  try {
    assert.equal(await validateProjectPath(dir), dir);
    await assert.rejects(() => validateProjectPath(join(dir, 'missing')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('builds log paths under data logs directory without shell interpolation', () => {
  assert.equal(buildSessionLogPath('session-1', 'C:\\Users\\Name With Spaces\\AppData\\Roaming\\AgentDeck\\logs'), 'C:\\Users\\Name With Spaces\\AppData\\Roaming\\AgentDeck\\logs/session-1.log');
});

test('builds config backup paths and writes backup for paths with spaces', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agentdeck config space '));
  try {
    const target = join(dir, 'config file.toml');
    await mkdir(dir, { recursive: true });
    await writeFile(target, 'old', 'utf-8');
    const expected = buildConfigBackupPath(target, new Date('2026-05-15T12:00:00.000Z'));
    assert.match(expected, /agentdeck-backup-2026-05-15T12-00-00-000Z$/);
    const result = await writeOpenAICompatibleConfig({ providerName: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3', targetTool: 'codex', targetConfigPath: target, dryRun: false });
    assert.equal(result.written, true);
    assert.ok(result.backupPath?.includes('config file.toml.agentdeck-backup-'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolves Windows app data directory from APPDATA', () => {
  const dataDir = resolveDataDir({ platform: 'win32', env: { APPDATA: 'C:\\Users\\Name With Spaces\\AppData\\Roaming' }, homeDir: 'C:\\Users\\Name With Spaces' });
  assert.equal(dataDir, 'C:\\Users\\Name With Spaces\\AppData\\Roaming/AgentDeck');
});
