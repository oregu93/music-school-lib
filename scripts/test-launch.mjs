import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  orderedPending,
  replayPendingWithStore,
  submitWithStore,
} from '../app/outbox-core.mjs';

const root = resolve(import.meta.dirname, '..');

class MemoryStore {
  constructor(shared = new Map()) { this.shared = shared; }
  async put(operation) { this.shared.set(operation.operationId, structuredClone(operation)); }
  async remove(operationId) { this.shared.delete(operationId); }
  async list() { return [...this.shared.values()].map((value) => structuredClone(value)); }
}

function response(status, payload) {
  return { status, json: async () => payload };
}

const descriptor = {
  operationId: '20000000-0000-4000-8000-000000000001',
  deviceId: '30000000-0000-4000-8000-000000000001',
  entityType: 'catalog_record', entityId: '1',
  operationType: 'catalog_update', baseRevision: 6,
  method: 'PATCH', url: '/api/catalog/1',
  payload: { title: 'offline', baseRevision: 6 },
  createdAt: '2026-01-01T00:00:00.000Z',
};

const shared = new Map();
const firstStore = new MemoryStore(shared);
const queued = await submitWithStore(firstStore, descriptor, async () => {
  throw new Error('offline');
});
assert.equal(queued.kind, 'queued');
assert.equal((await new MemoryStore(shared).list()).length, 1);
const replayed = await replayPendingWithStore(
  new MemoryStore(shared),
  async () => response(200, { ok: true, revision: 7 }),
);
assert.equal(replayed[0].kind, 'synced');
assert.equal(shared.size, 0);

const conflictStore = new MemoryStore();
const conflict = await submitWithStore(
  conflictStore,
  descriptor,
  async () => response(409, { error: 'revision_conflict' }),
);
assert.equal(conflict.kind, 'conflict');
assert.equal(
  (await replayPendingWithStore(conflictStore, async () => response(200, {}))).length,
  0,
);

for (const status of [400, 401, 403]) {
  const store = new MemoryStore();
  const result = await submitWithStore(
    store,
    { ...descriptor, operationId: `${status}00000-0000-4000-8000-000000000001` },
    async () => response(status, { error: 'permanent' }),
  );
  assert.equal(result.kind, 'failed');
  assert.equal(orderedPending(await store.list()).length, 0);
}

const ordered = orderedPending([
  { ...descriptor, operationId: 'b', status: 'pending' },
  { ...descriptor, operationId: 'a', status: 'pending' },
]);
assert.deepEqual(ordered.map((item) => item.operationId), ['a', 'b']);

const worker = await readFile(join(root, 'src/worker/index.ts'), 'utf8');
assert.match(worker, /error: "revision_conflict"/);
assert.match(worker, /AND revision = \?/);
assert.match(worker, /\/api\/export\/catalog\.csv/);
assert.match(worker, /pageSize = 500/);
assert.match(worker, /active_loan_conflict/);

console.log('outbox and API contract tests: PASS');
