/**
 * Selectra - Internationalization (i18n) Engine
 * Conforming to blader/humanizer standards (natural human phrasing, zero filler, zero sales jargon)
 * Supported Languages:
 *   - en: English (DEFAULT)
 *   - tr: Türkçe
 *   - de: Deutsch
 *   - fr: Français
 *   - es: Español
 *   - pt: Português
 *   - it: Italiano
 *   - ru: Русский
 *   - pl: Polski
 *   - nl: Nederlands
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SuperUnlockerI18n = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LANGUAGES = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'tr', label: 'Türkçe', short: 'TR' },
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'pt', label: 'Português', short: 'PT' },
    { code: 'it', label: 'Italiano', short: 'IT' },
    { code: 'ru', label: 'Русский', short: 'RU' },
    { code: 'pl', label: 'Polski', short: 'PL' },
    { code: 'nl', label: 'Nederlands', short: 'NL' }
  ];

  const TRANSLATIONS = {
    en: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Active tab',
      badgeGlobalTab: 'All sites (Global)',
      modeSite: 'This site',
      modeGlobal: 'Global',
      themeToggleTitle: 'Toggle theme',
      langToggleTitle: 'Change language',
      statusAllOff: 'All controls off',
      statusAllOn: 'All unlockers active',
      statusActiveCount: { one: '{n} active', other: '{n} active' },

      scannerTitle: 'Protection Diagnosis',
      scannerClean: 'No restrictions detected on this page',
      scannerDetected: { one: '{n} restriction found and bypassed:', other: '{n} restrictions found and bypassed:' },
      barrierRightClick: 'Right-click blocked',
      barrierSelection: 'Selection blocked (user-select)',
      barrierCopy: 'Clipboard / copy blocked',
      barrierScroll: 'Scroll locked',
      barrierBlur: 'Visual blur filter',
      barrierAlert: 'Popup alert trap',

      secUnlockers: 'Core Unlockers',
      secMedia: 'Media and Downloads',
      secPageTools: 'Page Tools',

      featRightClickTitle: 'Right Click',
      featRightClickDesc: 'Restore right-click context menus',
      featCopyTitle: 'Text Selection and Copy',
      featCopyDesc: 'Bypass CSS and JavaScript copy blocks',
      featClipboardTitle: 'Clipboard Protection',
      featClipboardDesc: 'Stop websites from adding links or credits to copied text',
      featKeyboardTitle: 'Keyboard Shortcuts',
      featKeyboardDesc: 'Keep F12, developer tools, view source, and save working',

      featDragDropTitle: 'Direct Image Drag',
      featDragDropDesc: 'Drag images straight to your desktop as files',
      featAltClickTitle: 'Alt-Click Quick Download',
      featAltClickDesc: 'Hold Alt and click any image to save it immediately',

      featScrollbarTitle: 'Scroll Restoration',
      featScrollbarDesc: 'Restore hidden or locked page scrolling',
      featAlertTitle: 'Block Protection Popups',
      featAlertDesc: 'Silence copy-warning alert boxes and overlays',
      featAntiBlurTitle: 'Reading Clarity & Anti-Blur',
      featAntiBlurDesc: 'Clear blurred text. Pages also won’t see when the tab is hidden',
      featPrintTitle: 'Print Unlock',
      featPrintDesc: 'Make pages that block printing printable',
      scannerDetectedOnly: { one: '{n} restriction found on this page:', other: '{n} restrictions found on this page:' },
      pdfPage: 'Selectra cannot run inside the PDF viewer.',
      btnGlobalOff: 'Turn off Global mode',
      resetTitle: 'Reset the settings shown here',
      modeGroupLabel: 'Where the settings apply',
      langListLabel: 'Language',
      issueCategoryLabel: 'What is it about?',
      statusPartial: 'Some controls on',
      featEditTitle: 'Page Editor',
      featEditDesc: 'Make page text directly editable in place',

      btnUnlockAll: 'Unlock All',
      btnLockAll: 'Lock All',
      btnReloadPage: 'Reload Page',
      pageNotReady: 'Selectra isn’t running on this page yet. Reload the page to apply your settings.',
      pageBlocked: 'Selectra still can’t reach this page. Some pages, such as browser stores and internal pages, don’t allow extensions.',
      globalModeHint: 'Global mode applies to every site. Each site’s own settings are paused until you switch back to “This site”.',
      btnReset: 'Reset',
      btnContact: 'Report Issue',
      contactTitle: 'Report Issue / Contact',
      contactDesc: 'Found a locked site or bug? Let us know.',
      catSiteLocked: 'Site locked',
      catBug: 'Bug / Glitch',
      catFeature: 'Feature idea',
      contactNotesLabel: 'Notes / Details',
      contactOptionalTag: 'Optional',
      contactNotesPlaceholder: 'What happened on this website?',
      contactTelemetryDetails: 'Diagnostics included',
      contactLivePage: 'Live page',
      contactBarriersCount: { one: '{n} restriction', other: '{n} restrictions' },
      contactCopiedFeedback: 'Copied!',
      btnCopyDiagnostics: 'Copy Diagnostics',
      btnOpenSupport: 'Copy & open support',
      contactSupportHint: 'Copies the report and opens the store’s support page. There, press “Contact the developer” and paste (Ctrl+V).',
      legalNavLabel: 'Legal information',
      legalPrivacy: 'Privacy Policy',
      legalLicenses: 'Open-source licenses',
      legalChangelog: 'What’s new',
      legalClose: 'Close',
      legalOpenTab: 'Open in new tab',
      legalEnglishOnly: 'The full text is in English.',
      legalChangelogNote: 'The notes are in English and Turkish.',
      footerText: 'Selectra',

      toastAllUnlocked: 'All unlockers activated',
      toastAllLocked: 'All unlockers disabled',
      toastPageReloaded: 'Page reloaded',
      toastDiagnosticsCopied: 'Diagnostic report copied to clipboard',
      toastResetSite: 'Settings reset for this site',
      toastResetGlobal: 'Global settings reset',
      unsupportedPage: 'Extension cannot run on this system page.',

    },

    tr: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Aktif sekme',
      badgeGlobalTab: 'Tüm siteler (Global)',
      modeSite: 'Bu site',
      modeGlobal: 'Global',
      themeToggleTitle: 'Temayı değiştir',
      langToggleTitle: 'Dili değiştir',
      statusAllOff: 'Tüm kontroller kapalı',
      statusAllOn: 'Tüm kilit açıcılar açık',
      statusActiveCount: { other: '{n} aktif' },

      scannerTitle: 'Sayfa Koruma Teşhisi',
      scannerClean: 'Sayfada kısıtlama tespit edilmedi',
      scannerDetected: { other: '{n} kısıtlama tespit edildi ve aşıldı:' },
      barrierRightClick: 'Sağ tık engelli',
      barrierSelection: 'Metin seçimi engelli (user-select)',
      barrierCopy: 'Kopyalama engelli',
      barrierScroll: 'Kaydırma kilitli',
      barrierBlur: 'Görsel bulanıklık filtresi',
      barrierAlert: 'Uyarı penceresi (Alert)',

      secUnlockers: 'Kilit Açıcılar',
      secMedia: 'Medya & Görseller',
      secPageTools: 'Sayfa Araçları',

      featRightClickTitle: 'Sağ Tık',
      featRightClickDesc: 'Bağlam menüsü engelini kaldır',
      featCopyTitle: 'Metin Seçimi & Kopyalama',
      featCopyDesc: 'CSS ve JS kopyalama engellerini kaldır',
      featClipboardTitle: 'Pano Koruması',
      featClipboardDesc: 'Kopyalanan metne link ve lisans eklenmesini engelle',
      featKeyboardTitle: 'Klavye Kısayolları',
      featKeyboardDesc: 'F12, DevTools, kaynak ve kaydetme engellerini aç',

      featDragDropTitle: 'Akıllı Görsel Sürükleme',
      featDragDropDesc: 'Görselleri doğrudan dosya olarak masaüstüne sürükle',
      featAltClickTitle: 'Alt+Click ile Hızlı İndir',
      featAltClickDesc: 'Alt tuşuna basılı tutup görsele tıklayarak kaydet',

      featScrollbarTitle: 'Akıllı Scrollbar',
      featScrollbarDesc: 'Kilitli veya gizlenen sayfa kaydırmasını kurtar',
      featAlertTitle: 'Uyarı & Pop-up Susturucu',
      featAlertDesc: 'Kopya koruma uyarı pencerelerini sustur',
      featAntiBlurTitle: 'Okuma Netliği ve Bulanıklık Önleyici',
      featAntiBlurDesc: 'Bulanık metni netleştir. Sayfalar sekmenin gizlendiğini de fark etmez',
      featPrintTitle: 'Yazdırma Kilidi',
      featPrintDesc: 'Yazdırmayı engelleyen sayfaları yazdırılabilir yap',
      scannerDetectedOnly: { other: 'Bu sayfada {n} kısıtlama tespit edildi:' },
      pdfPage: 'Selectra PDF görüntüleyicisinin içinde çalışamaz.',
      btnGlobalOff: 'Genel modu kapat',
      resetTitle: 'Burada görünen ayarları sıfırla',
      modeGroupLabel: 'Ayarların geçerli olduğu yer',
      langListLabel: 'Dil',
      issueCategoryLabel: 'Konu nedir?',
      statusPartial: 'Bazı denetimler açık',
      featEditTitle: 'Sayfa Düzenleme',
      featEditDesc: 'Sayfayı geçici olarak doğrudan düzenlenebilir yap',

      btnUnlockAll: 'Tüm Kilitleri Aç',
      btnLockAll: 'Kilitleri Kapat',
      btnReloadPage: 'Sayfayı Yenile',
      pageNotReady: 'Selectra bu sayfada henüz çalışmıyor. Ayarların uygulanması için sayfayı yenileyin.',
      pageBlocked: 'Selectra bu sayfaya hâlâ ulaşamıyor. Tarayıcı mağazaları ve iç sayfalar gibi bazı sayfalar eklentilere izin vermez.',
      globalModeHint: 'Global mod tüm sitelere uygulanır. Sitelerin kendi ayarları, “Bu site”ye dönene kadar duraklatılır.',
      btnReset: 'Sıfırla',
      btnContact: 'Sorun Bildir',
      contactTitle: 'Sorun Bildir / İletişim',
      contactDesc: 'Kilitli bir site veya hata mı buldunuz? Bize iletin.',
      catSiteLocked: 'Site kilitli',
      catBug: 'Eklenti hatası',
      catFeature: 'Öneri / Fikir',
      contactNotesLabel: 'Notlar / Detaylar',
      contactOptionalTag: 'İsteğe bağlı',
      contactNotesPlaceholder: 'Bu sitede nasıl bir engelle karşılaştınız?',
      contactTelemetryDetails: 'Teşhis bilgileri ekli',
      contactLivePage: 'Canlı sayfa',
      contactBarriersCount: { other: '{n} engel algılandı' },
      contactCopiedFeedback: 'Kopyalandı!',
      btnCopyDiagnostics: 'Teşhisi Kopyala',
      btnOpenSupport: 'Kopyala ve destek aç',
      contactSupportHint: 'Raporu kopyalar ve mağazanın destek sayfasını açar. Sayfadaki iletişim düğmesine basıp raporu yapıştırın (Ctrl+V).',
      legalNavLabel: 'Yasal bilgiler',
      legalPrivacy: 'Gizlilik Politikası',
      legalLicenses: 'Açık kaynak lisansları',
      legalChangelog: 'Yenilikler',
      legalClose: 'Kapat',
      legalOpenTab: 'Yeni sekmede aç',
      legalEnglishOnly: 'Metnin tamamı İngilizcedir.',
      legalChangelogNote: 'Notlar İngilizce ve Türkçedir.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Tüm kilit açıcılar açıldı',
      toastAllLocked: 'Tüm kilit açıcılar kapatıldı',
      toastPageReloaded: 'Sayfa yenilendi',
      toastDiagnosticsCopied: 'Teşhis raporu panoya kopyalandı',
      toastResetSite: 'Bu site için ayarlar sıfırlandı',
      toastResetGlobal: 'Global ayarlar sıfırlandı',
      unsupportedPage: 'Bu sistem sayfasında eklenti çalıştırılamaz.',

    },

    de: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Aktiver Tab',
      badgeGlobalTab: 'Alle Websites (Global)',
      modeSite: 'Diese Website',
      modeGlobal: 'Global',
      themeToggleTitle: 'Design wechseln',
      langToggleTitle: 'Sprache ändern',
      statusAllOff: 'Alle Schutzfunktionen aus',
      statusAllOn: 'Alle Entsperrer aktiv',
      statusActiveCount: { one: '{n} aktiv', other: '{n} aktiv' },

      scannerTitle: 'Seitenschutz-Diagnose',
      scannerClean: 'Keine Einschränkungen auf dieser Seite gefunden',
      scannerDetected: { one: '{n} Schutzbarriere erkannt und umgangen:', other: '{n} Schutzbarrieren erkannt und umgangen:' },
      barrierRightClick: 'Rechtsklick blockiert',
      barrierSelection: 'Textauswahl blockiert (user-select)',
      barrierCopy: 'Kopieren blockiert',
      barrierScroll: 'Scrollen gesperrt',
      barrierBlur: 'Visueller Unschärfefilter',
      barrierAlert: 'Warnungs-Popup',

      secUnlockers: 'Kern-Entsperrer',
      secMedia: 'Medien & Downloads',
      secPageTools: 'Seiten-Werkzeuge',

      featRightClickTitle: 'Rechtsklick',
      featRightClickDesc: 'Rechtsklick-Kontextmenü wiederherstellen',
      featCopyTitle: 'Textauswahl & Kopieren',
      featCopyDesc: 'CSS- und JavaScript-Kopiersperren umgehen',
      featClipboardTitle: 'Zwischenablage-Schutz',
      featClipboardDesc: 'Verhindert das Anhängen ungefragter Links an kopierten Text',
      featKeyboardTitle: 'Tastenkürzel',
      featKeyboardDesc: 'F12, Entwicklertools, Quelltext und Speichern nutzbar halten',

      featDragDropTitle: 'Direktes Bild-Ziehen',
      featDragDropDesc: 'Bilder direkt als Datei auf den Schreibtisch ziehen',
      featAltClickTitle: 'Alt+Klick Schnell-Download',
      featAltClickDesc: 'Alt gedrückt halten und Bild anklicken zum Speichern',

      featScrollbarTitle: 'Scroll-Wiederherstellung',
      featScrollbarDesc: 'Verstecktes oder blockiertes Scrollen reaktivieren',
      featAlertTitle: 'Warnungs-Blocker',
      featAlertDesc: 'Kopierschutz-Popups und Warnmeldungen stummschalten',
      featAntiBlurTitle: 'Lesbarkeit & Anti-Unschärfe',
      featAntiBlurDesc: 'Unscharfen Text lesbar machen. Seiten merken auch nicht, wenn der Tab verborgen ist',
      featPrintTitle: 'Drucken freigeben',
      featPrintDesc: 'Seiten bedruckbar machen, die das Drucken blockieren',
      scannerDetectedOnly: { one: '{n} Schutzbarriere auf dieser Seite erkannt:', other: '{n} Schutzbarrieren auf dieser Seite erkannt:' },
      pdfPage: 'Selectra läuft nicht im PDF-Viewer.',
      btnGlobalOff: 'Globalen Modus beenden',
      resetTitle: 'Die hier angezeigten Einstellungen zurücksetzen',
      modeGroupLabel: 'Geltungsbereich der Einstellungen',
      langListLabel: 'Sprache',
      issueCategoryLabel: 'Worum geht es?',
      statusPartial: 'Einige Steuerungen an',
      featEditTitle: 'Seiten-Editor',
      featEditDesc: 'Text auf der aktuellen Seite direkt bearbeitbar machen',

      btnUnlockAll: 'Alles entsperren',
      btnLockAll: 'Alles sperren',
      btnReloadPage: 'Seite neu laden',
      pageNotReady: 'Selectra läuft auf dieser Seite noch nicht. Laden Sie die Seite neu, damit Ihre Einstellungen gelten.',
      pageBlocked: 'Selectra erreicht diese Seite weiterhin nicht. Manche Seiten, etwa Browser-Stores und interne Seiten, erlauben keine Erweiterungen.',
      globalModeHint: 'Der globale Modus gilt für jede Website. Die eigenen Einstellungen der Websites ruhen, bis Sie zu „Diese Website“ zurückwechseln.',
      btnReset: 'Zurücksetzen',
      btnContact: 'Problem melden',
      contactTitle: 'Problem melden / Kontakt',
      contactDesc: 'Gesperrte Seite oder Fehler gefunden? Teilen Sie es uns mit.',
      catSiteLocked: 'Seite wird nicht entsperrt',
      catBug: 'Fehler / Bug',
      catFeature: 'Funktionsidee',
      contactNotesLabel: 'Hinweise / Details',
      contactOptionalTag: 'Optional',
      contactNotesPlaceholder: 'Was ist auf dieser Website passiert?',
      contactTelemetryDetails: 'Diagnose enthalten',
      contactLivePage: 'Live-Seite',
      contactBarriersCount: { one: '{n} Sperre', other: '{n} Sperren' },
      contactCopiedFeedback: 'Kopiert!',
      btnCopyDiagnostics: 'Diagnose kopieren',
      btnOpenSupport: 'Kopieren & Support öffnen',
      contactSupportHint: 'Kopiert den Bericht und öffnet die Support-Seite des Stores. Dort auf die Kontakt-Schaltfläche klicken und einfügen (Strg+V).',
      legalNavLabel: 'Rechtliche Hinweise',
      legalPrivacy: 'Datenschutzerklärung',
      legalLicenses: 'Open-Source-Lizenzen',
      legalChangelog: 'Neuerungen',
      legalClose: 'Schließen',
      legalOpenTab: 'In neuem Tab öffnen',
      legalEnglishOnly: 'Der vollständige Text ist nur auf Englisch verfügbar.',
      legalChangelogNote: 'Die Hinweise gibt es auf Englisch und Türkisch.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Alle Entsperrer aktiviert',
      toastAllLocked: 'Alle Entsperrer deaktiviert',
      toastPageReloaded: 'Seite neu geladen',
      toastDiagnosticsCopied: 'Diagnosebericht in Zwischenablage kopiert',
      toastResetSite: 'Einstellungen für diese Website zurückgesetzt',
      toastResetGlobal: 'Globale Einstellungen zurückgesetzt',
      unsupportedPage: 'Erweiterung kann auf dieser Systemseite nicht ausgeführt werden.',

    },

    fr: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Onglet actif',
      badgeGlobalTab: 'Tous les sites (Global)',
      modeSite: 'Ce site',
      modeGlobal: 'Global',
      themeToggleTitle: 'Changer de thème',
      langToggleTitle: 'Changer de langue',
      statusAllOff: 'Toutes les protections désactivées',
      statusAllOn: 'Tous les débloqueurs actifs',
      statusActiveCount: { one: '{n} actif', other: '{n} actifs' },

      scannerTitle: 'Diagnostic de protection',
      scannerClean: 'Aucune restriction détectée sur cette page',
      scannerDetected: { one: '{n} restriction détectée et contournée :', other: '{n} restrictions détectées et contournées :' },
      barrierRightClick: 'Clic droit bloqué',
      barrierSelection: 'Sélection bloquée (user-select)',
      barrierCopy: 'Presse-papiers / copie bloquée',
      barrierScroll: 'Défilement verrouillé',
      barrierBlur: 'Filtre de flou visuel',
      barrierAlert: 'Alerte contextuelle bloquante',

      secUnlockers: 'Débloqueurs principaux',
      secMedia: 'Médias et téléchargements',
      secPageTools: 'Outils de page',

      featRightClickTitle: 'Clic droit',
      featRightClickDesc: 'Restaure le menu contextuel du clic droit',
      featCopyTitle: 'Sélection et copie de texte',
      featCopyDesc: 'Supprime les blocages de copie en CSS et JavaScript',
      featClipboardTitle: 'Protection du presse-papiers',
      featClipboardDesc: 'Empêche les sites d\'ajouter des liens au texte copié',
      featKeyboardTitle: 'Raccourcis clavier',
      featKeyboardDesc: 'Conserve F12, outils de développement et sauvegarde actifs',

      featDragDropTitle: 'Glisser-déposer d\'images',
      featDragDropDesc: 'Glissez les images directement sur le bureau comme fichiers',
      featAltClickTitle: 'Téléchargement rapide Alt+Clic',
      featAltClickDesc: 'Maintenez Alt et cliquez sur une image pour l\'enregistrer',

      featScrollbarTitle: 'Restauration du défilement',
      featScrollbarDesc: 'Restaure le défilement masqué ou verrouillé',
      featAlertTitle: 'Bloqueur d\'alertes',
      featAlertDesc: 'Désactive les pop-ups et fenêtres d\'avertissement de copie',
      featAntiBlurTitle: 'Netteté de lecture et anti-flou',
      featAntiBlurDesc: 'Rend le texte flouté lisible. Les pages ne voient pas non plus que l’onglet est masqué',
      featPrintTitle: 'Impression libérée',
      featPrintDesc: 'Rend imprimables les pages qui bloquent l’impression',
      scannerDetectedOnly: { one: '{n} restriction détectée sur cette page :', other: '{n} restrictions détectées sur cette page :' },
      pdfPage: 'Selectra ne peut pas fonctionner dans la visionneuse PDF.',
      btnGlobalOff: 'Désactiver le mode global',
      resetTitle: 'Réinitialiser les réglages affichés ici',
      modeGroupLabel: 'Portée des réglages',
      langListLabel: 'Langue',
      issueCategoryLabel: 'De quoi s’agit-il ?',
      statusPartial: 'Certains contrôles activés',
      featEditTitle: 'Éditeur de page',
      featEditDesc: 'Rend le texte de la page directement modifiable',

      btnUnlockAll: 'Tout débloquer',
      btnLockAll: 'Tout bloquer',
      btnReloadPage: 'Recharger la page',
      pageNotReady: 'Selectra n’est pas encore actif sur cette page. Rechargez la page pour appliquer vos réglages.',
      pageBlocked: 'Selectra ne parvient toujours pas à atteindre cette page. Certaines pages, comme les boutiques de navigateur et les pages internes, n’autorisent pas les extensions.',
      globalModeHint: 'Le mode Global s’applique à tous les sites. Les réglages propres à chaque site sont suspendus jusqu’au retour à « Ce site ».',
      btnReset: 'Réinitialiser',
      btnContact: 'Signaler un problème',
      contactTitle: 'Signaler un problème / Contact',
      contactDesc: 'Site bloqué ou anomalie ? Faites-le nous savoir.',
      catSiteLocked: 'Site non débloqué',
      catBug: 'Bogue / Erreur',
      catFeature: 'Suggestion',
      contactNotesLabel: 'Remarques / Détails',
      contactOptionalTag: 'Optionnel',
      contactNotesPlaceholder: "Que s'est-il passé sur ce site ?",
      contactTelemetryDetails: 'Diagnostic inclus',
      contactLivePage: 'Page active',
      contactBarriersCount: { one: '{n} restriction', other: '{n} restrictions' },
      contactCopiedFeedback: 'Copié !',
      btnCopyDiagnostics: 'Copier diagnostic',
      btnOpenSupport: 'Copier et ouvrir le support',
      contactSupportHint: 'Copie le rapport et ouvre la page d’assistance du Store. Cliquez sur le bouton de contact, puis collez (Ctrl+V).',
      legalNavLabel: 'Informations légales',
      legalPrivacy: 'Politique de confidentialité',
      legalLicenses: 'Licences open source',
      legalChangelog: 'Nouveautés',
      legalClose: 'Fermer',
      legalOpenTab: 'Ouvrir dans un nouvel onglet',
      legalEnglishOnly: 'Le texte complet n’est disponible qu’en anglais.',
      legalChangelogNote: 'Les notes sont en anglais et en turc.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Tous les débloqueurs sont activés',
      toastAllLocked: 'Tous les débloqueurs sont désactivés',
      toastPageReloaded: 'Page rechargée',
      toastDiagnosticsCopied: 'Rapport de diagnostic copié dans le presse-papiers',
      toastResetSite: 'Paramètres réinitialisés pour ce site',
      toastResetGlobal: 'Paramètres globaux réinitialisés',
      unsupportedPage: 'L\'extension ne peut pas fonctionner sur cette page système.',

    },

    es: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Pestaña activa',
      badgeGlobalTab: 'Todos los sitios (Global)',
      modeSite: 'Este sitio',
      modeGlobal: 'Global',
      themeToggleTitle: 'Cambiar tema',
      langToggleTitle: 'Cambiar idioma',
      statusAllOff: 'Todos los controles desactivados',
      statusAllOn: 'Todos los desbloqueadores activos',
      statusActiveCount: { one: '{n} activo', other: '{n} activos' },

      scannerTitle: 'Diagnóstico de protección',
      scannerClean: 'No se detectaron restricciones en esta página',
      scannerDetected: { one: '{n} restricción detectada y omitida:', other: '{n} restricciones detectadas y omitidas:' },
      barrierRightClick: 'Clic derecho bloqueado',
      barrierSelection: 'Selección bloqueada (user-select)',
      barrierCopy: 'Portapapeles / copia bloqueada',
      barrierScroll: 'Desplazamiento bloqueado',
      barrierBlur: 'Filtro de desenfoque visual',
      barrierAlert: 'Ventana emergente de aviso',

      secUnlockers: 'Desbloqueadores clave',
      secMedia: 'Medios y descargas',
      secPageTools: 'Herramientas de página',

      featRightClickTitle: 'Clic derecho',
      featRightClickDesc: 'Restaura el menú contextual del clic derecho',
      featCopyTitle: 'Selección y copia de texto',
      featCopyDesc: 'Elimina restricciones de copia en CSS y JavaScript',
      featClipboardTitle: 'Protección del portapapeles',
      featClipboardDesc: 'Evita que los sitios agreguen enlaces al texto copiado',
      featKeyboardTitle: 'Atajos de teclado',
      featKeyboardDesc: 'Mantiene activos F12, herramientas de desarrollo y guardar',

      featDragDropTitle: 'Arrastre directo de imágenes',
      featDragDropDesc: 'Arrastra imágenes directamente al escritorio como archivos',
      featAltClickTitle: 'Descarga rápida Alt+Clic',
      featAltClickDesc: 'Mantén pulsado Alt y haz clic en una imagen para guardarla',

      featScrollbarTitle: 'Restauración de desplazamiento',
      featScrollbarDesc: 'Recupera el desplazamiento bloqueado u oculto',
      featAlertTitle: 'Bloqueador de avisos',
      featAlertDesc: 'Silencia ventanas emergentes y alertas de copia',
      featAntiBlurTitle: 'Claridad de lectura y anti-desenfoque',
      featAntiBlurDesc: 'Aclara el texto borroso. Las páginas tampoco notan que la pestaña está oculta',
      featPrintTitle: 'Desbloqueo de impresión',
      featPrintDesc: 'Permite imprimir páginas que bloquean la impresión',
      scannerDetectedOnly: { one: '{n} restricción detectada en esta página:', other: '{n} restricciones detectadas en esta página:' },
      pdfPage: 'Selectra no puede funcionar dentro del visor de PDF.',
      btnGlobalOff: 'Desactivar el modo global',
      resetTitle: 'Restablecer los ajustes mostrados aquí',
      modeGroupLabel: 'Alcance de los ajustes',
      langListLabel: 'Idioma',
      issueCategoryLabel: '¿De qué se trata?',
      statusPartial: 'Algunos controles activados',
      featEditTitle: 'Editor de página',
      featEditDesc: 'Permite editar el contenido de la página directamente',

      btnUnlockAll: 'Desbloquear todo',
      btnLockAll: 'Bloquear todo',
      btnReloadPage: 'Recargar página',
      pageNotReady: 'Selectra aún no se está ejecutando en esta página. Recarga la página para aplicar tus ajustes.',
      pageBlocked: 'Selectra sigue sin poder acceder a esta página. Algunas páginas, como las tiendas del navegador y las páginas internas, no permiten extensiones.',
      globalModeHint: 'El modo Global se aplica a todos los sitios. Los ajustes propios de cada sitio quedan en pausa hasta que vuelvas a «Este sitio».',
      btnReset: 'Restablecer',
      btnContact: 'Informar problema',
      contactTitle: 'Informar problema / Contacto',
      contactDesc: '¿Encontraste un sitio bloqueado o error? Avísanos.',
      catSiteLocked: 'Sitio no se desbloquea',
      catBug: 'Error / Fallo',
      catFeature: 'Sugerencia',
      contactNotesLabel: 'Notas / Detalles',
      contactOptionalTag: 'Opcional',
      contactNotesPlaceholder: '¿Qué ocurrió en este sitio web?',
      contactTelemetryDetails: 'Diagnóstico incluido',
      contactLivePage: 'Página activa',
      contactBarriersCount: { one: '{n} bloqueo', other: '{n} bloqueos' },
      contactCopiedFeedback: '¡Copiado!',
      btnCopyDiagnostics: 'Copiar diagnóstico',
      btnOpenSupport: 'Copiar y abrir soporte',
      contactSupportHint: 'Copia el informe y abre la página de soporte de la tienda. Pulsa el botón de contacto y pega (Ctrl+V).',
      legalNavLabel: 'Información legal',
      legalPrivacy: 'Política de privacidad',
      legalLicenses: 'Licencias de código abierto',
      legalChangelog: 'Novedades',
      legalClose: 'Cerrar',
      legalOpenTab: 'Abrir en una pestaña nueva',
      legalEnglishOnly: 'El texto completo solo está disponible en inglés.',
      legalChangelogNote: 'Las notas están en inglés y turco.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Todos los desbloqueadores activados',
      toastAllLocked: 'Todos los desbloqueadores desactivados',
      toastPageReloaded: 'Página recargada',
      toastDiagnosticsCopied: 'Informe de diagnóstico copiado al portapapeles',
      toastResetSite: 'Ajustes restablecidos para este sitio',
      toastResetGlobal: 'Ajustes globales restablecidos',
      unsupportedPage: 'La extensión no se puede ejecutar en páginas del sistema.',

    },

    pt: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Aba ativa',
      badgeGlobalTab: 'Todos os sites (Global)',
      modeSite: 'Este site',
      modeGlobal: 'Global',
      themeToggleTitle: 'Alternar tema',
      langToggleTitle: 'Alterar idioma',
      statusAllOff: 'Todos os controles desativados',
      statusAllOn: 'Todos os desbloqueadores ativos',
      statusActiveCount: { one: '{n} ativo', other: '{n} ativos' },

      scannerTitle: 'Diagnóstico de proteção',
      scannerClean: 'Nenhuma restrição detectada nesta página',
      scannerDetected: { one: '{n} restrição detectada e contornada:', other: '{n} restrições detectadas e contornadas:' },
      barrierRightClick: 'Clique com botão direito bloqueado',
      barrierSelection: 'Seleção bloqueada (user-select)',
      barrierCopy: 'Área de transferência bloqueada',
      barrierScroll: 'Rolagem bloqueada',
      barrierBlur: 'Filtro de desfoque visual',
      barrierAlert: 'Aviso pop-up de cópia',

      secUnlockers: 'Desbloqueadores principais',
      secMedia: 'Mídia e downloads',
      secPageTools: 'Ferramentas de página',

      featRightClickTitle: 'Botão direito',
      featRightClickDesc: 'Restaura o menu de contexto do botão direito',
      featCopyTitle: 'Seleção e cópia de texto',
      featCopyDesc: 'Remove bloqueios de cópia por CSS e JavaScript',
      featClipboardTitle: 'Proteção da área de transferência',
      featClipboardDesc: 'Impede que sites adicionem links ao texto copiado',
      featKeyboardTitle: 'Atalhos de teclado',
      featKeyboardDesc: 'Mantém F12, ferramentas de desenvolvedor e salvar ativos',

      featDragDropTitle: 'Arrasto direto de imagens',
      featDragDropDesc: 'Arraste imagens diretamente para a área de trabalho como arquivo',
      featAltClickTitle: 'Download rápido Alt+Clique',
      featAltClickDesc: 'Segure Alt e clique em qualquer imagem para salvar',

      featScrollbarTitle: 'Restauração de rolagem',
      featScrollbarDesc: 'Restaura a rolagem de página oculta ou travada',
      featAlertTitle: 'Bloqueador de avisos',
      featAlertDesc: 'Silencia alertas e janelas de proteção contra cópia',
      featAntiBlurTitle: 'Clareza de leitura e anti-desfoque',
      featAntiBlurDesc: 'Clareia o texto borrado. As páginas também não percebem que a aba está oculta',
      featPrintTitle: 'Desbloqueio de impressão',
      featPrintDesc: 'Permite imprimir páginas que bloqueiam a impressão',
      scannerDetectedOnly: { one: '{n} restrição detectada nesta página:', other: '{n} restrições detectadas nesta página:' },
      pdfPage: 'O Selectra não funciona dentro do visualizador de PDF.',
      btnGlobalOff: 'Desativar o modo global',
      resetTitle: 'Redefinir as configurações mostradas aqui',
      modeGroupLabel: 'Alcance das configurações',
      langListLabel: 'Idioma',
      issueCategoryLabel: 'Sobre o quê?',
      statusPartial: 'Alguns controles ativados',
      featEditTitle: 'Editor de página',
      featEditDesc: 'Torna o texto da página diretamente editável',

      btnUnlockAll: 'Desbloquear tudo',
      btnLockAll: 'Bloquear tudo',
      btnReloadPage: 'Recarregar página',
      pageNotReady: 'O Selectra ainda não está em execução nesta página. Recarregue a página para aplicar suas configurações.',
      pageBlocked: 'O Selectra ainda não consegue acessar esta página. Algumas páginas, como as lojas do navegador e as páginas internas, não permitem extensões.',
      globalModeHint: 'O modo Global vale para todos os sites. As configurações próprias de cada site ficam em pausa até você voltar para «Este site».',
      btnReset: 'Redefinir',
      btnContact: 'Reportar problema',
      contactTitle: 'Reportar problema / Contato',
      contactDesc: 'Encontrou um site bloqueado ou bug? Conte para nós.',
      catSiteLocked: 'Site não desbloqueia',
      catBug: 'Erro / Falha',
      catFeature: 'Sugestão',
      contactNotesLabel: 'Notas / Detalhes',
      contactOptionalTag: 'Opcional',
      contactNotesPlaceholder: 'O que aconteceu neste site?',
      contactTelemetryDetails: 'Diagnóstico incluído',
      contactLivePage: 'Página ativa',
      contactBarriersCount: { one: '{n} bloqueio', other: '{n} bloqueios' },
      contactCopiedFeedback: 'Copiado!',
      btnCopyDiagnostics: 'Copiar diagnóstico',
      btnOpenSupport: 'Copiar e abrir suporte',
      contactSupportHint: 'Copia o relatório e abre a página de suporte da loja. Clique no botão de contato e cole (Ctrl+V).',
      legalNavLabel: 'Informações legais',
      legalPrivacy: 'Política de privacidade',
      legalLicenses: 'Licenças de código aberto',
      legalChangelog: 'Novidades',
      legalClose: 'Fechar',
      legalOpenTab: 'Abrir em nova guia',
      legalEnglishOnly: 'O texto completo está disponível apenas em inglês.',
      legalChangelogNote: 'As notas estão em inglês e turco.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Todos os desbloqueadores ativados',
      toastAllLocked: 'Todos os desbloqueadores desativados',
      toastPageReloaded: 'Página recarregada',
      toastDiagnosticsCopied: 'Relatório de diagnóstico copiado',
      toastResetSite: 'Configurações redefinidas para este site',
      toastResetGlobal: 'Configurações globais redefinidas',
      unsupportedPage: 'A extensão não pode ser executada nesta página do sistema.',

    },

    it: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Scheda attiva',
      badgeGlobalTab: 'Tutti i siti (Globale)',
      modeSite: 'Questo sito',
      modeGlobal: 'Globale',
      themeToggleTitle: 'Cambia tema',
      langToggleTitle: 'Cambia lingua',
      statusAllOff: 'Tutti i controlli disattivati',
      statusAllOn: 'Tutti gli sblocchi attivi',
      statusActiveCount: { one: '{n} attivo', other: '{n} attivi' },

      scannerTitle: 'Diagnosi di protezione',
      scannerClean: 'Nessuna restrizione rilevata in questa pagina',
      scannerDetected: { one: '{n} restrizione rilevata e superata:', other: '{n} restrizioni rilevate e superate:' },
      barrierRightClick: 'Tasto destro bloccato',
      barrierSelection: 'Selezione bloccata (user-select)',
      barrierCopy: 'Appunti / copia bloccata',
      barrierScroll: 'Scorrimento bloccato',
      barrierBlur: 'Filtro di sfocatura visiva',
      barrierAlert: 'Avviso pop-up di copia',

      secUnlockers: 'Sblocchi principali',
      secMedia: 'File multimediali e download',
      secPageTools: 'Strumenti di pagina',

      featRightClickTitle: 'Tasto destro',
      featRightClickDesc: 'Ripristina il menu contestuale del tasto destro',
      featCopyTitle: 'Selezione e copia testo',
      featCopyDesc: 'Rimuove i blocchi di copia in CSS e JavaScript',
      featClipboardTitle: 'Protezione appunti',
      featClipboardDesc: 'Impedisce ai siti di aggiungere link al testo copiato',
      featKeyboardTitle: 'Scorciatoie da tastiera',
      featKeyboardDesc: 'Mantiene attivi F12, strumenti per sviluppatori e salvataggio',

      featDragDropTitle: 'Trascina immagini diretto',
      featDragDropDesc: 'Trascina le immagini direttamente sul desktop come file',
      featAltClickTitle: 'Download rapido Alt+Click',
      featAltClickDesc: 'Tieni premuto Alt e fai clic su un\'immagine per salvarla',

      featScrollbarTitle: 'Ripristino scorrimento',
      featScrollbarDesc: 'Ripristina lo scorrimento di pagina nascosto o bloccato',
      featAlertTitle: 'Blocca avvisi',
      featAlertDesc: 'Disattiva avvisi e finestre di protezione da copia',
      featAntiBlurTitle: 'Chiarezza di lettura e anti-sfocatura',
      featAntiBlurDesc: 'Rende leggibile il testo sfocato. Le pagine non vedono nemmeno se la scheda è nascosta',
      featPrintTitle: 'Sblocco stampa',
      featPrintDesc: 'Rende stampabili le pagine che bloccano la stampa',
      scannerDetectedOnly: { one: '{n} restrizione rilevata in questa pagina:', other: '{n} restrizioni rilevate in questa pagina:' },
      pdfPage: 'Selectra non può funzionare nel visualizzatore PDF.',
      btnGlobalOff: 'Disattiva la modalità globale',
      resetTitle: 'Ripristina le impostazioni mostrate qui',
      modeGroupLabel: 'Ambito delle impostazioni',
      langListLabel: 'Lingua',
      issueCategoryLabel: 'Di cosa si tratta?',
      statusPartial: 'Alcuni controlli attivi',
      featEditTitle: 'Modifica pagina',
      featEditDesc: 'Rende il testo della pagina direttamente modificabile',

      btnUnlockAll: 'Sblocca tutto',
      btnLockAll: 'Blocca tutto',
      btnReloadPage: 'Ricarica pagina',
      pageNotReady: 'Selectra non è ancora attivo in questa pagina. Ricarica la pagina per applicare le impostazioni.',
      pageBlocked: 'Selectra non riesce ancora ad accedere a questa pagina. Alcune pagine, come gli store del browser e le pagine interne, non consentono le estensioni.',
      globalModeHint: 'La modalità Globale vale per tutti i siti. Le impostazioni dei singoli siti restano sospese finché non torni a «Questo sito».',
      btnReset: 'Ripristina',
      btnContact: 'Segnala problema',
      contactTitle: 'Segnala problema / Contatto',
      contactDesc: 'Hai trovato un sito bloccato o un bug? Faccelo sapere.',
      catSiteLocked: 'Sito non sbloccato',
      catBug: 'Bug / Errore',
      catFeature: 'Suggerimento',
      contactNotesLabel: 'Note / Dettagli',
      contactOptionalTag: 'Opzionale',
      contactNotesPlaceholder: 'Cosa è successo su questo sito?',
      contactTelemetryDetails: 'Diagnostica inclusa',
      contactLivePage: 'Pagina attiva',
      contactBarriersCount: { one: '{n} blocco', other: '{n} blocchi' },
      contactCopiedFeedback: 'Copiato!',
      btnCopyDiagnostics: 'Copia diagnosi',
      btnOpenSupport: 'Copia e apri assistenza',
      contactSupportHint: 'Copia il report e apre la pagina di assistenza dello store. Premi il pulsante di contatto e incolla (Ctrl+V).',
      legalNavLabel: 'Informazioni legali',
      legalPrivacy: 'Informativa sulla privacy',
      legalLicenses: 'Licenze open source',
      legalChangelog: 'Novità',
      legalClose: 'Chiudi',
      legalOpenTab: 'Apri in una nuova scheda',
      legalEnglishOnly: 'Il testo completo è disponibile solo in inglese.',
      legalChangelogNote: 'Le note sono in inglese e turco.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Tutti gli sblocchi attivati',
      toastAllLocked: 'Tutti gli sblocchi disattivati',
      toastPageReloaded: 'Pagina ricaricata',
      toastDiagnosticsCopied: 'Rapporto diagnostico copiato negli appunti',
      toastResetSite: 'Impostazioni ripristinate per questo sito',
      toastResetGlobal: 'Impostazioni globali ripristinate',
      unsupportedPage: 'L\'estensione non può essere eseguita in questa pagina di sistema.',

    },

    ru: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Текущая вкладка',
      badgeGlobalTab: 'Все сайты (Глобально)',
      modeSite: 'Этот сайт',
      modeGlobal: 'Глобально',
      themeToggleTitle: 'Сменить тему',
      langToggleTitle: 'Выбрать язык',
      statusAllOff: 'Все функции отключены',
      statusAllOn: 'Все разблокировщики активны',
      statusActiveCount: { other: '{n} активн.' },

      scannerTitle: 'Диагностика ограничений',
      scannerClean: 'На этой странице ограничений не обнаружено',
      scannerDetected: { other: 'Найдено и снято ограничений: {n}' },
      barrierRightClick: 'Правый клик заблокирован',
      barrierSelection: 'Выделение заблокировано (user-select)',
      barrierCopy: 'Копирование заблокировано',
      barrierScroll: 'Прокрутка заблокирована',
      barrierBlur: 'Визуальный фильтр размытия',
      barrierAlert: 'Всплывающее окно защиты',

      secUnlockers: 'Основные разблокировщики',
      secMedia: 'Медиа и файлы',
      secPageTools: 'Инструменты страницы',

      featRightClickTitle: 'Правый клик',
      featRightClickDesc: 'Восстанавливает контекстное меню правой кнопки мыши',
      featCopyTitle: 'Выделение и копирование',
      featCopyDesc: 'Снимает ограничения копирования через CSS и JavaScript',
      featClipboardTitle: 'Защита буфера обмена',
      featClipboardDesc: 'Запрещает сайтам добавлять ссылки к скопированному',
      featKeyboardTitle: 'Горячие клавиши',
      featKeyboardDesc: 'Разрешает F12, DevTools, просмотр кода и сохранение',

      featDragDropTitle: 'Перетаскивание изображений',
      featDragDropDesc: 'Перетаскивайте изображения на рабочий стол как файлы',
      featAltClickTitle: 'Быстрое скачивание по Alt+клик',
      featAltClickDesc: 'Зажмите Alt и нажмите на изображение для сохранения',

      featScrollbarTitle: 'Восстановление прокрутки',
      featScrollbarDesc: 'Возвращает скрытую или заблокированную прокрутку страницы',
      featAlertTitle: 'Блокировка предупреждений',
      featAlertDesc: 'Отключает всплывающие окна и уведомления о защите',
      featAntiBlurTitle: 'Снятие размытия (Anti-Blur)',
      featAntiBlurDesc: 'Делает размытый текст читаемым. Страницы также не узнают, что вкладка скрыта',
      featPrintTitle: 'Разблокировка печати',
      featPrintDesc: 'Позволяет печатать страницы, блокирующие печать',
      scannerDetectedOnly: { other: 'Найдено ограничений на этой странице: {n}' },
      pdfPage: 'Selectra не работает внутри просмотрщика PDF.',
      btnGlobalOff: 'Выключить глобальный режим',
      resetTitle: 'Сбросить показанные здесь настройки',
      modeGroupLabel: 'Область действия настроек',
      langListLabel: 'Язык',
      issueCategoryLabel: 'О чём речь?',
      statusPartial: 'Часть функций включена',
      featEditTitle: 'Редактирование страницы',
      featEditDesc: 'Позволяет временно редактировать текст на странице',

      btnUnlockAll: 'Разблокировать все',
      btnLockAll: 'Заблокировать все',
      btnReloadPage: 'Обновить страницу',
      pageNotReady: 'Selectra ещё не работает на этой странице. Перезагрузите страницу, чтобы применить настройки.',
      pageBlocked: 'Selectra по-прежнему не может получить доступ к этой странице. Некоторые страницы, например магазины браузера и внутренние страницы, не допускают расширения.',
      globalModeHint: 'Режим «Глобально» действует на всех сайтах. Собственные настройки сайтов приостановлены, пока вы не вернётесь к «Этот сайт».',
      btnReset: 'Сбросить',
      btnContact: 'Сообщить о проблеме',
      contactTitle: 'Сообщить о проблеме / Контакт',
      contactDesc: 'Нашли заблокированный сайт или баг? Сообщите нам.',
      catSiteLocked: 'Сайт не разблокирован',
      catBug: 'Ошибка / Баг',
      catFeature: 'Идея / Предложение',
      contactNotesLabel: 'Примечания / Детали',
      contactOptionalTag: 'Необязательно',
      contactNotesPlaceholder: 'Что произошло на этом сайте?',
      contactTelemetryDetails: 'Диагностика включена',
      contactLivePage: 'Текущая страница',
      contactBarriersCount: { other: 'Блокировок: {n}' },
      contactCopiedFeedback: 'Скопировано!',
      btnCopyDiagnostics: 'Скопировать диагностику',
      btnOpenSupport: 'Копировать и открыть поддержку',
      contactSupportHint: 'Копирует отчёт и открывает страницу поддержки магазина. Нажмите кнопку связи и вставьте отчёт (Ctrl+V).',
      legalNavLabel: 'Правовая информация',
      legalPrivacy: 'Политика конфиденциальности',
      legalLicenses: 'Лицензии открытого ПО',
      legalChangelog: 'Что нового',
      legalClose: 'Закрыть',
      legalOpenTab: 'Открыть в новой вкладке',
      legalEnglishOnly: 'Полный текст доступен только на английском.',
      legalChangelogNote: 'Заметки на английском и турецком.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Все разблокировщики включены',
      toastAllLocked: 'Все разблокировщики выключены',
      toastPageReloaded: 'Страница обновлена',
      toastDiagnosticsCopied: 'Отчет диагностики скопирован в буфер обмена',
      toastResetSite: 'Настройки для этого сайта сброшены',
      toastResetGlobal: 'Глобальные настройки сброшены',
      unsupportedPage: 'Расширение не может работать на этой системной странице.',

    },

    pl: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Aktywna karta',
      badgeGlobalTab: 'Wszystkie strony (Globalnie)',
      modeSite: 'Ta strona',
      modeGlobal: 'Globalny',
      themeToggleTitle: 'Przełącz motyw',
      langToggleTitle: 'Zmień język',
      statusAllOff: 'Wszystkie blokady wyłączone',
      statusAllOn: 'Wszystkie odblokowania aktywne',
      statusActiveCount: { one: '{n} aktywna', few: '{n} aktywne', many: '{n} aktywnych', other: '{n} aktywnych' },

      scannerTitle: 'Diagnoza zabezpieczeń',
      scannerClean: 'Nie wykryto ograniczeń na tej stronie',
      scannerDetected: { other: 'Wykryto i pominięto ograniczenia ({n}):' },
      barrierRightClick: 'Prawy przycisk myszy zablokowany',
      barrierSelection: 'Zaznaczanie tekstu zablokowane (user-select)',
      barrierCopy: 'Kopiowanie / schowek zablokowany',
      barrierScroll: 'Przewijanie zablokowane',
      barrierBlur: 'Wizualny filtr rozmycia',
      barrierAlert: 'Wyskakujące powiadomienie',

      secUnlockers: 'Główne odblokowania',
      secMedia: 'Media i pobieranie',
      secPageTools: 'Narzędzia strony',

      featRightClickTitle: 'Prawy przycisk myszy',
      featRightClickDesc: 'Przywraca menu kontekstowe prawego przycisku myszy',
      featCopyTitle: 'Zaznaczanie i kopiowanie tekstu',
      featCopyDesc: 'Usuwa blokady kopiowania w CSS i JavaScript',
      featClipboardTitle: 'Ochrona schowka',
      featClipboardDesc: 'Blokuje doklejanie niechcianych linków do kopiowanego tekstu',
      featKeyboardTitle: 'Skróty klawiszowe',
      featKeyboardDesc: 'Zezwala na F12, narzędzia deweloperskie i zapisywanie',

      featDragDropTitle: 'Przeciąganie obrazów',
      featDragDropDesc: 'Przeciągaj obrazy na pulpit bezpośrednio jako pliki',
      featAltClickTitle: 'Szybkie pobieranie Alt+Klik',
      featAltClickDesc: 'Przytrzymaj Alt i kliknij obraz, aby go zapisać',

      featScrollbarTitle: 'Przywracanie przewijania',
      featScrollbarDesc: 'Przywraca ukryty lub zablokowany pasek przewijania',
      featAlertTitle: 'Blokada alertów',
      featAlertDesc: 'Wycisza wyskakujące okna i ostrzeżenia o kopiowaniu',
      featAntiBlurTitle: 'Usuwanie rozmycia (Anti-Blur)',
      featAntiBlurDesc: 'Wyostrza rozmyty tekst. Strony nie widzą też, że karta jest ukryta',
      featPrintTitle: 'Odblokowanie drukowania',
      featPrintDesc: 'Umożliwia drukowanie stron, które blokują drukowanie',
      scannerDetectedOnly: { other: 'Wykryto ograniczenia na tej stronie ({n}):' },
      pdfPage: 'Selectra nie działa w przeglądarce PDF.',
      btnGlobalOff: 'Wyłącz tryb globalny',
      resetTitle: 'Przywróć ustawienia widoczne tutaj',
      modeGroupLabel: 'Zakres ustawień',
      langListLabel: 'Język',
      issueCategoryLabel: 'Czego dotyczy?',
      statusPartial: 'Niektóre funkcje włączone',
      featEditTitle: 'Edycja strony',
      featEditDesc: 'Pozwala na bezpośrednią edycję tekstu na stronie',

      btnUnlockAll: 'Odblokuj wszystko',
      btnLockAll: 'Zablokuj wszystko',
      btnReloadPage: 'Odśwież stronę',
      pageNotReady: 'Selectra nie działa jeszcze na tej stronie. Odśwież stronę, aby zastosować ustawienia.',
      pageBlocked: 'Selectra nadal nie ma dostępu do tej strony. Niektóre strony, na przykład sklepy przeglądarki i strony wewnętrzne, nie pozwalają na rozszerzenia.',
      globalModeHint: 'Tryb Globalny obowiązuje na wszystkich stronach. Własne ustawienia stron są wstrzymane, dopóki nie wrócisz do „Ta strona”.',
      btnReset: 'Resetuj',
      btnContact: 'Zgłoś problem',
      contactTitle: 'Zgłoś problem / Kontakt',
      contactDesc: 'Zablokowana strona lub błąd? Daj nam znać.',
      catSiteLocked: 'Strona nie odblokowuje się',
      catBug: 'Błąd / Usterka',
      catFeature: 'Pomysł na funkcję',
      contactNotesLabel: 'Uwagi / Szczegóły',
      contactOptionalTag: 'Opcjonalnie',
      contactNotesPlaceholder: 'Co się stało na tej stronie?',
      contactTelemetryDetails: 'Diagnostyka dołączona',
      contactLivePage: 'Aktywna strona',
      contactBarriersCount: { one: '{n} blokada', few: '{n} blokady', many: '{n} blokad', other: '{n} blokad' },
      contactCopiedFeedback: 'Skopiowano!',
      btnCopyDiagnostics: 'Kopiuj diagnozę',
      btnOpenSupport: 'Kopiuj i otwórz wsparcie',
      contactSupportHint: 'Kopiuje raport i otwiera stronę pomocy sklepu. Kliknij przycisk kontaktu i wklej (Ctrl+V).',
      legalNavLabel: 'Informacje prawne',
      legalPrivacy: 'Polityka prywatności',
      legalLicenses: 'Licencje open source',
      legalChangelog: 'Co nowego',
      legalClose: 'Zamknij',
      legalOpenTab: 'Otwórz w nowej karcie',
      legalEnglishOnly: 'Pełny tekst jest dostępny tylko po angielsku.',
      legalChangelogNote: 'Notatki są po angielsku i turecku.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Wszystkie odblokowania włączone',
      toastAllLocked: 'Wszystkie odblokowania wyłączone',
      toastPageReloaded: 'Strona odświeżona',
      toastDiagnosticsCopied: 'Raport diagnostyczny skopiowany do schowka',
      toastResetSite: 'Ustawienia dla tej strony zostały zresetowane',
      toastResetGlobal: 'Ustawienia globalne zostały zresetowane',
      unsupportedPage: 'Rozszerzenie nie działa na tej stronie systemowej.',

    },

    nl: {
      appName: 'Selectra',
      version: 'v1.0.11',
      badgeActiveTab: 'Actief tabblad',
      badgeGlobalTab: 'Alle websites (Globaal)',
      modeSite: 'Deze site',
      modeGlobal: 'Globaal',
      themeToggleTitle: 'Thema wisselen',
      langToggleTitle: 'Taal wijzigen',
      statusAllOff: 'Alle beveiligingen uit',
      statusAllOn: 'Alle ontgrendelaars actief',
      statusActiveCount: { one: '{n} actief', other: '{n} actief' },

      scannerTitle: 'Diagnose van paginabeveiliging',
      scannerClean: 'Geen beperkingen gevonden op deze pagina',
      scannerDetected: { one: '{n} beperking gevonden en omzeild:', other: '{n} beperkingen gevonden en omzeild:' },
      barrierRightClick: 'Rechtermuisklik geblokkeerd',
      barrierSelection: 'Tekstselectie geblokkeerd (user-select)',
      barrierCopy: 'Kopiëren / klembord geblokkeerd',
      barrierScroll: 'Scrollen vergrendeld',
      barrierBlur: 'Visueel vervagingsfilter',
      barrierAlert: 'Waarschuwingspop-up',

      secUnlockers: 'Belangrijkste ontgrendelaars',
      secMedia: 'Media en downloads',
      secPageTools: 'Paginatools',

      featRightClickTitle: 'Rechtermuisklik',
      featRightClickDesc: 'Herstel het contextmenu van de rechtermuisknop',
      featCopyTitle: 'Tekstselectie en kopiëren',
      featCopyDesc: 'Omzeil kopieerblokkades via CSS en JavaScript',
      featClipboardTitle: 'Klembordbescherming',
      featClipboardDesc: 'Voorkom dat websites links aan gekopieerde tekst toevoegen',
      featKeyboardTitle: 'Sneltoetsen',
      featKeyboardDesc: 'Houd F12, ontwikkelaarstools, broncode en opslaan werkend',

      featDragDropTitle: 'Afbeeldingen direct slepen',
      featDragDropDesc: 'Sleep afbeeldingen direct naar het bureaublad als bestand',
      featAltClickTitle: 'Alt+Klik snel downloaden',
      featAltClickDesc: 'Houd Alt ingedrukt en klik op een afbeelding om op te slaan',

      featScrollbarTitle: 'Scrollbalk herstellen',
      featScrollbarDesc: 'Herstel verborgen of vergrendeld scrollen',
      featAlertTitle: 'Waarschuwingen blokkeren',
      featAlertDesc: 'Demp pop-ups en waarschuwingen voor kopieerbeveiliging',
      featAntiBlurTitle: 'Leeshelderheid en anti-vervaging',
      featAntiBlurDesc: 'Maakt wazige tekst leesbaar. Pagina’s merken ook niet dat het tabblad verborgen is',
      featPrintTitle: 'Afdrukken ontgrendelen',
      featPrintDesc: 'Maakt pagina’s afdrukbaar die afdrukken blokkeren',
      scannerDetectedOnly: { one: '{n} beperking gevonden op deze pagina:', other: '{n} beperkingen gevonden op deze pagina:' },
      pdfPage: 'Selectra werkt niet in de pdf-viewer.',
      btnGlobalOff: 'Globale modus uitschakelen',
      resetTitle: 'De hier getoonde instellingen resetten',
      modeGroupLabel: 'Waar de instellingen gelden',
      langListLabel: 'Taal',
      issueCategoryLabel: 'Waar gaat het over?',
      statusPartial: 'Sommige opties aan',
      featEditTitle: 'Pagina bewerken',
      featEditDesc: 'Maak de tekst op de pagina direct bewerkbaar',

      btnUnlockAll: 'Alles ontgrendelen',
      btnLockAll: 'Alles vergrendelen',
      btnReloadPage: 'Pagina vernieuwen',
      pageNotReady: 'Selectra draait nog niet op deze pagina. Laad de pagina opnieuw om je instellingen toe te passen.',
      pageBlocked: 'Selectra kan deze pagina nog steeds niet bereiken. Sommige pagina’s, zoals browserwinkels en interne pagina’s, staan geen extensies toe.',
      globalModeHint: 'De globale modus geldt voor elke site. De eigen instellingen van sites staan op pauze tot je terugschakelt naar „Deze site”.',
      btnReset: 'Herstellen',
      btnContact: 'Probleem melden',
      contactTitle: 'Probleem melden / Contact',
      contactDesc: 'Geblokkeerde site of fout gevonden? Laat het ons weten.',
      catSiteLocked: 'Site ontgrendelt niet',
      catBug: 'Fout / Bug',
      catFeature: 'Idee voor functie',
      contactNotesLabel: 'Notities / Details',
      contactOptionalTag: 'Optioneel',
      contactNotesPlaceholder: 'Wat gebeurde er op deze website?',
      contactTelemetryDetails: 'Diagnose inbegrepen',
      contactLivePage: 'Actieve pagina',
      contactBarriersCount: { one: '{n} blokkade', other: '{n} blokkades' },
      contactCopiedFeedback: 'Gekopieerd!',
      btnCopyDiagnostics: 'Diagnose kopiëren',
      btnOpenSupport: 'Kopiëren & support openen',
      contactSupportHint: 'Kopieert het rapport en opent de supportpagina van de store. Klik op de contactknop en plak (Ctrl+V).',
      legalNavLabel: 'Juridische informatie',
      legalPrivacy: 'Privacybeleid',
      legalLicenses: 'Open-sourcelicenties',
      legalChangelog: 'Wat is nieuw',
      legalClose: 'Sluiten',
      legalOpenTab: 'Openen in nieuw tabblad',
      legalEnglishOnly: 'De volledige tekst is alleen in het Engels beschikbaar.',
      legalChangelogNote: 'De notities zijn in het Engels en Turks.',
      footerText: 'Selectra',

      toastAllUnlocked: 'Alle ontgrendelaars ingeschakeld',
      toastAllLocked: 'Alle ontgrendelaars uitgeschakeld',
      toastPageReloaded: 'Pagina vernieuwd',
      toastDiagnosticsCopied: 'Diagnoserapport gekopieerd naar klembord',
      toastResetSite: 'Instellingen hersteld voor deze site',
      toastResetGlobal: 'Globale instellingen hersteld',
      unsupportedPage: 'Extensie kan niet worden uitgevoerd op deze systeempagina.',

    }
  };

  // A language code from storage or from the browser is only ever looked up among the languages we have ('constructor' is not one).
  const hasLang = (lang) => typeof lang === 'string' && Object.hasOwn(TRANSLATIONS, lang);
  const ownText = (dictionary, key) => (Object.hasOwn(dictionary, key) ? dictionary[key] : undefined);
  // "pt-PT", "pt_BR", "de-AT" -> the language we have ("pt" for both Portuguese, "de" for every German), or '' if we have none
  const knownLanguage = (tag) => {
    if (typeof tag !== 'string') return '';
    const base = tag.toLowerCase().split(/[-_]/)[0];
    return hasLang(base) ? base : '';
  };
  const isMac = () => { try { return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || ''); } catch { return false; } };

  class I18nManager {
    constructor() {
      this.currentLang = 'en';
      this.listeners = new Set();
    }

    getAvailableLanguages() {
      return LANGUAGES;
    }

    detectDefaultLanguage() {
      try {
        // the browser's whole list of preferred languages, in order, then the interface language of the browser itself
        const preferred = [...(navigator.languages || []), navigator.language, navigator.userLanguage];
        try { preferred.push(chrome.i18n.getUILanguage()); } catch {}
        for (const tag of preferred) {
          const known = knownLanguage(tag);
          if (known) return known;
        }
        return 'en';
      } catch {
        return 'en';
      }
    }

    // The page's own language follows the interface language: the browser upper-cases, hyphenates and reads text out by it (in Turkish an i
    // is I with a dot, not the English one).
    syncPageLanguage() {
      try { document.documentElement.setAttribute('lang', this.currentLang); } catch {}
      try { localStorage.setItem('superUnlockerLang', this.currentLang); } catch {}
    }

    async init() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const data = await chrome.storage.local.get('superUnlockerLang');
          const lang = data.superUnlockerLang;
          this.currentLang = knownLanguage(lang) || this.detectDefaultLanguage();
        } else {
          const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('superUnlockerLang') : null;
          this.currentLang = knownLanguage(stored) || this.detectDefaultLanguage();
        }
      } catch {
        this.currentLang = this.detectDefaultLanguage();
      }
      this.syncPageLanguage();
      return this.currentLang;
    }

    getLang() {
      return this.currentLang;
    }

    async setLang(lang) {
      const known = knownLanguage(lang);
      if (!known) return;
      this.currentLang = known;
      this.syncPageLanguage();
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ superUnlockerLang: lang });
        }
      } catch {}
      this.notify();
    }

    t(key, params = {}) {
      const dict = hasLang(this.currentLang) ? TRANSLATIONS[this.currentLang] : TRANSLATIONS.en;
      let text = ownText(dict, key) || ownText(TRANSLATIONS.en, key) || String(key);
      if (text && typeof text === 'object') { // plural forms: the language's own rules pick one (Polish has four, French counts 0 as singular)
        let category = 'other';
        try { category = new Intl.PluralRules(this.currentLang === 'pt' ? 'pt-BR' : this.currentLang).select(Number(params.n) || 0); } catch {}
        text = text[category] || text.other || Object.values(text)[0] || String(key);
      }
      for (const [pKey, pVal] of Object.entries(params)) {
        // plain text replacement: a value such as "$&" or "$'" must come out as it is written
        text = text.split(`{${pKey}}`).join(String(pVal));
      }
      // the keys are named for the other systems: a Mac has Option and Command
      if (isMac()) text = text.replace(/\bAlt\b/g, 'Option').replace(/\bCtrl\+/g, '⌘');
      return text;
    }

    applyToDOM(root = document) {
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
          const translation = this.t(key);
          if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
            el.value = translation;
          } else {
            el.textContent = translation;
          }
        }
      });

      root.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) el.title = this.t(key);
      });

      root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.placeholder = this.t(key);
      });

      root.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (key) el.setAttribute('aria-label', this.t(key));
      });
    }

    subscribe(callback) {
      if (typeof callback === 'function') {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
      }
      return () => {};
    }

    notify() {
      for (const cb of this.listeners) {
        try { cb(this.currentLang); } catch {}
      }
    }
  }

  return new I18nManager();
});
