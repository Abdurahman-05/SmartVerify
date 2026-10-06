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
