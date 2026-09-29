# Аудит готовности MLC к публикации

Статус: **HOLD — secret/PII scan и dependency-license review пройдены; выбрана AGPL-3.0-or-later. До Public осталось добавить полный стандартный текст LICENSE и проверить GitHub Actions/artifacts.**

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

Перед сменой visibility проверить историю Actions, logs и artifacts. При переводе private -> public GitHub делает историю Actions/logs публичной.

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
- выбрана лицензия `AGPL-3.0-or-later`; полный стандартный текст `LICENSE` должен быть добавлен перед Public;
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

Полный неизменённый текст GNU AGPL v3 ещё должен быть добавлен в корневой `LICENSE`.
