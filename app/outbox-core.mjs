export const RETRYABLE_STATUS = new Set([408, 425, 429, 502, 503, 504]);

export function classifyResponse(status, payload = {}) {
  if (status >= 200 && status < 300) return 'succeeded';
  if (status === 409 && payload.error === 'revision_conflict') return 'conflict';
  if (RETRYABLE_STATUS.has(status)) return 'pending';
  return 'failed';
}

export function orderedPending(operations) {
  return operations
    .filter((operation) => operation.status === 'pending')
    .sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.operationId.localeCompare(right.operationId),
    );
}

async function attempt(store, operation, fetcher) {
  const attempting = {
    ...operation,
    status: 'syncing',
    attempts: operation.attempts + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: '',
  };
  await store.put(attempting);

  let response;
  try {
    response = await fetcher(operation.url, {
      method: operation.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...operation.payload,
        operationId: operation.operationId,
        deviceId: operation.deviceId,
        createdAt: operation.createdAt,
      }),
    });
  } catch (reason) {
    const pending = {
      ...attempting,
      status: 'pending',
      lastError: reason instanceof Error ? reason.message : 'network_error',
    };
    await store.put(pending);
    return { kind: 'queued', operation: pending };
  }

  const payload = await response.json().catch(() => ({}));
  const classification = classifyResponse(response.status, payload);

  if (classification === 'succeeded') {
    await store.remove(operation.operationId);
    return { kind: 'synced', operation: attempting, payload };
  }

  const updated = {
    ...attempting,
    status: classification,
    lastError: payload.message || payload.error || `HTTP ${response.status}`,
  };
  await store.put(updated);
  return {
    kind: classification === 'pending' ? 'queued' : classification,
    operation: updated,
    payload,
  };
}

export async function submitWithStore(store, descriptor, fetcher = fetch) {
  const operation = {
    ...descriptor,
    status: 'pending',
    attempts: 0,
    lastAttemptAt: '',
    lastError: '',
  };
  await store.put(operation);
  return attempt(store, operation, fetcher);
}

export async function replayPendingWithStore(store, fetcher = fetch) {
  const results = [];
  for (const operation of orderedPending(await store.list())) {
    const result = await attempt(store, operation, fetcher);
    results.push(result);
    if (result.kind === 'queued') break;
  }
  return results;
}
