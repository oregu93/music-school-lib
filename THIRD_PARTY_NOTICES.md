# Third-party notices

MLC использует сторонние open-source зависимости. Канонический список конкретных установленных версий находится в `pnpm-lock.yaml`.

Проверка лицензий:

```bash
pnpm licenses list --prod
pnpm licenses list --dev
```

Аудит от 29 сентября 2026 года не выявил зависимости, которая сама по себе блокировала бы лицензирование собственного кода MLC как `AGPL-3.0-or-later`.

## Основные прямые runtime-зависимости

| Пакет | Лицензия |
| --- | --- |
| React | MIT |
| React DOM | MIT |
| Base UI | MIT |
| class-variance-authority | Apache-2.0 |
| clsx | MIT |
| lucide-react | ISC |
| qrcode | MIT |
| shadcn | MIT |
| tailwind-merge | MIT |
| tw-animate-css | MIT |

## Инструменты разработки

Среди transitive/dev-зависимостей встречаются MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, MPL-2.0, LGPL-3.0-or-later, CC0-1.0, CC-BY-4.0, Python-2.0, BlueOak-1.0.0 и иные лицензии.

Это не означает, что эти пакеты перелицензируются как AGPL. Их собственные лицензии и copyright notices сохраняют силу.

При изменении dependency tree этот файл и вывод `pnpm licenses list` следует пересматривать.

## Распространение собранных артефактов

При распространении standalone/bundled артефактов необходимо сохранять применимые notices и условия сторонних компонентов. Этот файл не заменяет тексты лицензий соответствующих проектов.
