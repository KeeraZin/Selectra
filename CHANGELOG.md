# Selectra changelog

Newest first. Every version has its notes in English and in Turkish (Türkçe); the same text is shown inside the extension (popup, "What's new").

## 1.0.11 - 2026-10-29

**English**

*Hardened Downloads, Exact-Site Mode & Print Unlock*

Security and reliability release: hardened image downloads, isolated script bridge, exact per-site settings, and improved web-app compatibility.

> **Good to know:** Settings saved by older versions under a parent domain (such as `example.com`) no longer carry over to subdomains (`www.example.com`). Subdomains start clean once; existing records are preserved.

### Added

- **Print Unlock:** Added as a dedicated toggle in the popup. Restores blocked printing while preserving the page layout as shown on screen, without stripping headers or menus.
- **What's New:** Added an interactive bilingual release timeline directly in the popup footer.

### Changed

- **Exact "This Site" Mode:** Per-site settings now apply strictly to the active hostname without falling back to global defaults or a parent domain. Resetting affects only that hostname.
- **Zero Overhead When Idle:** Page observers stay completely inactive when all toggles are off, and private windows keep site settings strictly in memory.
- **Privacy Policy & Licenses:** Updated documentation to reflect every local permission and packaged asset accurately.
- **Store Listing in 11 Languages:** The short description is rewritten in plain words for every store language, and the store screenshots are rebuilt per language: the real popup in that language next to text that reads naturally, with headlines that wrap cleanly.

### Removed

- **Site-Specific Selectors:** Removed domain-targeted rules in favor of universal, standards-based unlocker heuristics across all websites.

### Fixed

- **Rich Editors & Sensitive Frames:** Code editors and web apps retain full control over their own selection, clipboard, and keyboard shortcuts. Payment, sign-in, and CAPTCHA frames remain untouched.
- **Accessibility & Typography:** Added accessible switch labels, modal focus trapping, WCAG AA contrast across both themes, language-aware plurals, and bundled Cyrillic font support for Russian.

### Security

- **Verified Image Downloads:** Restricted downloads strictly to image MIME types, re-validated final redirect destinations, and prompted for a save location on ambiguous SVG files.
- **Isolated Script Bridge:** Rebuilt the communication channel between isolated and main-world scripts so untrusted page scripts cannot forge messages to disable protections.

**Türkçe**

*İndirme Güvenliği, Tam Alan Adı Modu ve Yazdırma Kilidi*

Güvenlik ve güvenilirlik sürümü: görsel indirme doğrulaması, betik izolasyonu, tam alan adı ayarları ve web uygulaması uyumluluğu güçlendirildi.

> **Bilmeniz gerekenler:** Eski sürümlerin üst alan adı (örneğin `example.com`) altına kaydettiği ayarlar artık alt alan adlarına (`www.example.com`) otomatik uygulanmaz. Alt alan adları bir defaya mahsus varsayılan durumla başlar; mevcut kayıtlar silinmez.

### Eklendi

- **Print Unlock (Yazdırma Kilidi):** Popup'a bağımsız bir anahtar olarak eklendi. Menü veya başlıkları gizlemeden, sayfayı ekranda göründüğü haliyle yazdırmayı etkinleştirir.
- **Yenilikler:** Popup altbilgisine tüm sürümlerin geçmişini İngilizce ve Türkçe sunan etkileşimli sürüm notları eklendi.

### Değişti

- **Tam "Bu Site" Modu:** Siteye özel ayarlar artık genel varsayılanlara veya üst alan adına düşmeden yalnızca ilgili tam alan adına uygulanır; sıfırlama yalnızca o siteyi etkiler.
- **Kapalıyken Sıfır Yük:** Tüm anahtarlar kapalıyken sayfada hiçbir izleyici çalıştırılmaz; gizli pencereler site ayarlarını diske yazmadan yalnızca bellekte tutar.
- **Gizlilik Politikası ve Lisanslar:** Tüm yerel izinleri ve paket içi bileşenleri birebir yansıtacak şekilde güncellendi.
- **11 Dilde Mağaza Sayfası:** Kısa açıklama her mağaza dilinde sade bir dille yeniden yazıldı; ekran görüntüleri dil dil yenilendi: o dildeki gerçek popup, doğal okunan metin ve düzgün kırılan başlıklarla.

### Kaldırıldı

- **Siteye Özgü Seçiciler:** Belirli sitelere yönelik kurallar kaldırıldı; tüm kilit açıcılar artık her sitede aynı evrensel kurallarla çalışır.

### Düzeltildi

- **Zengin Editörler ve Hassas Çerçeveler:** Kod editörleri ve web uygulamaları kendi seçim, pano ve kısayol davranışlarını korur. Ödeme, oturum açma ve CAPTCHA çerçevelerine müdahale edilmez.
- **Erişilebilirlik ve Tipografi:** Anahtar etiketleri, pencere odak kilidi, her iki temada WCAG AA kontrast uyumu, dile duyarlı çoğul ekleri ve Rusça için yerleşik Kiril yazı tipi eklendi.

### Güvenlik

- **Doğrulanmış Görsel İndirmeleri:** İndirmeler yalnızca görsel dosya türleriyle sınırlandırıldı; yönlendirme sonrası nihai adres denetimi ve uzantısı belirsiz SVG dosyaları için kayıt yeri onayı eklendi.
- **İzole Betik Köprüsü:** İzole dünya ile sayfa dünyası arasındaki iletişim kanalı yenilendi; web sayfalarının sahte mesaj göndererek korumaları devre dışı bırakması engellendi.

## 1.0.10 - 2026-10-28

**English**

*Precision Anti-Blur, Protected Image Downloads & Theme Polish*

Smarter blur detection for modern web apps, reliable context-menu image saving, and flicker-free theme transitions.

### Changed

- **Version Display & Store Visuals:** Full semantic version number shown in the popup footer alongside localized store previews.

### Fixed

- **Anti-Blur Precision:** Preserves decorative backdrop blur and gradients on modern AI and glassmorphic web apps, unblurring only obscured readable content and restoring exact original styles when toggled off.
- **Context-Menu Image Download:** Reliably extracts images behind transparent overlays, CSS backgrounds, `<canvas>` elements, and `blob:` URLs with clear status feedback. Also fixed "Clean Copy" and "Toggle All" synchronization.
- **Flicker-Free Theme Toggle:** Rapid theme switches register without dropped clicks or dark-frame flashes during view transitions.
- **Scroll Lock Detection:** Prevented temporary loading states from leaving pages permanently marked as scroll-unlocked.

**Türkçe**

*Hassas Anti-Blur, Korumalı Görsel İndirme ve Tema İyileştirmeleri*

Modern web uygulamaları için akıllı bulanıklık tespiti, güvenilir sağ tık görsel kaydetme ve pürüzsüz tema geçişleri.

### Değişti

- **Sürüm Gösterimi ve Mağaza Görselleri:** Popup altbilgisinde tam sürüm numarası gösterimi ve çok dilli mağaza önizlemeleri güncellendi.

### Düzeltildi

- **Hassas Anti-Blur:** Modern yapay zeka ve cam efektli arayüzlerdeki dekoratif bulanıklıkları ve gradyanları bozmaz; yalnızca okunması engellenen içeriği netleştirir ve kapatıldığında sayfayı eski haline döndürür.
- **Sağ Tık Görsel İndirme:** Saydam katman arkasındaki görsellerde, CSS arka planlarında, `<canvas>` öğelerinde ve `blob:` adreslerinde kararlı çalışır ve işlem durumunu bildirir. "Temiz Kopya" ve "Tümünü Aç/Kapat" eşitlemesi de düzeltildi.
- **Pürüzsüz Tema Geçişi:** Hızlı tema değişimleri eksiksiz algılanır; geçiş sırasındaki anlık ekran kararması giderildi.
- **Kaydırma Kilidi Tespiti:** Sayfa yüklenirken oluşan geçici durumların kaydırma kilidini kalıcı olarak açık bırakması önlendi.

## 1.0.9 - 2026-10-22

**English**

*Subdomain Settings Isolation & Mode Switching*

### Fixed

- **Subdomain Isolation:** Different subdomains under the same root domain no longer overwrite one another's toggle states.
- **Clean Mode Switching:** Switching between "This Site" and "Global" updates only the active scope without duplicating stored settings.
- **Banner Spacing:** Corrected vertical spacing between the domain bar and the inactive-page status card.

**Türkçe**

*Alt Alan Adı İzolasyonu ve Mod Geçişi*

### Düzeltildi

- **Alt Alan Adı Ayrımı:** Aynı kök alan adına bağlı farklı alt sitelerin birbirinin ayarlarını ezmesi engellendi.
- **Temiz Mod Geçişi:** "Bu Site" ve "Global" modları arasında geçiş yapmak artık ayar kopyası oluşturmadan yalnızca aktif kapsamı değiştirir.
- **Kart Boşluğu:** Alan adı çubuğu ile pasif sayfa uyarı kartı arasındaki dikey boşluk düzeltildi.

## 1.0.8 - 2026-10-22

**English**

*Restricted Browser Pages & Diagnostic Feedback*

### Fixed

- **Restricted Page Detection:** Recognizes extension stores and internal browser URLs (`chrome://`, `brave://`, `opera://`, `devtools://`), displaying a clear explanation instead of an ineffective reload prompt.
- **Problem Reporter Feedback:** Confirms clipboard copy with a visible "Copied!" state before opening the support page.

**Türkçe**

*Kısıtlı Tarayıcı Sayfaları ve Sorun Bildirimi*

### Düzeltildi

- **Kısıtlı Sayfa Tespiti:** Eklenti mağazaları ve tarayıcı iç sayfaları (`chrome://`, `brave://`, `opera://`, `devtools://`) tanınarak işlevsiz "sayfayı yenile" uyarısı yerine net bir bilgilendirme gösterilir.
- **Sorun Bildirimi Onayı:** Destek sayfası açılmadan önce raporun panoya kopyalandığını doğrulayan "Kopyalandı!" bildirimi gösterilir.

## 1.0.7 - 2026-10-22

**English**

*Real-Input Protection Testing & Computed Anti-Blur*

### Changed

- **End-to-End Verification:** Verified all unlockers against real-world content restrictions using hardware-level mouse and keyboard events.

### Fixed

- **Computed Blur Analysis:** Reading Clarity & Anti-Blur evaluates actual rendered styles rather than fragile CSS class names, cleanly reverting changes when disabled.
- **Resilient Text Selection:** Neutralizes late-bound selection blockers and transparent `::selection` color overrides.

**Türkçe**

*Gerçek Girdi Testleri ve Hesaplanmış Anti-Blur*

### Değişti

- **Uçtan Uca Doğrulama:** Tüm kilit açıcılar gerçek fare ve klavye olaylarıyla koruma tekniklerine karşı doğrulandı.

### Düzeltildi

- **Hesaplanmış Bulanıklık Analizi:** Okuma Netliği ve Anti-Blur, kırılgan sınıf adları yerine sayfanın gerçek boyama stillerini analiz eder ve kapatıldığında değişiklikleri temizce geri alır.
- **Dayanıklı Metin Seçimi:** Sonradan devreye giren seçim engelleyici betikler ve görünmez `::selection` renkleri etkisiz hale getirildi.

## 1.0.6 - 2026-10-22

**English**

*Dynamic Frame Coverage & Narrower Host Permissions*

### Added

- **Dynamic Frames:** Extended unlocker coverage into dynamically generated `about:blank`, `srcdoc`, `data:`, and `blob:` iframes.

### Changed

- **Narrower Network Permission:** Migrated from `declarativeNetRequest` to `declarativeNetRequestWithHostAccess`, eliminating the broad content-blocking install warning.

### Fixed

- **Top-Frame Diagnostics:** Popup status checks now query the top-level frame reliably instead of child iframes.

**Türkçe**

*Dinamik Çerçeve Desteği ve Daraltılmış İzinler*

### Eklendi

- **Dinamik Çerçeveler:** Sayfaların çalışma anında oluşturduğu `about:blank`, `srcdoc`, `data:` ve `blob:` çerçeveleri için destek eklendi.

### Değişti

- **Daraltılmış Ağ İzni:** `declarativeNetRequest` yerine daha dar kapsamlı `declarativeNetRequestWithHostAccess` iznine geçilerek kurulumdaki geniş kapsamlı uyarı kaldırıldı.

### Düzeltildi

- **Üst Çerçeve Teşhisi:** Popup durum sorgularının alt çerçeveler yerine doğrudan ana çerçeveden yanıt alması sağlandı.

## 1.0.5 - 2026-10-22

**English**

*Multilingual Store Presence (11 Languages)*

### Added

- **11-Language Store Listing:** Localized extension name, short summary, and Web Store listing across 11 browser languages.

**Türkçe**

*Çok Dilli Mağaza Desteği (11 Dil)*

### Eklendi

- **11 Dilde Mağaza Sayfası:** Eklenti adı, kısa açıklama ve mağaza sayfası tarayıcı diline uyum sağlayacak şekilde 11 dile çevrildi.

## 1.0.4 - 2026-10-22

**English**

*Embedded Frame Inheritance & Live Toggle Sync*

### Changed

- **Post-Update Reload Prompt:** Detects tabs opened prior to an extension update and offers a one-click page reload, with clearer Global mode descriptions.

### Fixed

- **Embedded Frame Settings:** Child iframes now inherit the active configuration of the host site they are embedded in.
- **Toggle All Accuracy:** "Toggle All" now reads the live runtime state of the active page before switching.

**Türkçe**

*Gömülü Çerçeve Uyumu ve Canlı Anahtar Eşitlemesi*

### Değişti

- **Güncelleme Sonrası Yenileme Uyarısı:** Güncellemeden önce açılmış sekmeleri algılayıp tek tıkla sayfa yenileme sunar; Global mod açıklaması netleştirildi.

### Düzeltildi

- **Gömülü Çerçeve Ayarları:** Sayfa içi çerçevelerin, gömülü oldukları ana sitenin aktif ayarlarını izlemesi sağlandı.
- **Tümünü Aç/Kapat Doğruluğu:** "Tümünü Aç/Kapat" düğmesi artık geçiş yapmadan önce sayfanın gerçek çalışma durumunu baz alır.

## 1.0.3 - 2026-10-22

**English**

*Cryptographic Bridge Token & CSP Hardening*

### Security

- **Authenticated Script Channel:** Protected cross-world script messages with a per-document cryptographic token.
- **Strict Extension CSP:** Applied a locked-down Content Security Policy across packaged extension pages.
- **Background Download Validation:** Added background-worker MIME checks and filename sanitization for image download requests.

**Türkçe**

*Kriptografik Köprü Anahtarı ve CSP Sertleştirmesi*

### Güvenlik

- **Doğrulanmış Betik İletişimi:** Betikler arası mesajlaşma sayfa başına üretilen tahmin edilemez anahtarla koruma altına alındı.
- **Sıkı Eklenti Güvenlik Politikası:** Tüm eklenti sayfalarına katı İçerik Güvenlik Politikası (CSP) uygulandı.
- **Arka Plan İndirme Denetimi:** İndirme istekleri için arka plan servisinde görsel doğrulaması ve güvenli dosya adı temizliği eklendi.

## 1.0.2 - 2026-10-22

**English**

*Local Network & Private IP Download Protection*

### Security

- **SSRF & LAN Guard:** Blocked Referer-assisted image download requests targeting `localhost` or private LAN addresses before dispatch.

**Türkçe**

*Yerel Ağ ve Özel IP İndirme Koruması*

### Güvenlik

- **Yerel Ağ Koruması:** Sayfa Referer bilgisi kullanan görsel indirmelerinin `localhost` veya yerel ağ (LAN) adreslerine yönlendirilmesi istek başlamadan engellendi.

## 1.0.1 - 2026-10-22

**English**

*Guided Support & Diagnostic Report Flow*

### Fixed

- **One-Click Problem Report:** Copies diagnostic details to the clipboard before opening the Web Store support tab, with step-by-step guidance in 10 languages.

**Türkçe**

*Yönlendirmeli Destek ve Sorun Bildirimi Akışı*

### Düzeltildi

- **Tek Tıkla Sorun Bildirimi:** Tanılama raporu önce panoya kopyalanır, ardından mağaza destek sekmesi açılarak 10 dilde adım adım yönlendirme sunulur.

## 1.0.0 - 2026-10-22

**English**

*First public release*

### Added

- **Initial Launch:** First public release of Selectra on the Chrome Web Store with core text, clipboard, context-menu, scroll, and visual unlockers.

**Türkçe**

*İlk genel sürüm*

### Eklendi

- **İlk Yayın:** Selectra; metin seçimi, pano, sağ tık menüsü, kaydırma ve görsel kilit açıcı çekirdeğiyle Chrome Web Store'da yayınlandı.
