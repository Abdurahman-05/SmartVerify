/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0D4A36',
        primaryText: '#0D6B47',
        background: '#F4F8F6',
        surface: '#FFFFFF',
        border: '#DDE5E1',
        borderStrong: '#B9C7C1',
        text: '#14201B',
        muted: '#3B4A44',
        amber: '#F5B301',
        successBg: '#DDEFE6',
        successFg: '#0B4A32',
        warnBg: '#FFE9A8',
        warnFg: '#5C4400',
        dangerBg: '#FBE0DD',
        dangerFg: '#8C1D18',
        tipBg: '#FFF4D1',
      },
      borderRadius: {
        card: '20px',
        button: '19px',
        chip: '999px',
      },
      minHeight: {
        touch: '44px',
        primaryButton: '64px',
      },
      fontSize: {
        body: ['16px', { lineHeight: '24px' }],
        bodyLg: ['18px', { lineHeight: '26px' }],
      },
    },
  },
  plugins: [],
};
