/** Light glass: fixed colors and shade helpers (README of the light glass design). */
export const glass = {
  card: 'rgba(255,255,255,0.62)',
  cardBorder: 'rgba(255,255,255,0.95)',
  amberBlob: '#FFE7AE',
  text: '#1E1A1C',
  shadow: 'rgba(30,20,25,1)',
} as const;

/** Result screens: mint background for a verified payment, soft red for a problem. */
export const resultPalette = {
  ok: { tint: '#EAF6EF', tile: '#CDEEDC' },
  bad: { tint: '#FDF0EF', tile: '#F7D6D3' },
} as const;

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Mixes a hex color toward white (amount > 0) or black (amount < 0), e.g. 0.28 or -0.22. */
export function shade(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const p = Math.abs(amount);
  const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${parts
    .map((c) =>
      clamp(c + (target - c) * p)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

/** Hero card and primary button gradient: lighter → primary → darker. */
export const brandGradient = (primary: string) =>
  [shade(primary, 0.28), primary, shade(primary, -0.22)] as const;
