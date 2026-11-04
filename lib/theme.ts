'use client';
export function isDark() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}
export function setTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('chuilacarte-theme', dark ? 'dark' : 'light');
  } catch {}
  window.dispatchEvent(new Event('chuilacarte-theme'));
}
