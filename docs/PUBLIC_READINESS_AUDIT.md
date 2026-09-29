# Аудит готовности MLC к публикации

Статус: **PASS — репозиторий готов к переводу в Public.**

Дата финального аудита: 29 сентября 2026 года.

## 1. Итог

Перед публикацией выполнены:

- аудит текущего дерева;
- аудит полной Git history;
- Gitleaks scan;
- проверка PII и commit metadata;
- проверка рискованных файлов/путей;
- dependency-license review;
- проверка GitHub Actions/artifacts;
- добавление open-source лицензии;
- cleanup устаревшего legacy-слоя;
- локальные tests/typecheck/build после cleanup.

Итоговый статус:

```text
CURRENT TREE          PASS
FULL GIT HISTORY      PASS
COMMIT METADATA       PASS — GitHub noreply
GITLEAKS              PASS — 3 classified false positives
PII HISTORY           PASS
RISKY FILE PATHS      PASS
DEPENDENCY LICENSES   PASS
GITHUB ACTIONS        PASS — 0 workflow runs
LEGACY CLEANUP        PASS
PROJECT LICENSE       PASS — AGPL-3.0-or-later
TESTS                  PASS
TYPECHECK              PASS
BUILD                  PASS
PUBLICATION            READY
```

## 2. Secret/PII audit

Полная история Git была переписана так, чтобы author/committer email использовал GitHub noreply-адрес.

После rewrite повторный Gitleaks scan прошёл по актуальной истории. Обнаружены 3 совпадения `generic-api-key`:

- `wrangler.jsonc`;
- `wrangler.staging.jsonc`;
- `wrangler.production.jsonc`.

Все три относятся к `YANDEX_CLIENT_ID`.

Классификация: **FALSE POSITIVE / PUBLIC IDENTIFIER**. OAuth Client ID не является credential или секретом.

Ранее выполненная проверка risky paths не выявила попадания в историю:

- `.dev.vars`;
- приватных `.env`;
- рабочих Excel/CSV;
- production SQL backups;
- PEM/private-key файлов;
- `private-data/`;
- `backups/`;
- `outputs/`.

## 3. Commit metadata

Исторические author/committer email были заменены на GitHub noreply metadata через контролируемый history rewrite.

После force-push и повторной синхронизации обычного checkout:

```text
git log --all --format='%ae%n%ce' | sort -u
```

возвращает только GitHub noreply-адрес.

Новые локальные commits также настроены на GitHub noreply email.

## 4. Лицензия

Проект лицензирован как:

```text
AGPL-3.0-or-later
```

В корне находится полный стандартный текст GNU Affero General Public License v3 в `LICENSE`.

Дополнительно добавлены:

- `CONTRIBUTING.md`;
- `SECURITY.md`;
- `THIRD_PARTY_NOTICES.md`;
- поле `license` в `package.json`;
- разделы README об open-source модели и AI-assisted development.

## 5. Dependency review

Проверены:

```bash
pnpm licenses list --prod
pnpm licenses list --dev
```

Явного лицензионного блокера для публикации собственного кода MLC под AGPL-3.0-or-later не выявлено.

Основные runtime-зависимости используют MIT/ISC/Apache-2.0. Для transitive/dev-компонентов сохраняются их собственные лицензии и notices; сведения суммированы в `THIRD_PARTY_NOTICES.md`.

## 6. GitHub Actions

Проверка GitHub Actions:

```text
workflow_runs.total_count = 0
```

Истории workflow logs/artifacts для раскрытия нет.

## 7. Cleanup перед Public

Удалён неиспользуемый ранний слой проекта:

- ChatGPT/OpenAI-hosting config;
- legacy Next.js entrypoints/API routes;
- старый Drizzle schema/config/snapshots;
- устаревший design-baseline синхронизации;
- устаревшая PDF-памятка библиотекаря.

Сохранены файлы `app/`, которые использует текущий Vite runtime и tests:

- `app/catalog-client.tsx`;
- `app/globals.css`;
- `app/outbox.ts`;
- `app/outbox-core.mjs`.

Production schema управляется versioned SQL migrations из `migrations/`.

## 8. Финальная локальная проверка

После cleanup выполнены отдельно:

```bash
pnpm test:launch
pnpm typecheck
pnpm build
```

Результат:

- database and migration tests — PASS;
- outbox and API contract tests — PASS;
- TypeScript typecheck — PASS;
- Vite staging Worker build — PASS;
- Vite client build — PASS.

После build рабочее дерево осталось чистым.

### Примечание о `.dev.vars`

Локальная сборка Cloudflare/Vite сообщает об использовании локального `.dev.vars` и создаёт generated build artifact внутри `dist/`.

Это не часть Git repository: `.dev.vars` и `dist/` исключены через `.gitignore`. Их содержимое не должно коммититься, публиковаться или прикладываться к releases.

## 9. Правила после публикации

После перевода visibility в `Public` опубликованную историю следует считать фактически раскрытой необратимо: локальные clones/forks невозможно отозвать переводом repository обратно в private.

Перед будущими изменениями, которые затрагивают auth, deployment, migrations или imports, сохраняются правила:

```text
local -> staging -> production
```

и обязательный контроль secrets/PII в репозитории.

## 10. Решение

**PUBLICATION: READY**

Репозиторий может быть переведён владельцем в `Public` через GitHub Settings.
