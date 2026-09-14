#!/usr/bin/env bash
set -euo pipefail

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

mkdir -p "$test_root/config"
CI=1 XDG_CONFIG_HOME="$test_root/config" pnpm exec wrangler d1 migrations apply \
  music-school-library-staging \
  --local \
  --persist-to "$test_root/d1" \
  --config wrangler.staging.jsonc >/dev/null
test_db="$(find "$test_root/d1" -type f -name '*.sqlite' ! -name 'metadata.sqlite' -print -quit)"
[[ -n "$test_db" ]] || { echo "launch database test failed: local D1 file not found" >&2; exit 1; }

fail() {
  echo "launch database test failed: $1" >&2
  exit 1
}

equals() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  [[ "$actual" == "$expected" ]] || fail "$label (expected $expected, got $actual)"
}

equals "$(sqlite3 "$test_db" "SELECT dflt_value FROM pragma_table_info('catalog_records') WHERE name='revision';")" "1" "revision default"
for table in sync_operations client_devices inventory_sessions inventory_events; do
  equals "$(sqlite3 "$test_db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='$table';")" "1" "$table exists"
done
[[ "$(sqlite3 "$test_db" "SELECT sql FROM sqlite_master WHERE name='idx_loans_one_active_per_record';")" == *"WHERE return_date = ''"* ]] || fail "active-loan partial index"

sqlite3 -bail "$test_db" <<'SQL'
INSERT INTO catalog_records (
  db_number, inventory_number, author, title, search_text, created_at, updated_at
) VALUES (
  'DB-1', 'INV-DUP', 'Автор', 'Тестовая запись',
  '{"all":"автор тестовая запись","dbNumber":"db-1","inventoryNumber":"inv-dup"}',
  '2026-01-01', '2026-01-01'
);
SQL

record_id="$(sqlite3 "$test_db" "SELECT id FROM catalog_records WHERE db_number='DB-1';")"
equals "$(sqlite3 "$test_db" "SELECT revision FROM catalog_records WHERE id=$record_id;")" "1" "create revision"
equals "$(sqlite3 "$test_db" "UPDATE catalog_records SET title='Изменено', revision=revision+1 WHERE id=$record_id AND deleted_at IS NULL AND revision=1; SELECT changes();")" "1" "current revision update"
equals "$(sqlite3 "$test_db" "UPDATE catalog_records SET title='Устаревшее', revision=revision+1 WHERE id=$record_id AND revision=1; SELECT changes();")" "0" "stale revision rejected"
equals "$(sqlite3 "$test_db" "UPDATE catalog_records SET title='Актуальное', revision=revision+1 WHERE id=$record_id AND revision=2; SELECT changes();")" "1" "second current revision update"
sqlite3 "$test_db" "UPDATE catalog_records SET verified=1, revision=revision+1 WHERE id=$record_id AND revision=3;"
sqlite3 "$test_db" "UPDATE catalog_records SET deleted_at='now', revision=revision+1 WHERE id=$record_id AND revision=4;"
sqlite3 "$test_db" "UPDATE catalog_records SET deleted_at=NULL, revision=revision+1 WHERE id=$record_id AND revision=5;"
equals "$(sqlite3 "$test_db" "SELECT revision FROM catalog_records WHERE id=$record_id;")" "6" "verify delete restore revisions"

sqlite3 "$test_db" "INSERT INTO loans (record_id, db_number, loan_date, return_date) VALUES ($record_id, 'DB-1', '1', '');"
if sqlite3 "$test_db" "INSERT INTO loans (record_id, db_number, loan_date, return_date) VALUES ($record_id, 'DB-1', '2', '');" 2>/dev/null; then
  fail "second active loan accepted"
fi
sqlite3 "$test_db" "UPDATE loans SET return_date='returned' WHERE record_id=$record_id AND return_date='';"
sqlite3 "$test_db" "INSERT INTO loans (record_id, db_number, loan_date, return_date) VALUES ($record_id, 'DB-1', '3', '');"
equals "$(sqlite3 "$test_db" "SELECT COUNT(*) FROM loans WHERE record_id=$record_id;")" "2" "reissue after return"

operation_id="10000000-0000-4000-8000-000000000001"
sync_insert="INSERT INTO sync_operations (operation_id, device_id, actor_user_id, entity_type, operation_type, request_payload, result_payload, result_status, received_at_server) VALUES ('$operation_id', 'device', 'user', 'catalog_record', 'update', '{}', '{}', 'succeeded', 'now');"
sqlite3 "$test_db" "$sync_insert"
if sqlite3 "$test_db" "$sync_insert" 2>/dev/null; then
  fail "duplicate operation id accepted"
fi

sqlite3 "$test_db" "INSERT INTO catalog_records (db_number, inventory_number, title, search_text, created_at, updated_at) VALUES ('DB-2', 'INV-DUP', 'Вторая запись', '{\"all\":\"вторая запись\",\"dbNumber\":\"db-2\",\"inventoryNumber\":\"inv-dup\"}', 'now', 'now');"
equals "$(sqlite3 "$test_db" "SELECT COUNT(*) FROM catalog_records WHERE inventory_number='INV-DUP';")" "2" "duplicate inventory lookup"
equals "$(sqlite3 "$test_db" "SELECT COUNT(*) FROM catalog_records WHERE db_number='DB-1';")" "1" "exact db lookup"
equals "$(sqlite3 "$test_db" "SELECT COUNT(*) FROM catalog_records WHERE json_extract(search_text, '$.all') LIKE '%запись%';")" "2" "general search"
[[ "$(sqlite3 "$test_db" "EXPLAIN QUERY PLAN SELECT id FROM catalog_records WHERE inventory_number='INV-DUP';")" == *"idx_catalog_inventory_number"* ]] || fail "inventory lookup index"
[[ "$(sqlite3 "$test_db" "EXPLAIN QUERY PLAN SELECT id FROM catalog_records WHERE db_number='DB-1';")" == *"idx_catalog_db_number"* ]] || fail "db lookup index"

sqlite3 "$test_db" "INSERT INTO inventory_sessions (id, name, created_by, created_at) VALUES ('session', 'Pilot', 'user', 'now');"
sqlite3 "$test_db" "INSERT OR IGNORE INTO inventory_events (session_id, record_id, inventory_number, operation_id, seen_by, seen_at) VALUES ('session', $record_id, 'INV-DUP', 'event-1', 'user', 'now');"
sqlite3 "$test_db" "INSERT OR IGNORE INTO inventory_events (session_id, record_id, inventory_number, operation_id, seen_by, seen_at) VALUES ('session', $record_id, 'INV-DUP', 'event-2', 'user', 'later');"
equals "$(sqlite3 "$test_db" "SELECT COUNT(*) FROM inventory_events WHERE session_id='session';")" "1" "repeated inventory event"
sqlite3 "$test_db" "INSERT INTO audit_log (record_id, action, actor_id, actor_email, created_at) VALUES ($record_id, 'test', 'user', 'user@example.test', 'now');"
equals "$(sqlite3 "$test_db" "SELECT COUNT(*) FROM audit_log WHERE record_id=$record_id;")" "1" "audit creation"

echo "database and migration tests: PASS"
