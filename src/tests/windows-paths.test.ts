import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, posix, win32 } from 'path';
import { buildConfigBackupPath, writeOpenAICompatibleConfig } from '../main/talocode/config-generator';
import { resolveDataDir } from '../main/talocode/paths';
import { buildSessionLogPath, normalizeProjectPath, validateProjectPath } from '../main/talocode/sessions';

test('normalizes Windows-style project paths without losing drive or spaces', () => {
  const normalized = normalizeProjectPath('C:\\Users\\Name With Spaces\\project', 'win32');
  assert.equal(normalized, 'C:\\Users\\Name With Spaces\\project');
  assert.equal(win32.isAbsolute(normalized), true);
});

test('validates project paths with spaces and rejects missing paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'talocode path with spaces '));
  try {
    assert.equal(await validateProjectPath(dir), dir);
    await assert.rejects(() => validateProjectPath(join(dir, 'missing')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('builds log paths under data logs directory without shell interpolation', () => {
  assert.equal(buildSessionLogPath('session-1', 'C:\\Users\\Name With Spaces\\AppData\\Roaming\\Talocode\\logs'), win32.join('C:\\Users\\Name With Spaces\\AppData\\Roaming\\Talocode\\logs', 'session-1.log'));
});

test('builds config backup paths and writes backup for paths with spaces', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'talocode config space '));
  try {
    const target = join(dir, 'config file.toml');
    await mkdir(dir, { recursive: true });
    await writeFile(target, 'old', 'utf-8');
    const expected = buildConfigBackupPath(target, new Date('2026-05-15T12:00:00.000Z'));
    assert.match(expected, /talocode-backup-2026-05-15T12-00-00-000Z$/);
    const result = await writeOpenAICompatibleConfig({ providerName: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3', targetTool: 'codex', targetConfigPath: target, dryRun: false });
    assert.equal(result.written, true);
    assert.ok(result.backupPath?.includes('config file.toml.talocode-backup-'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolves Windows app data directory from APPDATA', () => {
  const dataDir = resolveDataDir({ platform: 'win32', env: { APPDATA: 'C:\\Users\\Name With Spaces\\AppData\\Roaming' }, homeDir: 'C:\\Users\\Name With Spaces' });
  assert.equal(dataDir, win32.join('C:\\Users\\Name With Spaces\\AppData\\Roaming', 'Talocode'));
});

test('Talocode env vars take precedence over legacy AgentDeck env vars', () => {
  const dataDir = resolveDataDir({
    platform: 'linux',
    env: { TALOCODE_DATA_DIR: '/tmp/talocode-primary', AGENTDECK_DATA_DIR: '/tmp/agentdeck-legacy' },
    homeDir: '/home/dev',
  });
  assert.equal(dataDir, '/tmp/talocode-primary');
});

test('legacy AgentDeck data dir env var remains a fallback', () => {
  const dataDir = resolveDataDir({
    platform: 'linux',
    env: { AGENTDECK_DATA_DIR: '/tmp/agentdeck-legacy' },
    homeDir: '/home/dev',
  });
  assert.equal(dataDir, '/tmp/agentdeck-legacy');
});

test('resolves Linux Talocode config directory by default', () => {
  const dataDir = resolveDataDir({ platform: 'linux', env: {}, homeDir: '/home/dev' });
  assert.equal(dataDir, posix.join('/home/dev', '.config', 'talocode'));
});
