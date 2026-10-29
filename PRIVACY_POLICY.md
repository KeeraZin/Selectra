# Privacy Policy for Selectra

**Effective Date:** September 6, 2026  
**Last Updated:** October 28, 2026  

Selectra ("the Extension", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how our browser extension operates, what data is accessed, and confirms that **we do not collect, store, transmit, or sell any of your personal data.**

---

## 1. Core Commitment: Zero Data Collection

Selectra is designed with privacy as a foundational principle:
- **No Personal Information Collected:** We do not collect names, email addresses, IP addresses, browsing history, or device identifiers.
- **No Keystroke Logging:** The extension never logs or records your keystrokes or form inputs and never reads what you type. Key presses are only observed, while a feature is on, so that shortcuts keep working (see 2.4).
- **No Clipboard Snooping:** When you copy text, the extension prevents malicious websites from tampering with your clipboard or injecting unwanted tracking links. It does not read, transmit, or save your clipboard contents to any external server.
- **No Remote Tracking or Analytics:** The extension contains **zero** third-party trackers, telemetry libraries, Google Analytics, or remote tracking beacons.
- **No Remote Code Execution:** All extension code is bundled locally within the extension package in full compliance with Chrome Web Store Manifest V3 guidelines.

---

## 2. Information Handled Locally

All data processed by Selectra stays entirely within your local browser:

### 2.1 User Preferences & Settings
- **What is stored:** Selected UI theme (dark/light/system), preferred interface language, the Global/This-site mode, and the feature toggles. Per-site toggles are stored under the exact host name of the site (for example `www.example.com`), for sites where you switched something on.
- **Where it is stored:** On your machine, using Chrome's `chrome.storage.local` API and, for the theme and language, the local storage of the extension's own pages. In a private (incognito) window the toggles of a site are kept in memory only (`chrome.storage.session`) and are gone when the browser closes, so that no list of sites visited privately is written to your disk.
- **Data Sharing:** This data never leaves your browser and is never uploaded to any remote server or cloud service. Removing the extension removes it: the browser deletes an extension's storage when it is uninstalled.

### 2.2 Images You Save (Alt+Click and "Download image")
When you Alt+Click a picture or use the "Download image" context-menu entry, Selectra asks the browser to download that picture. This download request is made by the browser itself, exactly as any other download you start (so it carries the cookies the browser would send for that address), and Selectra refuses to start it for a private-network address (localhost, local-network addresses) when the page you are on is a public website. If the file turns out to come from a private-network address after redirects, or is not a picture (an error page, for example), it is removed again.

If the picture's own server refuses the request because it carries no page address, Selectra requests the picture itself from that server, sending the address of the **website you are on, without its path or query** (for example `https://example.com/`), as the `Referer` header. That request made by Selectra **carries no cookies or other credentials**, is stopped after at most 32 MB and a short time limit, is never made to a private-network address on behalf of a public page (nor redirected into one), and its result is saved by the extension; it is not handed to the web page. A picture larger than a URL can carry is passed in pieces to the script of the frame that asked for the download, which builds a temporary file reference there; it is removed as soon as the download is over. A picture that is a vector drawing (SVG) is saved through the browser's "save as" dialog, because such a file can contain scripts. Nothing is sent to the developer or to any third party other than the server that hosts the picture you chose to save.

To find the best version of a picture, Selectra's script in the page may load candidate picture addresses found on that page the way the page itself loads pictures; those ordinary picture requests carry whatever the browser sends for any picture on that page (including cookies and the page address).

### 2.3 Issue Reports
The popup's "report" button builds a text from the address of the page you are on (its host and path only; the query string and fragment are left out), the extension version, the list of active features and detected restrictions, your browser's user-agent string, a timestamp and the notes you type. It then copies that text to your clipboard and opens Selectra's own page in the Chrome Web Store (its Support tab) so that you can paste it there yourself. **Selectra itself sends nothing anywhere**: whether the text is ever submitted is entirely your decision, and the full text can be previewed in the popup before you use it. A separate "copy" button copies the same text without opening anything.

### 2.4 Page Content and Input Events (Processed Locally)
When you turn a feature on, Selectra's scripts run in the pages you visit (in every frame, except the captcha, payment and sign-in frames of a short list of services, where Selectra does not run at all) and read what they need to lift that page's restriction: the selected text, the page's links and image addresses, element styles, and which scripts have blocked right-click, selection, copying, scrolling or printing. They also watch clicks, mouse movement over images, key presses (for shortcuts such as Ctrl+C or F12) and scrolling, so that the page cannot block them. All of this happens inside your browser, only while the feature is on.

Two things happen on every page, also with every feature off, and stay inside your browser: (a) so that the "Download image" entry of the right-click menu can be offered where a picture is under the pointer, the page's script notes where you last right-clicked and, when the pointer rests, whether a picture is under it, and passes only that yes-or-no to Selectra's background script; (b) a few passive listeners note, for the diagnosis card in the popup, that the page cancelled a copy, selection or context-menu event. Only the kind of event, and the page's own short warning messages (such as "copying is disabled"), are kept, in the memory of that tab, until you leave the page; never the text you selected or copied.

**None of it is stored, logged or transmitted** (your settings, described in 2.1, are the only thing Selectra keeps), apart from the actions you start yourself that are described in 2.2 and 2.3. Selectra never records what you type or what you copy.

The "Reading Clarity & Anti-Blur" switch, when on, also makes the page believe that its tab is visible and focused (it reports `visible` and swallows the events that announce that the tab was hidden or lost focus). It is part of keeping a page that blurs or hides itself readable; if you do not want a page to be unable to notice that its tab is hidden, leave that switch off.

---

## 3. Chrome Web Store Permissions & Why They Are Needed

Selectra requests only the minimum permissions necessary to deliver its core utility functions:

| Permission | Purpose & Technical Justification |
| :--- | :--- |
| `<all_urls>` | Required to inject content scripts into web pages where copy, context menu, or text selection restrictions are imposed by website scripts. The scripts are not injected into the captcha, payment and sign-in frames of a short list of services. |
| `declarativeNetRequestWithHostAccess` | Used only while saving an image whose host rejects requests that carry no `Referer`, and only on your request. Up to five temporary rules exist for the duration of that single request, and apply to the extension's own request only: one sets the `Referer` header for that one URL, to the origin of the page you are on; four block the request from being redirected into a private network (localhost, local names, LAN address ranges). They are removed when the request finishes. Selectra installs no permanent rules and does not inspect, log or transmit network traffic. |
| `downloads` | Required to save pictures you choose to download (Alt+Click on a picture, or the "Download image" entry of the right-click menu) when the page disables native image saving. |
| `storage` | Required to save your preferences (active toggles, theme, language, Global/This-site mode) locally via `chrome.storage.local` (and, in private windows, `chrome.storage.session`). |
| `contextMenus` | Adds three entries to the browser's right-click menu: "Selectra: Toggle all", "Selectra: Clean copy" (when text is selected) and "Selectra: Download image". |

---

## 4. Third-Party Services & Links

Selectra does not share data with any third-party services. The only external page the extension opens on its own is its Chrome Web Store listing (Support tab), and only when you press the report button. When you follow that link, you are subject to Google's privacy policy for the Chrome Web Store.

### 4.1 Fonts
The popup uses the "Plus Jakarta Sans" and "JetBrains Mono" typefaces, and "Manrope" for the Cyrillic letters of the Russian interface. All are included in the extension package (SIL Open Font License 1.1, see `fonts/OFL.txt`); the popup makes no request to Google Fonts or to any other server.

### 4.2 Icons
The interface icons come from the Feather (MIT License) and Lucide (ISC License) icon sets and are part of the extension package. Their notices are in the "Open-source licenses" page of the popup.

---

## 5. Children's Online Privacy Protection

Selectra does not collect personal information from any user, including children under the age of 13.

---

## 6. Your Rights and Who Is Responsible

The developer of Selectra, whose name and contact address are shown on the extension's Chrome Web Store listing, is the party responsible for this extension. Because Selectra collects and transmits no personal data, the developer holds none about you: there is nothing to access, correct, export or erase on the developer's side. What the extension keeps on your device (2.1) is under your control: you can reset it from the popup, and removing the extension deletes it. If you believe this description is wrong, or you want to exercise a right you have under the GDPR or the Turkish KVKK, use the contact channel below.

---

## 7. Policy Changes

If we ever update this Privacy Policy, the revised version will be published with an updated "Effective Date". Because we do not collect contact details, please review this policy periodically or check the release notes on the extension's Chrome Web Store listing.

---

## 8. Contact Us

If you have questions, feedback, or concerns regarding this Privacy Policy or the security of Selectra, please use the **Support** tab of the Selectra listing in the Chrome Web Store. That is the only contact channel; the extension itself contains no e-mail address and no contact form.
