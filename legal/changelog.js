(function () {
  'use strict';

  // Embedded inside popup.html's #legalFrame vs opened in a standalone browser tab: set before first paint so layout never jumps.
  try {
    if (window.parent !== window) document.documentElement.classList.add('in-frame');
  } catch {
    document.documentElement.classList.add('in-frame');
  }

  // The changelog page carries its notes in English and in Turkish; the interface language picks one (every other language reads English), and
  // the EN | TR switch in the page's corner changes it for this view only. Without this script, or outside the extension, the English notes show.
  let current = 'en';
  let chosen = false; // the person used the switch: the page keeps that choice, whatever the extension's setting says afterwards

  function formatReleaseDates(lang) {
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    for (const timeEl of document.querySelectorAll('time.cl-date[datetime]')) {
      const iso = timeEl.getAttribute('datetime');
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      if (!m) continue;
      const utc = Date.UTC(+m[1], +m[2] - 1, +m[3]);
      try {
        timeEl.textContent = new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC'
        }).format(new Date(utc));
      } catch {
        timeEl.textContent = iso;
      }
    }

    for (const relEl of document.querySelectorAll('.cl-rel[data-date]')) {
      const iso = relEl.getAttribute('data-date');
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      if (!m) continue;
      const diffDays = Math.floor((todayUtc - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
      if (diffDays < 0 || diffDays > 30) {
        relEl.textContent = '';
        continue;
      }
      if (lang === 'tr') {
        relEl.textContent = diffDays === 0 ? 'Bugün' : diffDays === 1 ? 'Dün' : diffDays < 7 ? `${diffDays} gün önce` : `${Math.floor(diffDays / 7)} hf önce`;
      } else {
        relEl.textContent = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : diffDays < 7 ? `${diffDays}d ago` : `${Math.floor(diffDays / 7)}w ago`;
      }
    }
  }

  function show(language) {
    current = language === 'tr' ? 'tr' : 'en';
    document.documentElement.setAttribute('data-doc-lang', current);
    for (const button of document.querySelectorAll('.cl-lang')) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === current));
    }
    formatReleaseDates(current);
  }

  function openHashTarget() {
    if (!location.hash || location.hash.length < 2) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const item = document.getElementById(id);
    if (!item) return;
    const card = item.querySelector('details.cl-card') || item.closest('details.cl-card');
    if (card) card.open = true;
  }

  const plain = (value) => { try { const parsed = JSON.parse(value); return typeof parsed === 'string' ? parsed : value; } catch { return value; } };

  // 1. Before the first paint: the popup keeps its language in this origin's localStorage too (i18n.js), and this script runs in <head>,
  //    so the page never shows English for a moment first.
  try { show(plain(localStorage.getItem('superUnlockerLang'))); } catch { show('en'); }

  // 2. The extension's own setting is the truth (a profile in which the popup has never run has no copy in localStorage), and it can change while
  //    this page is open in the viewer.
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('superUnlockerLang').then((data) => { if (!chosen && data && data.superUnlockerLang) show(data.superUnlockerLang); }, () => {});
      chrome.storage.onChanged.addListener((changes, area) => { if (!chosen && area === 'local' && changes.superUnlockerLang && changes.superUnlockerLang.newValue) show(changes.superUnlockerLang.newValue); });
    }
  } catch {}

  // 3. The switch and hash navigation (elements exist once the page is parsed).
  document.addEventListener('DOMContentLoaded', () => {
    show(current);
    openHashTarget();
    for (const button of document.querySelectorAll('.cl-lang')) {
      button.addEventListener('click', () => { chosen = true; show(button.dataset.lang); });
    }
  });
  window.addEventListener('hashchange', openHashTarget);
})();
