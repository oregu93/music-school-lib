from pathlib import Path
import sqlite3
import hashlib
import sys


MIGRATIONS = [
    Path("migrations/0001_initial.sql"),
    Path("migrations/0002_loans.sql"),
    Path("migrations/0003_auth.sql"),
]

IMPORT_SQL = Path("import_bundle/catalog-import.sql")

EXPECTED_ROWS = 10923
EXPECTED_SYNTHETIC = "LEGACY-MISSING-DB-10924"


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


for path in MIGRATIONS + [IMPORT_SQL]:
    if not path.exists():
        raise SystemExit(f"ERROR: missing {path}")


print("IMPORT-02 SQL VALIDATION")
print("=" * 72)

db = sqlite3.connect(":memory:")

try:
    db.execute("PRAGMA foreign_keys = ON")

    for migration in MIGRATIONS:
        print(f"applying schema: {migration}")
        sql = migration.read_text(encoding="utf-8")
        db.executescript(sql)

    print("schema migrations: PASS")

    print()
    print("applying generated catalog SQL in temporary memory DB...")

    import_sql = IMPORT_SQL.read_text(encoding="utf-8")
    db.executescript(import_sql)

    print("catalog SQL execution: PASS")

    count = db.execute(
        "SELECT COUNT(*) FROM catalog_records"
    ).fetchone()[0]

    distinct_db = db.execute(
        """
        SELECT COUNT(DISTINCT db_number)
        FROM catalog_records
        """
    ).fetchone()[0]

    duplicate_db = db.execute(
        """
        SELECT COUNT(*)
        FROM (
            SELECT db_number
            FROM catalog_records
            GROUP BY db_number
            HAVING COUNT(*) > 1
        )
        """
    ).fetchone()[0]

    synthetic = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE db_number = ?
        """,
        (EXPECTED_SYNTHETIC,),
    ).fetchone()[0]

    written_off = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE record_state = 'Списан'
        """
    ).fetchone()[0]

    available = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE loan_status = 'В наличии'
        """
    ).fetchone()[0]

    written_off_status = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE loan_status = 'Списан'
        """
    ).fetchone()[0]

    returned_status = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE loan_status = 'Возвращена'
        """
    ).fetchone()[0]

    verified = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE verified <> 0
        """
    ).fetchone()[0]

    deleted = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE deleted_at IS NOT NULL
        """
    ).fetchone()[0]

    invalid_json = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE marc_fields_json <> ''
          AND json_valid(marc_fields_json) = 0
        """
    ).fetchone()[0]

    print()
    print("RESULTS")
    print(f"catalog_records: {count}")
    print(f"distinct_db_number: {distinct_db}")
    print(f"duplicate_db_number_groups: {duplicate_db}")
    print(f"synthetic_record: {synthetic}")
    print(f"record_state_Списан: {written_off}")
    print(f"loan_status_В_наличии: {available}")
    print(f"loan_status_Списан: {written_off_status}")
    print(f"loan_status_Возвращена: {returned_status}")
    print(f"verified_nonzero: {verified}")
    print(f"deleted_records: {deleted}")
    print(f"invalid_marc_json: {invalid_json}")
    print(f"sql_sha256: {sha256(IMPORT_SQL)}")

    errors = []

    if count != EXPECTED_ROWS:
        errors.append(
            f"expected {EXPECTED_ROWS} rows, got {count}"
        )

    if distinct_db != EXPECTED_ROWS:
        errors.append(
            "db_number uniqueness failed"
        )

    if duplicate_db != 0:
        errors.append(
            "duplicate db_number groups exist"
        )

    if synthetic != 1:
        errors.append(
            "synthetic record count is not 1"
        )

    if written_off != 1358:
        errors.append(
            f"expected 1358 written-off records, got {written_off}"
        )

    if available != 9565:
        errors.append(
            f"expected 9565 available records, got {available}"
        )

    if written_off_status != 1358:
        errors.append(
            "written-off loan status count mismatch"
        )

    if returned_status != 0:
        errors.append(
            "legacy Возвращена statuses remain"
        )

    if verified != 0:
        errors.append(
            "imported records unexpectedly verified"
        )

    if deleted != 0:
        errors.append(
            "imported records unexpectedly soft-deleted"
        )

    if invalid_json != 0:
        errors.append(
            "invalid MARC JSON detected"
        )

    print()

    if errors:
        print("VALIDATION: FAIL")
        for error in errors:
            print(" -", error)
        sys.exit(1)

    print("VALIDATION: PASS")
    print("NO PERSISTENT DATABASE WAS MODIFIED.")

finally:
    db.close()