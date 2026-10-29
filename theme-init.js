(function () {
  'use strict';

  try {
    let savedTheme = localStorage.getItem('superUnlockerTheme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        if (typeof parsed === 'string') savedTheme = parsed;
      } catch {}
    }
    const theme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);

    const SUPPORTED = ['en', 'tr', 'fr', 'de', 'es', 'pt', 'it', 'ru', 'pl', 'nl'];
    const navCode = ((navigator.language || '').slice(0, 2)).toLowerCase();
    const detected = SUPPORTED.includes(navCode) ? navCode : 'en';
    const savedLang = localStorage.getItem('superUnlockerLang') || detected;
    document.documentElement.setAttribute('lang', SUPPORTED.includes(savedLang) ? savedLang : 'en');
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('lang', 'en');
  }
})();
