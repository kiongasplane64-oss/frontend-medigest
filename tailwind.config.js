/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        medical: {
          light: '#e0f2fe',
          DEFAULT: '#0ea5e9',
          dark: '#0369a1',
        },
        success: '#22c55e', // Vert pour les bénéfices/ventes
        danger: '#ef4444',  // Rouge pour les dépenses/ruptures
      }
    },
  },
  plugins: [],
}