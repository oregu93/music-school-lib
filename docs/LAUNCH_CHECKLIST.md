# Pilot launch checklist

- [ ] PASS — LOCAL: `pnpm launch:check`; чистый и закоммиченный репозиторий.
- [ ] PASS — BACKUP: полный CSV и D1 SQL; количества строк совпадают.
- [ ] PASS — STAGING MIGRATIONS: применены один раз, без ошибок.
- [ ] PASS — STAGING AUTH: вход, выход, роли admin/librarian.
- [ ] PASS — STAGING FUNCTIONAL: поиск, карточка, правка, конфликт, выдача, возврат, корзина/восстановление.
- [ ] PASS — STAGING DEGRADED MODE: отключить сеть после правки; виден pending; перезагрузка сохраняет очередь; reconnect синхронизирует.
- [ ] PASS — STAGING INVENTORY: точный номер, дубль с выбором, повтор без второго события, USB-сканер, CSV событий.
- [ ] PASS — FINAL BACKUP: свежие CSV и D1 SQL непосредственно перед production.
- [ ] PASS — PRODUCTION MIGRATIONS: контролируемо, после резервной копии.
- [ ] PASS — PRODUCTION DEPLOY: только явно авторизованный выпуск.
- [ ] PASS — PRODUCTION READ-ONLY: вход, список, точный поиск, полная карточка.
- [ ] PASS — PRODUCTION MUTATION: одна согласованная тестовая правка, выдача/возврат и восстановление исходного состояния.
- [ ] PASS — PILOT: библиотекарь получил краткую инструкцию и контакт для эскалации.
- [ ] PASS — OBSERVATION: проверить outbox/conflicts, ошибки и резервную копию после первого рабочего дня.

Любой FAIL останавливает переход к следующему этапу.
