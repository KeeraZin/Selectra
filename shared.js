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

  return {
    FEATURE_KEYS, UNLOCK_KEYS, TOP_ONLY_KEYS, GLOBAL_SETTINGS_KEY, GLOBAL_MODE_KEY,
    emptySettings, normalizeSettings, countEnabled, siteKey, resolveSettings, withoutTopOnly,
    getBaseDomain, isPrivateHost
  };
});
