import {
  replayPendingWithStore,
  submitWithStore,
} from './outbox-core.mjs';

export type OutboxStatus = 'pending' | 'syncing' | 'conflict' | 'failed';
export type OutboxOperation = {
  operationId: string;
  deviceId: string;
  entityType: string;
  entityId?: string;
  operationType: string;
  baseRevision?: number;
  method: string;
  url: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt: string;
  lastError: string;
};
export type OutboxStore = {
  put(operation: OutboxOperation): Promise<void>;
  remove(operationId: string): Promise<void>;
  list(): Promise<OutboxOperation[]>;
};
export type MutationResult = {
  kind: 'synced' | 'queued' | 'conflict' | 'failed';
  operation: OutboxOperation;
  payload?: Record<string, unknown>;
};

const DATABASE_NAME = 'music-school-library-outbox';
const DATABASE_VERSION = 1;
const OPERATIONS = 'operations';
const META = 'meta';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPERATIONS)) {
        const store = db.createObjectStore(OPERATIONS, { keyPath: 'operationId' });
        store.createIndex('status_created', ['status', 'createdAt']);
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function transaction<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await requestResult(run(db.transaction(storeName, mode).objectStore(storeName)));
  } finally {
    db.close();
  }
}

export const indexedDbOutbox: OutboxStore = {
  put: async (operation) => { await transaction(OPERATIONS, 'readwrite', (store) => store.put(operation)); },
  remove: async (operationId) => { await transaction(OPERATIONS, 'readwrite', (store) => store.delete(operationId)); },
  list: () => transaction(OPERATIONS, 'readonly', (store) => store.getAll()) as Promise<OutboxOperation[]>,
};

export async function getDeviceId(): Promise<string> {
  const existing = await transaction(META, 'readonly', (store) => store.get('deviceId')) as string | undefined;
  if (existing) return existing;
  const created = crypto.randomUUID();
  await transaction(META, 'readwrite', (store) => store.put(created, 'deviceId'));
  return created;
}

export type MutationDescriptor = {
  entityType: string;
  entityId?: string;
  operationType: string;
  baseRevision?: number;
  method: string;
  url: string;
  payload: Record<string, unknown>;
};

export async function submitMutation(descriptor: MutationDescriptor): Promise<MutationResult> {
  const operationId = crypto.randomUUID();
  const result = await submitWithStore(indexedDbOutbox, {
    ...descriptor,
    operationId,
    deviceId: await getDeviceId(),
    createdAt: new Date().toISOString(),
  }) as MutationResult;
  window.dispatchEvent(new Event('mlc-outbox-changed'));
  return result;
}

export async function replayPendingMutations(): Promise<MutationResult[]> {
  const results = await replayPendingWithStore(indexedDbOutbox) as MutationResult[];
  window.dispatchEvent(new Event('mlc-outbox-changed'));
  return results;
}

export async function getOutboxCounts() {
  const counts = { pending: 0, conflict: 0, failed: 0 };
  for (const operation of await indexedDbOutbox.list()) {
    if (operation.status === 'pending' || operation.status === 'syncing') counts.pending += 1;
    else if (operation.status === 'conflict') counts.conflict += 1;
    else if (operation.status === 'failed') counts.failed += 1;
  }
  return counts;
}
