# Smart Verify - Developer Guide

## Project Overview

Mobile app for Ethiopian businesses to verify bank/Telebirr payments. Built with React Native + Expo.

Two plans: **Normal Verify** (payment verification) and **Restaurant Plus** (everything + ordering/billing/admin).

## Key Rules

1. **No hardcoded strings** - Use useTranslation() from i18next for all UI text (English & Amharic)
2. **Use Expo-compatible packages** - Install with 
px expo install, not plain npm
3. **Strict TypeScript** - tsconfig.json has strict: true
4. **Path aliases** - Use @/ for src imports (e.g., @/components/ui/Button)
5. **Mock data first** - Backend comes later; use mock data layer in src/lib/
6. **NativeWind styling** - Use Tailwind classes; no StyleSheet for UI

## Structure

- src/app/ - Routes (file-based Expo Router)
- src/components/ui/ - Base UI components
- src/features/ - Feature-specific logic
- src/store/ - Zustand stores
- src/theme/ - Design tokens
- src/i18n/ - Translations

## Versions (Oct 2026)

- Expo SDK: 57.0.26
- React Native: 0.86.3
- React: 19.2.3
- NativeWind: 4.2.7

## Commands

- 
pm run start - Start dev server
- 
pm run typecheck - Type check
- 
pm run lint - Lint
- 
pm run format - Format code

## Phase 0 Complete

- Expo app with TypeScript & Expo Router
- NativeWind + design tokens
- Base UI components
- Zustand session store
- i18n setup
- ESLint + Prettier
- Navigation structure

## Phase 1 (Next)

- Splash, sign-in, create account, choose plan screens
- Home dashboard
- All using base components

## Working rules

- Reuse existing components, theme tokens, i18n keys, and patterns. Do not add new libraries unless unavoidable (ask first).
- Keep it simple: no new abstractions, no generic frameworks, no backend. Mock data only, in src/lib/mock.
- Small scope per task. Read only the files needed. Do not scan the whole repo.
- All UI strings through i18n (en + am keys). Touch targets >= 44, text >= 14.
- Design reference: docs/design/screens/<Name>.dc.html (read only the screen being built). Rebuild in React Native, do not copy HTML.
- Money is integer ETB. Format with the existing MoneyText.
- After each task: run typecheck + lint, then commit with a conventional message.

## Integration rules

- Backend is in backend/, API base from EXPO_PUBLIC_API_URL, routes under /api/v1. Swagger at /docs is the contract: read only the routes of the module being connected.
- Each module has a real file in src/lib/api/<module>.ts with the SAME function signatures as src/lib/mock/<module>.ts. Do not edit the mock files.
- One switch per module: EXPO_PUBLIC_USE_MOCK_<MODULE> (default false) read in src/lib/<module>/index.ts. Screens import only from that index.
- The server is the source of truth for totals, tips, statuses. The app displays server values, it does not recompute them.
- Send an Idempotency-Key header (uuid per user action) on create/pay requests.
- Backend error codes map to existing i18n keys (en + am). Network failure -> generic "No connection" state with Retry.
- Lists refetch on screen focus.
- Money is integer ETB.
- After each task: typecheck + lint, commit with a conventional message.
