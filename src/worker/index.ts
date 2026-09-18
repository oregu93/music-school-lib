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
  updated_at AS updatedAt,
  revision
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
  deleted_at AS deletedAt,
  revision
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

type OperationEnvelope = {
  operationId: string;
  deviceId: string;
  createdAt: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function baseRevisionFrom(
  body: Record<string, unknown>,
  required = false,
): number | null | Response {
  if (body.baseRevision === undefined && !required) return null;
  if (
    !Number.isSafeInteger(body.baseRevision) ||
    Number(body.baseRevision) < 1
  ) {
    return json(
      {
        error: "invalid_base_revision",
        message: "Некорректная версия карточки.",
      },
      400,
    );
  }
  return Number(body.baseRevision);
}

function operationFrom(
  body: Record<string, unknown>,
): OperationEnvelope | null | Response {
  if (body.operationId === undefined) return null;
  const operationId = clean(body.operationId);
  const deviceId = clean(body.deviceId);
  if (!UUID_PATTERN.test(operationId) || !UUID_PATTERN.test(deviceId)) {
    return json(
      {
        error: "invalid_operation_envelope",
        message: "Некорректный идентификатор операции или устройства.",
      },
      400,
    );
  }
  const createdAt = clean(body.createdAt);
  return {
    operationId,
    deviceId,
    createdAt: createdAt || null,
  };
}

async function replayedOperation(
  env: Env,
  user: User,
  operation: OperationEnvelope | null,
  operationType: string,
): Promise<Response | null> {
  if (!operation) return null;
  const existing = await env.DB
    .prepare(`
      SELECT
        actor_user_id AS actorUserId,
        operation_type AS operationType,
        result_payload AS resultPayload
      FROM sync_operations
      WHERE operation_id = ?
    `)
    .bind(operation.operationId)
    .first<{
      actorUserId: string;
      operationType: string;
      resultPayload: string;
    }>();
  if (!existing) return null;
  if (
    existing.actorUserId !== user.userId ||
    existing.operationType !== operationType
  ) {
    return json(
      {
        error: "operation_id_conflict",
        message: "Идентификатор операции уже использован.",
      },
      409,
    );
  }
  const payload = JSON.parse(existing.resultPayload || "{}") as Record<string, unknown>;
  if (operationType === "catalog_create" && payload.recordId) {
    const record = await env.DB
      .prepare(`SELECT ${SELECT_FIELDS} FROM catalog_records WHERE id = ?`)
      .bind(payload.recordId)
      .first();
    return record ? json({ record }, 201) : json(payload);
  }
  if (
    (operationType === "loan_issue" || operationType === "loan_return") &&
    payload.loanId
  ) {
    const loan = await env.DB
      .prepare(`
        SELECT
          id, reader_id AS readerId, reader_note AS readerNote,
          loan_date AS loanDate, return_date AS returnDate,
          return_note AS returnNote, issued_by AS issuedBy,
          returned_by AS returnedBy
        FROM loans
        WHERE id = ?
      `)
      .bind(payload.loanId)
      .first();
    return json({
      ok: true,
      revision: payload.revision,
      loanStatus: operationType === "loan_issue" ? "Выдана" : "В наличии",
      loan,
    });
  }
  return json(payload, operationType === "inventory_session_create" ? 201 : 200);
}

function syncSuccessStatement(
  env: Env,
  operation: OperationEnvelope,
  user: User,
  entityType: string,
  entityId: string,
  operationType: string,
  baseRevision: number | null,
  payload: unknown,
) {
  const now = new Date().toISOString();
  return env.DB
    .prepare(`
      INSERT INTO sync_operations (
        operation_id, device_id, actor_user_id, entity_type, entity_id,
        operation_type, base_revision, request_payload, result_payload,
        result_status, created_at_client, received_at_server, completed_at_server
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, '{}', ?, 'succeeded', ?, ?, ?
      WHERE changes() = 1
    `)
    .bind(
      operation.operationId,
      operation.deviceId,
      user.userId,
      entityType,
      entityId,
      operationType,
      baseRevision,
      JSON.stringify(payload),
      operation.createdAt,
      now,
      now,
    );
}

function deviceSuccessStatement(
  env: Env,
  operation: OperationEnvelope,
  user: User,
) {
  const now = new Date().toISOString();
  return env.DB
    .prepare(`
      INSERT INTO client_devices (
        device_id, created_by_user_id, label, platform, enabled,
        first_seen_at, last_seen_at
      )
      SELECT ?, ?, '', '', 1, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM sync_operations WHERE operation_id = ?
      )
      ON CONFLICT(device_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at
    `)
    .bind(
      operation.deviceId,
      user.userId,
      now,
      now,
      operation.operationId,
    );
}

function revisionConflict(
  expectedRevision: number,
  currentRevision: number,
): Response {
  return json(
    {
      error: "revision_conflict",
      message: "Карточка была изменена в другом сеансе. Перезагрузите актуальные данные; ваши правки сохранены локально.",
      expectedRevision,
      currentRevision,
    },
    409,
  );
}

async function currentRevision(
  env: Env,
  id: number,
): Promise<{ revision: number; deletedAt: string | null } | null> {
  return env.DB
    .prepare(`
      SELECT revision, deleted_at AS deletedAt
      FROM catalog_records
      WHERE id = ?
    `)
    .bind(id)
    .first<{ revision: number; deletedAt: string | null }>();
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

  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const replay = await replayedOperation(
    env,
    user,
    operation,
    "catalog_create",
  );
  if (replay) return replay;

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

  let results;
  try {
    results = operation
      ? await env.DB.batch([
          createStatement,
          env.DB
            .prepare(`
              INSERT INTO sync_operations (
                operation_id, device_id, actor_user_id, entity_type,
                entity_id, operation_type, base_revision, request_payload,
                result_payload, result_status, created_at_client,
                received_at_server, completed_at_server
              )
              VALUES (
                ?, ?, ?, 'catalog_record', CAST(last_insert_rowid() AS TEXT),
                'catalog_create', NULL, ?,
                json_object(
                  'ok', json('true'),
                  'recordId', CAST(last_insert_rowid() AS TEXT),
                  'revision', 1
                ),
                'succeeded', ?, ?, ?
              )
            `)
            .bind(
              operation.operationId,
              operation.deviceId,
              user.userId,
              JSON.stringify(body),
              operation.createdAt,
              now,
              now,
            ),
          deviceSuccessStatement(env, operation, user),
          env.DB
            .prepare(`
              INSERT INTO audit_log (
                record_id, action, changes_json, actor_id, actor_email, created_at
              )
              SELECT CAST(entity_id AS INTEGER), 'create', ?, ?, ?, ?
              FROM sync_operations
              WHERE operation_id = ?
            `)
            .bind(
              JSON.stringify(body),
              user.userId,
              user.email,
              now,
              operation.operationId,
            ),
        ])
      : await env.DB.batch([
          createStatement,
          env.DB
            .prepare(`
              INSERT INTO audit_log (
                record_id, action, changes_json, actor_id, actor_email, created_at
              )
              VALUES (last_insert_rowid(), 'create', ?, ?, ?, ?)
            `)
            .bind(
              JSON.stringify(body),
              user.userId,
              user.email,
              now,
            ),
        ]);
  } catch (error) {
    const duplicate = await replayedOperation(
      env,
      user,
      operation,
      "catalog_create",
    );
    if (duplicate) return duplicate;
    throw error;
  }

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

  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const baseValue = baseRevisionFrom(body, Boolean(operation));
  if (baseValue instanceof Response) return baseValue;
  const baseRevision = baseValue;
  const replay = await replayedOperation(
    env,
    user,
    operation,
    "catalog_update",
  );
  if (replay) return replay;

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
        notes,
        revision
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
        updated_at = ?,
        revision = revision + 1
      WHERE
        id = ?
        AND deleted_at IS NULL
        ${baseRevision === null ? "" : "AND revision = ?"}
    `)
    .bind(
      ...values,
      now,
      id,
      ...(baseRevision === null ? [] : [baseRevision]),
    );

  const nextRevision = baseRevision === null
    ? Number(currentSearch.revision) + 1
    : baseRevision + 1;
  const changes = Object.fromEntries(updates);
  let results;
  try {
    results = operation
      ? await env.DB.batch([
          mutation,
          syncSuccessStatement(
            env,
            operation,
            user,
            "catalog_record",
            String(id),
            "catalog_update",
            baseRevision,
            { ok: true, revision: nextRevision },
          ),
          deviceSuccessStatement(env, operation, user),
          auditStatement(
            env,
            id,
            "update",
            changes,
            user,
            now,
            "EXISTS (SELECT 1 FROM sync_operations WHERE operation_id = ?)",
            [operation.operationId],
          ),
        ])
      : await env.DB.batch([
          mutation,
          auditStatement(
            env,
            id,
            "update",
            changes,
            user,
            now,
            "changes() = 1",
          ),
        ]);
  } catch (error) {
    const duplicate = await replayedOperation(
      env,
      user,
      operation,
      "catalog_update",
    );
    if (duplicate) return duplicate;
    throw error;
  }

  const result = results[0];

  if (!result.meta.changes) {
    const current = await currentRevision(env, id);
    if (current && !current.deletedAt && baseRevision !== null) {
      return revisionConflict(baseRevision, current.revision);
    }
    return json(
      { error: "Catalog record not found" },
      404,
    );
  }

  const revision = baseRevision === null
    ? (await currentRevision(env, id))?.revision ?? nextRevision
    : nextRevision;
  return json({ ok: true, revision });
}

async function deleteRecord(
  request: Request,
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const baseValue = baseRevisionFrom(body, Boolean(operation));
  if (baseValue instanceof Response) return baseValue;
  const baseRevision = baseValue;
  const replay = await replayedOperation(env, user, operation, "catalog_delete");
  if (replay) return replay;
  const now = new Date().toISOString();

  const mutation = env.DB
    .prepare(`
      UPDATE catalog_records
      SET
        deleted_at = ?,
        deleted_by = ?,
        updated_at = ?,
        revision = revision + 1
      WHERE
        id = ?
        AND deleted_at IS NULL
        ${baseRevision === null ? "" : "AND revision = ?"}
    `)
    .bind(
      now,
      user.userId,
      now,
      id,
      ...(baseRevision === null ? [] : [baseRevision]),
    );

  const nextRevision = baseRevision === null ? null : baseRevision + 1;
  let results;
  try {
    results = operation
      ? await env.DB.batch([
          mutation,
          syncSuccessStatement(
            env, operation, user, "catalog_record", String(id),
            "catalog_delete", baseRevision, { ok: true, revision: nextRevision },
          ),
          deviceSuccessStatement(env, operation, user),
          auditStatement(
            env, id, "delete", {}, user, now,
            "EXISTS (SELECT 1 FROM sync_operations WHERE operation_id = ?)",
            [operation.operationId],
          ),
        ])
      : await env.DB.batch([
          mutation,
          auditStatement(env, id, "delete", {}, user, now, "changes() = 1"),
        ]);
  } catch (error) {
    const duplicate = await replayedOperation(env, user, operation, "catalog_delete");
    if (duplicate) return duplicate;
    throw error;
  }

  const result = results[0];

  if (!result.meta.changes) {
    const current = await currentRevision(env, id);
    if (current && !current.deletedAt && baseRevision !== null) {
      return revisionConflict(baseRevision, current.revision);
    }
    return json(
      { error: "Catalog record not found" },
      404,
    );
  }

  const revision = nextRevision ?? (await currentRevision(env, id))?.revision;
  return json({ ok: true, revision });
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
  request: Request,
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const baseValue = baseRevisionFrom(body, Boolean(operation));
  if (baseValue instanceof Response) return baseValue;
  const baseRevision = baseValue;
  const replay = await replayedOperation(env, user, operation, "catalog_restore");
  if (replay) return replay;
  const now = new Date().toISOString();

  const mutation = env.DB
    .prepare(`
      UPDATE catalog_records
      SET
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = ?,
        revision = revision + 1
      WHERE
        id = ?
        AND deleted_at IS NOT NULL
        ${baseRevision === null ? "" : "AND revision = ?"}
    `)
    .bind(
      now,
      id,
      ...(baseRevision === null ? [] : [baseRevision]),
    );

  const nextRevision = baseRevision === null ? null : baseRevision + 1;
  let results;
  try {
    results = operation
      ? await env.DB.batch([
          mutation,
          syncSuccessStatement(
            env, operation, user, "catalog_record", String(id),
            "catalog_restore", baseRevision, { ok: true, revision: nextRevision },
          ),
          deviceSuccessStatement(env, operation, user),
          auditStatement(
            env, id, "restore", {}, user, now,
            "EXISTS (SELECT 1 FROM sync_operations WHERE operation_id = ?)",
            [operation.operationId],
          ),
        ])
      : await env.DB.batch([
          mutation,
          auditStatement(env, id, "restore", {}, user, now, "changes() = 1"),
        ]);
  } catch (error) {
    const duplicate = await replayedOperation(env, user, operation, "catalog_restore");
    if (duplicate) return duplicate;
    throw error;
  }

  const result = results[0];

  if (!result.meta.changes) {
    const current = await currentRevision(env, id);
    if (current?.deletedAt && baseRevision !== null) {
      return revisionConflict(baseRevision, current.revision);
    }
    return json(
      { error: "Deleted catalog record not found" },
      404,
    );
  }

  const revision = nextRevision ?? (await currentRevision(env, id))?.revision;
  return json({ ok: true, revision });
}

async function verifyRecord(
  request: Request,
  env: Env,
  user: User,
  id: number,
): Promise<Response> {
  const body = await request
    .json()
    .catch(() => ({})) as Record<string, unknown>;

  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const baseValue = baseRevisionFrom(body, Boolean(operation));
  if (baseValue instanceof Response) return baseValue;
  const baseRevision = baseValue;
  const replay = await replayedOperation(env, user, operation, "catalog_verify");
  if (replay) return replay;

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
        updated_at = ?,
        revision = revision + 1
      WHERE
        id = ?
        AND deleted_at IS NULL
        ${baseRevision === null ? "" : "AND revision = ?"}
    `)
    .bind(
      verified ? 1 : 0,
      verified ? user.userId : null,
      verified ? now : null,
      now,
      id,
      ...(baseRevision === null ? [] : [baseRevision]),
    );

  const nextRevision = baseRevision === null ? null : baseRevision + 1;
  const successPayload = {
    ok: true,
    verified,
    verifiedAt: verified ? now : null,
    revision: nextRevision,
  };
  let results;
  try {
    results = operation
      ? await env.DB.batch([
          mutation,
          syncSuccessStatement(
            env, operation, user, "catalog_record", String(id),
            "catalog_verify", baseRevision, successPayload,
          ),
          deviceSuccessStatement(env, operation, user),
          auditStatement(
            env, id, verified ? "verify" : "unverify", { verified }, user, now,
            "EXISTS (SELECT 1 FROM sync_operations WHERE operation_id = ?)",
            [operation.operationId],
          ),
        ])
      : await env.DB.batch([
          mutation,
          auditStatement(
            env, id, verified ? "verify" : "unverify", { verified }, user, now,
            "changes() = 1",
          ),
        ]);
  } catch (error) {
    const duplicate = await replayedOperation(env, user, operation, "catalog_verify");
    if (duplicate) return duplicate;
    throw error;
  }

  const result = results[0];

  if (!result.meta.changes) {
    const current = await currentRevision(env, id);
    if (current && !current.deletedAt && baseRevision !== null) {
      return revisionConflict(baseRevision, current.revision);
    }
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
    revision: nextRevision ?? (await currentRevision(env, id))?.revision,
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

  if (action !== "issue" && action !== "return") {
    return json({ error: "Неизвестная операция" }, 400);
  }

  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const baseValue = baseRevisionFrom(body, Boolean(operation));
  if (baseValue instanceof Response) return baseValue;
  const baseRevision = baseValue;
  const operationType = action === "issue" ? "loan_issue" : "loan_return";
  const replay = await replayedOperation(env, user, operation, operationType);
  if (replay) return replay;

  const record = await env.DB
    .prepare(`
      SELECT
        db_number AS dbNumber,
        record_state AS state,
        revision
      FROM catalog_records
      WHERE
        id = ?
        AND deleted_at IS NULL
    `)
    .bind(id)
    .first<{ dbNumber: string; state: string; revision: number }>();

  if (!record) {
    return json(
      { error: "Карточка не найдена" },
      404,
    );
  }

  const now = new Date().toISOString();

  if (action === "issue") {
    if (record.state === "Списан") {
      return json(
        { error: "Списанный экземпляр нельзя выдать" },
        409,
      );
    }
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

    const revisionClause = baseRevision === null ? "" : "AND revision = ?";
    const nextRevision = baseRevision === null ? record.revision + 1 : baseRevision + 1;
    const loanInsert = env.DB
      .prepare(`
        INSERT INTO loans (
          record_id, db_number, reader_id, reader_note, loan_date,
          return_date, return_note, quantity, issued_by, returned_by, created_at
        )
        SELECT id, db_number, ?, ?, ?, '', '', 1, ?, '', ?
        FROM catalog_records
        WHERE id = ? AND deleted_at IS NULL AND record_state <> 'Списан'
          ${revisionClause}
      `)
      .bind(
        readerId,
        readerNote,
        now,
        user.displayName,
        now,
        id,
        ...(baseRevision === null ? [] : [baseRevision]),
      );
    const catalogUpdate = env.DB
      .prepare(`
        UPDATE catalog_records
        SET
          loan_status = 'Выдана', reader_id = ?, last_loan_date = ?,
          loan_count = loan_count + 1, updated_at = ?, revision = revision + 1
        WHERE id = ? ${revisionClause} AND changes() = 1
      `)
      .bind(
        readerId || readerNote,
        now,
        now,
        id,
        ...(baseRevision === null ? [] : [baseRevision]),
      );

    let results;
    try {
      if (operation) {
        const sync = env.DB
          .prepare(`
            INSERT INTO sync_operations (
              operation_id, device_id, actor_user_id, entity_type, entity_id,
              operation_type, base_revision, request_payload, result_payload,
              result_status, created_at_client, received_at_server, completed_at_server
            )
            SELECT ?, ?, ?, 'catalog_record', ?, 'loan_issue', ?, '{}',
              json_object(
                'ok', json('true'), 'loanId', CAST(last_insert_rowid() AS TEXT),
                'revision', ?
              ),
              'succeeded', ?, ?, ?
            WHERE changes() = 1
          `)
          .bind(
            operation.operationId, operation.deviceId, user.userId, String(id),
            baseRevision, nextRevision, operation.createdAt, now, now,
          );
        results = await env.DB.batch([
          loanInsert,
          catalogUpdate,
          sync,
          deviceSuccessStatement(env, operation, user),
          auditStatement(
            env, id, "loan_issue", { readerId, readerNote }, user, now,
            "EXISTS (SELECT 1 FROM sync_operations WHERE operation_id = ?)",
            [operation.operationId],
          ),
        ]);
      } else {
        results = await env.DB.batch([
          loanInsert,
          catalogUpdate,
          auditStatement(
            env, id, "loan_issue", { readerId, readerNote }, user, now,
            "changes() = 1",
          ),
        ]);
      }
    } catch (error) {
      const duplicate = await replayedOperation(env, user, operation, "loan_issue");
      if (duplicate) return duplicate;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE") || message.includes("idx_loans_one_active")) {
        return json(
          {
            error: "active_loan_conflict",
            message: "Экземпляр уже отмечен как выданный.",
          },
          409,
        );
      }
      throw error;
    }

    if (!results[0].meta.changes) {
      const current = await currentRevision(env, id);
      if (current && !current.deletedAt && baseRevision !== null) {
        return revisionConflict(baseRevision, current.revision);
      }
      return json({ error: "Карточка не найдена" }, 404);
    }

    return json({
      ok: true,
      revision: nextRevision,
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

    const revisionClause = baseRevision === null ? "" : "AND revision = ?";
    const nextRevision = baseRevision === null ? record.revision + 1 : baseRevision + 1;
    const loanUpdate = env.DB
      .prepare(`
        UPDATE loans
        SET return_date = ?, return_note = ?, returned_by = ?
        WHERE id = ? AND return_date = ''
          AND EXISTS (
            SELECT 1 FROM catalog_records
            WHERE id = ? AND deleted_at IS NULL ${revisionClause}
          )
      `)
      .bind(
        now,
        returnNote,
        user.displayName,
        active.id,
        id,
        ...(baseRevision === null ? [] : [baseRevision]),
      );
    const catalogUpdate = env.DB
      .prepare(`
        UPDATE catalog_records
        SET
          loan_status = 'В наличии', reader_id = '', last_return_date = ?,
          updated_at = ?, revision = revision + 1
        WHERE id = ? ${revisionClause} AND changes() = 1
      `)
      .bind(
        now,
        now,
        id,
        ...(baseRevision === null ? [] : [baseRevision]),
      );

    let results;
    try {
      results = operation
        ? await env.DB.batch([
            loanUpdate,
            catalogUpdate,
            syncSuccessStatement(
              env, operation, user, "catalog_record", String(id),
              "loan_return", baseRevision,
              { ok: true, loanId: String(active.id), revision: nextRevision },
            ),
            deviceSuccessStatement(env, operation, user),
            auditStatement(
              env, id, "loan_return", { returnNote, loanId: active.id }, user, now,
              "EXISTS (SELECT 1 FROM sync_operations WHERE operation_id = ?)",
              [operation.operationId],
            ),
          ])
        : await env.DB.batch([
            loanUpdate,
            catalogUpdate,
            auditStatement(
              env, id, "loan_return", { returnNote, loanId: active.id }, user, now,
              "changes() = 1",
            ),
          ]);
    } catch (error) {
      const duplicate = await replayedOperation(env, user, operation, "loan_return");
      if (duplicate) return duplicate;
      throw error;
    }

    if (!results[0].meta.changes) {
      const current = await currentRevision(env, id);
      if (current && !current.deletedAt && baseRevision !== null) {
        return revisionConflict(baseRevision, current.revision);
      }
      return json({ error: "Активная выдача не найдена" }, 409);
    }

    return json({
      ok: true,
      revision: nextRevision,
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


async function getCurrentInventorySession(env: Env): Promise<Response> {
  const session = await env.DB
    .prepare(`
      SELECT
        s.id, s.name, s.status, s.created_at AS createdAt,
        COUNT(e.id) AS seenCount
      FROM inventory_sessions s
      LEFT JOIN inventory_events e ON e.session_id = s.id
      WHERE s.status = 'open'
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 1
    `)
    .first();
  return json({ session: session ?? null });
}

async function createInventorySession(
  request: Request,
  env: Env,
  user: User,
): Promise<Response> {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const sessionId = clean(body.sessionId);
  if (!UUID_PATTERN.test(sessionId)) {
    return json(
      { error: "invalid_session_id", message: "Некорректный идентификатор инвентаризации." },
      400,
    );
  }
  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const replay = await replayedOperation(
    env, user, operation, "inventory_session_create",
  );
  if (replay) return replay;
  const name = clean(body.name).slice(0, 120) || "Текущая инвентаризация";
  const now = new Date().toISOString();
  const session = { id: sessionId, name, status: "open", createdAt: now, seenCount: 0 };
  const insert = env.DB
    .prepare(`
      INSERT INTO inventory_sessions (
        id, name, status, created_by, created_at, completed_at
      ) VALUES (?, ?, 'open', ?, ?, NULL)
      ON CONFLICT(id) DO NOTHING
    `)
    .bind(sessionId, name, user.userId, now);
  let results;
  try {
    results = operation
      ? await env.DB.batch([
          insert,
          syncSuccessStatement(
            env, operation, user, "inventory_session", sessionId,
            "inventory_session_create", null, { ok: true, session },
          ),
          deviceSuccessStatement(env, operation, user),
        ])
      : await env.DB.batch([insert]);
  } catch (error) {
    const duplicate = await replayedOperation(
      env, user, operation, "inventory_session_create",
    );
    if (duplicate) return duplicate;
    throw error;
  }
  if (!results[0].meta.changes) return getCurrentInventorySession(env);
  return json({ ok: true, session }, 201);
}

async function markInventorySeen(
  request: Request,
  env: Env,
  user: User,
): Promise<Response> {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const recordId = Number(body.recordId);
  const sessionId = clean(body.sessionId);
  if (!Number.isSafeInteger(recordId) || recordId < 1 || !UUID_PATTERN.test(sessionId)) {
    return json(
      { error: "invalid_inventory_event", message: "Не выбран экземпляр или инвентаризация." },
      400,
    );
  }
  const operationValue = operationFrom(body);
  if (operationValue instanceof Response) return operationValue;
  const operation = operationValue;
  const replay = await replayedOperation(env, user, operation, "inventory_seen");
  if (replay) return replay;

  const session = await env.DB
    .prepare("SELECT id FROM inventory_sessions WHERE id = ? AND status = 'open'")
    .bind(sessionId)
    .first();
  if (!session) {
    return json(
      { error: "inventory_session_not_found", message: "Текущая инвентаризация не найдена." },
      404,
    );
  }
  const record = await env.DB
    .prepare(`
      SELECT inventory_number AS inventoryNumber
      FROM catalog_records
      WHERE id = ? AND deleted_at IS NULL
    `)
    .bind(recordId)
    .first<{ inventoryNumber: string }>();
  if (!record) return json({ error: "Catalog record not found" }, 404);

  const now = new Date().toISOString();
  const eventOperationId = operation?.operationId ?? crypto.randomUUID();
  const insert = env.DB
    .prepare(`
      INSERT INTO inventory_events (
        session_id, record_id, inventory_number, operation_id, seen_by, seen_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, record_id) DO NOTHING
    `)
    .bind(
      sessionId, recordId, record.inventoryNumber, eventOperationId,
      user.userId, now,
    );
  const successPayload = {
    ok: true,
    duplicate: false,
    recordId: String(recordId),
    seenAt: now,
  };
  let results;
  try {
    results = operation
      ? await env.DB.batch([
          insert,
          syncSuccessStatement(
            env, operation, user, "inventory_event", String(recordId),
            "inventory_seen", null, successPayload,
          ),
          deviceSuccessStatement(env, operation, user),
        ])
      : await env.DB.batch([insert]);
  } catch (error) {
    const duplicate = await replayedOperation(env, user, operation, "inventory_seen");
    if (duplicate) return duplicate;
    throw error;
  }

  if (!results[0].meta.changes) {
    const duplicatePayload = { ...successPayload, duplicate: true };
    if (operation) {
      try {
        await env.DB.batch([
          env.DB
            .prepare(`
              INSERT INTO sync_operations (
                operation_id, device_id, actor_user_id, entity_type, entity_id,
                operation_type, base_revision, request_payload, result_payload,
                result_status, created_at_client, received_at_server, completed_at_server
              ) VALUES (?, ?, ?, 'inventory_event', ?, 'inventory_seen', NULL,
                '{}', ?, 'succeeded', ?, ?, ?)
            `)
            .bind(
              operation.operationId, operation.deviceId, user.userId,
              String(recordId), JSON.stringify(duplicatePayload),
              operation.createdAt, now, now,
            ),
          deviceSuccessStatement(env, operation, user),
        ]);
      } catch (error) {
        const replayed = await replayedOperation(env, user, operation, "inventory_seen");
        if (replayed) return replayed;
        throw error;
      }
    }
    return json(duplicatePayload);
  }
  return json(successPayload);
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvResponse(filename: string, rows: unknown[][]): Response {
  const csv = "\uFEFF" + rows
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function exportCatalogCsv(env: Env): Promise<Response> {
  const headers = [
    "id", "inventory_number", "db_number", "bibliographic_id", "author",
    "title", "title_full", "edition", "publication_place", "publisher",
    "publication_year", "physical_description", "series", "subjects",
    "keywords", "classification", "shelfmark", "notes", "location",
    "accounting_status", "fund_type", "invoice", "record_state",
    "loan_status", "reader_id", "last_loan_date", "last_return_date",
    "loan_count", "verified", "verified_by", "verified_at", "revision",
    "deleted_at", "created_at", "updated_at", "marc_fields_json",
  ];
  const rows: unknown[][] = [headers];
  const pageSize = 500;
  let offset = 0;
  while (true) {
    const page = await env.DB
      .prepare(`
        SELECT ${headers.join(", ")}
        FROM catalog_records
        ORDER BY id
        LIMIT ? OFFSET ?
      `)
      .bind(pageSize, offset)
      .all<Record<string, unknown>>();
    for (const record of page.results) {
      rows.push(headers.map((header) => record[header]));
    }
    if (page.results.length < pageSize) break;
    offset += pageSize;
  }
  return csvResponse("library_catalog_full.csv", rows);
}

async function exportInventoryCsv(env: Env): Promise<Response> {
  const result = await env.DB
    .prepare(`
      SELECT
        e.session_id, s.name AS session_name, e.record_id,
        e.inventory_number, c.db_number, c.author, c.title,
        e.seen_by, e.seen_at
      FROM inventory_events e
      JOIN inventory_sessions s ON s.id = e.session_id
      JOIN catalog_records c ON c.id = e.record_id
      ORDER BY e.seen_at, e.id
    `)
    .all<Record<string, unknown>>();
  const headers = [
    "session_id", "session_name", "record_id", "inventory_number",
    "db_number", "author", "title", "seen_by", "seen_at",
  ];
  return csvResponse(
    "library_inventory_events.csv",
    [headers, ...result.results.map((row) => headers.map((header) => row[header]))],
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
    "force_confirm",
    "yes",
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
      Location: new URL(
        "/?logout=1",
        url.origin,
      ).toString(),
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
      pathname === "/api/export/catalog.csv" &&
      method === "GET"
    ) {
      return exportCatalogCsv(env);
    }

    if (
      pathname === "/api/export/inventory.csv" &&
      method === "GET"
    ) {
      return exportInventoryCsv(env);
    }

    if (
      pathname === "/api/inventory/current" &&
      method === "GET"
    ) {
      return getCurrentInventorySession(env);
    }

    if (
      pathname === "/api/inventory/sessions" &&
      method === "POST"
    ) {
      return createInventorySession(request, env, user);
    }

    if (
      pathname === "/api/inventory/seen" &&
      method === "POST"
    ) {
      return markInventorySeen(request, env, user);
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
          request,
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
          request,
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
