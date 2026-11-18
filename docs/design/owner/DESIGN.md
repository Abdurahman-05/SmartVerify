# Owner & Manager redesign spec (orange glass)

Screens: `screens/*.png` (390x844 @2x). Match them. Numbers below are in dp.
Restyle only. Keep all logic, data, i18n, navigation. Never hard-code the sample numbers.

## Tokens (orange = default theme; other themes swap primary/primary2/primaryText/tile)
- primary #EA580C · primary2 #F97316 · primaryText #C2410C · tile #FFD9BD · tint #FFEFE3
- text #1E1A1C · sub #5E5559 · muted #8A8085
- green bg #DCFCE7 / fg #166534 · red bg #FEE2E2 / fg #B91C1C · amber bg #FEF3C7 / fg #92400E
- Fonts: numbers + titles = Sora 700; everything else = DM Sans 400/700

## Shared components (build once in src/components/ui/)
1. **ScreenBackground**: LinearGradient tint→tile (top→bottom) + soft blobs (absolute circles, blur via opacity):
   - top-right solid circle primary2 r92 at (x 108%, y -4%), ring tile r150
   - bottom-left solid circle primary2 r110 at (-12%, 104%), ring tile r170
   - soft glows: orange rgba(249,115,22,.55) r150 at (88%,46%), yellow rgba(250,204,21,.5) r140 at (10%,66%), pink rgba(244,63,94,.28) r150 at (70%,88%)
2. **GlassCard**: BlurView intensity 30 tint light, bg LinearGradient 135° rgba(255,255,255,.58)→rgba(255,255,255,.20), border 1 rgba(255,255,255,.8), radius 22, shadow rgba(194,65,12,.16) y10 blur30.
3. **HeroCard**: LinearGradient 140° primary2 → primary(58%) → primaryText, radius 26, padding 18, white text; decorative circle rgba(255,255,255,.1) 200dp at bottom-right. Inner chips: bg rgba(255,255,255,.2), border rgba(255,255,255,.35), radius 14–16.
4. **TopBar**: 44dp glass circle left (back/close) · centered title Sora 20 + subtitle 13 sub · 44dp glass circle right (calendar/plus) or empty spacer.
5. **Segmented**: GlassCard radius 24 padding 4; items h40 radius 20 14 bold; active = gradient primary2→primary, white, shadow.
6. **ActionTile** (Home grid, 2 columns, gap 8, inside one GlassCard padding 10): row h~68, bg rgba(255,255,255,.45), border rgba(255,255,255,.9), radius 18, padding 10; icon box 48 radius 16 gradient primary2→primary white icon 24; title 14 bold; sub 12; badge 20 yellow #FACC15 top-right of icon.
7. **IconTile**: 42 radius 14, gradient (primary) or semantic bg/fg.
8. **PrimaryButton**: h54–56 radius 28 gradient 180° primary2→primary, white 16–17 bold, shadow rgba(234,88,12,.3) y12 blur24. **GhostButton**: GlassCard style, primaryText.
9. **StickyFooter**: absolute bottom 20, left/right 16 (Money flow, Add money out, Tips, Reports).
10. **BottomNav** (Home only): floating glass pill bottom 16, 5 buttons 52 round, active = gradient.

## Screens
1. **Owner Home**: header (hi line primaryText 14 "Welcome back, {name} · Owner", store name Sora 26, bell glass 44, avatar 44) → HeroCard (TODAY · LIVE dot, total, payments line, 3 glass stat chips Verified/Pending/Duplicate, food image hero-food.png top-right 170x132 overlapping) → PrimaryButton h60 "Verify payment" + yellow tag → "What do you want to do? · 🔒 owner only" → ONE grid: Money flow🔒, Reports🔒, Overview, Tips, Buy list, New order, Expenses, Staff → BottomNav.
2. **Manager Home**: same layout, "Hi {name} · Manager", heading "Run the floor", ONE grid: New order, Open bills, Buy list, Tables, Overview, Tips, Expenses, Menu (sold-out only). No Money flow/Reports/Staff/Banks/Plan.
3. **Overview**: TopBar (calendar) → Segmented Today/7 days/30 days → HeroCard: total + "+x% vs yesterday" pill + donut 96 (cash yellow #FDE047 vs bank white) + Cash/Bank chips → 3 small GlassCards (Orders, Avg bill, Tips·not sales) → "Needs your attention" + count pill → GlassCard rows (icon tile, title, sub, chevron).
4. **Money flow** (owner only): TopBar → Segmented Today/Week/Month → HeroCard "LEFT AFTER COSTS" + "% kept" pill + 3 bars (Sales white 100%, Purchases #FDE047, Expenses #FCA5A5; track rgba(255,255,255,.22) h8 r4) → "Latest money out" + See all → one GlassCard list → StickyFooter: Purchase (primary) + Expense (ghost).
5. **Add money out**: TopBar (close) → Segmented Purchase/Expense with icons → HeroCard centered amount input Sora 42 white + ETB → glass input pills h52 r26 with orange icon (What, How much) → Kind: 4 tiles h64 r18 (selected: border 2 primary, bg tile, primaryText) → Paid from: Cash/Bank pills h48 → StickyFooter "Save purchase".
6. **Buy list**: TopBar (plus) subtitle "{n} to buy · added by the chef" → Segmented To buy/Bought → expanded item GlassCard (border 2 primary2): icon tile, name, by·time, day tag, PRICE PAID input pill h56, Cash/Bank pills, PrimaryButton "Mark as bought" → other items: GlassCard row with gradient icon tile, tag, 26dp check circle.
7. **Tips by waiter**: TopBar (calendar opens date picker) → GlassCard week strip (month label + ‹ › arrows, 7 day pills h58 r18, selected gradient, future days muted) → HeroCard "TO PAY OUT · {day}" + summary + Bank/Cash chips → "All waiters · n" + "Unpaid first" → one GlassCard list of EVERY waiter (avatar 42 gradient initials, name, "x tips · bank · cash", amount, Pay pill h34 / green Paid tag / "—" when 0; paid & zero rows opacity .7) → StickyFooter "Pay all · {total} ETB".
8. **Reports**: TopBar (calendar) → Segmented Sales/Food & drink/Expenses/Staff → HeroCard total + "+x% vs last {day}" pill + hourly bar chart (h116, white bars opacity by value, peak bar #FDE047 with white tooltip "13:00 · 3,100") + axis labels → 4 small GlassCards (Bank, Cash, Orders, Busiest) → "Top sellers" + avg bill → GlassCard rank list (rank circle, name, amount, progress bar gradient, "n sold") → StickyFooter Export PDF (primary) + CSV (ghost 120).

## Removed on purpose (do not add back)
- Pill row Expenses/Banks/Plan on Home (Banks & Plan live in Profile)
- Section split "Daily work"/"Today" on Home
- "Tips by waiter" row in Overview attention list
- Money in/out cards on Money flow
- Progress card on Buy list
