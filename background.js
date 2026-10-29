// Selectra - Service Worker (MV3)
// Handles context menus, badge management, global/site mode sync, and CORS downloads.

'use strict';

importScripts('shared.js');
const {
  UNLOCK_KEYS, GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY, countEnabled, siteKey, resolveSettings, isPrivateHost
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
    downloadImage: 'Selectra: Download image'
  },
  tr: {
    toggleAll: 'Selectra: Kilitleri aç/kapat',
    forceCopy: 'Selectra: Saf kopyala',
    downloadImage: 'Selectra: Görseli indir'
  },
  de: {
    toggleAll: 'Selectra: Alles umstellen',
    forceCopy: 'Selectra: Sauber kopieren',
    downloadImage: 'Selectra: Bild herunterladen'
  },
  fr: {
    toggleAll: 'Selectra : Tout basculer',
    forceCopy: 'Selectra : Copie propre',
    downloadImage: 'Selectra : Télécharger l\'image'
  },
  es: {
    toggleAll: 'Selectra: Alternar todo',
    forceCopy: 'Selectra: Copia limpia',
    downloadImage: 'Selectra: Descargar imagen'
  },
  pt: {
    toggleAll: 'Selectra: Alternar tudo',
    forceCopy: 'Selectra: Cópia limpa',
    downloadImage: 'Selectra: Baixar imagem'
  },
  it: {
    toggleAll: 'Selectra: Attiva/disattiva tutto',
    forceCopy: 'Selectra: Copia pulita',
    downloadImage: 'Selectra: Scarica immagine'
  },
  ru: {
    toggleAll: 'Selectra: Включить/выключить все',
    forceCopy: 'Selectra: Скопировать чисто',
    downloadImage: 'Selectra: Скачать изображение'
  },
  pl: {
    toggleAll: 'Selectra: Przełącz wszystko',
    forceCopy: 'Selectra: Czysta kopia',
    downloadImage: 'Selectra: Pobierz obraz'
  },
  nl: {
    toggleAll: 'Selectra: Alles in-/uitschakelen',
    forceCopy: 'Selectra: Schoon kopiëren',
    downloadImage: 'Selectra: Afbeelding downloaden'
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
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.status === 'loading') setImageUnderVisible(false); });
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
// those: for everything else the browser's own name stands).
const ownDownloads = new Map(); // url -> the file name asked for
const downloadKey = (url) => (url.length > 300 ? `${url.slice(0, 200)}#${url.length}` : url); // a data: URL can be megabytes: do not keep it as a key
function onDeterminingFilename(item, suggest) {
  if (item.byExtensionId !== chrome.runtime.id) return; // a download the person (or another extension) started for the same address keeps the browser's name
  const asked = ownDownloads.get(downloadKey(item.url));
  if (asked === undefined) return;
  const mime = String(item.mime || '').toLowerCase();
  let filename = asked;
  if (Object.hasOwn(IMAGE_EXTENSION_OF_MIME, mime)) {
    const ext = IMAGE_EXTENSION_OF_MIME[mime];
    const current = extensionOfName(asked);
    if (current !== ext && !(current === 'jpeg' && ext === 'jpg')) filename = withExtension(asked, ext);
  }
  suggest({ filename, conflictAction: 'uniquify' });
}
chrome.downloads.onDeterminingFilename.addListener(onDeterminingFilename);

const dialogDownloads = new Set(); // ids of downloads started with the "where to save" dialog (see problemWithDownload)
const wantsDialog = (url, filename) => isSvgSource(url) || isSvgSource(filename); // a vector picture can carry script: the person chooses where it goes

async function startDownload(url, filename, { dialog = false } = {}) {
  ownDownloads.set(downloadKey(url), filename);
  try {
    const saveAs = dialog || wantsDialog(url, filename);
    const id = await chrome.downloads.download({ url, filename, saveAs, conflictAction: 'uniquify' });
    if (saveAs) dialogDownloads.add(id);
    return id;
  } finally {
    setTimeout(() => ownDownloads.delete(downloadKey(url)), 60000); // the name is asked for within moments of the start
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
// has been made by then. What that allows is a blind GET, after the user's own Alt+Click, whose answer never reaches the page: no more than the
// page can already trigger itself with an <img>.
const REFERER_FIXABLE_ERRORS = new Set(['SERVER_FORBIDDEN', 'SERVER_UNAUTHORIZED', 'NOT_AN_IMAGE']);
const MAX_DATA_URL_CHARS = 1900000; // Chrome refuses URLs beyond ~2 MB
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
