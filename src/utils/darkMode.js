/**
 * Dark Mode Theme Toggle Utility
 * Author: David Gabion Selorm
 */

export const initDarkMode = () => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
}

export const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark')
  const isDark = document.documentElement.classList.contains('dark')
  localStorage.setItem('theme', isDark ? 'dark' : 'light')
  return isDark
}

export const getCurrentTheme = () => {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
