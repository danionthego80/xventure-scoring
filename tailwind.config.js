/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1a1a2e',
          secondary: '#16213e',
          accent: '#0f3460',
          highlight: '#e94560',
        },
      },
    },
  },
  plugins: [],
    }
