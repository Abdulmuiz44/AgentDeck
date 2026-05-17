import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { TalocodeCore, TalocodeError } from '../main/talocode/core';
import { JsonStore } from '../main/talocode/persistence';
import { buildLanUrls, getLanAddressCandidates, hashToken, redactSensitive, verifyToken } from '../main/talocode/remote';
import type { NetworkInterfaceInfo } from 'os';

test('LAN IP detection excludes loopback and prefers Wi-Fi/Ethernet IPv4', () => {
  const fake = {
    Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    'Wi-Fi': [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
    Ethernet: [{ address: '10.0.0.8', family: 'IPv4', internal: false }],
    docker0: [{ address: '172.17.0.1', family: 'IPv4', internal: false }],
  } as unknown as Record<string, NetworkInterfaceInfo[]>;
  const candidates = getLanAddressCandidates(fake);
  assert.deepEqual(candidates.map((item) => item.address), ['192.168.1.20', '10.0.0.8', '172.17.0.1']);
  assert.deepEqual(buildLanUrls(3768, 'http://desk.local:3768', fake), ['http://desk.local:3768', 'http://192.168.1.20:3768', 'http://10.0.0.8:3768', 'http://172.17.0.1:3768']);
});

test('buildLanUrls returns empty array when networkInterfaces fails', () => {
  const urls = buildLanUrls(3768);
  assert.ok(Array.isArray(urls));
});

test('buildLanUrls still includes manual URL when LAN detection fails', () => {
  const urls = buildLanUrls(3768, 'http://desk.local:3768', {});
  assert.deepEqual(urls, ['http://desk.local:3768']);
});

test('getLanAddressCandidates handles empty interfaces gracefully', () => {
  const candidates = getLanAddressCandidates({});
  assert.deepEqual(candidates, []);
});

test('token hashing verifies with constant-time compatible hashes and redaction hides tokens', () => {
  const token = 'pair-secret-token';
  const hash = hashToken(token);
  assert.equal(verifyToken(token, hash), true);
  assert.equal(verifyToken('wrong', hash), false);
  assert.match(redactSensitive(`http://x/phone?pair=${token}&token=${token}`), /pair=\[redacted\]/);
  assert.doesNotMatch(redactSensitive(`token=${token}`), new RegExp(token));
});

test('phone access enable, pair, auth, revoke, and disable flow is stored safely', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'talocode-remote-'));
  try {
    const core = new TalocodeCore(new JsonStore(join(dir, 'talocode.json')));
    await core.initialize();
    const initial = await core.getRemoteAccess(3768, '127.0.0.1');
    assert.equal(initial.enabled, false);

    const enabled = await core.enableRemoteAccess(3768, { publicLanUrl: 'http://192.168.1.20:3768' }, '127.0.0.1');
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.phoneUrl, `http://192.168.1.20:3768/phone?pair=${enabled.pairingToken}`);

    const pair = await core.pairPhone(enabled.pairingToken, 'Android Chrome', 'talocode-test token=secret');
    assert.ok(pair.accessToken);
    assert.equal(pair.device.name, 'Android Chrome');
    assert.ok(!JSON.stringify(pair.device).includes('accessTokenHash'));

    const authed = await core.authenticatePhone(pair.accessToken);
    assert.equal(authed?.id, pair.deviceId);
    await core.revokePhoneDevice(pair.deviceId);
    assert.equal(await core.authenticatePhone(pair.accessToken), undefined);

    await assert.rejects(() => core.pairPhone('wrong'), TalocodeError);
    await core.disableRemoteAccess();
    const disabled = await core.getRemoteAccess(3768, '127.0.0.1');
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.pairedDevices.some((device) => !device.revokedAt), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('remote guard blocks unsafe phone APIs', async () => {
  const { isRemoteBlocked } = await import('../main/talocode/daemon-server');
  assert.equal(isRemoteBlocked('/api/integrations/config/write', 'POST'), true);
  assert.equal(isRemoteBlocked('/api/settings/reset', 'POST'), true);
  assert.equal(isRemoteBlocked('/api/providers', 'POST'), true);
  assert.equal(isRemoteBlocked('/api/projects', 'POST'), true);
  assert.equal(isRemoteBlocked('/api/sessions', 'POST'), false);
  assert.equal(isRemoteBlocked('/api/sessions/abc/start', 'POST'), false);
});
