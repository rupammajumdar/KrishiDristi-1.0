/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agri: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          dark: '#0a1f14',
          card: '#11291b'
        },
        stress: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
