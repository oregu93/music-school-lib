import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { requireApiUser } from '@/app/api-auth';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  const params = await context.params;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Некорректный номер записи' }, { status: 400 });
  const now = new Date().toISOString();
  const result = await env.DB.prepare('UPDATE catalog_records SET verified = 1, verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').bind(user.userId, now, now, id).run();
  if (!result.meta.changes) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  await env.DB.prepare("INSERT INTO audit_log (record_id, action, changes_json, actor_id, actor_email, created_at) VALUES (?, 'verify', '{}', ?, ?, ?)").bind(id, user.userId, user.email, now).run();
  return NextResponse.json({ ok: true, verifiedAt: now });
}
