# Smart Verify — Backend

REST API for the Smart Verify mobile app (`../`). Node.js + TypeScript, Fastify 5, PostgreSQL 17,
Prisma 7, Zod, Argon2id PIN hashing, JWT sessions, Swagger/OpenAPI, Vitest.

The contract the app expects is in [`../docs/BACKEND.md`](../docs/BACKEND.md).

## Quick start (development)

Requirements: Node.js ≥ 22.12, Docker Desktop (running).

```bash
cd backend
npm install
cp .env.example .env            # then set JWT_SECRET (command is in the file)
npm run db:up                   # PostgreSQL 17 in Docker on localhost:5433
npm run db:deploy               # apply migrations (or `npm run db:migrate` while changing the schema)
npm run db:generate             # generate the Prisma client into src/generated (git-ignored)
npm run db:seed                 # optional demo business, development only
npm run dev                     # http://localhost:3000
```

| What | URL |
|---|---|
| API base | `http://localhost:3000/api/v1` |
| Health | `GET http://localhost:3000/api/v1/health` |
| Swagger UI | `http://localhost:3000/docs` (OpenAPI JSON at `/docs/json`) |

Other commands: `npm test` · `npm run typecheck` · `npm run lint` · `npm run format` · `npm run build` then `npm start`.

### Demo accounts (`npm run db:seed`, development only)

| Who | Phone | PIN |
|---|---|---|
| Owner Abebe (Restaurant Plus) | 912345678 | 123456 |
| Waiter Dawit G. | 911111111 | 1111 |
| Waiter Selam T. | 922222222 | 2222 |
| Chef Hana M. | 933333333 | 3333 |
| Manager Yonas B. (inactive) | 944444444 | 4444 |

The seed refuses to run when `NODE_ENV=production`. Never seed a production database.

## Environment variables (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development` · `test` · `production` |
| `HOST` / `PORT` | `0.0.0.0` / `3000` | `0.0.0.0` lets phones on the same Wi-Fi reach the API |
| `LOG_LEVEL` | `info` | Pino level. Authorization headers are redacted; bodies (PINs) are not logged |
| `DATABASE_URL` | — | Required. Local Docker: `postgresql://smartverify:smartverify_dev_password@localhost:5433/smartverify?schema=public` |
| `TEST_DATABASE_URL` | — | Required for `npm test`. Must contain "test" |
| `JWT_SECRET` | — | Required, ≥ 32 chars, random |
| `SESSION_TTL_HOURS` | `12` | Session length without "Remember me" |
| `SESSION_REMEMBER_TTL_DAYS` | `30` | Session length with "Remember me" (registration uses this) |
| `CORS_ORIGINS` | `http://localhost:8081` | Comma-separated browser origins (Expo web). Native apps don't need CORS |
| `BUSINESS_TIMEZONE` | `Africa/Addis_Ababa` | "Today" / report day boundaries |
| `ALLOW_UNPAID_SUBSCRIPTIONS` | `false` | Dev only: start plans without payment. Startup fails if `true` in production |
| `SIGN_IN_MAX_ATTEMPTS` / `SIGN_IN_WINDOW_MINUTES` | `5` / `15` | Sign-in limit per IP + phone |
| `REGISTER_MAX_PER_HOUR` | `10` | Registration limit per IP |

The server validates all variables at startup and exits with a list of the invalid ones (values are never printed).

## Connecting the Expo app

The app's client is `../src/lib/api/client.ts`. Its base URL is `EXPO_PUBLIC_API_URL` if set, otherwise the
IP of the computer running Metro + `:3000/api/v1` (works for Expo Go on a phone and for emulators).

| Device | Base URL |
|---|---|
| Physical phone (Expo Go, same Wi-Fi) | `http://<your PC's Wi-Fi IP>:3000/api/v1` — find the IP with `ipconfig` (IPv4 Address) |
| Android emulator | `http://10.0.2.2:3000/api/v1` |
| iOS simulator / Expo web | `http://localhost:3000/api/v1` |

For a physical phone:
1. Phone and PC on the **same Wi-Fi** (not a guest network with client isolation).
2. Backend listening on `0.0.0.0` (the default `HOST`).
3. Allow inbound TCP 3000 in Windows Defender Firewall for **Private** networks, e.g. in an admin PowerShell:
   `New-NetFirewallRule -DisplayName "Smart Verify API (dev)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow`
4. Test from the phone's browser: `http://<PC IP>:3000/api/v1/health`.

Plain `http` is for local development only; production must use HTTPS.

## Structure

```
backend/
├── prisma/            schema.prisma, migrations/ (with extra SQL constraints), seed.ts
├── docker/            init-test-db.sql (creates smartverify_test)
├── src/
│   ├── app.ts         Fastify setup, plugins, /api/v1 routes (public vs authenticated)
│   ├── server.ts      Entry point, graceful shutdown
│   ├── config/        env.ts — Zod-validated environment
│   ├── plugins/       prisma, auth (JWT + server sessions, role checks), swagger, errors
│   ├── modules/       auth, staff, subscriptions, bank-accounts, transactions, verification,
│   │                  menu, tables, fees, payments (calculations)
│   ├── providers/     banks.ts (supported bank list)
│   ├── services/      pin-hasher.ts (Argon2id)
│   ├── shared/        errors (codes), schemas (phone, PIN, money), utils (business day)
│   ├── generated/     Prisma client (generated, git-ignored)
│   └── tests/         Vitest suites + test-only fixtures
├── docker-compose.yml PostgreSQL (and an optional `api` profile)
└── Dockerfile         Production image (run migrations separately with `npm run db:deploy`)
```

## API status

All routes are under `/api/v1`. Errors are always `{ "error": { "code": "…" } }`.

| Area | Endpoints | Status |
|---|---|---|
| Health | `GET /health` | ✅ |
| Auth | `POST /auth/register`, `POST /auth/sign-in`, `POST /auth/sign-out`, `GET /auth/me` | ✅ |
| Staff | `GET /staff`, `POST /staff`, `PATCH /staff/:id` | ✅ |
| Plan / subscription | `GET /subscription`, `PATCH /business/plan`, `POST /subscription` | ✅ (no payment step — see below) |
| Banks / accounts | `GET /banks`, `GET/POST /bank-accounts`, `DELETE /bank-accounts/:id` | ✅ |
| Transactions | `GET /transactions`, `GET /transactions/:id`, `GET /summary/today`, `GET /reports/by-bank` | ✅ (empty until verification works) |
| Verification | `POST /verifications` | ⚠️ Boundary only: returns `unable_to_verify` (`NO_PROVIDER`) |
| Restaurant reads | `GET /menu`, `GET /tables`, `GET /fees` | ✅ |
| Orders, bills, payments, tips, kitchen | — | ❌ Schema + calculations (`modules/payments/payment-calc.ts`) ready; routes not built |

## Security notes

- **PINs**: Argon2id (`@node-rs/argon2`, prebuilt binaries — no C++ toolchain needed), never logged or returned.
  Unknown phones run a dummy hash so timing does not reveal which numbers exist.
- **Sessions**: every JWT points to a `Session` row. Sign-out, expiry, deactivating a staff member, or a deactivated
  business all invalidate the token immediately. Identity, business and role come only from the session.
- **Rate limits**: 300 req/min per IP globally; sign-in per IP + phone; registration per IP. The store is in-memory
  (single instance) — use Redis if you run several API instances.
- **Errors**: codes only, no stack traces or database details. Unexpected errors are logged server-side.
- **Data retention**: no cascade deletes of history. Bank accounts are soft-removed; businesses are deactivated.

## Payment verification — what is and isn't done

`POST /verifications` takes `{ expectedAmount, accountId?, input: { type: 'qr'|'ocr'|'sms', raw } }`.

- The service checks the payment against **all** connected accounts. `accountId` is only a hint, because the
  customer may have paid into any of the business's accounts.
- It decides `verified` / `amountMismatch` / `duplicate` / `wrongAccount` / `notFound` / `pending` only from a
  `VerificationProvider` result (`modules/verification/verification.types.ts`).
- **No provider is registered**, so production answers `{ "status": "unable_to_verify", "reason": "NO_PROVIDER" }`
  and records the attempt. Nothing is ever marked verified without an authoritative source.
- Duplicate protection: a partial unique index allows each bank reference to be `verified` once per business.
- The mobile mock's "last digit of the amount" rule exists only in the app's mock, never here.
- Tests use `src/tests/fixtures/test-verification-provider.ts`, which the production app never loads.

Future modules (separate from the service): QR decoding, OCR of the payment screen, SMS parsing, and one
provider adapter per bank/aggregator.

## Database constraints added in SQL

Prisma can't express these, so they are in `prisma/migrations/*_init/migration.sql`:
one active copy of a bank account per business · one `verified` transaction per (business, bank, reference) ·
one open dine-in bill per table · `Bill.total = food + packing + delivery` · non-negative integer money.

## Troubleshooting

- **`failed to connect to the docker API`** — start Docker Desktop, then `npm run db:up`.
- **Port 5432 in use** — expected if PostgreSQL is installed locally; this project uses host port **5433**.
- **`TEST_DATABASE_URL must point at a test database`** — the URL must contain "test". The test DB is created by
  `docker/init-test-db.sql` only when the volume is first created; on an older volume run
  `docker compose exec db createdb -U smartverify smartverify_test`.
- **Tests and the database** — `npm test` runs `prisma migrate deploy` on the test DB and empties tables between tests.
  It never resets your development database.
- **Phone can't reach the API** — check same Wi-Fi, `HOST=0.0.0.0`, the firewall rule above, and open
  `http://<PC IP>:3000/api/v1/health` in the phone's browser.
- **`Invalid environment configuration`** — the message lists which variables are missing or invalid.
