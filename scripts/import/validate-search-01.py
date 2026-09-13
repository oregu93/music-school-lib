from pathlib import Path
import sqlite3


MIGRATIONS = [
    Path("migrations/0001_initial.sql"),
    Path("migrations/0002_loans.sql"),
    Path("migrations/0003_auth.sql"),
    Path("migrations/0004_search_normalization.sql"),
]

IMPORT_SQL = Path(
    "import_bundle_final/full-import.sql"
)

BACKFILL_SQL = Path(
    "search_01/backfill-search-text.sql"
)


db = sqlite3.connect(":memory:")

try:
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

    db.executescript(
        BACKFILL_SQL.read_text(
            encoding="utf-8"
        )
    )

    total = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        """
    ).fetchone()[0]

    populated = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE search_text <> '{}'
        """
    ).fetchone()[0]

    invalid = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE json_valid(search_text) = 0
        """
    ).fetchone()[0]

    milich_lower = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE json_extract(
            search_text,
            '$.all'
        ) LIKE '%милич%'
        """
    ).fetchone()[0]

    milich_upper_normalized = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE json_extract(
            search_text,
            '$.all'
        ) LIKE '%милич%'
        """
    ).fetchone()[0]

    gold = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE json_extract(
            search_text,
            '$.all'
        ) LIKE '%золотая%'
        """
    ).fetchone()[0]

    synthetic = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE
          db_number =
            'LEGACY-MISSING-DB-10924'
          AND json_extract(
            search_text,
            '$.all'
          ) LIKE '%золотая лира%'
        """
    ).fetchone()[0]

    empty_search = db.execute(
        """
        SELECT COUNT(*)
        FROM catalog_records
        WHERE
          json_extract(
            search_text,
            '$.all'
          ) IS NULL
        """
    ).fetchone()[0]

    print("SEARCH-01 VALIDATION")
    print("=" * 72)
    print("catalog_records:", total)
    print("search_text_populated:", populated)
    print("invalid_search_json:", invalid)
    print("milich_matches:", milich_lower)
    print(
        "milich_normalized_reference:",
        milich_upper_normalized,
    )
    print("zolotaya_matches:", gold)
    print(
        "synthetic_zolotaya_matches:",
        synthetic,
    )
    print(
        "missing_all_search_value:",
        empty_search,
    )

    errors = []

    if total != 10923:
        errors.append(
            "catalog count mismatch"
        )

    if populated != 10923:
        errors.append(
            "not all search rows populated"
        )

    if invalid != 0:
        errors.append(
            "invalid search JSON"
        )

    if milich_lower == 0:
        errors.append(
            "Милич not found"
        )

    if synthetic != 1:
        errors.append(
            "synthetic Золотая лира "
            "not searchable"
        )

    if empty_search != 0:
        errors.append(
            "missing $.all search values"
        )

    print()

    if errors:
        print("VALIDATION: FAIL")
        for error in errors:
            print(" -", error)
        raise SystemExit(1)

    print("VALIDATION: PASS")
    print(
        "NO PERSISTENT DATABASE WAS MODIFIED."
    )

finally:
    db.close()