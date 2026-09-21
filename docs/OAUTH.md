# Вход и выход

## Текущая архитектура

Каталог использует Yandex ID через production Cloudflare Worker. Для пользовательского доступа используется Vercel access gateway, который проксирует OAuth-маршруты и остальные запросы к тому же Worker.

Используется:

- Authorization Code Flow;
- PKCE (S256);
- state;
- серверный callback;
- серверная проверка пользователя;
- whitelist в таблице D1 `app_users`;
- серверные сессии в D1 `auth_sessions`;
- HttpOnly cookie `mlc_session`.

OAuth access token Яндекса используется только для получения
профиля пользователя и не сохраняется в базе.

## Маршруты

```text
GET /api/auth/login
GET /api/auth/callback
GET /api/auth/logout
GET /api/session
```

Рабочие маршруты каталога `/api/catalog...` требуют
действующей серверной сессии.

## Yandex OAuth

Для пользовательской страницы авторизации используется русскоязычный endpoint:

```text
https://oauth.yandex.ru/authorize
```

Backend-обмен кода также выполняется через `oauth.yandex.ru/token`.
Отдельный недокументированный параметр языка не используется.

Для приложения требуется:

```text
YANDEX_CLIENT_ID
```

Client ID не является секретом.

Для текущей реализации с PKCE:

```text
YANDEX_CLIENT_SECRET
SESSION_SECRET
```

не используются.

Локальная конфигурация хранится в:

```text
.dev.vars
```

Этот файл не должен попадать в Git.

## Пользователи

Разрешённые сотрудники находятся в D1:

```text
app_users
```

Основной идентификатор после первого подтверждённого входа —
Yandex UID. Email также хранится для отображения и первичного
сопоставления.

Роли:

```text
admin
librarian
```

Отключённый пользователь имеет:

```text
enabled = 0
```

## Сессии

Сессии хранятся в таблице:

```text
auth_sessions
```

В cookie хранится случайный session token. В D1 хранится только
его SHA-256 hash.

Cookie:

```text
HttpOnly
SameSite=Lax
Secure — при HTTPS
```

## Аудит

Изменяющие операции используют пользователя из текущей сессии.

В `audit_log` сохраняются:

- Yandex UID;
- email;
- действие;
- время;
- record_id;
- сведения об изменении.

## Локальная разработка

Локальный callback:

```text
http://localhost:5173/api/auth/callback
```

Перед production/staging deployment соответствующий HTTPS callback
нужно добавить в настройках Yandex OAuth.


## Production redirect URI

В Yandex OAuth должны оставаться зарегистрированы оба callback:

```text
https://music-school-library.oregu93.workers.dev/api/auth/callback
https://mlc-vercel-access.vercel.app/api/auth/callback
```

Основной пользовательский адрес — Vercel. Прямой `workers.dev` используется как технический backend/резервный маршрут.

Для повторного входа используется `force_confirm=yes`. Выход из каталога завершает серверную сессию каталога; на общем устройстве пользователь должен отдельно выйти из Яндекс ID.


## Локализация страницы входа

Production Worker формирует OAuth-запрос через `oauth.yandex.ru`, а не `oauth.yandex.com`. Vercel access gateway принимает оба hostname и сохраняет публичный Vercel callback.

Перед production-развёртыванием изменения OAuth необходимо одновременно проверить на Vercel gateway и на прямом Cloudflare маршруте.
