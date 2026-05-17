import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  return hashContent(content);
}

export function hashManifest(fileHashes: Record<string, string>): string {
  const sorted = Object.keys(fileHashes)
    .sort()
    .map((key) => `${key}:${fileHashes[key]}`)
    .join('\n');
  return hashContent(sorted);
}
