import { readFile, stat, readdir } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { randomUUID } from 'crypto';
import { hashContent, hashFile, hashManifest } from './hash';
import { estimateTokens } from './tokens';
import type { ContextPack, ContextCacheMeta } from './types';

const STABLE_FILE_PATTERNS = [
  'AGENTS.md',
  'PROJECT_CONTEXT.md',
  'ARCHITECTURE.md',
  'CODING_RULES.md',
  'TASKLIST.md',
  'DECISIONS.md',
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'README.md',
];

async function findStableFiles(projectPath: string): Promise<string[]> {
  const results: string[] = [];
  const base = resolve(projectPath);

  for (const pattern of STABLE_FILE_PATTERNS) {
    const candidate = join(base, pattern);
    try {
      const info = await stat(candidate);
      if (info.isFile()) results.push(candidate);
    } catch { /* file doesn't exist, skip */ }
  }

  const docsDir = join(base, 'docs');
  try {
    const docsInfo = await stat(docsDir);
    if (docsInfo.isDirectory()) {
      await collectMdFiles(docsDir, results);
    }
  } catch { /* no docs dir */ }

  return results.sort();
}

async function collectMdFiles(dirPath: string, results: string[]): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await collectMdFiles(full, results);
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        results.push(full);
      }
    }
  } catch { /* permission denied or missing */ }
}

export async function buildContextPack(
  projectId: string,
  projectPath: string,
): Promise<ContextPack> {
  const files = await findStableFiles(projectPath);
  const fileHashes: Record<string, string> = {};
  let totalContent = '';

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      fileHashes[file] = hashContent(content);
      totalContent += content;
    } catch {
      fileHashes[file] = hashContent('');
    }
  }

  const manifestHash = hashManifest(fileHashes);
  const contentHash = hashContent(totalContent);
  const estimatedTokens = estimateTokens(totalContent);
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    projectId,
    name: 'Project Context Pack',
    description: `Auto-generated pack from ${files.length} stable project files`,
    includedFiles: files,
    contentHash,
    manifestHash,
    estimatedTokens,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    cacheHitCount: 0,
    cacheMissCount: 0,
    status: 'active',
  };
}

export async function rebuildContextPackFn(
  pack: ContextPack,
  projectPath: string,
): Promise<ContextPack> {
  const files = await findStableFiles(projectPath);
  const fileHashes: Record<string, string> = {};
  let totalContent = '';

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      fileHashes[file] = hashContent(content);
      totalContent += content;
    } catch {
      fileHashes[file] = hashContent('');
    }
  }

  const manifestHash = hashManifest(fileHashes);
  const contentHash = hashContent(totalContent);
  const estimatedTokens = estimateTokens(totalContent);
  const now = new Date().toISOString();

  return {
    ...pack,
    includedFiles: files,
    contentHash,
    manifestHash,
    estimatedTokens,
    updatedAt: now,
    lastUsedAt: now,
    status: 'active',
  };
}

export async function validateContextPack(
  pack: ContextPack,
  projectPath: string,
): Promise<{ fresh: boolean; changedFiles: string[] }> {
  const currentFiles = await findStableFiles(projectPath);
  const currentHashes: Record<string, string> = {};
  const changedFiles: string[] = [];

  for (const file of currentFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      currentHashes[file] = hashContent(content);
    } catch {
      currentHashes[file] = '';
    }
  }

  const currentManifestHash = hashManifest(currentHashes);

  if (currentManifestHash !== pack.manifestHash) {
    for (const [file, hash] of Object.entries(currentHashes)) {
      const packIndex = pack.includedFiles.indexOf(file);
      if (packIndex >= 0) {
        const packFileHashes = await getPackFileHashes(pack, projectPath);
        if (hash !== (packFileHashes[file] || '')) {
          changedFiles.push(file);
        }
      } else {
        changedFiles.push(file);
      }
    }
    for (const oldFile of pack.includedFiles) {
      if (!currentFiles.includes(oldFile)) {
        changedFiles.push(oldFile);
      }
    }
    return { fresh: false, changedFiles: [...new Set(changedFiles)] };
  }

  for (const oldFile of pack.includedFiles) {
    if (!currentFiles.includes(oldFile)) {
      changedFiles.push(oldFile);
    }
  }

  if (changedFiles.length > 0) {
    return { fresh: false, changedFiles };
  }

  return { fresh: true, changedFiles: [] };
}

async function getPackFileHashes(
  _pack: ContextPack,
  projectPath: string,
): Promise<Record<string, string>> {
  const currentFiles = await findStableFiles(projectPath);
  const hashes: Record<string, string> = {};
  for (const file of currentFiles) {
    try {
      hashes[file] = hashContent(await readFile(file, 'utf-8'));
    } catch {
      hashes[file] = '';
    }
  }
  return hashes;
}

export async function computeCacheMeta(
  pack: ContextPack | undefined,
  projectPath: string | undefined,
): Promise<ContextCacheMeta> {
  if (!pack || pack.status !== 'active' || !projectPath) {
    return {
      cacheStatus: 'disabled',
      estimatedCachedTokens: 0,
      estimatedFreshTokens: 0,
      estimatedTotalTokens: 0,
      estimatedSavingsPercent: 0,
      changedFiles: [],
    };
  }

  try {
    const { fresh, changedFiles } = await validateContextPack(pack, projectPath);
    const currentFiles = await findStableFiles(projectPath);
    let freshContent = '';
    for (const file of currentFiles) {
      try {
        freshContent += await readFile(file, 'utf-8');
      } catch { /* skip */ }
    }
    const freshTokens = estimateTokens(freshContent);

    if (fresh) {
      return {
        contextPackId: pack.id,
        cacheStatus: 'hit',
        estimatedCachedTokens: pack.estimatedTokens,
        estimatedFreshTokens: Math.max(0, freshTokens - pack.estimatedTokens),
        estimatedTotalTokens: freshTokens,
        estimatedSavingsPercent: freshTokens > 0
          ? Math.round((pack.estimatedTokens / freshTokens) * 100)
          : 0,
        changedFiles: [],
      };
    }

    return {
      contextPackId: pack.id,
      cacheStatus: 'stale',
      estimatedCachedTokens: 0,
      estimatedFreshTokens: freshTokens,
      estimatedTotalTokens: freshTokens,
      estimatedSavingsPercent: 0,
      changedFiles,
    };
  } catch {
    return {
      cacheStatus: 'miss',
      estimatedCachedTokens: 0,
      estimatedFreshTokens: 0,
      estimatedTotalTokens: 0,
      estimatedSavingsPercent: 0,
      changedFiles: [],
    };
  }
}

export function estimateRunCacheUsage(
  pack: ContextPack | undefined,
  _projectPath: string | undefined,
): { advice: 'use_cache' | 'rebuild' | 'none'; pack: ContextPack | undefined } {
  if (!pack) return { advice: 'none', pack: undefined };
  if (pack.status === 'active') return { advice: 'use_cache', pack };
  if (pack.status === 'stale') return { advice: 'rebuild', pack };
  return { advice: 'none', pack: undefined };
}
