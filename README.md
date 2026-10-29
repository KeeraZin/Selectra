# Selectra

Selectra is a Chrome extension that gives you back what some websites switch off: the right-click menu, text selection, copying, dragging images, scrolling and printing. Everything is off until you turn it on, for one site or for all of them.

[Chrome Web Store](https://chromewebstore.google.com/detail/nigboheegclicbnfhdpknkeadhlhnfmb) · [Privacy policy](https://keerazin.github.io/Selectra/privacy/) · [Changelog](CHANGELOG.md)

## What it does

- Brings back the browser's right-click menu on pages that block it with scripts or with invisible layers over images.
- Lets you select and copy text where CSS or scripts forbid it, including text inside web components.
- Stops pages from adding "Read more at…" links or other text to what you copy.
- Lets you drag a picture the way you can on any normal page, even when a transparent layer covers it.
- Saves an image on Alt+Click. Selectra picks the best picture the page itself offers for that spot (the larger version a thumbnail links to, the largest `srcset` entry) and checks that it loads before using it.
- Gives Ctrl+C, Ctrl+A, Ctrl+P, F12 and the like back when a page intercepts them.
- Unlocks pages that freeze scrolling or hide their content when printed.
- Removes blur filters and overlays that cover article text, and stops pages from noticing when the tab is hidden or loses focus.
- Silences "copying is disabled" alerts.
- Has an optional switch that makes the page text editable for the current visit.

Selectra works only with what your browser has already received. It does not sign in for you and does not reach anything the website has not sent.

## Privacy

There are no servers, no analytics and no accounts. Settings stay on your machine in `chrome.storage`, and all fonts and code ship inside the extension. The requests Selectra makes itself are the ones needed to save a picture you asked for; the policy describes them in detail: [PRIVACY_POLICY.md](PRIVACY_POLICY.md), also at <https://keerazin.github.io/Selectra/privacy/>.

## Install

Get it from the [Chrome Web Store](https://chromewebstore.google.com/detail/nigboheegclicbnfhdpknkeadhlhnfmb).

To run it from source there is nothing to build: open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick this folder.

## Check the store package against the source

The package on the Chrome Web Store holds only the runtime files. Build the same one from this repository (Windows PowerShell):

```powershell
powershell -File scripts/build-zip.ps1
```

The same files always give the same zip, byte for byte. Each release lists the SHA-256 of the package it carries, so you can compare.

## What is in this repository

| Path | What is there |
|---|---|
| `manifest.json`, `background.js`, `content.js`, `content-main.js`, `shared.js`, `image-rules.js`, `image-engine.js` | the extension |
| `popup.*`, `i18n.js`, `theme-init.js` | the popup, in 10 languages |
| `legal/` | the privacy, licence and changelog pages that the popup shows |
| `_locales/` | the store name and short description in 11 languages |
| `fonts/`, `icon*.png` | bundled fonts and icons |
| `docs/` | what GitHub Pages serves (the privacy policy) |
| `scripts/build-zip.ps1` | builds the store package |

## Licence

MIT, see [LICENSE](LICENSE). The bundled fonts are under the SIL Open Font License 1.1 (`fonts/OFL.txt`); the icons come from Feather (MIT) and Lucide (ISC). `legal/licenses.html` lists them.

## Türkçe

Selectra, bazı sitelerin kapattığı sağ tık menüsünü, metin seçimini, kopyalamayı, görsel sürüklemeyi, kaydırmayı ve yazdırmayı geri getiren bir Chrome eklentisidir. Siz açana kadar hiçbir şey çalışmaz; tek bir site için ya da her yerde açabilirsiniz. Sunucusu, analitiği ve hesabı yoktur. Kaynak kodu MIT lisanslıdır. Sürüm notları [CHANGELOG.md](CHANGELOG.md) dosyasında İngilizce ve Türkçe olarak durur.
