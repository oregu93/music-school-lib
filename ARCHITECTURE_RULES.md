# Архитектурные правила MLC

Эти правила фиксируют решения, которые должны сохраняться при дальнейшей разработке.

## EVOLVABILITY-01 — эволюционность

Изменения production должны по возможности оставаться обратно совместимыми.

Предпочтительно:

- additive migrations;
- явные шаги миграции;
- проверка результата до удаления старых структур;
- отложенная очистка;
- сохранение рабочих API-контрактов при расширении.

Production не является средой разработки.

Путь выпуска:

```text
local -> staging -> production
```

## VENDOR-FREE-01 — отсутствие обязательной привязки к поставщику

Бизнес-логика, модель данных, авторизация, поиск и синхронизация не должны без необходимости зависеть от Cloudflare/Vercel-specific client APIs.

Cloudflare Workers/D1 и Vercel — текущая инфраструктура, а не архитектурное требование.

Приложение должно оставаться переносимым на:

- обычный Linux-сервер;
- другой cloud;
- локальную установку с совместимым HTTP API и SQLite/PostgreSQL-подобным datastore.

## OFFLINE-FIRST-01 — сохранность работы при временной потере сети

Изменяющие операции не должны теряться при кратковременном отсутствии связи.

Текущая реализация:

- IndexedDB outbox;
- стабильный `device_id`;
- стабильный `operation_id`;
- автоматический replay pending-операций;
- явные статусы pending/conflict/failed;
- idempotent server processing;
- revision-based conflict detection.

Полная локальная реплика всего каталога остаётся дальнейшим этапом PWA/offline hardening и не считается полностью реализованной.

## DEGRADED-MODE-01 — деградированный режим

При временной недоступности записи:

- операция должна либо безопасно попасть в outbox, либо пользователь должен получить явную ошибку;
- silent data loss недопустим;
- UI различает:
  - синхронизировано;
  - ожидает отправки;
  - конфликт;
  - ошибка сохранения.

## CROSS-PLATFORM-01 — кроссплатформенность

Целевые клиенты:

- Windows desktop browser;
- Linux desktop browser;
- Android browser/PWA;
- iOS Safari/PWA с платформенными ограничениями.

Runtime-логика не должна зависеть от локальных путей ОС или shell-команд.

USB/Bluetooth barcode scanners должны работать как keyboard input.

Мобильное сканирование камерой должно иметь ручной fallback.

## SYNC-01 — идентичность синхронизируемой операции

Каждая синхронизируемая mutation имеет:

- `operation_id` — UUID;
- `device_id`;
- actor identity;
- entity type/id;
- operation type;
- `base_revision` где требуется;
- client timestamp;
- payload;
- локальный sync state.

Повтор одного `operation_id` не должен дублировать действие.

## CONCURRENCY-01 — конкурентное редактирование

Изменяемые записи имеют server-side `revision`.

Клиент передаёт `baseRevision`.

Новая серверная версия не должна молча перезаписываться старым клиентом.

Критические бизнес-операции, например одновременная выдача одного экземпляра, должны отклонять несовместимые состояния.

## DATA-IDENTITY-01 — идентификаторы

Внутренний numeric catalog id — технический relationship key.

`inventory_number` — основной пользовательский идентификатор экземпляра.

`inventory_number` не считается уникальным, поскольку исторический каталог содержит допустимые повторы.

`db_number` — вторичный legacy/source identifier.

Поиск по инвентарному номеру должен корректно поддерживать:

- 0 совпадений;
- 1 совпадение;
- несколько совпадений с явным выбором.

## SECURITY-01 — серверная авторизация

Права и роли определяются сервером.

Ограничения UI не являются security boundary.

OAuth/access tokens, session tokens и secrets не должны сохраняться в документации, Git или пользовательских export-файлах.

## PRIVACY-01 — минимизация персональных данных

В репозиторий, тестовые fixtures и документацию не помещаются реальные имена, email, UID и иные идентификаторы сотрудников.

В production БД допускается хранение только данных, необходимых для авторизации, аудита и библиотечной работы.

## DEPLOYMENT-01 — разделение окружений

Обязательные среды:

- local;
- staging;
- production.

Production deployment, migrations, import и destructive operations требуют явного выбора окружения.

Перед production:

1. `pnpm launch:check`;
2. staging deployment;
3. staging acceptance;
4. backup при изменении данных/схемы;
5. production deployment;
6. production smoke/acceptance.

Все schema migrations версионируются в Git.

## BACKUP-01 — восстановимость

Перед рискованными изменениями должны существовать:

- D1 SQL export;
- контрольный CSV catalog export;
- проверка количества записей;
- понятная процедура восстановления в новую базу до переключения production binding.

## USER-ACCESS-01 — пользовательский маршрут

Основной пользовательский origin — Vercel access gateway.

Прямой `workers.dev` — технический/резервный backend route.

Перед переключением origin пользователь должен дождаться состояния «Синхронизировано», поскольку browser session и IndexedDB outbox origin-bound.
