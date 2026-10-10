# Smart Verify — Backend

REST API for the Smart Verify mobile app (`../`). Node.js + TypeScript, Fastify 5, PostgreSQL, Prisma 7, Zod,
Swagger/OpenAPI, Vitest.

**Status: setup only.** The server starts, connects to the database and serves `/health` and `/docs`.
No feature modules, models or migrations yet. The contract the app expects is in
[`../docs/BACKEND.md`](../docs/BACKEND.md).

## Quick start (development)

Requirements: Node.js ≥ 22.12, and either Docker Desktop (local PostgreSQL) or a hosted PostgreSQL URL.

```bash
cd backend
npm install
cp .env.example .env            # set DATABASE_URL
npm run db:up                   # optional: PostgreSQL 17 in Docker on localhost:5433
npm run db:generate             # generate the Prisma client into src/generated (git-ignored)
npm run dev                     # http://localhost:3000
```

| What | URL |
|---|---|
| API base | `http://localhost:3000/api/v1` |
| Health | `GET http://localhost:3000/api/v1/health` |
| Swagger UI | `http://localhost:3000/docs` (OpenAPI JSON at `/docs/json`) |

Other commands: `npm test` · `npm run typecheck` · `npm run lint` · `npm run format` · `npm run build` then `npm start`.
Schema changes: edit `prisma/schema.prisma`, then `npm run db:migrate` (dev) or `npm run db:deploy` (other databases).

## Environment variables (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development` · `test` · `production` |
| `HOST` / `PORT` | `0.0.0.0` / `3000` | `0.0.0.0` lets phones on the same Wi-Fi reach the API |
| `LOG_LEVEL` | `info` | Pino level. Authorization headers are redacted |
| `DATABASE_URL` | — | Required |
| `TEST_DATABASE_URL` | — | Required for `npm test`. Must contain "test" |
| `CORS_ORIGINS` | `http://localhost:8081` | Comma-separated browser origins (Expo web). Native apps don't need CORS |

The server validates all variables at startup and exits with a list of the invalid ones (values are never printed).

## Structure

```
backend/
├── prisma/            schema.prisma, migrations/
├── docker/            init-test-db.sql (creates smartverify_test)
├── src/
│   ├── app.ts         Fastify setup, plugins, /api/v1 routes
│   ├── server.ts      Entry point, graceful shutdown
│   ├── config/        env.ts — Zod-validated environment
│   ├── plugins/       prisma, swagger, errors
│   ├── modules/       feature modules (one folder each)
│   ├── providers/     external integrations (banks, payment providers)
│   ├── services/      shared services
│   ├── shared/        errors (codes), schemas, utils
│   ├── generated/     Prisma client (generated, git-ignored)
│   └── tests/         Vitest suites + test-only fixtures
├── docker-compose.yml PostgreSQL (and an optional `api` profile)
└── Dockerfile         Production image (run migrations separately with `npm run db:deploy`)
```

Errors are always `{ "error": { "code": "…" } }` — codes only, no stack traces or database details.

## Connecting a phone

Phone and PC on the same Wi-Fi, backend on `HOST=0.0.0.0`, and inbound TCP 3000 allowed for Private networks
(admin PowerShell: `New-NetFirewallRule -DisplayName "Smart Verify API (dev)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow`).
Test from the phone's browser: `http://<PC IP>:3000/api/v1/health`. Plain `http` is for development only.

## Troubleshooting

- **`failed to connect to the docker API`** — start Docker Desktop, then `npm run db:up`.
- **Port 5432 in use** — expected if PostgreSQL is installed locally; this project uses host port **5433**.
- **`TEST_DATABASE_URL must point at a test database`** — the URL must contain "test".
- **`Invalid environment configuration`** — the message lists which variables are missing or invalid.
