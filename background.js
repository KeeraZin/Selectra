// Selectra - Service Worker (MV3)
// Handles context menus, badge management, global/site mode sync, and CORS downloads.

'use strict';

importScripts('shared.js');
const {
  UNLOCK_KEYS, GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY, countEnabled, siteKey, resolveSettings, isPrivateHost, isExcludedSensitiveUrl
} = self.SelectraShared;

// Private windows keep a site's settings in memory only (chrome.storage.session): a list of the sites someone visited privately must not
// end up on disk. Content scripts read the same area when they run in a private window, so it has to be readable from them.
try { chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {}); } catch {}
const siteArea = (incognito) => (incognito ? chrome.storage.session : chrome.storage.local);

const isWebUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

async function setBadge(tabId, count, isGlobal = false) {
  const text = count > 0 ? (isGlobal ? 'ON' : String(Math.min(count, 99))) : '';

  try {
    await chrome.action.setBadgeText({ tabId, text });
    if (count > 0) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: isGlobal ? '#6366f1' : '#10b981' });
      await chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' });
    }
  } catch {
    // Tab may have been closed
  }
}

async function updateBadgeForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url || !isWebUrl(tab.url)) {
      await setBadge(tabId, 0);
      return;
    }

    const hostname = new URL(tab.url).hostname;
    const key = siteKey(hostname);
    if (!key) {
      await setBadge(tabId, 0);
      return;
    }

    const global = await chrome.storage.local.get([GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY]);
    const isGlobal = global[GLOBAL_MODE_KEY] === true;
    const data = isGlobal ? global : await siteArea(tab.incognito).get(key).catch(() => ({}));
    const count = countEnabled(resolveSettings(data, hostname, isGlobal));
    await setBadge(tabId, count, isGlobal && count > 0);
  } catch {
    // the tab went away while we looked
  }
}

async function refreshAllBadges() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) if (Number.isInteger(t.id)) updateBadgeForTab(t.id);
  } catch {}
}

// ─── Chrome Context Menu Setup (10 Languages - blader/humanizer style) ───
const MENU_TEXTS = {
  en: {
    toggleAll: 'Selectra: Toggle all',
    forceCopy: 'Selectra: Clean copy',
    downloadImage: 'Selectra: Download image',
    captureFullPage: 'Selectra: Full-page screenshot'
  },
  tr: {
    toggleAll: 'Selectra: Kilitleri aç/kapat',
    forceCopy: 'Selectra: Saf kopyala',
    downloadImage: 'Selectra: Görseli indir',
    captureFullPage: 'Selectra: Tam sayfa ekran görüntüsü'
  },
  de: {
    toggleAll: 'Selectra: Alles umstellen',
    forceCopy: 'Selectra: Sauber kopieren',
    downloadImage: 'Selectra: Bild herunterladen',
    captureFullPage: 'Selectra: Ganzseiten-Screenshot'
  },
  fr: {
    toggleAll: 'Selectra : Tout basculer',
    forceCopy: 'Selectra : Copie propre',
    downloadImage: 'Selectra : Télécharger l\'image',
    captureFullPage: 'Selectra : Capture pleine page'
  },
  es: {
    toggleAll: 'Selectra: Alternar todo',
    forceCopy: 'Selectra: Copia limpia',
    downloadImage: 'Selectra: Descargar imagen',
    captureFullPage: 'Selectra: Captura de página completa'
  },
  pt: {
    toggleAll: 'Selectra: Alternar tudo',
    forceCopy: 'Selectra: Cópia limpa',
    downloadImage: 'Selectra: Baixar imagem',
    captureFullPage: 'Selectra: Captura de página inteira'
  },
  it: {
    toggleAll: 'Selectra: Attiva/disattiva tutto',
    forceCopy: 'Selectra: Copia pulita',
    downloadImage: 'Selectra: Scarica immagine',
    captureFullPage: 'Selectra: Schermata pagina intera'
  },
  ru: {
    toggleAll: 'Selectra: Включить/выключить все',
    forceCopy: 'Selectra: Скопировать чисто',
    downloadImage: 'Selectra: Скачать изображение',
    captureFullPage: 'Selectra: Снимок всей страницы'
  },
  pl: {
    toggleAll: 'Selectra: Przełącz wszystko',
    forceCopy: 'Selectra: Czysta kopia',
    downloadImage: 'Selectra: Pobierz obraz',
    captureFullPage: 'Selectra: Zrzut całej strony'
  },
  nl: {
    toggleAll: 'Selectra: Alles in-/uitschakelen',
    forceCopy: 'Selectra: Schoon kopiëren',
    downloadImage: 'Selectra: Afbeelding downloaden',
    captureFullPage: 'Selectra: Schermafbeelding volledige pagina'
  }
};

const WEB_PAGE_PATTERNS = ['http://*/*', 'https://*/*'];
const IMAGE_UNDER_ID = 'su_download_image_under';

// One build at a time: installing a language writes the setting (which triggers a second build) while the first is still going, and two
// builds interleaving would both try to create the same ids.
let menuQueue = Promise.resolve();
function setupContextMenus(lang = 'en') {
  menuQueue = menuQueue.then(() => buildContextMenus(lang)).catch(() => {});
  return menuQueue;
}

async function buildContextMenus(lang) {
  await chrome.contextMenus.removeAll();
  const texts = Object.hasOwn(MENU_TEXTS, lang) ? MENU_TEXTS[lang] : MENU_TEXTS.en;
  const create = (properties) => new Promise((resolve) => {
    chrome.contextMenus.create(properties, () => { void chrome.runtime.lastError; resolve(); });
  });

  await create({
    id: 'su_toggle_all',
    title: texts.toggleAll,
    contexts: ['all'],
    documentUrlPatterns: WEB_PAGE_PATTERNS // toggling is per site: it means nothing on chrome:// or file:// pages
  });

  await create({
    id: 'su_force_copy',
    title: texts.forceCopy,
    contexts: ['selection']
  });

  // The browser offers the "image" context only when the pointer is on an <img>.
  await create({
    id: 'su_download_image',
    title: texts.downloadImage,
    contexts: ['image']
  });

  // A picture that is NOT an <img> (behind a transparent layer, a CSS background, a canvas) gets no image context, so this
  // second entry covers every other context. It is shown only while the content script reports a picture under the pointer.
  await create({
    id: IMAGE_UNDER_ID,
    title: texts.downloadImage,
    contexts: ['page', 'frame', 'link', 'selection', 'editable', 'video', 'audio'],
    visible: false
  });

  await create({
    id: 'su_capture_full',
    title: texts.captureFullPage,
    contexts: ['page', 'frame', 'selection', 'link'],
    documentUrlPatterns: WEB_PAGE_PATTERNS
  });
}

// The frame that last said "there is a picture under the pointer". Only that frame can take the entry away again: a slow "no" from the frame
// the pointer has just left (an ad, an embedded player) must not hide the entry for the picture the pointer is on now.
let imageUnderOwner = null;

/** What a report from `who` ({tabId, frameId}) does to the entry, given the frame that owns it now. */
function nextImageUnderState(owner, who, has) {
  if (has === true) return { owner: who, visible: true };
  if (owner && owner.tabId === who.tabId && owner.frameId === who.frameId) return { owner: null, visible: false };
  return { owner, visible: owner !== null }; // a "no" from a frame that does not own the entry changes nothing
}

function setMenuEntryVisible(visible) {
  try {
    const result = chrome.contextMenus.update(IMAGE_UNDER_ID, { visible });
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {}
}

// Switching the entry off for a reason that has nothing to do with a frame's report (another tab came to the front, a page started loading).
function setImageUnderVisible(visible) {
  if (!visible) imageUnderOwner = null;
  setMenuEntryVisible(visible);
}

// The entry's state belongs to one pointer position on one page: whatever page comes to the front starts without it.
chrome.tabs.onActivated.addListener(() => setImageUnderVisible(false));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.status === 'loading' && imageUnderOwner && imageUnderOwner.tabId === tabId) setImageUnderVisible(false); }); // (a page loading in another tab has nothing to do with this pointer)
chrome.windows?.onFocusChanged?.addListener(() => setImageUnderVisible(false));
chrome.runtime.onStartup.addListener(() => { setImageUnderVisible(false); refreshAllBadges(); });

// ─── declarativeNetRequest ───
// The extension installs no permanent rules. (An older build rewrote Content-Type on four stock-photo CDN hosts
// to get around download blocks; that is gone, and these ids are removed from profiles that still have them.)
// Only short-lived session rules exist, see withReferer() and withPrivateNetworkGuard() below.
const LEGACY_DYNAMIC_RULE_IDS = [8881, 8882, 8883, 8884];
const SESSION_RULE_ID_RANGE = [9000, 10899];

function removeLegacyDynamicRules() {
  if (!chrome.declarativeNetRequest) return;
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: LEGACY_DYNAMIC_RULE_IDS }).catch(() => {});
}

// Session rules outlive the service worker that made them (until the browser closes). A worker that was stopped in the middle of a fetch never
// reached the line that removes its rules, so whatever is left in our range when a worker starts belongs to nobody.
async function removeOrphanedSessionRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    const ids = rules.map((rule) => rule.id).filter((id) => id >= SESSION_RULE_ID_RANGE[0] && id <= SESSION_RULE_ID_RANGE[1]);
    if (ids.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
  } catch {}
}

removeLegacyDynamicRules();
// Nothing installs a rule before this has finished: it deletes whatever it finds in our id range, which would include a rule this worker had just made.
let orphanCleanup = removeOrphanedSessionRules();

chrome.runtime.onInstalled.addListener(async (details) => {
  removeLegacyDynamicRules();
  const data = await chrome.storage.local.get(['superUnlockerTheme', 'superUnlockerLang', 'configSchemaVersion']);
  if (!data.superUnlockerTheme) await chrome.storage.local.set({ superUnlockerTheme: 'system' });
  if (!data.superUnlockerLang) {
    const nav = ((navigator.language || '').slice(0, 2)).toLowerCase();
    const defaultLang = Object.hasOwn(MENU_TEXTS, nav) ? nav : 'en';
    await chrome.storage.local.set({ superUnlockerLang: defaultLang });
    setupContextMenus(defaultLang);
  } else {
    setupContextMenus(data.superUnlockerLang);
  }
  await chrome.storage.local.set({ configSchemaVersion: 5 });
  refreshAllBadges();
});

async function onContextMenuClicked(info, tab) {
  if (!tab?.id) return;
  // Every frame of the tab runs a content script. A message without a frameId reaches all of them (each answers "nothing here"),
  // so the entry is sent to the frame the menu was opened in.
  const frameOptions = Number.isInteger(info.frameId) && info.frameId >= 0 ? { frameId: info.frameId } : undefined;

  if (info.menuItemId === 'su_force_copy') {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'forceCopy', text: info.selectionText || '' }, frameOptions);
    } catch {}
    return;
  }

  if (info.menuItemId === 'su_download_image' || info.menuItemId === IMAGE_UNDER_ID) {
    await downloadFromMenu(info, tab, frameOptions);
    return;
  }

  if (info.menuItemId === 'su_toggle_all') {
    try { await toggleAllForTab(tab); } catch {}
    return;
  }

  if (info.menuItemId === 'su_capture_full') {
    try {
      const res = await capturePageScreenshot(tab, 'full', { fromMenu: true });
      if (!res.success && !res.cancelled) flashBadge(tab.id, '!');
    } catch {
      flashBadge(tab.id, '!');
    }
  }
}

chrome.contextMenus.onClicked.addListener(onContextMenuClicked);

/**
 * "Download image". The content script of the frame knows where the pointer was and finds the best picture there, the same way
 * Alt+Click does (the original behind a thumbnail, a blob: or canvas the page drew, a picture behind a transparent layer) and tells
 * the user how it went. The browser's own srcUrl is only the fallback for a frame the content script is not running in.
 */
async function downloadFromMenu(info, tab, frameOptions) {
  const pageUrl = info.frameUrl || info.pageUrl || tab.url || '';
  try {
    const reply = await chrome.tabs.sendMessage(tab.id, { action: 'downloadContextImage', srcUrl: info.srcUrl || '' }, frameOptions);
    if (reply && reply.handled === true) return;
  } catch {}

  if (!info.srcUrl || !isValidDownloadURL(info.srcUrl, pageUrl)) return;
  let name = 'image.jpg';
  try { name = sanitizeFilename(decodeURIComponent(new URL(info.srcUrl).pathname.split('/').pop() || '') || name); } catch {}
  try {
    const result = await downloadFirstWorking([info.srcUrl], name, pageUrl);
    if (!result.success) flashBadge(tab.id, '!');
  } catch {
    flashBadge(tab.id, '!');
  }
}

/** No page to show a message on: say "failed" on the toolbar button for a moment (the next tab switch or load puts the real count back). */
async function flashBadge(tabId, text) {
  try {
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' });
    setTimeout(() => updateBadgeForTab(tabId), 3000);
  } catch {}
}

/** Context menu "toggle all": flips every unlocker for the tab's site (or for all sites in Global mode) and tells the page. */
async function toggleAllForTab(tab) {
  if (!tab?.id || !tab.url || !isWebUrl(tab.url)) return;
  const hostname = new URL(tab.url).hostname;
  const key = siteKey(hostname);
  if (!key) return;

  const global = await chrome.storage.local.get([GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY]);
  const isGlobal = global[GLOBAL_MODE_KEY] === true;
  const area = isGlobal ? chrome.storage.local : siteArea(tab.incognito);
  const targetKey = isGlobal ? GLOBAL_SETTINGS_KEY : key;

  // Start from what the page is really running: the global settings in Global mode, the site's OWN entry in "This site" mode (the
  // same rule as the popup and the content script). Older flat entries are read through normalizeSettings like everywhere else.
  const stored = isGlobal ? global : await area.get(key);
  const current = resolveSettings(stored, hostname, isGlobal);

  // Same rule as the popup's Lock All / Unlock All: only when EVERY unlocker is on does the next press switch them off.
  const allActive = UNLOCK_KEYS.every((k) => current.features[k].enabled);
  for (const k of UNLOCK_KEYS) current.features[k].enabled = !allActive;

  // a site entry with nothing on is the same as no entry (the popup does the same): it is not kept
  if (!isGlobal && countEnabled(current) === 0) await area.remove(targetKey);
  else await area.set({ [targetKey]: current });

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'applySettings', config: current });
  } catch {
    // no content script in that tab (opened before an update, or a page that does not allow extensions): the setting is saved all the same
  }
  updateBadgeForTab(tab.id);
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateBadgeForTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateBadgeForTab(tabId);
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.superUnlockerLang) {
    setupContextMenus(changes.superUnlockerLang.newValue);
  }

  if (areaName === 'local' && (changes[GLOBAL_MODE_KEY] || changes[GLOBAL_SETTINGS_KEY])) {
    refreshAllBadges();
    return;
  }

  // A site's entry changed: only the tabs on exactly that host are affected (no sibling or parent domain inherits it).
  const hosts = Object.keys(changes).filter((key) => key.startsWith('settings_') && key.length > 'settings_'.length && key !== GLOBAL_SETTINGS_KEY)
    .map((key) => key.slice('settings_'.length));
  if (!hosts.length || (areaName !== 'local' && areaName !== 'session')) return;
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!Number.isInteger(tab.id) || !isWebUrl(tab.url)) continue;
      let host = '';
      try { host = new URL(tab.url).hostname.toLowerCase(); } catch {}
      if (hosts.includes(host)) updateBadgeForTab(tab.id);
    }
  } catch {}
});

// Only these data: images are saved (never data:text/html or anything else that could run); SVG is the one vector type and is saved with a dialog.
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif|avif|bmp|svg\+xml)[;,]/i;
const isSvgSource = (url) => /^data:image\/svg/i.test(url) || /\.svg(?:$|[?#])/i.test(url);

function isValidDownloadURL(value, pageUrl = '') {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === 'data:') return SAFE_DATA_IMAGE.test(value);
    if (url.protocol === 'blob:') {
      // A blob: URL is data the PAGE made and holds (a generated image, an uploaded one); the URL names the origin that owns it. It is
      // saved only for a page of that very origin, so a page cannot point the extension at another site's blob.
      return !!pageUrl && url.origin !== 'null' && url.origin === new URL(pageUrl).origin;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    // chrome.downloads is the browser itself, with the user's cookies, without mixed-content or private-network protections: a public page
    // may not use it to reach the user's own network.
    return mayFetchOnBehalfOf(value, pageUrl);
  } catch {
    return false;
  }
}

// Names Windows will not create as a file, with or without an extension.
const RESERVED_FILE_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function sanitizeFilename(value) {
  const fallback = 'image.jpg';
  if (typeof value !== 'string') return fallback;

  let name = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '-')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name) return fallback;
  if (name.startsWith('.')) name = `image${name}`;
  // Whatever the content script sends, the saved file always ends in an image extension (IMAGE_EXTENSIONS, below):
  // "evil.exe" becomes "evil.exe.jpg", so a download can never be named like something that runs.
  const found = (name.match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  const ext = found && IMAGE_EXTENSIONS.includes(found.toLowerCase()) ? found : '';
  // cut by code points (a character made of two UTF-16 units must not be split), and leave no trailing dot or space behind
  let base = Array.from(ext ? name.slice(0, -(ext.length + 1)) : name).slice(0, 100).join('').replace(/[. ]+$/, '');
  if (!base) base = 'image';
  if (RESERVED_FILE_NAMES.test(base.split('.')[0].trim())) base = `image_${base}`; // "nul.tar.gz" is "nul" to Windows too
  return `${base}.${ext || 'jpg'}`;
}

// The frame a message comes from. A frame's own URL is what counts: falling back to the tab's URL for a sub-frame would hand an
// isolated or sandboxed frame the standing of the page around it.
function pageUrlOf(sender) {
  if (sender?.url) return sender.url;
  return sender?.frameId === 0 && sender.tab?.url ? sender.tab.url : '';
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only this extension's own scripts talk to the service worker.
  if (!sender || sender.id !== chrome.runtime.id) return undefined;

  // Frames the content script cannot read the top window of (cross-origin iframes) ask which site
  // they are embedded in, so they can use that site's settings.
  if (message?.action === 'getTopHostname') {
    const fromTabAddress = () => { try { return sender?.tab?.url ? new URL(sender.tab.url).hostname : ''; } catch { return ''; } };
    if (!sender?.tab) { sendResponse({ hostname: '' }); return false; }
    chrome.tabs.sendMessage(sender.tab.id, { action: 'getHostname' }, { frameId: 0 })
      .then((reply) => sendResponse({ hostname: (reply && reply.hostname) || fromTabAddress() }), () => sendResponse({ hostname: fromTabAddress() }));
    return true;
  }

  // The content script reports whether a picture is under the pointer; the "Download image" entry for pictures that are not an <img>
  // is only offered while one is.
  if (message?.action === 'imageUnderPointer') {
    if (!sender.tab) return false;
    if (message.has === true && sender.tab.active === false) return false; // a page in the background has no pointer
    const next = nextImageUnderState(imageUnderOwner, { tabId: sender.tab.id, frameId: sender.frameId || 0 }, message.has === true);
    imageUnderOwner = next.owner;
    if (message.has === true || !next.visible) setMenuEntryVisible(next.visible); // a "no" from a frame that is not the owner sends nothing
    return false;
  }

  if (message?.action === 'captureScreenshot') return handleCaptureScreenshot(message, sender, sendResponse);
  if (message?.action === 'cancelScreenshot') return handleCancelScreenshot(message, sender, sendResponse);

  if (message?.action !== 'downloadImage') return undefined;

  // Ensure request originates from an internal extension context / tab
  if (!sender.tab) {
    sendResponse({ success: false, error: 'unauthorized download source' });
    return false;
  }

  // `urls` is a ranked candidate list; the single `url` form is kept for older callers.
  const requested = Array.isArray(message.urls) ? message.urls : [message.url];
  const pageUrl = pageUrlOf(sender);
  const urls = [...new Set(requested.filter(u => isValidDownloadURL(u, pageUrl)))].slice(0, MAX_DOWNLOAD_CANDIDATES);
  if (!urls.length) {
    sendResponse({ success: false, error: 'invalid address' });
    return false;
  }

  downloadFirstWorking(urls, sanitizeFilename(message.filename), pageUrl, { tabId: sender.tab.id, frameId: sender.frameId || 0 })
    .then(sendResponse, (err) => sendResponse({ success: false, error: err?.message || 'download could not be started' }));

  return true;
});

// ─── Downloading a ranked list of candidates ───
const MAX_DOWNLOAD_CANDIDATES = 6;
const DOWNLOAD_WAIT_MS = 25000;
let FETCH_TIMEOUT_MS = 20000; // (let: the tests shorten it)
// the extension's own requests (the fallback fetch and its redirect hops) have no tab and this extension as their initiator
const OWN_REQUEST_TYPES = ['xmlhttprequest', 'other'];
const REFERER_RULE_IDS = [9000, 9099];
const refererRulesInUse = new Set();

/** The page's origin, as a Referer value (enough for hotlink checks, leaks no path or query). */
function refererFor(pageUrl) {
  try {
    const u = new URL(pageUrl);
    return u.protocol === 'http:' || u.protocol === 'https:' ? `${u.origin}/` : '';
  } catch {
    return '';
  }
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * chrome.downloads sends no Referer and does not accept one as a header, so image hosts that only serve
 * their own pages answer 403 ("you don't have permission"). A session rule that sets Referer for exactly
 * this URL, removed again when the fetch is over, fixes that. It applies to this extension's own tab-less requests only: a request the
 * user makes in a tab to the same address, at the same moment, keeps its own Referer.
 */
async function withReferer(url, referer, run) {
  const regexFilter = `^${escapeRegex(url)}$`;
  if (!referer || !/^https?:/i.test(url) || regexFilter.length > 1800 || !chrome.declarativeNetRequest?.updateSessionRules) return run();
  await orphanCleanup;
  let id = REFERER_RULE_IDS[0];
  while (refererRulesInUse.has(id) && id <= REFERER_RULE_IDS[1]) id++;
  if (id > REFERER_RULE_IDS[1]) return run(); // a hundred at once: not worth a rule
  refererRulesInUse.add(id);
  try {
    try {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [id],
        addRules: [{
          id, priority: 1,
          action: { type: 'modifyHeaders', requestHeaders: [{ header: 'referer', operation: 'set', value: referer }] },
          condition: { regexFilter, tabIds: [-1], initiatorDomains: [chrome.runtime.id], resourceTypes: OWN_REQUEST_TYPES }
        }]
      });
    } catch {
      return await run(); // rule refused: still worth a plain attempt
    }
    return await run();
  } finally {
    refererRulesInUse.delete(id);
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id] }).catch(() => {});
  }
}

// What the server may say it is serving for the file to be kept: a picture, or "binary" (object storage serves pictures that way). Anything else it
// calls the file (a page, a program, a video, a script) is no picture, whatever the address looked like.
const KEPT_TYPES = /^(?:image\/|(?:application|binary)\/octet-stream$)/i;

/**
 * Why a download that has started has to be stopped, or '' if it may go on. `dialogAsked`: the person is being asked where to save it.
 * A vector picture can carry script, so one that nothing in the address gave away (only the server's Content-Type did) is not kept unless the
 * person chose where it goes: it is started again with the dialog.
 */
function problemWithDownload(item, pageUrl, dialogAsked = false) {
  // a redirect can lead anywhere: where the file really comes from is checked once the browser says so
  if (item.finalUrl && /^https?:/i.test(item.finalUrl) && !mayFetchOnBehalfOf(item.finalUrl, pageUrl)) return 'PRIVATE_NETWORK_REFUSED';
  const mime = String(item.mime || '').split(';')[0].trim().toLowerCase();
  if (mime && !KEPT_TYPES.test(mime)) return 'NOT_AN_IMAGE'; // an error page or a JSON answer with an image name is no picture
  if (mime === 'image/svg+xml' && !dialogAsked) return 'SVG_NEEDS_DIALOG';
  return '';
}

/** Resolves once a download reached a final state: {ok, error?, pending?}. A big file still running after the wait is not a failure. */
function waitForDownload(downloadId, pageUrl) {
  return new Promise((resolve) => {
    let timer = 0;
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      dialogDownloads.delete(downloadId);
      chrome.downloads.onChanged.removeListener(onChanged);
      clearTimeout(timer);
      resolve(result);
    };
    const refuse = (error) => {
      chrome.downloads.cancel(downloadId).catch(() => {});
      chrome.downloads.removeFile(downloadId).catch(() => {}); // when it had already completed
      finish({ ok: false, error });
    };
    const settle = (item) => {
      if (!item) return;
      const problem = problemWithDownload(item, pageUrl, dialogDownloads.has(downloadId));
      if (problem) refuse(problem);
      else if (item.state === 'complete') finish({ ok: true });
      else if (item.state === 'interrupted') finish({ ok: false, error: item.error || 'INTERRUPTED' });
    };
    const onChanged = (delta) => {
      if (delta.id !== downloadId) return;
      chrome.downloads.search({ id: downloadId }).then(([item]) => settle(item), () => {});
    };
    chrome.downloads.onChanged.addListener(onChanged);
    timer = setTimeout(() => finish({ ok: true, pending: true }), DOWNLOAD_WAIT_MS);
    chrome.downloads.search({ id: downloadId }).then(([item]) => settle(item), () => {}); // it may be over already
  });
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'];
const IMAGE_EXTENSION_OF_MIME = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/avif': 'avif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg'
};
const FORMAT_HINT_PARAMS = ['format', 'fm', 'ext', 'type', 'f'];

/** The image extension a URL names: in its path, or in the query of a CDN that serves what it is asked for (?format=png, ?fm=webp, ?url=/a.webp). */
function extensionOfUrl(url) {
  if (url.startsWith('data:')) return ((url.match(/^data:image\/([a-z0-9]+)/i) || [])[1] || '').toLowerCase().replace('jpeg', 'jpg');
  try {
    const parsed = new URL(url);
    const fromPath = ((parsed.pathname.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
    if (IMAGE_EXTENSIONS.includes(fromPath)) return fromPath;
    for (const name of FORMAT_HINT_PARAMS) {
      const hint = (parsed.searchParams.get(name) || '').toLowerCase().replace('jpeg', 'jpg');
      if (IMAGE_EXTENSIONS.includes(hint)) return hint;
    }
    const inner = parsed.searchParams.get('url'); // an image optimiser: /_next/image?url=%2Fhero.webp
    if (inner) {
      const fromInner = ((inner.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
      if (IMAGE_EXTENSIONS.includes(fromInner)) return fromInner;
    }
    return fromPath;
  } catch {
    return '';
  }
}

const extensionOfName = (name) => ((name.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
const withExtension = (name, ext) => `${name.replace(/\.[a-z0-9]{2,5}$/i, '')}.${ext}`;

/** A fallback candidate can be a different format than the first one; keep the file name honest. */
function filenameFor(filename, url, mime = '') {
  let ext = extensionOfUrl(url);
  if (!IMAGE_EXTENSIONS.includes(ext) && Object.hasOwn(IMAGE_EXTENSION_OF_MIME, mime.toLowerCase())) {
    ext = IMAGE_EXTENSION_OF_MIME[mime.toLowerCase()]; // URL says nothing: trust the server's Content-Type
  }
  if (!IMAGE_EXTENSIONS.includes(ext)) return filename;
  const current = extensionOfName(filename);
  if (current === ext || (current === 'jpeg' && ext === 'jpg')) return filename;
  return withExtension(filename, ext);
}

// The server's Content-Type is only known once the download has started. Downloads this extension started are named here with it (and only
// those: for everything else the browser's own name stands). This also keeps the name that was asked for: with a download manager installed the
// browser drops the name given to download() and uses the one from the address (measured: image.png for photo.png).
//
// The listener exists only while such a download waits for its name. The browser asks every listening extension about EVERY download, and a listener
// that says nothing still counts as an opinion (measured in Chromium 151). One that is always there therefore voids the file name any other
// extension asked for with download({ filename }), and makes the browser put "failed to name the download" on the card of every listening extension
// installed before it (download managers such as IDM) for every download the person makes. NAME1-4 pin this against a real second extension.
const NAMING_WAIT_MS = 60000; // the name is asked for within moments, once the server has answered; this is only the upper bound
const ANSWER_SETTLE_MS = 300; // a listener removed before the browser has taken its answer makes the browser drop that answer (measured): leave it a moment
const waitingForName = new Set(); // { key, filename, timer }: a download this extension started that has not been named yet (oldest first)
const downloadKey = (url) => (url.length > 300 ? `${url.slice(0, 200)}#${url.length}` : url); // a data: URL can be megabytes: do not keep it as a key

function listenForNames() {
  const event = chrome.downloads.onDeterminingFilename;
  const wanted = waitingForName.size > 0;
  if (wanted === event.hasListener(onDeterminingFilename)) return;
  if (wanted) event.addListener(onDeterminingFilename);
  else event.removeListener(onDeterminingFilename);
}
function expectName(url, filename) {
  const entry = { key: downloadKey(url), filename, timer: 0 };
  entry.timer = setTimeout(() => letGoOfName(entry), NAMING_WAIT_MS);
  waitingForName.add(entry);
  listenForNames();
  return entry;
}
function letGoOfName(entry, { answered = false } = {}) {
  if (!entry || !waitingForName.delete(entry)) return;
  clearTimeout(entry.timer);
  if (answered) setTimeout(listenForNames, ANSWER_SETTLE_MS);
  else listenForNames();
}

function onDeterminingFilename(item, suggest) {
  if (item.byExtensionId !== chrome.runtime.id) return; // a download the person (or another extension) started for the same address keeps the browser's name
  const key = downloadKey(item.url);
  const entry = [...waitingForName].find((waiting) => waiting.key === key);
  if (!entry) return;
  const asked = entry.filename;
  const mime = String(item.mime || '').toLowerCase();
  let filename = asked;
  if (Object.hasOwn(IMAGE_EXTENSION_OF_MIME, mime)) {
    const ext = IMAGE_EXTENSION_OF_MIME[mime];
    const current = extensionOfName(asked);
    if (current !== ext && !(current === 'jpeg' && ext === 'jpg')) filename = withExtension(asked, ext);
  }
  suggest({ filename, conflictAction: 'uniquify' });
  letGoOfName(entry, { answered: true }); // after the answer, never before it
}

const dialogDownloads = new Set(); // ids of downloads started with the "where to save" dialog (see problemWithDownload)
const wantsDialog = (url, filename) => isSvgSource(url) || isSvgSource(filename); // a vector picture can carry script: the person chooses where it goes

async function startDownload(url, filename, { dialog = false } = {}) {
  const entry = expectName(url, filename); // before the request: the browser asks once the server has answered
  try {
    const saveAs = dialog || wantsDialog(url, filename);
    const id = await chrome.downloads.download({ url, filename, saveAs, conflictAction: 'uniquify' });
    if (saveAs) dialogDownloads.add(id);
    return id;
  } catch (err) {
    letGoOfName(entry); // it never started: nobody will ask for its name
    throw err;
  }
}

// A 403/401 from chrome.downloads usually means "no Referer". The extension's own fetch can send one (host
// permission lifts CORS, the session rule above sets Referer), so the image is fetched here and saved from
// here. Declarative rules do NOT apply to chrome.downloads requests (verified), which is why the download
// itself cannot be fixed with a rule.
//
// This makes the service worker a deputy acting for the page, so it is deliberately narrow:
//  - the URL comes from the page, so a PUBLIC page may not make it reach into the PRIVATE network
//    (localhost, LAN, link-local): that would read intranet images the page could never read itself;
//  - no cookies (credentials: 'omit'): the user's logins are not lent to a page-chosen URL;
//  - the bytes never go back to the page as such: a small image is saved from a data: URL, a larger one is built into a blob: by the content
//    script of the frame that asked (the page cannot name that blob: its URL is random and only travels between the two scripts);
//  - only image/* responses, read as a stream that stops at MAX_PROTECTED_BYTES, and for a limited time;
//  - redirects cannot lead into the private network either (withPrivateNetworkGuard below).
//
// KNOWN LIMITS: hosts are judged by name. A public-looking NAME that resolves to a private address is not detected
// (an extension cannot resolve DNS). And chrome.downloads, the first attempt, follows redirects by itself: a public address that redirects
// into the private network is noticed when the browser reports where the file came from (the file is then removed), but the request
// has been made by then. What that allows is a blind GET, after the user's own Alt+Click (or "Download image") on a picture the page chose, whose answer never
// reaches the page. It is not quite what an <img> can do: this request is the browser's own download, so it carries the cookies the browser sends for that address
// (the privacy policy says so), which a picture loaded from another site may not. It cannot be closed from here: declarative rules do not apply to chrome.downloads,
// and a request made first to see where a redirect leads would not carry those cookies (and would use up a one-time address).
const REFERER_FIXABLE_ERRORS = new Set(['SERVER_FORBIDDEN', 'SERVER_UNAUTHORIZED', 'NOT_AN_IMAGE']);
let MAX_DATA_URL_CHARS = 1900000; // Chrome refuses URLs beyond ~2 MB (let: the tests lower it)
const MAX_INLINE_BYTES = 1400000;   // what still fits a data: URL
const MAX_PROTECTED_BYTES = 32 * 1024 * 1024;
const CHUNK_BYTES = 768 * 1024;

/** A public page may not point the extension at the private network; a page that is itself on a private host may. */
function mayFetchOnBehalfOf(targetUrl, pageUrl) {
  try {
    const target = new URL(targetUrl);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
    if (!isPrivateHost(target.hostname)) return true;
    // A page without a real host name (about:blank, srcdoc, data:, file:) is not "a page on the private network": isPrivateHost('') is true
    // for a TARGET (fail closed), which must not turn into permission for a page.
    const page = new URL(pageUrl);
    return (page.protocol === 'http:' || page.protocol === 'https:') && page.hostname.length > 0 && isPrivateHost(page.hostname);
  } catch {
    return false;
  }
}

// fetch() follows redirects by itself, and a redirect target can only be inspected AFTER the request went out
// (redirect:'manual' yields an opaque response without the Location). Checking res.url afterwards therefore proved
// nothing: the private-network request had been sent, only its answer was thrown away. For a public page a temporary
// session rule instead blocks, for this extension's own tab-less requests, every request to a private-looking host,
// redirect hops included. If the rule cannot be installed the fetch is refused (fail closed).
// Chromium compiles regexFilter with RE2 and refuses anything over 2KB, so the pattern is several small rules (one
// per group below), installed together. The URL it sees is Chromium's canonical form, so numeric hosts such as
// 0x7f.1 or 2130706433 already arrive as dotted decimal, and a name keeps a trailing dot (localhost. is localhost): `\.*` allows for it.
// SEC7c checks every rule against Chromium and a host table.
// One fixed set of rules (ids 10000-10003) shared by every fetch that is running: the first one in installs it, the last one out removes it. (A
// private-page fetch is not guarded; a public-page fetch that overlaps it is guarded for both, which only ever errs on the safe side.)
const PRIVATE_HOST_URL_REGEXES = [
  ['localhost', '[^/?#:@]*\\.(?:localhost|local|internal|lan|home\\.arpa)', '[^/?#:@.]+', // names; the third = single-label intranet names
    '\\[[^\\]]*\\]'], // every IPv6 literal: no image CDN is addressed that way, and the IPv4-embedding forms are many
  ['(?:0|10|127)\\.[0-9.]+', '169\\.254\\.[0-9.]+', '192\\.168\\.[0-9.]+', '192\\.0\\.0\\.[0-9.]+'],
  ['172\\.(?:1[6-9]|2[0-9]|3[01])\\.[0-9.]+', '198\\.1[89]\\.[0-9.]+'],
  ['100\\.(?:6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\\.[0-9.]+', '2(?:2[4-9]|[3-5][0-9])\\.[0-9.]+']
].map((alternatives) => `^https?://(?:[^/?#@]*@)?(?:${alternatives.join('|')})\\.*(?::[0-9]+)?(?:[/?#]|$)`);
const GUARD_RULE_IDS = PRIVATE_HOST_URL_REGEXES.map((_, i) => 10000 + i);
let guardUsers = 0;
let guardInstalled = null;

async function withPrivateNetworkGuard(run) {
  const api = chrome.declarativeNetRequest;
  if (!api?.updateSessionRules) throw new Error('private-network guard unavailable');
  guardUsers++;
  try {
    await orphanCleanup;
    if (!guardInstalled) {
      guardInstalled = api.updateSessionRules({ // a refusal propagates: no guard, no fetch
        removeRuleIds: GUARD_RULE_IDS,
        addRules: PRIVATE_HOST_URL_REGEXES.map((regexFilter, i) => ({
          id: GUARD_RULE_IDS[i], priority: 2, action: { type: 'block' },
          condition: { regexFilter, isUrlFilterCaseSensitive: false, tabIds: [-1], initiatorDomains: [chrome.runtime.id], resourceTypes: OWN_REQUEST_TYPES }
        }))
      });
    }
    await guardInstalled;
    return await run();
  } finally {
    if (--guardUsers === 0) {
      guardInstalled = null;
      api.updateSessionRules({ removeRuleIds: GUARD_RULE_IDS }).catch(() => {});
    }
  }
}

function fetchImageBytes(url, referer) {
  return withReferer(url, referer, async () => {
    const res = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) throw new Error(`not an image (${mime || 'no content-type'})`);
    const tooLarge = () => new Error('image too large for a protected download');
    if ((Number(res.headers.get('content-length')) || 0) > MAX_PROTECTED_BYTES) throw tooLarge();

    // read as a stream and stop at the limit: a server that sends no Content-Length (or lies about it) must not fill the worker's memory
    const reader = res.body.getReader();
    const parts = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROTECTED_BYTES) { reader.cancel().catch(() => {}); throw tooLarge(); }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return { mime, bytes, finalUrl: res.url };
  });
}

/** A page that is itself on a private host may use private images; for every other page the private network is off limits, redirect hops included. */
function fetchImageBytesFor(url, referer, pageUrl) {
  let pageIsPrivate = false; // unknown page: treat it as public
  try {
    const page = new URL(pageUrl);
    pageIsPrivate = (page.protocol === 'http:' || page.protocol === 'https:') && page.hostname.length > 0 && isPrivateHost(page.hostname);
  } catch {}
  return pageIsPrivate ? fetchImageBytes(url, referer) : withPrivateNetworkGuard(() => fetchImageBytes(url, referer));
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Saves bytes the service worker holds. Up to MAX_INLINE_BYTES they travel as a data: URL; more than a URL can hold goes to the content script of
 * the frame that asked, which builds a blob: from it (a service worker cannot make object URLs) and hands back that blob's URL.
 */
async function saveFetchedBytes(bytes, name, origin, pageUrl) {
  if (bytes.bytes.length <= MAX_INLINE_BYTES) {
    const dataUrl = `data:${bytes.mime};base64,${toBase64(bytes.bytes)}`;
    if (dataUrl.length <= MAX_DATA_URL_CHARS) {
      const id = await startDownload(dataUrl, name);
      return { id, outcome: await waitForDownload(id, pageUrl) };
    }
  }
  if (!origin || !Number.isInteger(origin.tabId)) throw new Error('image too large for a protected download');

  const where = { frameId: origin.frameId || 0 };
  const transfer = crypto.randomUUID();
  const total = Math.ceil(bytes.bytes.length / CHUNK_BYTES);
  let blobUrl = '';
  for (let index = 0; index < total; index++) {
    const reply = await chrome.tabs.sendMessage(origin.tabId, {
      action: 'blobChunk', transfer, index, total, mime: bytes.mime,
      data: toBase64(bytes.bytes.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES))
    }, where);
    if (!reply || reply.ok !== true) throw new Error('the page could not take the image');
    if (reply.url) blobUrl = reply.url;
  }
  if (!blobUrl) throw new Error('the page could not take the image');
  try {
    const id = await startDownload(blobUrl, name);
    return { id, outcome: await waitForDownload(id, pageUrl) };
  } finally {
    chrome.tabs.sendMessage(origin.tabId, { action: 'blobRelease', url: blobUrl }, where).catch(() => {});
  }
}

async function downloadFirstWorking(urls, filename, pageUrl, origin = null) {
  const referer = refererFor(pageUrl);
  let lastError = 'download could not be started';
  const failedIds = [];
  const eraseStepping = () => { for (const id of failedIds) chrome.downloads.erase({ id }).catch(() => {}); };
  for (const url of urls) {
    try {
      // The door check (isValidDownloadURL) is made again where the request is made: nothing reaches chrome.downloads without it.
      if (/^https?:/i.test(url) && !mayFetchOnBehalfOf(url, pageUrl)) {
        lastError = 'PRIVATE_NETWORK_REFUSED';
        continue;
      }
      let id = await startDownload(url, filenameFor(filename, url));
      let outcome = await waitForDownload(id, pageUrl);
      if (!outcome.ok && outcome.error === 'SVG_NEEDS_DIALOG') {
        // the address gave nothing away, the server did: ask the person where this vector picture goes (once)
        failedIds.push(id);
        id = await startDownload(url, filenameFor(filename, url, 'image/svg+xml'), { dialog: true });
        outcome = await waitForDownload(id, pageUrl);
      }
      if (outcome.ok) {
        eraseStepping(); // no "Failed" rows for candidates that only served as stepping stones
        return { success: true, downloadId: id, urlUsed: url, pending: outcome.pending === true };
      }
      failedIds.push(id);
      lastError = outcome.error;

      if (referer && REFERER_FIXABLE_ERRORS.has(outcome.error) && mayFetchOnBehalfOf(url, pageUrl)) {
        try {
          const bytes = await fetchImageBytesFor(url, referer, pageUrl);
          // the guard rule already stopped such a hop before it was requested; this is only a second line of defence
          if (!mayFetchOnBehalfOf(bytes.finalUrl || url, pageUrl)) throw new Error('redirected into the private network');
          const saved = await saveFetchedBytes(bytes, filenameFor(filename, url, bytes.mime), origin, pageUrl);
          if (saved.outcome.ok) {
            eraseStepping();
            return { success: true, downloadId: saved.id, urlUsed: url, pending: saved.outcome.pending === true };
          }
          failedIds.push(saved.id);
          lastError = saved.outcome.error;
        } catch (err) {
          lastError = err?.message || lastError;
        }
      }
    } catch (err) {
      lastError = err?.message || lastError;
    }
  }
  return { success: false, error: lastError };
}

// ─── Page Screenshot Capture (Visible & Full-Page OffscreenCanvas Stitching) ───
// The service worker takes the pictures (chrome.tabs.captureVisibleTab), puts the slices together in an OffscreenCanvas and saves the result with
// startDownload / saveFetchedBytes. The content script of the tab only scrolls the page and hides what would repeat (ScreenshotCoordinator).
// A finished picture bigger than a data: URL can carry travels to the content script of the tab in pieces, to get a temporary file reference there,
// exactly as a large picture does (BlobTransfer): 64 pieces at most, which is what MAX_SCREENSHOT_BYTES keeps within.
const activeScreenshotTabs = new Set();
const cancelRequested = new Set(); // tabs whose capture the person has stopped
let SCREENSHOT_KEEPALIVE_MS = 20000; // (let: the tests shorten it) how often an extension call resets the worker's idle timer while a capture runs
let CAPTURE_TIME_BUDGET_MS = 150000; // (let: the tests lower it) a capture that has taken this long ends with what it has, called cut
const CAPTURE_MIN_INTERVAL_MS = 520; // Chrome enforces MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND = 2
const SLICE_OVERLAP_CSS = 8; // how far neighbouring pictures overlap (CSS px): the same number as SLICE_OVERLAP in content.js, which plans the steps
let CARD_LEAD_MS = 160; // (let: the tests change it) how long before a picture the card on the page goes away: the browser needs a moment to show the page without it
let PART_MAX_PHYSICAL_PX = 32760; // (let: the tests lower it) the tallest canvas the worker makes (Chrome allows 32,767 per side): a page taller than this is saved as several pictures, one under the other
const MAX_CAPTURE_SLICES = 200; // pictures of one page at most (the content script plans with the same number)
let MAX_SCREENSHOT_BYTES = 44 * 1024 * 1024; // (let: the tests lower it) the most 64 pieces of CHUNK_BYTES can carry, with room to spare; a bigger picture is saved as a JPEG
let lastCaptureVisibleAt = 0;

/**
 * Generates a privacy-safe file name containing only the sanitized hostname and timestamp.
 * Never includes URL path segments, query parameters, tokens, or hash fragments.
 */
function screenshotFilename(pageUrl, now = new Date(), ext = 'png', part = 0) {
  let host = 'page';
  try {
    const parsed = new URL(pageUrl);
    const cleaned = (parsed.hostname || '')
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 50);
    if (cleaned) host = cleaned;
  } catch {}
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return sanitizeFilename(`selectra-${host}-${stamp}${part > 0 ? `-part${part}` : ''}.${ext}`);
}

/**
 * Whether the tab is still on the page the capture began on. The #fragment does not count: a page whose table of contents follows the reader writes
 * the section it has scrolled to into the address, and that must not end a capture that scrolls it. Another path, query or site does.
 */
function isSamePage(then, now) {
  if (typeof then !== 'string' || typeof now !== 'string') return false;
  return then.split('#')[0] === now.split('#')[0];
}

async function captureVisibleWithRetry(windowId, { before = null, after = null } = {}) {
  const wait = Math.max(0, CAPTURE_MIN_INTERVAL_MS - (Date.now() - lastCaptureVisibleAt));
  if (before) {
    // The card on the page goes away well before the picture, not at the instant of it: a page that is heavy to draw takes more than the frame or two the
    // card is told to wait for before the browser really shows the page without it.
    if (wait > CARD_LEAD_MS) await new Promise((r) => setTimeout(r, wait - CARD_LEAD_MS));
    await before();
    await new Promise((r) => setTimeout(r, CARD_LEAD_MS));
  } else if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  try {
    return await captureVisibleOnce(windowId);
  } finally {
    if (after) after();
  }
}

async function captureVisibleOnce(windowId) {
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      lastCaptureVisibleAt = Date.now();
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png')) return dataUrl;
      throw new Error('EMPTY_CAPTURE');
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err || '');
      if (/MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND|quota|rate/i.test(msg) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 380 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  throw lastErr || new Error('CAPTURE_FAILED');
}

async function decodeDataUrlToBitmap(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

/**
 * A canvas of the wanted size, or, when the browser refuses to make one that big (or makes it without a way to draw on it), the biggest it gives: a quarter
 * less each time, never less than `least` tall. `limited` says that it came out smaller than wanted, so that the picture can be called cut.
 */
function makeCanvas(width, height, least) {
  for (let h = height; ; h = Math.max(least, Math.floor(h * 0.75))) {
    try {
      const canvas = new OffscreenCanvas(width, h);
      const ctx = canvas.getContext('2d');
      if (ctx) return { canvas, ctx, limited: h < height };
    } catch {}
    if (h <= least) throw new Error('CANVAS_UNAVAILABLE');
  }
}

/**
 * The picture of a page as a stack of canvases ("parts"). One canvas can only be so tall (the browser's limit, and the memory it takes): a page taller than
 * that is saved as several pictures, one under the other, instead of being cut. A part is made when something is first drawn on it. One that nothing will
 * be drawn on any more can be taken out (takeFinished) and its memory given back while the page is still being photographed. Every y here is a row of the
 * whole page, in screen pixels; the parts turn it into their own. What is drawn on a part that has been taken out is dropped (it is already saved).
 */
class Sheet {
  constructor(width, plannedHeight, partMax) {
    this.width = width;
    this.partMax = Math.max(1, Math.floor(partMax));
    this.planned = Math.max(1, Math.round(plannedHeight));
    const count = Math.ceil(this.planned / this.partMax);
    this.nominal = count > 1 ? Math.ceil(this.planned / count) : this.partMax; // parts of about the same height; a page that fits one part may grow into it
    this.parts = [];
    this.limited = false; // the browser gave a shorter canvas than asked for at least once: there are more parts than planned
  }

  /** How tall the page is as far as it is known. */
  get height() { return this.planned; }

  /** The page turns out taller than planned (it grew while it was scrolled). */
  plan(height) { this.planned = Math.max(this.planned, Math.round(height)); }

  open(start, wantEnd) {
    const wanted = Math.min(this.nominal, Math.max(this.planned - start, wantEnd - start));
    const made = makeCanvas(this.width, wanted, Math.min(wanted, 1024));
    if (made.limited) this.limited = true;
    const part = { index: this.parts.length, start, height: made.canvas.height, canvas: made.canvas, ctx: made.ctx, taken: false, capped: made.limited }; // capped: the browser would not make it taller
    this.parts.push(part);
    return part;
  }

  grow(part, height) {
    let made;
    try { made = makeCanvas(this.width, height, part.height + 1); } catch { return; } // no taller canvas to be had: the next part takes over
    made.ctx.drawImage(part.canvas, 0, 0);
    part.canvas = made.canvas;
    part.ctx = made.ctx;
    part.height = made.canvas.height;
    if (made.limited) { this.limited = true; part.capped = true; }
  }

  /** Makes sure the rows up to `end` can be drawn on: the last part grows up to what a part may have, then parts are opened one after the other. */
  cover(end) {
    if (!Number.isFinite(end)) return;
    if (end > this.planned) this.planned = end;
    for (;;) {
      const last = this.parts[this.parts.length - 1];
      const have = last ? last.start + last.height : 0;
      if (have >= end) return;
      if (last && !last.capped && last.height < this.nominal) {
        const before = last.height;
        this.grow(last, Math.min(this.nominal, Math.max(this.planned - last.start, end - last.start)));
        if (last.height > before) continue;
      }
      this.open(have, end);
    }
  }

  /** Calls fn(part, from, to) for each part that the rows [y, y + rows) of the page lie in (from and to are rows of the page). */
  each(y, rows, fn) {
    if (!Number.isFinite(y) || !(rows > 0) || !Number.isFinite(rows)) return;
    this.cover(y + rows);
    for (const part of this.parts) {
      if (part.taken) continue;
      const from = Math.max(y, part.start);
      const to = Math.min(y + rows, part.start + part.height);
      if (to > from) fn(part, from, to);
    }
  }

  /** drawImage with the destination in rows of the page: a picture that crosses the border of two parts is split there. */
  draw(image, sx, sy, sw, sh, dx, dy) {
    this.each(dy, sh, (part, from, to) => {
      part.ctx.drawImage(image, sx, sy + (from - dy), sw, to - from, dx, from - part.start, sw, to - from);
    });
  }

  fillRect(color, x, y, w, h) {
    this.each(y, h, (part, from, to) => {
      part.ctx.fillStyle = color;
      part.ctx.fillRect(x, from - part.start, w, to - from);
    });
  }

  /** The pixels of a place that lies in one part (a sample of the first screen, for instance). */
  getImageData(x, y, w, h) {
    this.cover(y + h);
    const part = this.parts.find((candidate) => !candidate.taken && y >= candidate.start && y < candidate.start + candidate.height);
    return part ? part.ctx.getImageData(x, y - part.start, w, h) : { data: [255, 255, 255, 255] };
  }

  /** The parts that end before row `before`, which nothing will be drawn on any more; each is given once, the last part never. */
  takeFinished(before) {
    const out = [];
    for (let i = 0; i < this.parts.length - 1; i++) {
      const part = this.parts[i];
      if (!part.taken && part.start + part.height <= before) {
        part.taken = true;
        out.push(part);
      }
    }
    return out;
  }

  /** The page is over at `height`: the part it ends in is cut to size, what lies beyond is dropped. Returns the parts that were not taken out before. */
  finish(height) {
    const end = Math.max(1, Math.round(height));
    const rest = [];
    for (const part of this.parts) {
      if (part.taken) continue;
      if (part.start >= end) {
        part.canvas = part.ctx = null;
        continue;
      }
      if (part.start + part.height > end) {
        const made = makeCanvas(this.width, end - part.start, end - part.start);
        made.ctx.drawImage(part.canvas, 0, 0, this.width, end - part.start, 0, 0, this.width, end - part.start);
        part.canvas = made.canvas;
        part.ctx = made.ctx;
        part.height = end - part.start;
      }
      rest.push(part);
    }
    return rest;
  }
}

/** An opaque, scaled copy of a canvas: a JPEG has no transparency, and what was never drawn must come out white, not black. */
function flatCanvas(source, scale = 1) {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const flat = new OffscreenCanvas(width, height);
  const ctx = flat.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return flat;
}

/**
 * The picture as a PNG; when that is more than `fits` accepts, as a JPEG, and if need be a smaller one, so that a very big page is saved instead of
 * failing. `allowPng: false` starts with the JPEG.
 */
async function encodeScreenshot(canvas, fits, { allowPng = true } = {}) {
  if (allowPng) {
    const png = await canvas.convertToBlob({ type: 'image/png' });
    if (fits(png.size)) return { blob: png, format: 'png' };
  }
  for (const scale of [1, 0.75, 0.5, 0.35]) {
    const jpeg = await flatCanvas(canvas, scale).convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    if (fits(jpeg.size)) return { blob: jpeg, format: 'jpeg' };
  }
  throw new Error('TOO_LARGE');
}

/**
 * Saves the picture of the visible area. Up to a data: URL's size it goes as one; a bigger one in pieces through the content script of the tab; and
 * when the tab has none (it was opened before the extension was installed or reloaded) as a JPEG that fits a data: URL.
 */
async function saveVisibleDataUrl(dataUrl, pageUrl, tabId) {
  const download = async (url, name) => {
    const id = await startDownload(url, name);
    const outcome = await waitForDownload(id, pageUrl);
    if (!outcome.ok) throw new Error(outcome.error || 'DOWNLOAD_FAILED');
    return id;
  };
  if (dataUrl.length <= MAX_DATA_URL_CHARS) return { id: await download(dataUrl, screenshotFilename(pageUrl)), format: 'png' };

  const bytes = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer());
  let saved = null;
  try {
    saved = await saveFetchedBytes({ mime: 'image/png', bytes }, screenshotFilename(pageUrl), { tabId, frameId: 0 }, pageUrl);
  } catch {} // nobody in the tab to take the pieces
  if (saved) {
    if (!saved.outcome.ok) throw new Error(saved.outcome.error || 'DOWNLOAD_FAILED');
    return { id: saved.id, format: 'png' };
  }

  const bitmap = await decodeDataUrlToBitmap(dataUrl);
  try {
    const source = new OffscreenCanvas(bitmap.width, bitmap.height);
    source.getContext('2d').drawImage(bitmap, 0, 0);
    const { blob } = await encodeScreenshot(source, (size) => Math.ceil(size / 3) * 4 + 40 <= MAX_DATA_URL_CHARS, { allowPng: false });
    const jpegUrl = `data:image/jpeg;base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
    return { id: await download(jpegUrl, screenshotFilename(pageUrl, new Date(), 'jpg')), format: 'jpeg' };
  } finally { bitmap.close(); }
}

/**
 * The popup asks for a capture. Only the extension's own pages may: a content script lives inside a web page, so its messages carry a tab, and a
 * page must never be able to start a screenshot (or a download) by getting a message through to the service worker.
 */
function handleCaptureScreenshot(message, sender, sendResponse) {
  if (sender.tab) {
    sendResponse({ success: false, error: 'UNAUTHORIZED_SOURCE' });
    return false;
  }
  const mode = message.mode === 'visible' ? 'visible' : 'full';
  const resolveTab = async () => {
    if (Number.isInteger(message.tabId)) {
      try { return await chrome.tabs.get(message.tabId); } catch {}
    }
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    return active || null;
  };
  resolveTab()
    .then((tab) => capturePageScreenshot(tab, mode, { fromMenu: false }))
    .then(sendResponse, (err) => sendResponse({ success: false, error: err?.message || 'CAPTURE_FAILED' }));
  return true;
}

/**
 * The person presses Stop in the popup: the capture of that tab ends at the next picture and the page is put back. Only the extension's own pages may ask: a
 * page that could stop captures could also keep a person from ever getting one.
 */
function handleCancelScreenshot(message, sender, sendResponse) {
  if (sender.tab) {
    sendResponse({ success: false, error: 'UNAUTHORIZED_SOURCE' });
    return false;
  }
  const tabId = Number(message.tabId);
  if (Number.isInteger(tabId)) {
    cancelRequested.add(tabId);
    chrome.tabs.sendMessage(tabId, { action: 'screenshotCancel' }, { frameId: 0 }).catch(() => {}); // the page stops in the middle of what it is doing
  }
  sendResponse({ success: true });
  return false;
}

async function capturePageScreenshot(tab, mode = 'full', { fromMenu = false } = {}) {
  if (!tab || !Number.isInteger(tab.id) || !tab.url || !isWebUrl(tab.url)) {
    return { success: false, error: 'UNSUPPORTED_PAGE' };
  }
  if (isExcludedSensitiveUrl(tab.url)) {
    return { success: false, error: 'SENSITIVE_PAGE' };
  }
  if (activeScreenshotTabs.has(tab.id)) {
    return { success: false, error: 'ALREADY_CAPTURING' };
  }

  activeScreenshotTabs.add(tab.id);
  cancelRequested.delete(tab.id); // (a Stop that came when nothing was running does not stop the next capture)
  const startedAt = Date.now();
  const keepAlive = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch {} }, SCREENSHOT_KEEPALIVE_MS); // an extension call resets the worker's idle timer
  const initialUrl = tab.url;
  const tellPage = (toastKey, extra = {}) => chrome.tabs.sendMessage(tab.id, { action: 'screenshotCleanup', toastKey, ...extra }, { frameId: 0 }).catch(() => {});
  const card = (op, extra = {}) => chrome.tabs.sendMessage(tab.id, { action: 'screenshotHud', op, ...extra }, { frameId: 0 }).catch(() => null); // the card on the page
  try {
    if (mode === 'visible') {
      const dataUrl = await captureVisibleWithRetry(tab.windowId);
      const saved = await saveVisibleDataUrl(dataUrl, initialUrl, tab.id);
      if (fromMenu) tellPage(saved.format === 'jpeg' ? 'screenshotJpeg' : 'screenshotSaved');
      return { success: true, downloadId: saved.id, slices: 1, truncated: false, format: saved.format };
    }

    let plan = null;
    try {
      plan = await chrome.tabs.sendMessage(tab.id, { action: 'screenshotPrepare' }, { frameId: 0 });
    } catch {
      plan = null;
    }

    // Without a content script in the tab (opened before the extension was installed or reloaded) the page cannot be scrolled: the visible area is
    // saved, and the reply says so (the popup tells the person).
    if (!plan || plan.ok !== true) {
      const dataUrl = await captureVisibleWithRetry(tab.windowId);
      const saved = await saveVisibleDataUrl(dataUrl, initialUrl, tab.id);
      return { success: true, downloadId: saved.id, slices: 1, truncated: false, format: saved.format, fallbackVisible: true };
    }

    const slices = Array.isArray(plan.slices) && plan.slices.length ? plan.slices : [0];
    const paneTop = Number(plan.paneTop) || 0;       // an app whose pane scrolls by itself: where the pane starts in the window ...
    const paneLeft = plan.isPane ? Math.max(0, Number(plan.paneLeft) || 0) : 0;
    const paneHeight = Number(plan.paneHeight) || 0; // ... how tall it is ...
    const paneBottom = Number(plan.paneBottom) > 0 ? Number(plan.paneBottom) : paneTop + paneHeight; // ... where it ends exactly ...
    const paneWidth = plan.isPane ? Math.max(0, Number(plan.paneWidth) || 0) : 0;
    const bottomTail = plan.isPane ? Math.max(0, Number(plan.bottomTail) || 0) : 0; // ... and what lies under it (a bar), which is in the first picture only
    const fullWidthFooter = plan.fullWidthFooter !== false;
    // Where the card on the page begins (CSS px from the top of the window) when it stays there through the pictures in the middle: the band it covers is not used
    // from those pictures (the page was planned in steps that are shorter by it); null: the card is away for every picture, as it was before.
    const cardTop = Number.isFinite(Number(plan.cardTop)) && Number(plan.cardTop) > 0 ? Number(plan.cardTop) : null;
    let toastKey = '';
    let sheet = null; // the picture of the page, in parts (Sheet)
    let tail = null;
    let drawnBottom = 0; // how far down anything was drawn (the page may be shorter than it was planned to be)
    let scale = 1;
    let srcX = 0;
    let srcW = 0;
    let leftBg = typeof plan.leftGutterBg === 'string' ? plan.leftGutterBg : '';
    let rightBg = typeof plan.rightGutterBg === 'string' ? plan.rightGutterBg : '';
    let gutterFillTop = 0;
    let firstBottom = 0; // the row (screen pixels) where what the first picture is final for ends: the bottom of the window, or of the pane
    let tailY = 0;
    let pageCut = false; // the page went on below the last picture
    let pageGrowing = false; // it goes on growing as it is scrolled (an endless feed): what was open is saved
    let growthSeen = 0; // how tall the page turned out to be (CSS px) before the first picture was in, when there was no sheet yet to grow
    const encoded = []; // the finished parts as pictures, waiting to be saved: a Stop or a failure leaves nothing behind

    const fillGutters = (fromY, toY) => {
      if (toY <= fromY) return;
      if (srcX > 0 && leftBg) sheet.fillRect(leftBg, 0, fromY, srcX, toY - fromY);
      if (srcX + srcW < sheet.width && rightBg) sheet.fillRect(rightBg, srcX + srcW, fromY, sheet.width - (srcX + srcW), toY - fromY);
    };
    // A part that nothing will be drawn on any more becomes a PNG (a JPEG when that is too big) and gives its canvas back at once.
    const encodePart = async (part) => {
      const { blob, format } = await encodeScreenshot(part.canvas, (size) => size <= MAX_SCREENSHOT_BYTES);
      encoded.push({ index: part.index, blob, format });
      part.canvas = part.ctx = null;
    };

    const retaken = {}; // slice -> how many times its picture was taken again (the page was not where it was asked to be)
    try {
      for (let i = 0; i < slices.length; i++) {
        if (cancelRequested.has(tab.id)) return { success: false, cancelled: true, error: 'CANCELLED' };
        if (Date.now() - startedAt > CAPTURE_TIME_BUDGET_MS) { pageCut = true; break; } // too slow (a very long page, a slow one): what is there is saved
        const currentTab = await chrome.tabs.get(tab.id).catch(() => null);
        if (!currentTab || currentTab.active === false || !isSamePage(initialUrl, currentTab.url)) {
          throw new Error('TAB_CHANGED');
        }

        const stepReply = await chrome.tabs.sendMessage(
          tab.id,
          { action: 'screenshotStep', index: i, y: slices[i], isLast: i === slices.length - 1 },
          { frameId: 0 }
        );
        if (!stepReply || stepReply.ok !== true) {
          if (stepReply?.cancelled) {
            return { success: false, cancelled: true, error: 'CANCELLED' };
          }
          throw new Error(stepReply?.error || 'STEP_FAILED');
        }
        if (stepReply.cut === true) pageCut = true;
        if (stepReply.growing === true) pageGrowing = true;
        if (Number.isFinite(stepReply.nextSliceY) && stepReply.nextSliceY > slices[slices.length - 1] + 2 && slices.length < MAX_CAPTURE_SLICES) {
          slices.push(stepReply.nextSliceY);
          if (Number.isFinite(stepReply.newTotalHeight)) {
            if (sheet) sheet.plan(Math.round(stepReply.newTotalHeight * scale));
            else growthSeen = Math.max(growthSeen, stepReply.newTotalHeight);
          }
        }

        chrome.runtime.sendMessage({
          action: 'screenshotProgress',
          tabId: tab.id,
          current: i + 1,
          total: slices.length
        }).catch(() => {});
        card('progress', { current: i + 1, total: slices.length });

        // The first picture (a bar fixed to the window is only in it) and the last one (what lies under a pane, a bar that closes the page) are taken with the card away;
        // in between it stays on the page, and the rows it covers are taken from the next picture.
        const middle = cardTop !== null && i > 0 && i < slices.length - 1;
        const dataUrl = await captureVisibleWithRetry(currentTab.windowId, middle ? {} : { before: () => card('hold'), after: () => { card('release'); } });
        // Was the page where the picture was asked for? A page that scrolls by itself (a chat that follows its newest line) or a wheel turn that got in before
        // it was held off puts the picture somewhere else: it is taken again, three times at most.
        const where = await chrome.tabs.sendMessage(tab.id, { action: 'screenshotVerify' }, { frameId: 0 }).catch(() => null);
        // The window must still be the one the plan was made for: a resize, a zoom change or the developer tools opening makes this and the next pictures another size, and they cannot be put
        // together with the first (the page would come out shifted or squeezed): the capture ends, the page is put back and nothing is saved.
        if (where?.ok && Number.isFinite(where.w) && (Math.abs(where.w - Number(plan.viewportWidth)) > 0.5 || Math.abs(where.h - Number(plan.viewportHeight)) > 0.5 || Math.abs(where.dpr - Number(plan.dpr)) > 0.01)) throw new Error('WINDOW_CHANGED');
        if (where?.ok && Number.isFinite(stepReply.actualScrollTop) && Math.abs(where.top - stepReply.actualScrollTop) > 1.5 && (retaken[i] = (retaken[i] || 0) + 1) <= 3) { i--; continue; }
        const bmp = await decodeDataUrlToBitmap(dataUrl);
        let doneAbove = 0; // the parts that end above this row are done
        try {
          if (sheet && bmp.width !== sheet.width) throw new Error('WINDOW_CHANGED'); // (the same, seen in the picture itself)
          if (i === 0) {
            // The screen's own scale (zoom included) is exact. The ratio of the picture to the window's width in CSS px is only as exact as that whole
            // number: on a screen scaled to 125 % it is off by up to 0.1 %, which is a few pixels of drift over a long page. The ratio is the fallback.
            const ratio = bmp.width / Math.max(1, Number(plan.viewportWidth) || bmp.width);
            const dpr = Number(plan.dpr) || 0;
            scale = dpr > 0 && Math.abs(bmp.width - (Number(plan.viewportWidth) || 0) * dpr) <= 2 ? dpr : ratio;
            const pageRows = Math.round(Math.max(Number(plan.totalHeight) || bmp.height / scale, growthSeen) * scale);
            sheet = new Sheet(bmp.width, Math.max(bmp.height, pageRows), PART_MAX_PHYSICAL_PX);
            sheet.draw(bmp, 0, 0, bmp.width, bmp.height, 0, 0);
            drawnBottom = bmp.height;
            firstBottom = Math.min(bmp.height, Math.round((paneTop + paneHeight) * scale));
            srcX = plan.isPane ? Math.max(0, Math.min(bmp.width - 1, Math.round(paneLeft * scale))) : 0;
            srcW = plan.isPane ? Math.max(1, Math.min(bmp.width - srcX, Math.round((paneWidth || bmp.width / scale) * scale))) : bmp.width;
            tailY = Math.min(bmp.height - 1, Math.ceil(paneBottom * scale - 1e-6)); // (the first screen pixel that lies wholly under the pane)
            gutterFillTop = fullWidthFooter ? Math.min(bmp.height, tailY) : bmp.height;
            const sampleY = Math.min(bmp.height - 1, Math.max(0, Math.round((paneTop + (paneHeight || bmp.height / scale) * 0.5) * scale)));
            if (srcX > 0 && !leftBg) {
              const px = sheet.getImageData(Math.max(0, Math.min(srcX - 1, 4)), sampleY, 1, 1).data;
              leftBg = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
            }
            if (srcX + srcW < bmp.width && !rightBg) {
              const px = sheet.getImageData(Math.min(bmp.width - 1, srcX + srcW + 4), sampleY, 1, 1).data;
              rightBg = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
            }
          } else {
            // where the page REALLY is (the browser may not scroll as far as asked), not where it was asked to go
            const actual = Number.isFinite(stepReply.actualScrollTop) ? stepReply.actualScrollTop : slices[i];
            const srcY = Math.min(bmp.height - 1, Math.round(paneTop * scale));
            let srcH = Math.max(1, Math.min(bmp.height - srcY, Math.round((paneHeight || bmp.height / scale) * scale)));
            if (middle) srcH = Math.max(1, Math.min(srcH, Math.round((Math.min(paneTop + paneHeight, cardTop) - paneTop) * scale))); // (down to where the card begins)
            const destY = Math.round((paneTop + actual) * scale);
            // The rows the first picture has are final (a bar that is fixed to the window is in them and hidden from the later pictures: it must not be printed over by
            // the page behind it). A picture in the middle, which begins well above the end of the first one, therefore starts where that one ends, less the overlap.
            const skip = middle ? Math.max(0, Math.min(srcH - 1, firstBottom - Math.round(SLICE_OVERLAP_CSS * scale) - destY)) : 0;
            const drawH = Math.min(srcH - skip, sheet.height - (destY + skip)); // cut at the bottom of the page: moving the slice up would print it over the one above
            if (drawH > 0) {
              sheet.draw(bmp, srcX, srcY + skip, srcW, drawH, srcX, destY + skip);
              fillGutters(Math.max(gutterFillTop, destY + skip), destY + skip + drawH);
              drawnBottom = Math.max(drawnBottom, destY + skip + drawH);
              doneAbove = destY - Math.ceil(bottomTail * scale) - 2; // (the later pictures start at destY or lower down; the bar under a pane is drawn at the very end)
            }
          }
          // What lies under the pane is taken from the last picture: there everything is as it is to stay (a bar pulled up over the pane's edge is back, a
          // button that was hidden stays hidden). A single picture is the last one too.
          if (bottomTail > 0 && i === slices.length - 1) {
            tail = await createImageBitmap(bmp, 0, tailY, bmp.width, Math.max(1, bmp.height - tailY));
          }
        } finally {
          bmp.close();
        }
        // A page of many screens is saved in several pictures: the part that is finished goes to a PNG now and gives its memory back.
        if (sheet && doneAbove > 0) for (const part of sheet.takeFinished(doneAbove)) await encodePart(part);
      }
      if (cancelRequested.has(tab.id)) return { success: false, cancelled: true, error: 'CANCELLED' };
      if (!sheet) throw new Error('NO_PICTURE');

      // The end of the picture: a bar under a pane closes it; a page that turned out shorter than planned is cut to the rows it has.
      const drawTailRow = (yPos) => {
        if (fullWidthFooter || (srcX === 0 && srcW === sheet.width)) {
          sheet.draw(tail, 0, 0, tail.width, tail.height, 0, yPos);
        } else {
          fillGutters(Math.min(gutterFillTop, yPos), yPos + tail.height);
          sheet.draw(tail, srcX, 0, srcW, tail.height, srcX, yPos);
        }
      };
      const planned = sheet.height;
      let pageHeight = planned;
      if (tail) {
        const contentBottom = Math.min(drawnBottom, planned - tail.height);
        if (contentBottom > 0 && contentBottom < planned - tail.height - 1) {
          // the pane got shorter than planned (content went away while it was scrolled): the bar under it follows its last row, no blank band between them
          pageHeight = contentBottom + tail.height;
          drawTailRow(contentBottom);
        } else drawTailRow(planned - tail.height);
      } else if (drawnBottom > 0 && drawnBottom < planned - 1) {
        // the page ended sooner than planned (content went away while it was scrolled): no blank band under it
        pageHeight = drawnBottom;
      }
      tellPage('', { saving: true }); // the pictures are all taken: the page is put back while the rest is turned into files (the card says so)
      for (const part of sheet.finish(pageHeight)) await encodePart(part);
      encoded.sort((x, y) => x.index - y.index);
      if (cancelRequested.has(tab.id)) return { success: false, cancelled: true, error: 'CANCELLED' }; // (a Stop that came while the parts were made into pictures: nothing is saved yet)

      const stamp = new Date(); // (one time for all parts: they belong together)
      const many = encoded.length > 1;
      const savedIds = [];
      // A page saved in several files is all or nothing, as the privacy policy says: when one of them cannot be saved, or a Stop comes while they are being saved, the ones that were saved
      // are taken back (stopped if they still run, deleted, and gone from the downloads list).
      const takeBack = async () => {
        for (const id of savedIds) {
          await chrome.downloads.cancel(id).catch(() => {});
          await chrome.downloads.removeFile(id).catch(() => {});
          await chrome.downloads.erase({ id }).catch(() => {});
        }
        savedIds.length = 0;
      };
      try {
        for (const [k, piece] of encoded.entries()) {
          const isPng = piece.format === 'png';
          const bytes = new Uint8Array(await piece.blob.arrayBuffer());
          piece.blob = null;
          const saved = await saveFetchedBytes(
            { mime: isPng ? 'image/png' : 'image/jpeg', bytes },
            screenshotFilename(initialUrl, stamp, isPng ? 'png' : 'jpg', many ? k + 1 : 0),
            { tabId: tab.id, frameId: 0 },
            initialUrl
          );
          if (Number.isInteger(saved.id)) savedIds.push(saved.id); // (also the one that failed: it is in the list as well)
          if (!saved.outcome.ok) {
            throw new Error(saved.outcome.error || 'DOWNLOAD_FAILED');
          }
          if (cancelRequested.has(tab.id)) {
            await takeBack();
            return { success: false, cancelled: true, error: 'CANCELLED' };
          }
        }
      } catch (err) {
        await takeBack();
        throw err;
      }

      const format = encoded.some((piece) => piece.format === 'jpeg') ? 'jpeg' : 'png';
      const truncated = plan.truncated === true || pageCut;
      if (fromMenu) {
        toastKey = truncated ? 'screenshotTruncated' : pageGrowing ? 'screenshotPartial' : many ? 'screenshotParts' : format === 'jpeg' ? 'screenshotJpeg' : 'screenshotSaved';
      }
      return {
        success: true,
        downloadId: savedIds[0],
        downloadIds: savedIds,
        parts: encoded.length,
        slices: slices.length,
        truncated,
        partial: pageGrowing,
        format,
        width: sheet.width,
        height: pageHeight
      };
    } catch (err) {
      if (fromMenu) toastKey = 'screenshotFailed';
      throw err;
    } finally {
      tail?.close();
      chrome.tabs.sendMessage(tab.id, { action: 'screenshotCleanup', toastKey, parts: encoded.length }, { frameId: 0 }).catch(() => {});
    }
  } catch (err) {
    return { success: false, error: err?.message || 'CAPTURE_FAILED' };
  } finally {
    clearInterval(keepAlive);
    cancelRequested.delete(tab.id);
    activeScreenshotTabs.delete(tab.id);
  }
}
