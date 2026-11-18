/* global __dirname */
const here = __dirname.split('\\').join('/');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Shared code and both apps' routes (paths from this file, wherever the build runs).
  // Forward slashes: Tailwind's file search does not understand Windows backslashes.
  content: [
    `${here}/src/**/*.{js,jsx,ts,tsx}`,
    `${here}/apps/*/src/**/*.{js,jsx,ts,tsx}`,
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand colors come from the active theme (src/theme/themes.ts).
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        primaryText: 'rgb(var(--color-primary-text) / <alpha-value>)',
        primarySoft: 'rgb(var(--color-primary-tint) / <alpha-value>)',
        primaryTile: 'rgb(var(--color-primary-tile) / <alpha-value>)',
        background: '#F4F1F2',
        surface: '#FFFFFF',
        border: '#E9E4E6',
        borderMid: '#D8D0D4',
        borderStrong: '#B9AEB3',
        text: '#1E1A1C',
        muted: '#5E5559',
        placeholder: '#6B6268',
        amber: '#F5B301',
        accent: '#3DDC97',
        accentDeep: '#1FA971',
        successBg: '#DDF3E8',
        successFg: '#0B5A38',
        warnBg: '#FFF0C2',
        warnFg: '#6B4B00',
        dangerBg: '#FBE0DD',
        dangerFg: '#8C1D18',
        tipBg: '#FFF4D1',
        neutralBg: '#ECE8EA',
        navInactive: '#1E1A1C',
        alert: '#D9342B',
        success: '#0E7A4E',
        dangerSurface: '#FAF5F3',
        divider: '#EDE8EA',
        tipOnDark: '#FFD866',
      },
      fontFamily: {
        body: ['DMSans_400Regular'],
        'body-medium': ['DMSans_500Medium'],
        'body-semibold': ['DMSans_600SemiBold'],
        'body-bold': ['DMSans_700Bold'],
        heading: ['Sora_700Bold'],
        'heading-semibold': ['Sora_600SemiBold'],
      },
      borderRadius: {
        card: '20px',
        button: '16px',
        input: '16px',
        chip: '999px',
      },
    },
  },
  plugins: [],
};
