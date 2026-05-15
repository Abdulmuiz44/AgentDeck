#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, 'dist', 'cli', 'index.js');
const renderer = join(root, 'dist', 'renderer', 'index.html');

async function main() {
  await ensureBuilt();
  const port = await freePort();
  const dataDir = await mkdtemp(join(tmpdir(), 'agentdeck-smoke-'));
  const env = { ...process.env, AGENTDECK_PORT: String(port), AGENTDECK_DATA_DIR: dataDir, NO_PROXY: '*', no_proxy: '*' };
  const child = spawn(process.execPath, [cli, 'start'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitFor(`${base}/health`, 200, 20_000);
    await getJson(`${base}/health`);
    await getJson(`${base}/api/status`);
    await getJson(`${base}/api/providers`);
    await getJson(`${base}/api/agents`);
    await getJson(`${base}/api/projects`);
    await getJson(`${base}/api/sessions`);
    await getJson(`${base}/api/system/discover`);
    await getJson(`${base}/api/remote/access`);
    await expectText(`${base}/phone`, 200, '<!doctype html>');
    await expectText(`${base}/architecture`, 200, 'AgentDeck Architecture');
    await expectText(`${base}/architecture`, 200, 'Access Layer');
    await expectText(`${base}/architecture`, 200, 'Provider Router');
    await expectText(`${base}/architecture`, 200, 'Execution & Storage');

    const enabled = await postJson(`${base}/api/remote/access/enable`, {});
    assert(enabled.pairingToken, 'remote enable did not return one-time pairing token');
    assert(enabled.phoneUrl, 'remote enable did not return phoneUrl');
    await waitFor(`${base}/health`, 200, 10_000);
    const paired = await postJson(`${base}/api/remote/pair`, { token: enabled.pairingToken, deviceName: 'Smoke Test Phone', userAgent: 'agentdeck-smoke' });
    assert(paired.accessToken, 'pairing did not return accessToken');
    assert(paired.deviceId, 'pairing did not return deviceId');
    const phoneHeaders = { Authorization: `Bearer ${paired.accessToken}`, 'X-AgentDeck-Remote-Client': 'phone' };
    const snapshot = await getJson(`${base}/api/phone/snapshot`, phoneHeaders);
    assert(snapshot.status && Array.isArray(snapshot.providers), 'phone snapshot shape is invalid');
    const blocked = await postJson(`${base}/api/integrations/config/write`, {}, phoneHeaders, true);
    assert(blocked.status === 403, 'phone client unexpectedly reached integration write endpoint');
    const revoked = await postJson(`${base}/api/remote/access/revoke-device`, { deviceId: paired.deviceId });
    assert(revoked.revoked === true, 'device revoke did not return revoked=true');
    const afterRevoke = await fetch(`${base}/api/phone/snapshot`, { headers: phoneHeaders });
    assert(afterRevoke.status === 401, `revoked token should fail with 401, got ${afterRevoke.status}`);
    await postJson(`${base}/api/remote/access/disable`, {});
    console.log(`AgentDeck smoke test passed on port ${port}`);
  } finally {
    child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
    await waitForExit(child, 8000).catch(() => child.kill('SIGKILL'));
    await rm(dataDir, { recursive: true, force: true });
    if (output && process.env.AGENTDECK_SMOKE_VERBOSE) console.log(output);
  }
}

async function ensureBuilt() {
  try {
    await stat(cli);
    await stat(renderer);
  } catch {
    await run('npm', ['run', 'build']);
  }
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`${command} ${args.join(' ')} exited ${code}`)));
  });
}

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.on('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitFor(url, expectedStatus, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status === expectedStatus) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function getJson(url, headers = {}) {
  let response;
  try { response = await fetch(url, { headers }); } catch (error) { throw new Error(`${url} fetch failed: ${error instanceof Error ? error.message : String(error)}`); }
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function postJson(url, body, headers = {}, allowFailure = false) {
  let response;
  try { response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); } catch (error) { throw new Error(`${url} fetch failed: ${error instanceof Error ? error.message : String(error)}`); }
  const payload = await response.json().catch(() => ({}));
  if (!allowFailure) assert(response.ok, `${url} failed: ${response.status} ${JSON.stringify(payload)}`);
  return allowFailure ? { status: response.status, payload } : payload;
}

async function expectText(url, status, includes) {
  const response = await fetch(url);
  const text = await response.text();
  assert(response.status === status, `${url} returned ${response.status}`);
  assert(text.toLowerCase().includes(includes.toLowerCase()), `${url} did not include ${includes}`);
}

async function expectStatus(url, status) {
  const response = await fetch(url);
  assert(response.status === status, `${url} returned ${response.status}`);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(() => rejectExit(new Error('daemon did not exit cleanly')), timeoutMs);
    child.on('exit', () => { clearTimeout(timer); resolveExit(); });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
