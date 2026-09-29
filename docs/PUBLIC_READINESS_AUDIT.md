# Аудит готовности MLC к публикации

Статус: **HOLD — Git history переписана на GitHub noreply metadata; legacy Next.js/ChatGPT-hosting/Drizzle слой и устаревшая PDF-памятка удалены. Перед Public остались локальные финальные проверки `pnpm launch:check` и повторный Gitleaks по актуальному HEAD.**

Дата: 29 сентября 2026 года.

## 1. Текущая видимость

Репозиторий остаётся **private** до завершения всех пунктов этого аудита.

## 2. Проверено в текущем дереве

Проверено текущее дерево ветки `lightweight-migration`.

Результат:

- рабочие Excel/CSV/SQL backups в текущем дереве не обнаружены;
- `.dev.vars` и обычные `.env*` исключены через `.gitignore`;
- `outputs/`, `backups/`, `private-data/`, import bundles исключены;
- приватные ключи и credential-файлы в текущем дереве не обнаружены;
- в ключевых auth/deployment/test-файлах реальные email не обнаружены;
- тестовый адрес `user@example.test` является синтетическим;
- production/staging Wrangler configs содержат OAuth Client ID и D1 database IDs. Они являются идентификаторами, а не секретами/credentials, но при желании могут быть вынесены в локальную конфигурацию до публикации.

## 3. Результат full-history secret scan

Локальный Gitleaks 8.16.0 просканировал 86 commits.

Результат: 3 находки `generic-api-key`, все в Wrangler-конфигурациях на строке `YANDEX_CLIENT_ID`.

Классификация: **FALSE POSITIVE / PUBLIC IDENTIFIER**, не credential. OAuth Client ID не является секретом и уже документирован как публичная конфигурация.

Проверка risky paths по полной истории: **0** путей, соответствующих `.env`, `.dev.vars`, Excel/CSV, backups, private-data, PEM/key-файлам и аналогичным артефактам.

Дополнительная проверка `git log -G '@gmail\\.'` по полной истории не нашла файлов или commits с Gmail-адресами. Предыдущие 59 совпадений общего grep были артефактом обработки `git log -p`/бинарного контекста, а не подтверждёнными адресами в истории.

Проверка `client_secret`, `session_secret`, `password`, `BEGIN .*PRIVATE KEY` по истории выявила только сам файл этого аудита, где эти строки присутствуют как поисковые шаблоны. Реальных credentials по этим категориям не обнаружено.

## 4. Что ещё обязательно проверить до Public

### Полная история Git

Проверяется не только HEAD, но и все исторические commits, blobs и удалённые файлы.

Рекомендуемые инструменты:

```bash
gitleaks git --redact --report-format=json --report-path=public-readiness-gitleaks.json .
```

Дополнительная проверка потенциальных персональных данных:

```bash
git log --all -p -- . ':!pnpm-lock.yaml' \
  | grep -Ein '(@yandex\.|@gmail\.|@mail\.ru|client_secret|session_secret|api[_-]?key|access[_-]?token|password|BEGIN .*PRIVATE KEY)' \
  > public-readiness-history-grep.txt || true
```

Файлы отчётов не коммитить.

### GitHub Actions

Проверка выполнена через GitHub: `workflow_runs.total_count = 0`.

Результат: **PASS**. Истории GitHub Actions runs/artifacts для раскрытия нет.

### Зависимости

Проверка `pnpm licenses list --prod` и `pnpm licenses list --dev` выполнена.

Результат: **PASS**. Прямые runtime-зависимости используют permissive-лицензии (в основном MIT/ISC/Apache-2.0). В dev/transitive tree присутствуют также BSD, MPL-2.0, LGPL-3.0-or-later, CC0/CC-BY, Python-2.0 и BlueOak; явного блокера для лицензирования собственного кода MLC как AGPL-3.0-or-later не выявлено.

Добавлен `THIRD_PARTY_NOTICES.md`. При изменении dependency tree проверку следует повторять.

### Данные и изображения

Отдельно проверить:

- screenshots;
- QR/PNG/PDF;
- sample fixtures;
- документацию;
- commit messages;
- issue/PR discussions, если они появлялись.

## 5. Критерий PASS

Репозиторий можно переводить в public после одновременного выполнения:

- HEAD/current tree: PASS;
- full-history secret scan: PASS;
- PII scan: PASS;
- Actions/artifacts: PASS или отсутствуют;
- dependency/license review: PASS;
- выбрана лицензия `AGPL-3.0-or-later`; полный стандартный текст GNU AGPL v3 добавлен в корень как `LICENSE`;
- README явно указывает назначение, отсутствие bundled production data и порядок безопасного deployment;
- отсутствуют реальные секреты, персональные данные и production dumps.

## 6. Если секрет когда-либо был в истории

Просто удалить его из текущего файла недостаточно.

Необходимо:

1. немедленно revoke/rotate credential;
2. переписать Git history с удалением значения/файла;
3. force-push очищенную историю;
4. повторить secret scan;
5. только после этого менять visibility.

## 7. Visibility

После публикации исходный код может быть склонирован или форкнут. Возврат репозитория в private не отзывает уже сделанные локальные копии, а публичные forks могут остаться публичными как отделённые репозитории.

Поэтому перевод в public рассматривается как фактически необратимое раскрытие опубликованной версии кода.


## 8. Принятое лицензионное решение

Выбрано:

```text
AGPL-3.0-or-later
```

Цель: сохранить MLC открытым проектом, разрешая коммерческое внедрение, адаптацию, сопровождение и хостинг, но не превращая модифицированную сетевую версию в закрытую производную без выполнения условий AGPL.

В репозиторий добавлены:

- `CONTRIBUTING.md`;
- `SECURITY.md`;
- `THIRD_PARTY_NOTICES.md`;
- metadata `license: AGPL-3.0-or-later` в `package.json`;
- разделы README об open-source модели и AI-assisted development.

Полный неизменённый текст GNU AGPL v3 добавлен в корневой `LICENSE` (commit `19d6258e682ff66a0e90bb20c621b9a018c1de08`).


## 9. Финальный public-readiness verdict

На 29 сентября 2026 года:

```text
CURRENT TREE          PASS
FULL GIT HISTORY      PASS
GITLEAKS              PASS (3 false positives: public OAuth Client ID)
PII HISTORY           PASS
RISKY FILE PATHS      PASS
DEPENDENCY LICENSES   PASS
GITHUB ACTIONS        PASS (0 workflow runs)
PROJECT LICENSE       PASS (AGPL-3.0-or-later)
PUBLICATION           HOLD (final local verification)
```

Перевод visibility в `Public` должен выполняться вручную владельцем репозитория в GitHub Settings.

После публикации следует считать опубликованную версию кода фактически необратимо раскрытой: возврат repository в private не отзывает уже сделанные clones/forks.


## 10. Финальный аудит перед сменой visibility

Дополнительная проверка commit metadata выявила 98 commits и несколько author identities. Среди email-адресов commit metadata присутствует адрес на публичном почтовом домене, не являющийся GitHub noreply. Значение адреса в документацию не переносится.

Это не credential и не security leak, но после перевода репозитория в public Git history сделает этот адрес публичным.

Критерий закрытия:

- либо владелец проекта явно принимает публикацию исторического author email;
- либо Git history переписывается с заменой author/committer identity на неперсональный/noreply адрес, после чего выполняется повторный gitleaks/public-readiness scan.

Также обнаружен legacy-слой ранней Next.js/ChatGPT-hosted версии (`next.config.ts`, часть `app/`, `db/`, `drizzle/`, `.openai/hosting.json`). Текущий production runtime использует Vite + `src/client` + `src/worker` + `migrations/`. Перед Public рекомендуется отдельный bounded cleanup с `pnpm launch:check`, не удаляя используемые `app/globals.css` и `app/outbox-core.mjs`.

Печатная `docs/LIBRARIAN_QUICK_GUIDE_A4.pdf` также должна быть либо перегенерирована из актуальной инструкции, либо временно удалена, чтобы публичный репозиторий не распространял устаревшую памятку.


## 11. Cleanup перед Public

Выполнена очистка текущего дерева от неиспользуемого раннего слоя проекта:

- удалена конфигурация раннего ChatGPT/OpenAI-hosting;
- удалены legacy Next.js entrypoints и API routes;
- удалены старые Drizzle schema/config/snapshots, поскольку production использует versioned SQL migrations из `migrations/`;
- удалён устаревший design-baseline синхронизации, который больше не отражал production implementation;
- удалена устаревшая печатная PDF-памятка; актуальным источником остаётся `docs/LIBRARIAN_QUICK_GUIDE.md` и `/help`;
- `tsconfig.json` очищен от `.next`/`next-env` путей.

При этом сохранены используемые текущим runtime файлы `app/catalog-client.tsx`, `app/globals.css`, `app/outbox.ts`, `app/outbox-core.mjs`.

После history rewrite проверка последних GitHub commits показывает noreply author/committer metadata.
