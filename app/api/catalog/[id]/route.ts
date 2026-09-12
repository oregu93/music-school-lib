import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/app/api-auth';

const EDITABLE_FIELDS: Record<string, string> = {
  dbNumber: 'db_number', bibliographicId: 'bibliographic_id',
  inventoryNumber: 'inventory_number', state: 'record_state',
  recordType: 'record_type', bibliographicLevel: 'bibliographic_level',
  author: 'author', title: 'title', titleFull: 'title_full', edition: 'edition',
  publicationPlace: 'publication_place', publisher: 'publisher', year: 'publication_year',
  physicalDescription: 'physical_description', series: 'series', subjects: 'subjects',
  keywords: 'keywords', classification: 'classification', shelfmark: 'shelfmark',
  notes: 'notes', location: 'location', accountingStatus: 'accounting_status',
  fundType: 'fund_type', invoice: 'invoice', inventoryMode: 'inventory_mode',
  registrationDate: 'registration_date', writeoffDate: 'writeoff_date',
  writeoffAct: 'writeoff_act', writeoffReason: 'writeoff_reason',
  loanStatus: 'loan_status', readerId: 'reader_id', lastLoanDate: 'last_loan_date',
  lastReturnDate: 'last_return_date', loanCount: 'loan_count',
};

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  const id = await recordId(context);
  if (!id) return NextResponse.json({ error: 'Некорректный номер записи' }, { status: 400 });
  const body = await request.json() as Record<string, unknown>;
  const updates = Object.entries(body).filter(([key]) => EDITABLE_FIELDS[key]);
  if (!updates.length) return NextResponse.json({ error: 'Нет полей для сохранения' }, { status: 400 });
  const assignments = updates.map(([key]) => `${EDITABLE_FIELDS[key]} = ?`);
  const values = updates.map(([key, value]) => key === 'loanCount' ? numeric(value) : clean(value));
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE catalog_records SET ${assignments.join(', ')}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`).bind(...values, now, id).run();
  if (!result.meta.changes) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  await audit(id, 'update', body, user, now);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  const id = await recordId(context);
  if (!id) return NextResponse.json({ error: 'Некорректный номер записи' }, { status: 400 });
  const now = new Date().toISOString();
  const result = await env.DB.prepare('UPDATE catalog_records SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').bind(now, user.userId, now, id).run();
  if (!result.meta.changes) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  await audit(id, 'delete', {}, user, now);
  return NextResponse.json({ ok: true });
}

async function recordId(context: RouteContext) {
  const params = await context.params;
  const id = Number(params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function numeric(value: unknown) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0; }
async function audit(id: number, action: string, changes: unknown, user: { userId: string; email: string }, now: string) {
  await env.DB.prepare('INSERT INTO audit_log (record_id, action, changes_json, actor_id, actor_email, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, action, JSON.stringify(changes), user.userId, user.email, now).run();
}
