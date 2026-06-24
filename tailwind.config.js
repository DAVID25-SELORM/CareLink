/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        medical: {
          DEFAULT: '#16a34a',
          light: '#22c55e',
          50: '#f0fdf4',
          100: '#dcfce7',
        },
        success: {
          DEFAULT: '#16a34a',
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          DEFAULT: '#d97706',
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          DEFAULT: '#dc2626',
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          DEFAULT: '#0284c7',
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          600: '#0284c7',
          700: '#0369a1',
        },
        dark:   '#1e293b',
        accent: { DEFAULT: '#f59e0b', light: '#fbbf24' },
        background: '#f8fafc',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.04)',
        'card-hover': '0 10px 25px -5px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)',
        modal: '0 20px 60px -10px rgba(0,0,0,0.2)',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        input: '0.5rem',
        card: '0.75rem',
        modal: '1rem',
      },
    },
  },
  plugins: [],
}
