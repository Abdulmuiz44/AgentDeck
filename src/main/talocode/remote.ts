import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { networkInterfaces } from 'os';
import type { IncomingMessage } from 'http';
import type { LanAddressCandidate, PairedPhoneDevice, RemoteAccessSettings } from './types';

export const PHONE_SESSION_DAYS = 30;
const SENSITIVE_PATTERN = /(pair=|token=|accessToken=|authorization:\s*bearer\s+)([^&\s]+)/gi;

export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(`talocode:v1:${token}`).digest('hex');
}

export function verifyToken(token: string, expectedHash?: string): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function redactSensitive(input: string): string {
  return input.replace(SENSITIVE_PATTERN, (_match, prefix) => `${prefix}[redacted]`);
}

export function getLanAddressCandidates(interfaces = networkInterfaces()): LanAddressCandidate[] {
  const candidates: LanAddressCandidate[] = [];
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || !entry.address || entry.address.startsWith('127.')) continue;
      candidates.push({ address: entry.address, interfaceName: name, priority: scoreInterface(name) });
    }
  }
  return candidates.sort((a, b) => b.priority - a.priority || a.interfaceName.localeCompare(b.interfaceName));
}

export function buildLanUrls(port: number, manualUrl?: string, interfaces = networkInterfaces()): string[] {
  const urls = getLanAddressCandidates(interfaces).map((candidate) => `http://${candidate.address}:${port}`);
  return [...new Set([manualUrl, ...urls].filter((url): url is string => Boolean(url)))];
}

export function buildPhoneUrl(baseUrl: string, token?: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return token ? `${cleanBase}/phone?pair=${encodeURIComponent(token)}` : `${cleanBase}/phone`;
}

export function buildWarnings(settings: RemoteAccessSettings, lanUrls: string[], currentBindHost?: string): string[] {
  const warnings: string[] = [];
  if (settings.phoneAccessEnabled) {
    warnings.push('Phone control is enabled for your local network. Anyone with a valid pairing link or paired device token can control Talocode sessions.');
    if (settings.bindHost === '0.0.0.0') warnings.push('The daemon is configured to bind to 0.0.0.0 so devices on the same LAN can reach it.');
    if (currentBindHost && isLocalOnlyHost(currentBindHost)) warnings.push('The current daemon listener is still localhost-only. Restart Talocode or use talo start with phone access enabled to accept LAN connections.');
  }
  if (!lanUrls.length) warnings.push('No LAN IPv4 address was detected. Check Wi-Fi/Ethernet or set a manual publicLanUrl override.');
  return warnings;
}

export function isLocalOnlyHost(host?: string): boolean {
  return !host || host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

export function isLocalRequest(req: IncomingMessage): boolean {
  if (req.headers['x-talocode-remote-client'] === 'phone') return false;
  const address = req.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address === 'localhost';
}

export function bearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(header) ? header[0] : header);
  return match?.[1];
}

export function activeDevices(devices: PairedPhoneDevice[], now = Date.now()): PairedPhoneDevice[] {
  return devices.filter((device) => !device.revokedAt && Date.parse(device.expiresAt) > now);
}

function scoreInterface(name: string): number {
  const normalized = name.toLowerCase();
  if (normalized.includes('wi-fi') || normalized.includes('wifi') || normalized.includes('wlan')) return 100;
  if (normalized.includes('ethernet') || normalized.includes('eth') || normalized.includes('en')) return 90;
  if (normalized.includes('vpn') || normalized.includes('virtual') || normalized.includes('vbox') || normalized.includes('vmware')) return 10;
  return 50;
}
