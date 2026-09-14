# Offline Synchronization Design

Status: design baseline
Runtime implementation: not started

## 1. Local stores

### catalog_summary
Compact local replica of every catalog record required for:
- search;
- inventory lookup;
- status display;
- inventory workflow.

Candidate fields:
- id
- inventory_number
- db_number
- author
- title
- year
- shelfmark
- location
- record_state
- loan_status
- verified
- revision
- updated_at

### catalog_full
Full records cached after retrieval or during explicit full synchronization.

Primary key:
- catalog id

### outbox
Pending local mutations.

Fields:
- operation_id
- device_id
- actor_id
- entity_type
- entity_id
- operation_type
- base_revision
- payload
- created_at_client
- sync_state
- attempt_count
- last_attempt_at
- last_error

Allowed sync_state:
- pending
- syncing
- conflict
- failed

Successful operations are removed or archived after server acknowledgement.

### sync_state
Per-device synchronization metadata.

Fields:
- device_id
- last_catalog_cursor
- last_successful_sync
- server_generation/version if later required

### device
Stable browser installation identity.

Fields:
- device_id
- created_at
- label
- platform metadata

## 2. Operation envelope

Example logical shape:

{
  "operation_id": "uuid",
  "device_id": "uuid",
  "actor_id": "server-user-id",
  "entity_type": "catalog_record",
  "entity_id": "10923",
  "operation_type": "update",
  "base_revision": 7,
  "created_at_client": "ISO-8601",
  "payload": {}
}

operation_id is generated before the first submission and remains unchanged across retries.

## 3. Synchronization model

Client:
1. write mutation locally;
2. append operation to outbox;
3. update UI immediately as pending;
4. when online, send pending operation;
5. server validates identity, authorization, idempotency, and revision;
6. server applies mutation atomically;
7. server returns canonical record and new revision;
8. client updates local replica and removes pending operation.

## 4. Conflict classes

### Safe retry
Same operation_id already committed.
Server returns previous success result.

### Revision conflict
Server revision differs from base_revision.
Do not overwrite automatically.
Return canonical server state and mark local operation conflict.

### Business-rule conflict
Example:
two devices attempt to issue the same exemplar.

Server rejects the incompatible operation and returns a structured conflict.

## 5. Connectivity states

UI should distinguish:
- online / synchronized;
- online / synchronization pending;
- offline;
- server read-only/degraded;
- conflict requiring attention.

Browser navigator.onLine is advisory only.
Real state is determined by API results.

## 6. Authentication

First authentication on a device requires network access.

After successful authentication, local offline access may be permitted under
a bounded cached-session policy.

Server authorization is revalidated before queued mutations are accepted.

No Yandex access token should be stored in IndexedDB.

## 7. Cross-platform constraints

Implementation must work in:
- Chromium desktop;
- Firefox desktop where supported;
- Android Chromium-based browsers/PWA;
- iOS Safari/PWA with fallbacks.

Do not make critical workflows depend solely on:
- Background Sync API;
- File System Access API;
- platform-specific native APIs.

Foreground synchronization on app resume/open must always exist as fallback.

## 8. Initial implementation order

1. service worker / installable application shell;
2. IndexedDB wrapper and schema;
3. stable device_id;
4. local catalog-summary cache;
5. offline read/search;
6. outbox;
7. idempotent server mutation API;
8. revision-based concurrency;
9. synchronization engine;
10. inventory workflow;
11. loan/return offline workflow;
12. conflict-resolution UI.

## 9. Completed operation retention

Successful outbox operations should not be silently lost before the client has
durably processed the server acknowledgement.

Recommended flow:

pending -> syncing -> succeeded -> archived/removed

The client may remove succeeded operations after:
- the canonical server result has been written to the local replica;
- the new revision has been stored;
- the acknowledgement has been durably recorded.

A short local history of recently completed operation_id values may be retained
for diagnostics and replay protection.

## 10. Local replica scope

catalog_summary is intended to contain the complete compact catalog available
to the authenticated device.

catalog_full is an additional cache for expanded record data.

The application must not require catalog_full to be complete in order to perform:
- inventory-number lookup;
- general catalog lookup;
- inventory checks;
- basic status display.

Large MARC/raw data should remain outside the normal hot-path synchronization
payload unless explicitly required.
