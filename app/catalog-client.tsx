'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpFromLine, BookOpen, CheckCircle2, CircleAlert, CirclePlus, Download, History, Library, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  getOutboxCounts,
  replayPendingMutations,
  submitMutation,
} from './outbox';
import type { MutationResult } from './outbox';

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
  updatedAt?: string;
  deleted: boolean;
  revision: number;
};

type LoanEntry = {
  id: string; readerId: string; readerNote: string; loanDate: string;
  returnDate: string; returnNote: string; issuedBy: string; returnedBy: string;
};

const sampleRecords: CatalogRecord[] = [
  { id: '1', dbNumber: '712', bibliographicId: '2', inventoryNumber: '009985', author: 'Абелев Ю.', title: 'Сборник детских пьес для фортепиано', titleFull: 'Сборник детских пьес для фортепиано', edition: '', publicationPlace: 'Москва', publisher: 'Музгиз', year: '1940', physicalDescription: '28 с.', subjects: 'Фортепианная музыка', keywords: 'Ф.п.пьесы', classification: 'Ф.п.Сб.авт.', shelfmark: 'А 14', notes: 'Фортепианная музыка', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: 'Без накл.73', state: 'В фонде', loanStatus: 'В наличии', verified: true, verifiedAt: '12.09.2026', deleted: false, revision: 1 },
  { id: '2', dbNumber: '713', bibliographicId: '3', inventoryNumber: '004061', author: 'Абелиович', title: 'Три пьесы для скрипки и фортепиано', titleFull: 'Три пьесы для скрипки и фортепиано', edition: '', publicationPlace: '', publisher: '', year: '1962', physicalDescription: '', subjects: 'Камерная музыка. Струнные смычковые с ф.п.', keywords: 'Скрипка.Пьесы', classification: 'Скрипка.Сб.авт.', shelfmark: 'А 14', notes: 'Камерная музыка', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: 'Без накл.', state: 'В фонде', loanStatus: 'В наличии', verified: false, deleted: false, revision: 1 },
  { id: '3', dbNumber: '714', bibliographicId: '4', inventoryNumber: '000438', author: 'Абелян Л.', title: 'Забавное сольфеджио', titleFull: 'Забавное сольфеджио; учебное пособие для детей', edition: 'Учебное пособие', publicationPlace: 'Москва', publisher: 'Сов. композитор', year: '1982', physicalDescription: '60 с.', subjects: 'Сольфеджио', keywords: 'Сольфеджио', classification: 'V.6.', shelfmark: 'А 14', notes: 'Теоретическая литература', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: 'Без накл.', state: 'В фонде', loanStatus: 'Выдана', verified: true, verifiedAt: '12.09.2026', deleted: false, revision: 1 },
  { id: '4', dbNumber: '727', bibliographicId: '17', inventoryNumber: '000443', author: 'Агажанов А.', title: 'Курс сольфеджио', titleFull: 'Курс сольфеджио', edition: '', publicationPlace: 'Москва', publisher: 'Музыка', year: '1974', physicalDescription: '', subjects: 'Сольфеджио', keywords: '', classification: '', shelfmark: 'А 15', notes: '', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: '', state: 'В фонде', loanStatus: 'В наличии', verified: false, deleted: false, revision: 1 },
  { id: '5', dbNumber: '2508', bibliographicId: '1767', inventoryNumber: '005014', author: '', title: 'Золотая лира', titleFull: 'Золотая лира', edition: '', publicationPlace: 'Москва', publisher: 'Музыка', year: '1987', physicalDescription: '', subjects: '', keywords: '', classification: '', shelfmark: '', notes: '', location: 'Абонемент', accountingStatus: 'Баланс', fundType: 'КСУ общ.фонда', invoice: '', state: 'Списан', loanStatus: 'Списан', verified: false, deleted: false, revision: 1 },
];

const searchFields = [
  ['all', 'Все поля'], ['author', 'Автор'], ['title', 'Заглавие'],
  ['inventoryNumber', 'Инвентарный номер'], ['dbNumber', '№ записи в БД'],
] as const;

function searchFieldLabel(value: string) {
  return searchFields.find(([key]) => key === value)?.[1] ?? 'Все поля';
}

const CATALOG_PAGE_SIZE = 200;
type CatalogSort = 'author' | 'updated';
type CatalogSortDirection = 'asc' | 'desc';

function catalogSortLabel(value: CatalogSort) {
  return value === 'updated'
    ? 'Последние изменения'
    : 'По автору и заглавию';
}

function catalogSortDirectionLabel(
  sort: CatalogSort,
  direction: CatalogSortDirection,
) {
  if (sort === 'updated') {
    return direction === 'desc'
      ? 'Сначала новые'
      : 'Сначала старые';
  }

  return direction === 'desc'
    ? 'Я → А'
    : 'А → Я';
}

const updatedAtFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatUpdatedAt(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : updatedAtFormatter.format(date);
}

export function CatalogClient({ userName }: { userName: string }) {
  const [records, setRecords] = useState(sampleRecords);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [serverStats, setServerStats] = useState<{ total: number; active: number; verified: number } | null>(null);
  const [query, setQuery] = useState('');
  const [field, setField] = useState('all');
  const [showWrittenOff, setShowWrittenOff] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortMode, setSortMode] = useState<CatalogSort>('author');
  const [sortDirection, setSortDirection] =
    useState<CatalogSortDirection>('asc');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const catalogRequestGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] =
    useState<CatalogRecord | null>(null);
  const [recordCache, setRecordCache] =
    useState<Record<string, CatalogRecord>>({});
  const openRecordRequest = useRef(0);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState('Демонстрационный режим: полный каталог ещё не импортирован.');
  const [actionNotice, setActionNotice] = useState('');
  const [actionNoticeKind, setActionNoticeKind] =
    useState<'success' | 'error'>('success');
  const [syncCounts, setSyncCounts] = useState({ pending: 0, conflict: 0, failed: 0 });
  const [syncEpoch, setSyncEpoch] = useState(0);

  useEffect(() => {
    if (!actionNotice) return;

    const timer = window.setTimeout(() => {
      setActionNotice('');
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const confirmAction = (message: string) => {
    setNotice(message);
    setActionNoticeKind('success');
    setActionNotice(message);
  };

  const reportActionError = (message: string) => {
    setNotice(message);
    setActionNoticeKind('error');
    setActionNotice(message);
  };

  const refreshOutboxState = async () => {
    setSyncCounts(await getOutboxCounts());
  };

  const synchronize = async () => {
    const results = await replayPendingMutations();
    await refreshOutboxState();
    if (results.some((result) => result.kind === 'synced')) {
      setRecordCache({});
      setSyncEpoch((value) => value + 1);
    }
    const conflict = results.find((result) => result.kind === 'conflict');
    if (conflict) {
      reportActionError(
        String(conflict.payload?.message ?? 'Обнаружен конфликт. Откройте карточку заново.'),
      );
    }
  };

  useEffect(() => {
    void refreshOutboxState();
    if (navigator.onLine) void synchronize();
    const onOnline = () => { void synchronize(); };
    const onOutboxChanged = () => { void refreshOutboxState(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('mlc-outbox-changed', onOutboxChanged);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('mlc-outbox-changed', onOutboxChanged);
    };
  }, []);

  useEffect(() => {
    if (apiAvailable === false) return;
    const controller = new AbortController();
    const generation = ++catalogRequestGeneration.current;
    const trimmedQuery = query.trim();
    const exactIdentifierField =
      field === 'inventoryNumber' || field === 'dbNumber';

    loadingMoreRef.current = false;
    setLoadingMore(false);

    if (
      trimmedQuery &&
      !exactIdentifierField &&
      trimmedQuery.length < 3
    ) {
      setRecords([]);
      setHasMore(false);
      setNextOffset(0);
      setNotice('Введите не менее 3 символов для общего поиска.');
      return () => controller.abort();
    }

    const delay = exactIdentifierField ? 0 : 450;

    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        q: trimmedQuery,
        field,
        writtenOff: showWrittenOff ? '1' : '0',
        trash: showDeleted ? '1' : '0',
        sort: sortMode,
        direction: sortDirection,
        limit: String(CATALOG_PAGE_SIZE),
        offset: '0',
      });
      try {
        const response = await fetch(`/api/catalog?${params}`, { signal: controller.signal });
        if (response.status === 401) {
          setApiAvailable(false);
          setHasMore(false);
          setNextOffset(0);
          setNotice('Локальная демонстрация: изменения сохраняются только до обновления страницы.');
          return;
        }
        if (!response.ok) throw new Error('catalog request failed');
        const payload = await response.json() as {
          items: Array<Record<string, unknown>>;
          stats?: { total?: number; active?: number; verified?: number } | null;
        };

        if (generation !== catalogRequestGeneration.current) return;

        const firstPage = payload.items.map(normalizeRecord);
        setRecords(firstPage);
        setNextOffset(firstPage.length);
        setHasMore(firstPage.length === CATALOG_PAGE_SIZE);

        if (payload.stats) {
          const total = Number(payload.stats.total ?? 0);
          setServerStats({
            total,
            active: Number(payload.stats.active ?? 0),
            verified: Number(payload.stats.verified ?? 0),
          });
          setNotice(
            total > 0
              ? 'Рабочая база подключена. Изменения сохраняются автоматически.'
              : 'Рабочая база подключена. Каталог пока пуст.',
          );
        }

        setApiAvailable(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setNotice('Не удалось связаться с базой. Повторите попытку через несколько секунд.');
        }
      }
    }, delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [apiAvailable, field, query, showDeleted, showWrittenOff, sortDirection, sortMode, syncEpoch]);

  const loadMoreCatalog = async () => {
    if (apiAvailable !== true || !hasMore || loadingMoreRef.current) return;

    const trimmedQuery = query.trim();
    const exactIdentifierField =
      field === 'inventoryNumber' || field === 'dbNumber';

    if (trimmedQuery && !exactIdentifierField && trimmedQuery.length < 3) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const generation = catalogRequestGeneration.current;
    const offset = nextOffset;
    const params = new URLSearchParams({
      q: trimmedQuery,
      field,
      writtenOff: showWrittenOff ? '1' : '0',
      trash: showDeleted ? '1' : '0',
      sort: sortMode,
      direction: sortDirection,
      limit: String(CATALOG_PAGE_SIZE),
      offset: String(offset),
    });

    try {
      const response = await fetch(`/api/catalog?${params}`);
      if (!response.ok) throw new Error('catalog page request failed');
      const payload = await response.json() as { items: Array<Record<string, unknown>> };
      if (generation !== catalogRequestGeneration.current) return;

      const page = payload.items.map(normalizeRecord);
      setRecords((current) => {
        const existing = new Set(current.map((record) => record.id));
        return [...current, ...page.filter((record) => !existing.has(record.id))];
      });
      setNextOffset(offset + page.length);
      setHasMore(page.length === CATALOG_PAGE_SIZE);
    } catch {
      if (generation === catalogRequestGeneration.current) {
        reportActionError('Не удалось подгрузить следующую часть каталога.');
      }
    } finally {
      loadingMoreRef.current = false;
      if (generation === catalogRequestGeneration.current) setLoadingMore(false);
    }
  };

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

  const selected = selectedRecord;
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    const filtered = records.filter((record) => {
      if (showDeleted ? !record.deleted : record.deleted) return false;
      if (!showWrittenOff && record.state === 'Списан') return false;
      if (!needle) return true;
      const values = field === 'all' ? Object.values(record) : [record[field as keyof CatalogRecord]];
      return values.some((value) => String(value).toLocaleLowerCase('ru').includes(needle));
    });
    const direction = sortDirection === 'desc' ? -1 : 1;

    return [...filtered].sort((left, right) => {
      if (sortMode === 'updated') {
        const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
        const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
        if (leftTime !== rightTime) {
          return (leftTime - rightTime) * direction;
        }
        return (Number(left.id) - Number(right.id)) * direction;
      }

      const authorCompare = left.author.localeCompare(
        right.author,
        'ru',
        { sensitivity: 'base' },
      );
      if (authorCompare !== 0) return authorCompare * direction;

      const titleCompare = left.title.localeCompare(
        right.title,
        'ru',
        { sensitivity: 'base' },
      );
      if (titleCompare !== 0) return titleCompare * direction;

      return (Number(left.id) - Number(right.id)) * direction;
    });
  }, [field, query, records, showDeleted, showWrittenOff, sortDirection, sortMode]);

  const openRecord = async (recordId: string) => {
    const requestGeneration = ++openRecordRequest.current;

    setSelectedId(recordId);
    setSelectedRecord(null);

    const cached = recordCache[recordId];
    if (cached) {
      if (requestGeneration === openRecordRequest.current) {
        setSelectedRecord(cached);
      }
      return;
    }

    const listRecord =
      records.find((record) => record.id === recordId) ?? null;

    if (!apiAvailable) {
      setSelectedRecord(listRecord);
      return;
    }

    try {
      const response = await fetch(`/api/catalog/${recordId}`);

      if (!response.ok) {
        throw new Error('record request failed');
      }

      const payload = await response.json() as {
        record: Record<string, unknown>;
      };

      const fullRecord = normalizeRecord(payload.record);

      setRecordCache((current) => ({
        ...current,
        [recordId]: fullRecord,
      }));

      if (requestGeneration === openRecordRequest.current) {
        setSelectedRecord(fullRecord);
      }
    } catch {
      if (requestGeneration === openRecordRequest.current) {
        setSelectedRecord(listRecord);
        reportActionError(
          'Не удалось загрузить полную карточку. Показаны доступные данные.',
        );
      }
    }
  };

  const closeRecord = () => {
    ++openRecordRequest.current;
    setSelectedId(null);
    setSelectedRecord(null);
  };

  const mutationAccepted = async (
    result: MutationResult,
    recordId?: string,
  ) => {
    await refreshOutboxState();
    if (result.kind === 'conflict') {
      if (recordId) {
        setRecordCache((current) => {
          const next = { ...current };
          delete next[recordId];
          return next;
        });
      }
      reportActionError(
        String(result.payload?.message ?? 'Карточка изменилась в другом сеансе. Откройте её заново.'),
      );
      return false;
    }
    if (result.kind === 'failed') {
      reportActionError(
        String(result.payload?.message ?? result.payload?.error ?? 'Изменение отклонено сервером.'),
      );
      return false;
    }
    return true;
  };

  const applyRecordPatch = (
    recordId: string,
    patch: Partial<CatalogRecord>,
  ) => {
    const stampedPatch = {
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    setRecords((current) => current.map((record) =>
      record.id === recordId ? { ...record, ...stampedPatch } : record,
    ));
    setSelectedRecord((current) =>
      current?.id === recordId ? { ...current, ...stampedPatch } : current,
    );
    setRecordCache((current) => current[recordId]
      ? { ...current, [recordId]: { ...current[recordId], ...stampedPatch } }
      : current,
    );
  };

  const saveRecord = async (next: CatalogRecord) => {
    const result = await submitMutation({
      entityType: 'catalog_record',
      entityId: next.id,
      operationType: 'catalog_update',
      baseRevision: next.revision,
      method: 'PATCH',
      url: `/api/catalog/${next.id}`,
      payload: { ...next, baseRevision: next.revision },
    });
    if (!await mutationAccepted(result, next.id)) return;
    const revision = Number(result.payload?.revision ?? next.revision + 1);
    const saved = {
      ...next,
      verified: next.verified,
      verifiedAt: next.verifiedAt,
      deleted: next.deleted,
      loanStatus: next.loanStatus,
      updatedAt: new Date().toISOString(),
      revision,
    };

    setRecords((current) =>
      current.map((record) =>
        record.id === next.id
          ? {
              ...record,
              ...saved,
            }
          : record,
      ),
    );

    setSelectedRecord(saved);
    setRecordCache((current) => ({
      ...current,
      [next.id]: saved,
    }));

    confirmAction(result.kind === 'queued'
      ? 'Изменение сохранено на этом устройстве и ожидает синхронизации.'
      : `Карточка ${next.inventoryNumber || next.dbNumber || 'без номера'} сохранена.`);
  };
  const toggleVerifiedRecord = async (record: CatalogRecord) => {
    const verified = !record.verified;
    const result = await submitMutation({
      entityType: 'catalog_record', entityId: record.id,
      operationType: 'catalog_verify', baseRevision: record.revision,
      method: 'POST', url: `/api/catalog/${record.id}/verify`,
      payload: { verified, baseRevision: record.revision },
    });
    if (!await mutationAccepted(result, record.id)) return;
    const next = {
      ...record,
      verified,
      verifiedAt: verified ? new Date().toLocaleDateString('ru-RU') : undefined,
      updatedAt: new Date().toISOString(),
      revision: Number(result.payload?.revision ?? record.revision + 1),
    };
    setRecords((current) =>
      current.map((item) => item.id === next.id ? next : item)
    );
    setSelectedRecord(next);
    setRecordCache((current) => ({
      ...current,
      [next.id]: next,
    }));
    setServerStats((current) => current ? { ...current, verified: Math.max(0, current.verified + (verified ? 1 : -1)) } : null);
    confirmAction(result.kind === 'queued'
      ? 'Отметка сохранена на этом устройстве и ожидает синхронизации.'
      :
      verified
        ? `Карточка № ${record.dbNumber || 'без номера'} проверена.`
        : `Отметка «Проверено» снята с карточки № ${record.dbNumber || 'без номера'}.`);
  };
  const deleteRecord = async (record: CatalogRecord) => {
    const result = await submitMutation({
      entityType: 'catalog_record', entityId: record.id,
      operationType: 'catalog_delete', baseRevision: record.revision,
      method: 'DELETE', url: `/api/catalog/${record.id}`,
      payload: { baseRevision: record.revision },
    });
    if (!await mutationAccepted(result, record.id)) return;
    applyRecordPatch(record.id, {
      deleted: true,
      revision: Number(result.payload?.revision ?? record.revision + 1),
    });
    closeRecord();
    confirmAction(result.kind === 'queued'
      ? 'Удаление сохранено на этом устройстве и ожидает синхронизации.'
      : 'Карточка перемещена в корзину. Её можно восстановить.');
  };
  const purgeRecord = async (record: CatalogRecord) => {
    if (!apiAvailable) {
      reportActionError('Окончательное удаление требует устойчивого соединения с сервером.');
      return;
    }
    if (
      !await apiRequest(
        `/api/catalog/${record.id}/permanent`,
        { method: 'DELETE' },
        reportActionError,
      )
    ) {
      return;
    }

    setRecords((current) =>
      current.filter((item) => item.id !== record.id)
    );

    closeRecord();
    setRecordCache((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
    confirmAction('Запись удалена окончательно.');
  };

  const restoreRecord = async (record: CatalogRecord) => {
    const result = await submitMutation({
      entityType: 'catalog_record', entityId: record.id,
      operationType: 'catalog_restore', baseRevision: record.revision,
      method: 'POST', url: `/api/catalog/${record.id}/restore`,
      payload: { baseRevision: record.revision },
    });
    if (!await mutationAccepted(result, record.id)) return;
    applyRecordPatch(record.id, {
      deleted: false,
      revision: Number(result.payload?.revision ?? record.revision + 1),
    });
    closeRecord();
    confirmAction(result.kind === 'queued'
      ? 'Восстановление сохранено на этом устройстве и ожидает синхронизации.'
      : 'Карточка восстановлена в каталоге.');
  };
  const updateLoanStatus = (recordId: string, loanStatus: string, revision: number) => {
    applyRecordPatch(recordId, { loanStatus, revision });
  };
  const addRecord = async (next: CatalogRecord) => {
    const prepared: CatalogRecord = {
      ...next,
      id: crypto.randomUUID(),
      dbNumber: '',
      inventoryNumber: next.inventoryNumber.trim(),
      state: 'В фонде',
      loanStatus: 'В наличии',
      verified: false,
      verifiedAt: undefined,
      updatedAt: new Date().toISOString(),
      deleted: false,
      revision: 1,
    };

    if (!prepared.inventoryNumber) {
      reportActionError('Укажите инвентарный номер нового экземпляра.');
      return false;
    }

    const result = await submitMutation({
      entityType: 'catalog_record',
      operationType: 'catalog_create',
      method: 'POST',
      url: '/api/catalog',
      payload: prepared,
    });

    if (!await mutationAccepted(result)) return false;

    const saved = result.kind === 'synced' && result.payload?.record
      ? normalizeRecord(result.payload.record as Record<string, unknown>)
      : prepared;

    setRecords((current) =>
      sortMode === 'updated'
        ? [saved, ...current]
        : [...current, saved],
    );

    setServerStats((current) => current
      ? {
          ...current,
          total: current.total + 1,
          active: current.active + 1,
        }
      : current,
    );

    setRecordCache((current) => ({
      ...current,
      [saved.id]: saved,
    }));

    setAddOpen(false);

    if (result.kind === 'synced') {
      setSelectedId(saved.id);
      setSelectedRecord(saved);
    }

    confirmAction(result.kind === 'queued'
      ? `Новый экземпляр ${saved.inventoryNumber} сохранён на этом устройстве и ожидает синхронизации.`
      : `Экземпляр ${saved.inventoryNumber} добавлен. Карточка открыта для проверки.`);

    return true;
  };
  const exportCsv = async () => {
    try {
      const response = await fetch('/api/export/catalog.csv');
      if (!response.ok) throw new Error('export_failed');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await response.blob());
      link.download = 'library_catalog_full.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      confirmAction('Полная выгрузка каталога подготовлена.');
    } catch {
      reportActionError('Не удалось подготовить полную выгрузку каталога.');
    }
  };

  const activeCount = serverStats?.active ?? records.filter((record) => !record.deleted && record.state === 'В фонде').length;
  const verifiedCount = serverStats?.verified ?? records.filter((record) => !record.deleted && record.verified).length;
  const totalCount = serverStats?.total ?? records.filter((record) => !record.deleted).length;

  const noticeIsSuccess = apiAvailable === true && (
    notice.includes('сохранена') ||
    notice.includes('проверена') ||
    notice.includes('снята') ||
    notice.includes('добавлен') ||
    notice.includes('восстановлена') ||
    notice.includes('перемещена') ||
    notice.includes('Рабочая база подключена')
  );

  return <main className="min-h-screen bg-background text-foreground">
    <header className="library-header border-b px-5 py-4 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Library className="size-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              Электронный каталог
            </h1>
            <p className="text-sm text-muted-foreground">
              Библиотека музыкальной школы
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge
            variant="outline"
            className={
              syncCounts.conflict > 0 || syncCounts.failed > 0
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : syncCounts.pending > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800'
            }
            title="Изменения обычно отправляются на сервер автоматически. Ручная отправка нужна только для ожидающих изменений."
          >
            {syncCounts.conflict > 0
              ? `Конфликт: ${syncCounts.conflict}`
              : syncCounts.failed > 0
                ? `Ошибка сохранения: ${syncCounts.failed}`
                : syncCounts.pending > 0
                  ? `Ожидает отправки: ${syncCounts.pending}`
                  : 'Синхронизировано'}
          </Badge>

          {syncCounts.pending > 0 && (
            <Button
              variant="outline"
              size="sm"
              title="Повторно отправить на сервер изменения, сохранённые на этом устройстве."
              onClick={() => void synchronize()}
            >
              Отправить ожидающие
            </Button>
          )}

          <Badge
            variant="outline"
            className="hidden h-7 gap-1.5 px-3 sm:flex"
          >
            <ShieldCheck /> {userName}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = '/api/auth/logout';
            }}
          >
            Выйти
          </Button>
        </div>
      </div>
    </header>
    <section className="mx-auto max-w-[1600px] p-4 lg:p-8">
      <div className={noticeIsSuccess ? 'mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950' : 'mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950'} role="status">{notice}</div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><Summary label="Экземпляров" value={String(totalCount)} muted={apiAvailable ? undefined : 'в демонстрации'} /><Summary label="В фонде" value={String(activeCount)} /><Summary label="Проверено" value={String(verifiedCount)} /></div>
      <InventoryPanel
        onOpenRecord={(recordId) => { void openRecord(recordId); }}
        onNotice={confirmAction}
        onError={reportActionError}
      />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Автор, заглавие, номер…" className="h-11 pl-10 text-base" aria-label="Поиск по каталогу" /></div>
          <Select value={field} onValueChange={(value) => value && setField(value)}>
            <SelectTrigger className="h-11 w-full xl:w-56" aria-label="Поле поиска">
              <span className="flex-1 text-left">{searchFieldLabel(field)}</span>
            </SelectTrigger>
            <SelectContent>
              {searchFields.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm"><Checkbox checked={showWrittenOff} onCheckedChange={setShowWrittenOff} />Списанные</label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm"><Checkbox checked={showDeleted} onCheckedChange={setShowDeleted} />Корзина</label>
          <div className="flex w-full gap-2 xl:w-auto">
            <Select
              value={sortMode}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as CatalogSort;
                setSortMode(next);
                setSortDirection(next === 'updated' ? 'desc' : 'asc');
              }}
            >
              <SelectTrigger className="h-11 flex-1 xl:w-56" aria-label="Сортировка каталога">
                <span className="flex-1 text-left">{catalogSortLabel(sortMode)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="author">По автору и заглавию</SelectItem>
                <SelectItem value="updated">Последние изменения</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="h-11 min-w-11"
              aria-label={`Порядок сортировки: ${catalogSortDirectionLabel(sortMode, sortDirection)}`}
              title={`Порядок сортировки: ${catalogSortDirectionLabel(sortMode, sortDirection)}`}
              onClick={() => setSortDirection((current) =>
                current === 'asc' ? 'desc' : 'asc'
              )}
            >
              {sortDirection === 'asc'
                ? <ArrowUp />
                : <ArrowDown />}
            </Button>
          </div>
          <Button className="h-11 gap-2" onClick={() => setAddOpen(true)}><CirclePlus /> Добавить</Button>
          <details className="relative">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary shadow-sm hover:bg-primary/15 [&::-webkit-details-marker]:hidden">
              <Download /> Экспорт каталога
            </summary>
            <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border bg-popover p-3 shadow-lg">
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Выгрузка полного каталога в CSV.
              </p>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={exportCsv}
              >
                <Download /> Скачать каталог CSV
              </Button>
            </div>
          </details>
        </div>
        <div className="flex items-center justify-between border-b bg-muted/35 px-4 py-2.5 text-sm text-muted-foreground">
          <span>Загружено: <strong className="text-foreground">{visible.length}</strong>{hasMore ? ' · прокрутите вниз для продолжения' : ''}</span>
          <span className="hidden sm:inline">Нажмите на строку, чтобы открыть карточку</span>
        </div>
        <div
          className="max-h-[65vh] overflow-auto"
          onScroll={(event) => {
            const element = event.currentTarget;
            if (element.scrollHeight - element.scrollTop - element.clientHeight < 320) {
              void loadMoreCatalog();
            }
          }}
        >
          <Table containerClassName="overflow-visible">
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-card [&_th]:shadow-[0_1px_0_hsl(var(--border))]">
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="w-36 pl-4">Инвентарный номер</TableHead>
                <TableHead className="w-28">№ записи в БД</TableHead>
                <TableHead className="w-28">Проверено</TableHead>
                <TableHead>Автор</TableHead>
                <TableHead className="min-w-72">Заглавие</TableHead>
                <TableHead>Год</TableHead>
                <TableHead className="min-w-40">Изменено</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((record) => (
                <TableRow key={record.id} tabIndex={0} role="button"
                  onClick={() => void openRecord(record.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') void openRecord(record.id); }}
                  className="cursor-pointer focus-visible:bg-accent focus-visible:outline-none">
                  <TableCell className="pl-4 font-mono text-sm font-semibold">{record.inventoryNumber || '—'}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{record.dbNumber || '—'}</TableCell>
                  <TableCell>{record.verified ? <Badge className="gap-1 bg-emerald-700"><CheckCircle2 /> Проверено</Badge> : <span className="text-muted-foreground">Нет</span>}</TableCell>
                  <TableCell className="font-medium">{record.author || 'Без автора'}</TableCell>
                  <TableCell className="max-w-md whitespace-normal font-medium">{record.title}</TableCell>
                  <TableCell>{record.year || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatUpdatedAt(record.updatedAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={loanStatusClass(record.loanStatus, {
                      deleted: record.deleted,
                      writtenOff: record.state === 'Списан',
                    })}>
                      {record.deleted ? 'В корзине' : record.loanStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loadingMore && <div className="border-t px-4 py-3 text-center text-sm text-muted-foreground">Загружается следующая часть каталога…</div>}
          {!hasMore && visible.length > 0 && <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground">Все доступные записи загружены.</div>}
        </div>
      </div>
    </section>
    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) closeRecord(); }}><SheetContent className="overflow-y-auto" style={{ width: 'min(96vw, 1480px)', maxWidth: 'none' }}>{selected && <RecordCard key={selected.id} record={selected} apiAvailable={apiAvailable === true} onSave={saveRecord} onToggleVerified={toggleVerifiedRecord} onDelete={deleteRecord} onRestore={restoreRecord} onPurge={purgeRecord} onLoanChange={updateLoanStatus} onLoanNotice={confirmAction} />}</SheetContent></Sheet>
    <AddCopyDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addRecord} />

    {actionNotice && (
      <div
        className={
          actionNoticeKind === 'success'
            ? 'pointer-events-none fixed left-1/2 top-6 z-[9999] w-[min(92vw,32rem)] -translate-x-1/2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-lg'
            : 'pointer-events-none fixed left-1/2 top-6 z-[9999] w-[min(92vw,32rem)] -translate-x-1/2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-950 shadow-lg'
        }
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          {actionNoticeKind === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
          ) : (
            <CircleAlert className="size-4 shrink-0 text-rose-700" />
          )}
          <span>{actionNotice}</span>
        </div>
      </div>
    )}

  </main>;
}


function loanStatusClass(
  status: string,
  options?: {
    deleted?: boolean;
    writtenOff?: boolean;
  },
) {
  if (options?.deleted) {
    return 'border-slate-300 bg-slate-100/80 text-slate-700';
  }

  if (options?.writtenOff) {
    return 'border-red-300 bg-red-50/80 text-red-800';
  }

  if (status === 'Выдана' || status === 'Книга выдана') {
    return 'border-amber-300 bg-amber-50/80 text-amber-800';
  }

  return 'border-emerald-300 bg-emerald-50/80 text-emerald-800';
}

function Summary({ label, value, muted }: { label: string; value: string; muted?: string }) { return <div className="rounded-xl border bg-card px-5 py-4 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-2xl font-semibold">{value}</strong>{muted && <span className="text-xs text-muted-foreground">{muted}</span>}</div></div>; }

type InventorySession = {
  id: string;
  name: string;
  status: string;
  seenCount: number;
};

function InventoryPanel({
  onOpenRecord,
  onNotice,
  onError,
}: {
  onOpenRecord: (recordId: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [session, setSession] = useState<InventorySession | null>(null);
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [candidates, setCandidates] = useState<CatalogRecord[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/inventory/current')
      .then(async (response) => response.ok
        ? response.json() as Promise<{ session: InventorySession | null }>
        : { session: null })
      .then((payload) => setSession(payload.session))
      .catch(() => undefined);
  }, []);

  const startSession = async () => {
    const sessionId = crypto.randomUUID();
    const created: InventorySession = {
      id: sessionId,
      name: `Инвентаризация ${new Date().toLocaleDateString('ru-RU')}`,
      status: 'open',
      seenCount: 0,
    };
    const result = await submitMutation({
      entityType: 'inventory_session', entityId: sessionId,
      operationType: 'inventory_session_create', method: 'POST',
      url: '/api/inventory/sessions',
      payload: { sessionId, name: created.name },
    });
    if (result.kind === 'failed' || result.kind === 'conflict') {
      onError(String(result.payload?.message ?? 'Не удалось начать инвентаризацию.'));
      return;
    }
    setSession(created);
    onNotice(result.kind === 'queued'
      ? 'Инвентаризация создана на этом устройстве и ожидает синхронизации.'
      : 'Инвентаризация начата.');
  };

  const markSeen = async (record: CatalogRecord) => {
    if (!enabled) {
      onError('Сначала включите режим инвентаризации.');
      return;
    }

    if (!session || seenIds.has(record.id)) {
      onNotice('Этот экземпляр уже отмечен в текущей инвентаризации.');
      return;
    }
    const result = await submitMutation({
      entityType: 'inventory_event', entityId: record.id,
      operationType: 'inventory_seen', method: 'POST',
      url: '/api/inventory/seen',
      payload: { sessionId: session.id, recordId: record.id },
    });
    if (result.kind === 'failed' || result.kind === 'conflict') {
      onError(String(result.payload?.message ?? 'Не удалось отметить экземпляр.'));
      return;
    }
    setSeenIds((current) => new Set(current).add(record.id));
    setSession((current) => current
      ? { ...current, seenCount: current.seenCount + (result.payload?.duplicate ? 0 : 1) }
      : current,
    );
    setCandidates([]);
    setInventoryNumber('');
    onNotice(result.kind === 'queued'
      ? 'Отметка сохранена на этом устройстве и ожидает синхронизации.'
      : result.payload?.duplicate
        ? 'Этот экземпляр уже отмечен в текущей инвентаризации.'
        : `Экземпляр ${record.inventoryNumber || record.dbNumber} отмечен.`);
  };

  const lookup = async () => {
    const value = inventoryNumber.trim();
    if (!enabled || !value || !session) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({
        q: value,
        field: 'inventoryNumber',
        writtenOff: '1',
        limit: '200',
      });
      const response = await fetch(`/api/catalog?${params}`);
      if (!response.ok) throw new Error('lookup_failed');
      const payload = await response.json() as { items: Array<Record<string, unknown>> };
      const matches = payload.items.map(normalizeRecord);
      if (matches.length === 0) {
        setCandidates([]);
        onError('Экземпляр с таким инвентарным номером не найден.');
      } else if (matches.length === 1) {
        onOpenRecord(matches[0].id);
        await markSeen(matches[0]);
      } else {
        setCandidates(matches);
        onNotice(`Найдено несколько экземпляров: ${matches.length}. Выберите нужный.`);
      }
    } catch {
      onError('Для поиска экземпляра требуется связь с сервером.');
    } finally {
      setBusy(false);
    }
  };

  const exportEvents = () => {
    window.location.href = '/api/export/inventory.csv';
  };

  if (!enabled) {
    return (
      <section className="mb-5 rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Инвентаризация</h2>
            <p className="text-sm text-muted-foreground">
              {session
                ? `Режим выключен · ${session.name} · отмечено: ${session.seenCount}`
                : 'Режим выключен'}
            </p>
          </div>
          <Button variant="outline" onClick={() => setEnabled(true)}>
            Включить режим
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-2xl border border-amber-300 bg-amber-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Инвентаризация</h2>
            <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-900">
              Режим включён
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {session
              ? `${session.name} · отмечено: ${session.seenCount}`
              : 'Активная инвентаризация не начата'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!session && <Button onClick={() => void startSession()}>Начать</Button>}
          <Button variant="outline" onClick={exportEvents}>
            <Download /> События CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEnabled(false);
              setInventoryNumber('');
              setCandidates([]);
            }}
          >
            Выключить режим
          </Button>
        </div>
      </div>

      {session && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={inventoryNumber}
            autoComplete="off"
            autoFocus
            placeholder="Сканируйте или введите инвентарный номер"
            aria-label="Инвентарный номер для инвентаризации"
            onChange={(event) => setInventoryNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void lookup();
            }}
          />
          <Button
            disabled={busy || !inventoryNumber.trim()}
            onClick={() => void lookup()}
          >
            Найти и отметить
          </Button>
        </div>
      )}

      {candidates.length > 1 && (
        <div className="mt-3 grid gap-2">
          {candidates.map((record) => (
            <button
              key={record.id}
              type="button"
              className="rounded-lg border bg-background px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                onOpenRecord(record.id);
                void markSeen(record);
              }}
            >
              <strong>{record.inventoryNumber}</strong>
              {' · '}
              {record.author || 'Без автора'}
              {' · '}
              {record.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function RecordCard({ record, apiAvailable, onSave, onToggleVerified, onDelete, onRestore, onPurge, onLoanChange, onLoanNotice }: { record: CatalogRecord; apiAvailable: boolean; onSave: (record: CatalogRecord) => void; onToggleVerified: (record: CatalogRecord) => void; onDelete: (record: CatalogRecord) => void; onRestore: (record: CatalogRecord) => void; onPurge: (record: CatalogRecord) => void; onLoanChange: (recordId: string, status: string, revision: number) => void; onLoanNotice: (message: string) => void }) {
  const [draft, setDraft] = useState(record);
  const update = (key: keyof CatalogRecord, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  useEffect(() => { setDraft((current) => ({ ...current, loanStatus: record.loanStatus })); }, [record.loanStatus]);
  return <><SheetHeader className="border-b px-6 py-5"><div className="mb-2 flex items-center gap-2"><BookOpen className="size-5 text-primary" />{record.verified && <Badge className="bg-emerald-700">Проверено{record.verifiedAt ? ` ${record.verifiedAt}` : ''}</Badge>}</div><SheetTitle className="pr-10 text-xl">Карточка экземпляра</SheetTitle><SheetDescription>{record.author || 'Без автора'} · {record.title}</SheetDescription></SheetHeader>
    <div className="px-6 pb-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Инвентарный номер" value={draft.inventoryNumber} onChange={(v) => update('inventoryNumber', v)} />
        <Field label="№ записи в БД" value={draft.dbNumber} onChange={(v) => update('dbNumber', v)} />
        <Field label="Автор" value={draft.author} onChange={(v) => update('author', v)} multiline />
        <Field label="Год издания" value={draft.year} onChange={(v) => update('year', v)} />
        <Field label="Заглавие" value={draft.title} onChange={(v) => update('title', v)} wide multiline />
        <Field label="Полные сведения" value={draft.titleFull} onChange={(v) => update('titleFull', v)} wide multiline />
        <Field label="Сведения об издании" value={draft.edition} onChange={(v) => update('edition', v)} wide multiline />
        <Field label="Издательство" value={draft.publisher} onChange={(v) => update('publisher', v)} multiline />
        <Field label="Шифр хранения" value={draft.shelfmark} onChange={(v) => update('shelfmark', v)} multiline />
        <Field label="Местонахождение" value={draft.location} onChange={(v) => update('location', v)} multiline />
        <Field label="Статус выдачи" value={draft.loanStatus} onChange={() => undefined} readOnly />
        <Field label="Темы" value={draft.subjects} onChange={(v) => update('subjects', v)} wide multiline />
        <Field label="Примечания" value={draft.notes} onChange={(v) => update('notes', v)} wide multiline />
      </div>
      <LoanPanel
        record={record}
        apiAvailable={apiAvailable}
        onStatusChange={(status, revision) => onLoanChange(record.id, status, revision)}
        onNotice={onLoanNotice}
      />
    </div>
    <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur"><div>{record.deleted ? <div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={() => onRestore(record)}><RotateCcw /> Восстановить</Button><AlertDialog><AlertDialogTrigger render={<Button variant="destructive" className="gap-2" />}><Trash2 /> Удалить окончательно</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить запись окончательно?</AlertDialogTitle><AlertDialogDescription>Запись, история её выдач и обычный журнал изменений будут удалены без возможности восстановления. В системном журнале останется только факт окончательного удаления.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => onPurge(record)}>Удалить безвозвратно</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div> : <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" className="gap-2" />}><Trash2 /> Удалить</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Переместить карточку в корзину?</AlertDialogTitle><AlertDialogDescription>Карточка исчезнет из каталога, но её можно будет восстановить.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => onDelete(record)}>Переместить в корзину</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div><div className="flex flex-wrap gap-2">{!record.deleted && <Button variant="outline" onClick={() => onToggleVerified(record)}>{record.verified ? 'Снять отметку «Проверено»' : 'Отметить проверенной'}</Button>}<Button disabled={record.deleted} onClick={() => onSave(draft)}>Сохранить изменения</Button></div></div></>;
}

function LoanPanel({ record, apiAvailable, onStatusChange, onNotice }: { record: CatalogRecord; apiAvailable: boolean; onStatusChange: (status: string, revision: number) => void; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<LoanEntry[]>(() => demoLoans(record));
  const [readerNote, setReaderNote] = useState('');
  const [readerId, setReaderId] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiAvailable) return;
    const controller = new AbortController();
    fetch(`/api/catalog/${record.id}/loans`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить журнал выдач');
        const payload = await response.json() as { items: Array<Record<string, unknown>> };
        setItems(payload.items.map(normalizeLoan));
      })
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [apiAvailable, record.id]);

  const active = items.find((item) => !item.returnDate);
  const perform = async (action: 'issue' | 'return') => {
    const note = action === 'issue' ? readerNote.trim() : returnNote.trim();
    if (!note) { setError(action === 'issue' ? 'Укажите, кому выдан экземпляр.' : 'Укажите, кто сдал экземпляр.'); return; }
    setBusy(true); setError('');
    try {
      const result = await submitMutation({
        entityType: 'catalog_record', entityId: record.id,
        operationType: action === 'issue' ? 'loan_issue' : 'loan_return',
        baseRevision: record.revision,
        method: 'POST', url: `/api/catalog/${record.id}/loans`,
        payload: { action, readerNote, readerId, returnNote, baseRevision: record.revision },
      });
      if (result.kind === 'conflict' || result.kind === 'failed') {
        throw new Error(String(
          result.payload?.message ?? result.payload?.error ?? 'Операция не сохранена',
        ));
      }
      let loan: LoanEntry;
      if (result.kind === 'synced' && result.payload?.loan) {
        loan = normalizeLoan(result.payload.loan as Record<string, unknown>);
      } else if (action === 'issue') {
        loan = { id: crypto.randomUUID(), readerId: readerId.trim(), readerNote: readerNote.trim(), loanDate: new Date().toISOString(), returnDate: '', returnNote: '', issuedBy: 'Библиотекарь', returnedBy: '' };
      } else {
        loan = { ...active!, returnDate: new Date().toISOString(), returnNote: returnNote.trim(), returnedBy: 'Библиотекарь' };
      }
      setItems((current) => action === 'issue' ? [loan, ...current] : current.map((item) => item.id === loan.id ? loan : item));
      onStatusChange(
        action === 'issue' ? 'Выдана' : 'В наличии',
        Number(result.payload?.revision ?? record.revision + 1),
      );

      onNotice(result.kind === 'queued'
        ? 'Операция сохранена на этом устройстве и ожидает синхронизации.'
        :
        action === 'issue'
          ? `Экземпляр № ${record.dbNumber || 'без номера'} выдан.`
          : `Возврат экземпляра № ${record.dbNumber || 'без номера'} принят.`);

      setReaderNote('');
      setReaderId('');
      setReturnNote('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Операция не сохранена');
    } finally {
      setBusy(false);
    }
  };

  return <section className="mt-6 rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><History className="size-5 text-primary" />Выдача и возврат</h3><p className="mt-1 text-sm text-muted-foreground">Краткая отметка о читателе и история операций</p></div><Badge
    variant="outline"
    className={loanStatusClass(
      active ? 'Книга выдана' : 'В наличии',
      {
        writtenOff: record.state === 'Списан',
      },
    )}
  >
    {active
      ? 'Книга выдана'
      : record.state === 'Списан'
        ? 'Списана'
        : 'В наличии'}
  </Badge></div>
    <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <div className="rounded-lg border bg-muted/25 p-4">{active ? <><p className="mb-3 text-sm"><strong>Сейчас у читателя:</strong> {active.readerNote || active.readerId || 'читатель не указан'}{active.readerNote && active.readerId ? ` · код ${active.readerId}` : ''}</p><Field label="Кто сдал экземпляр / примечание" value={returnNote} onChange={setReturnNote} /><Button className="mt-3 gap-2" disabled={busy || !returnNote.trim()} onClick={() => perform('return')}><ArrowDownToLine />Принять возврат</Button></> : <><div className="grid gap-3 sm:grid-cols-2"><Field label="Кому выдан экземпляр" value={readerNote} onChange={setReaderNote} /><Field label="Код читателя (необязательно)" value={readerId} onChange={setReaderId} /></div><Button className="mt-3 gap-2" disabled={busy || !readerNote.trim() || record.state === 'Списан'} onClick={() => perform('issue')}><ArrowUpFromLine />Выдать экземпляр</Button></>}</div>
      <div><p className="mb-2 text-sm font-medium">Последние операции</p>{items.length ? <div className="max-h-52 space-y-2 overflow-y-auto pr-1">{items.map((item) => <div key={item.id} className="rounded-lg border px-3 py-2 text-sm"><p><strong>Выдана:</strong> {item.readerNote || item.readerId || 'Без примечания'} · {formatLoanDate(item.loanDate)}</p><p className="text-muted-foreground">Оформил: {item.issuedBy || 'не указано'}</p>{item.returnDate ? <><p className="mt-1"><strong>Возвращена:</strong> {item.returnNote || item.readerNote || item.readerId} · {formatLoanDate(item.returnDate)}</p><p className="text-muted-foreground">Принял: {item.returnedBy || 'не указано'}</p></> : <p className="mt-1 font-medium text-amber-700">Возврат ожидается</p>}</div>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Операций пока нет.</p>}</div>
    </div>
    {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
  </section>;
}

function normalizeLoan(raw: Record<string, unknown>): LoanEntry {
  const value = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : '';
  return { id: String(raw.id ?? ''), readerId: value('readerId'), readerNote: value('readerNote'), loanDate: value('loanDate'), returnDate: value('returnDate'), returnNote: value('returnNote'), issuedBy: value('issuedBy'), returnedBy: value('returnedBy') };
}

function demoLoans(record: CatalogRecord): LoanEntry[] {
  return record.loanStatus === 'Выдана' ? [{ id: `demo-${record.id}`, readerId: '', readerNote: 'Ученик, класс фортепиано', loanDate: '2026-09-10T12:00:00.000Z', returnDate: '', returnNote: '', issuedBy: 'Библиотекарь', returnedBy: '' }] : [];
}

function formatLoanDate(value: string) {
  if (!value) return 'дата не указана';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function AutoGrowTextarea({
  value,
  onChange,
  readOnly = false,
  minHeight = 44,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(minHeight, element.scrollHeight)}px`;
  }, [minHeight, value]);

  return (
    <Textarea
      ref={ref}
      rows={1}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className={
        readOnly
          ? 'min-h-11 resize-none overflow-hidden bg-muted/50 text-base md:text-sm'
          : 'min-h-11 resize-none overflow-hidden text-base md:text-sm'
      }
    />
  );
}

function Field({
  label,
  value,
  onChange,
  wide = false,
  multiline = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  multiline?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : ''}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {multiline
        ? (
          <AutoGrowTextarea
            value={value}
            readOnly={readOnly}
            onChange={onChange}
            minHeight={44}
          />
        )
        : (
          <Input
            value={value}
            readOnly={readOnly}
            onChange={(event) => onChange(event.target.value)}
            className={readOnly ? 'h-10 bg-muted/50' : 'h-10'}
          />
        )}
    </label>
  );
}

function emptyCatalogRecord(): CatalogRecord {
  return {
    id: crypto.randomUUID(),
    dbNumber: '',
    inventoryNumber: '',
    bibliographicId: '',
    author: '',
    title: '',
    titleFull: '',
    edition: '',
    publicationPlace: '',
    publisher: '',
    year: '',
    physicalDescription: '',
    subjects: '',
    keywords: '',
    classification: '',
    shelfmark: '',
    notes: '',
    location: '',
    accountingStatus: '',
    fundType: '',
    invoice: '',
    state: 'В фонде',
    loanStatus: 'В наличии',
    verified: false,
    verifiedAt: undefined,
    updatedAt: undefined,
    deleted: false,
    revision: 1,
  };
}

function AddCopyDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (draft: CatalogRecord) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<CatalogRecord>(() => emptyCatalogRecord());
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceResults, setSourceResults] = useState<CatalogRecord[]>([]);
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const sourceSearchGeneration = useRef(0);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyCatalogRecord());
    setSourceQuery('');
    setSourceResults([]);
    setSourceLabel('');
    setSourceError('');
    setSearching(false);
    setSaving(false);
    ++sourceSearchGeneration.current;
  }, [open]);

  useEffect(() => {
    if (!open || sourceLabel) return;

    const value = sourceQuery.trim();
    const generation = ++sourceSearchGeneration.current;

    if (!value) {
      setSourceResults([]);
      setSourceError('');
      setSearching(false);
      return;
    }

    if (value.length < 2) {
      setSourceResults([]);
      setSourceError('');
      setSearching(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSourceError('');

      try {
        const params = new URLSearchParams({
          q: value,
          field: 'source',
          writtenOff: '1',
          limit: '20',
          offset: '0',
        });

        const response = await fetch(
          `/api/catalog?${params}`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error('source_search_failed');

        const payload = await response.json() as {
          items: Array<Record<string, unknown>>;
        };

        if (generation !== sourceSearchGeneration.current) return;

        const matches = payload.items
          .map(normalizeRecord)
          .slice(0, 12);

        setSourceResults(matches);
        setSourceError(
          matches.length === 0
            ? 'Подходящие карточки не найдены.'
            : '',
        );
      } catch (error) {
        if (
          (error as Error).name !== 'AbortError' &&
          generation === sourceSearchGeneration.current
        ) {
          setSourceResults([]);
          setSourceError('Не удалось выполнить поиск основы карточки.');
        }
      } finally {
        if (generation === sourceSearchGeneration.current) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, sourceLabel, sourceQuery]);

  const update = (key: keyof CatalogRecord, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const chooseSource = (source: CatalogRecord) => {
    const inventoryNumber = draft.inventoryNumber;

    setDraft({
      ...source,
      id: crypto.randomUUID(),
      dbNumber: '',
      inventoryNumber,
      state: 'В фонде',
      loanStatus: 'В наличии',
      verified: false,
      verifiedAt: undefined,
      updatedAt: undefined,
      deleted: false,
      revision: 1,
    });

    setSourceLabel(
      [
        source.inventoryNumber || 'Без инв. номера',
        source.author || 'Без автора',
        source.title || 'Без заглавия',
      ].join(' · '),
    );

    setSourceQuery('');
    setSourceResults([]);
    setSourceError('');
    ++sourceSearchGeneration.current;
  };

  const clearSource = () => {
    const inventoryNumber = draft.inventoryNumber;

    setDraft({
      ...emptyCatalogRecord(),
      inventoryNumber,
    });

    setSourceLabel('');
    setSourceQuery('');
    setSourceResults([]);
    setSourceError('');
    ++sourceSearchGeneration.current;
  };

  const submit = async () => {
    if (!draft.inventoryNumber.trim() || saving) return;

    setSaving(true);

    try {
      await onAdd({
        ...draft,
        id: crypto.randomUUID(),
        dbNumber: '',
        inventoryNumber: draft.inventoryNumber.trim(),
        state: 'В фонде',
        loanStatus: 'В наличии',
        verified: false,
        verifiedAt: undefined,
        updatedAt: undefined,
        deleted: false,
        revision: 1,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto"
        style={{ width: 'min(96vw, 1100px)', maxWidth: 'none' }}
      >
        <DialogHeader>
          <DialogTitle>Новый экземпляр</DialogTitle>
          <DialogDescription>
            Заполните карточку сразу. Инвентарный номер — основной номер экземпляра.
          </DialogDescription>
        </DialogHeader>

        <section className="rounded-xl border bg-muted/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">Основа новой карточки</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Оставьте поле пустым для чистой карточки. Если нужна копия похожей записи,
                начните вводить автора или инвентарный номер.
              </p>

              {sourceLabel && (
                <p className="mt-2 text-sm">
                  Выбрано: <strong>{sourceLabel}</strong>
                </p>
              )}
            </div>

            {sourceLabel && (
              <Button variant="outline" size="sm" onClick={clearSource}>
                Очистить основу
              </Button>
            )}
          </div>

          <div className="relative mt-4">
            <Input
              value={sourceQuery}
              disabled={Boolean(sourceLabel)}
              placeholder="Автор или инвентарный номер (необязательно)"
              aria-label="Основа новой карточки"
              autoComplete="off"
              onChange={(event) => setSourceQuery(event.target.value)}
            />

            {!sourceLabel && sourceResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                {sourceResults.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => chooseSource(record)}
                  >
                    <strong>{record.inventoryNumber || 'Без инв. номера'}</strong>
                    {' · '}
                    {record.author || 'Без автора'}
                    {' · '}
                    {record.title || 'Без заглавия'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {searching && (
            <p className="mt-2 text-sm text-muted-foreground">
              Поиск подходящих карточек…
            </p>
          )}

          {sourceError && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              {sourceError}
            </p>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Инвентарный номер"
            value={draft.inventoryNumber}
            onChange={(value) => update('inventoryNumber', value)}
          />
          <Field
            label="Автор"
            value={draft.author}
            onChange={(value) => update('author', value)}
            multiline
          />
          <Field
            label="Год издания"
            value={draft.year}
            onChange={(value) => update('year', value)}
          />
          <Field
            label="Заглавие"
            value={draft.title}
            onChange={(value) => update('title', value)}
            wide
            multiline
          />
          <Field
            label="Полные сведения"
            value={draft.titleFull}
            onChange={(value) => update('titleFull', value)}
            wide
            multiline
          />
          <Field
            label="Сведения об издании"
            value={draft.edition}
            onChange={(value) => update('edition', value)}
            wide
            multiline
          />
          <Field
            label="Издательство"
            value={draft.publisher}
            onChange={(value) => update('publisher', value)}
            multiline
          />
          <Field
            label="Шифр хранения"
            value={draft.shelfmark}
            onChange={(value) => update('shelfmark', value)}
            multiline
          />
          <Field
            label="Местонахождение"
            value={draft.location}
            onChange={(value) => update('location', value)}
            multiline
          />
          <Field
            label="Темы"
            value={draft.subjects}
            onChange={(value) => update('subjects', value)}
            wide
            multiline
          />
          <Field
            label="Примечания"
            value={draft.notes}
            onChange={(value) => update('notes', value)}
            wide
            multiline
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={saving || !draft.inventoryNumber.trim()}
            onClick={() => void submit()}
          >
            {saving ? 'Сохранение…' : 'Добавить экземпляр'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
    updatedAt: string('updatedAt') || undefined,
    deleted: Boolean(raw.deletedAt),
    revision: typeof raw.revision === 'number'
      ? raw.revision
      : Number(raw.revision ?? 1) || 1,
  };
}

type WebModelContext = {
  registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

async function apiRequest(
  url: string,
  init: RequestInit,
  reportError: (message: string) => void,
) {
  try {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
    if (response.ok) return true;
    const payload = await response.json().catch(() => ({})) as { error?: string };
    reportError(
      payload.error || 'Не удалось сохранить изменение.',
    );
  } catch {
    reportError(
      'Нет связи с базой. Изменение не сохранено.',
    );
  }
  return false;
}
