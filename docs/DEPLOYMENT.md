# Развёртывание MLC

## Окружения

В проекте используются:

- **local** — разработка;
- **staging** — проверка;
- **production** — рабочий каталог.

Рабочий production URL библиотекаря:

```text
https://mlc-vercel-access.vercel.app/
```

Production Worker:

```text
https://music-school-library.oregu93.workers.dev/
```

Vercel работает как access gateway и проксирует запросы к production Worker. Данные находятся в D1 и не копируются на Vercel.

## Требования к локальной среде

Используются Node.js, pnpm и Wrangler.

Перед deployment не обновляйте major/minor инфраструктурные зависимости автоматически: сначала отдельная проверка в staging.

Установка зависимостей:

```bash
pnpm install
```

## Предрелизная проверка

Перед каждым значимым deployment:

```bash
pnpm launch:check
```

Команда включает:

- database/migration tests;
- outbox/API contract tests;
- TypeScript typecheck;
- сборку Worker;
- сборку client.

FAIL блокирует production deployment.

## Staging

Развёртывание:

```bash
pnpm deploy:staging
```

Скрипт выводит target environment, Worker, D1 и выполняет PRE-DEPLOY IDENTITY CHECK.

После deployment требуется smoke/acceptance:

- `/api/health`;
- вход/выход;
- поиск;
- карточка;
- операции изменения;
- mobile/desktop UX для затронутых функций.

## Production

Развёртывание:

```bash
pnpm deploy:production
```

Перед ним должны быть:

1. актуальный Git HEAD;
2. PASS `pnpm launch:check`;
3. staging PASS;
4. backup, если меняется схема/данные или операция потенциально рискованная.

После production deployment проверить:

```text
https://mlc-vercel-access.vercel.app/api/health
https://mlc-vercel-access.vercel.app/help
https://mlc-vercel-access.vercel.app/
```

и выполнить короткий пользовательский acceptance.

## Миграции

Миграции находятся в `migrations/`.

Применение staging:

```bash
pnpm db:migrate:staging
```

Production:

```bash
pnpm db:migrate:production
```

Не запускать миграцию только потому, что выполняется новый frontend deployment. Миграции применяются только при наличии новых versioned migration files и после backup/проверки.

## Vercel access gateway

Исходники gateway находятся в:

```text
infra/vercel-access/
```

Gateway меняется существенно реже Worker/client.

Если gateway-код не менялся, обычный production deployment MLC не требует повторного Vercel deployment.

Если gateway менялся, сначала обновляется gateway, проверяются `/api/health`, `/help`, OAuth routing, затем обновляется Worker.

## OAuth

Production/staging callback URI должны быть зарегистрированы в Yandex OAuth.

Подробности: [OAUTH.md](OAUTH.md).

## Секреты

Нельзя помещать в Git:

- `.dev.vars`;
- OAuth session/state значения;
- production exports;
- реальные персональные данные.

Client ID может быть публичной конфигурацией; session/auth secrets и любые чувствительные значения — только в локальной/серверной конфигурации.

## GitHub

GitHub — источник кода, документации, миграций и истории изменений.

Рабочие библиотечные данные не являются частью репозитория.
