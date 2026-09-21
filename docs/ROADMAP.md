# Roadmap

Статусы:

- **DONE** — завершено и принято.
- **READY_FOR_VALIDATION** — реализовано, требуется локальный/staging/production acceptance-test.
- **NEXT** — следующий приоритет.
- **PLANNED** — запланировано.
- **OBSERVE** — эксплуатационное наблюдение.
- **FUTURE** — идея сохранена, но реализация не требуется без подтверждённого сценария.

```mermaid
flowchart LR
  A[OPERATIONS-003<br/>Vercel access gateway<br/>DONE] --> B[HELP-AUTH-002<br/>Desktop/mobile login<br/>READY_FOR_VALIDATION]
  B --> C[LIBRARIAN_UX-001<br/>Infinite scroll<br/>READY_FOR_VALIDATION]
  C --> D[LIBRARIAN_UX-004<br/>Recent changes<br/>READY_FOR_VALIDATION]
  D --> E[LIBRARIAN_UX-005/006/007<br/>Add-record form<br/>READY_FOR_VALIDATION]
  E --> F[LIBRARIAN_UX-002<br/>Inventory mode toggle<br/>READY_FOR_VALIDATION]
  F --> K[LIBRARIAN_UX-010/011<br/>Export + RU labels<br/>READY_FOR_VALIDATION]
  K --> L[AUTH-I18N-001<br/>Russian OAuth<br/>READY_FOR_VALIDATION]
  L --> G[LIBRARIAN_UX-003<br/>Mobile scanning<br/>PLANNED]
  G --> H[LIBRARIAN_UX-009<br/>Functional QR/deep-link<br/>FUTURE]
  A --> I[OPERATIONS-001<br/>First-day observation<br/>OBSERVE]
  I --> J[OPERATIONS-002<br/>USB scanner<br/>PLANNED]
```

| ID | Статус | Содержание |
| --- | --- | --- |
| OPERATIONS-003 | DONE | Пользовательский доступ через `https://mlc-vercel-access.vercel.app/`; Cloudflare Worker остаётся backend. |
| HELP-AUTH-002 | READY_FOR_VALIDATION | Инструкция без привязки к браузеру; отдельный вход с компьютера и телефона; корректное завершение работы. |
| LIBRARIAN_UX-001 | READY_FOR_VALIDATION | Собственная прокрутка таблицы; подгрузка по 200 записей при приближении к низу; заголовок таблицы фиксирован внутри области прокрутки. |
| LIBRARIAN_UX-002 | READY_FOR_VALIDATION | Явно включаемый/выключаемый режим инвентаризации; безопасное выключенное состояние по умолчанию. |
| LIBRARIAN_UX-003 | PLANNED | Камера телефона для штрихкода/QR. |
| LIBRARIAN_UX-004 | READY_FOR_VALIDATION | Сортировка по автору/заглавию или по `updated_at DESC`; колонка «Изменено». |
| LIBRARIAN_UX-005 | READY_FOR_VALIDATION | Добавление экземпляра сразу через полный формуляр; инвентарный номер основной, `db_number` необязателен и при создании остаётся пустым. |
| LIBRARIAN_UX-006 | READY_FOR_VALIDATION | Заглавие и другие многострочные поля автоматически растут по содержимому. |
| LIBRARIAN_UX-007 | READY_FOR_VALIDATION | Поле основы пустое по умолчанию; ввод автора или инвентарного номера автоматически открывает список релевантных карточек. |
| LIBRARIAN_UX-008 | READY_FOR_VALIDATION | Старый QR-блок с библиографическими данными удалён из карточки. |
| LIBRARIAN_UX-009 | FUTURE | Возвращать QR только как функциональный deep-link/инвентаризационный сценарий, если он действительно нужен. |
| LIBRARIAN_UX-010 | READY_FOR_VALIDATION | CSV-экспорт скрыт за компактным двухшаговым контролом «Экспорт». |
| LIBRARIAN_UX-011 | READY_FOR_VALIDATION | Категории поиска и сортировки отображаются по-русски, внутренние API-значения пользователю не показываются. |
| AUTH-I18N-001 | READY_FOR_VALIDATION | OAuth authorization через `oauth.yandex.ru`; Vercel relay поддерживает русский hostname и сохраняет callback. |
| AUTH-SESSION-002 | PLANNED | Завершение сессии после 2 часов отсутствия активности при сохранении абсолютного максимального срока сессии. |
| OPERATIONS-001 | OBSERVE | Проверка pending/conflict и резервная копия после первого рабочего дня. |
| OPERATIONS-002 | PLANNED | Acceptance-test USB-сканера. |
| PLATFORM-001 | PLANNED | PWA/offline hardening. |
| PLATFORM-002 | PLANNED | Cross-platform hardening. |

## Правило пользовательского доступа

Основной пользовательский адрес:

```text
https://mlc-vercel-access.vercel.app/
```

`workers.dev` остаётся техническим backend-адресом и не должен использоваться в ярлыках и пользовательских инструкциях.

Cloudflare и Vercel могут работать параллельно с одной production D1. Перед переходом между адресами или устройствами необходимо дождаться состояния **«Синхронизировано»**.
