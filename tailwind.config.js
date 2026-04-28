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
          700: '#1E242E',
          600: '#2A313D',
          500: '#3D4656',
        },
        field: {
          50:  '#F7F9F5',
          100: '#EEF2E9',
          200: '#DFE6D5',
        },
        gold: {
          400: '#FACC15',
          500: '#EAB308',
          600: '#CA8A04',
        },
      },
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'mono-code': ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
