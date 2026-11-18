# Gebtual logo + themed loader: run one at a time, /clear between

Setup: copy this folder to `assets/logo/` in each app (apps/restaurant, apps/shop; admin gets only gebtual-logo.ts and the svg).

## 1. Logo + loader components
Read only assets/logo/gebtual-logo.ts, src/theme/themes.ts, the existing PageLoader and package.json.
Create src/components/ui/GebtualLogo.tsx (react-native-svg; run `npx expo install react-native-svg` if missing). Props: width, variant 'theme' | 'onDark' | 'mono', color?.
- theme: G + speed lines = primaryDeep, check = primary2 (from the theme, never hard-coded orange)
- onDark: G + lines white, check #FACC15
- mono: everything = color
Use LOGO_G (fillRule evenodd), LOGO_LINES, LOGO_CHECK, LOGO_VIEWBOX, LOGO_ASPECT.
Create src/components/ui/LogoLoader.tsx: ONLY the logo, no circle, no ring, no orange tile. react-native-reanimated, 3000ms loop:
- G drawn on: Mask with the stroked REVEAL_G path (width REVEAL_G_WIDTH, strokeDasharray [L, L], strokeDashoffset L to 0), 0-40%, ease in-out
- check drawn the same way with REVEAL_CHECK, 38-56%
- speed lines fade in and slide from the left 26 units, 56-68%
- hold, then the whole logo fades out 86-96%, restart
- reduce motion: show the finished logo, no animation
Variant 'theme'. Props: size (default 150), label?.
Make PageLoader render LogoLoader (keep PageLoader's name and props, so every screen updates). Typecheck, lint, commit. No summary.

## 2. Replace the old ገ logo everywhere in the apps
Grep apps/restaurant, apps/shop and shared UI for the old logo (the ገ glyph svg/path, the old logo image or LogoMark component, any icon that is the old mark). Replace each with GebtualLogo:
- Splash, Sign in, Create account, Verify email, Choose color, Choose plan: the existing rounded primaryDeep tile stays, logo variant 'onDark', width 62
- Profile, About, headers: variant 'theme', no tile
Keep the text "ገብቷል" where it is a word (app name), not a logo.
Assets: icon.png from assets/logo/icon-orange.png; adaptive icon foreground from foreground-transparent.png with background #C04B0F; splash image from splash-dark.png with background #2A1D18; favicon from icon-orange.png. Typecheck, lint, commit. No summary.

## 3. Admin + backend pages
admin/: copy gebtual-logo.ts into src/assets/, show the logo (variant 'theme') in AdminShell header, the login page, and as the favicon (icon-orange.png).
backend/: serve assets/logo/icon-orange.png at GET /logo.png (public, cached). Add the logo at the top of the /terms and /privacy pages (inline SVG from gebtual-logo.svg, width 120) and an <img src="https://api.gebtual.com.et/logo.png" width="72"> at the top of the email templates (sign-up code, forgot PIN, manager invite). No new dependencies. Typecheck, lint, tests, commit. No summary.
