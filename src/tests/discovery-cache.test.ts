import test from 'node:test';
import assert from 'node:assert/strict';
import { TalocodeCore } from '../main/talocode/core';
import { defaultStore } from '../main/talocode/persistence';
import type { TalocodeStore } from '../main/talocode/types';

function createStore(initial: TalocodeStore) {
  let store = structuredClone(initial);
  return {
    async ensure() {},
    async read() {
      return store;
    },
    async write(next: TalocodeStore) {
      store = structuredClone(next);
    },
    async update(mutator: (value: TalocodeStore) => void | Promise<void>) {
      await mutator(store);
      return store;
    },
  };
}

test('discover returns cached tools without refreshing', async () => {
  const store = createStore({
    ...defaultStore(),
    discoveryCache: {
      tools: [{
        id: 'codex-cli',
        name: 'Codex CLI',
        displayName: 'Codex CLI',
        adapterId: 'codex-cli',
        status: 'detected',
        installHint: 'Install Codex CLI',
        docsUrl: 'https://developers.openai.com/codex',
        lastCheckedAt: '2026-05-16T00:00:00.000Z',
      }],
    },
  });

  let refreshCount = 0;
  class TestCore extends TalocodeCore {
    async refreshDiscovery() {
      refreshCount += 1;
      return [];
    }
  }

  const core = new TestCore(store as never);
  const tools = await core.discover();

  assert.equal(refreshCount, 0);
  assert.equal(tools.length, 1);
  assert.equal(tools[0].status, 'detected');
});

test('listAgents falls back to unknown when discovery cache is empty', async () => {
  const store = createStore({
    ...defaultStore(),
    discoveryCache: { tools: [] },
  });

  const core = new TalocodeCore(store as never);
  const agents = await core.listAgents();

  assert.ok(agents.length > 0);
  assert.equal(agents[0].status, 'unknown');
});
