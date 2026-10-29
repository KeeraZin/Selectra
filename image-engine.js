// Selectra - site-independent image engine (content-script world, DOM-aware).
// Pure string heuristics live in image-rules.js; this file looks at the live page: what is under the
// pointer, which transparent "shield" layers sit over an image, and (later in this file) which image
// sources the stack offers.
(function () {
  'use strict';

  const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, video, audio, iframe, object, embed, ' +
    '[role="button"], [role="link"], [role="menuitem"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

  // Closed roots are only reachable through chrome.dom; open ones through .shadowRoot.
  function getShadowRoot(el) {
    try {
      return (chrome.dom && chrome.dom.openOrClosedShadowRoot && chrome.dom.openOrClosedShadowRoot(el)) || el.shadowRoot || null;
    } catch {
      return el.shadowRoot || null;
    }
  }

  /** Elements under (x, y), topmost first, descending into shadow roots. */
  function elementStackAt(x, y, limit = 12) {
    const out = [];
    const visit = (scope) => {
      let list = [];
      try { list = scope.elementsFromPoint(x, y); } catch { return; }
      for (const el of list) {
        if (out.length >= limit) return;
        if (out.includes(el)) continue;
        out.push(el);
        const root = getShadowRoot(el);
        if (root) visit(root);
      }
    };
    visit(document);
    return out;
  }

  function rectOf(el) {
    try { return el.getBoundingClientRect(); } catch { return null; }
  }

  function overlapRatio(a, b) {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w <= 0 || h <= 0) return 0;
    return (w * h) / Math.max(1, b.width * b.height);
  }

  function colorAlpha(css) {
    if (!css || css === 'transparent') return 0;
    const m = css.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return 1; // unknown colour function: assume it paints something
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 4) return 1;
    const alpha = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return Number.isNaN(alpha) ? 1 : alpha;
  }

  /** Something that paints a picture: <img>, <canvas>, <svg>, <video>, or an element with a (pseudo-)background image. */
  function isImageLike(el) {
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'PICTURE') return true;
    if (el instanceof SVGElement) return tag.toLowerCase() === 'svg' || tag.toLowerCase() === 'image';
    if (tag === 'HTML' || tag === 'BODY') return false;
    try {
      const picture = (value) => /url\(|image-set\(/i.test(value || ''); // a gradient is decoration, not a picture
      let paints = picture(getComputedStyle(el).backgroundImage);
      for (const pseudo of paints ? [] : ['::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.content !== 'none' && cs.content !== 'normal' && picture(cs.backgroundImage)) paints = true;
      }
      if (!paints) return false;
      const r = el.getBoundingClientRect();
      return r.width * r.height <= 0.8 * innerWidth * innerHeight; // a page-wide backdrop is not "the image"
    } catch {
      return false;
    }
  }

  /** Node.contains() that also crosses shadow boundaries (a shadow host "contains" what its root holds). */
  function containsComposed(ancestor, node) {
    for (let n = node; n; n = n.parentNode || (n instanceof ShadowRoot ? n.host : null)) {
      if (n === ancestor) return true;
    }
    return false;
  }

  /**
   * A shield is an element painted above an image that exists only to swallow the pointer: no controls
   * inside, no text, nothing visible of its own, and covering most of the image.
   */
  function isShield(el, imageLike, imageRect, relaxed) {
    // pointer-events is inherited, so switching off a host or container would switch off the image too
    if (containsComposed(el, imageLike) || containsComposed(imageLike, el)) return false;
    // An empty <a href> stretched over a thumbnail ("stretched link") makes the whole card clickable. Switching
    // it off while hovering would stop the card from navigating, so only the right-button press may do it.
    const emptyLink = relaxed && el.tagName === 'A' && el.hasAttribute('href');
    if (el.matches(INTERACTIVE) && !emptyLink) return false;
    try { if (el.querySelector(INTERACTIVE)) return false; } catch { return false; }
    if ((el.textContent || '').trim()) return false;
    const rect = rectOf(el);
    if (!rect || overlapRatio(rect, imageRect) < 0.6) return false;
    let cs;
    try { cs = getComputedStyle(el); } catch { return false; }
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    // a picture (url(), image-set()) is content; a gradient is only decoration (Pexels fades a hover gradient in over every card)
    if (/url\(|image-set\(/i.test(cs.backgroundImage || '')) return false;
    if (colorAlpha(cs.backgroundColor) > 0.1) return false;
    // A transparent layer with cursor:pointer is usually a click-to-enlarge target; only a right click
    // (which does not use it) may pierce those.
    if (!relaxed && cs.cursor === 'pointer') {
      // inside a link every descendant inherits the pointer cursor; only one the layer sets itself says "click me"
      let inherited = false;
      try { inherited = !!el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer'; } catch {}
      if (!inherited) return false;
    }
    return true;
  }

  // shield -> original inline pointer-events (value + priority), so restoring is exact
  const armed = new Map();

  function arm(el) {
    if (armed.has(el)) return;
    armed.set(el, { value: el.style.getPropertyValue('pointer-events'), priority: el.style.getPropertyPriority('pointer-events') });
    el.style.setProperty('pointer-events', 'none', 'important');
  }

  function restoreOne(el) {
    const original = armed.get(el);
    if (!original) return;
    armed.delete(el);
    try {
      if (original.value) el.style.setProperty('pointer-events', original.value, original.priority);
      else el.style.removeProperty('pointer-events');
      if (!el.getAttribute('style')) el.removeAttribute('style');
    } catch {}
  }

  function pointInside(el, x, y) {
    const r = rectOf(el);
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  /**
   * Make the image under (x, y) reachable by the pointer. Shields are switched to pointer-events:none;
   * elementsFromPoint stops listing an element once that is done, so shields armed earlier are kept while
   * the pointer is still inside them and restored once it has left.
   */
  function neutralizeShieldsAt(x, y, opts = {}) {
    for (const el of [...armed.keys()]) {
      if (!el.isConnected || !pointInside(el, x, y)) restoreOne(el);
    }

    const stack = elementStackAt(x, y);
    const at = stack.findIndex(isImageLike);
    let imageLike = at >= 0 ? stack[at] : null;
    if (imageLike) {
      const imageRect = rectOf(imageLike);
      if (imageRect && imageRect.width > 0 && imageRect.height > 0) {
        for (const el of stack.slice(0, at)) {
          if (isShield(el, imageLike, imageRect, !!opts.relaxed)) arm(el);
        }
      }
    }

    // after arming, the image itself may now be the top hit (or only now visible to the stack)
    if (!imageLike && armed.size) imageLike = (elementStackAt(x, y).find(isImageLike)) || null;
    return {
      image: imageLike && imageLike.tagName === 'IMG' ? imageLike : null,
      imageLike,
      shields: [...armed.keys()]
    };
  }

  function restoreShields(keep = []) {
    for (const el of [...armed.keys()]) {
      if (!keep.includes(el)) restoreOne(el);
    }
  }

  // ─── candidate collection ───
  const Rules = self.SelectraImageRules;

  // Attribute names that only ever hold an image source, and ones that might hold any URL (those must look like an image file).
  const LAZY_SOURCE_ATTRS = ['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-hi-res', 'data-hires', 'data-full-src', 'data-large-src', 'data-zoom-src', 'data-fallback-src'];
  const LAZY_AMBIGUOUS_ATTRS = ['data-url', 'data-image', 'data-img', 'data-large', 'data-full'];
  const LAZY_SET_ATTRS = ['data-srcset', 'data-lazy-srcset', 'data-original-set'];
  const IMAGE_FILE = /\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:[?#]|$)/i;

  function absolute(value, base) {
    try { return new URL(value, base || document.baseURI).href; } catch { return null; }
  }

  function pushUrl(out, value, kind, extra, base) {
    if (typeof value !== 'string' || !value.trim()) return; // new URL(null) would happily become ".../null"
    const url = value.startsWith('data:') ? value : absolute(value.trim(), base);
    if (url) out.push({ url, kind, ...extra });
  }

  function pushSrcset(out, srcset, kind, displayWidth, base) {
    for (const c of Rules.parseSrcset(srcset, base || document.baseURI)) {
      out.push({ url: c.url, kind, width: c.width || (c.density && displayWidth ? c.density * displayWidth : 0) });
    }
  }

  /** url(...) entries of a computed background-image, with image-set() densities turned into widths. */
  function parseCssImages(value, displayWidth) {
    if (!value || value === 'none') return [];
    const isSet = /image-set\(/i.test(value);
    // Chrome reports the densities of an image-set() as dppx ("1x" comes back as "1dppx")
    const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)(?:\s*([\d.]+)(?:x|dppx))?/gi;
    const out = [];
    let m;
    while ((m = re.exec(value))) {
      const url = absolute(m[1] ?? m[2] ?? m[3]);
      if (!url) continue;
      const density = m[4] ? parseFloat(m[4]) : 0;
      out.push({ url, kind: isSet ? 'image-set' : 'background', width: density && displayWidth ? density * displayWidth : 0 });
    }
    return out;
  }

  function fromImg(img, out) {
    const rect = rectOf(img);
    const display = rect ? rect.width : 0;
    const base = img.ownerDocument.baseURI;
    const picture = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;

    if (picture) {
      for (const source of picture.querySelectorAll('source')) {
        if (source.media) { try { if (!matchMedia(source.media).matches) continue; } catch {} }
        pushSrcset(out, source.getAttribute('srcset'), 'source', display, base);
      }
    }
    if (img.currentSrc) out.push({ url: img.currentSrc, kind: 'img', naturalWidth: img.complete ? img.naturalWidth : 0 });
    else pushUrl(out, img.getAttribute('src'), 'img', {}, base);
    pushSrcset(out, img.getAttribute('srcset'), 'srcset', display, base);

    for (const name of LAZY_SOURCE_ATTRS) pushUrl(out, img.getAttribute(name), 'lazy', {}, base);
    for (const name of LAZY_AMBIGUOUS_ATTRS) {
      const value = img.getAttribute(name);
      if (value && IMAGE_FILE.test(value)) pushUrl(out, value, 'lazy', {}, base);
    }
    for (const name of LAZY_SET_ATTRS) pushSrcset(out, img.getAttribute(name), 'lazy', display, base);
  }

  /** Every image source the topmost picture-painting element at a point offers. */
  function collectCandidates(stack) {
    const primary = (Array.isArray(stack) ? stack : [stack]).find(el => el && isImageLike(el));
    if (!primary) return [];
    const out = [];
    const rect = rectOf(primary);
    const display = rect ? rect.width : 0;

    if (primary.tagName === 'IMG') {
      fromImg(primary, out);
    } else if (primary.tagName === 'CANVAS') {
      try { out.push({ url: primary.toDataURL('image/png'), kind: 'canvas', naturalWidth: primary.width }); } catch {} // tainted: nothing to offer
    } else if (primary.tagName === 'VIDEO') {
      if (primary.poster) pushUrl(out, primary.poster, 'poster');
    } else if (primary instanceof SVGElement) {
      const images = primary.tagName.toLowerCase() === 'image' ? [primary] : [...primary.querySelectorAll('image')].slice(0, 5);
      for (const image of images) pushUrl(out, image.href && image.href.baseVal, 'svg-image');
    } else {
      const cs = getComputedStyle(primary);
      out.push(...parseCssImages(cs.backgroundImage, display));
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(primary, pseudo);
        if (p.content !== 'none' && p.content !== 'normal') out.push(...parseCssImages(p.backgroundImage, display).map(c => ({ ...c, kind: 'pseudo' })));
      }
    }

    // a link that points straight at an image file is the full-size original of what is shown
    const link = primary.closest && primary.closest('a[href]');
    if (link && IMAGE_FILE.test(link.getAttribute('href') || '')) pushUrl(out, link.getAttribute('href'), 'link-original', {}, link.baseURI);

    return out;
  }

  // ─── verification ───
  const VERIFY_TIMEOUT_MS = 1500;
  const MAX_VERIFIED = 4; // derived URLs actually loaded per resolve
  const MAX_URLS = 6;     // candidates handed to the downloader

  /** Load a URL as an image (with the page's own Referer) and report its natural size. */
  function verify(url, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? VERIFY_TIMEOUT_MS;
    return new Promise((resolve) => {
      if (typeof url !== 'string' || !/^https?:/i.test(url)) return resolve({ ok: false, width: 0, height: 0 });
      const img = new Image();
      let finished = false;
      const finish = (ok) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        const result = { ok, width: ok ? img.naturalWidth : 0, height: ok ? img.naturalHeight : 0 };
        img.onload = img.onerror = null;
        if (!ok) img.src = ''; // stop a slow download we are no longer waiting for
        resolve(result);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      img.onload = () => finish(img.naturalWidth > 0);
      img.onerror = () => finish(false);
      img.src = url;
    });
  }

  /**
   * Which image does the user mean at (x, y)? Ranked best first.
   * `urls` are ready to download, best first; `best` is urls[0] or null.
   * With `verify`, URLs that look like the original of what is shown (a thumbnail naming convention) are
   * loaded; one that exists and is larger than the source it came from moves to the front. Guesses that fail
   * to load, or are not larger, are discarded, so the worst outcome is the image that is on screen.
   */
  // Candidates that are only a GUESS at being an image: a link that merely ends in ".jpg" (a wiki file page is
  // HTML), an ambiguous data-* attribute. They are loaded before they may outrank what is on screen.
  const GUESSES = new Set(['link-original', 'lazy']);

  async function resolveAt(x, y, opts = {}) {
    const stack = elementStackAt(x, y);
    // the clicked element comes first: a synthetic or retargeted click may not match the hit test at (x, y)
    if (opts.target) stack.unshift(opts.target);
    let ranked = Rules.rankCandidates(collectCandidates(stack));

    if (opts.verify && ranked.length) {
      // 1) guesses: keep those that load as an image (with their real size), drop the rest
      let list = ranked.map(c => ({ url: c.url, kind: c.kind, width: c.score }));
      const allGuesses = list.filter(c => GUESSES.has(c.kind));
      const guesses = allGuesses.slice(0, MAX_VERIFIED);
      if (guesses.length) {
        const checked = await Promise.all(guesses.map(c => verify(c.url, { timeoutMs: opts.timeoutMs })));
        // a guess that was not loaded (beyond the limit) is not offered either: only an examined one may be downloaded
        const widths = new Map(), dropped = new Set(allGuesses.slice(MAX_VERIFIED).map(c => c.url));
        guesses.forEach((c, i) => (checked[i].ok ? widths.set(c.url, checked[i].width) : dropped.add(c.url)));
        list = list.filter(c => !dropped.has(c.url)).map(c => (widths.has(c.url) ? { ...c, width: 0, naturalWidth: widths.get(c.url) } : c));
        ranked = Rules.rankCandidates(list);
      }

      // 2) thumbnails: URLs that look like the original of what is shown are loaded; one that exists and is
      //    larger than its source moves to the front. Failures and non-upgrades are discarded, so the worst
      //    outcome is the image that is on screen.
      const seen = new Set(ranked.map(c => c.url));
      const attempts = [];
      for (const from of ranked.slice(0, 3)) {
        for (const url of Rules.deriveOriginals(from.url)) {
          if (attempts.length < MAX_VERIFIED && !seen.has(url)) { seen.add(url); attempts.push({ url, from }); }
        }
      }
      const loaded = await Promise.all(attempts.map(a => verify(a.url, { timeoutMs: opts.timeoutMs })));
      const upgrades = attempts
        .map((a, i) => ({ a, r: loaded[i] }))
        .filter(({ a, r }) => r.ok && r.width > a.from.score)
        .map(({ a, r }) => ({ url: a.url, kind: 'derived', naturalWidth: r.width }));
      if (upgrades.length) {
        ranked = Rules.rankCandidates([...ranked.map(c => ({ url: c.url, kind: c.kind, width: c.score })), ...upgrades]);
      }
    }

    ranked = ranked.slice(0, MAX_URLS);
    return { urls: ranked.map(c => c.url), best: ranked.length ? ranked[0].url : null, candidates: ranked };
  }

  self.SelectraImage = { getShadowRoot, elementStackAt, isImageLike, neutralizeShieldsAt, restoreShields, collectCandidates, verify, resolveAt };
})();
