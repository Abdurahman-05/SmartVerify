# Smart Verify Admin

The Smart Verify team's console (web only): customers, payment reviews, trial and late-payment
rules, plans and prices, health and errors, announcements, and the activity log. It is a separate
app from the phone app in `../frontend`, and talks to the same backend (`../backend`).

## Run

1. Backend (in `../backend`): `npm run dev`. `backend/.env` needs `ADMIN_SECRET_KEY`, and
   `WEB_ORIGINS` must list this app's address (default `http://localhost:8082`).
2. First admin account (once, in `../backend`): `npm run admin:create -- you@example.com "Name"`.
   Forgotten password: `npm run admin:reset-password -- you@example.com`.
3. This app: `npm run dev`, then open http://localhost:8082/sign-in.

Offline with sample data: `EXPO_PUBLIC_USE_MOCK_ADMIN=true npm run dev`.

## Build for a website

`npm run build` writes static files to `dist/` for any static host (e.g. admin.smartverify.et).
Set `EXPO_PUBLIC_API_URL` to the backend's address (ending in `/api/v1`) when building, and add
the website's address to the backend's `WEB_ORIGINS`.

## Checks

`npm run typecheck` and `npm run lint`. UI text lives in `src/i18n` (English and Amharic).
