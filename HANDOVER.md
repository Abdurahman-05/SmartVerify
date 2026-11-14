# Smart Verify: handover

For a developer joining the project. State as of 14 Nov 2026. Read this first, then [CLAUDE.md](CLAUDE.md)
(working rules; Claude Code reads it automatically).

## What it is

A phone app for Ethiopian businesses: the cashier checks that a customer's bank or Telebirr payment really
arrived before handing over goods. Two plans:

- **Normal Verify**: verify payments, history, reports, receiving accounts.
- **Restaurant Plus**: everything above plus orders, bills per table, kitchen screen, waiter tips and staff.

Roles: owner, manager, waiter, chef. Supported receipts: CBE, BOA, Dashen, Telebirr, M-Pesa, E-Birr
([backend/src/modules/verification/banks/](backend/src/modules/verification/banks/)).

## The three folders

| Folder | What | Stack |
|---|---|---|
| [frontend/](frontend/) | Phone app, two variants: `apps/restaurant` and `apps/shop` (Normal Verify) | Expo, React Native, NativeWind, Zustand, i18next (English + Amharic) |
| [backend/](backend/) | REST API under `/api/v1`, Swagger at `/docs` | Node 22, Fastify, Prisma, PostgreSQL |
| [admin/](admin/) | Smart Verify team's web console (plans, businesses, announcements, health) | Expo for web |

More detail: [backend/README.md](backend/README.md), [docs/BACKEND.md](docs/BACKEND.md) (the API contract the app
expects), designs in `docs/design/screens/`.

## Run it on your computer

Needs Git, Node.js 22, Docker Desktop.

1. **Database:** two PostgreSQL containers, one for development and one for tests. Use ports **15432** (dev) and
   **15433** (test): Windows reserves random ports below 15000.
2. **Backend:** `cd backend`, `npm install`, create `backend/.env` (ask Abdurahman for the values, never commit it),
   then `npm run db:deploy`, `npm run db:generate`, `npm run dev`. The API runs at `http://localhost:3000`.
3. **App:** `cd frontend`, `npm install`, copy `.env.example` to `.env`, `npm run start:restaurant` or
   `npm run start:shop`, then open it in Expo Go.
4. **Admin:** `cd admin`, `npm install`, `npm run dev` (port 8082). Create an admin user with
   `npm run admin:create` in `backend/`.

## Rules we follow

- Work and commit on **main** (no feature branches). Run `git pull` before starting.
- After every change: `npm run typecheck`, `npm run lint`, and `npm test` in `backend/` when backend code changed.
  Then commit with a conventional message, e.g. `feat(verify): ...` or `fix(app): ...`.
- All screen text goes through i18n, in English **and** Amharic.
- Money is whole ETB (no cents). The server is the source of truth for totals and statuses.
- **No passwords, keys or `.env` files in git, chat or screenshots.** The repo is public.

## Live system

```
Phone app / admin ──► AWS server (Stockholm, eu-north-1) ──► CBE, BOA, Dashen ... (direct)
                       │  Docker: API + PostgreSQL + Caddy (HTTPS)
                       └──► relay.php on Ethiopian hosting ──► Telebirr, M-Pesa
```

- **Live address:** https://51-21-74-119.sslip.io (API `/api/v1`, admin `/sign-in`).
- **Deploying and changing settings:** [deploy/README.md](deploy/README.md). Secrets live in AWS SSM Parameter
  Store under `/smartverify/*`, never in the code. A settings change only applies after running the update command.
- Daily database backups run on the server (see deploy/README.md for restore).

### Why the relay exists

Telebirr's and M-Pesa's receipt sites only answer **Ethiopian** internet addresses, and the AWS server is abroad.
So the server asks a small PHP page on our Ethio Telecom hosting to fetch the receipt for it.

- Hosting: Ethio Telecom Plesk, domain **gebtual.com.et** (server lin2.ethiotelecom.et, 213.55.96.150).
- Page: `https://gebtual.com.et/relay.php`, source in [deploy/relay/relay.php](deploy/relay/relay.php). It only
  fetches Telebirr/M-Pesa receipt links and needs the secret key header `X-Relay-Key`.
- AWS settings: `RECEIPT_RELAY_URL` and `RECEIPT_RELAY_KEY` (must equal the key inside relay.php on the hosting).
- Lessons from setting it up:
  - PHP in Plesk must run as **"FastCGI application served by Apache"**. With "FPM" every `.php` page returned 503.
  - SSL is a free Let's Encrypt certificate for gebtual.com.et (not www), renewed automatically by Plesk.
  - If Telebirr checks fail now and then, it is usually Telebirr's own site hanging. The server already retries
    once.
- To change the key: put a new long random key (`openssl rand -hex 32`) in relay.php **and** in the AWS parameter,
  then run the update command.

## What's open

- The night-mode button change in `admin/src/features/platform-admin/AdminShell.tsx` and a change in
  `frontend/src/features/reports/ReportScreen.tsx` are not committed yet (Abdurahman's machine).
- New screen designs waiting to be built: `docs/design/screens/additional feature/`.
- Consider making the GitHub repo private.
