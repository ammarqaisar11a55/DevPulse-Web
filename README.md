# DevPulse

DevPulse is a coding analytics platform for developers. It measures how much time you spend
actively coding, on which projects, in which languages and on which machines, and turns that into
a dashboard, analytics, goals and an opt-in leaderboard.

This repository contains the **web application and API**. A VS Code extension will connect to it
through the pairing and ingestion API that is already implemented; see
[Building the VS Code extension](docs/API.md#building-the-vs-code-extension).

## Features

- **Accounts:** registration, sign-in by email or username, password reset by email, active
  session management, sign out everywhere, account deletion.
- **Dashboard:** today's sessions on a 24-hour pulse strip, weekly totals compared with last week,
  streak, 7-day chart, top projects and languages, goals and recent sessions.
- **Analytics:** coding time by day, week or month; hour-of-day and weekday patterns; project,
  language and device breakdowns; session lengths; filters and custom date ranges.
- **Projects:** create, edit, archive and delete projects; totals, language and device breakdowns.
- **Goals:** daily, weekly or monthly targets for coding time or sessions, with progress
  notifications.
- **VS Code integration:** single-use pairing keys, device credentials, session and event
  ingestion, device management and revocation.
- **Leaderboard:** opt-in ranking by coding time for the day, week or month.
- **Notifications, global search (Ctrl/Cmd+K), light and dark themes** that follow the system
  setting and are saved to your account.
- **Privacy first:** only metadata is collected, never source code. Branch names and repository
  URLs can be switched off, and the server discards them when you do.

## Tech stack

| Area     | Technology                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Web      | React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4, Radix UI, Recharts, Motion |
| API      | Node.js, Express 5, TypeScript, Zod                                                                  |
| Database | PostgreSQL with Prisma ORM                                                                           |
| Auth     | Argon2id password hashing, short-lived JWT access tokens, rotating httpOnly refresh cookies          |
| Testing  | Vitest, Supertest, Testing Library                                                                   |

## Architecture

```text
                      DevPulse web app (React)
                               │  /api/v1 (JSON, access token)
                               ▼
┌──────────────────────────── API (Express) ─────────────────────────────┐
│ auth · users · projects · sessions · activity · analytics · goals ·    │
│ notifications · leaderboard · search · devices · integrations          │
│                                                                        │
│ integrations/  ◄── VS Code extension (device credential)               │
│   pairing keys, device auth, session and event ingestion               │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
                            PostgreSQL
```

- **Monorepo** with npm workspaces: `apps/server`, `apps/web`, and `packages/shared`, which holds
  the Zod schemas, API types and time-zone utilities used by both sides (and by the future
  extension).
- **Server modules** keep routes, controllers, services and repositories separate. Every query is
  scoped to the signed-in user; other users' records return 404.
- **Editor-specific code** lives in `modules/integrations`; everything else is editor-agnostic.
- **Domain events** (`session.recorded`, `device.connected`, …) let notifications and goals react
  to changes without coupling modules together.
- **Analytics** run as SQL aggregations in the user's time zone. Sessions that span a boundary
  (midnight, an hour, a week) are split proportionally.

```text
apps/
  server/
    prisma/            schema, migrations, demo seed
    src/
      config/          validated environment
      database/        Prisma client, session-time SQL helpers
      middleware/      auth, validation, CSRF, rate limits, errors
      modules/         one folder per feature
      jobs/            background jobs
    tests/             integration tests (real PostgreSQL)
  web/
    src/
      components/      design system (ui/, charts/, pulse/)
      features/        one folder per feature (pages, API clients, components)
      layouts/         application shell
      lib/             API client, formatting, colours, time zones
      routes/          lazily loaded routes
packages/
  shared/              contracts shared by server, web and future clients
docs/
  API.md               endpoint reference and extension guide
  DEPLOYMENT.md        production setup
```

## Getting started

### Prerequisites

- Node.js 20.19+ (`.nvmrc` pins 22)
- PostgreSQL 14+

### 1. Install

```bash
npm install
```

### 2. Create the databases

Create a role, a development database and a separate test database (the tests empty every table):

```bash
sudo -u postgres psql -c "CREATE ROLE devpulse WITH LOGIN PASSWORD 'devpulse' CREATEDB;"
sudo -u postgres createdb -O devpulse devpulse
sudo -u postgres createdb -O devpulse devpulse_test
```

### 3. Configure

```bash
cp apps/server/.env.example apps/server/.env
cp apps/server/.env.test.example apps/server/.env.test
```

Set `DATABASE_URL` in `.env` and `TEST_DATABASE_URL` in `.env.test` to your databases, and replace
the three secrets with random values (`openssl rand -base64 48`). The web app works without an
`.env` file in development. See [`apps/web/.env.example`](apps/web/.env.example) for the options.

### 4. Migrate and seed

```bash
npm run db:migrate   # apply migrations
npm run db:seed      # optional: demo accounts with 90 days of activity
```

The seed creates two demo accounts flagged `isDemo`. Re-running it replaces only those accounts,
and it refuses to run when `NODE_ENV=production`.

| Account                                   | Password          |
| ----------------------------------------- | ----------------- |
| `demo@devpulse.dev` (username `demo`)     | `devpulse-demo-1` |
| `jordan@devpulse.dev` (username `jordan`) | `devpulse-demo-1` |

### 5. Run

```bash
npm run dev
```

- Web app: http://localhost:5173 (proxies `/api` to the API)
- API: http://localhost:4000/api/v1

Without SMTP settings, emails (such as password reset links) are written to the API log.

## Scripts

Run from the repository root:

| Command                                                 | Description                                           |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                                           | API and web app with reload                           |
| `npm run build`                                         | Production builds of the API and web app              |
| `npm start`                                             | Start the built API                                   |
| `npm run check`                                         | Lint, typecheck, all tests and format check           |
| `npm test`                                              | Server and web tests                                  |
| `npm run lint` / `npm run typecheck` / `npm run format` | Individual quality checks                             |
| `npm run db:migrate`                                    | Create and apply migrations (development)             |
| `npm run db:deploy`                                     | Apply pending migrations (production)                 |
| `npm run db:seed`                                       | Load demo data                                        |
| `npm run db:reset`                                      | Drop, re-migrate and re-seed the development database |
| `npm run db:studio`                                     | Prisma Studio                                         |

## Testing

- **Server:** integration tests run against the real PostgreSQL database in `TEST_DATABASE_URL`,
  whose name must contain `test`. They cover authentication and session security, ownership,
  projects, session timing, analytics aggregation across time zones and DST, pairing, devices,
  goals, notifications, search, the leaderboard and security behaviour.
- **Web:** unit and component tests for formatting, time zones, redirects, theming, chart colours,
  the API client's token refresh and form accessibility.
- **CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint, typecheck, format
  check, all tests and the build on every push and pull request, against PostgreSQL in a non-UTC
  time zone.

## Documentation

- [API reference and VS Code extension guide](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)

## Security notes

- Passwords are hashed with Argon2id. Refresh tokens, reset tokens, pairing keys and device
  credentials are stored only as hashes.
- Refresh cookies are `httpOnly`, `SameSite=Strict` and path-scoped; cookie endpoints also
  require a custom header and a trusted origin.
- All input is validated with Zod; all SQL is parameterised.
- Rate limits protect sign-in, registration, password reset, pairing, ingestion and search.
- Known advisory: `npm audit` reports `deepmerge-ts` (GHSA-ggr8-5vv4-36mx) through Prisma's CLI
  config loader. It only processes the project's own config file and is not reachable from API
  requests; it will clear with a Prisma upgrade.

## Status and remaining work

Implemented and tested: everything listed under [Features](#features). Still to do:

- **Sessions page** (`/sessions`) and **Activity timeline page** (`/activity`), plus a
  **session detail page**. The API (`GET /sessions`, `GET /activity/timeline`,
  `GET /sessions/:id`), API clients, filter bar and manual logging dialog exist; the pages and
  their navigation links are not built yet.
- **Project detail charts:** the project page shows totals and breakdowns; time-series charts can
  reuse `/analytics/report?projectId=…`.
- **Terms of service page**, and email verification for new addresses.
- **Multi-instance deployments:** a shared rate-limit store and a single job runner (see
  [Scaling](docs/DEPLOYMENT.md#scaling)).
- **The VS Code extension itself**, which is the next phase.
