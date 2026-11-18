# Gebtual — Light glass redesign

37 screens, 7 groups (folders in /screens). PNGs are 780x1688 (2x of 390x844), Rose theme.
/design-source = the editable design files (HTML) — open in a browser to inspect sizes/colors.

## Theme tokens (match src/theme/themes.ts)
| theme  | primary | primaryText | tint (screen bg) | tile (icon bg) |
|--------|---------|-------------|------------------|----------------|
| forest | #0D4A36 | #0D6B47 | #E6F2EC | #DDEFE6 |
| ocean  | #0B3D6B | #0B5CA8 | #E5F0FA | #D6E7F7 |
| royal  | #3F2A7A | #5B3FB0 | #EEEAF8 | #E0D9F2 |
| teal   | #0B4F55 | #0E7480 | #E3F2F3 | #D2EAEC |
| slate  | #26323F | #3D5A80 | #E8EDF2 | #DAE3EC |
| rose   | #9D174D | #BE185D | #FDF0F5 | #FADCE8 |
| berry  | #6B1F5E | #8E2B7C | #F7ECF5 | #EFD8EB |

Fixed colors: amber #F5B301 · text #1E1A1C · muted #5E5559 · success #0B5A38 on #DDF3E8 · warning #6B4B00 on #FFF0C2 · danger #8C1D18 on #FBE0DD.

## Glass card (React Native)
- background rgba(255,255,255,0.62), border 1px rgba(255,255,255,0.95), radius 20
- blur: expo-blur <BlurView intensity={40} tint="light"> behind the card
- shadow: 0 10 26 rgba(30,20,25,0.08)

## Screen background
tint color + 3 soft blobs: tile color top-left, amber #FFE7AE right, tile color bottom-left (use expo-linear-gradient or a pre-made image per theme).

## Hero card / primary button
gradient: primary lightened 28% → primary → primary darkened 22%; radius 20 (buttons 16, height 56–60).

## Bottom nav
floating glass pill, centered, bottom 16; 5 round 52px buttons; active = filled primary circle, white icon; inactive = transparent, dark icon.
Roles: owner/manager Home·Verify·History·Alerts·Profile — waiter New order·Verify·Activity·Alerts·Profile — chef Kitchen·Alerts·Profile.

Fonts: Sora (headings, numbers), DM Sans (body), Noto Sans Ethiopic (Amharic). Min text 13–14px, touch targets ≥ 44px.
