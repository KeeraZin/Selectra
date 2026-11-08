// Selectra - code shared by the service worker (importScripts), the popup (<script>) and the
// content script (manifest js array). UMD so test/shared-tests.js can load the real file in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SelectraShared = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Settings model (one definition for the popup, the service worker and the content script) ───
  const FEATURE_KEYS = [
    'rightClick', 'copy', 'clipboard', 'edit', 'alert',
    'keyboard', 'dragDrop', 'altClick', 'print', 'scrollbar', 'antiBlur'
  ];
  // What "Unlock all" switches: everything except the Page Editor (edit), which changes the page and stays an explicit choice.
  const UNLOCK_KEYS = FEATURE_KEYS.filter((key) => key !== 'edit');
  // What never reaches a frame of ANOTHER site (a payment form, a sign-in box, an ad): they change what the page does, not only what it allows.
  const TOP_ONLY_KEYS = ['edit', 'alert'];
  const GLOBAL_SETTINGS_KEY = 'settings_global';
  const GLOBAL_MODE_KEY = 'superUnlockerGlobalMode';

  function emptySettings() {
    return { schemaVersion: 5, features: Object.fromEntries(FEATURE_KEYS.map((key) => [key, { enabled: false }])) };
  }

  /** Any stored shape (current, v4, the old flat booleans, garbage) -> { schemaVersion: 5, features: { <every key>: { enabled } } }. */
  function normalizeSettings(raw) {
    const result = emptySettings();
    if (!raw || typeof raw !== 'object') return result;

    if ((raw.schemaVersion === 5 || raw.schemaVersion === 4) && raw.features && typeof raw.features === 'object') {
      for (const key of FEATURE_KEYS) {
        const feature = Object.hasOwn(raw.features, key) ? raw.features[key] : null;
        if (feature && typeof feature === 'object') result.features[key] = { ...feature, enabled: feature.enabled === true };
      }
      return result;
    }

    for (const key of FEATURE_KEYS) result.features[key].enabled = Object.hasOwn(raw, key) && raw[key] === true;
    return result;
  }

  function countEnabled(settings) {
    const normalized = normalizeSettings(settings);
    return FEATURE_KEYS.reduce((count, key) => count + (normalized.features[key].enabled ? 1 : 0), 0);
  }

  /** The storage key of one host's own entry, or '' for a page without a host name (file:, about:, data:). */
  function siteKey(hostname) {
    const host = String(hostname || '').trim().toLowerCase();
    return host ? `settings_${host}` : '';
  }

  /**
   * What a page runs. Global mode: the global entry, everywhere. "This site": that exact host's OWN entry and nothing else (no global
   * fallback, no entry of a parent or sibling domain), so the two modes mean what the popup says they mean.
   */
  function resolveSettings(data, hostname, globalMode) {
    const source = data && typeof data === 'object' ? data : {};
    const key = globalMode ? GLOBAL_SETTINGS_KEY : siteKey(hostname);
    return normalizeSettings(key && Object.hasOwn(source, key) ? source[key] : null);
  }

  /** The same settings with the keys that must not reach a frame of another site switched off. */
  function withoutTopOnly(settings) {
    const normalized = normalizeSettings(settings);
    for (const key of TOP_ONLY_KEYS) normalized.features[key] = { ...normalized.features[key], enabled: false };
    return normalized;
  }

  // ─── Hosts ───

  // Labels that are part of the public suffix when they sit directly under a two-letter country TLD
  // (bbc.CO.uk, sahibinden.COM.tr ...). Not the full Public Suffix List: the common registries only.
  const GENERIC_SECOND_LEVEL = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
  const SECOND_LEVEL_BY_TLD = {
    uk: ['co', 'org', 'ac', 'gov', 'ltd', 'plc', 'me', 'net', 'sch', 'nhs', 'police', 'mod'],
    tr: ['com', 'net', 'org', 'gov', 'edu', 'k12', 'av', 'bel', 'biz', 'dr', 'gen', 'info', 'mil', 'name', 'pol', 'tel', 'tsk', 'tv', 'web', 'bbs', 'kep'],
    au: ['com', 'net', 'org', 'edu', 'gov', 'asn', 'id'],
    nz: ['co', 'org', 'net', 'govt', 'ac', 'school', 'geek'],
    za: ['co', 'org', 'gov', 'ac', 'net'],
    jp: ['co', 'ne', 'or', 'go', 'ac', 'ad', 'ed', 'gr', 'lg'],
    kr: ['co', 'or', 'go', 'ac', 'ne', 're'],
    br: ['com', 'net', 'org', 'gov', 'edu'],
    in: ['co', 'net', 'org', 'gov', 'ac', 'edu'],
    cn: ['com', 'net', 'org', 'gov', 'edu', 'ac'],
    mx: ['com', 'gob', 'org', 'edu', 'net'],
    ar: ['com', 'gob', 'org', 'net', 'edu'],
    es: ['com', 'org', 'gob', 'nom', 'edu'],
    pl: ['com', 'net', 'org', 'gov', 'edu'],
    ua: ['com', 'org', 'net', 'gov', 'edu'],
    il: ['co', 'org', 'net', 'ac', 'gov'],
    id: ['co', 'or', 'go', 'ac', 'web', 'sch'],
    th: ['co', 'or', 'go', 'ac', 'in'],
    ae: ['co', 'com', 'net', 'org', 'gov', 'ac'],
    sa: ['com', 'net', 'org', 'gov', 'edu']
  };

  // Services where every customer gets a sub-domain of the same registrable domain: alice.github.io and mallory.github.io are different
  // sites, not one. (A short list of the large ones, taken from the Public Suffix List's private section.)
  const SHARED_HOSTING_SUFFIXES = new Set([
    'github.io', 'githubusercontent.com', 'gitlab.io', 'bitbucket.io', 'vercel.app', 'now.sh', 'netlify.app', 'pages.dev', 'workers.dev',
    'web.app', 'firebaseapp.com', 'appspot.com', 'blogspot.com', 'blogspot.com.tr', 'blogspot.co.uk', 'blogspot.de', 'blogspot.fr', 'blogspot.es',
    'blogspot.it', 'blogspot.nl', 'blogspot.pl', 'blogspot.ru', 'wordpress.com', 'herokuapp.com', 'azurewebsites.net', 'azurestaticapps.net',
    'cloudfront.net', 'onrender.com', 'fly.dev', 'glitch.me', 'repl.co', 'replit.app', 'surge.sh', 'netlify.com', 'myshopify.com',
    'wixsite.com', 'weebly.com', 'webflow.io', 'notion.site', 'carrd.co', 'readthedocs.io', 's3.amazonaws.com', 'elasticbeanstalk.com',
    'ngrok.io', 'ngrok-free.app', 'trycloudflare.com', 'duckdns.org', 'neocities.org', 'itch.io', 'tumblr.com'
  ]);

  const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

  /**
   * The scope key for "this site and its subdomains".
   * 'www.bbc.co.uk' -> 'bbc.co.uk', 'a.example.com' -> 'example.com', 'alice.github.io' -> 'alice.github.io'.
   * IP addresses and single-label hosts are their own scope: slicing '192.168.0.1' to '0.1' would
   * make every device on every LAN share one settings entry.
   */
  function getBaseDomain(host) {
    if (typeof host !== 'string') return '';
    let h = host.trim().toLowerCase();
    h = h.replace(/\.+$/, '');
    if (!h) return '';
    if (h.includes(':') || h.startsWith('[') || IPV4.test(h)) return h;

    const parts = h.split('.');
    if (parts.length <= 2) {
      return h;
    }

    // a shared-hosting suffix keeps one more label: the customer's own name
    for (let i = 1; i < parts.length; i++) {
      if (SHARED_HOSTING_SUFFIXES.has(parts.slice(i).join('.'))) return parts.slice(i - 1).join('.');
    }

    const tld = parts[parts.length - 1];
    const second = parts[parts.length - 2];
    if (tld.length === 2) {
      const suffixLabels = Object.hasOwn(SECOND_LEVEL_BY_TLD, tld) ? SECOND_LEVEL_BY_TLD[tld] : GENERIC_SECOND_LEVEL;
      if (suffixLabels.includes(second)) return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  /** IPv4 that is not publicly routable: this-network, RFC1918, loopback, link-local (incl. the cloud metadata address), CGNAT, IETF/benchmark blocks, multicast and reserved. */
  function isPrivateIPv4(a, b, c) {
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19));
  }

  /** IPv4 the way inet_aton reads it ("127.1", "0x7f.0.0.1", "0177.0.0.1", "2130706433") -> 4 bytes, or null if it is not IPv4-shaped. */
  function parseLooseIPv4(host) {
    const parts = host.split('.');
    if (parts.length > 4) return null;
    const nums = [];
    for (const p of parts) {
      if (/^0x[0-9a-f]+$/.test(p)) nums.push(parseInt(p, 16));
      else if (/^0[0-7]*$/.test(p)) nums.push(parseInt(p, 8) || 0);
      else if (/^[1-9]\d*$/.test(p)) nums.push(parseInt(p, 10));
      else return null;
    }
    const last = nums.pop();
    if (nums.some((n) => n > 255) || last >= 2 ** (8 * (4 - nums.length))) return null;
    const bytes = [...nums];
    for (let i = 3 - nums.length; i >= 0; i--) bytes.push(Math.floor(last / 2 ** (8 * i)) % 256);
    return bytes;
  }

  /** IPv6 literal (brackets already removed) -> 8 numbers, or null if malformed. A dotted IPv4 tail is accepted. */
  function parseIPv6(host) {
    let s = host;
    const tail = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
    if (tail) {
      const v4 = parseLooseIPv4(tail[2]);
      if (!v4 || tail[2].split('.').length !== 4) return null;
      s = `${tail[1]}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
    }
    const halves = s.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - head.length - rest.length;
    if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
    const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
    return groups.every((g) => /^[0-9a-f]{1,4}$/.test(g)) ? groups.map((g) => parseInt(g, 16)) : null;
  }

  function isPrivateIPv6(g) {
    const embedded = (hi, lo) => isPrivateIPv4(hi >> 8, hi & 255, lo >> 8);
    if (g.slice(0, 7).every((x) => x === 0)) return true;                          // :: and ::1
    if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0 || g[5] === 0xffff)) return embedded(g[6], g[7]); // IPv4-compatible / IPv4-mapped (::ffff:a.b.c.d)
    if (g.slice(0, 4).every((x) => x === 0) && g[4] === 0xffff && g[5] === 0) return embedded(g[6], g[7]);   // IPv4-translated, SIIT (::ffff:0:a.b.c.d)
    if (g[0] === 0x64 && g[1] === 0xff9b) return g.slice(2, 6).every((x) => x === 0) ? embedded(g[6], g[7]) : true; // NAT64 (64:ff9b:1::/48 is local-use)
    if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true;     // discard-only prefix, 100::/64
    if (g[0] === 0x2002) return embedded(g[1], g[2]);                              // 6to4 embeds the IPv4 address
    if (g[0] === 0x2001 && g[1] === 0) return true;                                // Teredo: the client address is obfuscated
    if (g[0] === 0x2001 && g[1] === 0xdb8) return true;                            // documentation prefix, 2001:db8::/32
    return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0 || (g[0] & 0xff00) === 0xff00; // unique-local, link-local, site-local, multicast
  }

  /**
   * True for hostnames that only make sense inside a local network: localhost, .local/.lan names, single-label
   * intranet names, non-routable IPv4 and IPv6 (including IPv6 forms that embed an IPv4 address) in any spelling.
   * NAMES ARE JUDGED, NOT RESOLVED: an extension cannot resolve DNS, so a public-looking name that points at a
   * private address passes. Callers must not treat this as a complete SSRF defence (see background.js).
   * A literal that cannot be parsed counts as private (fail closed), and so does an empty host.
   */
  function isPrivateHost(hostname) {
    const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
    if (!h) return true;
    if (h === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa)$/.test(h)) return true;
    if (h.includes(':')) {
      const g = parseIPv6(h);
      return !g || isPrivateIPv6(g);
    }
    const v4 = parseLooseIPv4(h);
    if (v4) return isPrivateIPv4(v4[0], v4[1], v4[2]);
    return !h.includes('.'); // single-label intranet names
  }

  // The captcha, payment and sign-in addresses listed in manifest.json exclude_matches: neither content scripts nor page screenshots run on them.
  const EXCLUDED_MATCH_PATTERNS = [
    'https://challenges.cloudflare.com/*',
    'https://*.hcaptcha.com/*',
    'https://www.google.com/recaptcha/*',
    'https://www.recaptcha.net/recaptcha/*',
    'https://*.arkoselabs.com/*',
    'https://*.funcaptcha.com/*',
    'https://*.stripe.com/*',
    'https://*.stripe.network/*',
    'https://*.paypal.com/*',
    'https://pay.google.com/*',
    'https://payments.google.com/*',
    'https://*.adyen.com/*',
    'https://*.braintreegateway.com/*',
    'https://accounts.google.com/*',
    'https://login.microsoftonline.com/*',
    'https://login.live.com/*',
    'https://appleid.apple.com/*'
  ];

  const EXCLUDED_MATCH_REGEXES = EXCLUDED_MATCH_PATTERNS.map((pattern) => {
    const [, scheme, host, rest] = pattern.match(/^(\*|https?):\/\/([^/]*)(\/.*)$/);
    const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const hostRe = host === '*' ? '[^/]*' : host.startsWith('*.') ? `(?:[^/]*\\.)?${esc(host.slice(2))}` : esc(host);
    return new RegExp(`^${scheme === '*' ? 'https?' : scheme}://${hostRe}${rest.split('*').map(esc).join('.*')}$`, 'i');
  });

  /** True for the captcha, payment and sign-in addresses listed in manifest.json exclude_matches. */
  function isExcludedSensitiveUrl(url) {
    if (typeof url !== 'string' || !url) return false;
    try {
      const normalized = new URL(url).href;
      return EXCLUDED_MATCH_REGEXES.some((re) => re.test(normalized));
    } catch {
      return false;
    }
  }

  // ─── The page screenshot's judgement calls ───
  // Pure: the geometry goes in, the decision comes out. content.js does the measuring and acts on the answer; test/shared-tests.js pins the rules down.

  /**
   * Which of the scrolling elements found under the sample points is the app's main pane: its index in `candidates`, or -1 when none qualifies.
   * candidates: [{ rect: { left, top, width, height }, scrollSpan, atCenter }] (CSS px; scrollSpan = how far it can be scrolled; atCenter = it lies under
   * the middle of the window). A pane has to be tall (at least 40 % of the window) and not tiny (at least 8 % of its area): a code block or a menu list is
   * no pane, a pane that only has a third of the window's width (side panels open, a half-width window) is one. The biggest wins; of two that differ by less
   * than 2 % the one with more to scroll; the one in the middle of the window wins unless something at least twice as big lies elsewhere.
   */
  function pickScrollPane(candidates, viewport) {
    const vw = Number(viewport && viewport.width) || 0;
    const vh = Number(viewport && viewport.height) || 0;
    if (!Array.isArray(candidates) || vw <= 0 || vh <= 0) return -1;
    const eligible = [];
    candidates.forEach((c, index) => {
      const r = c && c.rect;
      if (!r || !(c.scrollSpan > 20)) return;
      const area = r.width * r.height;
      if (!(r.height >= vh * 0.4) || !(area >= vw * vh * 0.08)) return;
      eligible.push({ index, area, span: c.scrollSpan, atCenter: c.atCenter === true });
    });
    if (!eligible.length) return -1;
    const better = (a, b) => ((a.area > b.area * 1.02 || (Math.abs(a.area - b.area) <= b.area * 0.02 && a.span > b.span)) ? a : b);
    const best = eligible.reduce(better);
    const inMiddle = eligible.filter((e) => e.atCenter);
    if (inMiddle.length) {
      const middle = inMiddle.reduce(better);
      if (middle.area * 2 >= best.area) return middle.index;
    }
    return best.index;
  }

  /**
   * What a floating element (one that stays where it is while the page scrolls under it) is, seen from the area that is photographed (`aperture`: the
   * window, or the pane that scrolls by itself), in CSS px of the window:
   *   'header'  anchored to the top (a bar, the buttons in it): belongs to the first picture, gets out of the way afterwards
   *   'side'    a tall menu at a side edge (a fixed docs menu, a drawer): the same
   *   'dock'    a bar near the bottom, wider than it is tall or spanning most of the area (cookie bar, composer, prompt pill): hidden while the pictures are taken, shown once at the very end
   *   'widget'  anything else that floats (a "scroll to bottom" button, a chat bubble, a toast): it would hover over the text, so it is hidden
   *   'skip'    outside the area, or too big to be anything but the page itself (a veil, a modal): left alone
   */
  function classifyFloating(rect, aperture) {
    const aw = aperture.right - aperture.left;
    const ah = aperture.bottom - aperture.top;
    const w = rect.right - rect.left;
    const h = rect.bottom - rect.top;
    if (!(w > 0 && h > 0 && aw > 0 && ah > 0)) return 'skip';
    const overX = Math.min(rect.right, aperture.right) - Math.max(rect.left, aperture.left);
    const overY = Math.min(rect.bottom, aperture.bottom) - Math.max(rect.top, aperture.top);
    if (overX <= 2 || overY <= 2) return 'skip';
    if (w * h > aw * ah * 0.65) return 'skip';
    if (rect.top <= aperture.top + 24 && rect.bottom <= aperture.top + ah * 0.35) return 'header';
    if (h >= ah * 0.55 && w <= aw * 0.45 && (rect.left <= aperture.left + 24 || rect.right >= aperture.right - 24)) return 'side';
    if (h > ah * 0.45) return 'skip';
    if (rect.bottom >= aperture.bottom - 120 && rect.top >= aperture.bottom - Math.max(220, ah * 0.45) && w >= Math.min(220, aw * 0.22) && (w > h * 1.8 || w >= aw * 0.6)) return 'dock';
    return 'widget';
  }

  return {
    FEATURE_KEYS, UNLOCK_KEYS, TOP_ONLY_KEYS, GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY,
    EXCLUDED_MATCH_PATTERNS,
    emptySettings, normalizeSettings, countEnabled, siteKey, resolveSettings, withoutTopOnly,
    getBaseDomain, isPrivateHost, isExcludedSensitiveUrl,
    pickScrollPane, classifyFloating
  };
});
