CREATE TABLE purge_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  record_id INTEGER,
  db_number TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  purged_by TEXT NOT NULL,
  purged_by_email TEXT NOT NULL,
  purged_at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'permanent_delete_from_trash'
);

CREATE INDEX idx_purge_log_record_id
ON purge_log (record_id);

CREATE INDEX idx_purge_log_purged_at
ON purge_log (purged_at);
