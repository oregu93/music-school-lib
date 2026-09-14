# Architecture Rules

## EVOLVABILITY-01
Production changes must remain backward-compatible where practical.
Prefer additive migrations, explicit migration steps, validation, and delayed cleanup.
Do not use production as a development environment.
Development path: local -> staging -> production.

## VENDOR-FREE-01
Business logic, data model, authentication model, search model, and synchronization
must not depend unnecessarily on Cloudflare-specific client APIs.
Cloudflare is the current hosting provider, not an architectural requirement.
The application should remain portable to a conventional Linux server, another cloud,
or a local installation.

## OFFLINE-FIRST-01
Core librarian workflows must continue during temporary loss of internet connectivity.

Required offline-capable workflows:
- catalog lookup;
- inventory-number lookup;
- opening locally available records;
- inventory checks;
- edits queued for synchronization;
- loan and return operations queued for synchronization.

Local browser storage will use IndexedDB for:
- compact catalog replica;
- locally cached full records;
- pending operation outbox;
- synchronization metadata;
- device identity.

After connectivity returns, synchronization resumes automatically.

## DEGRADED-MODE-01
The application must continue useful work when the backend is reachable for reads
but temporarily unable to accept writes, including quota or service incidents.

Writes must be queued locally instead of being silently lost.
The UI must distinguish:
- synchronized;
- pending synchronization;
- conflict;
- synchronization error.

## CROSS-PLATFORM-01
Supported target clients:
- Windows desktop browsers / PWA;
- Linux desktop browsers / PWA;
- Android browser / PWA;
- iOS Safari / PWA where platform capabilities permit.

Runtime business logic must not depend on OS-specific filesystem paths or shell tools.

USB/Bluetooth barcode scanners should work as keyboard input.
Mobile camera scanning should use web capabilities with manual-entry fallback.

## SYNC-01
Each mutation intended for synchronization must have:
- operation_id: globally unique UUID;
- device_id;
- actor_id;
- entity type and entity id;
- operation type;
- base_revision when applicable;
- client timestamp;
- payload;
- local sync state.

Server mutation endpoints must become idempotent:
replaying the same operation_id must not duplicate the operation.

## CONCURRENCY-01
Mutable records should have a server-side revision/version.
Offline and concurrent edits must not silently overwrite newer data.

Critical workflows such as issuing the same exemplar to two readers must reject
incompatible concurrent operations rather than using last-write-wins.

## DATA-IDENTITY-01
Internal numeric catalog id remains the stable technical relationship key.

inventory_number is the primary user-facing exemplar identifier but is not assumed
to be unique because legacy data contains duplicates.

db_number remains a secondary legacy/source identifier.

Exact inventory-number lookup must support:
- zero matches;
- one match;
- multiple matches with explicit disambiguation.

## LOCAL-DATA-01
The local datastore should contain a compact representation of the complete catalog,
not merely recently opened records.

Large or infrequently required data such as raw MARC may be cached separately.

Local data is a working replica, not an independent source of truth.
The server remains canonical once synchronization succeeds.

## SECURITY-01
Authorization and permissions remain server-authoritative.

Offline access is allowed only for a previously authenticated user/device under
a bounded local trust policy.

Client UI restrictions are not a security boundary.

## DEPLOYMENT-01
Environment separation is mandatory:
- local;
- staging;
- production.

Production deployment, migration, import, and destructive operations require
explicit environment selection.

All schema migrations are versioned in Git.
