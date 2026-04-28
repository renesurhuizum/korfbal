export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark:    'rgb(var(--color-primary-dark) / <alpha-value>)',
          light:   'rgb(var(--color-primary-light) / <alpha-value>)',
          text:    'rgb(var(--color-primary-text) / <alpha-value>)',
        },
        ink: {
          900: '#0A0D12',
          800: '#151A22',
          700: '#2A3140',
          600: '#2A313D',
          500: '#6B7280',
          400: '#9CA3AF',
        },
        canvas: {
          DEFAULT: '#FAFAF7',
          card: '#FFFFFF',
        },
        field: {
          50:  '#F7F9F5',
          100: '#EEF2E9',
          200: '#DFE6D5',
        },
        gold: {
          400: '#FACC15',
          500: '#D97706',
          600: '#CA8A04',
        },
        live: '#EF4444',
      },
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        'mono-code': ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        stencil: '0.08em',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        sheet: '0 -20px 40px rgba(0, 0, 0, 0.15)',
        score: '0 12px 32px rgba(220, 38, 38, 0.2)',
      },
      keyframes: {
        'score-pop': {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.7)' },
          '70%': { boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
        },
      },
      animation: {
        'score-pop': 'score-pop 400ms ease-out',
        'pulse-ring': 'pulse-ring 1.5s infinite',
      },
    },
  },
  plugins: [],
}
