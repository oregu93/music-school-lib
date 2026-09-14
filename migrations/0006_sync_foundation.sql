ALTER TABLE catalog_records
ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

CREATE TABLE sync_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  operation_type TEXT NOT NULL,
  base_revision INTEGER,
  request_payload TEXT NOT NULL DEFAULT '{}',
  result_payload TEXT NOT NULL DEFAULT '{}',
  result_status TEXT NOT NULL,
  created_at_client TEXT,
  received_at_server TEXT NOT NULL,
  completed_at_server TEXT
);

CREATE INDEX idx_sync_operations_device_id
ON sync_operations(device_id);

CREATE INDEX idx_sync_operations_entity
ON sync_operations(entity_type, entity_id);

CREATE INDEX idx_sync_operations_status
ON sync_operations(result_status);

CREATE TABLE client_devices (
  device_id TEXT PRIMARY KEY NOT NULL,
  created_by_user_id TEXT,
  label TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_client_devices_user
ON client_devices(created_by_user_id);

CREATE INDEX idx_client_devices_enabled
ON client_devices(enabled);
