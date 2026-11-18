# Claude Code prompts — run one at a time, test, then next

Setup: copy this folder to `frontend/design/owner/` and `assets/hero-food.png` to `frontend/assets/images/hero-food.png`.

## 1. Shared UI
Read only frontend/design/owner/DESIGN.md (sections Tokens + Shared components) and src/theme/themes.ts.
Create in src/components/ui/: ScreenBackground, GlassCard, HeroCard, TopBar, Segmented, ActionTile, IconTile, PrimaryButton, GhostButton, StickyFooter. Use theme tokens (no hard-coded orange). Use expo-blur and expo-linear-gradient if installed; otherwise semi-transparent View. Don't touch screens. Typecheck, lint, commit.

## 2. Home (owner + manager)
Read DESIGN.md screens 1–2, screens/01-owner-home.png, 02-manager-home.png, and the home screen + src/features/home/homeActions.ts.
Restyle Home with the shared components. Make homeActions role-based: owner = 8 actions listed, manager = 8 actions listed; Money flow/Reports/Staff/Banks/Plan owner only. Remove the pill row and section split. Keep logic. Typecheck, lint, commit.

## 3. Overview
Read DESIGN.md screen 3 + screens/03-overview.png + the Overview screen file only. Restyle. Keep logic. Typecheck, lint, commit.

## 4. Money flow
Same as 3 for screen 4 (04-money-flow.png). Owner-only guard stays/added. Typecheck, lint, commit.

## 5. Add money out
Same for screen 5 (05-add-money-out.png). Typecheck, lint, commit.

## 6. Buy list
Same for screen 6 (06-buy-list.png). Typecheck, lint, commit.

## 7. Tips by waiter
Same for screen 7 (07-tips-by-waiter.png). List EVERY waiter for the selected day (include 0 tips), unpaid first. Week strip + calendar button open a date picker (use existing date lib/picker if present). Typecheck, lint, commit.

## 8. Reports
Same for screen 8 (08-reports.png). Bar chart with plain Views (no new chart library). Typecheck, lint, commit.

Rules for every prompt: restyle only, no new features beyond the spec, no hard-coded sample data, reuse shared components, check on a small and a tall phone.
