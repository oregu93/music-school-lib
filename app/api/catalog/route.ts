import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/app/api-auth';

const SELECT_FIELDS = `
  id, db_number AS dbNumber, bibliographic_id AS bibliographicId,
  inventory_number AS inventoryNumber, record_state AS state,
  record_type AS recordType, bibliographic_level AS bibliographicLevel,
  author, title, title_full AS titleFull, edition,
  publication_place AS publicationPlace, publisher,
  publication_year AS year, physical_description AS physicalDescription,
  series, subjects, keywords, classification, shelfmark, notes, location,
  accounting_status AS accountingStatus, fund_type AS fundType, invoice,
  inventory_mode AS inventoryMode, registration_date AS registrationDate,
  writeoff_date AS writeoffDate, writeoff_act AS writeoffAct,
  writeoff_reason AS writeoffReason, loan_status AS loanStatus,
  reader_id AS readerId, last_loan_date AS lastLoanDate,
  last_return_date AS lastReturnDate, loan_count AS loanCount,
  marc_fields_json AS marcFieldsJson, raw_marc AS rawMarc,
  verified, verified_by AS verifiedBy, verified_at AS verifiedAt,
  deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt
`;

const SEARCH_FIELDS: Record<string, string[]> = {
  all: ['db_number', 'inventory_number', 'author', 'title', 'title_full', 'publisher', 'publication_year', 'subjects', 'keywords', 'shelfmark', 'notes'],
  dbNumber: ['db_number'], inventoryNumber: ['inventory_number'],
  author: ['author'], title: ['title'], publisher: ['publisher'], year: ['publication_year'],
};

export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const query = params.get('q')?.trim().slice(0, 200) ?? '';
  const field = params.get('field') ?? 'all';
  const includeWrittenOff = params.get('writtenOff') === '1';
  const trash = params.get('trash') === '1';
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 200), 1), 200);
  const offset = Math.max(Number(params.get('offset') ?? 0), 0);
  const clauses = [trash ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'];
  const bindings: unknown[] = [];
  if (!includeWrittenOff) clauses.push("record_state <> 'Списан'");
  if (query) {
    const columns = SEARCH_FIELDS[field] ?? SEARCH_FIELDS.all;
    clauses.push(`(${columns.map((column) => `LOWER(${column}) LIKE LOWER(?)`).join(' OR ')})`);
    bindings.push(...columns.map(() => `%${query}%`));
  }
  const where = clauses.join(' AND ');
  const list = await env.DB.prepare(`SELECT ${SELECT_FIELDS} FROM catalog_records WHERE ${where} ORDER BY author COLLATE NOCASE, title COLLATE NOCASE, id LIMIT ? OFFSET ?`).bind(...bindings, limit, offset).all();
  const stats = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN record_state = 'В фонде' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) AS verified FROM catalog_records WHERE deleted_at IS NULL`).first();
  return NextResponse.json({ items: list.results, stats, limit, offset });
}

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`INSERT INTO catalog_records (db_number, bibliographic_id, inventory_number, record_state, author, title, title_full, edition, publication_place, publisher, publication_year, physical_description, subjects, keywords, classification, shelfmark, notes, location, accounting_status, fund_type, invoice, loan_status, loan_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    value(body.dbNumber), value(body.bibliographicId), value(body.inventoryNumber), value(body.state) || 'В фонде', value(body.author), value(body.title), value(body.titleFull), value(body.edition), value(body.publicationPlace), value(body.publisher), value(body.year), value(body.physicalDescription), value(body.subjects), value(body.keywords), value(body.classification), value(body.shelfmark), value(body.notes), value(body.location), value(body.accountingStatus), value(body.fundType), value(body.invoice), value(body.loanStatus) || 'В наличии', numberValue(body.loanCount), now, now,
  ).run();
  const id = Number(result.meta.last_row_id);
  await env.DB.prepare(`INSERT INTO audit_log (record_id, action, changes_json, actor_id, actor_email, created_at) VALUES (?, 'create', ?, ?, ?, ?)`).bind(id, JSON.stringify(body), user.userId, user.email, now).run();
  const record = await env.DB.prepare(`SELECT ${SELECT_FIELDS} FROM catalog_records WHERE id = ?`).bind(id).first();
  return NextResponse.json({ record }, { status: 201 });
}

function value(input: unknown) { return typeof input === 'string' ? input.trim() : ''; }
function numberValue(input: unknown) { const parsed = Number(input); return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0; }
