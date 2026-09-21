# Vercel access gateway

Production user-facing URL:

```text
https://mlc-vercel-access.vercel.app/
```

The gateway exists because some protected workstation/mobile networks cannot reach `*.workers.dev` reliably while `*.vercel.app` is reachable.

It does not own catalog data. It proxies to:

```text
https://music-school-library.oregu93.workers.dev
```

The Cloudflare Worker and production D1 remain the source of truth.

OAuth-specific functions preserve the Vercel public origin for login/callback/logout. The Yandex OAuth application must include:

```text
https://mlc-vercel-access.vercel.app/api/auth/callback
```

Do not place credentials or `.dev.vars` in this directory.


## OAuth language

The Worker redirects users to the documented Russian endpoint `https://oauth.yandex.ru/authorize`. The gateway login relay accepts both `oauth.yandex.ru` and `oauth.yandex.com` so that the public Vercel callback is preserved.
