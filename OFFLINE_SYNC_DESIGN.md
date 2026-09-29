# Offline / outbox design

Статус: частично реализовано в production.

## 1. Что уже реализовано

В браузере используется IndexedDB outbox для изменяющих операций.

Сохраняются:

- `operation_id`;
- `device_id`;
- entity type/id;
- operation type;
- `base_revision`;
- payload;
- client timestamp;
- status;
- attempt count;
- last attempt/error.

Статусы:

```text
pending
syncing
conflict
failed
```

При нормальном online-сценарии операция отправляется сразу.

При network failure она остаётся `pending` и повторяется после восстановления связи.

Успешная операция удаляется из outbox после server acknowledgement.

## 2. Idempotency

`operation_id` создаётся до первой отправки и не меняется при retry.

Server хранит/проверяет operation identity, поэтому повтор одной операции не должен создавать второе действие.

## 3. Revision conflicts

Для изменяемых карточек используется `revision`.

Client отправляет `baseRevision`.

Если серверная версия уже изменилась, сервер возвращает conflict вместо last-write-wins.

## 4. Business conflicts

Критические операции, например несовместимая выдача одного экземпляра, должны отклоняться сервером.

## 5. Пользовательский UX

При отсутствии очереди:

```text
Синхронизировано
```

Если есть pending operations:

```text
Ожидает отправки: N
```

и появляется кнопка «Отправить ожидающие».

При conflict/failed показывается явный статус ошибки.

Постоянная ручная кнопка синхронизации не используется: обычная работа автоматическая.

## 6. Ограничение текущей реализации

Полная offline-first модель ещё не завершена.

Сейчас production outbox защищает изменяющие операции, но полный компактный каталог не гарантированно реплицируется целиком на устройство.

Поэтому полноценная автономная работа без сети со всем каталогом остаётся задачей `PLATFORM-001`.

## 7. Целевая дальнейшая модель

При дальнейшем hardening локальный datastore может включать:

### catalog_summary

Компактную локальную копию каталога для:

- поиска;
- lookup по инвентарному номеру;
- отображения статусов;
- инвентаризации.

### catalog_full

Кэш полных карточек.

### outbox

Очередь mutations — уже реализованный базовый слой.

### sync_state

Курсор/метаданные последней синхронизации.

### device

Стабильный browser installation identity — базовый `device_id` уже используется.

## 8. Cross-platform

Нельзя делать критический workflow зависимым только от:

- Background Sync API;
- File System Access API;
- platform-specific native APIs.

Foreground replay при открытии/возврате online должен оставаться fallback.

## 9. Security

Yandex access token не хранится в IndexedDB.

Server authorization остаётся authoritative при replay pending operations.
