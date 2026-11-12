const day = {
  primary: '#0D4A36',
  primaryText: '#0D6B47',
  primarySoft: '#E6F2EC',
  background: '#F4F8F6',
  surface: '#FFFFFF',
  border: '#DDE5E1',
  borderMid: '#C9D4CF',
  borderStrong: '#B9C7C1',
  text: '#14201B',
  muted: '#3B4A44',
  placeholder: '#5B6B64',
  onPrimary: '#FFFFFF',
  amber: '#F5B301',
  accent: '#3DDC97',
  accentDeep: '#1FA971',
  successBg: '#DDEFE6',
  successFg: '#0B4A32',
  warnBg: '#FFE9A8',
  warnFg: '#5C4400',
  dangerBg: '#FBE0DD',
  dangerFg: '#8C1D18',
  tipBg: '#FFF4D1',
  neutralBg: '#E6EBE8',
  navInactive: '#4A5A53',
  alert: '#B3261E',
  success: '#0E7A4E',
  dangerSurface: '#FAF5F3',
  divider: '#E8EEEB',
  tipOnDark: '#FFD866',
} as const;

const night: Record<keyof typeof day, string> = {
  ...day,
  background: '#0E1512',
  surface: '#17201C',
  border: '#2A3631',
  borderMid: '#34423C',
  borderStrong: '#44544D',
  text: '#E7EEEA',
  muted: '#AEBDB6',
  placeholder: '#8D9C95',
  successBg: '#12372A',
  successFg: '#9BE3BF',
  warnBg: '#3A3010',
  warnFg: '#FFD866',
  dangerBg: '#3B1E1B',
  dangerFg: '#FFB4AB',
  tipBg: '#3A3115',
  neutralBg: '#222D28',
  navInactive: '#AEBDB6',
  dangerSurface: '#2A1B19',
  divider: '#212C27',
  primaryText: '#6FD6A8',
  primarySoft: '#16302A',
};

let current: Record<keyof typeof day, string> = day;
/** Switches the colors code reads (icons); the page itself switches through CSS variables. */
export const setColorMode = (mode: 'light' | 'dark') => {
  current = mode === 'dark' ? night : day;
};

/** The colors for the current mode (read at render: the console redraws when it changes). */
export const colors = new Proxy(day, {
  get: (_target, key: string) => current[key as keyof typeof day],
}) as { readonly [K in keyof typeof day]: string };

export const radii = {
  card: 22,
  button: 18,
  input: 16,
  chip: 999,
} as const;

export const sizes = {
  touchTarget: 44,
  inputHeight: 56,
  buttonLg: 64,
  buttonMd: 52,
  minText: 14,
} as const;
