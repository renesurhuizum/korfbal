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
      },
    },
  },
  plugins: [],
}
