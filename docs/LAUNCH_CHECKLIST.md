# Pilot launch checklist

- [x] PASS — LOCAL: `pnpm launch:check`; чистый и закоммиченный репозиторий.
- [x] PASS — BACKUP: полный CSV и D1 SQL; количества строк совпадают.
- [x] PASS — STAGING MIGRATIONS: применены один раз, без ошибок.
- [x] PASS — STAGING AUTH: вход, выход, роль admin подтверждены.
- [x] PASS — STAGING FUNCTIONAL: поиск, карточка, правка, конфликт, выдача, возврат, корзина/восстановление.
- [x] PASS — STAGING DEGRADED MODE: offline save → pending; reload/reopen сохраняет очередь; reconnect синхронизирует.
- [x] PASS — STAGING INVENTORY: точный номер, дубль с выбором, повтор без второго события, CSV событий. USB-сканер — NOT TESTED, не blocker.
- [x] PASS — FINAL BACKUP: свежие production CSV и D1 SQL сохранены перед production rollout; количества строк подтверждены.
- [x] PASS — PRODUCTION MIGRATIONS: контролируемо применены после резервной копии.
- [x] PASS — PRODUCTION DEPLOY: выпуск выполнен после staging acceptance.
- [x] PASS — PRODUCTION READ-ONLY: вход, список, точный поиск, полная карточка.
- [x] PASS — PRODUCTION MUTATION: тестовая правка, выдача/возврат, корзина/восстановление и проверка финального состояния.
- [ ] PILOT: библиотекарь получил краткую инструкцию и контакт для эскалации.
- [ ] OBSERVATION: проверить outbox/conflicts, ошибки и резервную копию после первого рабочего дня.

Любой новый FAIL в production останавливает дальнейшие изменения до разбора причины.
