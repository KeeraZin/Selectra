// Selectra - MAIN World Controller (MV3)
// Runs in the webpage context at document_start to defeat JS-level protection scripts:
// 1. Hooks Event.prototype.preventDefault & EventTarget.prototype.addEventListener dynamically
// 2. Anti-Clipboard Poisoning: Protects selected text from injected spam / "Read more at" links
// 3. Anti-Selection Stripping: Prevents scripts from wiping user selection via removeAllRanges()
// 4. Anti-Debugger / Anti-DevTools: Neutralizes infinite debugger loops & console.clear() spam
// 5. Stubs known anti-copy global functions (disable_copy, wpcp, nocontext, etc.)
// 6. Silences alert() when alert blocking is enabled (confirm() and prompt() are never touched)
// 7. A message-port bridge to the content script that only the two scripts hold: the page can neither see nor forge it
//
// Everything is gated by `state` and does nothing until the content script has delivered the user's settings. The patched functions
// answer toString(), name and length like the natives they replace, and Function itself is replaced only when the keyboard protection is on.

(function () {
  'use strict';

  const state = {
    rightClick: false,
    copy: false,
    clipboard: false,
    edit: false,
    alert: false,
    dragDrop: false,
    keyboard: false,
    antiDebugger: false,
    scrollbar: false,
    print: false,
    antiBlur: false
  };

  const nativePreventDefault = Event.prototype.preventDefault;
  const nativeStopPropagation = Event.prototype.stopPropagation;
  const nativeStopImmediatePropagation = Event.prototype.stopImmediatePropagation;
  const nativeAddEventListener = EventTarget.prototype.addEventListener;
  const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
  const nativeSetData = DataTransfer.prototype.setData;
  const nativeRemoveAllRanges = Selection.prototype.removeAllRanges;
  const nativeEmpty = Selection.prototype.empty;
  const nativeCollapse = Selection.prototype.collapse;
  const nativeCollapseToEnd = Selection.prototype.collapseToEnd;
  const nativeCollapseToStart = Selection.prototype.collapseToStart;
  const nativeRemoveRange = Selection.prototype.removeRange;
  const nativeFunction = window.Function;
  const nativeFunctionPrototype = nativeFunction.prototype;
  const nativeFunctionToString = nativeFunctionPrototype.toString;
  const nativeSetTimeout = window.setTimeout;
  const nativeSetInterval = window.setInterval;
  const nativeConsoleClear = console.clear;
  const nativePrint = window.print;
  const nativeAttachShadow = Element.prototype.attachShadow;

  // ─── Primordials ───
  // The calls this script depends on are taken now, before any page script can replace them.
  const reflectApply = Reflect.apply;
  const reflectConstruct = Reflect.construct;
  const uncurryThis = Function.prototype.bind.bind(Function.prototype.call);
  const weakMapGet = uncurryThis(WeakMap.prototype.get);
  const weakMapSet = uncurryThis(WeakMap.prototype.set);
  const mapGet = uncurryThis(Map.prototype.get);
  const mapSet = uncurryThis(Map.prototype.set);
  const mapDelete = uncurryThis(Map.prototype.delete);
  const stringIncludes = uncurryThis(String.prototype.includes);
  const toPrimitiveString = String; // the one the page cannot replace later
  const nativePostMessage = window.postMessage;

  // The private bridge to the content script (see the end of this file).
  let mainPort = null;
  let established = false;

  // ─── Patched functions look native ───
  // Page code (bot detection, anti-cheat, hardened runtimes) compares functions with what the browser ships: toString(), name and length.
  // Every patched function is registered here together with the native it replaces.
  const nativeSources = new WeakMap();
  const disguise = (wrapper, original) => {
    try {
      if (typeof wrapper !== 'function' || typeof original !== 'function') return wrapper;
      weakMapSet(nativeSources, wrapper, nativeFunctionToString.call(original));
      Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true });
      Object.defineProperty(wrapper, 'length', { value: original.length, configurable: true });
    } catch {}
    return wrapper;
  };
  const maskedToString = function toString() {
    const disguised = weakMapGet(nativeSources, this);
    return disguised !== undefined ? disguised : reflectApply(nativeFunctionToString, this, []);
  };
  try {
    weakMapSet(nativeSources, maskedToString, nativeFunctionToString.call(nativeFunctionToString));
    Object.defineProperty(nativeFunctionPrototype, 'toString', { value: maskedToString, writable: true, configurable: true, enumerable: false });
  } catch {}

  // True once content.js has delivered the first SET_STATE. Page scripts that run before
  // that moment cannot be judged against the user's settings yet (see timer hooks below).
  let stateReceived = false;

  const originalGlobals = new Map();
  let dialogOriginals = null;
  let guardCleanups = [];

  // ─── 0. Selection-blocking mousedown ───
  // Cancelling the default of a left-button mousedown stops text selection from starting ("no selection" scripts do this on
  // document/window/body). Page-wide handlers are ignored for that one case, and only on plain text: a slider, a menu or a
  // drag handle attaches its mousedown handler to its own element, so those keep working untouched.
  const INTERACTIVE_SELECTOR = 'a[href], button, input, select, textarea, label, summary, option, canvas, video, audio, iframe, embed, object, svg, [contenteditable]:not([contenteditable="false"]), [draggable="true"], [role="button"], [role="slider"], [role="scrollbar"], [role="tab"], [role="menuitem"], [role="textbox"], [role="spinbutton"], [role="separator"], [role="option"], [role="switch"], [role="checkbox"], [role="combobox"]';
  const isPlainTextTarget = (target) => target instanceof Element && !target.closest(INTERACTIVE_SELECTOR);
  const isGlobalTarget = (target) => target === window || target === document || target === document.documentElement || target === document.body;
  const cancelsSelection = (event) => state.copy && !!event && event.button === 0 && isPlainTextTarget(event.target);

  // ─── Surfaces the page itself owns ───
  // Editors and drawing tools handle copy, cut, keys, the wheel and the right button themselves, and cancel the browser's default to do it (a code
  // editor's Ctrl+S, a rich-text editor's copy event, a map's wheel zoom, a 3D camera on the right button). Neutralising those cancellations there
  // breaks the application, so on such a surface the page keeps its events. An attribute [contenteditable] counts, designMode does not (the Page
  // Editor turns that on for the whole document).
  const EDITOR_SURFACE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="application"], canvas, .monaco-editor, .cm-editor, .CodeMirror, .ProseMirror, .ql-editor';
  const APP_SURFACE = 'canvas, [role="application"]';
  const deepTarget = (event) => {
    try {
      const path = event.composedPath();
      if (path && path[0] instanceof Element) return path[0];
    } catch {}
    return event && event.target instanceof Element ? event.target : null;
  };
  const within = (target, selector) => {
    try { return !!target && target.closest(selector) !== null; } catch { return false; }
  };
  const DEV_KEYS = ['i', 'j', 'c', 'k', 'e'];
  const shortcutKind = (event) => {
    const key = String(event.key || '').toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    if (key === 'f12' || (ctrl && (key === 'u' || (event.shiftKey && DEV_KEYS.includes(key))))) return 'dev';
    if (key === 'f5' || (ctrl && ['s', 'c', 'a', 'x', 'v', 'p', 'r'].includes(key))) return 'app';
    return null;
  };
  // Does the page keep this event, whatever the settings say?
  const pageKeeps = (type, event) => {
    const target = deepTarget(event);
    switch (type) {
      case 'copy': case 'cut': case 'selectstart': case 'wheel': case 'touchmove': case 'beforeinput':
        return within(target, EDITOR_SURFACE);
      case 'dragstart':
        return !(target instanceof HTMLImageElement || within(target, 'picture')); // only pictures are ours to free
      case 'mousedown': case 'pointerdown': case 'pointerup':
        return within(target, APP_SURFACE);
      case 'keydown': case 'keyup': case 'keypress':
        return shortcutKind(event) === 'app' && within(target, EDITOR_SURFACE);
      default:
        return false;
    }
  };

  // ─── 1. Hook Event.prototype.preventDefault ───
  // What a refusal is reported as (the kind of event only, never its content), at most every two seconds per kind: the content script keeps it as
  // evidence of the barrier, which the unlocker would otherwise hide.
  const ignoredAt = new Map();
  const noteIgnored = (kind) => {
    if (!established || !mainPort) return;
    const now = performance.now();
    if (now - (mapGet(ignoredAt, kind) || -Infinity) < 2000) return;
    mapSet(ignoredAt, kind, now);
    try { mainPort.postMessage({ type: 'ignored', kind }); } catch {}
  };

  Event.prototype.preventDefault = function () {
    const type = this.type ? String(this.type).toLowerCase() : '';

    if (state.copy && type === 'mousedown' && this.button === 0 && isGlobalTarget(this.currentTarget) && isPlainTextTarget(this.target)) {
      noteIgnored('selectstart');
      return; // a page-wide mousedown handler must not stop text selection from starting
    }

    if (state.rightClick && (type === 'contextmenu' || ((type === 'mousedown' || type === 'pointerdown' || type === 'pointerup') && this.button === 2 && !pageKeeps(type, this)))) {
      noteIgnored('contextmenu');
      return; // Ignore website canceling right-click
    }

    if (state.copy && (type === 'copy' || type === 'cut' || type === 'selectstart') && !pageKeeps(type, this)) {
      noteIgnored(type === 'selectstart' ? 'selectstart' : 'copy');
      return; // Ignore website canceling text selection or copy
    }


    // Only dragstart, and only of a picture. dragover, dragenter and drop are what make a drop zone accept a file or a card: cancelling them is
    // how the page says "drop here", so they are never touched.
    if (state.dragDrop && type === 'dragstart' && !pageKeeps(type, this)) {
      return; // Ignore website canceling image drag
    }

    if (state.edit && type === 'beforeinput' && !pageKeeps(type, this)) {
      return; // Never allow sites to prevent user typing in designMode (an editor's own beforeinput handling is left alone)
    }

    if (state.scrollbar && (type === 'wheel' || type === 'touchmove') && !pageKeeps(type, this)) {
      return; // Ignore website canceling mouse wheel or touch scroll
    }

    if (state.scrollbar && (type === 'keydown' || type === 'keyup')) {
      const key = String(this.key || '').toLowerCase();
      if (['arrowdown', 'arrowup', 'pagedown', 'pageup', 'home', 'end', ' '].includes(key)) {
        const target = this.target;
        if (!(target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]'))) {
          return; // Ignore website canceling keyboard scroll
        }
      }
    }

    if (state.keyboard && (type === 'keydown' || type === 'keyup' || type === 'keypress')) {
      const kind = shortcutKind(this);
      if (kind === 'dev' || (kind === 'app' && !pageKeeps(type, this))) {
        return; // Ignore website canceling DevTools or copy shortcuts
      }
    }

    return reflectApply(nativePreventDefault, this, arguments);
  };

  // ─── 2. Hook EventTarget.prototype.addEventListener Dynamically ───
  // Evaluates state dynamically at EVENT runtime, completely eliminating race conditions!
  // listener -> EventTarget -> Map<"type:capture", wrappedFn>. The target level matters: the same
  // function is routinely attached to several elements, and each (target, type, capture) needs its
  // own wrapper so that removeEventListener on one target cannot orphan the wrapper on another.
  const wrappedListenerRegistry = new WeakMap();

  const isObjectLike = (value) => (typeof value === 'object' && value !== null) || typeof value === 'function';
  // a listener is a function, or an object with a handleEvent() method
  const isListener = (listener) => typeof listener === 'function' || (isObjectLike(listener) && typeof listener.handleEvent === 'function');

  function getCaptureFlag(options) {
    return typeof options === 'boolean' ? options : !!(options && options.capture);
  }

  function getWrapperMap(listener, target, create) {
    let perTarget = weakMapGet(wrappedListenerRegistry, listener);
    if (!perTarget) {
      if (!create) return null;
      perTarget = new WeakMap();
      weakMapSet(wrappedListenerRegistry, listener, perTarget);
    }
    let perKey = weakMapGet(perTarget, target);
    if (!perKey) {
      if (!create) return null;
      perKey = new Map();
      weakMapSet(perTarget, target, perKey);
    }
    return perKey;
  }

  // Is this page listener to be skipped for this event, at the moment it would run?
  const skippedByState = (t, event) => {
    switch (t) {
      case 'contextmenu':
        return state.rightClick;
      case 'mousedown': case 'pointerdown': case 'pointerup':
        return state.rightClick && !!event && event.button === 2 && !pageKeeps(t, event);
      case 'copy': case 'cut': case 'selectstart':
        return state.copy && !pageKeeps(t, event);
      case 'dragstart':
        return state.dragDrop && !pageKeeps(t, event);
      case 'wheel': case 'touchmove':
        return state.scrollbar && !pageKeeps(t, event);
      case 'beforeprint':
        return state.print;
      case 'visibilitychange': case 'blur':
        return state.antiBlur;
      case 'keydown': case 'keyup': case 'keypress': {
        if (!state.keyboard || !event) return false;
        const kind = shortcutKind(event);
        return kind === 'dev' || (kind === 'app' && !pageKeeps(t, event));
      }
      default:
        return false;
    }
  };

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (typeof type === 'string' && isListener(listener) && isObjectLike(this)) {
      const t = type.toLowerCase();
      const isRightClick = t === 'contextmenu' || t === 'mousedown' || t === 'pointerdown' || t === 'pointerup';
      const isCopy = t === 'copy' || t === 'cut' || t === 'selectstart';
      const isDrag = t === 'dragstart';
      const isKey = t === 'keydown' || t === 'keyup' || t === 'keypress';
      const isScroll = t === 'wheel' || t === 'touchmove';
      const isPrint = t === 'beforeprint';
      const isAntiBlur = t === 'visibilitychange' || (t === 'blur' && (this === window || this === document));

      if (isRightClick || isCopy || isDrag || isKey || isScroll || isPrint || isAntiBlur) {
        const capture = getCaptureFlag(options);
        const mapKey = `${t}:${capture}`;
        const perListener = getWrapperMap(listener, this, true);
        const once = !!(options && typeof options === 'object' && options.once);

        let wrappedListener = mapGet(perListener, mapKey);
        if (!wrappedListener) {
          wrappedListener = function (event) {
            // Neutralize site blocker if feature is enabled at execution time!
            if (skippedByState(t, event)) return;
            if (once) { // `once` is kept by hand: the browser would use up a listener that was only SKIPPED
              try {
                nativeRemoveEventListener.call(this, type, wrappedListener, capture);
                mapDelete(perListener, mapKey);
              } catch {}
            }
            return typeof listener === 'function' ? reflectApply(listener, this, arguments) : reflectApply(listener.handleEvent, listener, arguments);
          };
          mapSet(perListener, mapKey, wrappedListener);
        }

        return nativeAddEventListener.call(this, type, wrappedListener, once ? { ...options, once: false } : options);
      }
    }
    return nativeAddEventListener.call(this, type, listener, options);
  };

  // ─── 2b. Hook EventTarget.prototype.removeEventListener to match ───
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    if (typeof type === 'string' && isObjectLike(listener) && isObjectLike(this)) {
      const t = type.toLowerCase();
      const mapKey = `${t}:${getCaptureFlag(options)}`;
      const perListener = getWrapperMap(listener, this, false);
      const wrappedListener = perListener ? mapGet(perListener, mapKey) : undefined;
      if (wrappedListener) {
        mapDelete(perListener, mapKey);
        return nativeRemoveEventListener.call(this, type, wrappedListener, options);
      }
    }
    return nativeRemoveEventListener.call(this, type, listener, options);
  };

  // ─── 3. Anti-Clipboard Poisoning (Pano Koruması) ───
  // Prevents sites from appending "Read more at:", "Kaynak: ..." or replacing user copy content
  function isTamperedClipboardText(selected, data) {
    if (!selected || selected.trim().length === 0 || typeof data !== 'string') return false;
    // A "Copy link" / "Copy code" button writes its own text through a copy event while some page text happens to be selected: that is the
    // button doing its job, not poisoning. (The focus is on the button after the click; a user's Ctrl+C has it on the page.)
    const active = document.activeElement;
    if (active && typeof active.closest === 'function' && active.closest('button, [role="button"], a[href], summary')) return false;
    if (data === selected) return false;

    const lowerData = data.toLowerCase();
    const spamIndicators = [
      'http://', 'https://', '©', 'copyright', 'kaynak', 'read more', 'devamını oku',
      'tüm hakları', 'all rights', 'quelle:', 'source:', 'lire la suite', 'fuente:',
      'kopyalamak yasak', 'kopyalayamaz', 'copy disabled', 'cannot copy'
    ];

    const hasSpamPattern = spamIndicators.some(indicator => lowerData.includes(indicator));
    const isAppendedWithExtra = data.length > selected.length + 10;
    const strippedOriginal = !data.includes(selected.trim());

    return hasSpamPattern || isAppendedWithExtra || (strippedOriginal && selected.length > 5);
  }

  // Only writes that happen while the browser is dispatching a copy/cut event can be clipboard
  // poisoning. A "Copy link" button, a drag payload or a code editor writing outside such an
  // event must be left alone even if the user happens to have text selected.
  const CLIPBOARD_EVENT_WINDOW_MS = 300;
  let activeClipboardData = null;
  let clipboardWindowEnd = 0;

  const noteClipboardEvent = (event) => {
    if (!event.isTrusted) return; // a page can dispatch copy events itself; only the browser's own count
    activeClipboardData = event.clipboardData || null;
    clipboardWindowEnd = performance.now() + CLIPBOARD_EVENT_WINDOW_MS;
    nativeSetTimeout.call(window, () => {
      if (performance.now() >= clipboardWindowEnd) activeClipboardData = null;
    }, CLIPBOARD_EVENT_WINDOW_MS + 20);
  };
  nativeAddEventListener.call(window, 'copy', noteClipboardEvent, true);
  nativeAddEventListener.call(window, 'cut', noteClipboardEvent, true);

  const inClipboardEvent = () => performance.now() < clipboardWindowEnd;

  try {
    DataTransfer.prototype.setData = function (format, data) {
      if (
        state.clipboard &&
        this === activeClipboardData &&
        typeof format === 'string' && format.toLowerCase() === 'text/plain'
      ) {
        const selected = window.getSelection()?.toString();
        if (isTamperedClipboardText(selected, data)) {
          return nativeSetData.call(this, format, selected);
        }
      }
      return nativeSetData.apply(this, arguments);
    };
  } catch {}

  try {
    const hookWriteText = (targetObj) => {
      if (!targetObj || typeof targetObj.writeText !== 'function') return;
      const nativeWriteText = targetObj.writeText;
      targetObj.writeText = function (text) {
        if (state.clipboard && inClipboardEvent() && typeof text === 'string') {
          const selected = window.getSelection()?.toString();
          if (isTamperedClipboardText(selected, text)) {
            return nativeWriteText.call(this, selected);
          }
        }
        return nativeWriteText.apply(this, arguments);
      };
      disguise(targetObj.writeText, nativeWriteText);
    };

    if (window.Clipboard && window.Clipboard.prototype) {
      hookWriteText(window.Clipboard.prototype);
    }
    if (navigator.clipboard) {
      hookWriteText(navigator.clipboard);
    }
  } catch {}

  // ─── 4. Anti-Selection Stripping ───
  // Prevents sites from wiping the selection the person has made via removeAllRanges, empty, collapse, or removeRange. Not inside an editor: a
  // rich-text editor moves the selection all the time ("clear, then set") and stops working if that is refused, so where the selection or the
  // target of the call is in an editing surface the browser's own method runs.
  try {
    const inEditor = (node) => {
      try {
        const element = node instanceof Element ? node : (node && node.parentElement);
        return within(element, EDITOR_SURFACE);
      } catch { return false; }
    };
    const guardSelectionMethod = (name, nativeMethod, targetOf) => {
      if (!nativeMethod) return;
      Selection.prototype[name] = function () {
        if (state.copy) {
          const current = this.toString();
          if (current && current.length > 0) {
            const target = targetOf ? targetOf(arguments) : null;
            if (!(inEditor(this.anchorNode) || inEditor(this.focusNode) || inEditor(target))) return;
          }
        }
        return nativeMethod.apply(this, arguments);
      };
    };
    guardSelectionMethod('removeAllRanges', nativeRemoveAllRanges, null);
    guardSelectionMethod('empty', nativeEmpty, null);
    guardSelectionMethod('collapse', nativeCollapse, (args) => args[0]);
    guardSelectionMethod('collapseToEnd', nativeCollapseToEnd, null);
    guardSelectionMethod('collapseToStart', nativeCollapseToStart, null);
    guardSelectionMethod('removeRange', nativeRemoveRange, (args) => args[0] && args[0].commonAncestorContainer);
  } catch {}

  // ─── 5. Anti-Debugger & Anti-DevTools Protection ───
  // Neutralizes infinite debugger loops built on Function / .constructor, setInterval and setTimeout.
  // window.eval is deliberately NOT wrapped: replacing it turns every direct eval() in page code into
  // an indirect (global-scope) eval and breaks sites even when every feature is off.
  // The constructors that make code from a string are replaced only once the keyboard / developer-tools protection has been switched on (and not put
  // back afterwards: while it is off they pass everything through). A page the extension has no business with keeps the browser's own Function.
  let constructorGuardsInstalled = false;
  function installConstructorGuards() {
    if (constructorGuardsInstalled) return;
    constructorGuardsInstalled = true;
    try {
    // `Function('debugger')`, `new Function(...)` and the constructors reached through a function's prototype chain
    // (`(function () {}).constructor('debugger')`, and the same for async and generator functions) all make code from a string.
    // The language turns every argument into a string, and an object decides which string it gives (toString, valueOf, Symbol.toPrimitive) every
    // time it is asked, so a check that reads an argument and then hands the same argument on can be told one thing and compiled another. Each
    // argument is therefore asked ONCE here and the browser is handed the answers: what is checked is what is compiled.
    const sourcesOf = (args) => {
      const strings = [];
      for (let i = 0; i < args.length; i++) strings[i] = toPrimitiveString(args[i]);
      return strings;
    };
    const runGuarded = (args, standIn, run) => {
      if (!state.antiDebugger) return run(args);
      let strings;
      try { strings = sourcesOf(args); } catch { return run(args); } // an argument that cannot become a string (a Symbol): the browser raises its own error
      for (let i = 0; i < strings.length; i++) if (stringIncludes(strings[i], 'debugger')) return standIn;
      return run(strings);
    };
    // The stand-in is a no-op of the same kind as what the page asked for (a generator function must still give a generator).
    const guardConstructor = (nativeCtor, standIn) => new Proxy(nativeCtor, {
      construct(target, args, newTarget) {
        return runGuarded(args, standIn, (usable) => reflectConstruct(target, usable, newTarget));
      },
      apply(target, thisArg, args) {
        return runGuarded(args, standIn, (usable) => reflectApply(target, thisArg, usable));
      }
    });
    const functionProxy = guardConstructor(nativeFunction, function () {});
    weakMapSet(nativeSources, functionProxy, nativeFunctionToString.call(nativeFunction));
    window.Function = functionProxy;
    // `(function () {}).constructor('debugger')` reaches Function through the prototype, not the
    // global binding, so the prototype link must point at the proxy as well.
    Object.defineProperty(nativeFunctionPrototype, 'constructor', {
      value: functionProxy, writable: true, configurable: true, enumerable: false
    });
    for (const sample of [async function () {}, function* () {}, async function* () {}]) {
      try {
        const proto = Object.getPrototypeOf(sample);
        const ctor = proto.constructor;
        const proxied = guardConstructor(ctor, sample);
        weakMapSet(nativeSources, proxied, nativeFunctionToString.call(ctor));
        Object.defineProperty(proto, 'constructor', { value: proxied, writable: true, configurable: true, enumerable: false });
      } catch {}
    }
    } catch {}
  }

  try {
    const looksLikeDebuggerTrap = (handler) => {
      if (typeof handler === 'string') return handler.includes('debugger');
      if (typeof handler !== 'function') return false;
      try {
        const src = nativeFunctionToString.call(handler);
        return src.includes('debugger') && (src.includes('constructor') || src.includes('Function') || src.includes('eval'));
      } catch {
        return false;
      }
    };

    // Page scripts that run before content.js delivers the settings cannot be judged yet, so a trap-shaped
    // handler registered in that window is wrapped and re-checked against the state at every tick.
    const scheduleGuarded = (nativeSchedule, self, handler, timeout, args) => {
      if ((state.antiDebugger || !stateReceived) && looksLikeDebuggerTrap(handler)) {
        if (state.antiDebugger) return 0;
        // Only function handlers can be gated. A string handler would have to be run through Function()/eval to
        // be deferred, and this extension deliberately never executes strings; it passes through untouched.
        if (typeof handler === 'function') {
          const original = handler;
          const gated = function () { if (!state.antiDebugger) return original.apply(this, arguments); };
          return nativeSchedule.call(self, gated, timeout, ...args);
        }
      }
      return nativeSchedule.call(self, handler, timeout, ...args);
    };

    window.setInterval = function (handler, timeout, ...args) {
      return scheduleGuarded(nativeSetInterval, this, handler, timeout, args);
    };

    window.setTimeout = function (handler, timeout, ...args) {
      return scheduleGuarded(nativeSetTimeout, this, handler, timeout, args);
    };

    console.clear = function () {
      if (state.antiDebugger) return;
      return nativeConsoleClear.apply(this, arguments);
    };
  } catch {}

  // ─── 6. Anti-Copy Global Functions Stubs ───
  const protectedGlobals = [
    'disable_copy',
    'disable_copy_ie',
    'disableEnterKey',
    'show_wpcp_message',
    'hide_message',
    'nocontext',
    'norightclick',
    'disableSelection',
    'wccp_free_iscontenteditable',
    'wccp_free_is498',
    'wccpDisableSelection',
    'reEnable',
    'disableCtrlKeyCombination'
  ];

  function installProtectionGlobals() {
    for (const name of protectedGlobals) {
      if (!originalGlobals.has(name)) {
        originalGlobals.set(name, Object.getOwnPropertyDescriptor(window, name) || null);
      }
      const isMessage = name.includes('message') || name === 'hide_message';
      const replacement = function () { return isMessage ? false : true; };

      try {
        Object.defineProperty(window, name, {
          value: replacement,
          writable: false,
          configurable: true,
          enumerable: false
        });
      } catch {
        try { window[name] = replacement; } catch {}
      }
    }
  }

  function restoreProtectionGlobals() {
    for (const [name, descriptor] of originalGlobals) {
      try {
        if (descriptor) Object.defineProperty(window, name, descriptor);
        else delete window[name];
      } catch {}
    }
    originalGlobals.clear();
  }

  // ─── 7. Clear Inline Event Handlers ───
  // Inline handlers (<body oncontextmenu="return false">, <img ondragstart="return false">) never go
  // through Event.prototype.preventDefault, so the hooks above cannot neutralise them, and the ISOLATED
  // world cannot even see them (typeof body.ondragstart is "object" there). They have to be removed from
  // this world, and also for nodes that did not exist when the settings arrived.
  const INLINE_BLOCKER_PROPS = ['oncontextmenu', 'oncopy', 'oncut', 'onselectstart', 'onmousedown', 'ondragstart', 'onkeydown', 'onbeforeprint'];
  const INLINE_BLOCKER_SELECTOR = INLINE_BLOCKER_PROPS.map(prop => `[${prop}]`).join(',');

  // handlers taken off (remembered weakly, newest 600), put back when every protection is off again
  const sweptHandlers = [];
  function restoreSweptHandlers() {
    for (const { ref, prop, fn } of sweptHandlers.splice(0)) {
      try {
        const target = ref.deref();
        if (target && target[prop] === null) target[prop] = fn;
      } catch {}
    }
  }

  function sweepInlineHandlers(target) {
    for (const prop of INLINE_BLOCKER_PROPS) {
      try {
        const fn = target[prop];
        if (typeof fn !== 'function') continue;
        const source = nativeFunctionToString.call(fn).toLowerCase();
        if (
          source.includes('wpcp') ||
          source.includes('wccp') ||
          source.includes('nocontext') ||
          source.includes('disable_copy') ||
          source.includes('disableselection') ||
          source.includes('preventdefault') ||
          source.includes('return false')
        ) {
          sweptHandlers.push({ ref: new WeakRef(target), prop, fn });
          if (sweptHandlers.length > 600) sweptHandlers.shift();
          target[prop] = null;
        }
      } catch {}
    }
  }

  function cleanKnownInlineHandlers(root) {
    for (const target of [window, document, document.documentElement, document.body]) {
      if (target) sweepInlineHandlers(target);
    }
    try {
      (root || document).querySelectorAll(INLINE_BLOCKER_SELECTOR).forEach(sweepInlineHandlers);
    } catch {}
  }

  // Property handlers (document.onmousedown = function () { return false }) are assigned whenever the page likes: at load,
  // late, or over and over again. A one-time sweep misses all but the first, so the assignment itself is intercepted:
  // the page's own function still runs (it may do real work), only its "return false" is not allowed to stop a selection.
  const pageMouseDownHandlers = new WeakMap(); // our wrapper -> the page's own function
  function hookMouseDownProperty(target, appliesTo) {
    let owner = target;
    let descriptor = null;
    while (owner && !(descriptor = Object.getOwnPropertyDescriptor(owner, 'onmousedown'))) owner = Object.getPrototypeOf(owner);
    if (!descriptor || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function') return;
    try {
      Object.defineProperty(target, 'onmousedown', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          const value = descriptor.get.call(this);
          return pageMouseDownHandlers.get(value) || value; // the page reads back its own function
        },
        set(handler) {
          if (typeof handler !== 'function' || !appliesTo(this)) { descriptor.set.call(this, handler); return; }
          const wrapper = function (event) {
            const result = handler.apply(this, arguments);
            return result === false && cancelsSelection(event) ? undefined : result;
          };
          pageMouseDownHandlers.set(wrapper, handler);
          descriptor.set.call(this, wrapper);
        }
      });
    } catch {}
  }
  hookMouseDownProperty(window, () => true);
  hookMouseDownProperty(document, () => true);
  hookMouseDownProperty(HTMLElement.prototype, (el) => el === document.body || el === document.documentElement);

  let inlineSweepObserver = null;
  function setInlineSweepObserver(active) {
    if (!active) {
      inlineSweepObserver?.disconnect();
      inlineSweepObserver = null;
      return;
    }
    if (inlineSweepObserver || !document.documentElement) return;
    inlineSweepObserver = new MutationObserver((records) => {
      for (const record of records) {
        // an inline handler written onto an existing node later (body.setAttribute('onmousedown', ...))
        if (record.type === 'attributes') {
          if (record.target instanceof Element) sweepInlineHandlers(record.target);
          continue;
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          sweepInlineHandlers(node);
          try { node.querySelectorAll(INLINE_BLOCKER_SELECTOR).forEach(sweepInlineHandlers); } catch {}
        }
      }
    });
    inlineSweepObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: INLINE_BLOCKER_PROPS });
  }

  // ─── 8. Capturing Event Guards ───
  // Registered with the NATIVE addEventListener: the patched one skips listeners of exactly these types while the feature is on, which made
  // these guards do nothing at all.
  function installPageGuards() {
    const cleanups = [];
    const guard = (type, shouldStop) => {
      const handler = (event) => { if (shouldStop(event)) nativeStopImmediatePropagation.call(event); };
      nativeAddEventListener.call(window, type, handler, true);
      cleanups.push(() => nativeRemoveEventListener.call(window, type, handler, true));
    };

    if (state.rightClick) {
      guard('contextmenu', () => true);
      guard('mousedown', (event) => event.button === 2 && !pageKeeps('mousedown', event));
    }

    if (state.copy) {
      for (const type of ['copy', 'cut', 'selectstart']) guard(type, (event) => !pageKeeps(type, event));
    }

    guardCleanups = cleanups;
  }

  function removePageGuards() {
    for (const cleanup of guardCleanups.splice(0)) {
      try { cleanup(); } catch {}
    }
  }

  // ─── 9. Dialog Management ───
  // Only alert() is silenced. confirm() and prompt() ask the user a real question ("Delete this account?"): answering them on the user's behalf
  // would confirm destructive actions nobody agreed to, and answering "no" would break checkout and delete flows without a word. They are never touched.
  function enableDialogs() {
    if (dialogOriginals) return;
    const originalAlert = window.alert;
    dialogOriginals = { alert: originalAlert };

    try {
      window.alert = disguise(function (...args) {
        return state.alert ? undefined : reflectApply(originalAlert, this, args);
      }, originalAlert);
    } catch {}
  }

  function disableDialogs() {
    if (!dialogOriginals) return;
    try { window.alert = dialogOriginals.alert; } catch {}
    dialogOriginals = null;
  }

  // ─── 10. Anti-Blur / Tab Visibility Protection ───
  try {
    const nativeHiddenDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden') ||
                                  Object.getOwnPropertyDescriptor(document, 'hidden');
    const nativeVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState') ||
                                           Object.getOwnPropertyDescriptor(document, 'visibilityState');

    const hiddenGetter = function () {
      if (state.antiBlur) return false;
      return nativeHiddenDescriptor?.get ? nativeHiddenDescriptor.get.call(this) : false;
    };

    const visibilityGetter = function () {
      if (state.antiBlur) return 'visible';
      return nativeVisibilityStateDescriptor?.get ? nativeVisibilityStateDescriptor.get.call(this) : 'visible';
    };

    disguise(hiddenGetter, nativeHiddenDescriptor?.get);
    disguise(visibilityGetter, nativeVisibilityStateDescriptor?.get);

    if (window.Document && Document.prototype) {
      Object.defineProperty(Document.prototype, 'hidden', {
        get: hiddenGetter,
        configurable: true
      });
      Object.defineProperty(Document.prototype, 'visibilityState', {
        get: visibilityGetter,
        configurable: true
      });
    }

    Object.defineProperty(document, 'hidden', {
      get: hiddenGetter,
      configurable: true
    });

    Object.defineProperty(document, 'visibilityState', {
      get: visibilityGetter,
      configurable: true
    });
  } catch {}

  // ─── 10b. Shadow root announcements ───
  // attachShadow is not a DOM mutation, so content.js (ISOLATED world) cannot discover roots that are
  // attached after their host was inserted. Attachments are announced, debounced and without a payload, over the private port.
  let shadowSignalTimer = 0;
  try {
    Element.prototype.attachShadow = function () {
      const root = nativeAttachShadow.apply(this, arguments);
      if (!shadowSignalTimer) {
        shadowSignalTimer = nativeSetTimeout.call(window, () => {
          shadowSignalTimer = 0;
          try { if (established && mainPort) mainPort.postMessage({ type: 'shadow' }); } catch {}
        }, 40);
      }
      return root;
    };
  } catch {}

  // ─── 11. State Applicator ───
  function applyState(next) {
    stateReceived = true;
    state.rightClick = !!next?.rightClick;
    state.copy = !!next?.copy;
    state.clipboard = !!next?.clipboard;
    state.edit = !!next?.edit;
    state.alert = !!next?.alert;
    state.dragDrop = !!next?.dragDrop;
    state.keyboard = !!next?.keyboard;
    state.antiDebugger = !!next?.antiDebugger || !!next?.keyboard;
    if (state.antiDebugger) installConstructorGuards();
    state.scrollbar = !!next?.scrollbar;
    state.print = !!next?.print;
    state.antiBlur = !!next?.antiBlur;

    removePageGuards();

    if (state.rightClick || state.copy || state.clipboard || state.alert || state.dragDrop || state.keyboard || state.scrollbar || state.edit || state.print || state.antiBlur) {
      installProtectionGlobals();
      setInlineSweepObserver(true); // before the sweep, so a node added in between cannot slip through
      cleanKnownInlineHandlers();
      installPageGuards();
    } else {
      setInlineSweepObserver(false);
      restoreProtectionGlobals();
      restoreSweptHandlers();
    }

    if (state.print && nativePrint) {
      try { window.print = nativePrint; } catch {}
    }

    if (state.alert) enableDialogs();
    else disableDialogs();
  }

  // ─── 11b. The patched functions answer like the natives ───
  disguise(Event.prototype.preventDefault, nativePreventDefault);
  disguise(EventTarget.prototype.addEventListener, nativeAddEventListener);
  disguise(EventTarget.prototype.removeEventListener, nativeRemoveEventListener);
  disguise(DataTransfer.prototype.setData, nativeSetData);
  disguise(Selection.prototype.removeAllRanges, nativeRemoveAllRanges);
  disguise(Selection.prototype.empty, nativeEmpty);
  disguise(Selection.prototype.collapse, nativeCollapse);
  disguise(Selection.prototype.collapseToEnd, nativeCollapseToEnd);
  disguise(Selection.prototype.collapseToStart, nativeCollapseToStart);
  disguise(Selection.prototype.removeRange, nativeRemoveRange);
  disguise(window.setTimeout, nativeSetTimeout);
  disguise(window.setInterval, nativeSetInterval);
  disguise(console.clear, nativeConsoleClear);
  disguise(Element.prototype.attachShadow, nativeAttachShadow);

  // ─── 12. Bridge to the content script ───
  // The user's settings arrive through a MessagePort. Only this script and the content script hold its two ends: the port is handed over in a
  // window message that the content script (listening since before any page script can run) takes and stops, and it is never named in an event,
  // an attribute or a property the page can read. (The earlier bridge put a secret in an event's detail, which any page listener could read and
  // then forge commands with.) Nothing the page can post makes this script offer a port: the only thing that ever repeats the offer is its own
  // clock, and only while nobody has taken it (an earlier "hello" message asked for a new offer, so a page could post one, break the connection
  // that was just made and hear the new offer).
  const pendingPorts = new Set();
  const connect = () => {
    const channel = new MessageChannel();
    const port = channel.port1;
    pendingPorts.add(port);
    port.onmessage = (event) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ack') {
        if (established) return;
        established = true;
        mainPort = port;
        for (const other of pendingPorts) if (other !== port) { try { other.close(); } catch {} }
        pendingPorts.clear();
      } else if (port === mainPort) {
        if (message.type === 'SET_STATE') applyState(message.value || {});
        else if (message.type === 'SWEEP') cleanKnownInlineHandlers();
      }
    };
    reflectApply(nativePostMessage, window, [{ __su: 'offer' }, '*', [channel.port2]]);
  };
  connect();
  // Both scripts start in the same task, so the first offer is always taken. Should it ever not be, it is made again later from here (the
  // earlier ones stay open until one is answered, so a slow content script is not cut off).
  for (const delay of [400, 1500, 4000]) nativeSetTimeout.call(window, () => { if (!established) connect(); }, delay);
})();
