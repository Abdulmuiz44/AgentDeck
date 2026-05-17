import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { hashContent, hashManifest } from '../main/talocode/hash';
import { estimateTokens, computeRunTokenEstimate } from '../main/talocode/tokens';
import { estimateRunCacheUsage } from '../main/talocode/context-cache';
import type { ContextPack } from '../main/talocode/types';

test('hashContent produces deterministic 16-char hex strings', () => {
  const a = hashContent('hello world');
  const b = hashContent('hello world');
  assert.equal(a, b);
  assert.equal(a.length, 16);
  assert.match(a, /^[0-9a-f]{16}$/);
});

test('hashContent produces different hashes for different content', () => {
  const a = hashContent('hello world');
  const b = hashContent('hello world!');
  assert.notEqual(a, b);
});

test('hashManifest is order-independent', () => {
  const hashesA = { 'b.txt': 'bbb', 'a.txt': 'aaa' };
  const hashesB = { 'a.txt': 'aaa', 'b.txt': 'bbb' };
  assert.equal(hashManifest(hashesA), hashManifest(hashesB));
});

test('hashManifest produces different hashes for different values', () => {
  const hashesA = { 'a.txt': 'aaa', 'b.txt': 'bbb' };
  const hashesB = { 'a.txt': 'aaa', 'b.txt': 'ccc' };
  assert.notEqual(hashManifest(hashesA), hashManifest(hashesB));
});

test('estimateTokens approximates tokens as chars/4 rounded up', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('abcdefgh'), 2);
});

test('computeRunTokenEstimate calculates savings percent correctly', () => {
  const est = computeRunTokenEstimate(500, 500);
  assert.equal(est.estimatedInputTokens, 1000);
  assert.equal(est.estimatedCachedTokens, 500);
  assert.equal(est.estimatedFreshTokens, 500);
  assert.equal(est.estimatedSavingsPercent, 50);
});

test('computeRunTokenEstimate handles zero total', () => {
  const est = computeRunTokenEstimate(0, 0);
  assert.equal(est.estimatedSavingsPercent, 0);
  assert.equal(est.estimatedInputTokens, 0);
});

test('computeRunTokenEstimate handles 100% cached', () => {
  const est = computeRunTokenEstimate(100, 0);
  assert.equal(est.estimatedSavingsPercent, 100);
});

test('computeRunTokenEstimate handles 0% cached', () => {
  const est = computeRunTokenEstimate(0, 100);
  assert.equal(est.estimatedSavingsPercent, 0);
});

test('estimateRunCacheUsage returns none for undefined pack', () => {
  const result = estimateRunCacheUsage(undefined, '/some/path');
  assert.equal(result.advice, 'none');
  assert.equal(result.pack, undefined);
});

test('estimateRunCacheUsage returns use_cache for active pack', () => {
  const pack: ContextPack = {
    id: 'test-id',
    projectId: 'proj-1',
    name: 'test',
    includedFiles: [],
    contentHash: 'abc',
    manifestHash: 'def',
    estimatedTokens: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cacheHitCount: 0,
    cacheMissCount: 0,
    status: 'active',
  };
  const result = estimateRunCacheUsage(pack, '/some/path');
  assert.equal(result.advice, 'use_cache');
});

test('estimateRunCacheUsage returns rebuild for stale pack', () => {
  const pack: ContextPack = {
    id: 'test-id',
    projectId: 'proj-1',
    name: 'test',
    includedFiles: [],
    contentHash: 'abc',
    manifestHash: 'def',
    estimatedTokens: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cacheHitCount: 0,
    cacheMissCount: 0,
    status: 'stale',
  };
  const result = estimateRunCacheUsage(pack, '/some/path');
  assert.equal(result.advice, 'rebuild');
});

test('estimateRunCacheUsage returns none for archived pack', () => {
  const pack: ContextPack = {
    id: 'test-id',
    projectId: 'proj-1',
    name: 'test',
    includedFiles: [],
    contentHash: 'abc',
    manifestHash: 'def',
    estimatedTokens: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cacheHitCount: 0,
    cacheMissCount: 0,
    status: 'archived',
  };
  const result = estimateRunCacheUsage(pack, '/some/path');
  assert.equal(result.advice, 'none');
});

test('ContextPack includes all required fields', () => {
  const pack: ContextPack = {
    id: 'test-id',
    projectId: 'proj-1',
    name: 'Test Pack',
    description: 'A test pack',
    includedFiles: ['file1.md', 'file2.md'],
    contentHash: 'abc123',
    manifestHash: 'def456',
    estimatedTokens: 150,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    cacheHitCount: 5,
    cacheMissCount: 2,
    status: 'active',
  };
  assert.equal(pack.status, 'active');
  assert.ok(pack.includedFiles.length === 2);
  assert.ok(pack.estimatedTokens > 0);
  assert.ok(pack.cacheHitCount >= 0);
  assert.ok(pack.cacheMissCount >= 0);
});
