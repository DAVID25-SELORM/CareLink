/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E88E5',
        medical: '#2ECC71',
        dark: '#2C3E50',
      },
    },
  },
  plugins: [],
}
