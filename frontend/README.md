# Smart Verify - Mobile Frontend

Payment verification app for Ethiopian businesses. Built with React Native, Expo, and TypeScript.

## About

Smart Verify offers two plans:
- **Normal Verify**: Verify bank and Telebirr payments, view transactions and reports
- **Restaurant Plus**: Everything in Normal plus ordering, open bills, table management, and admin features

## Two apps, one shared code

```
frontend/
├─ src/              shared code for both apps (screens, verify, banks, login, UI, i18n…)
├─ assets/           shared images (icons, bank logos)
├─ apps/restaurant/  ገብቷል (com.gebtual.app): app.json, eas.json, routes in src/app
└─ apps/shop/        ገብቷል Shop (com.gebtual.shop): app.json, eas.json, routes in src/app (no restaurant pages)
```

One `npm install` in `frontend/` (npm workspaces). Run from `frontend/`:

| Command | |
| --- | --- |
| `npm run start` | Restaurant app (Expo Go) |
| `npm run start:shop` | Shop app (Expo Go) |
| `npm run typecheck` / `npm run lint` | both apps |
| `cd apps/restaurant && npx eas-cli build --profile preview` | Restaurant APK |
| `cd apps/shop && npx eas-cli build --profile preview` | Shop APK |

A new page: put the screen in `src/features/…`, then a one-line route file in the app(s) that
show it (`apps/<app>/src/app/…`).

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript (strict mode)
- **Routing**: Expo Router (file-based)
- **Styling**: NativeWind (Tailwind for React Native)
- **Server State**: TanStack Query
- **Client State**: Zustand
- **Forms**: React Hook Form + Zod
- **i18n**: i18next (English, Amharic)
- **Icons**: lucide-react-native

## Getting Started

### Prerequisites
- Node.js 22.12+
- Expo Go app on your phone (or Android/iOS simulator)

### Installation

```bash
npm install
```

### Running the App

Start the development server:
```bash
npm run start
```

Then in the terminal:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Press `w` for web
- Scan the QR code with Expo Go on your phone

## Project Structure

```
src/
  app/                    Routes (file-based with Expo Router)
    (auth)/              Auth screens
    (app)/               Protected app screens
  components/ui/         Shared UI components (Button, Card, Chip, etc.)
  features/              Feature-specific components (verify, orders, bills, etc.)
  store/                 Zustand stores (session, etc.)
  hooks/                 Custom hooks (useReducedMotion, etc.)
  theme/                 Design tokens and colors
  i18n/                  Translations (en.json, am.json)
  lib/                   API client, mock data, utilities
  types/                 TypeScript type definitions
docs/
  design/                Design screenshots and reference
```

## Design Tokens

Primary: `#0D4A36` | Text: `#14201B` | Background: `#F4F8F6`

Complete token definitions in `src/theme/tokens.ts` and `tailwind.config.js`.

## Development

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

### Format Code
```bash
npm run format
```

## Git Workflow

1. Create a branch from `main`
2. Make changes and test with `npm run start`
3. Type check and lint: `npm run typecheck && npm run lint`
4. Commit with conventional commits (e.g., `chore: scaffold expo app`)
5. Create a PR when ready
6. Do NOT push until you have review approval

## Components

Base components ready to use:
- **Button** (primary, outline, amber)
- **Card** - Surface container with border
- **Chip** - Selectable chip
- **StatusPill** - Verified/Pending/Mismatch/Duplicate status
- **MoneyText** - ETB currency formatting
- **Header** - Screen header with back button
- **Switch** - Toggle switch
- **Input** - Text input with label

## Accessibility

Respects device reduced-motion settings via `useReducedMotion` hook.

## Notes

- Never hardcode UI strings; use `useTranslation()` from i18next
- Mock API layer for now; will be swapped with real backend later
- Use Expo Go for development; development build needed for QR scanner and notifications
- Check `CLAUDE.md` for detailed developer notes
