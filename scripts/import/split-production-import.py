from pathlib import Path
import hashlib

src = Path(r"import_bundle_final\full-import.sql")
catalog_out = Path(r"import_bundle_final\production-catalog.sql")
loans_out = Path(r"import_bundle_final\production-loans.sql")

EXPECTED_SHA256 = (
    "6583b44c95e60fed9560ff22104fcb21"
    "db8f82c1e93cc71489340f8c1b4b86bb"
)

raw = src.read_bytes()
actual_sha = hashlib.sha256(raw).hexdigest()

if actual_sha != EXPECTED_SHA256:
    raise SystemExit(
        f"FAIL source SHA256\n"
        f"expected: {EXPECTED_SHA256}\n"
        f"actual:   {actual_sha}"
    )

text = raw.decode("utf-8")


def split_sql(sql: str):
    statements = []
    buf = []

    quote = None
    line_comment = False
    block_comment = False
    i = 0

    while i < len(sql):
        c = sql[i]
        nxt = sql[i + 1] if i + 1 < len(sql) else ""

        if line_comment:
            buf.append(c)
            if c == "\n":
                line_comment = False
            i += 1
            continue

        if block_comment:
            buf.append(c)
            if c == "*" and nxt == "/":
                buf.append(nxt)
                block_comment = False
                i += 2
            else:
                i += 1
            continue

        if quote:
            buf.append(c)

            if c == quote:
                # SQL doubled quote: '' or ""
                if nxt == quote:
                    buf.append(nxt)
                    i += 2
                    continue
                quote = None

            i += 1
            continue

        if c == "-" and nxt == "-":
            buf.extend([c, nxt])
            line_comment = True
            i += 2
            continue

        if c == "/" and nxt == "*":
            buf.extend([c, nxt])
            block_comment = True
            i += 2
            continue

        if c in ("'", '"'):
            quote = c
            buf.append(c)
            i += 1
            continue

        buf.append(c)

        if c == ";":
            statement = "".join(buf).strip()
            if statement:
                statements.append(statement)
            buf = []

        i += 1

    trailing = "".join(buf).strip()

    if trailing:
        raise SystemExit(
            "FAIL: unterminated/trailing SQL content found"
        )

    return statements


statements = split_sql(text)

catalog = []
loans = []
other = []

for statement in statements:
    normalized = " ".join(statement.split()).lower()

    if normalized.startswith("insert into catalog_records"):
        catalog.append(statement)
    elif normalized.startswith("insert into loans"):
        loans.append(statement)
    else:
        other.append(statement)

print("source_sha256:", actual_sha)
print("total statements:", len(statements))
print("catalog statements:", len(catalog))
print("loan statements:", len(loans))
print("other statements:", len(other))

if len(catalog) != 10923:
    raise SystemExit(
        f"FAIL: expected 10923 catalog statements, got {len(catalog)}"
    )

if len(loans) != 880:
    raise SystemExit(
        f"FAIL: expected 880 loan statements, got {len(loans)}"
    )

if other:
    print("\nUnexpected statements:")
    for statement in other[:10]:
        print(statement[:300])
    raise SystemExit(
        f"FAIL: found {len(other)} unexpected SQL statements"
    )

catalog_out.write_text(
    "\n".join(catalog) + "\n",
    encoding="utf-8",
)

loans_out.write_text(
    "\n".join(loans) + "\n",
    encoding="utf-8",
)

print(
    "catalog_sha256:",
    hashlib.sha256(catalog_out.read_bytes()).hexdigest(),
)

print(
    "loans_sha256:",
    hashlib.sha256(loans_out.read_bytes()).hexdigest(),
)

print("VALIDATION: PASS")