interface Env {
  DB: D1Database;
  YANDEX_CLIENT_ID: string;
}

type User = {
  userId: string;
  email: string;
  displayName: string;
  role: "admin" | "librarian";
};

const SELECT_FIELDS = `
  id,
  db_number AS dbNumber,
  bibliographic_id AS bibliographicId,
  inventory_number AS inventoryNumber,
  record_state AS state,
  record_type AS recordType,
  bibliographic_level AS bibliographicLevel,
  author,
  title,
  title_full AS titleFull,
  edition,
  publication_place AS publicationPlace,
  publisher,
  publication_year AS year,
  physical_description AS physicalDescription,
  series,
  subjects,
  keywords,
  classification,
  shelfmark,
  notes,
  location,
  accounting_status AS accountingStatus,
  fund_type AS fundType,
  invoice,
  inventory_mode AS inventoryMode,
  registration_date AS registrationDate,
  writeoff_date AS writeoffDate,
  writeoff_act AS writeoffAct,
  writeoff_reason AS writeoffReason,
  loan_status AS loanStatus,
  reader_id AS readerId,
  last_loan_date AS lastLoanDate,
  last_return_date AS lastReturnDate,
  loan_count AS loanCount,
  marc_fields_json AS marcFieldsJson,
  raw_marc AS rawMarc,
  verified,
  verified_by AS verifiedBy,
  verified_at AS verifiedAt,
  deleted_at AS deletedAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const LIST_FIELDS = `
  id,
  db_number AS dbNumber,
  inventory_number AS inventoryNumber,
  bibliographic_id AS bibliographicId,
  author,
  title,
  title_full AS titleFull,
  edition,
  publication_place AS publicationPlace,
  publisher,
  publication_year AS year,
  physical_description AS physicalDescription,
  subjects,
  keywords,
  classification,
  shelfmark,
  notes,
  location,
  accounting_status AS accountingStatus,
  fund_type AS fundType,
  invoice,
  record_state AS state,
  loan_status AS loanStatus,
  verified,
  verified_at AS verifiedAt,
  deleted_at AS deletedAt
`;

const SEARCH_FIELDS: Record<string, string> = {
  all: "$.all",
  dbNumber: "$.dbNumber",
  inventoryNumber: "$.inventoryNumber",
  author: "$.author",
  title: "$.title",
  publisher: "$.publisher",
  year: "$.year",
};

const EDITABLE_FIELDS: Record<string, string> = {
  dbNumber: "db_number",
  bibliographicId: "bibliographic_id",
  inventoryNumber: "inventory_number",
  state: "record_state",
  recordType: "record_type",
  bibliographicLevel: "bibliographic_level",
  author: "author",
  title: "title",
  titleFull: "title_full",
  edition: "edition",
  publicationPlace: "publication_place",
  publisher: "publisher",
  year: "publication_year",
  physicalDescription: "physical_description",
  series: "series",
  subjects: "subjects",
  keywords: "keywords",
  classification: "classification",
  shelfmark: "shelfmark",
  notes: "notes",
  location: "location",
  accountingStatus: "accounting_status",
  fundType: "fund_type",
  invoice: "invoice",
  inventoryMode: "inventory_mode",
  registrationDate: "registration_date",
  writeoffDate: "writeoff_date",
  writeoffAct: "writeoff_act",
  writeoffReason: "writeoff_reason",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function developmentUser(): User {
  return {
    userId: "development-user",
    email: "development@local",
    displayName: "Локальный пользователь",
    role: "admin",
  };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSearch(value: unknown): string {
  return clean(value)
    .normalize("NFKC")
    .toLowerCase();
}

function buildSearchText(
  values: Record<string, unknown>,
): string {
  const fields = {
    dbNumber: normalizeSearch(values.dbNumber),
    inventoryNumber:
      normalizeSearch(values.inventoryNumber),
    author: normalizeSearch(values.author),
    title: normalizeSearch(values.title),
    titleFull: normalizeSearch(values.titleFull),
    publisher: normalizeSearch(values.publisher),
    year: normalizeSearch(values.year),
    subjects: normalizeSearch(values.subjects),
    keywords: normalizeSearch(values.keywords),
    shelfmark: normalizeSearch(values.shelfmark),
    notes: normalizeSearch(values.notes),
  };

  return JSON.stringify({
    ...fields,
    all: Object.values(fields)
      .filter(Boolean)
      .join("\n"),
  });
}

function numeric(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(0, Math.trunc(number))
    : 0;
}

function parseRecordId(pathname: string): number | null {
  const match = pathname.match(/^\/api\/catalog\/(\d+)(?:\/|$)/);

  if (!match) return null;

  const id = Number(match[1]);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function auditStatement(
  env: Env,
  recordId: number,
  action: string,
  changes: unknown,
  user: User,
  now: string,
  guardSql = "1",
  guardBindings: unknown[] = [],
) {
  return env.DB
    .prepare(`
      INSERT INTO audit_log (
        record_id,
        action,
        changes_json,
        actor_id,
        actor_email,
        created_at
      )
      SELECT ?, ?, ?, ?, ?, ?
      WHERE ${guardSql}
    `)
    .bind(
      recordId,
      action,
      JSON.stringify(changes),
      user.userId,
      user.email,
      now,
      ...guardBindings,
    );
}

async function getCatalog(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const params = url.searchParams;

  const query =
    params.get("q")?.trim().slice(0, 200) ?? "";

  const field = params.get("field") ?? "all";
  const includeWrittenOff =
    params.get("writtenOff") === "1";
  const trash =
    params.get("trash") === "1";

  const requestedLimit =
    Number(params.get("limit") ?? 200);

  const requestedOffset =
    Number(params.get("offset") ?? 0);

  const limit = Math.min(
    Math.max(
      Number.isFinite(requestedLimit)
        ? requestedLimit
        : 200,
      1,
    ),
    200,
  );

  const offset = Math.max(
    Number.isFinite(requestedOffset)
      ? requestedOffset
      : 0,
    0,
  );

  const clauses = [
    trash
      ? "deleted_at IS NOT NULL"
      : "deleted_at IS NULL",
  ];

  const bindings: unknown[] = [];

  if (!includeWrittenOff) {
    clauses.push("record_state <> 'Списан'");
  }

  if (query) {
    if (field === "inventoryNumber") {
      clauses.push("inventory_number = ?");
      bindings.push(query);
    } else if (field === "dbNumber") {
      clauses.push("db_number = ?");
      bindings.push(query);
    } else {
      const searchPath =
        SEARCH_FIELDS[field] ?? SEARCH_FIELDS.all;

      clauses.push(
        `json_extract(search_text, '${searchPath}') LIKE ?`,
      );

      bindings.push(
        `%${normalizeSearch(query)}%`,
      );
    }
  }

  const where = clauses.join(" AND ");

  const list = await env.DB
    .prepare(`
      SELECT ${LIST_FIELDS}
      FROM catalog_records
      WHERE ${where}
      ORDER BY
        author COLLATE NOCASE,
        title COLLATE NOCASE,
        id
      LIMIT ?
      OFFSET ?
    `)
    .bind(...bindings, limit, offset)
    .all();

  let stats: unknown = null;

  if (!query) {
    stats = await env.DB
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(
            CASE
              WHEN record_state = 'В фонде'
              THEN 1
              ELSE 0
            END
          ) AS active,
          SUM(
            CASE
              WHEN verified = 1
              THEN 1
              ELSE 0
            END
          ) AS verified
        FROM catalog_records
        WHERE deleted_at IS NULL
      `)
      .first();
  }

  return json({
    items: list.results,
    stats,
    limit,
    offset,
  });
}

async function getRecord(
  env: Env,
  recordId: number,
): Promise<Response> {
  const record = await env.DB
    .prepare(`
      SELECT ${SELECT_FIELDS}
      FROM catalog_records
      WHERE id = ?
      LIMIT 1
    `)
    .bind(recordId)
    .first();

  if (!record) {
    return json(
      {
        error: "Record not found",
        message: "Карточка не найдена.",
      },
      404,
    );
  }

  return json({
    record,
  });
}

async function createRecord(
  request: Request,
  env: Env,
  user: User,
): Promise<Response> {
  const body =
    await request.json() as Record<string, unknown>;

  const now = new Date().toISOString();

  const createStatement = env.DB
    .prepare(`
      INSERT INTO catalog_records (
        db_number,
        bibliographic_id,
        inventory_number,
        record_state,
        author,
        title,
        title_full,
        edition,
        publication_place,
        publisher,
        publication_year,
        physical_description,
        subjects,
        keywords,
        classification,
        shelfmark,
        notes,
        location,
        accounting_status,
        fund_type,
        invoice,
        loan_status,
        loan_count,
        search_text,
        created_at,
        updated_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `)
    .bind(
      clean(body.dbNumber),
      clean(body.bibliographicId),
      clean(body.inventoryNumber),
      clean(body.state) || "В фонде",
      clean(body.author),
      clean(body.title),
      clean(body.titleFull),
      clean(body.edition),
      clean(body.publicationPlace),
      clean(body.publisher),
      clean(body.year),
      clean(body.physicalDescription),
      clean(body.subjects),
      clean(body.keywords),
      clean(body.classification),
      clean(body.shelfmark),
      clean(body.notes),
      clean(body.location),
      clean(body.accountingStatus),
      clean(body.fundType),
      clean(body.invoice),
      clean(body.loanStatus) || "В наличии",
      numeric(body.loanCount),
      buildSearchText(body),
      now,
      now,
    );

  const results = await env.DB.batch([
    createStatement,
    env.DB
      .prepare(`
        INSERT INTO audit_log (
          record_id,
          action,
          changes_json,
          actor_id,
          actor_email,
          created_at
        )
        VALUES (
          last_insert_rowid(),
          'create',
          ?,
          ?,
          ?,
          ?
        )
      `)
      .bind(
        JSON.stringify(body),
        user.userId,
        user.email,
        now,
      ),
  ]);

  const id = Number(
    results[0].meta.last_row_id,
  );

  const record = await env.DB
    .prepare(`
      SELECT ${SELECT_FIELDS}
      FROM catalog_records
      WHERE id = ?
    `)
    .bind(id)
    .first();

  return json({ record }, 201);
}

async function updateRecord(
  request: Request,
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const body =
    await request.json() as Record<string, unknown>;

  const updates = Object.entries(body)
    .filter(([key]) => EDITABLE_FIELDS[key]);

  if (!updates.length) {
    return json(
      { error: "Нет полей для сохранения" },
      400,
    );
  }

  const currentSearch = await env.DB
    .prepare(`
      SELECT
        db_number AS dbNumber,
        inventory_number AS inventoryNumber,
        author,
        title,
        title_full AS titleFull,
        publisher,
        publication_year AS year,
        subjects,
        keywords,
        shelfmark,
        notes
      FROM catalog_records
      WHERE
        id = ?
        AND deleted_at IS NULL
    `)
    .bind(id)
    .first<Record<string, unknown>>();

  if (!currentSearch) {
    return json(
      { error: "Catalog record not found" },
      404,
    );
  }

  const assignments = updates.map(
    ([key]) => `${EDITABLE_FIELDS[key]} = ?`,
  );

  const values = updates.map(
    ([, value]) => clean(value),
  );

  assignments.push("search_text = ?");
  values.push(
    buildSearchText({
      ...currentSearch,
      ...body,
    }),
  );

  const now = new Date().toISOString();

  const mutation = env.DB
    .prepare(`
      UPDATE catalog_records
      SET
        ${assignments.join(", ")},
        updated_at = ?
      WHERE
        id = ?
        AND deleted_at IS NULL
    `)
    .bind(
      ...values,
      now,
      id,
    );

  const results = await env.DB.batch([
    mutation,
    auditStatement(
      env,
      id,
      "update",
      body,
      user,
      now,
      `EXISTS (
        SELECT 1
        FROM catalog_records
        WHERE
          id = ?
          AND deleted_at IS NULL
          AND updated_at = ?
      )`,
      [id, now],
    ),
  ]);

  const result = results[0];

  if (!result.meta.changes) {
    return json(
      { error: "Catalog record not found" },
      404,
    );
  }

  return json({ ok: true });
}

async function deleteRecord(
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const now = new Date().toISOString();

  const mutation = env.DB
    .prepare(`
      UPDATE catalog_records
      SET
        deleted_at = ?,
        deleted_by = ?,
        updated_at = ?
      WHERE
        id = ?
        AND deleted_at IS NULL
    `)
    .bind(
      now,
      user.userId,
      now,
      id,
    );

  const results = await env.DB.batch([
    mutation,
    auditStatement(
      env,
      id,
      "delete",
      {},
      user,
      now,
      `EXISTS (
        SELECT 1
        FROM catalog_records
        WHERE
          id = ?
          AND deleted_at = ?
          AND deleted_by = ?
      )`,
      [id, now, user.userId],
    ),
  ]);

  const result = results[0];

  if (!result.meta.changes) {
    return json(
      { error: "Catalog record not found" },
      404,
    );
  }

  return json({ ok: true });
}

async function purgeRecord(
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  if (user.role !== "admin") {
    return json(
      {
        error: "Forbidden",
        message:
          "Окончательное удаление доступно только администратору.",
      },
      403,
    );
  }

  const record = await env.DB
    .prepare(`
      SELECT
        id,
        db_number AS dbNumber,
        title,
        deleted_at AS deletedAt
      FROM catalog_records
      WHERE id = ?
    `)
    .bind(id)
    .first<{
      id: number;
      dbNumber: string;
      title: string;
      deletedAt: string | null;
    }>();

  if (!record) {
    return json(
      { error: "Catalog record not found" },
      404,
    );
  }

  if (!record.deletedAt) {
    return json(
      {
        error: "Record is not in trash",
        message:
          "Окончательно удалить можно только запись из корзины.",
      },
      409,
    );
  }

  const now = new Date().toISOString();

  const results = await env.DB.batch([
    env.DB
      .prepare(`
        INSERT INTO purge_log (
          record_id,
          db_number,
          title,
          purged_by,
          purged_by_email,
          purged_at,
          reason
        )
        SELECT
          id,
          db_number,
          title,
          ?,
          ?,
          ?,
          'permanent_delete_from_trash'
        FROM catalog_records
        WHERE
          id = ?
          AND deleted_at IS NOT NULL
      `)
      .bind(
        user.userId,
        user.email,
        now,
        id,
      ),

    env.DB
      .prepare(`
        DELETE FROM loans
        WHERE
          record_id = ?
          AND EXISTS (
            SELECT 1
            FROM catalog_records
            WHERE
              id = ?
              AND deleted_at IS NOT NULL
          )
      `)
      .bind(id, id),

    env.DB
      .prepare(`
        DELETE FROM audit_log
        WHERE
          record_id = ?
          AND EXISTS (
            SELECT 1
            FROM catalog_records
            WHERE
              id = ?
              AND deleted_at IS NOT NULL
          )
      `)
      .bind(id, id),

    env.DB
      .prepare(`
        DELETE FROM catalog_records
        WHERE
          id = ?
          AND deleted_at IS NOT NULL
      `)
      .bind(id),
  ]);

  const catalogDelete = results[3];

  if (!catalogDelete.meta.changes) {
    return json(
      {
        error: "Permanent delete conflict",
        message:
          "Запись больше не находится в корзине.",
      },
      409,
    );
  }

  return json({
    ok: true,
    purged: true,
    dbNumber: record.dbNumber,
  });
}

async function restoreRecord(
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const now = new Date().toISOString();

  const mutation = env.DB
    .prepare(`
      UPDATE catalog_records
      SET
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = ?
      WHERE
        id = ?
        AND deleted_at IS NOT NULL
    `)
    .bind(
      now,
      id,
    );

  const results = await env.DB.batch([
    mutation,
    auditStatement(
      env,
      id,
      "restore",
      {},
      user,
      now,
      `EXISTS (
        SELECT 1
        FROM catalog_records
        WHERE
          id = ?
          AND deleted_at IS NULL
          AND updated_at = ?
      )`,
      [id, now],
    ),
  ]);

  const result = results[0];

  if (!result.meta.changes) {
    return json(
      { error: "Deleted catalog record not found" },
      404,
    );
  }

  return json({ ok: true });
}

async function verifyRecord(
  request: Request,
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const body = await request
    .json()
    .catch(() => ({})) as {
      verified?: unknown;
    };

  const verified =
    body.verified !== false;

  const now =
    new Date().toISOString();

  const mutation = env.DB
    .prepare(`
      UPDATE catalog_records
      SET
        verified = ?,
        verified_by = ?,
        verified_at = ?,
        updated_at = ?
      WHERE
        id = ?
        AND deleted_at IS NULL
    `)
    .bind(
      verified ? 1 : 0,
      verified ? user.userId : null,
      verified ? now : null,
      now,
      id,
    );

  const results = await env.DB.batch([
    mutation,
    auditStatement(
      env,
      id,
      verified ? "verify" : "unverify",
      { verified },
      user,
      now,
      `EXISTS (
        SELECT 1
        FROM catalog_records
        WHERE
          id = ?
          AND deleted_at IS NULL
          AND verified = ?
          AND updated_at = ?
      )`,
      [id, verified ? 1 : 0, now],
    ),
  ]);

  const result = results[0];

  if (!result.meta.changes) {
    return json(
      { error: "Catalog record not found" },
      404,
    );
  }

  return json({
    ok: true,
    verified,
    verifiedAt:
      verified ? now : null,
  });
}


async function getLoans(
  env: Env,
  id: number,
): Promise<Response> {
  const rows = await env.DB
    .prepare(`
      SELECT
        id,
        reader_id AS readerId,
        reader_note AS readerNote,
        loan_date AS loanDate,
        return_date AS returnDate,
        return_note AS returnNote,
        issued_by AS issuedBy,
        returned_by AS returnedBy
      FROM loans
      WHERE record_id = ?
      ORDER BY loan_date DESC, id DESC
      LIMIT 30
    `)
    .bind(id)
    .all();

  return json({
    items: rows.results,
  });
}

async function changeLoan(
  request: Request,
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const body = await request
    .json()
    .catch(() => ({})) as Record<string, unknown>;

  const action = clean(body.action).slice(0, 20);

  const record = await env.DB
    .prepare(`
      SELECT
        db_number AS dbNumber,
        record_state AS state
      FROM catalog_records
      WHERE
        id = ?
        AND deleted_at IS NULL
    `)
    .bind(id)
    .first<{ dbNumber: string; state: string }>();

  if (!record) {
    return json(
      { error: "Карточка не найдена" },
      404,
    );
  }

  if (record.state === "Списан") {
    return json(
      { error: "Списанный экземпляр нельзя выдать" },
      409,
    );
  }

  const now = new Date().toISOString();

  if (action === "issue") {
    const readerNote =
      clean(body.readerNote).slice(0, 160);

    const readerId =
      clean(body.readerId).slice(0, 80);

    if (!readerNote) {
      return json(
        { error: "Укажите, кому выдан экземпляр" },
        400,
      );
    }

    const active = await env.DB
      .prepare(`
        SELECT id
        FROM loans
        WHERE
          record_id = ?
          AND return_date = ''
        LIMIT 1
      `)
      .bind(id)
      .first();

    if (active) {
      return json(
        {
          error:
            "Экземпляр уже отмечен как выданный",
        },
        409,
      );
    }

    const results = await env.DB.batch([
      env.DB
        .prepare(`
          INSERT INTO loans (
            record_id,
            db_number,
            reader_id,
            reader_note,
            loan_date,
            return_date,
            return_note,
            quantity,
            issued_by,
            returned_by,
            created_at
          )
          VALUES (
            ?, ?, ?, ?, ?, '', '', 1, ?, '', ?
          )
        `)
        .bind(
          id,
          record.dbNumber,
          readerId,
          readerNote,
          now,
          user.displayName,
          now,
        ),

      env.DB
        .prepare(`
          UPDATE catalog_records
          SET
            loan_status = 'Выдана',
            reader_id = ?,
            last_loan_date = ?,
            loan_count = loan_count + 1,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(
          readerId || readerNote,
          now,
          now,
          id,
        ),

      env.DB
        .prepare(`
          INSERT INTO audit_log (
            record_id,
            action,
            changes_json,
            actor_id,
            actor_email,
            created_at
          )
          VALUES (?, 'loan_issue', ?, ?, ?, ?)
        `)
        .bind(
          id,
          JSON.stringify({
            readerId,
            readerNote,
          }),
          user.userId,
          user.email,
          now,
        ),
    ]);

    return json({
      ok: true,
      loanStatus: "Выдана",
      loan: {
        id: String(results[0].meta.last_row_id),
        readerId,
        readerNote,
        loanDate: now,
        returnDate: "",
        returnNote: "",
        issuedBy: user.displayName,
        returnedBy: "",
      },
    });
  }

  if (action === "return") {
    const returnNote =
      clean(body.returnNote).slice(0, 160);

    if (!returnNote) {
      return json(
        { error: "Укажите, кто сдал экземпляр" },
        400,
      );
    }

    const active = await env.DB
      .prepare(`
        SELECT
          id,
          reader_id AS readerId,
          reader_note AS readerNote,
          loan_date AS loanDate,
          issued_by AS issuedBy
        FROM loans
        WHERE
          record_id = ?
          AND return_date = ''
        ORDER BY loan_date DESC, id DESC
        LIMIT 1
      `)
      .bind(id)
      .first<{
        id: number;
        readerId: string;
        readerNote: string;
        loanDate: string;
        issuedBy: string;
      }>();

    if (!active) {
      return json(
        { error: "Активная выдача не найдена" },
        409,
      );
    }

    await env.DB.batch([
      env.DB
        .prepare(`
          UPDATE loans
          SET
            return_date = ?,
            return_note = ?,
            returned_by = ?
          WHERE
            id = ?
            AND return_date = ''
        `)
        .bind(
          now,
          returnNote,
          user.displayName,
          active.id,
        ),

      env.DB
        .prepare(`
          UPDATE catalog_records
          SET
            loan_status = 'В наличии',
            reader_id = '',
            last_return_date = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(
          now,
          now,
          id,
        ),

      env.DB
        .prepare(`
          INSERT INTO audit_log (
            record_id,
            action,
            changes_json,
            actor_id,
            actor_email,
            created_at
          )
          VALUES (?, 'loan_return', ?, ?, ?, ?)
        `)
        .bind(
          id,
          JSON.stringify({
            returnNote,
            loanId: active.id,
          }),
          user.userId,
          user.email,
          now,
        ),
    ]);

    return json({
      ok: true,
      loanStatus: "В наличии",
      loan: {
        id: String(active.id),
        readerId: active.readerId,
        readerNote: active.readerNote,
        loanDate: active.loanDate,
        returnDate: now,
        returnNote,
        issuedBy: active.issuedBy,
        returnedBy: user.displayName,
      },
    });
  }

  return json(
    { error: "Неизвестная операция" },
    400,
  );
}


function randomHex(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);

  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function pkceChallenge(
  verifier: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return base64Url(new Uint8Array(digest));
}

function cookieValue(
  request: Request,
  name: string,
): string {
  const header = request.headers.get("Cookie") ?? "";

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return "";
}

function sessionCookie(
  token: string,
  secure: boolean,
): string {
  return [
    `mlc_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=43200",
  ]
    .filter(Boolean)
    .join("; ");
}

function oauthStateCookie(
  state: string,
  secure: boolean,
): string {
  return [
    `mlc_oauth_state=${encodeURIComponent(state)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=600",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearCookie(
  name: string,
  secure: boolean,
): string {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

async function getCurrentUser(
  request: Request,
  env: Env,
): Promise<User | null> {
  const token = cookieValue(request, "mlc_session");

  if (!token) return null;

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();

  const row = await env.DB
    .prepare(`
      SELECT
        yandex_uid AS yandexUid,
        email,
        display_name AS displayName,
        role
      FROM auth_sessions
      WHERE
        token_hash = ?
        AND expires_at > ?
      LIMIT 1
    `)
    .bind(tokenHash, now)
    .first<{
      yandexUid: string;
      email: string;
      displayName: string;
      role: string;
    }>();

  if (!row) return null;

  return {
    userId: row.yandexUid,
    email: row.email,
    displayName: row.displayName,
    role: row.role === "admin" ? "admin" : "librarian",
  };
}

function isTemporaryD1AuthError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return (
    message.includes("D1_ERROR") &&
    (
      /row write limit/i.test(message) ||
      /daily.*write.*limit/i.test(message) ||
      /exceeded.*limit/i.test(message) ||
      /temporarily unavailable/i.test(message) ||
      /service unavailable/i.test(message)
    )
  );
}

function authDatabaseUnavailableResponse(): Response {
  const html = [
    "<!doctype html>",
    '<html lang="ru">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>Вход временно недоступен</title>",
    "</head>",
    "<body>",
    '  <main style="max-width:620px;margin:12vh auto;padding:32px;font-family:system-ui,sans-serif">',
    "    <h1>Вход временно недоступен</h1>",
    "    <p>Каталог работает, но база данных временно не может выполнить операцию записи, необходимую для авторизации.</p>",
    "    <p>Повторите попытку позже.</p>",
    '    <p><a href="/">Вернуться в каталог</a></p>',
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");

  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
async function authLogin(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.YANDEX_CLIENT_ID) {
    return json(
      { error: "YANDEX_CLIENT_ID is not configured" },
      500,
    );
  }

  const url = new URL(request.url);
  const redirectUri =
    `${url.origin}/api/auth/callback`;

  const state = randomHex(24);
  const verifier = randomHex(32);
  const challenge = await pkceChallenge(verifier);

  const now = new Date();
  const expires = new Date(
    now.getTime() + 10 * 60 * 1000,
  );

  await env.DB
    .prepare(`
      DELETE FROM auth_requests
      WHERE expires_at <= ?
    `)
    .bind(now.toISOString())
    .run();

  await env.DB
    .prepare(`
      INSERT INTO auth_requests (
        state,
        code_verifier,
        redirect_uri,
        created_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      state,
      verifier,
      redirectUri,
      now.toISOString(),
      expires.toISOString(),
    )
    .run();

  const authorize = new URL(
    "https://oauth.yandex.com/authorize",
  );

  authorize.searchParams.set(
    "response_type",
    "code",
  );

  authorize.searchParams.set(
    "client_id",
    env.YANDEX_CLIENT_ID,
  );

  authorize.searchParams.set(
    "redirect_uri",
    redirectUri,
  );

  authorize.searchParams.set(
    "scope",
    "login:info login:email",
  );

  authorize.searchParams.set(
    "state",
    state,
  );

  authorize.searchParams.set(
    "code_challenge",
    challenge,
  );

  authorize.searchParams.set(
    "code_challenge_method",
    "S256",
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": oauthStateCookie(
        state,
        url.protocol === "https:",
      ),
    },
  });
}

async function authCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";

  const error = url.searchParams.get("error");

  if (error) {
    return json(
      {
        error: "Yandex authorization failed",
        detail:
          url.searchParams.get("error_description") ??
          error,
      },
      401,
    );
  }

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const cookieState = cookieValue(
    request,
    "mlc_oauth_state",
  );

  if (!code || !state || !cookieState) {
    return json(
      { error: "OAuth callback is incomplete" },
      400,
    );
  }

  if (state !== cookieState) {
    return json(
      { error: "OAuth state mismatch" },
      400,
    );
  }

  const now = new Date().toISOString();

  const authRequest = await env.DB
    .prepare(`
      SELECT
        code_verifier AS codeVerifier,
        redirect_uri AS redirectUri
      FROM auth_requests
      WHERE
        state = ?
        AND expires_at > ?
      LIMIT 1
    `)
    .bind(state, now)
    .first<{
      codeVerifier: string;
      redirectUri: string;
    }>();

  await env.DB
    .prepare(`
      DELETE FROM auth_requests
      WHERE state = ?
    `)
    .bind(state)
    .run();

  if (!authRequest) {
    return json(
      {
        error:
          "OAuth request expired or was already used",
      },
      400,
    );
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.YANDEX_CLIENT_ID,
    code_verifier: authRequest.codeVerifier,
  });

  const tokenResponse = await fetch(
    "https://oauth.yandex.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString(),
    },
  );

  const tokenPayload = await tokenResponse
    .json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

  if (
    !tokenResponse.ok ||
    !tokenPayload.access_token
  ) {
    return json(
      {
        error: "Yandex token exchange failed",
        detail:
          tokenPayload.error_description ??
          tokenPayload.error ??
          "unknown error",
      },
      401,
    );
  }

  const profileResponse = await fetch(
    "https://login.yandex.ru/info?format=json",
    {
      headers: {
        Authorization:
          `OAuth ${tokenPayload.access_token}`,
      },
    },
  );

  const profile = await profileResponse
    .json() as {
      id?: string;
      login?: string;
      default_email?: string;
      display_name?: string;
      real_name?: string;
    };

  /*
   * Do not store the Yandex OAuth access token.
   * It goes out of scope immediately after /info.
   */

  if (
    !profileResponse.ok ||
    !profile.id ||
    !profile.default_email
  ) {
    return json(
      {
        error:
          "Required Yandex profile information is unavailable",
      },
      401,
    );
  }

  const user = await env.DB
    .prepare(`
      SELECT
        id,
        yandex_uid AS yandexUid,
        email,
        display_name AS displayName,
        role
      FROM app_users
      WHERE
        enabled = 1
        AND (
          yandex_uid = ?
          OR lower(email) = lower(?)
        )
      LIMIT 1
    `)
    .bind(
      profile.id,
      profile.default_email,
    )
    .first<{
      id: number;
      yandexUid: string | null;
      email: string;
      displayName: string;
      role: string;
    }>();

  if (!user) {
    return json(
      {
        error: "Access denied",
        message:
          "Этот Яндекс ID не добавлен в список пользователей каталога.",
      },
      403,
    );
  }

  const displayName =
    profile.display_name ||
    profile.real_name ||
    user.displayName ||
    profile.login ||
    profile.default_email;

  if (!user.yandexUid) {
    await env.DB
      .prepare(`
        UPDATE app_users
        SET
          yandex_uid = ?,
          display_name = ?,
          updated_at = ?
        WHERE
          id = ?
          AND (
            yandex_uid IS NULL
            OR yandex_uid = ''
          )
      `)
      .bind(
        profile.id,
        displayName,
        now,
        user.id,
      )
      .run();
  }

  const sessionToken = randomHex(32);
  const tokenHash = await sha256(sessionToken);

  const expiresAt = new Date(
    Date.now() + 12 * 60 * 60 * 1000,
  ).toISOString();

  await env.DB
    .prepare(`
      DELETE FROM auth_sessions
      WHERE expires_at <= ?
    `)
    .bind(now)
    .run();

  await env.DB
    .prepare(`
      INSERT INTO auth_sessions (
        token_hash,
        yandex_uid,
        email,
        display_name,
        role,
        created_at,
        expires_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      tokenHash,
      profile.id,
      profile.default_email,
      displayName,
      user.role,
      now,
      expiresAt,
      now,
    )
    .run();

  const headers = new Headers();

  headers.set(
    "Location",
    new URL("/?auth=ok", url.origin).toString(),
  );

  headers.append(
    "Set-Cookie",
    sessionCookie(sessionToken, secure),
  );

  headers.append(
    "Set-Cookie",
    clearCookie("mlc_oauth_state", secure),
  );

  return new Response(null, {
    status: 302,
    headers,
  });
}

async function authLogout(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const token = cookieValue(
    request,
    "mlc_session",
  );

  if (token) {
    const tokenHash = await sha256(token);

    await env.DB
      .prepare(`
        DELETE FROM auth_sessions
        WHERE token_hash = ?
      `)
      .bind(tokenHash)
      .run();
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL("/", url.origin).toString(),
      "Set-Cookie": clearCookie(
        "mlc_session",
        url.protocol === "https:",
      ),
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;
    if (
      method === "GET" &&
      pathname === "/api/health"
    ) {
      return json({
        ok: true,
        service: "music-school-library",
      });
    }

        if (
      method === "GET" &&
      pathname === "/api/session"
    ) {
      const sessionUser = await getCurrentUser(
        request,
        env,
      );

      return json(
        sessionUser
          ? {
              authenticated: true,
              user: {
                id: sessionUser.userId,
                email: sessionUser.email,
                displayName:
                  sessionUser.displayName,
                role: sessionUser.role,
              },
            }
          : {
              authenticated: false,
              user: null,
            },
      );
    }

    if (
      method === "GET" &&
      pathname === "/api/auth/login"
    ) {
      try {
        return await authLogin(request, env);
      } catch (error) {
        if (isTemporaryD1AuthError(error)) {
          console.error("Temporary D1 auth login error:", error);
          return authDatabaseUnavailableResponse();
        }
        throw error;
      }
    }

    if (
      method === "GET" &&
      pathname === "/api/auth/callback"
    ) {
      try {
        return await authCallback(request, env);
      } catch (error) {
        if (isTemporaryD1AuthError(error)) {
          console.error("Temporary D1 auth callback error:", error);
          return authDatabaseUnavailableResponse();
        }
        throw error;
      }
    }

    if (
      (method === "GET" || method === "POST") &&
      pathname === "/api/auth/logout"
    ) {
      return authLogout(request, env);
    }


    const user = await getCurrentUser(
      request,
      env,
    );

    if (!user) {
      return json(
        {
          error: "Unauthorized",
          message: "Требуется вход через Яндекс ID.",
        },
        401,
      );
    }

if (
      pathname === "/api/catalog" &&
      method === "GET"
    ) {
      return getCatalog(
        request,
        env,
      );
    }

    if (
      pathname === "/api/catalog" &&
      method === "POST"
    ) {
      return createRecord(
        request,
        env,
        user,
      );
    }

    const id = parseRecordId(pathname);

    if (id) {
      if (
        pathname === `/api/catalog/${id}/loans` &&
        method === "GET"
      ) {
        return getLoans(
          env,
          id,
        );
      }

      if (
        pathname === `/api/catalog/${id}/loans` &&
        method === "POST"
      ) {
        return changeLoan(
          request,
          env,
          user,
          id,
        );
      }

      if (
        pathname === `/api/catalog/${id}` &&
        method === "GET"
      ) {
        return getRecord(
          env,
          id,
        );
      }

      if (
        pathname === `/api/catalog/${id}` &&
        method === "PATCH"
      ) {
        return updateRecord(
          request,
          env,
          user,
          id,
        );
      }
      if (
        pathname === `/api/catalog/${id}/permanent` &&
        method === "DELETE"
      ) {
        return purgeRecord(
          env,
          user,
          id,
        );
      }


      if (
        pathname === `/api/catalog/${id}` &&
        method === "DELETE"
      ) {
        return deleteRecord(
          env,
          user,
          id,
        );
      }

      if (
        pathname === `/api/catalog/${id}/verify` &&
        method === "POST"
      ) {
        return verifyRecord(
          request,
          env,
          user,
          id,
        );
      }

      if (
        pathname === `/api/catalog/${id}/restore` &&
        method === "POST"
      ) {
        return restoreRecord(
          env,
          user,
          id,
        );
      }
    }

    if (pathname.startsWith("/api/")) {
      return json(
        { error: "API route not found" },
        404,
      );
    }

    return new Response(null, {
      status: 404,
    });
  },
} satisfies ExportedHandler<Env>;
