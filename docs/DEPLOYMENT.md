# Deploying DevPulse

DevPulse is two deployables:

- **API** (`apps/server`): a Node.js process (Express) backed by PostgreSQL.
- **Web app** (`apps/web`): static files produced by `vite build`.

The recommended setup serves both from **one origin** through a reverse proxy: the web app at `/`
and the API at `/api/`. The refresh-token cookie is then first-party and `SameSite=Strict`, and no
CORS is involved for the browser.

```text
             https://devpulse.example.com
                         │
                   reverse proxy (TLS)
              ┌──────────┴───────────┐
          /api/*                     /*
   Node API (port 4000)      apps/web/dist (static)
              │
         PostgreSQL
```

## Requirements

- Node.js 20.19 or newer (22 LTS recommended)
- PostgreSQL 14 or newer
- A TLS-terminating reverse proxy (nginx, Caddy, a load balancer or a PaaS router)

## 1. Configure the environment

All configuration for both the web app and the API lives in **one file** at the repository
root, created from [`.env.production.example`](../.env.production.example):

```bash
cp .env.production.example .env.production
```

`.env.production` is git-ignored. Its frontend section (`VITE_*` variables) is read by the web
build; only `VITE_*` variables are copied into the browser bundle, so the API secrets in the same
file never reach the client. `npm start` and `npm run db:deploy:prod` read the backend section.
Variables set by your hosting platform take precedence over the file, so on a PaaS you can paste
the same values into its settings instead. The backend variables are:

| Variable                                                                            | Production value                                                                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                          | `production`                                                                                               |
| `PORT`                                                                              | Port the API listens on, e.g. `4000`                                                                       |
| `FRONTEND_URL`                                                                      | Public web origin, e.g. `https://devpulse.example.com` (used for CORS, CSRF origin checks and email links) |
| `API_URL`                                                                           | Public API origin (the same origin when using one domain)                                                  |
| `DATABASE_URL`                                                                      | PostgreSQL connection string                                                                               |
| `JWT_SECRET`, `REFRESH_SECRET`, `PAIRING_SECRET`                                    | Three **different** random values of at least 32 characters: `openssl rand -base64 48`                     |
| `COOKIE_SECURE`                                                                     | `true` (required in production; the API refuses to start otherwise)                                        |
| `TRUST_PROXY`                                                                       | Number of proxies in front of the API, usually `1`, so client IPs and rate limits are correct              |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `EMAIL_FROM` | Mail server for password reset and security emails                                                         |
| `LOG_LEVEL`                                                                         | `info` (logs are JSON on stdout)                                                                           |

The API validates its configuration at startup and exits with a clear message if anything is
missing or unsafe. Never commit `.env` files; only the `.env.example` files are tracked.

The web app has one variable, `VITE_API_URL`, read at build time: keep `/api/v1` when the API is
served on the same origin. For a separate API origin, set it to that origin (for example
`https://api.devpulse.example.com/api/v1`) and set `FRONTEND_URL` to the web origin.

For Supabase, use the **Session pooler** connection string (project → Connect → Session pooler)
with `?sslmode=require`. The direct `db.<project>.supabase.co` host only has an IPv6 address and
is unreachable from most servers.

Every table has row level security enabled with no policies (migration
`enable_row_level_security`). The API connects as the tables' owner, which bypasses RLS, while
other roles, such as the `anon` and `authenticated` keys of Supabase's Data API, see no rows.
DevPulse does not use the Data API, so you can also turn it off in the Supabase dashboard. Tables
added in future migrations must enable RLS the same way.

## 2. Build

```bash
npm ci
npm run build
```

This produces `apps/server/dist/server.js` (a single bundle that includes the shared package) and
the static web app in `apps/web/dist/`.

## 3. Migrate the database

Run pending migrations on every deploy, before starting the new API version:

```bash
npm run db:deploy:prod
```

This reads `DATABASE_URL` from `.env.production` and fails if the file is missing, so it can
never fall back to a development database. When the variables come from your platform instead,
run `npm run db:deploy`.

Migrations are forward-only SQL files in `apps/server/prisma/migrations`. Never run
`db:migrate` (development only) or `db:seed` against production; the seed script refuses to run
when `NODE_ENV=production` unless explicitly overridden.

## 4. Run the API

```bash
npm start
```

It loads `.env.production` (which sets `NODE_ENV=production`).

Run it under a process manager (systemd, a container orchestrator or your platform's runtime) that
restarts it on failure. The API shuts down gracefully on `SIGTERM`, finishing in-flight requests
for up to 10 seconds.

Health checks:

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/health/ready` (checks the database)

## 5. Serve the web app and proxy the API

Example nginx server block:

```nginx
server {
  listen 443 ssl http2;
  server_name devpulse.example.com;

  # ssl_certificate / ssl_certificate_key …

  root /srv/devpulse/apps/web/dist;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 1m;
  }

  # Hashed build assets can be cached forever.
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  # Single-page app: unknown paths fall back to index.html, which must not be cached.
  location / {
    add_header Cache-Control "no-cache";
    try_files $uri /index.html;
  }
}
```

The API already sends security headers (Helmet). If you add a Content-Security-Policy for the web
app, allow the small inline theme script in `apps/web/index.html` by hash.

## Scaling

The API is stateless apart from two in-process components, which matter only when running more
than one instance:

- **Rate limiting** uses an in-memory store per instance. Plug a shared store (such as
  `rate-limit-redis`) into `createRateLimiter` in `apps/server/src/middleware/rate-limit.ts`.
- **Background jobs** (closing sessions whose editor stopped sending heartbeats) run on an
  in-process timer in every instance. The job is idempotent, so duplicates are harmless, but it can
  also move to a single worker or a scheduled job.

Domain events (notifications) are delivered in-process after the triggering write. A durable queue
can replace `apps/server/src/utils/domain-events.ts` without changing the emitters.

Analytics query `coding_sessions` directly, backed by the `(user_id, started_at)` index. At larger
volumes, add a pre-aggregated daily table refreshed by a job; the analytics repository is the only
place that would change.

## Backups and data

- Back up PostgreSQL regularly (for example with `pg_dump` or your provider's snapshots).
- Deleting an account cascades to all of its data.
- Notifications older than 90 days are pruned automatically.

## Checklist

- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`, HTTPS everywhere
- [ ] Three distinct, random secrets
- [ ] `FRONTEND_URL` and `API_URL` set to the public origins
- [ ] `TRUST_PROXY` matches your proxy setup
- [ ] SMTP configured, so password reset emails are delivered
- [ ] `npm run db:deploy` run before starting the new version
- [ ] Health checks wired to `/api/v1/health/ready`
- [ ] Database backups scheduled

## Deploying to Vercel

The repository deploys to Vercel as one project: the web app is served as static files and the
API runs as a serverless function on the same domain ([`vercel.json`](../vercel.json),
[`api/index.js`](../api/index.js)), so the refresh cookie stays first-party.

1. Import the GitHub repository into Vercel. Leave the framework preset as **Other**; the build
   settings come from `vercel.json`.
2. Add every backend variable from [`.env.production.example`](../.env.production.example) in
   **Project Settings → Environment Variables**, with these differences:
   - `DATABASE_URL`: the Supabase **transaction pooler** URI (port 6543) with
     `?pgbouncer=true&connection_limit=1&sslmode=require`.
   - `FRONTEND_URL` and `API_URL`: the production domain, for example
     `https://devpulse.vercel.app`.
   - `TRUST_PROXY=1` and `COOKIE_SECURE=true`.
   - `CRON_SECRET`: a random value. Vercel Cron sends it to the stale-session job.
3. Run migrations from your machine with the session pooler URI: `npm run db:deploy:prod`.
4. Deploy. Every push to `main` deploys again.

Serverless differences:

- The stale-session sweep runs from Vercel Cron, once a day by default (the Hobby plan's limit).
  On Pro, change the schedule in `vercel.json` to `*/5 * * * *`. Totals are unaffected either
  way; only the "in progress" label lingers on abandoned sessions.
- Rate limits are counted per function instance, so they are looser than on a single server.
