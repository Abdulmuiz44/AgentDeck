import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Workspace } from '../renderer/types';

function getStorePath(): string {
  const dataDir = join(app.getPath('appData'), 'Talocode');
  return join(dataDir, 'workspaces.json');
}

async function ensureDataDir(): Promise<void> {
  const dataDir = join(app.getPath('appData'), 'Talocode');
  await mkdir(dataDir, { recursive: true });
}

async function readStore(): Promise<{ workspaces: Workspace[] }> {
  try {
    await ensureDataDir();
    const raw = await readFile(getStorePath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { workspaces: [] };
  }
}

async function writeStore(data: { workspaces: Workspace[] }): Promise<void> {
  await ensureDataDir();
  await writeFile(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const store = await readStore();
  return store.workspaces.sort(
    (a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
  );
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const store = await readStore();
  const idx = store.workspaces.findIndex((w) => w.id === workspace.id);
  if (idx >= 0) {
    store.workspaces[idx] = workspace;
  } else {
    store.workspaces.push(workspace);
  }
  await writeStore(store);
}

export async function deleteWorkspace(id: string): Promise<void> {
  const store = await readStore();
  store.workspaces = store.workspaces.filter((w) => w.id !== id);
  await writeStore(store);
}
