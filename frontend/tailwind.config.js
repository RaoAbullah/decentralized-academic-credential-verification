/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B2545',
          dark: '#07192F',
          light: '#134074',
          accent: '#1D4E89',
        },
        gold: {
          DEFAULT: '#D4AF37',
          light: '#F5E6B3',
          dark: '#AA8C2C',
        },
        slate: {
          bg: '#F4F7FB',
          border: '#D0DBE5',
          card: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
