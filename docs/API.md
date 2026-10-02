# DevPulse API reference

Base URL: `/api/v1` (for example `http://localhost:4000/api/v1`).
All request and response bodies are JSON. Timestamps are ISO 8601 strings in UTC; calendar
dates are `YYYY-MM-DD` in the user's time zone.

Request and response schemas are defined once in [`packages/shared`](../packages/shared/src) with
Zod and TypeScript. That package is the source of truth for field names and validation; this
document describes the behaviour around it.

- [Conventions](#conventions)
- [Authentication](#authentication)
- [Endpoints](#endpoints): [Auth](#auth) · [Users](#users) · [Projects](#projects) ·
  [Sessions](#sessions) · [Activity](#activity) · [Analytics](#analytics) ·
  [Integrations](#integrations) · [Devices](#devices) · [Goals](#goals) ·
  [Notifications](#notifications) · [Leaderboard](#leaderboard) · [Search](#search) ·
  [Health](#health)
- [Building the VS Code extension](#building-the-vs-code-extension)

---

## Conventions

### Responses

Successful responses wrap the payload in `data`:

```json
{ "data": { "id": "…" } }
```

Paginated lists add `meta`:

```json
{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
```

`page` starts at 1; `pageSize` defaults to 20 and is capped at 100. `204 No Content` responses have
no body.

### Errors

Errors always use the same shape, never expose stack traces or database messages, and include the
request id (also returned in the `X-Request-Id` header):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid",
    "details": [{ "path": "email", "message": "Enter a valid email address" }],
    "requestId": "7c1d…"
  }
}
```

| Status | `code`             | Meaning                                                             |
| ------ | ------------------ | ------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Invalid input; `details` lists field problems                       |
| 401    | `UNAUTHORIZED`     | Missing, invalid or expired credentials                             |
| 403    | `FORBIDDEN`        | Authenticated but not allowed (e.g. CSRF check failed)              |
| 404    | `NOT_FOUND`        | Missing, **or owned by someone else** (ownership is never revealed) |
| 409    | `CONFLICT`         | Duplicate values or an invalid state change                         |
| 413    | `VALIDATION_ERROR` | Body larger than 512 KB                                             |
| 429    | `RATE_LIMITED`     | Too many requests; see the `RateLimit` header                       |
| 500    | `INTERNAL_ERROR`   | Unexpected failure; the message is generic                          |

### Rate limits

Every route shares a limit of 300 requests per minute per IP. Stricter limits:

| Endpoint                                                    | Limit                              |
| ----------------------------------------------------------- | ---------------------------------- |
| `POST /auth/login`                                          | 10 failed attempts / 15 min per IP |
| `POST /auth/register`                                       | 10 / hour per IP                   |
| `POST /auth/forgot-password`, `/reset-password`             | 5 / 15 min per IP                  |
| `POST /auth/refresh`                                        | 30 / min per IP                    |
| Password-verifying `/users/me/*` endpoints                  | 10 / 15 min per IP                 |
| `POST /integrations/pairing-keys`                           | 10 / 15 min per user               |
| `POST /integrations/pair`                                   | 10 / 15 min per IP                 |
| Editor ingestion (`/activity/sessions`, `/activity/events`) | 120 / min per device               |
| `GET /search`                                               | 120 / min per user                 |

Limits are stored in memory per API instance (see [deployment](DEPLOYMENT.md#scaling)).

---

## Authentication

DevPulse has two kinds of credential.

**Web users** sign in and receive:

- an **access token** (JWT, 15 minutes) returned in the response body. Send it as
  `Authorization: Bearer <token>`. Keep it in memory only.
- a **refresh token** in an `httpOnly`, `SameSite=Strict` cookie named `dp_refresh`, scoped to
  `/api/v1/auth`. It rotates on every refresh and lasts 30 days. Reusing a rotated token after a
  30-second grace window revokes the whole session.

Cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) require the header
`X-DevPulse-Client: web` and, when an `Origin` header is sent, an origin matching `FRONTEND_URL`
(CSRF protection). Every authenticated request re-checks that its session is still active, so
revocation takes effect immediately.

**Editors** (the VS Code extension) authenticate with a long-lived **device credential**
(`dpd_…`) obtained through [pairing](#integrations): `Authorization: Bearer dpd_…`. Device
credentials only work on the editor endpoints and stop working the moment the device is revoked.

In the tables below, **Auth** is `none`, `user` (access token) or `device` (device credential).

---

## Endpoints

### Auth

| Method | Path                    | Auth   | Description                                            |
| ------ | ----------------------- | ------ | ------------------------------------------------------ |
| POST   | `/auth/register`        | none   | Create an account and sign in. `201`                   |
| POST   | `/auth/login`           | none   | Sign in with email or username                         |
| POST   | `/auth/refresh`         | cookie | Rotate the refresh cookie; returns a new access token  |
| POST   | `/auth/logout`          | cookie | End the current session. `204`                         |
| POST   | `/auth/logout-all`      | user   | End every session for the account. `204`               |
| GET    | `/auth/sessions`        | user   | Active browser sessions (`current` marks this one)     |
| DELETE | `/auth/sessions/:id`    | user   | Sign out one session. `204`                            |
| POST   | `/auth/forgot-password` | none   | Email a reset link if the account exists. Always `202` |
| POST   | `/auth/reset-password`  | none   | Set a new password with a reset token. `204`           |

**Register** body: `fullName` (1–80), `username` (3–32, letters, numbers, `-` and `_`; stored
lower-case; reserved names rejected), `email`, `password` (10–128 characters with a letter and a
number or symbol), `confirmPassword`.
Errors: `400` validation; `409` with `details` for `email` and/or `username` already in use.

**Login** body: `identifier` (email or username, case-insensitive), `password`.
Errors: `401` with the same message whether the account exists or not.

**Login, register and refresh** respond with:

```json
{
  "data": {
    "user": {
      "id": "…",
      "email": "…",
      "username": "…",
      "fullName": "…",
      "avatarUrl": null,
      "bio": null,
      "timezone": "Asia/Karachi",
      "isDemo": false,
      "createdAt": "…",
      "settings": {
        "theme": "SYSTEM",
        "weekStartsOn": 1,
        "idleTimeoutMinutes": 5,
        "trackBranchNames": true,
        "trackRepositoryUrl": true,
        "emailNotifications": true,
        "showOnLeaderboard": false
      }
    },
    "accessToken": "eyJ…",
    "expiresIn": 900
  }
}
```

**Reset password** body: `token` (from the email link), `password`, `confirmPassword`. Tokens are
single-use, expire after `PASSWORD_RESET_TTL_MINUTES` and are stored hashed. A successful reset
signs out every session. Errors: `400` for an invalid, used or expired token.

### Users

| Method | Path                 | Auth | Description                                                                                                                                                                                |
| ------ | -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/users/me`          | user | The signed-in user with settings                                                                                                                                                           |
| PATCH  | `/users/me`          | user | Update `fullName`, `bio` (≤280), `timezone` (IANA name), `avatarUrl` (https only)                                                                                                          |
| PATCH  | `/users/me/identity` | user | Change `username` and/or `email`; requires `currentPassword`. The old address is notified of an email change                                                                               |
| PATCH  | `/users/me/settings` | user | Update any of `theme` (`LIGHT`/`DARK`/`SYSTEM`), `weekStartsOn` (0 or 1), `idleTimeoutMinutes` (1–60), `trackBranchNames`, `trackRepositoryUrl`, `emailNotifications`, `showOnLeaderboard` |
| POST   | `/users/me/password` | user | `currentPassword`, `newPassword`, `confirmPassword`; other sessions are signed out. `204`                                                                                                  |
| DELETE | `/users/me`          | user | `password` and `confirmation: "DELETE"`; deletes the account and all its data. `204`                                                                                                       |

Fields not listed are ignored (for example `email` on `PATCH /users/me`).

### Projects

| Method | Path                    | Auth | Description                                                                                                                                        |
| ------ | ----------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/projects`             | user | List with totals. Query: `search`, `language`, `status` (`active`/`archived`/`all`), `sort` (`recent`/`name`/`time`/`created`), `page`, `pageSize` |
| POST   | `/projects`             | user | Create. `201`                                                                                                                                      |
| GET    | `/projects/:id`         | user | Detail with `weekSeconds`, `languages[]` and `devices[]` breakdowns                                                                                |
| GET    | `/projects/:id/history` | user | All-time coding history (see below)                                                                                                                |
| PATCH  | `/projects/:id`         | user | Update fields or `archived: true/false`                                                                                                            |
| DELETE | `/projects/:id`         | user | Delete; its sessions are kept but unassigned. `204`                                                                                                |

Body fields: `name` (1–80), `description` (≤500), `repositoryUrl` (http(s); `.git` and trailing
slashes are stripped; the provider is detected), `primaryLanguage`, `color` (one of `blue`,
`teal`, `violet`, `amber`, `magenta`, `orange`; chosen automatically when omitted).
Each project includes `totalSeconds` (active time) and `sessionCount`.

`GET /projects/:id/history` returns the project's complete record, from the day the account was
created (or the project's first session, if earlier) to today, in the user's time zone. Unlike
`/analytics/report` it has no maximum range.

```json
{
  "data": {
    "timezone": "Asia/Karachi",
    "sinceDate": "2025-08-14",
    "toDate": "2026-10-03",
    "days": 416,
    "firstActivityAt": "2025-08-15T04:12:00.000Z",
    "lastActivityAt": "2026-10-02T13:42:00.000Z",
    "totals": {
      "seconds": 508528,
      "sessions": 103,
      "activeDays": 59,
      "averageActiveDaySeconds": 8619,
      "averageSessionSeconds": 4937,
      "longestDay": { "date": "2026-07-15", "seconds": 26100 }
    },
    "daily": [{ "date": "2026-07-06", "seconds": 5400, "sessions": 2 }],
    "weekly": [{ "date": "2025-08-11", "seconds": 0, "sessions": 0 }],
    "monthly": [{ "date": "2025-08-01", "seconds": 7200, "sessions": 3 }],
    "hourly": [{ "hour": 0, "seconds": 3600 }],
    "weekdays": [{ "weekday": 0, "seconds": 18000 }],
    "sessionLengths": [
      { "key": "short", "label": "Under 30 minutes", "sessions": 12, "seconds": 14400 }
    ]
  }
}
```

`weekly` and `monthly` are zero-filled across the whole history (dates are the first day of each
week or month); `daily` is zero-filled for the most recent 90 days. `hourly` (24 entries),
`weekdays` (7 entries, 0 = Sunday) and `sessionLengths` cover all time. Sessions spanning a
boundary are split proportionally. Errors: `404` if the project does not exist or belongs to
another user.

### Sessions

Web endpoints for viewing and manually logging coding sessions.

| Method | Path            | Auth | Description                                                                                                                                            |
| ------ | --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/sessions`     | user | List. Query: [activity filters](#activity-filters), `source` (`EXTENSION`/`MANUAL`/`IMPORT`), `sort` (`recent`/`oldest`/`longest`), `page`, `pageSize` |
| POST   | `/sessions`     | user | Log a finished session manually (`endedAt` required). `201`                                                                                            |
| GET    | `/sessions/:id` | user | Detail with `languages[]` and event counts                                                                                                             |
| PATCH  | `/sessions/:id` | user | Rename (`title`) or move (`projectId`, or `null` to unassign)                                                                                          |
| DELETE | `/sessions/:id` | user | Delete. `204`                                                                                                                                          |

A session contains `startedAt`, `endedAt`, `durationSeconds` (wall-clock), `activeSeconds`,
`idleSeconds` (= duration − active), `language`, `repository`, `branch`, `editor`,
`filesChanged`, `linesAdded`, `linesRemoved`, `commits`, `status` (`ACTIVE`/`ENDED`), `source`, and
`project` / `device` summaries.

Timing rules (shared with editor ingestion): sessions are at most 24 hours; `endedAt` must be after
`startedAt`; timestamps more than 5 minutes in the future are rejected; `activeSeconds` defaults to
the full duration for finished sessions and is clamped to the duration; per-language times are
scaled down if they exceed active time.

#### Activity filters

Shared by sessions, the timeline and analytics: `from` and `to` (ISO timestamps, `to` exclusive;
sessions are matched by start time), `projectId` (a project id or `none`), `deviceId`, `language`
(sessions that include the language), `repository`.

### Activity

| Method | Path                     | Auth   | Description                                                                                                             |
| ------ | ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/activity/timeline`     | user   | Sessions newest first with cursor paging. Query: activity filters, `cursor`, `limit` (≤100). Response adds `nextCursor` |
| GET    | `/activity/filters`      | user   | Projects, devices, languages and repositories present in your data                                                      |
| POST   | `/activity/sessions`     | device | Start or record a session ([details](#3-record-sessions))                                                               |
| PATCH  | `/activity/sessions/:id` | device | Heartbeat, update or end a session                                                                                      |
| POST   | `/activity/events`       | device | Upload a batch of up to 500 events. `202` with `{ accepted, duplicates }`                                               |

### Analytics

| Method | Path                     | Auth | Description                                                                                                                                                                                              |
| ------ | ------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/analytics/overview`    | user | Dashboard data: today and this week (with same-span comparisons), weekly sessions, active projects, streak, last 7 days, today's session blocks, weekly project and language breakdowns, recent sessions |
| GET    | `/analytics/report`      | user | Full report for a range. Query: activity filters (default last 30 days, maximum 366 days)                                                                                                                |
| GET    | `/analytics/coding-time` | user | Time series. Query: activity filters and `granularity` (`day`/`week`/`month`)                                                                                                                            |

The report contains `totals` and `previous` (the preceding range of equal length) with `seconds`,
`sessions`, `activeDays`, `dailyAverageSeconds` and `averageSessionSeconds`; `daily`, `weekly` and
`monthly` series; `hourly` (24 entries) and `weekdays` (7 entries, 0 = Sunday) distributions;
`projects`, `languages` and `devices` breakdowns; and `sessionLengths` (under 30 minutes, 30–90
minutes, over 90 minutes).

All analytics use **active** time, computed in the user's time zone. A session that crosses a
boundary (midnight, an hour, a week) is split in proportion to how much of it falls on each side.

### Integrations

| Method | Path                                 | Auth   | Description                                                                    |
| ------ | ------------------------------------ | ------ | ------------------------------------------------------------------------------ |
| POST   | `/integrations/pairing-keys`         | user   | Create a pairing key (returned once). Revokes any unused key. `201`            |
| GET    | `/integrations/pairing-keys`         | user   | Last 10 keys: `hint`, `status` (`active`/`used`/`expired`/`revoked`), `device` |
| DELETE | `/integrations/pairing-keys/:id`     | user   | Revoke an unused key. `204`                                                    |
| POST   | `/integrations/pair`                 | none   | Exchange a key for a device credential. `201`                                  |
| GET    | `/integrations/extension/config`     | device | Tracking preferences, device and account summary                               |
| GET    | `/integrations/extension/summary`    | device | Account-wide active seconds `todaySeconds` and `weekSeconds`, and `timezone`   |
| PATCH  | `/integrations/extension/device`     | device | Rename this device (`name`, 1–60); returns `{ id, name }`                      |
| POST   | `/integrations/extension/disconnect` | device | Revoke this device's own credential. `204`                                     |

### Devices

| Method | Path           | Auth | Description                                                                                                               |
| ------ | -------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/devices`     | user | Connected devices first, then revoked ones, with usage totals                                                             |
| GET    | `/devices/:id` | user | One device                                                                                                                |
| PATCH  | `/devices/:id` | user | Rename (`name`, 1–60)                                                                                                     |
| DELETE | `/devices/:id` | user | Revoke. The credential stops working immediately; open sessions are ended at their last heartbeat; history is kept. `204` |

Device responses never include hostnames or credentials, only a non-secret `credentialPrefix`.

### Goals

| Method | Path         | Auth | Description                                                                                                                                                                       |
| ------ | ------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/goals`     | user | Goals with current-period `progress`. Query: `archived=true` to include archived                                                                                                  |
| POST   | `/goals`     | user | Create: `metric` (`CODING_TIME`/`SESSIONS`), `period` (`DAILY`/`WEEKLY`/`MONTHLY`), `target` (seconds or a count), optional `projectId` and `title`. Up to 20 active goals. `201` |
| PATCH  | `/goals/:id` | user | Update `target`, `title` or `archived`                                                                                                                                            |
| DELETE | `/goals/:id` | user | Delete. `204`                                                                                                                                                                     |

`progress` has `current`, `target`, `ratio`, `completed`, `periodStart` and `periodEnd`.

### Notifications

| Method | Path                          | Auth | Description                                                         |
| ------ | ----------------------------- | ---- | ------------------------------------------------------------------- |
| GET    | `/notifications`              | user | Paginated; `unread=true` filters. `meta.unread` is the unread total |
| GET    | `/notifications/unread-count` | user | `{ count }`                                                         |
| POST   | `/notifications/read-all`     | user | Mark all read; returns `{ updated }`                                |
| PATCH  | `/notifications/:id`          | user | `{ read: true/false }`. `204`                                       |
| DELETE | `/notifications/:id`          | user | Delete. `204`                                                       |

Notifications are created for device connections and revocations, password changes and resets,
and goals reaching 80% and 100% (once per goal per period). They are kept for 90 days.

### Leaderboard

| Method | Path           | Auth | Description                                                           |
| ------ | -------------- | ---- | --------------------------------------------------------------------- |
| GET    | `/leaderboard` | user | Query: `period` (`day`/`week`/`month`, default `week`), `limit` (≤50) |

Ranks users who enabled `showOnLeaderboard` by active time in the current **UTC** day, ISO week or
month (at least one minute to be listed). Entries expose only `rank`, `username`, `fullName`,
`avatarUrl`, `seconds` and `isCurrentUser`. `me` always reports the caller's own time and, if they
opted in, their rank.

### Search

| Method | Path      | Auth | Description                                                                                      |
| ------ | --------- | ---- | ------------------------------------------------------------------------------------------------ |
| GET    | `/search` | user | Query: `q` (2–80 characters), `type` (`all`/`projects`/`sessions`/`devices`), `page`, `pageSize` |

With `type=all`, the top five matches per group are returned; with a single type, results are
paginated. Each result has `id`, `type`, `title`, `subtitle`, `href` (an in-app path), `color` and
`date`.

### Health

| Method | Path            | Auth | Description                          |
| ------ | --------------- | ---- | ------------------------------------ |
| GET    | `/health`       | none | Liveness: the process is running     |
| GET    | `/health/ready` | none | Readiness: the database is reachable |

---

## Building the VS Code extension

Everything the extension needs exists on the server today. This section is the contract.

### 1. Pair

1. The user opens **Settings → Integrations** in the web app and generates a key such as
   `DP-7F3K-X92M-Q8PR`. It works once and expires after 10 minutes.
2. The extension asks for the key (accept any case, with or without spaces, dashes or the `DP`
   prefix; the alphabet excludes `0`, `O`, `1`, `I` and `L`) and calls:

```http
POST /api/v1/integrations/pair
Content-Type: application/json

{
  "key": "DP-7F3K-X92M-Q8PR",
  "device": {
    "name": "Ubuntu Laptop",
    "platform": "linux",
    "editor": "vscode",
    "editorVersion": "1.104.0",
    "extensionVersion": "0.1.0"
  }
}
```

`platform` is one of `linux`, `darwin`, `win32` or `other`; `hostname` is optional and never shown.

3. On `201`, store `data.credential` in VS Code **SecretStorage**. It is shown only once.

```json
{
  "data": {
    "credential": "dpd_…",
    "device": { "id": "…", "name": "Ubuntu Laptop" },
    "account": { "username": "sam", "fullName": "Sam Carter" },
    "config": {
      "idleTimeoutMinutes": 5,
      "trackBranchNames": true,
      "trackRepositoryUrl": true,
      "heartbeatIntervalSeconds": 60
    }
  }
}
```

An invalid, expired, used or revoked key returns `400` with one generic message.

### 2. Read the configuration

Call `GET /integrations/extension/config` on startup and every few hours. Respect
`idleTimeoutMinutes`, and do not send branch names or repository URLs when the flags are off (the
server discards them anyway).

### 3. Record sessions

Start a session when the user begins working in a workspace:

```http
POST /api/v1/activity/sessions
Authorization: Bearer dpd_…

{
  "clientSessionId": "4f1c2b9e-…",
  "startedAt": "2026-09-30T09:00:00Z",
  "project": { "name": "notes-saver", "repositoryUrl": "https://github.com/me/notes-saver" },
  "language": "typescript",
  "repository": "github.com/me/notes-saver",
  "branch": "feature/sync"
}
```

- `clientSessionId` makes the call idempotent: retrying returns the same session with `200`
  instead of `201`.
- `project` is matched to an existing project by repository URL, then by name (case-insensitive),
  or created. Alternatively pass a known `projectId`.
- Starting a new session automatically ends any session this device left open.

Send a heartbeat every `heartbeatIntervalSeconds` with **cumulative** totals for the session:

```http
PATCH /api/v1/activity/sessions/{id}

{
  "lastHeartbeatAt": "2026-09-30T09:30:00Z",
  "activeSeconds": 1520,
  "languages": [{ "language": "typescript", "activeSeconds": 1300 }, { "language": "css", "activeSeconds": 220 }],
  "filesChanged": 6, "linesAdded": 140, "linesRemoved": 32, "commits": 1
}
```

End it with `endedAt` (plus final totals). Resending the same `endedAt` is harmless; any other
timing change to an ended session returns `409`. Sessions that stop sending heartbeats are closed
by the server after 30 minutes, at their last heartbeat.

**Idle time:** detect inactivity in the editor. Only count time as active while the user is typing,
navigating or debugging within the idle timeout; the server derives idle time as duration minus
active time.

### 4. Send events (optional)

Batch events and upload them periodically (up to 500 per request):

```http
POST /api/v1/activity/events

{
  "events": [
    { "clientEventId": "e-1", "type": "FILE_CHANGED", "occurredAt": "…", "sessionId": "…",
      "language": "typescript", "metadata": { "fileExtension": ".ts", "linesAdded": 3 } },
    { "clientEventId": "e-2", "type": "GIT_COMMIT", "occurredAt": "…", "sessionId": "…",
      "metadata": { "commitCount": 1 } }
  ]
}
```

Event types: `ACTIVITY`, `SESSION_STARTED`, `SESSION_ENDED`, `FILE_OPENED`, `FILE_CHANGED`,
`IDLE_STARTED`, `IDLE_ENDED`, `GIT_COMMIT`, `DEBUG_STARTED`, `DEBUG_STOPPED`.
`metadata` accepts **only** `fileExtension`, `linesAdded`, `linesRemoved`, `commitCount`,
`idleSeconds`, `debugType` and `reason`; any other key is rejected. File names, paths and contents
cannot be sent. Retries are deduplicated by `clientEventId`.

### 5. Handle errors

- `401` on any device endpoint means the device was revoked or disconnected: clear the stored
  credential and prompt the user to pair again.
- `429`: back off using the `RateLimit` header and keep events queued locally.
- Network errors and `5xx`: retry with exponential backoff; idempotency keys make retries safe.

### 6. Show totals and rename the device

`GET /integrations/extension/summary` returns today's and this week's active time for the whole
account (all devices), computed in the user's time zone; poll it every few minutes at most.
`PATCH /integrations/extension/device` with `{ "name": "Work Laptop" }` renames the device; the
web Devices page shows the same name.

### 7. Disconnect

When the user signs out in the editor, call `POST /integrations/extension/disconnect`, then delete
the credential from SecretStorage.

### Privacy requirements for the extension

Send durations, timestamps, project names, languages, repository metadata, branch and device
metadata only. Never send source code, file contents, file paths, passwords, secrets or `.env`
values.
