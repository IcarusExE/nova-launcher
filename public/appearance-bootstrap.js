// Blocking, local-only bootstrap for the browser preview. Native appearance is
// read from SQLite while the Tauri window is hidden; browser storage is never
// an authority for the desktop application's preferences.
(() => {
  const systemLanguage = /^tr(?:[-_.@]|$)/i.test(
    navigator.languages?.[0] || navigator.language,
  )
    ? 'tr'
    : 'en';
  document.documentElement.lang = systemLanguage;
  if (window.isTauri) return;
  try {
    const preferences = JSON.parse(
      localStorage.getItem('nova-library-v1'),
    )?.preferences;
    if (['tr', 'en'].includes(preferences?.language))
      document.documentElement.lang = preferences.language;
    const theme = preferences?.theme;
    document.documentElement.dataset.theme =
      theme === 'light' ||
      (theme === 'system' &&
        !matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'light'
        : 'dark';
    if (['violet', 'blue', 'teal', 'amber'].includes(preferences?.accent))
      document.documentElement.dataset.accent = preferences.accent;
  } catch {
    // Corrupt/unavailable storage is reported by the application, without writes.
  }
})();
