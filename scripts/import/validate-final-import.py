from pathlib import Path
import sqlite3
import sys
import hashlib


MIGRATIONS = [
    Path("migrations/0001_initial.sql"),
    Path("migrations/0002_loans.sql"),
    Path("migrations/0003_auth.sql"),
]

IMPORT_SQL = Path(
    "import_bundle_final/full-import.sql"
)


def sha256(path):
    h = hashlib.sha256()

    with path.open("rb") as f:
        for chunk in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            h.update(chunk)

    return h.hexdigest()


db = sqlite3.connect(":memory:")

try:
    db.execute(
        "PRAGMA foreign_keys = ON"
    )

    for migration in MIGRATIONS:
        db.executescript(
            migration.read_text(
                encoding="utf-8"
            )
        )

    db.executescript(
        IMPORT_SQL.read_text(
            encoding="utf-8"
        )
    )

    catalog_count = db.execute(
        "SELECT COUNT(*) FROM catalog_records"
    ).fetchone()[0]

    loans_count = db.execute(
        "SELECT COUNT(*) FROM loans"
    ).fetchone()[0]

    orphan_loans = db.execute(
        """
        SELECT COUNT(*)
        FROM loans l
        LEFT JOIN catalog_records c
          ON c.id = l.record_id
        WHERE c.id IS NULL
        """
    ).fetchone()[0]

    open_loans = db.execute(
        """
        SELECT COUNT(*)
        FROM loans
        WHERE return_date = ''
        """
    ).fetchone()[0]

    missing_reader = db.execute(
        """
        SELECT COUNT(*)
        FROM loans
        WHERE reader_id = ''
        """
    ).fetchone()[0]

    missing_record_id = db.execute(
        """
        SELECT COUNT(*)
        FROM loans
        WHERE record_id IS NULL
        """
    ).fetchone()[0]

    available = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE loan_status = 'В наличии'
        """
    ).fetchone()[0]

    written_off = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE loan_status = 'Списан'
        """
    ).fetchone()[0]

    legacy_returned = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE loan_status = 'Возвращена'
        """
    ).fetchone()[0]

    print(
        "IMPORT-02 FINAL SQL VALIDATION"
    )
    print("=" * 72)

    print(
        "catalog_records:",
        catalog_count,
    )

    print(
        "loans:",
        loans_count,
    )

    print(
        "orphan_loans:",
        orphan_loans,
    )

    print(
        "open_loans:",
        open_loans,
    )

    print(
        "missing_reader:",
        missing_reader,
    )

    print(
        "missing_record_id:",
        missing_record_id,
    )

    print(
        "loan_status_В_наличии:",
        available,
    )

    print(
        "loan_status_Списан:",
        written_off,
    )

    print(
        "loan_status_Возвращена:",
        legacy_returned,
    )

    print(
        "sql_sha256:",
        sha256(IMPORT_SQL),
    )

    errors = []

    if catalog_count != 10923:
        errors.append(
            "catalog count mismatch"
        )

    if loans_count != 880:
        errors.append(
            "loan count mismatch"
        )

    if orphan_loans != 0:
        errors.append(
            "orphan loans found"
        )

    if open_loans != 0:
        errors.append(
            "open loans found"
        )

    if missing_reader != 0:
        errors.append(
            "missing reader IDs"
        )

    if missing_record_id != 0:
        errors.append(
            "missing record_id"
        )

    if available != 9565:
        errors.append(
            "available status mismatch"
        )

    if written_off != 1358:
        errors.append(
            "written-off status mismatch"
        )

    if legacy_returned != 0:
        errors.append(
            "legacy Возвращена remains"
        )

    print()

    if errors:
        print("VALIDATION: FAIL")

        for error in errors:
            print(" -", error)

        sys.exit(1)

    print("VALIDATION: PASS")
    print(
        "NO PERSISTENT DATABASE WAS MODIFIED."
    )

finally:
    db.close()