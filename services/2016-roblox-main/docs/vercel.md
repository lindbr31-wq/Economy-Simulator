# Deploying the frontend to Vercel

The `2016-roblox` frontend is a stock Next.js 12 app and deploys to Vercel as-is.
Vercel hosts the website and its `/api/proxy` serverless function; **everything
else (the `Roblox.Website` .NET server, `services/api`, admin, game-server/RCC)
must still run somewhere with a public URL**, because Vercel's functions cannot
reach `localhost`.

```
browser ──► https://your-app.vercel.app        (this frontend, on Vercel)
                 │
                 └── /api/proxy?...  ──► https://backend.yourdomain.com/apisite/...
                                          (your .NET/API backend, anywhere public)
```

## 1. Vercel project settings

Create a project with:

| Setting        | Value                              |
|----------------|------------------------------------|
| Root Directory | `services/2016-roblox-main`        |
| Framework      | Next.js                            |
| Node version   | 24.x (also pinned via `engines`)   |
| Build command  | `next build` (default)             |

`config.json` is gitignored and **not** required: when it is missing (or when
running on Vercel), `next.config.js` builds the configuration from environment
variables instead. Locally you can keep using `node ./util/create_config.js`.

## 2. Environment variables

Set these in the Vercel project (they are read at **build** time, so redeploy
after changing them):

| Variable                     | Example value                                      | Notes |
|------------------------------|----------------------------------------------------|-------|
| `BACKEND_BASE_URL`           | `https://www.yourdomain.com`                       | Public URL of this frontend (used by the proxy's URL allow-list). |
| `BACKEND_API_FORMAT`         | `https://backend.yourdomain.com/apisite/{0}{1}`    | How to reach the backend's apisite routes. `{0}` = api site name (www, api, assetdelivery, ...), `{1}` = path. |
| `BACKEND_CHAT_URL`           | `https://backend.yourdomain.com/chat`              | SignalR chat hub. Must be absolute on Vercel (`/chat` would hit Vercel itself). |
| `CSRF_KEY`                   | long random string                                 | **Required.** Fixed key for login-CSRF signing. Without it each serverless instance makes its own and logins break on cold starts. |
| `SESSION_KEY`                | long random string                                 | **Required.** Signs the local login session cookie (`ECON_SESSION`) used by username/password auth. |
| `SUPABASE_DB_URL`            | `postgres://econ_web.<ref>:<pw>@aws-0-us-west-2.pooler.supabase.com:5432/postgres` | **Required for login/signup.** Postgres connection string for the local auth API routes. Use the shared **session pooler** (IPv4) with the `[role].[project-ref]` username format - the direct `db.<ref>.supabase.co` host is IPv6-only on the free plan and unreachable from Vercel's IPv4-only lambdas. |
| `COOKIE_DOMAIN_REWRITE`      | *(leave empty on Vercel)*                          | Rewrites `Domain=` on `Set-Cookie` from the backend. Empty/unset strips it (host-only cookies — correct for `*.vercel.app`). Set to `localhost` or your domain if needed. |
| `PROXY_ENABLED`              | `true` (default)                                   | `false` makes the browser call the backend directly (backend then needs CORS + credentials for the Vercel origin). |
| `BACKEND_AUTHORIZATION`      | *(optional)*                                       | Shared secret forwarded to the backend, if your backend requires one. |
| `BACKEND_AUTHORIZATION_HEADER` | *(optional)*                                     | Header name for the above (default `authorization`). |

The proxy (`pages/api/proxy.js`) only forwards to hosts it considers safe: the
domain of `BACKEND_BASE_URL` and the domain of `BACKEND_API_FORMAT`. So the
frontend and the backend may live on **different** domains.

## 3. Backend requirements

* The backend must be **publicly reachable** — a VPS, or a home machine behind
  a Cloudflare Tunnel / ngrok / similar. A reverse proxy that maps
  `https://backend.yourdomain.com/apisite/{0}{1}` onto the .NET site's
  `/apisite/{0}{1}` routes works well.
* For a clean setup use one base domain with split DNS:
  `www.yourdomain.com` → Vercel, `backend.yourdomain.com` → your server. A
  custom domain on Vercel is free and avoids cookie/proxy edge cases.
* **Chat** (`Roblox.EconomyChat` / the SignalR hub at `/chat`) stays on the
  backend; `BACKEND_CHAT_URL` just points the browser at it.

## 4. Database: Supabase Postgres

The services want PostgreSQL 13+. A Supabase project works directly. The
canonical schema (81 tables, generated from the `services/api` knex migrations)
lives in [`database/schema.sql`](../../../database/schema.sql) and is already
applied to the Supabase project, including the `knex_migrations` bookkeeping —
so `npx knex migrate:latest` in `services/api` will see everything as applied.

A dedicated `econ_web` login role exists for the website (SELECT/INSERT/UPDATE/
DELETE on `public`); put its connection string in `SUPABASE_DB_URL` as shown
above. For the backend services (`services/api/config.json` for Knex and
`services/Roblox/Roblox.Website/appsettings.json`), use the project's
`postgres` superuser connection string from the Supabase dashboard:

```json
{
  "knex": {
    "client": "pg",
    "connection": {
      "host": "db.<project-ref>.supabase.co",
      "user": "postgres",
      "password": "<your-supabase-db-password>",
      "database": "postgres",
      "port": 5432,
      "ssl": { "rejectUnauthorized": false }
    }
  }
}
```

Use the **direct** connection (port 5432) or session pooler for the long-running
backend services; the transaction pooler (port 6543) is not a fit for Knex
migrations. Run `npx knex migrate:latest` in `services/api` as usual.

Note: Supabase does not provide **Redis**, which the backend also requires —
run a local Redis (e.g. Memurai on Windows) or any hosted Redis and point the
services at it.

## 5. Logging in (no .ROBLOSECURITY required)

The site has first-class username/password auth backed by the Supabase
database:

* `/signup` (also linked from the navbar and login modal) creates an account
  and logs the user in. `/login` accepts username + password by default.
* Passwords are hashed with **Argon2id** in libsodium's PHC format — the same
  format the .NET backend's `PasswordHasher` uses, so accounts created through
  the website can also log in through the backend later (and vice versa).
* Sessions are a signed JWT in an HttpOnly `ECON_SESSION` cookie (30 days).
* The old "login with a .ROBLOSECURITY cookie" flow is still available on the
  login page as an advanced option (useful while the .NET backend exists and
  issues those cookies).

## 6. What still runs off-Vercel

* Game joins (`PlaceLauncher.ashx`), RCC/game-server, and webplayer asset
  serving depend on the backend being public too — deploying the site on Vercel
  does not cover those.
* Watch Vercel's serverless response size limit (4.5 MB on the Hobby plan) if
  large assets are fetched *through* `/api/proxy` instead of directly from the
  backend.

## 7. Deploy

```sh
cd services/2016-roblox-main
npm i
npm test          # unit tests (proxy URL allow-list etc.)
VERCEL=1 npm run build   # smoke-test the env-driven build
```

Then connect the repo in the Vercel dashboard (or `vercel deploy`) with the
settings above. Remember: env vars are baked at build time — set them first,
then deploy.
