# Smart Verify — Backend

REST API for the Smart Verify app (`../frontend`). Node.js 22 + TypeScript, Fastify 5, PostgreSQL (Neon), Prisma 7,
Zod, Swagger. The contract the app expects is in [`../docs/BACKEND.md`](../docs/BACKEND.md).

## Run

```bash
cd backend
npm install
# .env needs only DATABASE_URL
npm run db:deploy      # apply migrations
npm run db:generate    # generate the Prisma client (src/generated, git-ignored)
npm run dev            # http://localhost:3000
```

- API base: `http://localhost:3000/api/v1` · Health: `GET /api/v1/health` · Swagger UI: `http://localhost:3000/docs`
- Other: `npm run typecheck` · `npm run lint` · `npm run format` · `npm run build` then `npm start`
- Optional `.env` overrides: `PORT` (3000), `HOST` (0.0.0.0), `LOG_LEVEL` (info), `NODE_ENV` (development)
- `DIRECT_DATABASE_URL` (recommended with Neon): the same database on the direct host (no `-pooler`), used only by
  the Prisma CLI. Migrations take a session lock that a pooler can leave stuck ("Timed out trying to acquire a
  postgres advisory lock"); the running app keeps using the pooled `DATABASE_URL`.

## Built so far

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth (phone + PIN, no SMS code yet) | `POST /auth/register`, `POST /auth/sign-in`, `POST /auth/sign-out`, `GET /auth/me` |
| Orders (restaurant plan) | `POST /orders` (needs `Idempotency-Key`) |
| Bills (restaurant plan) | `GET /bills`, `GET /bills/:id`, `PATCH /bills/:id/delivery-fee` |
| Tables (restaurant plan) | `GET /tables` |
| Menu (restaurant plan) | `GET /menu`, `POST /menu`, `PATCH /menu/:id`, `DELETE /menu/:id` (soft), `POST /menu/bulk-price`, `POST /menu/bulk-availability`, `POST /menu/bulk-delete` |
| Menu starter packs (restaurant plan) | `GET /menu/catalog/packs`, `GET /menu/catalog`, `POST /menu/catalog/import` (whole pack, section or item) — data in `src/modules/menu/catalog/` (no alcohol, no pork) |
| Plan / subscription | `PATCH /business/plan`, `POST /subscription` (no payment step yet) |
| Tables & fees setup | `POST /tables`, `DELETE /tables/:id`, `GET /fees`, `PUT /fees` |
| Kitchen | `GET /kitchen/orders`, `POST /kitchen/orders/:id/start`, `POST /kitchen/orders/:id/ready` |
| Payments (restaurant plan) | `POST /bills/:id/payments` — cash only, bank, cash + bank (one request per bank scan; short keeps the bill open) |
| Tips & overview | `GET /tips`, `POST /tips/mark-paid`, `GET /overview` |

**Bank amounts are not verified yet.** Until bank verification is built, the app's fake bank check reports the
amount and the server records it. This is refused in production unless `ALLOW_UNVERIFIED_BANK_PAYMENTS=true`.

Errors are always `{ "error": { "code": "…" } }`. Restaurant routes return `SUBSCRIPTION_REQUIRED` unless the
business is on the restaurant plan.

## Tests

`npm test` runs Vitest against `TEST_DATABASE_URL`, which must set `?schema=` to a schema whose name contains
"test" (e.g. `smartverify_test`). Tests apply migrations there and empty those tables; the URL check refuses any
other schema, so development data in `public` is never touched. Use the direct (non `-pooler`) Neon host for tests.

Tests are slow from far away (~5 min), because every query crosses to the database region.

## Auth design

- **PINs** are hashed with Argon2id and never logged or returned. Unknown phones run a dummy hash, so response
  time does not reveal which phones are registered.
- **Tokens** are random 256-bit strings. Only their SHA-256 hash is stored in `Session`. Every request checks the
  session, so sign-out, expiry, staff deactivation and business deactivation take effect immediately.
- **Session length**: 12 hours, or 30 days with "Remember me" (registration is always remembered).
- **Rate limits** (in memory, per server): 300 requests/min per IP; sign-in 5 attempts per 15 min per IP + phone;
  registration 10 per hour per IP.
- Staff sign in with the same endpoint; they share the owner's business and plan.
