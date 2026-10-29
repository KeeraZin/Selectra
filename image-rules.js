// Selectra - pure image-URL rules (no DOM, no chrome.* APIs). UMD so test/image-rules-tests.js can
// load the real file in Node. Everything here is a heuristic over strings; the DOM side
// (image-engine.js) is responsible for verifying that a derived URL really exists.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SelectraImageRules = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EXT = '(?:jpe?g|png|gif|webp|avif)';

  function toUrl(value, base) {
    try { return new URL(value, base); } catch { return null; }
  }

  // ─── srcset ───
  // Follows the HTML parsing rules closely enough for real pages: URLs end at whitespace, a trailing comma
  // ends a candidate without descriptors, and commas inside a data: URL do not split anything.
  function parseSrcset(srcset, baseUrl) {
    if (typeof srcset !== 'string' || !srcset.trim()) return [];
    const out = [];
    let i = 0;
    while (i < srcset.length) {
      while (i < srcset.length && /[\s,]/.test(srcset[i])) i++;
      if (i >= srcset.length) break;

      const start = i;
      while (i < srcset.length && !/\s/.test(srcset[i])) i++;
      let url = srcset.slice(start, i);
      let descriptors = '';

      if (url.endsWith(',')) {
        url = url.replace(/,+$/, '');
      } else {
        const dStart = i;
        let depth = 0;
        while (i < srcset.length) {
          const ch = srcset[i];
          if (ch === '(') depth++;
          else if (ch === ')') depth = Math.max(0, depth - 1);
          else if (ch === ',' && depth === 0) break;
          i++;
        }
        descriptors = srcset.slice(dStart, i).trim();
      }
      if (!url) continue;

      if (baseUrl) {
        const abs = toUrl(url, baseUrl);
        if (!abs) continue;
        url = abs.href;
      }

      const w = descriptors.match(/(\d+)\s*w\b/i);
      const x = descriptors.match(/([\d.]+)\s*x\b/i);
      out.push({
        url,
        width: w ? parseInt(w[1], 10) : 0,
        density: w ? 0 : (x ? parseFloat(x[1]) || 1 : 1)
      });
    }
    return out;
  }

  // ─── size hints ───
  const TWITTER_NAMES = { thumb: 150, small: 680, medium: 1200, large: 2048, orig: 4096 };

  function sizeHintFromUrl(input) {
    if (typeof input !== 'string' || !input) return 0;
    const u = toUrl(input);
    const host = u ? u.hostname : '';
    const s = input;
    let m;

    if ((m = s.match(/\/(\d{2,5})px-[^/?#]+(?:[?#]|$)/i))) return +m[1]; // wikimedia thumbs
    if ((m = s.match(/[?&](?:w|width|maxwidth|max_width|imwidth)=(\d{2,5})(?:&|#|$)/i))) return +m[1];
    if ((m = s.match(/\/w_(\d{2,5})[,/]/i))) return +m[1]; // cloudinary
    if (/(?:googleusercontent|ggpht)\.com$/i.test(host)) {
      if ((m = s.match(/=[sw](\d{2,5})(?:-[a-z0-9]+)*(?:[?#]|$)/i))) return +m[1];
    }
    if (host === 'pbs.twimg.com' && (m = s.match(/[?&]name=([a-z0-9]+)(?:&|#|$)/i))) {
      const named = TWITTER_NAMES[m[1].toLowerCase()];
      if (named) return named;
      const dims = m[1].match(/^(\d{2,5})x\d+$/);
      if (dims) return +dims[1];
    }
    if ((m = s.match(new RegExp(`-(\\d{2,5})x\\d{2,5}\\.${EXT}(?:[?#]|$)`, 'i')))) return +m[1]; // wordpress
    if ((m = s.match(new RegExp(`_(\\d{2,5})x\\d{0,5}\\.${EXT}(?:[?#]|$)`, 'i')))) return +m[1]; // shopify
    if (host === 'i.pinimg.com' && (m = s.match(/pinimg\.com\/(\d{2,5})x/i))) return +m[1];
    if ((m = s.match(/\._[A-Z_]*?(\d{2,5})_[._]/))) return +m[1]; // amazon ._SX300_.
    return 0;
  }

  // ─── placeholders ───
  const PLACEHOLDER_NAME = /(?:^|[/_.-])(?:spacer|blank|pixel|transparent|placeholder|lazy-?load|loading|loader|1x1|empty)(?:[/_.-]|$)/i;

  function isPlaceholder(url) {
    if (typeof url !== 'string' || !url.trim()) return true;
    if (url.startsWith('data:')) return url.length < 300; // 1x1 gifs, tiny svg shims
    const u = toUrl(url);
    return PLACEHOLDER_NAME.test(u ? u.pathname : url);
  }

  // ─── deriving the original from a thumbnail URL ───
  // Each rule recognises one CDN/CMS convention and returns zero or more candidate URLs. They are guesses:
  // the caller must load them before trusting them.
  const STRIP_PARAMS = ['w', 'h', 'width', 'height', 'fit', 'crop', 'dpr', 'resize', 'size', 'maxwidth', 'maxheight'];

  const withPath = (u, pathname) => { const c = new URL(u.href); c.pathname = pathname; return c.href; };

  const DERIVE_RULES = [
    // WordPress: photo-300x200.jpg -> photo.jpg
    (u) => {
      const m = u.pathname.match(new RegExp(`^(.*)-\\d{2,5}x\\d{2,5}(\\.${EXT})$`, 'i'));
      return m ? [withPath(u, m[1] + m[2])] : [];
    },
    // Wikimedia: /thumb/a/ab/File.jpg/220px-File.jpg -> /a/ab/File.jpg
    (u) => {
      const m = u.pathname.match(/^(.*)\/thumb\/([0-9a-f]\/[0-9a-f]{2}\/[^/]+)\/\d+px-[^/]+$/i);
      if (!m) return [];
      const original = new URL(withPath(u, `${m[1]}/${m[2]}`));
      if (u.hostname === 'thumb.wikimedia.org') original.hostname = 'upload.wikimedia.org'; // the thumb host only serves thumbnails
      return [original.href];
    },
    // Cloudinary: /upload/w_300,c_fill/v1/p.jpg -> /upload/v1/p.jpg
    (u) => {
      const parts = u.pathname.split('/');
      const at = parts.indexOf('upload');
      if (at < 0) return [];
      const isTransform = (seg) => /^[a-z]{1,3}_[^/,]+(?:,[a-z]{1,3}_[^/,]+)*$/.test(seg);
      let end = at + 1;
      while (end < parts.length - 1 && isTransform(parts[end])) end++; // the last segment is the file itself
      if (end === at + 1) return [];
      return [withPath(u, [...parts.slice(0, at + 1), ...parts.slice(end)].join('/'))];
    },
    // Shopify: p_100x100.png / p_small.png -> p.png
    (u) => {
      const m = u.pathname.match(new RegExp(`^(.*?)_(?:\\d{1,4}x\\d{0,4}|\\d{0,4}x\\d{1,4}|pico|icon|thumb|small|compact|medium|large|grande)(\\.${EXT})$`, 'i'));
      return m ? [withPath(u, m[1] + m[2])] : [];
    },
    // Google user content: =s64-c / =w200-h200-no -> =s0 (original size)
    (u) => {
      if (!/(?:googleusercontent|ggpht)\.com$/i.test(u.hostname)) return [];
      const m = u.pathname.match(/^(.*)=[wsh]\d+(?:-[a-z0-9]+)*$/i);
      return m ? [withPath(u, `${m[1]}=s0`)] : [];
    },
    // Twitter/X: name=small -> name=orig
    (u) => {
      if (u.hostname !== 'pbs.twimg.com') return [];
      const name = u.searchParams.get('name');
      if (!name || name === 'orig') return [];
      const c = new URL(u.href);
      c.searchParams.set('name', 'orig');
      return [c.href];
    },
    // Pinterest: /236x/... -> /originals/...
    (u) => {
      if (u.hostname !== 'i.pinimg.com') return [];
      const m = u.pathname.match(/^\/\d+x\d*(?:_[A-Za-z0-9]+)?\/(.+)$/);
      return m ? [withPath(u, `/originals/${m[1]}`)] : [];
    },
    // Amazon: abc._SX300_.jpg -> abc.jpg
    (u) => {
      const m = u.pathname.match(/^(.*?)\._[A-Z0-9_,]+_(\.(?:jpe?g|png|webp))$/);
      return m ? [withPath(u, m[1] + m[2])] : [];
    },
    // Flickr: .../ID_SECRET_c.jpg (or no suffix) -> larger size suffixes, biggest first (not every photo has all of them)
    (u) => {
      if (!/(?:^|\.)staticflickr\.com$/i.test(u.hostname)) return [];
      const m = u.pathname.match(/^(.*\/\d+_[0-9a-f]+)(?:_[a-z])?(\.jpe?g)$/i);
      return m ? ['_k', '_h', '_b'].map(suffix => withPath(u, m[1] + suffix + m[2])) : [];
    },
    // imgur: ID_d.webp?... (default thumbnail) and ID + size letter (s b t m l h) -> the plain ID
    (u) => {
      if (u.hostname !== 'i.imgur.com') return [];
      const def = u.pathname.match(/^\/([A-Za-z0-9]{5,8})_d\.(?:webp|jpe?g|png|gif)$/);
      if (def) return [`https://i.imgur.com/${def[1]}.jpeg`];
      const sized = u.pathname.match(/^\/([A-Za-z0-9]{7})[sbtmlh]\.(jpe?g|png|gif)$/);
      return sized ? [`https://i.imgur.com/${sized[1]}.${sized[2]}`] : [];
    },
    // imgix / Unsplash / most image CDNs: drop the resize parameters, keep the rest
    (u) => {
      if (!STRIP_PARAMS.some(p => u.searchParams.has(p))) return [];
      const c = new URL(u.href);
      for (const p of STRIP_PARAMS) c.searchParams.delete(p);
      return [c.href];
    }
  ];

  function deriveOriginals(input) {
    const u = typeof input === 'string' ? toUrl(input) : null;
    if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) return [];
    const results = [];
    for (const rule of DERIVE_RULES) {
      let derived = [];
      try { derived = rule(u); } catch {}
      for (const candidate of derived) {
        if (candidate !== u.href && !results.includes(candidate)) results.push(candidate);
      }
    }
    return results;
  }

  // ─── ranking ───
  // Used only when a candidate carries no width information of its own: how large is a source of this
  // kind usually, compared with the thumbnail that is on screen?
  const KIND_PRIOR = {
    'link-original': 3000, lazy: 1500, source: 1200, srcset: 1200, 'image-set': 800,
    background: 800, 'svg-image': 800, poster: 800, pseudo: 600, img: 300, canvas: 100
  };

  const positive = (n) => (typeof n === 'number' && n > 0 ? n : 0);

  function effectiveWidth(c) {
    return positive(c.naturalWidth) || positive(c.width) || sizeHintFromUrl(c.url) || KIND_PRIOR[c.kind] || 200;
  }

  function dedupeKey(url) {
    if (url.startsWith('data:')) return `data:${url.length}:${url.slice(0, 80)}`;
    const u = toUrl(url);
    if (!u) return url;
    u.hash = '';
    return u.href;
  }

  function rankCandidates(candidates) {
    if (!Array.isArray(candidates)) return [];
    const best = new Map();
    candidates.forEach((c, index) => {
      if (!c || typeof c.url !== 'string' || !c.url) return;
      const score = effectiveWidth(c);
      const key = dedupeKey(c.url);
      const known = best.get(key);
      if (!known || score > known.score) best.set(key, { url: c.url, kind: c.kind, score, index });
    });

    let list = [...best.values()];
    const real = list.filter(c => !isPlaceholder(c.url));
    if (real.length) list = real; // placeholders only matter when nothing else exists

    list.sort((a, b) => {
      const aData = a.url.startsWith('data:') ? 1 : 0;
      const bData = b.url.startsWith('data:') ? 1 : 0;
      return (aData - bData) || (b.score - a.score) || (a.index - b.index);
    });
    return list.map(({ url, kind, score }) => ({ url, kind, score }));
  }

  return { parseSrcset, sizeHintFromUrl, isPlaceholder, deriveOriginals, rankCandidates };
});
