# Аудит готовности MLC к публикации

Статус: **HOLD — текущая ветка выглядит пригодной к публикации, но полная история Git ещё должна пройти локальный secret/PII scan.**

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

## 3. Что ещё обязательно проверить до Public

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

Перед сменой visibility проверить историю Actions, logs и artifacts. При переводе private -> public GitHub делает историю Actions/logs публичной.

### Зависимости

Проверить лицензии runtime/dev dependencies и убедиться, что проект не содержит скопированных сторонних файлов с несовместимой лицензией.

### Данные и изображения

Отдельно проверить:

- screenshots;
- QR/PNG/PDF;
- sample fixtures;
- документацию;
- commit messages;
- issue/PR discussions, если они появлялись.

## 4. Критерий PASS

Репозиторий можно переводить в public после одновременного выполнения:

- HEAD/current tree: PASS;
- full-history secret scan: PASS;
- PII scan: PASS;
- Actions/artifacts: PASS или отсутствуют;
- dependency/license review: PASS;
- выбран и добавлен `LICENSE`;
- README явно указывает назначение, отсутствие bundled production data и порядок безопасного deployment;
- отсутствуют реальные секреты, персональные данные и production dumps.

## 5. Если секрет когда-либо был в истории

Просто удалить его из текущего файла недостаточно.

Необходимо:

1. немедленно revoke/rotate credential;
2. переписать Git history с удалением значения/файла;
3. force-push очищенную историю;
4. повторить secret scan;
5. только после этого менять visibility.

## 6. Visibility

После публикации исходный код может быть склонирован или форкнут. Возврат репозитория в private не отзывает уже сделанные локальные копии, а публичные forks могут остаться публичными как отделённые репозитории.

Поэтому перевод в public рассматривается как фактически необратимое раскрытие опубликованной версии кода.
