import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { requireApiUser } from '@/app/api-auth';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  const id = await recordId(context);
  if (!id) return NextResponse.json({ error: 'Некорректный номер записи' }, { status: 400 });
  const rows = await env.DB.prepare(`SELECT id, reader_id AS readerId, reader_note AS readerNote,
    loan_date AS loanDate, return_date AS returnDate, return_note AS returnNote,
    issued_by AS issuedBy, returned_by AS returnedBy
    FROM loans WHERE record_id = ? ORDER BY loan_date DESC, id DESC LIMIT 30`).bind(id).all();
  return NextResponse.json({ items: rows.results });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  const id = await recordId(context);
  if (!id) return NextResponse.json({ error: 'Некорректный номер записи' }, { status: 400 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = text(body.action, 20);
  const record = await env.DB.prepare('SELECT db_number AS dbNumber, record_state AS state FROM catalog_records WHERE id = ? AND deleted_at IS NULL').bind(id).first<{ dbNumber: string; state: string }>();
  if (!record) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 });
  if (record.state === 'Списан') return NextResponse.json({ error: 'Списанный экземпляр нельзя выдать' }, { status: 409 });
  const now = new Date().toISOString();

  if (action === 'issue') {
    const readerNote = text(body.readerNote, 160);
    const readerId = text(body.readerId, 80);
    if (!readerNote) return NextResponse.json({ error: 'Укажите, кому выдан экземпляр' }, { status: 400 });
    const active = await env.DB.prepare("SELECT id FROM loans WHERE record_id = ? AND return_date = '' LIMIT 1").bind(id).first();
    if (active) return NextResponse.json({ error: 'Экземпляр уже отмечен как выданный' }, { status: 409 });
    const results = await env.DB.batch([
      env.DB.prepare('INSERT INTO loans (record_id, db_number, reader_id, reader_note, loan_date, return_date, return_note, quantity, issued_by, returned_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)').bind(id, record.dbNumber, readerId, readerNote, now, '', '', user.displayName, '', now),
      env.DB.prepare("UPDATE catalog_records SET loan_status = 'Выдана', reader_id = ?, last_loan_date = ?, loan_count = loan_count + 1, updated_at = ? WHERE id = ?").bind(readerId || readerNote, now, now, id),
      env.DB.prepare("INSERT INTO audit_log (record_id, action, changes_json, actor_id, actor_email, created_at) VALUES (?, 'loan_issue', ?, ?, ?, ?)").bind(id, JSON.stringify({ readerId, readerNote }), user.userId, user.email, now),
    ]);
    return NextResponse.json({ ok: true, loanStatus: 'Выдана', loan: { id: String(results[0].meta.last_row_id), readerId, readerNote, loanDate: now, returnDate: '', returnNote: '', issuedBy: user.displayName, returnedBy: '' } });
  }

  if (action === 'return') {
    const returnNote = text(body.returnNote, 160);
    if (!returnNote) return NextResponse.json({ error: 'Укажите, кто сдал экземпляр' }, { status: 400 });
    const active = await env.DB.prepare("SELECT id, reader_id AS readerId, reader_note AS readerNote, loan_date AS loanDate, issued_by AS issuedBy FROM loans WHERE record_id = ? AND return_date = '' ORDER BY loan_date DESC, id DESC LIMIT 1").bind(id).first<{ id: number; readerId: string; readerNote: string; loanDate: string; issuedBy: string }>();
    if (!active) return NextResponse.json({ error: 'Активная выдача не найдена' }, { status: 409 });
    await env.DB.batch([
      env.DB.prepare("UPDATE loans SET return_date = ?, return_note = ?, returned_by = ? WHERE id = ? AND return_date = ''").bind(now, returnNote, user.displayName, active.id),
      env.DB.prepare("UPDATE catalog_records SET loan_status = 'В наличии', reader_id = '', last_return_date = ?, updated_at = ? WHERE id = ?").bind(now, now, id),
      env.DB.prepare("INSERT INTO audit_log (record_id, action, changes_json, actor_id, actor_email, created_at) VALUES (?, 'loan_return', ?, ?, ?, ?)").bind(id, JSON.stringify({ returnNote, loanId: active.id }), user.userId, user.email, now),
    ]);
    return NextResponse.json({ ok: true, loanStatus: 'В наличии', loan: { id: String(active.id), readerId: active.readerId, readerNote: active.readerNote, loanDate: active.loanDate, returnDate: now, returnNote, issuedBy: active.issuedBy, returnedBy: user.displayName } });
  }

  return NextResponse.json({ error: 'Неизвестная операция' }, { status: 400 });
}

async function recordId(context: RouteContext) {
  const params = await context.params;
  const id = Number(params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
