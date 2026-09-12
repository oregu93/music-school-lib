'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { BookOpen, CheckCircle2, CirclePlus, Download, Library, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export type CatalogRecord = {
  id: string;
  dbNumber: string;
  inventoryNumber: string;
  bibliographicId: string;
  author: string;
  title: string;
  titleFull: string;
  edition: string;
  publicationPlace: string;
  publisher: string;
  year: string;
  physicalDescription: string;
  subjects: string;
  keywords: string;
  classification: string;
  shelfmark: string;
  notes: string;
  location: string;
  accountingStatus: string;
  fundType: string;
  invoice: string;
  state: 'В фонде' | 'Списан';
  loanStatus: string;
  verified: boolean;
  verifiedAt?: string;
  deleted: boolean;
};

const sampleRecords: CatalogRecord[] = [
  { id: '1', dbNumber: '712', bibliographicId: '2', inventoryNumber: '009985', author: 'Абелев Ю.', title: 'Сборник детских пьес для фортепиано', titleFull: 'Сборник детских пьес для фортепиано', edition: '', publicationPlace: 'Москва', publisher: 'Музгиз', year: '1940', physicalDescription: '28 с.', subjects: 'Фортепианная музыка', keywords: 'Ф.п.пьесы', classification: 'Ф.п.Сб.авт.', shelfmark: 'А 14', notes: 'Фортепианная музыка', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: 'Без накл.73', state: 'В фонде', loanStatus: 'В наличии', verified: true, verifiedAt: '12.09.2026', deleted: false },
  { id: '2', dbNumber: '713', bibliographicId: '3', inventoryNumber: '004061', author: 'Абелиович', title: 'Три пьесы для скрипки и фортепиано', titleFull: 'Три пьесы для скрипки и фортепиано', edition: '', publicationPlace: '', publisher: '', year: '1962', physicalDescription: '', subjects: 'Камерная музыка. Струнные смычковые с ф.п.', keywords: 'Скрипка.Пьесы', classification: 'Скрипка.Сб.авт.', shelfmark: 'А 14', notes: 'Камерная музыка', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: 'Без накл.', state: 'В фонде', loanStatus: 'В наличии', verified: false, deleted: false },
  { id: '3', dbNumber: '714', bibliographicId: '4', inventoryNumber: '000438', author: 'Абелян Л.', title: 'Забавное сольфеджио', titleFull: 'Забавное сольфеджио; учебное пособие для детей', edition: 'Учебное пособие', publicationPlace: 'Москва', publisher: 'Сов. композитор', year: '1982', physicalDescription: '60 с.', subjects: 'Сольфеджио', keywords: 'Сольфеджио', classification: 'V.6.', shelfmark: 'А 14', notes: 'Теоретическая литература', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: 'Без накл.', state: 'В фонде', loanStatus: 'Выдана', verified: true, verifiedAt: '12.09.2026', deleted: false },
  { id: '4', dbNumber: '727', bibliographicId: '17', inventoryNumber: '000443', author: 'Агажанов А.', title: 'Курс сольфеджио', titleFull: 'Курс сольфеджио', edition: '', publicationPlace: 'Москва', publisher: 'Музыка', year: '1974', physicalDescription: '', subjects: 'Сольфеджио', keywords: '', classification: '', shelfmark: 'А 15', notes: '', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: '', state: 'В фонде', loanStatus: 'В наличии', verified: false, deleted: false },
  { id: '5', dbNumber: '2508', bibliographicId: '1767', inventoryNumber: '005014', author: '', title: 'Золотая лира', titleFull: 'Золотая лира', edition: '', publicationPlace: 'Москва', publisher: 'Музыка', year: '1987', physicalDescription: '', subjects: '', keywords: '', classification: '', shelfmark: '', notes: '', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: '', state: 'Списан', loanStatus: 'Списан', verified: false, deleted: false },
];

const searchFields = [
  ['all', 'Все поля'], ['author', 'Автор'], ['title', 'Заглавие'],
  ['inventoryNumber', 'Инвентарный номер'], ['dbNumber', '№ записи в БД'],
] as const;

export function CatalogClient({ userName }: { userName: string }) {
  const [records, setRecords] = useState(sampleRecords);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [serverStats, setServerStats] = useState<{ total: number; active: number; verified: number } | null>(null);
  const [query, setQuery] = useState('');
  const [field, setField] = useState('all');
  const [showWrittenOff, setShowWrittenOff] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState('Демонстрационный режим: полный каталог ещё не импортирован.');

  useEffect(() => {
    if (apiAvailable === false) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: query, field, writtenOff: showWrittenOff ? '1' : '0', trash: showDeleted ? '1' : '0' });
      try {
        const response = await fetch(`/api/catalog?${params}`, { signal: controller.signal });
        if (response.status === 401) {
          setApiAvailable(false);
          setNotice('Локальная демонстрация: изменения сохраняются только до обновления страницы.');
          return;
        }
        if (!response.ok) throw new Error('catalog request failed');
        const payload = await response.json() as { items: Array<Record<string, unknown>>; stats: { total?: number; active?: number; verified?: number } };
        const total = Number(payload.stats?.total ?? 0);
        if (!total) {
          setApiAvailable(false); setServerStats(null); setRecords(sampleRecords);
          setNotice('Безопасная демонстрация: рабочий Excel ещё не импортирован, изменения пока не сохраняются.');
          return;
        }
        setRecords(payload.items.map(normalizeRecord));
        setServerStats({ total, active: Number(payload.stats?.active ?? 0), verified: Number(payload.stats?.verified ?? 0) });
        setApiAvailable(true);
        setNotice('Рабочая база подключена. Изменения сохраняются автоматически.');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setNotice('Не удалось связаться с базой. Повторите попытку через несколько секунд.');
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [apiAvailable, field, query, showDeleted, showWrittenOff]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: WebModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: 'search_catalog', title: 'Найти книгу в каталоге',
      description: 'Ищет экземпляры по автору, заглавию, инвентарному номеру или номеру записи и показывает результат в каталоге.',
      inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1 }, field: { type: 'string', enum: searchFields.map(([value]) => value) } }, required: ['query'], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        const value = input as { query?: unknown; field?: unknown };
        if (typeof value.query !== 'string' || !value.query.trim()) throw new Error('Укажите непустой поисковый запрос.');
        const requestedField = typeof value.field === 'string' && searchFields.some(([key]) => key === value.field) ? value.field : 'all';
        setField(requestedField); setQuery(value.query.trim());
        const needle = value.query.trim().toLocaleLowerCase('ru');
        const matches = records.filter((record) => {
          const values = requestedField === 'all' ? Object.values(record) : [record[requestedField as keyof CatalogRecord]];
          return values.some((item) => String(item).toLocaleLowerCase('ru').includes(needle));
        }).slice(0, 20);
        return { count: matches.length, records: matches.map(({ id, dbNumber, inventoryNumber, author, title, year, shelfmark, location, loanStatus }) => ({ id, dbNumber, inventoryNumber, author, title, year, shelfmark, location, loanStatus })) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [records]);

  const selected = records.find((record) => record.id === selectedId) ?? null;
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    return records.filter((record) => {
      if (showDeleted ? !record.deleted : record.deleted) return false;
      if (!showWrittenOff && record.state === 'Списан') return false;
      if (!needle) return true;
      const values = field === 'all' ? Object.values(record) : [record[field as keyof CatalogRecord]];
      return values.some((value) => String(value).toLocaleLowerCase('ru').includes(needle));
    });
  }, [field, query, records, showDeleted, showWrittenOff]);

  const saveRecord = async (next: CatalogRecord) => {
    if (apiAvailable && !await apiRequest(`/api/catalog/${next.id}`, { method: 'PATCH', body: JSON.stringify(next) }, setNotice)) return;
    setRecords((current) => current.map((record) => record.id === next.id ? next : record));
    setNotice(`Карточка № ${next.dbNumber || 'без номера'} сохранена.`);
  };
  const toggleVerifiedRecord = async (record: CatalogRecord) => {
    const verified = !record.verified;
    if (apiAvailable && !await apiRequest(`/api/catalog/${record.id}/verify`, { method: 'POST', body: JSON.stringify({ verified }) }, setNotice)) return;
    const next = { ...record, verified, verifiedAt: verified ? new Date().toLocaleDateString('ru-RU') : undefined };
    setRecords((current) => current.map((item) => item.id === next.id ? next : item));
    setServerStats((current) => current ? { ...current, verified: Math.max(0, current.verified + (verified ? 1 : -1)) } : null);
    setNotice(verified ? `Карточка № ${record.dbNumber || 'без номера'} проверена.` : `Отметка «Проверено» снята с карточки № ${record.dbNumber || 'без номера'}.`);
  };
  const deleteRecord = async (record: CatalogRecord) => {
    if (apiAvailable && !await apiRequest(`/api/catalog/${record.id}`, { method: 'DELETE' }, setNotice)) return;
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, deleted: true } : item));
    setSelectedId(null); setNotice('Карточка перемещена в корзину. Её можно восстановить.');
  };
  const restoreRecord = async (record: CatalogRecord) => {
    if (apiAvailable && !await apiRequest(`/api/catalog/${record.id}/restore`, { method: 'POST' }, setNotice)) return;
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, deleted: false } : item));
    setSelectedId(null); setNotice('Карточка восстановлена в каталоге.');
  };
  const addCopy = async (sourceId: string, dbNumber: string, inventoryNumber: string) => {
    const source = records.find((record) => record.id === sourceId);
    if (!source || !dbNumber.trim()) return;
    const next = { ...source, id: crypto.randomUUID(), dbNumber: dbNumber.trim(), inventoryNumber: inventoryNumber.trim(), verified: false, verifiedAt: undefined, deleted: false, state: 'В фонде' as const, loanStatus: 'В наличии' };
    if (apiAvailable) {
      const response = await fetch('/api/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) { setNotice('Не удалось добавить экземпляр. Изменения не сохранены.'); return; }
      const payload = await response.json() as { record: Record<string, unknown> };
      const saved = normalizeRecord(payload.record);
      setRecords((current) => [...current, saved]); setAddOpen(false); setSelectedId(saved.id); setNotice(`Экземпляр № ${saved.dbNumber} добавлен.`);
      return;
    }
    setRecords((current) => [...current, next]); setAddOpen(false); setSelectedId(next.id); setNotice(`Экземпляр № ${next.dbNumber} добавлен.`);
  };
  const exportCsv = () => {
    const active = records.filter((record) => !record.deleted);
    const headers = ['№ записи в БД', 'Инвентарный номер', 'Автор', 'Заглавие', 'Издательство', 'Год', 'Шифр хранения', 'Местонахождение', 'Статус', 'Проверено'];
    const rows = active.map((record) => [record.dbNumber, record.inventoryNumber, record.author, record.title, record.publisher, record.year, record.shelfmark, record.location, record.loanStatus, record.verified ? 'Да' : 'Нет']);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })); link.download = 'library_catalog.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  const activeCount = serverStats?.active ?? records.filter((record) => !record.deleted && record.state === 'В фонде').length;
  const verifiedCount = serverStats?.verified ?? records.filter((record) => !record.deleted && record.verified).length;
  const totalCount = serverStats?.total ?? records.filter((record) => !record.deleted).length;

  return <main className="min-h-screen bg-background text-foreground">
    <header className="library-header border-b px-5 py-4 lg:px-8"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Library className="size-6" /></div><div><h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Электронный каталог</h1><p className="text-sm text-muted-foreground">Библиотека музыкальной школы</p></div></div><Badge variant="outline" className="hidden h-7 gap-1.5 px-3 sm:flex"><ShieldCheck /> {userName}</Badge></div></header>
    <section className="mx-auto max-w-[1600px] p-4 lg:p-8">
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">{notice}</div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><Summary label="Экземпляров" value={String(totalCount)} muted={apiAvailable ? undefined : 'в демонстрации'} /><Summary label="В фонде" value={String(activeCount)} /><Summary label="Проверено" value={String(verifiedCount)} /></div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Автор, заглавие, номер…" className="h-11 pl-10 text-base" aria-label="Поиск по каталогу" /></div>
          <Select value={field} onValueChange={(value) => value && setField(value)}><SelectTrigger className="h-11 w-full xl:w-56" aria-label="Поле поиска"><SelectValue /></SelectTrigger><SelectContent>{searchFields.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm"><Checkbox checked={showWrittenOff} onCheckedChange={setShowWrittenOff} />Списанные</label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm"><Checkbox checked={showDeleted} onCheckedChange={setShowDeleted} />Корзина</label>
          <Button className="h-11 gap-2" onClick={() => setAddOpen(true)}><CirclePlus /> Добавить</Button>
          <Button variant="outline" className="h-11 gap-2" onClick={exportCsv}><Download /> Скачать CSV</Button>
        </div>
        <div className="flex items-center justify-between border-b bg-muted/35 px-4 py-2.5 text-sm text-muted-foreground"><span>Найдено: <strong className="text-foreground">{visible.length}</strong></span><span className="hidden sm:inline">Нажмите на строку, чтобы открыть карточку</span></div>
        <Table><TableHeader><TableRow className="bg-primary/5 hover:bg-primary/5"><TableHead className="w-28 pl-4">№ записи в БД</TableHead><TableHead className="w-28">Проверено</TableHead><TableHead>Автор</TableHead><TableHead className="min-w-72">Заглавие</TableHead><TableHead>Год</TableHead><TableHead>Инвентарный номер</TableHead><TableHead>Статус</TableHead></TableRow></TableHeader><TableBody>{visible.map((record) => <TableRow key={record.id} tabIndex={0} role="button" onClick={() => setSelectedId(record.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(record.id); }} className="cursor-pointer focus-visible:bg-accent focus-visible:outline-none"><TableCell className="pl-4 font-mono text-sm">{record.dbNumber || '—'}</TableCell><TableCell>{record.verified ? <Badge className="gap-1 bg-emerald-700"><CheckCircle2 /> Проверено</Badge> : <span className="text-muted-foreground">Нет</span>}</TableCell><TableCell className="font-medium">{record.author || 'Без автора'}</TableCell><TableCell className="max-w-md whitespace-normal font-medium">{record.title}</TableCell><TableCell>{record.year || '—'}</TableCell><TableCell className="font-mono">{record.inventoryNumber || '—'}</TableCell><TableCell><Badge variant={record.state === 'Списан' ? 'destructive' : 'outline'}>{record.deleted ? 'В корзине' : record.loanStatus}</Badge></TableCell></TableRow>)}</TableBody></Table>
      </div>
    </section>
    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:max-w-none sm:data-[side=right]:w-[min(96vw,1480px)]">{selected && <RecordCard key={selected.id} record={selected} onSave={saveRecord} onToggleVerified={toggleVerifiedRecord} onDelete={deleteRecord} onRestore={restoreRecord} />}</SheetContent></Sheet>
    <AddCopyDialog open={addOpen} records={records.filter((r) => !r.deleted)} onOpenChange={setAddOpen} onAdd={addCopy} />
  </main>;
}

function Summary({ label, value, muted }: { label: string; value: string; muted?: string }) { return <div className="rounded-xl border bg-card px-5 py-4 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-2xl font-semibold">{value}</strong>{muted && <span className="text-xs text-muted-foreground">{muted}</span>}</div></div>; }

function RecordCard({ record, onSave, onToggleVerified, onDelete, onRestore }: { record: CatalogRecord; onSave: (record: CatalogRecord) => void; onToggleVerified: (record: CatalogRecord) => void; onDelete: (record: CatalogRecord) => void; onRestore: (record: CatalogRecord) => void }) {
  const [draft, setDraft] = useState(record); const [qr, setQr] = useState('');
  const update = (key: keyof CatalogRecord, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  useEffect(() => { const payload = qrPayload(draft); QRCode.toDataURL(payload, { errorCorrectionLevel: 'L', width: 280, margin: 2, color: { dark: '#17324d', light: '#ffffff' } }).then(setQr).catch(() => setQr('')); }, [draft]);
  return <><SheetHeader className="border-b px-6 py-5"><div className="mb-2 flex items-center gap-2"><BookOpen className="size-5 text-primary" />{record.verified && <Badge className="bg-emerald-700">Проверено{record.verifiedAt ? ` ${record.verifiedAt}` : ''}</Badge>}</div><SheetTitle className="pr-10 text-xl">Карточка экземпляра</SheetTitle><SheetDescription>{record.author || 'Без автора'} · {record.title}</SheetDescription></SheetHeader>
    <div className="px-6 pb-8"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="№ записи в БД" value={draft.dbNumber} onChange={(v) => update('dbNumber', v)} /><Field label="Инвентарный номер" value={draft.inventoryNumber} onChange={(v) => update('inventoryNumber', v)} /><Field label="Автор" value={draft.author} onChange={(v) => update('author', v)} /><Field label="Год издания" value={draft.year} onChange={(v) => update('year', v)} /><Field label="Заглавие" value={draft.title} onChange={(v) => update('title', v)} wide /><Field label="Полные сведения" value={draft.titleFull} onChange={(v) => update('titleFull', v)} wide multiline /><Field label="Сведения об издании" value={draft.edition} onChange={(v) => update('edition', v)} wide /><Field label="Издательство" value={draft.publisher} onChange={(v) => update('publisher', v)} /><Field label="Шифр хранения" value={draft.shelfmark} onChange={(v) => update('shelfmark', v)} /><Field label="Местонахождение" value={draft.location} onChange={(v) => update('location', v)} /><Field label="Статус выдачи" value={draft.loanStatus} onChange={(v) => update('loanStatus', v)} /><Field label="Темы" value={draft.subjects} onChange={(v) => update('subjects', v)} wide /><Field label="Примечания" value={draft.notes} onChange={(v) => update('notes', v)} wide multiline /></div><aside className="mt-6 flex flex-col items-center gap-4 rounded-xl border bg-muted/35 p-4 text-center sm:flex-row sm:text-left">{qr ? <img src={qr} alt="QR-код с информацией из карточки" className="aspect-square w-36 shrink-0 rounded-md bg-white" /> : <div className="aspect-square w-36 shrink-0 animate-pulse rounded-md bg-muted" />}<div><p className="font-medium">QR-код экземпляра</p><p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">Содержит библиографические сведения и данные для поиска книги на полке. Личная информация читателей в QR-код не включается.</p></div></aside></div>
    <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur"><div>{record.deleted ? <Button variant="outline" className="gap-2" onClick={() => onRestore(record)}><RotateCcw /> Восстановить</Button> : <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" className="gap-2" />}><Trash2 /> Удалить</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Переместить карточку в корзину?</AlertDialogTitle><AlertDialogDescription>Карточка исчезнет из каталога, но её можно будет восстановить.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => onDelete(record)}>Переместить в корзину</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div><div className="flex flex-wrap gap-2">{!record.deleted && <Button variant="outline" onClick={() => onToggleVerified(record)}>{record.verified ? 'Снять отметку «Проверено»' : 'Отметить проверенной'}</Button>}<Button disabled={record.deleted} onClick={() => onSave(draft)}>Сохранить изменения</Button></div></div></>;
}

function Field({ label, value, onChange, wide = false, multiline = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean; multiline?: boolean }) { return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-sm font-medium">{label}</span>{multiline ? <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-20 text-base md:text-sm" /> : <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-10" />}</label>; }

function AddCopyDialog({ open, records, onOpenChange, onAdd }: { open: boolean; records: CatalogRecord[]; onOpenChange: (open: boolean) => void; onAdd: (sourceId: string, dbNumber: string, inventoryNumber: string) => void }) {
  const [sourceId, setSourceId] = useState(records[0]?.id ?? ''); const [dbNumber, setDbNumber] = useState(''); const [inventoryNumber, setInventoryNumber] = useState('');
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Добавить экземпляр</DialogTitle><DialogDescription>Выберите похожую книгу и задайте номера нового экземпляра.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><label><span className="mb-1.5 block text-sm font-medium">Карточка-образец</span><Select value={sourceId} onValueChange={(value) => value && setSourceId(value)}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{records.map((record) => <SelectItem key={record.id} value={record.id}>{record.dbNumber} — {record.author} — {record.title}</SelectItem>)}</SelectContent></Select></label><Field label="№ записи в БД" value={dbNumber} onChange={setDbNumber} /><Field label="Инвентарный номер" value={inventoryNumber} onChange={setInventoryNumber} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button><Button disabled={!sourceId || !dbNumber.trim()} onClick={() => onAdd(sourceId, dbNumber, inventoryNumber)}>Добавить экземпляр</Button></DialogFooter></DialogContent></Dialog>;
}

function qrPayload(record: CatalogRecord) {
  const rows = [['№ записи в БД', record.dbNumber], ['Инвентарный номер', record.inventoryNumber], ['Автор', record.author], ['Заглавие', record.titleFull || record.title], ['Издание', record.edition], ['Место издания', record.publicationPlace], ['Издательство', record.publisher], ['Год', record.year], ['Физическое описание', record.physicalDescription], ['Темы', record.subjects], ['Ключевые слова', record.keywords], ['Классификация', record.classification], ['Шифр хранения', record.shelfmark], ['Местонахождение', record.location], ['Статус выдачи', record.loanStatus], ['Примечания', record.notes]];
  return ['КАРТОЧКА ЭКЗЕМПЛЯРА', ...rows.filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value}`)].join('\n');
}

function normalizeRecord(raw: Record<string, unknown>): CatalogRecord {
  const string = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : '';
  return {
    id: String(raw.id ?? ''), dbNumber: string('dbNumber'), inventoryNumber: string('inventoryNumber'),
    bibliographicId: string('bibliographicId'), author: string('author'), title: string('title'),
    titleFull: string('titleFull'), edition: string('edition'), publicationPlace: string('publicationPlace'),
    publisher: string('publisher'), year: string('year'), physicalDescription: string('physicalDescription'),
    subjects: string('subjects'), keywords: string('keywords'), classification: string('classification'),
    shelfmark: string('shelfmark'), notes: string('notes'), location: string('location'),
    accountingStatus: string('accountingStatus'), fundType: string('fundType'), invoice: string('invoice'),
    state: string('state') === 'Списан' ? 'Списан' : 'В фонде', loanStatus: string('loanStatus') || 'В наличии',
    verified: raw.verified === true || raw.verified === 1, verifiedAt: string('verifiedAt') || undefined,
    deleted: Boolean(raw.deletedAt),
  };
}

type WebModelContext = {
  registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

async function apiRequest(url: string, init: RequestInit, setNotice: (message: string) => void) {
  try {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
    if (response.ok) return true;
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setNotice(payload.error || 'Не удалось сохранить изменение.');
  } catch {
    setNotice('Нет связи с базой. Изменение не сохранено.');
  }
  return false;
}
