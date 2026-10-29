// Selectra - ISOLATED World Master Controller (MV3)
// Modular Object-Oriented Architecture with Unified Asset Resolvers,
// Real-time Barrier Diagnosis Scanner, Deep Shadow DOM Piercing,
// and Visual Clarity / Anti-Blur Text Recovery.

(function () {
  'use strict';

  const {
    FEATURE_KEYS, GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY,
    emptySettings, normalizeSettings, withoutTopOnly, siteKey, resolveSettings, getBaseDomain
  } = self.SelectraShared;

  const hostname = location.hostname;
  // The page can name elements so that document.getElementById, form.tagName or el.closest mean something else (DOM clobbering): what this script
  // relies on is taken now.
  const docCreateElement = Document.prototype.createElement;
  const elementClosest = Element.prototype.closest;
  const tagNameOf = Object.getOwnPropertyDescriptor(Element.prototype, 'tagName').get;

  // ─── On-Page Toast Translations ───
  // Toasts are rendered directly on the visited page (not inside the popup),
  // so they cannot reuse i18n.js (only loaded into the popup document). They
  // still need to follow the user's chosen extension language rather than
  // being hardcoded to a single language regardless of the `superUnlockerLang`
  // setting. Kept intentionally small: only the handful of strings actually
  // shown as toasts.
  const TOAST_I18N = {
    en: { downloading: 'Downloading image...', downloaded: 'Image downloaded', copied: 'Text copied to clipboard', noSelection: 'No text selected', failed: 'Download failed', noImage: 'No image found here', copyFailed: 'Could not copy the text' },
    tr: { downloading: 'Görsel indiriliyor...', downloaded: 'Görsel indirildi', copied: 'Metin panoya kopyalandı', noSelection: 'Kopyalanacak metin seçilmedi', failed: 'İndirilemedi', noImage: 'Burada indirilecek görsel bulunamadı', copyFailed: 'Metin kopyalanamadı' },
    de: { downloading: 'Bild wird heruntergeladen...', downloaded: 'Bild heruntergeladen', copied: 'Text in die Zwischenablage kopiert', noSelection: 'Kein Text ausgewählt', failed: 'Download fehlgeschlagen', noImage: 'Hier wurde kein Bild gefunden', copyFailed: 'Text konnte nicht kopiert werden' },
    fr: { downloading: "Téléchargement de l'image...", downloaded: 'Image téléchargée', copied: 'Texte copié dans le presse-papiers', noSelection: 'Aucun texte sélectionné', failed: 'Échec du téléchargement', noImage: 'Aucune image trouvée ici', copyFailed: 'Impossible de copier le texte' },
    es: { downloading: 'Descargando imagen...', downloaded: 'Imagen descargada', copied: 'Texto copiado al portapapeles', noSelection: 'No hay texto seleccionado', failed: 'Error de descarga', noImage: 'No se encontró ninguna imagen aquí', copyFailed: 'No se pudo copiar el texto' },
    pt: { downloading: 'Baixando imagem...', downloaded: 'Imagem baixada', copied: 'Texto copiado para a área de transferência', noSelection: 'Nenhum texto selecionado', failed: 'Falha no download', noImage: 'Nenhuma imagem encontrada aqui', copyFailed: 'Não foi possível copiar o texto' },
    it: { downloading: "Download dell'immagine...", downloaded: 'Immagine scaricata', copied: 'Testo copiato negli appunti', noSelection: 'Nessun testo selezionato', failed: 'Download non riuscito', noImage: 'Nessuna immagine trovata qui', copyFailed: 'Impossibile copiare il testo' },
    ru: { downloading: 'Загрузка изображения...', downloaded: 'Изображение загружено', copied: 'Текст скопирован в буфер обмена', noSelection: 'Текст не выделен', failed: 'Не удалось скачать', noImage: 'Здесь не найдено изображений', copyFailed: 'Не удалось скопировать текст' },
    pl: { downloading: 'Pobieranie obrazu...', downloaded: 'Obraz pobrany', copied: 'Tekst skopiowany do schowka', noSelection: 'Nie zaznaczono tekstu', failed: 'Pobieranie nie powiodło się', noImage: 'Nie znaleziono tu obrazu', copyFailed: 'Nie udało się skopiować tekstu' },
    nl: { downloading: 'Afbeelding downloaden...', downloaded: 'Afbeelding gedownload', copied: 'Tekst gekopieerd naar klembord', noSelection: 'Geen tekst geselecteerd', failed: 'Downloaden mislukt', noImage: 'Hier is geen afbeelding gevonden', copyFailed: 'Tekst kopiëren is mislukt' }
  };
  const knownToastLang = (lang) => typeof lang === 'string' && Object.hasOwn(TOAST_I18N, lang);
  let toastLang = (() => {
    try {
      for (const tag of [...(navigator.languages || []), navigator.language]) {
        const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
        if (knownToastLang(base)) return base;
      }
    } catch {}
    return 'en';
  })();
  function T(key) {
    const table = TOAST_I18N[knownToastLang(toastLang) ? toastLang : 'en'];
    return (Object.hasOwn(table, key) && table[key]) || TOAST_I18N.en[key] || '';
  }
  chrome.storage.local.get('superUnlockerLang').then(data => {
    if (knownToastLang(data?.superUnlockerLang)) toastLang = data.superUnlockerLang;
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.superUnlockerLang) {
      const next = changes.superUnlockerLang.newValue;
      if (knownToastLang(next)) toastLang = next;
    }
  });

  // ─── Deep Shadow DOM Tracking (cross-world safe) ───
  // Hooking Element.prototype.attachShadow from this ISOLATED-world script
  // cannot see shadow roots created by the page's own MAIN-world scripts
  // (separate JS realms, separate prototypes). Instead, discover shadow
  // roots by walking the DOM and reading the native `.shadowRoot` property,
  // which reflects the real, shared underlying platform object regardless
  // of which world attached it.
  //
  // Roots are held through WeakRefs so that a single-page app that creates and drops thousands of
  // components does not keep every removed shadow tree alive.
  const shadowRootRefs = new Set();
  let shadowRootSeen = new WeakSet();
  const shadowObservers = new Set();
  const knownShadowRoots = {
    has: (root) => shadowRootSeen.has(root),
    add(root) { shadowRootSeen.add(root); shadowRootRefs.add(new WeakRef(root)); },
    reset() { shadowRootSeen = new WeakSet(); shadowRootRefs.clear(); },
    [Symbol.iterator]: function* () {
      for (const ref of shadowRootRefs) {
        const root = ref.deref();
        if (root) yield root;
        else shadowRootRefs.delete(ref);
      }
    }
  };
  const activeStyles = new Map();
  const ownStyleNodes = new Map(); // id -> the <style> this script made (an element of the page that happens to carry the same id is not ours)

  const { getShadowRoot } = self.SelectraImage;

  // The styles this script made inside shadow trees, by root and id. Looked up here and never by id in the tree: a component that carries a style
  // of its own under the same id (switched off for every medium, say) must neither stand in for ours nor be taken away with it.
  const shadowStyleNodes = new WeakMap(); // ShadowRoot -> Map(id -> <style>)
  function ownShadowStyle(shadow, id) {
    const node = shadowStyleNodes.get(shadow)?.get(id);
    return node && node.parentNode === shadow ? node : null;
  }

  function applyStyleToShadowRoot(shadow, id, css) {
    try {
      let sNode = ownShadowStyle(shadow, id);
      if (!sNode) {
        sNode = docCreateElement.call(document, 'style');
        sNode.id = id;
        shadow.appendChild(sNode);
        let styles = shadowStyleNodes.get(shadow);
        if (!styles) { styles = new Map(); shadowStyleNodes.set(shadow, styles); }
        styles.set(id, sNode);
      }
      if (sNode.textContent !== css) sNode.textContent = css;
    } catch {}
  }

  function removeStyleFromShadowRoot(shadow, id) {
    try {
      ownShadowStyle(shadow, id)?.remove();
      shadowStyleNodes.get(shadow)?.delete(id);
    } catch {}
  }

  function scanForShadowRoots(node) {
    if (!node) return;
    if (node.nodeType === 1) {
      const own = getShadowRoot(node);
      if (own) registerShadowRoot(own);
    }
    if (typeof node.querySelectorAll === 'function') {
      try {
        node.querySelectorAll('*').forEach(el => {
          const root = getShadowRoot(el);
          if (root) registerShadowRoot(root);
        });
      } catch {}
    }
  }

  // attachShadow() is not a DOM mutation, so roots attached after their host was inserted are only
  // found by looking again: the document plus every known root (for roots nested inside roots).
  let lastShadowRescan = 0;
  function rescanShadowRoots(force = false) {
    const now = performance.now();
    if (!force && now - lastShadowRescan < 30) return;
    lastShadowRescan = now;
    scanForShadowRoots(document.documentElement || document);
    for (const root of knownShadowRoots) scanForShadowRoots(root);
  }

  function registerShadowRoot(root) {
    if (!root || knownShadowRoots.has(root)) return;
    knownShadowRoots.add(root);

    // Propagate all active extension styles into newly discovered shadow root
    for (const [id, css] of activeStyles) {
      applyStyleToShadowRoot(root, id, css);
    }

    scanForShadowRoots(root);
    try {
      const shadowObserver = new MutationObserver(records => {
        for (const record of records) {
          for (const added of record.addedNodes) {
            scanForShadowRoots(added);
          }
        }
      });
      shadowObserver.observe(root, { childList: true, subtree: true });
      shadowObservers.add(shadowObserver);
    } catch {}
  }

  // Looking for shadow roots means walking the page after every change, so it is done only while a feature is on: with every feature off
  // the page is not observed at all (and nothing was changed in it that would need the roots).
  const ShadowWatch = {
    active: false,
    documentObserver: null,

    start() {
      if (this.active) return;
      this.active = true;
      const rootNode = document.documentElement || document;
      scanForShadowRoots(rootNode);
      try {
        this.documentObserver = new MutationObserver(records => {
          for (const record of records) {
            for (const added of record.addedNodes) {
              scanForShadowRoots(added);
            }
          }
        });
        this.documentObserver.observe(rootNode, { childList: true, subtree: true });
      } catch {}
    },

    stop() {
      if (!this.active) return;
      this.active = false;
      this.documentObserver?.disconnect();
      this.documentObserver = null;
      for (const observer of shadowObservers) observer.disconnect();
      shadowObservers.clear();
      knownShadowRoots.reset();
    },

    set(on) {
      if (on) this.start();
      else this.stop();
    }
  };

  // ─── Bridge to the MAIN world script ───
  // The settings reach the page-world script through a MessagePort that only the two scripts hold. The port is offered in a window message
  // by content-main.js at the very start; this listener, registered before any page script can run, takes it and stops the message, so the
  // page never sees it (and nothing in an event, attribute or property carries a secret it could read and forge commands with).
  const Bridge = {
    port: null,
    pending: [],

    start() {
      const onOffer = (event) => {
        try {
          const data = event.data;
          if (this.port || event.source !== window || !data || typeof data !== 'object' || data.__su !== 'offer' || !event.ports || !event.ports[0]) return;
          event.stopImmediatePropagation();
          this.port = event.ports[0];
          window.removeEventListener('message', onOffer, true);
          this.port.onmessage = (message) => {
            const data = message.data;
            if (!data || typeof data !== 'object') return;
            // attachShadow announcements, debounced over there; the rescan is throttled here as well (a page can attach roots in a loop)
            if (data.type === 'shadow' && ShadowWatch.active) scheduleShadowRescan();
            // the page-world hook refused a cancellation the page asked for: that is the barrier itself, seen while the unlocker is on
            else if (data.type === 'ignored' && BarrierScanner.IGNORED_KINDS.has(data.kind)) {
              BarrierScanner.recordEvidence({ type: 'blocked-event', subtype: data.kind, source: 'page-hook', selector: '', text: '', details: { eventType: data.kind, defaultPrevented: true } });
            }
          };

          this.port.postMessage({ type: 'ack' });
          for (const message of this.pending.splice(0)) this.port.postMessage(message);
        } catch {}
      };
      // Nothing here ever asks for an offer: both scripts start in the same task, so the first one is taken; should it not be, content-main.js offers
      // again from its own clock. (An earlier "hello" message that asked for a new offer could be posted by the page as well.)
      window.addEventListener('message', onOffer, true);
    },

    send(type, value) {
      const message = { type, value };
      if (this.port) {
        this.port.postMessage(message);
        return;
      }
      if (type === 'SET_STATE') this.pending = this.pending.filter(item => item.type !== 'SET_STATE'); // only the latest state matters
      this.pending.push(message);
    }
  };

  let shadowRescanTimer = 0;
  function scheduleShadowRescan() {
    if (shadowRescanTimer) return;
    shadowRescanTimer = setTimeout(() => { shadowRescanTimer = 0; rescanShadowRoots(true); }, 150);
  }

  Bridge.start();


  class DOMUtils {
    static injectStyle(id, css) {
      activeStyles.set(id, css);
      try {
        let node = ownStyleNodes.get(id);
        if (!node || !node.isConnected) {
          node = docCreateElement.call(document, 'style');
          node.id = id;
          (document.head || document.documentElement || document).appendChild(node);
          ownStyleNodes.set(id, node);
        }
        if (node.textContent !== css) node.textContent = css;
      } catch {} // a page that breaks one style must not stop the settings from reaching the page-world script
      if (ShadowWatch.active) rescanShadowRoots();
      for (const shadow of knownShadowRoots) {
        applyStyleToShadowRoot(shadow, id, css);
      }
    }

    static removeStyle(id) {
      activeStyles.delete(id);
      try { ownStyleNodes.get(id)?.remove(); } catch {}
      ownStyleNodes.delete(id);
      for (const shadow of knownShadowRoots) {
        removeStyleFromShadowRoot(shadow, id);
      }
    }

    // Runs `measure` with this script's own style sheets switched off, to look at the page the way the page styled it. Nothing is painted in between.
    static withoutOwnStyles(measure) {
      const switchedOff = [];
      for (const node of ownStyleNodes.values()) {
        try { if (node.sheet && !node.sheet.disabled) { node.sheet.disabled = true; switchedOff.push(node.sheet); } } catch {}
      }
      try {
        return measure();
      } finally {
        for (const sheet of switchedOff) { try { sheet.disabled = false; } catch {} }
      }
    }

    static dispatchMain(type, value = true) {
      Bridge.send(type, value);
    }

    static isEditable(target) {
      if (!(target instanceof Element)) return false;
      const tag = String(tagNameOf.call(target)).toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable === true ||
        !!elementClosest.call(target, '[contenteditable="true"]')
      );
    }

    static sanitizeFilename(value, ext = 'jpg') {
      // The text comes from the page (alt, title, document title): cut it BEFORE any expression looks at it, by code points so that no
      // character is split in two.
      let base = Array.from(String(value || 'image').normalize('NFKC')).slice(0, 200).join('')
        .replace(/\.[a-z0-9]{3,5}$/i, '')
        .replace(/[<>:"/\\|?*,\u0000-\u001F;!@#$%^&()+=]/g, '')
        .replace(/[\s_.-]+/g, '_')
        .replace(/^_+|_+$/g, '');
      base = Array.from(base).slice(0, 45).join('').replace(/^_+|_+$/g, '');

      if (!base) base = 'image';
      const cleanExt = String(ext || 'jpg').replace(/^[.]+/, '').toLowerCase() || 'jpg';
      return `${base}.${cleanExt}`;
    }

    // The message goes into a tree of its own: a closed shadow root under a custom element, in the top layer when the browser has one. The page's CSS
    // (div { ... !important }, a transformed <body>, inherited direction and letter-spacing), a full-screen element, a modal <dialog>, and its scripts
    // (innerText, designMode, "save page as") cannot reach it, and it is gone again as soon as it has faded.
    static toastState = null;

    static dropToast() {
      const state = this.toastState;
      this.toastState = null;
      if (!state) return;
      clearTimeout(state.timer);
      clearTimeout(state.hideTimer);
      try { state.host.remove(); } catch {}
    }

    static showToast(message) {
      const XHTML = 'http://www.w3.org/1999/xhtml'; // an SVG document has no HTML elements unless they are made in this namespace
      const parent = document.fullscreenElement || document.documentElement;
      if (!parent) return;
      let state = this.toastState;
      if (!state || !state.host.isConnected || state.host.parentNode !== parent) {
        this.dropToast();
        try {
          const host = document.createElementNS(XHTML, 'selectra-toast');
          const root = host.attachShadow({ mode: 'closed' });
          const style = document.createElementNS(XHTML, 'style');
          style.textContent = [
            ':host { display: block !important; position: fixed !important; right: 24px !important; bottom: 24px !important; left: auto !important; top: auto !important;',
            '  width: auto !important; height: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: none !important;',
            '  overflow: visible !important; z-index: 2147483647 !important; pointer-events: none !important; direction: ltr !important; letter-spacing: normal !important; text-transform: none !important; }',
            '.box { box-sizing: border-box; max-width: min(420px, calc(100vw - 48px)); padding: 10px 16px; border-radius: 12px; background: rgba(15,23,42,0.95); color: #f8fafc;',
            '  border: 1px solid rgba(255,255,255,0.15); font: 500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.45);',
            '  opacity: 0; transform: translateY(12px); transition: opacity .2s cubic-bezier(0.4,0,0.2,1), transform .2s cubic-bezier(0.4,0,0.2,1); }',
            '.box.show { opacity: 1; transform: translateY(0); }',
            '@media (prefers-reduced-motion: reduce) { .box { transition: none; } }'
          ].join('\n');
          const box = document.createElementNS(XHTML, 'div');
          box.className = 'box';
          box.setAttribute('role', 'status');
          box.setAttribute('aria-live', 'polite');
          root.append(style, box);
          host.setAttribute('popover', 'manual');
          parent.appendChild(host);
          try { host.showPopover(); } catch {} // the top layer, where the browser has one; otherwise the z-index above does the work
          state = this.toastState = { host, box, timer: 0, hideTimer: 0 };
        } catch {
          return;
        }
      }

      state.box.textContent = message;
      requestAnimationFrame(() => state.box.classList.add('show'));

      clearTimeout(state.timer);
      clearTimeout(state.hideTimer);
      state.timer = setTimeout(() => {
        state.box.classList.remove('show');
        state.hideTimer = setTimeout(() => this.dropToast(), 400); // after the fade
      }, 2400);
    }

    static removeBlockingInlineHandlers(root = document) {
      const relevant = [
        'oncopy', 'oncut', 'onselectstart', 'oncontextmenu',
        'onmousedown', 'onkeydown', 'ondragstart', 'onbeforeprint'
      ];

      const processNode = (node) => {
        if (!(node instanceof Element || node === document || (typeof window !== 'undefined' && node === window))) return;
        for (const prop of relevant) {
          try {
            const value = node[prop];
            if (typeof value !== 'function') continue;
            const source = value.toString().toLowerCase();
            if (
              source.includes('preventdefault') ||
              source.includes('return false') ||
              source.includes('wpcp') ||
              source.includes('wccp') ||
              source.includes('nocontext') ||
              source.includes('disable_copy') ||
              source.includes('disableselection')
            ) {
              node[prop] = null;
            }
          } catch {}
        }

        try {
          if (node.getAttribute && node.getAttribute('unselectable') === 'on') node.removeAttribute('unselectable');
        } catch {}
      };

      const traverse = (target) => {
        if (!target) return;
        processNode(target);
        if (target.querySelectorAll) {
          target.querySelectorAll('[oncopy],[oncut],[onselectstart],[oncontextmenu],[onmousedown],[onkeydown],[ondragstart],[onbeforeprint],[unselectable]')
            .forEach(processNode);
        }
      };

      if (root === document && typeof window !== 'undefined') {
        processNode(window);
        rescanShadowRoots();
      }
      traverse(root);
      // Also pierce through all known Shadow DOM trees!
      for (const shadow of knownShadowRoots) {
        try { traverse(shadow); } catch {}
      }
    }
  }

  // ─── COPY PROTECTION PATTERNS & UTILS ───
  const COPY_MESSAGE_PATTERNS = [
    'kopyalayamazsın',
    'kopyalayamazsınız',
    'kopyalanamaz',
    'kopyalama yasak',
    'kopyalama engellendi',
    'kopyalama devre dışı',
    'kopyalanamazsınız',
    'bu içeriği kopyalayamazsın',
    'bu içeriği kopyalayamazsınız',
    'bu içerik kopyalanamaz',
    'bu sayfadan kopyalama',
    'metin kopyalanamaz',

    'cannot copy',
    'can not copy',
    'copy is disabled',
    'copy disabled',
    'copy not allowed',
    'content cannot be copied',
    'text cannot be copied',
    'copy protection'
  ];

  function normalizeProtectionText(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // ─── Real-Time Barrier Diagnosis Engine with Persistent Evidence ───
  class BarrierScanner {
    static state = {
      initialized: false,
      armed: false,
      queue: new Map(),
      idleHandle: 0,
      unsubscribe: null,
      attributeObserver: null,
      seen: new Map(),
      maxEvidence: 100
    };

    // What the page-world hook reports (content-main.js): it refused a cancellation the page asked for.
    static IGNORED_KINDS = new Set(['contextmenu', 'selectstart', 'copy', 'drag', 'typing', 'scroll', 'keys']);

    static INITIAL_SELECTOR =
      '[role="alert"], [role="dialog"], [aria-live], ' +
      '#wpcp-error-message, .msgmsg-box-wpcp, .warning-wpcp, ' +
      '#wccp_pro_notify_message, #wccp_notify_message, .wccp-notice, .wccp_notify, #wccpNotice, ' +
      '.wp-content-copy-protector-overlay, .content-protector-overlay, ' +
      '[class*="copy-protect"], [class*="content-protect"], ' +
      '[class*="alert"], [id*="alert"], [class*="toast"], [id*="toast"], ' +
      '[class*="modal"], [id*="modal"], [class*="popup"], [id*="popup"], ' +
      '[class*="message"], [id*="message"]';

    // Four passive listeners: they cost nothing, so they are always there. Whether the PAGE cancelled the event is only known once every
    // listener has run, hence the look one task later.
    static init() {
      if (this.state.initialized) return;
      this.state.initialized = true;

      for (const evtType of ['copy', 'cut', 'selectstart', 'contextmenu']) {
        document.addEventListener(evtType, (event) => {
          setTimeout(() => {
            if (!event.defaultPrevented) return;
            const targetSelector = BarrierScanner.getStableSelector(event.target);
            BarrierScanner.recordEvidence({
              type: 'blocked-event',
              subtype: evtType,
              source: 'event',
              selector: targetSelector,
              text: '', // never the user's selection
              details: { eventType: evtType, target: targetSelector, defaultPrevented: true }
            });
          }, 0);
        }, { capture: true, passive: true });
      }
    }

    // The part that looks at the page's elements (a mutation observer and style reads) runs only while a feature is on, and never inside the
    // observer's callback: nodes are queued and looked at when the browser is idle, a few at a time. (It used to run on every page, always,
    // reading styles for every node a busy page added or restyled.)
    static setArmed(on) {
      if (on) this.arm();
      else this.disarm();
    }

    static arm() {
      if (this.state.armed) return;
      this.state.armed = true;
      try {
        this.state.unsubscribe = mutationManager.subscribe((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof Element) this.enqueue(node, 'mutation');
              else if (node instanceof Text) this.scanText(node.nodeValue);
            }
          }
        });
        // a class or a style written onto an existing node is how a hidden message gets shown: the node is only noted here
        this.state.attributeObserver = new MutationObserver((records) => {
          for (const record of records) if (record.target instanceof Element) this.enqueue(record.target, 'attribute-mutation');
        });
        this.state.attributeObserver.observe(document.documentElement || document, {
          attributes: true, subtree: true, attributeFilter: ['class', 'style', 'hidden', 'role', 'aria-live']
        });
      } catch {}
      try {
        document.querySelectorAll(this.INITIAL_SELECTOR).forEach(el => this.enqueue(el, 'initial-scan'));
      } catch {}
    }

    static disarm() {
      if (!this.state.armed) return;
      this.state.armed = false;
      try { this.state.unsubscribe?.(); } catch {}
      this.state.unsubscribe = null;
      this.state.attributeObserver?.disconnect();
      this.state.attributeObserver = null;
      this.state.queue.clear();
      if (this.state.idleHandle) {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this.state.idleHandle);
        clearTimeout(this.state.idleHandle);
        this.state.idleHandle = 0;
      }
    }

    static enqueue(el, source) {
      const { queue } = this.state;
      if (queue.size >= 400 || queue.has(el)) return; // an animation floods attribute changes: the first ones are enough
      queue.set(el, source);
      this.schedule();
    }

    static schedule() {
      if (this.state.idleHandle || !this.state.queue.size) return;
      const run = () => { this.state.idleHandle = 0; this.flush(); };
      this.state.idleHandle = typeof requestIdleCallback === 'function' ? requestIdleCallback(run, { timeout: 1000 }) : setTimeout(run, 250);
    }

    static flush() {
      const started = performance.now();
      let handled = 0;
      for (const [el, source] of this.state.queue) {
        this.state.queue.delete(el);
        if (el.isConnected) this.scanNode(el, source);
        if (++handled >= 40 || performance.now() - started > 8) break; // a few at a time
      }
      this.schedule();
    }

    static recordEvidence(record) {
      if (!record || !record.type) return;
      const type = record.type;
      const text = (record.text || '').slice(0, 160);
      const selector = record.selector || '';
      const key = `${type}:${text}:${selector}`;

      const entry = {
        ...record,
        timestamp: Date.now()
      };

      this.state.seen.set(key, entry);

      if (this.state.seen.size > this.state.maxEvidence) {
        const firstKey = this.state.seen.keys().next().value;
        this.state.seen.delete(firstKey);
      }
    }

    static isProtectionMessage(rawText) {
      const text = normalizeProtectionText(rawText);
      if (!text || text.length < 3) return false;
      const checkText = text.slice(0, 500);

      // Direct exact phrase matches
      for (const pattern of COPY_MESSAGE_PATTERNS) {
        if (checkText.includes(pattern)) return true;
      }

      // Combination 1 (Turkish): 'kopya' + ('yasak' | 'engell' | 'devre dışı' | 'koruma' | 'izin veril' | 'mümkün')
      if (checkText.includes('kopya') && (
        checkText.includes('yasak') ||
        checkText.includes('engell') ||
        checkText.includes('devre dışı') ||
        checkText.includes('koruma') ||
        checkText.includes('izin veril') ||
        checkText.includes('mümkün değil') ||
        checkText.includes('alamaz')
      )) {
        return true;
      }

      // Combination 2 (Turkish): 'kopyala' + ('amaz' | 'yasak' | 'engell' | 'yapılamaz')
      if (checkText.includes('kopyala') && (
        checkText.includes('amaz') ||
        checkText.includes('yasak') ||
        checkText.includes('engell') ||
        checkText.includes('yapılamaz') ||
        checkText.includes('dur')
      )) {
        return true;
      }

      // Combination 3 (English): 'copy' + ('disabled' | 'cannot' | 'not allowed' | 'protection' | 'prohibited' | 'restricted')
      if (checkText.includes('copy') && (
        checkText.includes('disabled') ||
        checkText.includes('cannot') ||
        checkText.includes('not allowed') ||
        checkText.includes('protection') ||
        checkText.includes('prohibited') ||
        checkText.includes('restricted')
      )) {
        return true;
      }

      return false;
    }

    static inspectMessageElement(element) {
      if (!(element instanceof Element)) return null;

      const rawText = (element.innerText || element.textContent || '').trim();
      const text = rawText.slice(0, 300);
      const isCopyMsg = this.isProtectionMessage(text);

      let score = 0;
      if (isCopyMsg) score += 40;

      const role = (element.getAttribute('role') || '').toLowerCase();
      if (role === 'alert') score += 25;
      if (role === 'dialog') score += 20;

      if (element.hasAttribute('aria-live')) score += 20;

      const id = (element.id || '').toLowerCase();
      const cls = String(element.className || '').toLowerCase();
      const combo = `${id} ${cls}`;
      const keywords = ['alert', 'warning', 'notice', 'message', 'toast', 'popup', 'modal', 'copy', 'protect', 'wpcp', 'wccp'];
      for (const kw of keywords) {
        if (combo.includes(kw)) {
          score += 20;
          break;
        }
      }

      let style = null;
      let rect = null;
      try {
        style = window.getComputedStyle(element);
        rect = element.getBoundingClientRect();
      } catch {}

      const details = {
        role: role || undefined,
        selector: this.getStableSelector(element)
      };

      if (style) {
        const pos = style.position;
        if (pos === 'fixed' || pos === 'absolute') {
          score += 20;
          details.position = pos;
        }
        const z = Number.parseInt(style.zIndex, 10);
        if (!Number.isNaN(z) && z > 50) {
          score += 15;
          details.zIndex = z;
        }
        if (rect && rect.width > 0 && rect.height > 0) {
          const vW = window.innerWidth || 1000;
          const vH = window.innerHeight || 800;
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          if (Math.abs(centerX - vW / 2) < vW / 3 && Math.abs(centerY - vH / 2) < vH / 3) {
            score += 10;
            details.centered = true;
          }
        }
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
          score += 10;
        }
        if (style.borderWidth && style.borderWidth !== '0px' && style.borderStyle !== 'none') {
          score += 10;
        }
        if (style.boxShadow && style.boxShadow !== 'none') {
          score += 10;
        }
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          score += 10;
          details.visible = true;
        }
      }

      return {
        score,
        isCopyMsg,
        text,
        selector: details.selector,
        details
      };
    }

    static scanNode(node, source = 'mutation') {
      if (!(node instanceof Element)) return;

      const inspection = this.inspectMessageElement(node);
      if (inspection && inspection.score >= 40) {
        this.recordEvidence({
          type: 'protection-message',
          subtype: inspection.isCopyMsg ? 'copy-block' : 'warning-overlay',
          score: inspection.score,
          text: inspection.text,
          selector: inspection.selector,
          source,
          details: inspection.details
        });
      }

      // Also inspect direct children if container
      if (node.childElementCount > 0 && node.childElementCount <= 6) {
        for (const child of node.children) {
          if (child instanceof Element) {
            const cInsp = this.inspectMessageElement(child);
            if (cInsp && cInsp.score >= 40) {
              this.recordEvidence({
                type: 'protection-message',
                subtype: cInsp.isCopyMsg ? 'copy-block' : 'warning-overlay',
                score: cInsp.score,
                text: cInsp.text,
                selector: cInsp.selector,
                source: `${source}-child`,
                details: cInsp.details
              });
            }
          }
        }
      }
    }

    static scanText(text) {
      if (typeof text !== 'string') return;
      if (this.isProtectionMessage(text)) {
        this.recordEvidence({
          type: 'protection-message',
          subtype: 'copy-block',
          score: 80,
          text: text.slice(0, 120),
          selector: 'text-node',
          source: 'mutation-text',
          details: {}
        });
      }
    }

    static getStableSelector(element) {
      if (!(element instanceof Element)) return 'unknown';
      if (element.id) return `#${element.id}`;
      const tag = element.tagName.toLowerCase();
      const classes = Array.from(element.classList || []).filter(c => !c.startsWith('su-')).slice(0, 2);
      if (classes.length) return `${tag}.${classes.join('.')}`;
      return tag;
    }

    static getVisibilityInfo(element) {
      if (!(element instanceof Element)) return { visible: false };
      try {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
          position: style.position,
          width: rect.width,
          height: rect.height
        };
      } catch {
        return { visible: false };
      }
    }

    static getHistoricalDiagnosis() {
      const messages = [];
      let copyBlockCount = 0;
      let blurRepairs = 0;
      const blocked = new Set();

      for (const item of this.state.seen.values()) {
        if (item.type === 'protection-message') {
          messages.push({
            type: item.subtype || 'copy-block',
            text: item.text,
            selector: item.selector,
            score: item.score,
            source: item.source,
            timestamp: item.timestamp
          });
          if (item.subtype === 'copy-block') copyBlockCount++;
        } else if (item.type === 'blocked-event') {
          blocked.add(item.subtype);
        } else if (item.type === 'blur') {
          blurRepairs++;
        }
      }

      return {
        messages,
        copyBlockCount,
        blocked,
        hasBlockedEvents: blocked.size > 0,
        blurRepairs,
        totalEvidence: this.state.seen.size
      };
    }

    static scan() {
      if (this.state.seenUrl !== location.href) { // a single-page app that changed its address: what was seen on the other page is not this page's
        if (this.state.seenUrl) this.state.seen.clear();
        this.state.seenUrl = location.href;
      }
      const diagnosis = {
        hasRightClickLock: false,
        hasSelectionLock: false,
        hasCopyLock: false,
        hasScrollLock: false,
        hasBlurFilter: false,
        hasAlertTrap: false,
        totalBarriers: 0,
        protectionMessages: [],
        evidenceCount: 0,
        historicalAlertTrap: false,
        copyProtectionEvidence: false
      };

      try {
        const doc = document;
        const html = doc.documentElement;
        const body = doc.body;
        const historical = this.getHistoricalDiagnosis();

        // 1. Right-Click Lock Check
        if (
          doc.oncontextmenu != null ||
          html?.getAttribute('oncontextmenu') != null ||
          body?.getAttribute('oncontextmenu') != null ||
          doc.querySelector('[oncontextmenu]') != null ||
          historical.blocked.has('contextmenu')
        ) {
          diagnosis.hasRightClickLock = true;
        }

        // 3. Copy Lock Check (inline handlers, and copy/cut events the page cancelled)
        const currentCopyLock = (
          doc.oncopy != null || doc.oncut != null || doc.onselectstart != null ||
          body?.oncopy != null || body?.onselectstart != null ||
          doc.querySelector('[oncopy],[oncut],[onselectstart]') != null ||
          historical.blocked.has('copy') || historical.blocked.has('cut')
        );

        // 2, 4, 5. What the PAGE'S styles do, measured with this extension's own style sheets switched off: with the unlockers on, their rules
        // (user-select, overflow, ...) would otherwise hide the very barriers the unlockers are removing.
        let hasBlur = false;
        DOMUtils.withoutOwnStyles(() => {
          if (html && body) {
            const htmlStyle = window.getComputedStyle(html);
            const bodyStyle = window.getComputedStyle(body);

            // 2. Selection Lock Check (user-select: none)
            if (
              htmlStyle.userSelect === 'none' ||
              htmlStyle.webkitUserSelect === 'none' ||
              bodyStyle.userSelect === 'none' ||
              bodyStyle.webkitUserSelect === 'none' ||
              doc.querySelector('.unselectable, [unselectable="on"], [style*="user-select: none"], [style*="user-select:none"]') != null ||
              historical.blocked.has('selectstart')
            ) {
              diagnosis.hasSelectionLock = true;
            }

            // 4. Scroll Lock Check
            const scrollHeight = Math.max(html.scrollHeight, body.scrollHeight);
            const viewportHeight = window.innerHeight || html.clientHeight;
            if (
              scrollHeight > viewportHeight + 20 &&
              (htmlStyle.overflowY === 'hidden' || bodyStyle.overflowY === 'hidden' || bodyStyle.position === 'fixed')
            ) {
              diagnosis.hasScrollLock = true;
            }
          }

          // 5. Blur: text that is really blurred or masked (decided from the computed style, like the unlocker itself; a class name proves
          // nothing: every Tailwind site has "blur-md" decorations)
          if (body) {
            let budget = 2500;
            for (const el of body.querySelectorAll('*')) {
              if (--budget < 0) break;
              if (blurFixes(el).length) { hasBlur = true; break; }
            }
          }
        });
        diagnosis.hasBlurFilter = hasBlur || historical.blurRepairs > 0; // the unlocker's own repairs are evidence too: they are inline and stay measurable

        // 6. Current Alert Trap Check (in DOM right now)
        const currentAlertTrap = doc.querySelector(
          '#wpcp-error-message, .msgmsg-box-wpcp, .warning-wpcp, ' +
          '#wccp_pro_notify_message, #wccp_notify_message, .wccp-notice, .wccp_notify, #wccpNotice, ' +
          '.wp-content-copy-protector-overlay, .content-protector-overlay, ' +
          '[class*="copy-protect"], [class*="content-protect"]'
        ) != null;

        // 7. Historical Evidence Integration
        const historicalAlert = historical.copyBlockCount > 0 || Array.from(this.state.seen.values()).some(
          x => x.type === 'protection-message' || x.subtype === 'copy-block'
        );

        diagnosis.hasAlertTrap = currentAlertTrap || historicalAlert;
        diagnosis.hasCopyLock = currentCopyLock || historical.copyBlockCount > 0;
        diagnosis.historicalAlertTrap = historicalAlert;
        diagnosis.copyProtectionEvidence = historical.hasBlockedEvents || historical.copyBlockCount > 0;
        diagnosis.protectionMessages = historical.messages;
        diagnosis.evidenceCount = historical.totalEvidence;

        diagnosis.totalBarriers = (
          (diagnosis.hasRightClickLock ? 1 : 0) +
          (diagnosis.hasSelectionLock ? 1 : 0) +
          (diagnosis.hasCopyLock ? 1 : 0) +
          (diagnosis.hasScrollLock ? 1 : 0) +
          (diagnosis.hasBlurFilter ? 1 : 0) +
          (diagnosis.hasAlertTrap ? 1 : 0)
        );
      } catch {}

      return diagnosis;
    }
  }

  class MutationManager {
    constructor() {
      this.subscribers = new Set();
      this.observer = null;
      this.flushTimer = null;
      this.pending = [];
    }

    subscribe(callback) {
      this.subscribers.add(callback);
      this.start();
      return () => this.unsubscribe(callback);
    }

    unsubscribe(callback) {
      this.subscribers.delete(callback);
      if (!this.subscribers.size) this.stop();
    }

    start() {
      if (this.observer) return;
      const target = document.documentElement || document;

      this.observer = new MutationObserver((records) => {
        this.pending.push(...records);
        if (this.flushTimer) return;

        this.flushTimer = setTimeout(() => {
          const batch = this.pending.splice(0);
          this.flushTimer = null;
          for (const subscriber of this.subscribers) {
            try { subscriber(batch); } catch {}
          }
        }, 50);
      });

      this.observer.observe(target, { childList: true, subtree: true });
    }

    stop() {
      this.observer?.disconnect();
      this.observer = null;
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
      this.pending = [];
    }
  }

  const mutationManager = new MutationManager();

  class BaseFeature {
    constructor(id) {
      this.id = id;
      this.enabled = false;
      this.cleanups = [];
      this.config = null;
      this.lastConfig = '';
    }

    addCleanup(fn) {
      if (typeof fn === 'function') this.cleanups.push(fn);
    }

    cleanup() {
      for (const fn of this.cleanups.splice(0)) {
        try { fn(); } catch {}
      }
    }

    enable(config) {
      this.cleanup();
      this.enabled = true;
      this.config = config;
      this.lastConfig = JSON.stringify(config || {});
    }

    disable() {
      this.cleanup();
      this.enabled = false;
      this.config = null;
      this.lastConfig = '';
    }

    apply(config) {
      const next = JSON.stringify(config || {});
      if (!this.enabled) {
        this.enable(config);
      } else if (next !== this.lastConfig) {
        this.disable();
        this.enable(config);
      }
    }
  }

  // ─── Shield piercing on hover (shared by rightClick and dragDrop) ───
  // The drag/right-click target is fixed by the browser at mouse-down, so a transparent layer over an image
  // has to be switched off BEFORE the press: while the pointer hovers. One throttled listener serves every
  // feature that needs it.
  const ShieldHover = {
    users: new Set(),
    handler: null,
    timer: 0,
    last: 0,
    point: null,
    run() {
      this.timer = 0;
      this.last = performance.now();
      if (this.point) SelectraImage.neutralizeShieldsAt(this.point.x, this.point.y);
    },
    start(user) {
      this.users.add(user);
      if (this.handler) return;
      this.handler = (event) => {
        // only genuine hovering: a page can dispatch pointermove events itself, but never a trusted one
        if (!event.isTrusted || (event.pointerType && event.pointerType !== 'mouse') || event.buttons) return;
        this.point = { x: event.clientX, y: event.clientY };
        if (this.timer) return;
        this.timer = setTimeout(() => this.run(), Math.max(0, 80 - (performance.now() - this.last)));
      };
      window.addEventListener('pointermove', this.handler, { capture: true, passive: true });
    },
    stop(user) {
      this.users.delete(user);
      if (this.users.size || !this.handler) return;
      window.removeEventListener('pointermove', this.handler, { capture: true });
      this.handler = null;
      clearTimeout(this.timer);
      this.timer = 0;
      this.point = null;
      SelectraImage.restoreShields();
    }
  };

  // ─── 1. Right-Click Feature ───
  // A surface the page draws and drives itself with the right button (a canvas, an application region: a 3D camera, a map, a drawing
  // tool) keeps its mouse and pointer events. The browser menu still comes back on it: the contextmenu event is never held back.
  const isAppSurface = (event) => {
    try {
      const first = event.composedPath ? event.composedPath()[0] : event.target;
      return first instanceof Element && !!first.closest('canvas, [role="application"]');
    } catch {
      return false;
    }
  };

  class RightClickFeature extends BaseFeature {
    constructor() { super('rightClick'); }

    enable(config) {
      super.enable(config);

      const contextmenu = (event) => {
        event.stopImmediatePropagation();
      };
      const mousedown = (event) => {
        if (event.button === 2 && !isAppSurface(event)) event.stopImmediatePropagation();
      };

      // Hover arming covers ordinary shields; for the right button the stricter "not clickable" test can be
      // relaxed (a click-to-enlarge layer does not use the right button), but only for the press itself.
      const pierceForRightButton = (event) => {
        if (event.button !== 2) return;
        SelectraImage.neutralizeShieldsAt(event.clientX, event.clientY, { relaxed: true });
      };
      const releaseAfterMenu = (event) => {
        if (event.button === 2 || event.type === 'contextmenu') setTimeout(() => SelectraImage.restoreShields(), 400);
      };

      // Registered BEFORE the blockers below: those call stopImmediatePropagation(), which would hide the
      // event from anything registered after them on the same target.
      window.addEventListener('mousedown', pierceForRightButton, true);
      window.addEventListener('mouseup', releaseAfterMenu, true);
      window.addEventListener('contextmenu', releaseAfterMenu, true);
      window.addEventListener('contextmenu', contextmenu, true);
      window.addEventListener('mousedown', mousedown, true);
      ShieldHover.start('rightClick');
      this.addCleanup(() => {
        window.removeEventListener('contextmenu', contextmenu, true);
        window.removeEventListener('mousedown', mousedown, true);
        window.removeEventListener('mousedown', pierceForRightButton, true);
        window.removeEventListener('mouseup', releaseAfterMenu, true);
        window.removeEventListener('contextmenu', releaseAfterMenu, true);
        ShieldHover.stop('rightClick');
      });

      DOMUtils.removeBlockingInlineHandlers();
    }
  }

  // ─── 2. Copy & Selection Feature ───
  class CopyFeature extends BaseFeature {
    constructor() { super('copy'); }

    enable(config) {
      super.enable(config);

      DOMUtils.injectStyle('su-copy-style', `
        html, body, *, *::before, *::after {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
          -webkit-touch-callout: default !important;
        }
        [unselectable="on"], .unselectable, html.unselectable, body.unselectable {
          user-select: text !important;
          -webkit-user-select: text !important;
        }
      `);
      this.addCleanup(() => DOMUtils.removeStyle('su-copy-style'));

      const copyCut = (event) => {
        if (!DOMUtils.isEditable(event.target)) event.stopImmediatePropagation();
      };
      const selectstart = (event) => {
        if (!DOMUtils.isEditable(event.target)) event.stopImmediatePropagation();
      };

      window.addEventListener('copy', copyCut, true);
      window.addEventListener('cut', copyCut, true);
      window.addEventListener('selectstart', selectstart, true);
      this.addCleanup(() => {
        window.removeEventListener('copy', copyCut, true);
        window.removeEventListener('cut', copyCut, true);
        window.removeEventListener('selectstart', selectstart, true);
      });

      // A page can make a selection invisible ("::selection { background: transparent }"): the text is selected and
      // copies fine, but the user cannot see it and thinks nothing happened. Only a transparent highlight is replaced;
      // a page's own coloured selection is left alone.
      const ensureVisibleSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return;
        const node = selection.anchorNode;
        const element = node instanceof Element ? node : node?.parentElement;
        if (!element) return;
        let background = '';
        try { background = getComputedStyle(element, '::selection').backgroundColor; } catch { return; }
        if (background === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(background)) {
          DOMUtils.injectStyle('su-selection-style', 'html ::selection, html *::selection { background-color: Highlight !important; color: HighlightText !important; text-shadow: none !important; }');
        }
      };
      document.addEventListener('selectionchange', ensureVisibleSelection);
      this.addCleanup(() => {
        document.removeEventListener('selectionchange', ensureVisibleSelection);
        DOMUtils.removeStyle('su-selection-style');
      });

      DOMUtils.removeBlockingInlineHandlers();

      const mutationHandler = (records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) {
              DOMUtils.removeBlockingInlineHandlers(node);
            }
          }
        }
      };
      const unsub = mutationManager.subscribe(mutationHandler);
      this.addCleanup(unsub);
    }
  }

  // ─── 3. Visual Clarity & Anti-Blur Feature ───
  // ─── What blurs, masks or hides text (computed style only) ───
  // Class names prove nothing: a page blurs "#article", ".premium-body" or ".locked", with !important, and an app calls its own decoration
  // "blur-bg" or "blur-3xl". So the computed style decides, one element at a time:
  //  - TEXT under a blur (the element holds readable text and a blur(2px or more) is on it),
  //  - a blurring VEIL laid over the page (a large, shown, positioned layer with a backdrop-filter),
  //  - a fade-out MASK over a long text,
  //  - invisible INK (transparent colour with a text-shadow standing in for it).
  // A decorative blur holds no text, a hidden scrim is not shown, and gradient text has a background-clip: all left alone.
  const BLUR_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'IFRAME', 'LINK', 'META', 'HEAD', 'TITLE', 'SVG']);
  const isTransparentColor = (color) => !color || color === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(color);
  const ownTextLength = (el) => { let n = 0; for (const child of el.childNodes) if (child.nodeType === 3) n += child.nodeValue.trim().length; return n; };
  const textLength = (el) => (el.textContent || '').trim().length;
  const isShownStyle = (cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;

  // What would have to change on `el` for its text to be readable: [[property, value], ...] (empty when nothing hides it).
  function blurFixes(el) {
    const fixes = [];
    if (!(el instanceof HTMLElement) || BLUR_SKIP_TAGS.has(el.tagName)) return fixes;
    let cs;
    try { cs = getComputedStyle(el); } catch { return fixes; }

    const blur = /blur\(\s*([\d.]+)px/.exec(cs.filter || '');
    if (blur && parseFloat(blur[1]) >= 2 && (textLength(el) >= 40 || ownTextLength(el) >= 10)) {
      fixes.push(['filter', 'none']);
    }

    const backdrop = cs.backdropFilter || cs.webkitBackdropFilter || '';
    if (/blur\(/.test(backdrop) && isShownStyle(cs) && (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky')) {
      const r = el.getBoundingClientRect();
      if (r.width >= 0.6 * innerWidth && r.height >= 0.5 * innerHeight) {
        fixes.push(['backdrop-filter', 'none']);
      }
    }

    const mask = cs.maskImage || cs.webkitMaskImage || '';
    if (/gradient\(/.test(mask) && textLength(el) >= 200) {
      fixes.push(['mask-image', 'none']);
    }

    const hiddenInk = isTransparentColor(cs.color) || isTransparentColor(cs.webkitTextFillColor);
    const clipsToText = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text'; // gradient text is transparent on purpose
    if (hiddenInk && !clipsToText && cs.textShadow && cs.textShadow !== 'none' && ownTextLength(el) >= 20) {
      const shadow = /(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i.exec(cs.textShadow); // the shadow's colour is the real text colour
      if (shadow) {
        fixes.push(['color', shadow[1]], ['-webkit-text-fill-color', 'currentcolor'], ['text-shadow', 'none']);
      }
    }
    return fixes;
  }

  class AntiBlurFeature extends BaseFeature {
    constructor() { super('antiBlur'); }

    enable(config) {
      super.enable(config);

      // Nothing here is decided by a class name or a site: a class name proves nothing, and matching on names (`[class*="blur"]`,
      // "restricted", "gradient-overlay") with opacity:1 / visibility:visible / filter:none broke every app that merely USES such a name:
      // Gemini's hidden `.blur-bg` scrim became a dark box over the page, every Tailwind `blur-3xl` glow lost its blur, and image captions lost
      // the gradient that keeps them readable. What the page really paints decides (repair(), below), and the feature changes nothing else.

      // Everything changed below is remembered so that switching the feature off puts the page back as it was.
      const touched = new Map(); // element -> { hadStyleAttribute, props: Map(property -> { value, priority } it had before) }
      const setImportant = (el, property, value) => {
        let entry = touched.get(el);
        if (!entry) { entry = { hadStyleAttribute: el.hasAttribute('style'), props: new Map() }; touched.set(el, entry); }
        if (!entry.props.has(property)) {
          entry.props.set(property, { value: el.style.getPropertyValue(property), priority: el.style.getPropertyPriority(property) });
          BarrierScanner.recordEvidence({ type: 'blur', subtype: property, source: 'anti-blur', selector: BarrierScanner.getStableSelector(el), text: '', details: {} });
        }
        el.style.setProperty(property, value, 'important'); // an inline !important beats a stylesheet's !important
      };
      this.addCleanup(() => {
        for (const [el, entry] of touched) {
          for (const [property, original] of [...entry.props].reverse()) { // the first thing saved is the true original
            try {
              if (original.value) el.style.setProperty(property, original.value, original.priority);
              else el.style.removeProperty(property);
            } catch {}
          }
          try { if (!entry.hadStyleAttribute && !el.getAttribute('style')) el.removeAttribute('style'); } catch {} // no empty style="" left behind
        }
        touched.clear();
      });

      const repair = (el) => {
        for (const [property, value] of blurFixes(el)) setImportant(el, property, value);
      };

      // A node that was just added (a veil is created already carrying its inline style) is repaired at once, together with
      // the few descendants that carry an inline filter or mask; everything else is found by the sweeps below.
      const INLINE_SELECTOR = '[style*="filter"], [style*="mask"]';
      const repairAdded = (node) => {
        try {
          repair(node);
          if (node.querySelectorAll) node.querySelectorAll(INLINE_SELECTOR).forEach(repair);
        } catch {}
      };

      const unblurText = () => {
        let budget = 6000; // a huge page must not make a sweep expensive
        const visit = (root) => {
          for (const el of root.querySelectorAll('*')) {
            if (--budget < 0) return;
            repair(el);
          }
        };
        if (document.body) visit(document.body);
        for (const shadow of knownShadowRoots) { // text blurred inside a web component
          if (budget < 0) break;
          visit(shadow);
        }
      };

      let sweepTimer = 0;
      let lastSweep = 0;
      let lastCost = 0;
      const scheduleSweep = (delay = 300) => {
        if (sweepTimer) return;
        // at most about one sweep a second, and fewer on a page where a sweep is costly (a long chat, a huge table)
        const wait = Math.max(delay, Math.max(900, lastCost * 30) - (performance.now() - lastSweep));
        sweepTimer = setTimeout(() => {
          sweepTimer = 0;
          const started = performance.now();
          lastSweep = started;
          unblurText();
          lastCost = performance.now() - started;
        }, wait);
      };
      const timers = [0, 800, 2500, 6000].map(ms => setTimeout(() => scheduleSweep(0), ms)); // a blur often arrives a moment after load
      const onScroll = () => scheduleSweep(200);
      const onLoad = () => scheduleSweep(0);
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
      window.addEventListener('load', onLoad);
      let attributeObserver = null;
      try { // a class or style written onto an EXISTING node later (the usual way a blur is switched on)
        attributeObserver = new MutationObserver(() => scheduleSweep(300));
        attributeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'], subtree: true });
      } catch {}
      this.addCleanup(() => {
        timers.forEach(clearTimeout);
        clearTimeout(sweepTimer);
        sweepTimer = 0;
        window.removeEventListener('scroll', onScroll, { capture: true });
        window.removeEventListener('load', onLoad);
        attributeObserver?.disconnect();
      });

      if (document.documentElement) repairAdded(document.documentElement);
      const unsub = mutationManager.subscribe((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) repairAdded(node);
          }
        }
        scheduleSweep(300);
      });
      this.addCleanup(unsub);
    }
  }

  // ─── 4. Live Page Editor Feature ───
  class EditFeature extends BaseFeature {
    constructor() {
      super('edit');
      this.original = null;
    }

    enable(config) {
      super.enable(config);
      this.original = {
        designMode: document.designMode,
        htmlSpellcheck: document.documentElement?.getAttribute('spellcheck'),
        bodySpellcheck: document.body?.getAttribute('spellcheck')
      };

      document.designMode = 'on';
      document.documentElement?.setAttribute('spellcheck', 'false');
      document.body?.setAttribute('spellcheck', 'false');
      this.spellchecked = [];
      document.documentElement?.querySelectorAll?.('[spellcheck="true"]').forEach((el) => {
        this.spellchecked.push(new WeakRef(el));
        el.setAttribute('spellcheck', 'false');
      });
    }

    disable() {
      if (!this.enabled) return;
      const original = this.original;
      super.disable();

      if (original) {
        document.designMode = original.designMode || 'off';
        if (original.htmlSpellcheck == null) document.documentElement?.removeAttribute('spellcheck');
        else document.documentElement?.setAttribute('spellcheck', original.htmlSpellcheck);
        if (document.body) {
          if (original.bodySpellcheck == null) document.body.removeAttribute('spellcheck');
          else document.body.setAttribute('spellcheck', original.bodySpellcheck);
        }
      } else {
        document.designMode = 'off';
      }
      for (const ref of this.spellchecked || []) { try { ref.deref()?.setAttribute('spellcheck', 'true'); } catch {} }
      this.spellchecked = [];
      this.original = null;
    }
  }

  // ─── 5. Alert & Overlay Suppressor Feature ───
  class AlertFeature extends BaseFeature {
    constructor() { super('alert'); }

    enable(config) {
      super.enable(config);

      // The message boxes and overlays of the known copy-protection plugins carry fixed ids and classes: a stylesheet hides them, and
      // switching the feature off brings them back. Nothing is deleted from the page.
      const KNOWN = [
        '#wpcp-error-message', '.msgmsg-box-wpcp', '.warning-wpcp',
        '#wccp_pro_notify_message', '#wccp_notify_message',
        '.wccp-notice', '.wccp_notify', '#wccpNotice',
        '.wp-content-copy-protector-overlay', '.content-protector-overlay',
        '.sccp_modal', '#sccp-dialog', '[class*="sccp-dialog"]', '[class*="sccp_modal"]',
        '.pcc-overlay', '#pcc_modal', '[class*="pcc-overlay"]', '[class*="pcc-modal"]',
        '#smart-content-protector', '[class*="smart-content-protector"]'
      ];
      DOMUtils.injectStyle('su-alert-style', `
        ${KNOWN.join(',\n        ')} {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `);
      this.addCleanup(() => DOMUtils.removeStyle('su-alert-style'));

      // Generic names ("copy-protect", "content-protect") are also used by ordinary page content (an <article class="content-protected">),
      // so such an element is only hidden when it LOOKS like a message layer: lifted out of the flow, and short.
      const GENERIC = '[class*="copy-protect"], [class*="content-protect"]';
      const hidden = new Map(); // element -> the inline display it had before
      const looksLikeMessageLayer = (el) => {
        if (!(el instanceof HTMLElement) || el.matches('html, body, main, article')) return false;
        let cs;
        try { cs = getComputedStyle(el); } catch { return false; }
        if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
        if ((el.textContent || '').trim().length > 400) return false;
        return !el.querySelector('article, main');
      };
      const hide = (el, source) => {
        if (hidden.has(el) || !looksLikeMessageLayer(el)) return;
        BarrierScanner.scanNode(el, source);
        hidden.set(el, { value: el.style.getPropertyValue('display'), priority: el.style.getPropertyPriority('display') });
        el.style.setProperty('display', 'none', 'important');
      };
      const sweep = (root, source) => {
        try {
          if (root.matches && root.matches(GENERIC)) hide(root, source);
          root.querySelectorAll(GENERIC).forEach(el => hide(el, source));
        } catch {}
      };
      const note = (root, source) => { // the known layers stay in the page but are recorded as evidence of the protection
        try {
          if (root.matches && root.matches(KNOWN.join(','))) BarrierScanner.scanNode(root, source);
          root.querySelectorAll(KNOWN.join(',')).forEach(el => BarrierScanner.scanNode(el, source));
        } catch {}
      };

      note(document, 'initial-scan');
      sweep(document, 'initial-scan');
      const unsub = mutationManager.subscribe((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            note(node, 'alert-suppression');
            sweep(node, 'alert-suppression');
          }
        }
      });
      this.addCleanup(unsub);
      this.addCleanup(() => {
        for (const [el, before] of hidden) {
          try {
            if (before.value) el.style.setProperty('display', before.value, before.priority);
            else el.style.removeProperty('display');
          } catch {}
        }
        hidden.clear();
      });
    }
  }

  // ─── 6. Keyboard Shortcuts Feature ───
  // Editors and drawing tools own their shortcuts (Ctrl+S, Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+P ...): inside them only the shortcuts that open the
  // developer tools or the page source are brought back; everything else is left to the application.
  const EDITOR_SURFACE = '[role="textbox"], [role="application"], canvas, .monaco-editor, .cm-editor, .CodeMirror, .ProseMirror, .ql-editor';
  const onEditorSurface = (event) => {
    try {
      const first = event.composedPath ? event.composedPath()[0] : event.target;
      return first instanceof Element && !!first.closest(EDITOR_SURFACE);
    } catch {
      return false;
    }
  };

  class KeyboardFeature extends BaseFeature {
    constructor() { super('keyboard'); }

    enable(config) {
      super.enable(config);

      const handler = (event) => {
        if (DOMUtils.isEditable(event.target)) return;

        const key = String(event.key || '').toLowerCase();
        const ctrl = event.ctrlKey || event.metaKey;

        const devTools = key === 'f12' || (ctrl && event.shiftKey && ['i', 'j', 'c', 'k', 'e'].includes(key));
        const viewSource = ctrl && key === 'u';
        const savePage = ctrl && key === 's';
        const printPage = ctrl && key === 'p';
        const reloadPage = key === 'f5' || (ctrl && key === 'r');
        const copyKeys = ctrl && ['c', 'a', 'x', 'v'].includes(key);

        const appShortcut = savePage || printPage || reloadPage || copyKeys;
        if (devTools || viewSource || (appShortcut && !onEditorSurface(event))) {
          event.stopImmediatePropagation();
        }
      };

      window.addEventListener('keydown', handler, true);
      window.addEventListener('keyup', handler, true);
      window.addEventListener('keypress', handler, true);
      this.addCleanup(() => {
        window.removeEventListener('keydown', handler, true);
        window.removeEventListener('keyup', handler, true);
        window.removeEventListener('keypress', handler, true);
      });
    }
  }

  // ─── 7. Names for saved pictures ───
  const ImageNaming = {
    extension(url) {
      try {
        const match = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
        const ext = match?.[1]?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext) ? ext : 'jpg';
      } catch {
        return 'jpg';
      }
    },

    // A readable name: the picture's alt text, title or label, else the page title. The extension comes from the URL unless one is given.
    filename(img, url, forcedExt = '') {
      const ext = forcedExt || this.extension(url || img?.currentSrc || img?.src || '');
      const rawTitle =
        img?.getAttribute?.('alt') ||
        img?.getAttribute?.('title') ||
        img?.getAttribute?.('aria-label') ||
        document.title ||
        'image';
      return DOMUtils.sanitizeFilename(rawTitle, ext);
    }
  };

  // ─── 8. Drag & Drop Feature ───
  // Only pictures are touched: an <img> is made draggable again (a page can switch dragging off with an attribute, with CSS or by cancelling
  // dragstart), and a transparent layer laid over it is moved aside while the pointer hovers (ShieldHover). Drop zones, kanban boards, maps and
  // every other use of drag and drop are left alone: dragover, dragenter and drop are never touched, and neither is what a drag carries.
  class DragDropFeature extends BaseFeature {
    constructor() {
      super('dragDrop');
      this.touched = new Map(); // element -> what it had before
    }

    remember(el) {
      if (this.touched.has(el)) return;
      this.touched.set(el, { draggable: el.getAttribute('draggable'), drag: el.style.getPropertyValue('-webkit-user-drag') });
    }

    enable(config) {
      super.enable(config);

      DOMUtils.injectStyle('su-dragdrop-style', `
        img, picture img {
          -webkit-user-drag: element !important;
          user-drag: element !important;
        }
      `);
      this.addCleanup(() => DOMUtils.removeStyle('su-dragdrop-style'));

      const pointerDown = (event) => {
        const first = event.composedPath ? event.composedPath()[0] : event.target;
        if (!(first instanceof HTMLImageElement)) return;
        this.remember(first);
        first.setAttribute('draggable', 'true');
        first.style.webkitUserDrag = 'element';
        first.style.userDrag = 'element';
        // inside a link the browser would drag the link instead of the picture
        const clickable = first.closest('a[href], [role="link"], button');
        if (clickable && clickable !== first) {
          this.remember(clickable);
          clickable.setAttribute('draggable', 'false');
          clickable.style.webkitUserDrag = 'none';
          clickable.style.userDrag = 'none';
        }
      };

      window.addEventListener('pointerdown', pointerDown, true);
      window.addEventListener('mousedown', pointerDown, true);
      ShieldHover.start('dragDrop');
      this.addCleanup(() => {
        window.removeEventListener('pointerdown', pointerDown, true);
        window.removeEventListener('mousedown', pointerDown, true);
        ShieldHover.stop('dragDrop');
        for (const [el, before] of this.touched) {
          try {
            if (before.draggable === null) el.removeAttribute('draggable');
            else el.setAttribute('draggable', before.draggable);
            if (before.drag) el.style.setProperty('-webkit-user-drag', before.drag);
            else { el.style.removeProperty('-webkit-user-drag'); el.style.removeProperty('user-drag'); }
            if (!el.getAttribute('style')) el.removeAttribute('style');
          } catch {}
        }
        this.touched.clear();
      });
    }
  }

  // ─── Saving the picture at a point (Alt+Click and the "Download image" context-menu entries) ───
  const IMAGE_EXTENSION_OF_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' };
  const MAX_PIXELS_TO_COPY = 40e6; // a 40-megapixel canvas is a lot of memory for a fallback

  const ImageDownload = {
    /** Ask the service worker to save the first candidate that works; say so when one did, and when none did. */
    send(urls, filename, temporary = []) {
      const release = () => { for (const url of temporary) { try { URL.revokeObjectURL(url); } catch {} } };
      chrome.runtime.sendMessage({ action: 'downloadImage', urls, filename }).then(
        (reply) => {
          release();
          if (!reply) return;
          if (reply.success === false) DOMUtils.showToast(T('failed'));
          else if (reply.success === true && !reply.pending) DOMUtils.showToast(T('downloaded'));
        },
        () => { release(); DOMUtils.showToast(T('failed')); }
      );
    },

    /** The MIME type of a blob: URL that is still alive, or null. (Fetching it works whatever the page's CSP says, and it is the page's own data.) */
    async blobType(url) {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return blob.type === '' || /^image\//i.test(blob.type) ? blob.type : null; // a blob that is not a picture is not ours to save
      } catch {
        return null;
      }
    },

    // The picture an <img> shows, as a blob: URL of a PNG made here (a data: URL of a real photo is far beyond what a URL may hold).
    // Null when the browser forbids reading it (a cross-origin image) or it is huge.
    async pixelsOf(img) {
      try {
        if (!img.complete || !img.naturalWidth || img.naturalWidth * img.naturalHeight > MAX_PIXELS_TO_COPY) return null;
        const canvas = docCreateElement.call(document, 'canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        return blob ? URL.createObjectURL(blob) : null;
      } catch {
        return null;
      }
    },

    /**
     * A blob: URL only works while the page keeps it alive (many apps revoke it as soon as the picture has loaded), and the file
     * name needs its type. A live one is saved as it is (the original bytes, the original format); a dead one is replaced by the
     * pixels of the <img> that is showing it.
     */
    async localSources(urls, stack) {
      const img = stack.find(el => el instanceof HTMLImageElement);
      const out = [];
      const temporary = []; // blob: URLs made here for this one download
      let ext = '';
      for (const url of urls) {
        if (!url.startsWith('blob:')) { out.push(url); continue; }
        const type = await this.blobType(url);
        if (type !== null) {
          out.push(url);
          ext = ext || IMAGE_EXTENSION_OF_MIME[type.toLowerCase()] || '';
        } else {
          const pixels = img && img.currentSrc === url ? await this.pixelsOf(img) : null;
          if (pixels) { out.push(pixels); temporary.push(pixels); }
        }
      }
      return { urls: out, ext, temporary };
    },

    /**
     * Find the best picture at `point` ({x, y}, or null when only `srcUrl` is known) and have it saved. `target` is the element the
     * pointer was pressed on, `srcUrl` what the browser itself named (the last resort). Resolves to false when there was nothing to save.
     */
    async fromPoint(point, target, { srcUrl = '', stack = null } = {}) {
      const at = point || { x: -1, y: -1 };
      const layers = stack || [target, ...SelectraImage.elementStackAt(at.x, at.y).filter(el => el !== target)].filter(Boolean);
      let urls = [];
      try { urls = (await SelectraImage.resolveAt(at.x, at.y, { verify: true, target })).urls; } catch {}
      if (srcUrl && !urls.includes(srcUrl) && /^(?:https?:|blob:|data:image\/)/i.test(srcUrl)) urls.push(srcUrl);

      const local = await this.localSources(urls, layers);
      urls = local.urls.slice(0, 6);
      if (!urls.length) return false;

      const primary = layers.find(el => SelectraImage.isImageLike(el));
      const filename = ImageNaming.filename(primary instanceof HTMLImageElement ? primary : null, urls[0], local.ext);
      this.send(urls, filename, local.temporary);
      return true;
    }
  };

  // ─── The extension's own context-menu entries ───
  // What the browser says about a right click (srcUrl) exists only when the pointer is on an <img>. The entries need more: a picture
  // behind a transparent layer, a CSS background, a canvas. So every real right click records where it happened, and while the pointer
  // moves the service worker is told whether a picture is under it, which decides whether the second "Download image" entry is
  // offered (IMAGE_UNDER_ID in background.js). Only a yes/no ever leaves this page, and only when it changes.
  const MenuContext = {
    x: 0, y: 0, target: null, at: -Infinity,
    reported: false, reportedAt: 0, timer: 0, offTimer: 0, point: null,

    pictureAt(x, y, target) {
      try {
        return [target, ...SelectraImage.elementStackAt(x, y)].filter(Boolean).some(el => SelectraImage.isImageLike(el));
      } catch {
        return false;
      }
    },

    report(has, force = false) {
      const now = performance.now();
      if (!force && has === this.reported && !(has && now - this.reportedAt > 4000)) return; // changes only; a "yes" is repeated now and then
      this.reported = has;
      this.reportedAt = now;
      try { chrome.runtime.sendMessage({ action: 'imageUnderPointer', has }).catch(() => {}); } catch {} // a script left over from an update throws here
    },

    pressed(event) {
      if (!event.isTrusted) return;
      const target = (event.composedPath ? event.composedPath()[0] : event.target);
      this.x = event.clientX;
      this.y = event.clientY;
      this.target = target instanceof Element ? target : null;
      this.at = performance.now();
      this.report(this.pictureAt(this.x, this.y, this.target), true); // settled for this very click
    },

    moved(event) {
      if (!event.isTrusted || event.buttons || (event.pointerType && event.pointerType !== 'mouse')) return;
      this.point = { x: event.clientX, y: event.clientY, target: event.composedPath ? event.composedPath()[0] : event.target };
      // looked at once the pointer has rested for a moment (asking "what is under it" forces a layout, so not on every move)
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = 0;
        const p = this.point;
        if (!p) return;
        if (this.pictureAt(p.x, p.y, p.target instanceof Element ? p.target : null)) {
          clearTimeout(this.offTimer);
          this.offTimer = 0;
          this.report(true);
        } else if (this.reported && !this.offTimer) {
          // "no" is only said after the pointer has stayed off pictures for a moment: moving across a grid of them would otherwise flap
          this.offTimer = setTimeout(() => { this.offTimer = 0; this.report(false); }, 400);
        }
      }, 120);
    },

    left() {
      clearTimeout(this.offTimer);
      this.offTimer = 0;
      if (this.reported) this.report(false);
    },

    start() {
      window.addEventListener('mousedown', (e) => { if (e.button === 2) this.pressed(e); }, { capture: true, passive: true });
      window.addEventListener('contextmenu', (e) => this.pressed(e), { capture: true, passive: true });
      window.addEventListener('pointermove', (e) => this.moved(e), { capture: true, passive: true });
      document.documentElement?.addEventListener('mouseleave', () => this.left(), { passive: true });
    },

    /** The "Download image" entries. Resolves once the request is on its way (the outcome is shown as a toast). */
    async download(srcUrl) {
      const fresh = performance.now() - this.at < 60000; // the right click that opened this very menu
      const target = fresh && this.target && this.target.isConnected ? this.target : null;
      DOMUtils.showToast(T('downloading'));
      let sent = false;
      try {
        if (target || srcUrl) sent = await ImageDownload.fromPoint(target ? { x: this.x, y: this.y } : null, target, { srcUrl });
      } catch {}
      if (!sent) DOMUtils.showToast(T('noImage'));
    }
  };
  MenuContext.start();

  // ─── 9. Alt+Click Instant Download Feature ───
  class AltClickFeature extends BaseFeature {
    constructor() { super('altClick'); }

    enable(config) {
      super.enable(config);

      const clickHandler = (event) => {
        // A page can dispatch click events with altKey set; only a real click may reach the downloader.
        if (!event.isTrusted || !event.altKey) return;
        // the deepest element, also inside a shadow root (event.target is retargeted to the host there)
        const first = event.composedPath ? event.composedPath()[0] : null;
        const target = first instanceof Element ? first : (event.target instanceof Element ? event.target : null);
        if (!target) return;

        // Is there anything to download? Decided synchronously: only then may the click be taken over.
        const probe = [target, ...SelectraImage.elementStackAt(event.clientX, event.clientY).filter(el => el !== target)];
        if (!SelectraImage.collectCandidates(probe).length) {
          // A picture with nothing to save (a cross-origin canvas, a video without a poster) inside a link: Alt+Click on a link makes the
          // browser download the linked PAGE (an .html file). That click is taken over and the user is told instead.
          if (probe.some(el => SelectraImage.isImageLike(el)) && probe.some(el => el.closest && el.closest('a[href]'))) {
            event.preventDefault();
            event.stopPropagation();
            DOMUtils.showToast(T('noImage'));
          }
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        DOMUtils.showToast(T('downloading'));
        this.download(event.clientX, event.clientY, target, probe);
      };

      window.addEventListener('click', clickHandler, true);
      this.addCleanup(() => window.removeEventListener('click', clickHandler, true));
    }

    async download(x, y, target, probe) {
      const sent = await ImageDownload.fromPoint({ x, y }, target, { stack: probe });
      if (!sent) DOMUtils.showToast(T('failed'));
    }
  }

  // ─── 10. Print Feature ───
  // Makes a page print what is on screen when its print stylesheet or script switches the content off. Deliberately modest: what the page
  // hides on screen stays hidden, nothing is removed from the printout (no headers, navigation or adverts are dropped), and only the lock
  // itself is lifted.
  class PrintFeature extends BaseFeature {
    constructor() { super('print'); }

    enable(config) {
      super.enable(config);
      DOMUtils.injectStyle('su-print-style', `
        @media print {
          html, body {
            display: block !important;
            visibility: visible !important;
            overflow: visible !important;
            height: auto !important;
          }
          [data-su-print] {
            visibility: visible !important;
          }
        }
      `);
      this.addCleanup(() => DOMUtils.removeStyle('su-print-style'));

      // A print rule such as "* { visibility: hidden }" hides everything. Just before printing, what is visible on SCREEN is marked, and the
      // marked elements are shown again; menus, tooltips and the like that the page hides on screen stay hidden.
      const marked = [];
      const mark = () => {
        let budget = 8000;
        const visit = (root) => {
          for (const el of root.querySelectorAll('*')) {
            if (--budget < 0) return;
            try {
              const cs = getComputedStyle(el);
              if (cs.visibility === 'visible' && cs.display !== 'none') { el.setAttribute('data-su-print', ''); marked.push(el); }
            } catch {}
          }
        };
        if (document.body) visit(document.body);
        for (const shadow of knownShadowRoots) { if (budget > 0) visit(shadow); }
      };
      const unmark = () => { for (const el of marked.splice(0)) { try { el.removeAttribute('data-su-print'); } catch {} } };
      window.addEventListener('beforeprint', mark);
      window.addEventListener('afterprint', unmark);
      this.addCleanup(() => {
        window.removeEventListener('beforeprint', mark);
        window.removeEventListener('afterprint', unmark);
        unmark();
      });
    }
  }

  // ─── 11. Smart Scrollbar & Modal Unlocker Feature ───
  class ScrollbarFeature extends BaseFeature {
    constructor() {
      super('scrollbar');
      this.checkTimer = null;
      this.observer = null;
      this.bodyObserved = false;
    }

    enable(config) {
      super.enable(config);

      DOMUtils.injectStyle('su-scrollbar-style', `
        html.su-scroll-unlocked,
        body.su-scroll-unlocked {
          overflow-y: auto !important;
          scrollbar-width: auto !important;
          -ms-overflow-style: auto !important;
          max-height: none !important;
        }
        html.su-scroll-unlocked-height,
        body.su-scroll-unlocked-height {
          height: auto !important;
          min-height: 100% !important;
        }
        body.su-scroll-fixed-restored {
          position: static !important;
          top: auto !important;
          width: auto !important;
        }
        .su-container-unlocked {
          overflow-y: auto !important;
          max-height: none !important;
        }
        html.su-scrollbar-visible::-webkit-scrollbar,
        body.su-scrollbar-visible::-webkit-scrollbar,
        .su-container-unlocked::-webkit-scrollbar {
          display: block !important;
          width: 10px !important;
          height: 10px !important;
        }
        html.su-scrollbar-visible::-webkit-scrollbar-thumb,
        body.su-scrollbar-visible::-webkit-scrollbar-thumb,
        .su-container-unlocked::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.45) !important;
          border-radius: 9999px !important;
        }
        html.su-scrollbar-visible::-webkit-scrollbar-track,
        body.su-scrollbar-visible::-webkit-scrollbar-track,
        .su-container-unlocked::-webkit-scrollbar-track {
          background: transparent !important;
        }
      `);
      this.addCleanup(() => DOMUtils.removeStyle('su-scrollbar-style'));

      const scheduleCheck = () => {
        clearTimeout(this.checkTimer);
        this.checkTimer = setTimeout(() => this.check(), 40);
      };
      this.addCleanup(() => clearTimeout(this.checkTimer));

      // Layout changes that touch no attribute: stylesheets finishing, viewport resize, bfcache restore.
      const windowTriggers = ['resize', 'pageshow', 'popstate', 'load'];
      for (const type of windowTriggers) window.addEventListener(type, scheduleCheck, { passive: true });
      document.addEventListener('DOMContentLoaded', scheduleCheck, { passive: true });
      this.addCleanup(() => {
        for (const type of windowTriggers) window.removeEventListener(type, scheduleCheck);
        document.removeEventListener('DOMContentLoaded', scheduleCheck);
      });

      // Page changes only. Our own su-* class toggles also fire this observer; they are recognised by
      // comparing the class list with the su-* tokens removed, so check() cannot re-trigger itself.
      const stripOwn = (value) => (value || '').split(/\s+/).filter(c => c && !c.startsWith('su-')).join(' ');
      const attrOptions = { attributes: true, attributeFilter: ['style', 'class'], attributeOldValue: true };

      const observeBody = () => {
        if (this.bodyObserved || !document.body || !this.observer) return;
        this.bodyObserved = true;
        this.observer.observe(document.body, attrOptions);
      };

      const html = document.documentElement;
      if (html) {
        this.observer = new MutationObserver((records) => {
          let relevant = false;
          for (const record of records) {
            if (record.type === 'childList') {
              observeBody(); // <body> is created after document_start on pages with a slow <head>
              relevant = true;
            } else if (record.attributeName === 'class') {
              if (stripOwn(record.oldValue) !== stripOwn(record.target.getAttribute('class'))) relevant = true;
            } else {
              relevant = true;
            }
          }
          if (relevant) scheduleCheck();
        });
        this.observer.observe(html, { ...attrOptions, childList: true });
        observeBody();
        this.addCleanup(() => {
          this.observer?.disconnect();
          this.observer = null;
          this.bodyObserved = false;
        });
      }

      scheduleCheck();
      // A page's layout keeps settling after load (splash screens, app shells measuring themselves) without touching an attribute of <html> or
      // <body>, so nothing above would ever look again: a lock seen while the page was loading stayed "unlocked" for good (an app such as Gmail
      // then scrolled past its own layout). A few later looks undo what no longer holds.
      const laterChecks = [600, 2000, 5000].map(ms => setTimeout(scheduleCheck, ms));
      this.addCleanup(() => laterChecks.forEach(clearTimeout));

      this.addCleanup(() => {
        document.documentElement?.classList.remove('su-scroll-unlocked', 'su-scroll-unlocked-height', 'su-scrollbar-visible');
        document.body?.classList.remove('su-scroll-unlocked', 'su-scroll-unlocked-height', 'su-scrollbar-visible', 'su-scroll-fixed-restored');
        document.querySelectorAll('.su-container-unlocked').forEach(el => el.classList.remove('su-container-unlocked'));
      });
    }

    check() {
      if (!this.enabled) return;
      const html = document.documentElement;
      const body = document.body;
      if (!html || !body) return;

      // Measure the page as the PAGE styled it. The override classes change the very values read below
      // (overflow, height, position): measuring with them applied makes the lock look gone, the classes get
      // removed, the lock comes back, and the page flickers between both states forever.
      const OVERRIDES = ['su-scroll-unlocked', 'su-scroll-unlocked-height', 'su-scroll-fixed-restored'];
      const hadOnHtml = OVERRIDES.filter(c => html.classList.contains(c));
      const hadOnBody = OVERRIDES.filter(c => body.classList.contains(c));
      html.classList.remove(...OVERRIDES);
      body.classList.remove(...OVERRIDES);

      let blocked, isHeightClamped, hasScrollablePage, bodyFixed, savedTop;
      try {
        const htmlStyle = getComputedStyle(html);
        const bodyStyle = getComputedStyle(body);

        const viewportHeight = window.innerHeight || html.clientHeight;
        let realHeight = Math.max(html.scrollHeight, body.scrollHeight);

        // Detect clamped height: body children overflowing the viewport
        if (body.children && body.children.length > 0) {
          for (let i = 0; i < Math.min(body.children.length, 30); i++) {
            const child = body.children[i];
            if (child instanceof Element && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
              const bottom = child.offsetTop + (child.offsetHeight || 0);
              if (bottom > realHeight) realHeight = bottom;
            }
          }
        }

        hasScrollablePage = realHeight > viewportHeight + 15;
        const htmlOverflowHidden = htmlStyle.overflowY === 'hidden' || htmlStyle.overflowY === 'clip';
        const bodyOverflowHidden = bodyStyle.overflowY === 'hidden' || bodyStyle.overflowY === 'clip';
        bodyFixed = bodyStyle.position === 'fixed';
        // Computed height is never the string '100%', so clamping is measured: the body box is no taller than
        // the viewport while its content is.
        isHeightClamped = (htmlOverflowHidden || bodyOverflowHidden) &&
          body.scrollHeight > body.clientHeight + 15 && body.clientHeight <= viewportHeight + 1;

        blocked = hasScrollablePage && (htmlOverflowHidden || bodyOverflowHidden || bodyFixed);
        savedTop = body.style.top || bodyStyle.top || '';
      } catch {
        html.classList.add(...hadOnHtml);
        body.classList.add(...hadOnBody);
        return;
      }

      // Handle mobile/modal freeze: body { position: fixed; top: -...px }
      if (bodyFixed && blocked) {
        const parsedTop = parseInt(savedTop, 10);
        body.classList.add('su-scroll-fixed-restored');
        if (!isNaN(parsedTop) && parsedTop < 0) {
          const scrollY = Math.abs(parsedTop);
          body.style.top = '';
          window.scrollTo(0, scrollY);
        }
      }

      html.classList.toggle('su-scroll-unlocked', blocked);
      body.classList.toggle('su-scroll-unlocked', blocked);
      html.classList.toggle('su-scroll-unlocked-height', blocked && isHeightClamped);
      body.classList.toggle('su-scroll-unlocked-height', blocked && isHeightClamped);

      // Force WebKit scrollbars visible on any scrollable page
      html.classList.toggle('su-scrollbar-visible', hasScrollablePage);
      body.classList.toggle('su-scrollbar-visible', hasScrollablePage);

      // Common SPA wrapper containers. Measured as the PAGE styled them (our class off) and decided again at every look: a container the page
      // has since unlocked itself, or one that only overflowed while it was loading, must not stay forced open.
      try {
        document.querySelectorAll('.su-container-unlocked').forEach(el => el.classList.remove('su-container-unlocked'));
        const containers = document.querySelectorAll('#root, #__next, #app, main, [class*="app-container"], [class*="page-container"]');
        for (const container of containers) {
          if (container instanceof HTMLElement) {
            const cStyle = getComputedStyle(container);
            if ((cStyle.overflowY === 'hidden' || cStyle.overflowY === 'clip') && container.scrollHeight > container.clientHeight + 20) {
              container.classList.add('su-container-unlocked');
            }
          }
        }
      } catch {}
    }
  }

  // ─── Feature Manager ───
  class FeatureManager {
    constructor() {
      this.features = {
        rightClick: new RightClickFeature(),
        copy: new CopyFeature(),
        clipboard: new BaseFeature('clipboard'), // Handled in MAIN world
        edit: new EditFeature(),
        alert: new AlertFeature(),
        keyboard: new KeyboardFeature(),
        dragDrop: new DragDropFeature(),
        altClick: new AltClickFeature(),
        print: new PrintFeature(),
        scrollbar: new ScrollbarFeature(),
        antiBlur: new AntiBlurFeature()
      };
      this.config = emptySettings();
      this.foreign = false; // set for a frame of another site, see frameIsForeign()
    }

    setForeign(foreign) {
      this.foreign = foreign === true;
    }

    apply(raw) {
      const normalized = this.foreign ? withoutTopOnly(raw) : normalizeSettings(raw);
      this.config = normalized;

      for (const key of FEATURE_KEYS) {
        const feature = this.features[key];
        if (!feature) continue;
        const featureConfig = normalized.features[key];
        const enabled = featureConfig?.enabled === true;

        if (enabled) feature.apply(featureConfig);
        else if (feature.enabled) feature.disable();
      }

      // the observers that look at the page itself run only while something is switched on: with everything off the page is not watched at all
      const anyOn = FEATURE_KEYS.some((key) => normalized.features[key].enabled);
      BarrierScanner.setArmed(anyOn);
      ShadowWatch.set(anyOn);

      DOMUtils.dispatchMain('SET_STATE', {
        rightClick: normalized.features.rightClick?.enabled === true,
        copy: normalized.features.copy?.enabled === true,
        clipboard: normalized.features.clipboard?.enabled === true,
        edit: normalized.features.edit?.enabled === true,
        alert: normalized.features.alert?.enabled === true,
        dragDrop: normalized.features.dragDrop?.enabled === true,
        keyboard: normalized.features.keyboard?.enabled === true,
        antiDebugger: normalized.features.keyboard?.enabled === true,
        scrollbar: normalized.features.scrollbar?.enabled === true,
        print: normalized.features.print?.enabled === true,
        antiBlur: normalized.features.antiBlur?.enabled === true
      });
    }

    status() {
      const active = FEATURE_KEYS.filter(key => this.features[key]?.enabled);
      return {
        active: active.length > 0,
        count: active.length,
        features: active,
        diagnosis: BarrierScanner.scan()
      };
    }
  }

  const featureManager = new FeatureManager();
  BarrierScanner.init();

  // ─── Force Copy Execution ───
  /** Put text on the clipboard; resolves to whether it really got there (the old code announced "copied" whatever happened). */
  async function writeToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
    const selection = window.getSelection();
    const kept = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i)) : [];
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    } finally {
      if (selection) { // the textarea took over the page's selection: give it back
        selection.removeAllRanges();
        for (const range of kept) selection.addRange(range);
      }
    }
  }

  /** The selection of THIS frame; `fallbackText` is what the browser reported for the click, for a selection this script cannot read. */
  async function executeForceCopy(fallbackText = '') {
    const own = window.getSelection()?.toString() || '';
    const text = own.trim() ? own : String(fallbackText || '');
    if (!text.trim()) {
      DOMUtils.showToast(T('noSelection'));
      return;
    }
    DOMUtils.showToast(T((await writeToClipboard(text)) ? 'copied' : 'copyFailed'));
  }
  // ─── Large protected images ───
  // The service worker fetches an image the page itself cannot (it needs a Referer) and sends it over in pieces, because a data: URL cannot carry
  // more than about 1.4 MB. The blob is built HERE, in the frame that asked for the download: the page cannot name it (its URL is random and only
  // travels between the two scripts), and it is revoked as soon as the download is over.
  const BlobTransfer = {
    pending: new Map(), // transfer id -> { parts, next, mime, timer }
    made: new Set(),

    accept({ transfer, index, total, mime, data }) {
      try {
        if (typeof transfer !== 'string' || typeof data !== 'string' || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || total > 64) return { ok: false };
        let entry = this.pending.get(transfer);
        if (!entry) {
          if (index !== 0) return { ok: false };
          entry = { parts: [], next: 0, mime: String(mime || '').toLowerCase(), timer: setTimeout(() => this.pending.delete(transfer), 120000) };
          this.pending.set(transfer, entry);
        }
        if (index !== entry.next) { this.drop(transfer); return { ok: false }; }
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        entry.parts.push(bytes);
        entry.next++;
        if (entry.next < total) return { ok: true };
        this.drop(transfer);
        if (!Object.hasOwn(IMAGE_EXTENSION_OF_MIME, entry.mime)) return { ok: false }; // only pictures
        const url = URL.createObjectURL(new Blob(entry.parts, { type: entry.mime }));
        this.made.add(url);
        setTimeout(() => this.release(url), 300000);
        return { ok: true, url };
      } catch {
        this.drop(transfer);
        return { ok: false };
      }
    },

    drop(transfer) {
      const entry = this.pending.get(transfer);
      if (entry) clearTimeout(entry.timer);
      this.pending.delete(transfer);
    },

    release(url) {
      if (this.made.delete(url)) { try { URL.revokeObjectURL(url); } catch {} }
    }
  };

  // ─── Immediate Storage Read & Application ───
  // Hostname of the site this frame is embedded in. Same-origin parents can be read directly; for a
  // cross-origin parent the service worker knows it from the tab URL.
  async function resolveTopHostname() {
    if (window.top === window) return '';
    try {
      const direct = window.top.location.hostname;
      if (direct) return direct;
    } catch {}
    try {
      const reply = await chrome.runtime.sendMessage({ action: 'getTopHostname' });
      return reply?.hostname || '';
    } catch {
      return '';
    }
  }

  // A frame follows the settings of the TOP site, like the page around it. A frame of ANOTHER site (a payment form, a sign-in box, a captcha, an
  // ad) does not get the keys that change what the page does (edit, alert): what the user chose for the site they are on is not a choice
  // about the third parties embedded in it.
  function frameIsForeign(topHostname) {
    if (window.top === window) return false;
    if (!hostname) { // about:blank and srcdoc frames share their creator's origin, data: and sandboxed ones do not
      try { void window.top.location.href; return false; } catch { return true; }
    }
    return !topHostname || getBaseDomain(hostname) !== getBaseDomain(topHostname);
  }

  // Private windows: a site's settings live in memory only (a list of the sites someone visited privately must not end up on disk).
  const privateWindow = chrome.extension?.inIncognitoContext === true;
  const siteArea = privateWindow ? chrome.storage.session : chrome.storage.local;
  let settingsHost = hostname;

  async function loadAndApply() {
    try {
      const topHostname = await resolveTopHostname();
      settingsHost = topHostname || hostname; // a frame runs its TOP site's settings
      featureManager.setForeign(frameIsForeign(topHostname));

      const global = await chrome.storage.local.get([GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY]);
      const isGlobal = global[GLOBAL_MODE_KEY] === true;
      const key = siteKey(settingsHost);
      // Global mode: the global entry, everywhere. "This site": that exact host's own entry, nothing inherited.
      const data = isGlobal || !key ? global : await siteArea.get(key).catch(() => ({}));
      featureManager.apply(resolveSettings(data, settingsHost, isGlobal));
    } catch {
      featureManager.apply(null);
    }
  }

  loadAndApply();
  window.addEventListener('pageshow', (event) => { if (event.persisted) loadAndApply(); }); // out of the back/forward cache: what changed meanwhile is read again
  document.addEventListener('prerenderingchange', () => loadAndApply()); // a prerendered page that the user has just been taken to

  chrome.storage.onChanged.addListener((changes, areaName) => {
    const key = siteKey(settingsHost);
    const globalChanged = areaName === 'local' && (changes[GLOBAL_MODE_KEY] || changes[GLOBAL_SETTINGS_KEY]);
    const siteChanged = key && changes[key] && areaName === (privateWindow ? 'session' : 'local');
    if (globalChanged || siteChanged) loadAndApply();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === 'applySettings') {
      featureManager.apply(message.config);
      sendResponse({ success: true, ...featureManager.status() });
      return true;
    }

    if (message?.action === 'getStatus') {
      sendResponse(featureManager.status());
      return true;
    }

    // a frame of this tab asks which site the tab is on (only the top frame answers; the tab's own address can be another page's while one is prerendered)
    if (message?.action === 'getHostname') {
      if (window.top !== window) return undefined;
      sendResponse({ hostname: location.hostname });
      return true;
    }

    if (message?.action === 'getDiagnosis') {
      // `frame` says which frame answered: tabs.sendMessage without a frameId reaches every frame and the caller only
      // gets the first reply, so the popup asks the top frame (frameId 0) and can check that it did.
      sendResponse({ diagnosis: BarrierScanner.scan(), frame: { top: window.top === window, url: location.href } });
      return true;
    }

    if (message?.action === 'forceCopy') {
      executeForceCopy(message.text).then(() => sendResponse({ success: true }), () => sendResponse({ success: false }));
      return true;
    }

    // "Download image" from the context menu: this frame knows where the pointer was (MenuContext) and says how it went.
    if (message?.action === 'downloadContextImage') {
      MenuContext.download(String(message.srcUrl || '')).then(() => sendResponse({ handled: true }), () => sendResponse({ handled: false }));
      return true;
    }

    // a large protected image, in pieces, from the service worker (see BlobTransfer)
    if (message?.action === 'blobChunk') {
      sendResponse(BlobTransfer.accept(message));
      return false;
    }
    if (message?.action === 'blobRelease') {
      BlobTransfer.release(String(message.url || ''));
      sendResponse({ ok: true });
      return false;
    }

    return undefined;
  });
})();
