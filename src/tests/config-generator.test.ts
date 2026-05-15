import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenAICompatibleConfig } from '../main/agentdeck/config-generator';

test('generates Codex OpenAI-compatible config without raw secrets', () => {
  const result = generateOpenAICompatibleConfig({
    providerName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    targetTool: 'codex',
  });

  assert.equal(result.canWriteAutomatically, true);
  assert.match(result.generatedConfigText, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(result.generatedConfigText, /sk-/);
  assert.match(result.targetConfigPath, /config\.toml$/);
});

test('generates OpenCode config with env-var reference', () => {
  const result = generateOpenAICompatibleConfig({
    providerName: 'Ollama Local',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1',
    apiKeyEnvVar: 'OLLAMA_API_KEY',
    targetTool: 'opencode',
  });

  const parsed = JSON.parse(result.generatedConfigText);
  assert.equal(parsed.provider.agentdeck.options.apiKey, '{env:OLLAMA_API_KEY}');
  assert.equal(parsed.provider.agentdeck.options.baseURL, 'http://localhost:11434/v1');
});

test('provider normalization rejects raw-looking API key values', async () => {
  const { normalizeProvider } = await import('../main/agentdeck/providers');
  assert.throws(() => normalizeProvider({ name: 'Unsafe', type: 'openrouter', apiKeyEnvVar: 'sk-raw-secret' }), /environment variable name/);
});

test('session command rendering uses argument templates without shell interpolation', async () => {
  const { getAdapter, renderArgs } = await import('../main/agentdeck/agents');
  const adapter = getAdapter('codex-cli');
  assert.ok(adapter);
  assert.deepEqual(renderArgs(adapter.argsTemplate, { model: 'llama3.1' }), ['--model', 'llama3.1']);
});

test('project path validation accepts existing directories and rejects missing paths', async () => {
  const { validateProjectPath } = await import('../main/agentdeck/sessions');
  assert.equal(await validateProjectPath(process.cwd()), process.cwd());
  await assert.rejects(() => validateProjectPath('/definitely/missing/agentdeck/path'));
});

test('discovery returns safe missing result for unknown executable', async () => {
  const { discoverTool } = await import('../main/agentdeck/discovery');
  const result = await discoverTool({
    id: 'missing-test-tool',
    name: 'Missing Test Tool',
    executableNames: ['agentdeck-definitely-missing-tool'],
    versionArgs: ['--version'],
    docsUrl: 'https://example.com',
    installHint: 'Install the missing test tool.',
  });
  assert.equal(result.status, 'missing');
  assert.equal(result.id, 'missing-test-tool');
  assert.ok(result.lastCheckedAt);
});

test('session event factory stamps stream events', async () => {
  const { createSessionEvent } = await import('../main/agentdeck/session-events');
  const event = createSessionEvent({ type: 'output', sessionId: 's1', data: 'hello' });
  assert.equal(event.type, 'output');
  assert.equal(event.sessionId, 's1');
  assert.ok(event.timestamp);
});

test('PTY adapter reports availability without throwing', async () => {
  const { isPtyAvailable } = await import('../main/agentdeck/pty-adapter');
  assert.equal(typeof isPtyAvailable(), 'boolean');
});

test('service commands are guarded on non-Windows platforms', async () => {
  const { runServiceCommand } = await import('../cli/service');
  const result = await runServiceCommand('status') as { supported?: boolean };
  if (process.platform !== 'win32') assert.equal(result.supported, false);
});
