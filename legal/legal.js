(function () {
  'use strict';

  // Same theme choice as the popup (it stores it in this origin's localStorage); the markup defaults to dark.
  try {
    let saved = localStorage.getItem('superUnlockerTheme');
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed === 'string') saved = parsed;
    } catch {}
    const theme = saved === 'dark' || saved === 'light'
      ? saved
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch {}

  // The theme can be switched in the popup while this page is open (in the viewer, or in a tab of its own): follow it.
  window.addEventListener('storage', (event) => {
    if (event.key !== 'superUnlockerTheme') return;
    let value = event.newValue;
    try { const parsed = JSON.parse(value); if (typeof parsed === 'string') value = parsed; } catch {}
    if (value === 'dark' || value === 'light') document.documentElement.setAttribute('data-theme', value);
  });

  // Inside the popup's viewer this page is a frame, and the popup cannot see key presses made in it.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.parent !== window) {
      try { window.parent.postMessage({ type: 'selectra-legal-close' }, location.origin); } catch {}
    }
  });
})();
