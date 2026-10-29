'use strict';

// One definition of the settings model for the popup, the service worker and the content script (shared.js).
const {
  FEATURE_KEYS, UNLOCK_KEYS, GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY,
  emptySettings, normalizeSettings, countEnabled, siteKey, resolveSettings
} = window.SelectraShared;

// Safe storage wrapper (works in Extension & Standalone Preview). `area` is 'local', or 'session' (memory only) for the sites of a private window.
const storage = {
  area(name) {
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    return name === 'session' && chrome.storage.session ? chrome.storage.session : chrome.storage.local;
  },
  async get(keys, area = 'local') {
    const target = this.area(area);
    if (target) {
      try { return await target.get(keys); } catch {}
    }
    const res = {};
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) {
      try {
        const val = localStorage.getItem(k);
        if (val != null) {
          try {
            res[k] = JSON.parse(val);
          } catch {
            res[k] = val;
          }
        }
      } catch {}
    }
    return res;
  },
  async set(items, area = 'local') {
    const target = this.area(area);
    if (target) {
      try { return await target.set(items); } catch {}
    }
    for (const [k, v] of Object.entries(items)) {
      try {
        const val = typeof v === 'string' ? v : JSON.stringify(v);
        localStorage.setItem(k, val);
      } catch {}
    }
  },
  async remove(keys, area = 'local') {
    const target = this.area(area);
    if (target) {
      try { return await target.remove(keys); } catch {}
    }
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) {
      try { localStorage.removeItem(k); } catch {}
    }
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isUnsupportedPage(url) {
  if (!url) return true;
  if (/^(chrome|chrome-extension|chrome-search|chrome-untrusted|chrome-error|devtools|edge|brave|opera|vivaldi|about|view-source|file):/i.test(url)) return true; // (a file has no host name, so there is no "this site" to keep settings for)
  // browser stores never let an extension run: "reload the page" would only ever bring the same warning back
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname === 'chromewebstore.google.com' || hostname === 'addons.opera.com') return true;
    if (hostname === 'chrome.google.com' && pathname.startsWith('/webstore')) return true;
    if (hostname === 'microsoftedge.microsoft.com' && pathname.startsWith('/addons')) return true;
  } catch {}
  return false;
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  existing?.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status'); // read out when it appears
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 240);
  }, 2000);
}

function showDisabledState(messageKey = 'unsupportedPage') {
  document.body.classList.add('is-disabled');
  const activeContent = document.getElementById('activeContent');
  const disabledView = document.getElementById('disabledView');
  if (activeContent) activeContent.style.display = 'none';
  if (disabledView) {
    disabledView.style.display = 'grid';
    const msgEl = document.getElementById('disabledMessageText');
    if (msgEl && window.SuperUnlockerI18n) {
      msgEl.setAttribute('data-i18n', messageKey); // so a language change keeps the right text
      msgEl.textContent = window.SuperUnlockerI18n.t(messageKey);
    }
  }
  offerLeavingGlobalMode();
}

// Global mode is browser-wide. On a page the extension cannot run on, the mode bar is gone, so the way out is offered here.
async function offerLeavingGlobalMode() {
  const button = document.getElementById('disabledGlobalOff');
  if (!button) return;
  try {
    const flags = await storage.get([GLOBAL_MODE_KEY]);
    if (flags[GLOBAL_MODE_KEY] !== true) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
      await storage.set({ [GLOBAL_MODE_KEY]: false });
      button.hidden = true;
    }, { once: true });
  } catch {}
}

// While a dialog is open the page behind it cannot be reached: it is out of the tab order and out of the reading order.
function setBackgroundInert(on) {
  for (const element of [document.querySelector('header.header'), document.getElementById('activeContent'), document.getElementById('disabledView')]) {
    if (!element) continue;
    if (on) element.setAttribute('inert', '');
    else element.removeAttribute('inert');
  }
}

function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  const applyTheme = (theme) => {
    const effective = theme === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    html.setAttribute('data-theme', effective);
  };

  try {
    const cached = localStorage.getItem('superUnlockerTheme');
    if (cached && (cached === 'dark' || cached === 'light' || cached === 'system')) {
      applyTheme(cached);
    }
  } catch {}

  storage.get('superUnlockerTheme').then(data => {
    const saved = data.superUnlockerTheme;
    if (saved && (saved === 'dark' || saved === 'light' || saved === 'system')) {
      applyTheme(saved);
      try { localStorage.setItem('superUnlockerTheme', saved); } catch {}
    }
  }).catch(() => {});

  // Spam guard. A press while a theme change is still playing (or has only just finished) is ignored: while the reveal plays the browser hands
  // every pointer event to its animation layers, so such presses never reach the button anyway, and the short cooldown covers the moment after
  // it. Every accepted press plays the whole reveal, then the page holds its theme. (A press used to be switched at once when it came during
  // the animation: the animation was skipped and the screen flashed through the other theme.)
  const COOLDOWN_MS = 650; // the reveal lasts 480 ms
  let lockedUntil = 0;

  const persist = (theme) => {
    try { localStorage.setItem('superUnlockerTheme', theme); } catch {}
    storage.set({ superUnlockerTheme: theme });
  };

  // The page's own surfaces fade between colours (popup.css "Smooth Surface Interpolation"); while the theme is switched that fade must be
  // off, or every surface would pass through grey. The class is put back only once the new colours have been painted.
  const switchAtOnce = (theme) => {
    html.classList.add('theme-switching');
    html.setAttribute('data-theme', theme);
    persist(theme);
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('theme-switching')));
  };

  themeToggle?.addEventListener('click', (event) => {
    const now = performance.now();
    if (now < lockedUntil) return;
    lockedUntil = now + COOLDOWN_MS;

    themeToggle.classList.add('pulsing');
    setTimeout(() => themeToggle.classList.remove('pulsing'), 320);

    const next = (html.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof document.startViewTransition !== 'function') {
      switchAtOnce(next);
      return;
    }

    // Where the reveal starts and how far it reaches. popup.css plays the animation itself (keyframes "theme-reveal"), so it begins together
    // with the new picture and the new theme can never be seen whole for a frame before the circle starts.
    const rect = themeToggle.getBoundingClientRect();
    const x = event.clientX || (rect.left + rect.width / 2);
    const y = event.clientY || (rect.top + rect.height / 2);
    html.style.setProperty('--reveal-x', x + 'px');
    html.style.setProperty('--reveal-y', y + 'px');
    html.style.setProperty('--reveal-r', Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 'px');

    html.classList.add('theme-switching');
    const finish = () => html.classList.remove('theme-switching');
    try {
      document.startViewTransition(() => {
        html.setAttribute('data-theme', next);
        persist(next);
      }).finished.then(finish, finish);
    } catch {
      finish();
      switchAtOnce(next);
    }
  });
}

function getActiveCount(state) {
  return FEATURE_KEYS.filter(key => state.features[key]?.enabled).length;
}

function render(state, toggleMap, isGlobal, hostname) {
  const i18n = window.SuperUnlockerI18n;

  // Render toggle checkboxes
  for (const key of FEATURE_KEYS) {
    const toggle = toggleMap[key];
    if (!toggle) continue;

    const enabled = state.features[key]?.enabled === true;
    toggle.checked = enabled;
    toggle.closest('.control-card')?.classList.toggle('active', enabled);
  }

  // Update domain badge
  const domainBadge = document.getElementById('domainBadge');
  if (domainBadge) {
    domainBadge.textContent = isGlobal ? i18n.t('badgeGlobalTab') : hostname;
  }

  // Mode buttons active class
  for (const [id, on] of [['modeSiteBtn', !isGlobal], ['modeGlobalBtn', isGlobal]]) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.classList.toggle('active', on);
    button.setAttribute('aria-checked', String(on)); // a screen reader said "selected" for "This site" also in Global mode
    button.setAttribute('tabindex', on ? '0' : '-1');
  }
  const globalHint = document.getElementById('globalModeHint');
  if (globalHint) globalHint.hidden = !isGlobal;

  const unlockActive = UNLOCK_KEYS.filter(key => state.features[key]?.enabled).length;
  const total = getActiveCount(state);

  const countEl = document.getElementById('activeCount');
  const textEl = document.getElementById('statusText');
  const dotEl = document.querySelector('.status-dot');

  if (countEl) {
    countEl.textContent = i18n.t('statusActiveCount', { n: total });
    countEl.classList.toggle('has-active', total > 0);
  }
  dotEl?.classList.toggle('active', total > 0);

  if (textEl) {
    if (total === 0) {
      textEl.textContent = i18n.t('statusAllOff');
    } else if (unlockActive === UNLOCK_KEYS.length) {
      textEl.textContent = i18n.t('statusAllOn');
    } else {
      textEl.textContent = i18n.t('statusPartial'); // the number is in #activeCount, next to it: not twice in the same live region
    }
  }

  const button = document.getElementById('quickAllBtn');
  const buttonText = document.getElementById('quickAllText');
  const allUnlocksActive = UNLOCK_KEYS.every(key => state.features[key]?.enabled);

  button?.classList.toggle('all-active', allUnlocksActive);
  if (buttonText) {
    buttonText.textContent = allUnlocksActive ? i18n.t('btnLockAll') : i18n.t('btnUnlockAll');
  }
}

function renderDiagnosis(diagnosis) {
  const i18n = window.SuperUnlockerI18n;
  const card = document.getElementById('diagnosisCard');
  const body = document.getElementById('diagnosisBody');
  const tagsContainer = document.getElementById('barrierTags');
  if (!card || !body || !tagsContainer) return;

  if (diagnosis) {
    if (diagnosis.protectionMessages?.length || diagnosis.historicalAlertTrap) {
      diagnosis.hasAlertTrap = true;
    }
    if (diagnosis.copyProtectionEvidence) {
      diagnosis.hasCopyLock = true;
    }
  }

  const hasAnyBarrier = diagnosis && (
    diagnosis.totalBarriers > 0 ||
    diagnosis.hasRightClickLock ||
    diagnosis.hasSelectionLock ||
    diagnosis.hasCopyLock ||
    diagnosis.hasScrollLock ||
    diagnosis.hasBlurFilter ||
    diagnosis.hasAlertTrap
  );

  if (hasAnyBarrier) {
    const total = diagnosis.totalBarriers || (
      (diagnosis.hasRightClickLock ? 1 : 0) +
      (diagnosis.hasSelectionLock ? 1 : 0) +
      (diagnosis.hasCopyLock ? 1 : 0) +
      (diagnosis.hasScrollLock ? 1 : 0) +
      (diagnosis.hasBlurFilter ? 1 : 0) +
      (diagnosis.hasAlertTrap ? 1 : 0)
    );

    card.classList.add('has-barriers');
    // "found and bypassed" is true only if every barrier found has its unlocker switched on
    const on = (key) => activeState?.features?.[key]?.enabled === true;
    const bypassed =
      (!diagnosis.hasRightClickLock || on('rightClick')) &&
      (!diagnosis.hasSelectionLock || on('copy')) &&
      (!diagnosis.hasCopyLock || on('copy') || on('clipboard')) &&
      (!diagnosis.hasScrollLock || on('scrollbar')) &&
      (!diagnosis.hasBlurFilter || on('antiBlur')) &&
      (!diagnosis.hasAlertTrap || on('alert'));
    body.textContent = i18n.t(bypassed ? 'scannerDetected' : 'scannerDetectedOnly', { n: total });
    body.setAttribute('data-i18n-state', bypassed ? 'scannerDetected' : 'scannerDetectedOnly');
    tagsContainer.innerHTML = '';

    const tags = [];
    if (diagnosis.hasRightClickLock) tags.push(i18n.t('barrierRightClick'));
    if (diagnosis.hasSelectionLock) tags.push(i18n.t('barrierSelection'));
    if (diagnosis.hasCopyLock) tags.push(i18n.t('barrierCopy'));
    if (diagnosis.hasScrollLock) tags.push(i18n.t('barrierScroll'));
    if (diagnosis.hasBlurFilter) tags.push(i18n.t('barrierBlur'));
    if (diagnosis.hasAlertTrap) tags.push(i18n.t('barrierAlert'));

    for (const tag of tags) {
      const span = document.createElement('span');
      span.className = 'barrier-tag';
      span.textContent = tag;
      tagsContainer.appendChild(span);
    }
  } else {
    card.classList.remove('has-barriers');
    body.textContent = i18n.t('scannerClean');
    tagsContainer.innerHTML = '';
  }
}

let activeTab = null;
let activeHostname = '';
let activeState = null;
let activeToggleMap = null;
let activeIsGlobal = false;
let currentDiagnosis = null;

/**
 * A page that never loaded the content script (opened before the extension was installed or updated, PDF viewer,
 * local files...) cannot be reached: the settings are saved but nothing happens. Say so, and do not show a
 * diagnosis ("No restrictions detected") for a page that was never scanned.
 */
function setPageReachable(reachable) {
  const notice = document.getElementById('pageNotReadyNotice');
  const card = document.getElementById('diagnosisCard');
  if (notice) notice.hidden = reachable;
  if (card) card.hidden = !reachable;
}

/** Asks the page for its diagnosis; true if the page answered. `quiet` leaves the warning alone when it does not. */
async function refreshDiagnosis(tabId, { quiet = false } = {}) {
  try {
    // frameId 0 = the top frame: without it every frame answers and the caller gets whichever reply comes first
    const res = await chrome.tabs.sendMessage(tabId, { action: 'getDiagnosis' }, { frameId: 0 });
    if (!res?.diagnosis) { if (!quiet) setPageReachable(false); return false; }
    currentDiagnosis = res.diagnosis;
    setPageReachable(true);
    renderDiagnosis(res.diagnosis);
    return true;
  } catch {
    if (!quiet) setPageReachable(false);
    return false;
  }
}

/** The page did not answer even after a reload: it is a page that does not allow extensions (stores, internal pages). */
function showPageBlocked() {
  const notice = document.getElementById('pageNotReadyNotice');
  const text = notice?.querySelector('.notice-text');
  if (text) {
    text.setAttribute('data-i18n', 'pageBlocked'); // so a language change keeps the right text
    text.textContent = window.SuperUnlockerI18n.t('pageBlocked');
  }
  const reload = document.getElementById('pageNotReadyReload');
  if (reload) reload.hidden = true; // the same button again would be a lie
  if (notice) notice.hidden = false;
  const card = document.getElementById('diagnosisCard');
  if (card) card.hidden = true;
}

function initLanguagePicker(onLanguageChanged) {
  const langToggle = document.getElementById('langToggle');
  const langText = document.getElementById('langText');
  const langPopover = document.getElementById('langPopover');
  const langList = document.getElementById('langList');
  const i18n = window.SuperUnlockerI18n;

  function renderLanguageOptions() {
    if (!langList || !i18n) return;
    const languages = i18n.getAvailableLanguages ? i18n.getAvailableLanguages() : [];
    const current = i18n.getLang();

    langList.innerHTML = languages.map(lang => `
      <button class="lang-item ${lang.code === current ? 'active' : ''}" data-code="${lang.code}" role="option" aria-selected="${lang.code === current}">
        <span class="lang-item-label">
          <span class="lang-item-code">${lang.short}</span>
          <span>${lang.label}</span>
        </span>
        ${lang.code === current ? `
          <svg class="lang-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ` : ''}
      </button>
    `).join('');

    langList.querySelectorAll('.lang-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code');
        if (!code || code === i18n.getLang()) {
          closeLanguagePopover();
          return;
        }

        await i18n.setLang(code);
        if (langText) langText.textContent = code.toUpperCase();
        i18n.applyToDOM();

        // the disabled screen's own message follows the language (it is data-i18n like the rest)

        renderLanguageOptions();
        closeLanguagePopover();

        if (typeof onLanguageChanged === 'function') {
          onLanguageChanged(code);
        }
      });
    });
  }

  function languageItems() {
    return [...(langList?.querySelectorAll('.lang-item') || [])];
  }

  function openLanguagePopover() {
    renderLanguageOptions();
    langPopover?.classList.add('open');
    langToggle?.setAttribute('aria-expanded', 'true');
    // the keyboard lands on the chosen language
    requestAnimationFrame(() => (langList?.querySelector('.lang-item.active') || languageItems()[0])?.focus());
  }

  function closeLanguagePopover() {
    langPopover?.classList.remove('open');
    langToggle?.setAttribute('aria-expanded', 'false');
  }

  // arrow keys move through the list, Home and End jump to its ends
  langList?.addEventListener('keydown', (e) => {
    const items = languageItems();
    const at = items.indexOf(document.activeElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    items[(to + items.length) % items.length]?.focus();
  });

  langToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = langPopover?.classList.contains('open');
    if (isOpen) closeLanguagePopover();
    else openLanguagePopover();
  });

  document.addEventListener('click', (e) => {
    if (!langPopover?.contains(e.target) && !langToggle?.contains(e.target)) {
      closeLanguagePopover();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && langPopover?.classList.contains('open')) {
      closeLanguagePopover();
      langToggle?.focus();
    }
  });

  renderLanguageOptions();
}

function initContactModal() {
  const contactModal = document.getElementById('contactModal');
  const contactBtn = document.getElementById('contactBtn');
  const contactHeaderBtn = document.getElementById('contactHeaderBtn');
  const contactModalClose = document.getElementById('contactModalClose');
  const contactSiteDomain = document.getElementById('contactSiteDomain');
  const contactTelemetryDot = document.getElementById('contactTelemetryDot');
  const contactTelemetryPill = document.getElementById('contactTelemetryPill');
  const contactBarrierCountText = document.getElementById('contactBarrierCountText');
  const telemetryAccordion = document.getElementById('telemetryAccordion');
  const telemetryCodePreview = document.getElementById('telemetryCodePreview');
  const copyDiagnosticsBtn = document.getElementById('copyDiagnosticsBtn');
  const copyDiagnosticsLabel = document.getElementById('copyDiagnosticsLabel');
  const sendReportBtn = document.getElementById('sendReportBtn');
  const contactMessage = document.getElementById('contactMessage');
  const categoryChips = document.querySelectorAll('.category-chip');
  const i18n = window.SuperUnlockerI18n;

  function getDiagnosticReport() {
    const activeKeys = Object.entries(activeState?.features || {})
      .filter(([, f]) => f.enabled)
      .map(([k]) => k);

    const barrierList = [];
    if (currentDiagnosis) {
      if (currentDiagnosis.hasRightClickLock) barrierList.push('RightClick Lock');
      if (currentDiagnosis.hasSelectionLock) barrierList.push('Selection Lock');
      if (currentDiagnosis.hasCopyLock) barrierList.push('Copy Lock');
      if (currentDiagnosis.hasScrollLock) barrierList.push('Scroll Lock');
      if (currentDiagnosis.hasBlurFilter) barrierList.push('Visual Blur Filter');
      if (currentDiagnosis.hasAlertTrap) barrierList.push('Alert Trap');
    }

    const selectedCat = document.querySelector('input[name="issueCategory"]:checked')?.value || 'locked';

    // The query string and fragment can carry session tokens or personal data; the report only needs the page itself.
    let website = activeHostname || 'System Page';
    try {
      const u = new URL(activeTab?.url);
      website = u.origin !== 'null' ? u.origin + u.pathname : website;
    } catch {}

    return [
      `--- SELECTRA ISSUE REPORT ---`,
      `Category: ${selectedCat}`,
      `Website: ${website}`,
      `Extension Version: v${typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : '?'}`,
      `Active Features (${activeKeys.length}): ${activeKeys.join(', ') || 'none'}`,
      `Detected Barriers (${barrierList.length}): ${barrierList.join(', ') || 'None detected'}`,
      `User Agent: ${navigator.userAgent}`,
      `Timestamp: ${new Date().toISOString()}`,
      `User Notes:`,
      `${contactMessage?.value.trim() || '(No notes provided)'}`,
      `-----------------------------------`
    ].join('\n');
  }

  function updateTelemetryView() {
    const domainText = activeHostname || (activeTab?.url ? 'system' : 'webpage');
    if (contactSiteDomain) contactSiteDomain.textContent = domainText;

    const barrierCount = currentDiagnosis?.totalBarriers || 0;
    const hasBarriers = barrierCount > 0 || (
      currentDiagnosis && (
        currentDiagnosis.hasRightClickLock ||
        currentDiagnosis.hasSelectionLock ||
        currentDiagnosis.hasCopyLock ||
        currentDiagnosis.hasScrollLock ||
        currentDiagnosis.hasBlurFilter ||
        currentDiagnosis.hasAlertTrap
      )
    );

    if (contactTelemetryDot) {
      contactTelemetryDot.classList.toggle('warning', hasBarriers);
    }
    if (contactTelemetryPill) {
      contactTelemetryPill.classList.toggle('warning', hasBarriers);
    }

    if (contactBarrierCountText && i18n) {
      if (hasBarriers) {
        contactBarrierCountText.textContent = i18n.t('contactBarriersCount', { n: barrierCount || 1 });
      } else {
        contactBarrierCountText.textContent = i18n.t('contactLivePage');
      }
    }

    if (telemetryCodePreview) {
      telemetryCodePreview.textContent = getDiagnosticReport();
    }
  }

  let contactOpener = null;

  function openContactModal() {
    updateTelemetryView();
    if (telemetryAccordion) telemetryAccordion.open = false;

    contactOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBackgroundInert(true);
    contactModal?.classList.add('open');
    contactModal?.setAttribute('aria-hidden', 'false');
    contactMessage?.focus();
  }

  function closeContactModal() {
    contactModal?.classList.remove('open');
    contactModal?.setAttribute('aria-hidden', 'true');
    setBackgroundInert(false);
    if (contactOpener && contactOpener.isConnected) contactOpener.focus(); // back to the button that opened it
    contactOpener = null;
  }

  contactBtn?.addEventListener('click', openContactModal);
  contactHeaderBtn?.addEventListener('click', openContactModal);
  contactModalClose?.addEventListener('click', closeContactModal);

  contactModal?.addEventListener('click', (e) => {
    if (e.target === contactModal) closeContactModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && contactModal?.classList.contains('open')) {
      closeContactModal();
    }
  });

  const selectCategory = (chip) => {
    categoryChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const radio = chip.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
    if (telemetryCodePreview) {
      telemetryCodePreview.textContent = getDiagnosticReport();
    }
  };
  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => selectCategory(chip));
    // the arrow keys move a radio group without a click: the chip follows
    chip.querySelector('input[type="radio"]')?.addEventListener('change', () => selectCategory(chip));
  });

  contactMessage?.addEventListener('input', () => {
    if (telemetryAccordion?.open && telemetryCodePreview) {
      telemetryCodePreview.textContent = getDiagnosticReport();
    }
  });

  let copiedTimeout = null;
  copyDiagnosticsBtn?.addEventListener('click', async () => {
    const text = getDiagnosticReport();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
    }

    copyDiagnosticsBtn.classList.add('copied');
    const iconCopy = copyDiagnosticsBtn.querySelector('.icon-copy');
    const iconCheck = copyDiagnosticsBtn.querySelector('.icon-check');
    if (iconCopy) iconCopy.style.display = 'none';
    if (iconCheck) iconCheck.style.display = 'inline-block'; // (their resting state is in popup.css)
    if (copyDiagnosticsLabel && i18n) {
      copyDiagnosticsLabel.textContent = i18n.t('contactCopiedFeedback');
    }

    showToast(i18n ? i18n.t('toastDiagnosticsCopied') : 'Diagnostics copied');

    clearTimeout(copiedTimeout);
    copiedTimeout = setTimeout(() => {
      copyDiagnosticsBtn.classList.remove('copied');
      if (iconCopy) iconCopy.style.display = 'inline-block';
      if (iconCheck) iconCheck.style.display = 'none';
      if (copyDiagnosticsLabel && i18n) {
        copyDiagnosticsLabel.textContent = i18n.t('btnCopyDiagnostics');
      }
    }, 1800);
  });

  // Nothing is sent from here. The report is copied to the clipboard and the extension's own page in the Chrome Web
  // Store (its Support tab) is opened for the user to paste it into. A store-installed extension's id IS its store id.
  // The copy must come FIRST: the new tab takes focus, after which this popup is closed and navigator.clipboard (which
  // needs a focused document) can no longer write. The modal's hint tells the user what to do on that page.
  // The same closing is why the confirmation comes before the tab: the button says "Copied!" for a moment, then the
  // store page opens (opening it at once left the user without any sign that anything had been copied).
  sendReportBtn?.addEventListener('click', async () => {
    if (sendReportBtn.disabled) return;
    const text = getDiagnosticReport();
    const id = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : '';
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {}

    const label = sendReportBtn.querySelector('.btn-label');
    const originalLabel = label ? label.textContent : '';
    if (copied) {
      if (label && i18n) label.textContent = i18n.t('contactCopiedFeedback');
      sendReportBtn.classList.add('copied');
      sendReportBtn.disabled = true;
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
    if (id) window.open(`https://chromewebstore.google.com/detail/${id}/support`, '_blank', 'noopener,noreferrer'); // the new tab gets no handle on this page
    closeContactModal();
    if (label) label.textContent = originalLabel; // when the popup stays open (it does not in a browser), leave the button as it was
    sendReportBtn.classList.remove('copied');
    sendReportBtn.disabled = false;
  });
}

// Privacy Policy / licenses: the packaged legal pages open in a viewer inside the popup. Nothing is fetched from the
// network: the frame shows files that ship inside the extension.
function initLegalViewer() {
  const modal = document.getElementById('legalModal');
  const frame = document.getElementById('legalFrame');
  const title = document.getElementById('legalModalTitle');
  const closeBtn = document.getElementById('legalModalClose');
  const openTab = document.getElementById('legalOpenTab');
  if (!modal || !frame || !title || !closeBtn || !openTab) return;
  let opener = null;

  const isOpen = () => modal.classList.contains('open');

  // what the line under the title says: the policy and the licences exist in English only, the changelog in English and Turkish
  const note = modal.querySelector('.modal-desc');

  function open(link) {
    opener = link;
    const href = link.getAttribute('href');
    const kind = link.dataset.legal || 'privacy';
    title.textContent = link.textContent.trim();
    frame.title = title.textContent;
    modal.querySelectorAll('[data-legal-icon]').forEach((iconEl) => {
      if (iconEl.getAttribute('data-legal-icon') === kind) iconEl.removeAttribute('hidden');
      else iconEl.setAttribute('hidden', '');
    });
    if (note) {
      note.setAttribute('data-i18n', kind === 'changelog' ? 'legalChangelogNote' : 'legalEnglishOnly');
      note.textContent = window.SuperUnlockerI18n.t(note.getAttribute('data-i18n'));
    }
    if (frame.getAttribute('src') !== href) frame.setAttribute('src', href);
    openTab.setAttribute('href', href);
    setBackgroundInert(true);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    setBackgroundInert(false);
    if (opener) opener.focus();
    opener = null;
  }

  document.querySelectorAll('.legal-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; // new-tab gestures keep working
      e.preventDefault();
      open(link);
    });
  });

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });

  // key presses made inside the frame never reach this document; legal/legal.js relays Escape
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.source === frame.contentWindow && e.data && e.data.type === 'selectra-legal-close' && isOpen()) close();
  });
}

async function runPopup() {
  const i18n = window.SuperUnlockerI18n;
  await i18n.init();
  i18n.applyToDOM();

  const initialLangText = document.getElementById('langText');
  if (initialLangText) initialLangText.textContent = i18n.getLang().toUpperCase();

  initTheme();

  // the badges show the whole version of the real manifest (a patch release must be visible too), so a version bump cannot leave them behind
  try {
    const version = chrome.runtime.getManifest().version;
    document.querySelectorAll('.footer-version-tag, #telemetrySnippetBadge').forEach(el => { el.textContent = `v${version}`; });
  } catch {}

  initLanguagePicker((code) => {
    if (activeState && activeToggleMap) {
      render(activeState, activeToggleMap, activeIsGlobal, activeHostname);
      if (activeTab?.id && typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'getDiagnosis' }, { frameId: 0 }).then(res => {
          if (res?.diagnosis) renderDiagnosis(res.diagnosis);
        }).catch(() => {});
      }
    }
  });

  initContactModal();
  initLegalViewer();

  let tab = null;
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = tabs[0];
    } catch {}
  }

  // a tab that is still loading has no url yet, only the address it is going to
  if (tab && !tab.url && tab.pendingUrl) tab = { ...tab, url: tab.pendingUrl };

  // Standalone preview fallback if opened outside extension context
  if (!tab || !tab.url) {
    if (location.protocol === 'file:' || location.protocol === 'http:' || location.protocol === 'https:') {
      tab = { id: 1, url: 'https://example.com/article' };
    } else {
      showDisabledState();
      return;
    }
  }

  activeTab = tab;

  if (isUnsupportedPage(tab.url)) {
    try { activeHostname = new URL(tab.url).protocol.replace(':', ''); } catch {}
    showDisabledState();
    return;
  }

  // The PDF viewer is not a page the extension runs in: "reload the page" would only lose the reader's place.
  try {
    if (/\.pdf$/i.test(new URL(tab.url).pathname)) {
      activeHostname = new URL(tab.url).hostname;
      showDisabledState('pdfPage');
      return;
    }
  } catch {}

  let hostname;
  try { hostname = new URL(tab.url).hostname; }
  catch { showDisabledState(); return; }

  activeHostname = hostname;

  const storageKey = siteKey(hostname);
  const globalKey = GLOBAL_SETTINGS_KEY;
  // A private window keeps the settings of its sites in memory only: a list of the sites someone visited privately must not end up on disk.
  const siteArea = tab.incognito ? 'session' : 'local';

  // "This site" is that exact host's OWN entry and nothing else; "Global" is the global entry. Neither borrows from the other.
  const flags = await storage.get([globalKey, GLOBAL_MODE_KEY]);
  let isGlobal = flags[GLOBAL_MODE_KEY] === true;
  activeIsGlobal = isGlobal;
  const siteStored = !isGlobal && storageKey ? await storage.get([storageKey], siteArea) : {};
  let state = resolveSettings(isGlobal ? flags : siteStored, hostname, isGlobal);
  activeState = state;

  const toggleMap = Object.fromEntries(
    FEATURE_KEYS.map(key => [key, document.getElementById(`${key}Toggle`)]).filter(([, node]) => node)
  );
  activeToggleMap = toggleMap;

  let persistQueue = Promise.resolve();
  // Our own writes come back through storage.onChanged. If such an echo (older than the newest click) were applied,
  // it would overwrite the clicks made in between and the next write would save the stale state: clicks got lost.
  let pendingWrites = 0;
  let lastWriteAt = 0;

  function commit(nextState, options = {}) {
    state = normalizeSettings(nextState);
    activeState = state;
    render(state, toggleMap, isGlobal, hostname);

    // Taken NOW, not when the write runs: the mode can be switched while a write waits in the queue, and it has to go where the click was made.
    const target = { global: isGlobal, key: isGlobal ? globalKey : storageKey, snapshot: deepClone(state), reset: options.removeStorage === true };

    pendingWrites++;
    persistQueue = persistQueue.then(async () => {
      // What the page runs after this write: with "This site" that is the site's own entry, so after a reset (or with nothing switched on) every
      // unlocker is off, whatever the global settings are.
      const effective = target.reset ? emptySettings() : target.snapshot;
      if (target.key) {
        const area = target.global ? 'local' : siteArea;
        // an entry of a site with nothing on is the same as no entry, and it is not kept
        if (target.reset || (!target.global && countEnabled(target.snapshot) === 0)) await storage.remove([target.key], area);
        else await storage.set({ [target.key]: target.snapshot }, area);
      }

      if (target.global !== isGlobal) return; // the mode was switched meanwhile: the page runs the other settings, and the popup shows them
      if (target.reset) {
        state = effective;
        activeState = effective;
        render(effective, toggleMap, isGlobal, hostname);
      }

      if (tab.id && typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
        try {
          const reply = await chrome.tabs.sendMessage(tab.id, {
            action: 'applySettings',
            config: effective
          });
          // the page answered: if the warning was up (it was unreachable before), it is not anymore
          if (reply && !document.getElementById('pageNotReadyNotice')?.hidden) refreshDiagnosis(tab.id);
        } catch {
          setPageReachable(false); // the setting is saved, but the page cannot be told: say so instead of failing silently
        }
      }
    }).catch(() => {}).finally(() => {
      pendingWrites--;
      lastWriteAt = Date.now();
    });

    return persistQueue;
  }

  document.getElementById('pageNotReadyReload')?.addEventListener('click', () => {
    if (tab?.id && typeof chrome !== 'undefined' && chrome.tabs?.reload) chrome.tabs.reload(tab.id);
    const notice = document.getElementById('pageNotReadyNotice');
    if (notice) notice.hidden = true;
    // The page is loading again: look at it a few times. If it never answers, it does not allow extensions at all.
    let tries = 0;
    const look = async () => {
      if (await refreshDiagnosis(tab.id, { quiet: true })) return;
      if (++tries < 3) setTimeout(look, 1500);
      else showPageBlocked();
    };
    setTimeout(look, 1500);
  });

  // Mode switcher. It goes through the same queue as the writes, so a write made before the switch still goes where it was made.
  function switchMode(toGlobal) {
    if (isGlobal === toGlobal) return persistQueue;
    isGlobal = toGlobal;
    activeIsGlobal = toGlobal;
    pendingWrites++;
    persistQueue = persistQueue.then(async () => {
      await storage.set({ [GLOBAL_MODE_KEY]: toGlobal });
      if (isGlobal !== toGlobal) return; // switched again meanwhile
      const fresh = toGlobal ? await storage.get([globalKey]) : (storageKey ? await storage.get([storageKey], siteArea) : {});
      state = resolveSettings(fresh, hostname, toGlobal);
      activeState = state;
      // Only the MODE changed. The pages follow the flag by themselves; saving the settings shown here would pin a copy of them to this site.
      render(state, toggleMap, isGlobal, hostname);
    }).catch(() => {}).finally(() => {
      pendingWrites--;
      lastWriteAt = Date.now();
    });
    return persistQueue;
  }

  document.getElementById('modeSiteBtn')?.addEventListener('click', () => switchMode(false));
  document.getElementById('modeGlobalBtn')?.addEventListener('click', () => switchMode(true));

  // The whole card is the target of its switch (the small switch alone was a 36 x 20 px target): a click on the title, the icon or the description
  // presses it. A click that ends a text selection does not.
  document.querySelectorAll('.control-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('.toggle, input, a, button')) return; // the switch handles its own click
      if (String(window.getSelection?.() || '').length) return;
      card.querySelector('input[type="checkbox"]')?.click();
    });
  });

  // The two radios of the mode bar: the arrow keys move between them (a radio group is one tab stop).
  document.querySelector('.segmented-control')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    switchMode(!isGlobal);
    document.getElementById(isGlobal ? 'modeGlobalBtn' : 'modeSiteBtn')?.focus();
  });


  // Feature toggle listeners
  for (const key of FEATURE_KEYS) {
    const toggle = toggleMap[key];
    toggle?.addEventListener('change', () => {
      state.features[key].enabled = toggle.checked;
      commit(state);
    });
  }

  // Quick action: Toggle all unlockers
  document.getElementById('quickAllBtn')?.addEventListener('click', async () => {
    const allActive = UNLOCK_KEYS.every(key => state.features[key]?.enabled);
    const target = !allActive;

    for (const key of UNLOCK_KEYS) state.features[key].enabled = target;
    await commit(state);
    showToast(target ? i18n.t('toastAllUnlocked') : i18n.t('toastAllLocked'));
  });

  // Companion action: Reload current tab to apply changes immediately
  const reloadBtn = document.getElementById('reloadTabBtn');
  reloadBtn?.addEventListener('click', () => {
    reloadBtn.classList.add('spinning');
    setTimeout(() => reloadBtn.classList.remove('spinning'), 650);

    if (tab?.id && typeof chrome !== 'undefined' && chrome.tabs?.reload) {
      chrome.tabs.reload(tab.id);
    }
    showToast(i18n.t('toastPageReloaded') || 'Page reloaded');
  });

  // Reset to defaults (footer)
  document.getElementById('resetBtn')?.addEventListener('click', async () => {
    const reset = emptySettings();
    await commit(reset, { removeStorage: true });
    showToast(isGlobal ? i18n.t('toastResetGlobal') : i18n.t('toastResetSite'));
  });

  // Live Barrier Diagnosis Fetch
  if (tab.id && typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
    refreshDiagnosis(tab.id);
  } else {
    // Demo mock diagnosis for standalone preview
    currentDiagnosis = {
      hasRightClickLock: true,
      hasSelectionLock: true,
      hasCopyLock: true,
      totalBarriers: 3
    };
    renderDiagnosis(currentDiagnosis);
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      const modeOrGlobal = area === 'local' && (changes[GLOBAL_MODE_KEY] || changes[globalKey]);
      const site = storageKey && changes[storageKey] && area === siteArea;
      if (!modeOrGlobal && !site) return;
      if (pendingWrites > 0 || Date.now() - lastWriteAt < 400) return; // our own echo, not a change from elsewhere
      // read what is stored instead of guessing it from the change
      (async () => {
        const current = await storage.get([GLOBAL_MODE_KEY, globalKey]);
        isGlobal = current[GLOBAL_MODE_KEY] === true;
        activeIsGlobal = isGlobal;
        const data = isGlobal ? current : (storageKey ? await storage.get([storageKey], siteArea) : {});
        state = resolveSettings(data, hostname, isGlobal);
        activeState = state;
        render(state, toggleMap, isGlobal, hostname);
      })().catch(() => {});
    });
  }

  render(state, toggleMap, isGlobal, hostname);
}

document.addEventListener('DOMContentLoaded', () => {
  runPopup().catch(() => showDisabledState());
});
