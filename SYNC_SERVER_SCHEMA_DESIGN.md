# Server Synchronization Schema Design

Status: design baseline
Migration implementation: not started

## 1. catalog_records revision

Add an integer revision to mutable catalog records.

Logical definition:

revision INTEGER NOT NULL DEFAULT 1

Rules:
- every accepted mutation increments revision exactly once;
- client sends base_revision;
- mutation succeeds only if current revision == base_revision;
- stale base_revision returns structured conflict;
- revision is returned in list, full-record, and sync responses.

Do not use timestamps as the primary concurrency token.

## 2. operation idempotency

Create a durable server-side operation ledger.

Candidate table:

sync_operations

Fields:
- operation_id TEXT PRIMARY KEY
- device_id TEXT NOT NULL
- actor_user_id TEXT NOT NULL
- entity_type TEXT NOT NULL
- entity_id TEXT
- operation_type TEXT NOT NULL
- base_revision INTEGER
- request_payload TEXT
- result_payload TEXT
- result_status TEXT NOT NULL
- created_at_client TEXT
- received_at_server TEXT NOT NULL
- completed_at_server TEXT

Candidate result_status:
- applied
- conflict
- rejected

Rules:
- operation_id is generated client-side before first submission;
- replay of an already applied operation_id must not apply the mutation again;
- replay should return the stored canonical result;
- mutation and operation-ledger write must be atomic where practical.

## 3. device identity

Candidate table:

client_devices

Fields:
- device_id TEXT PRIMARY KEY
- first_seen_at TEXT NOT NULL
- last_seen_at TEXT NOT NULL
- created_by_user_id TEXT
- label TEXT
- platform TEXT
- enabled INTEGER NOT NULL DEFAULT 1

device_id identifies one browser/PWA installation, not one human user.

Device identity is not an authorization credential.

## 4. sync cursor

Incremental synchronization needs a stable server-side change cursor.

Initial portable design option:

catalog_change_seq INTEGER

Each accepted catalog mutation advances a monotonically increasing sequence.
Changed records can then be requested after a client's last known cursor.

Do not rely only on wall-clock timestamps for synchronization ordering.

Possible implementation options must be reviewed before migration:
- per-record change_seq plus global sequence allocator;
- append-only change log;
- another portable monotonic sequence mechanism.

The selected mechanism must work on SQLite-compatible storage and remain portable
away from Cloudflare D1.

## 5. sync endpoint contract

Candidate endpoints:

GET /api/sync/catalog?after=<cursor>
POST /api/sync/operations

GET response should contain:
- records changed after cursor;
- deleted/tombstone information;
- next_cursor;
- has_more.

POST operations response should return one result per operation:
- operation_id;
- status;
- canonical entity state when applicable;
- new revision when applied;
- conflict details when rejected due to revision/business rule.

## 6. deletes

Offline synchronization requires tombstones.

A deleted record must remain discoverable by incremental sync long enough for
offline devices to learn that it was deleted.

Permanent deletion must therefore not erase all synchronization evidence
immediately.

Existing purge_log may contribute to this design but must be reviewed before reuse.

## 7. loans

Loan/return operations require the same idempotency rules as catalog edits.

Critical invariant:

At most one active loan may exist for a catalog exemplar at a time.

This invariant must be enforced server-side, not only by the UI.

Offline issue/return operations may be queued, but conflicting operations are
resolved by the server and surfaced explicitly to the client.

## 8. migration strategy

Migration must be additive-first.

Planned sequence:

1. add revision with safe default;
2. add sync_operations;
3. add client_devices if required server-side;
4. add chosen change-cursor mechanism;
5. deploy read-compatible code;
6. validate staging;
7. enable idempotent mutation path;
8. enable revision checks;
9. enable client outbox synchronization;
10. only later remove obsolete paths.

No production migration is authorized by this design document alone.
