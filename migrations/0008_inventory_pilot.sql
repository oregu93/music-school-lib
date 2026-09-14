CREATE TABLE inventory_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX idx_inventory_sessions_status
ON inventory_sessions(status, created_at);

CREATE TABLE inventory_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  session_id TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  inventory_number TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  seen_by TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
  FOREIGN KEY (record_id) REFERENCES catalog_records(id),
  UNIQUE(session_id, record_id)
);

CREATE INDEX idx_inventory_events_session
ON inventory_events(session_id, seen_at);

CREATE INDEX idx_inventory_events_inventory_number
ON inventory_events(inventory_number);
