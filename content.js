(function installNativeLayerHost() {
  "use strict";

  // X owns the dialogs and editors. Promote their existing portal to the top
  // layer instead of moving an editor into the quick-reply footer.
  function createHost({ document }) {
    let session = null;
    const restore = (node, name, value) => value == null ? node.removeAttribute(name) : node.setAttribute(name, value);
    function release() {
      if (!session) return;
      const current = session;
      session = null;
      try { current.node.hidePopover(); } catch {}
      restore(current.node, "popover", current.popover);
      current.node.removeAttribute("data-sidex-native-layers");
    }
    function sync(root) {
      const layers = document.getElementById("layers");
      const needsOverlay = root?.classList.contains("sidepeek-open") &&
        layers?.querySelector('[role="dialog"], [role="menu"], [role="listbox"], [data-testid="Dropdown"]');
      if (!needsOverlay || !layers.showPopover) { release(); return false; }
      if (session?.node === layers) return true;
      release();
      // An existing native popover already has top-layer precedence.
      if (layers.hasAttribute("popover")) return true;
      session = { node: layers, popover: layers.getAttribute("popover") };
      layers.setAttribute("data-sidex-native-layers", "");
      layers.setAttribute("popover", "manual");
      try { layers.showPopover(); return true; }
      catch { release(); return false; }
    }
    return { sync, release, get active() { return Boolean(session); } };
  }
  globalThis.SidePeekNativeLayers = Object.freeze({ createHost });
})();


(function initSidePeek() {
  "use strict";

  if (window.top !== window.self) return;

  const Core = globalThis.SidePeekCore;
  const ROOT_ID = "sidepeek-drawer-root";
  const CONTENT_SOURCE = "sidepeek-content";
  const PAGE_SOURCE = "sidepeek-page";
  const PHOTO_COLLAPSE_PATH = "M11.59 12L3.54 3.96l1.42-1.42L14.41 12l-9.45 9.46-1.42-1.42L11.59 12zm7 0l-8.05-8.04 1.42-1.42L21.41 12l-9.45 9.46-1.42-1.42L18.59 12z";

  // SVG Icons (Official Twitter/X SVGs matching web client)
  const ICONS = {
    reply: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg>`,
    repost: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg>`,
    quote: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M14.23 2.854c.98-1.008 2.607-1.026 3.615-.04l2.54 2.49c1.008.98 1.026 2.607.04 3.615L9.67 19.884c-.37.38-.85.63-1.37.72l-5.32 1.03c-.61.12-1.18-.34-1.22-.96-.01-.1-.01-.19 0-.29l1.03-5.32c.09-.52.34-1 .72-1.37l10.72-10.84zm.708 2.124L4.85 15.903c-.19.19-.32.44-.36.71l-.66 3.42 3.42-.66c.27-.04.52-.17.71-.36L18.89 7.933l-3.952-3.955z"></path></g></svg>`,
    like: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12zM7.354 4.225c-2.08 0-3.903 1.988-3.903 4.255 0 5.74 7.034 11.596 8.55 11.658 1.518-.062 8.55-5.917 8.55-11.658 0-2.267-1.823-4.255-3.903-4.255-2.528 0-3.94 2.936-3.952 2.965-.23.562-1.156.562-1.387 0-.014-.03-1.425-2.965-3.954-2.965z"></path></g></svg>`,
    likeSolid: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.505.3-.505-.3c-4.379-2.55-7.029-5.19-8.38-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>`,
    views: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path></g></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"></path></g></svg>`,
    bookmarkSolid: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path></g></svg>`,
    share: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41L7.71 9.71 6.3 8.29 12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21.09 3 19.98 3 18.6L3 15h2l.01 3.6c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"></path></g></svg>`,
    close: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path></g></svg>`,
    back: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"></path></g></svg>`,
    external: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M18.36 5.64L6.7 17.3l1.41 1.41 11.66-11.66V12h2V3h-9v2h5.65zM4 6v14h14v-7h-2v5H6V8h5V6H4z"></path></g></svg>`,
    resetWidth: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"></path></g></svg>`,
    user: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path></g></svg>`,
    // Twitter Official 24x24 Composer Toolbar SVGs
    media: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7.75c0-.966.784-1.75 1.75-1.75s1.75.784 1.75 1.75-.784 1.75-1.75 1.75-1.75-.784-1.75-1.75z"></path></g></svg>`,
    gif: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v13c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-13c0-.276-.224-.5-.5-.5h-13zM7.75 10c.414 0 .75.336.75.75v2.5c0 .414-.336.75-.75.75h-1.5c-.414 0-.75-.336-.75-.75v-2.5c0-.414.336-.75.75-.75h1.5zm-.75 2.5h.75v-1h-.75v1zm4.25-2.5c.414 0 .75.336.75.75v2.5c0 .414-.336.75-.75.75h-.75v-4h.75zm5 0c.414 0 .75.336.75.75v.5c0 .414-.336.75-.75.75h-1.25v.5h1.25c.414 0 .75.336.75.75v.25c0 .414-.336.75-.75.75h-2c-.414 0-.75-.336-.75-.75v-3.5c0-.414.336-.75.75-.75h2zm-.75 1.25h.5v-.5h-.5v.5z"></path></g></svg>`,
    poll: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M6 5a2 2 0 100 4 2 2 0 000-4zm-4 2a4 4 0 118 0 4 4 0 01-8 0zm10-1a1 1 0 011-1h9a1 1 0 110 2h-9a1 1 0 01-1-1zm0 8a1 1 0 011-1h9a1 1 0 110 2h-9a1 1 0 01-1-1zm-6 2a2 2 0 100 4 2 2 0 000-4zm-4 2a4 4 0 118 0 4 4 0 01-8 0z"></path></g></svg>`,
    emoji: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 18c-2.28 0-4.22-1.66-5-4h10c-.78 2.34-2.72 4-5 4zm-8-6c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8-8-3.589-8-8zm-2 0c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2 2 6.477 2 12z"></path></g></svg>`,
    schedule: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M6 3V1.5a1 1 0 012 0V3h8V1.5a1 1 0 012 0V3h2.5A2.5 2.5 0 0123 5.5v13a2.5 2.5 0 01-2.5 2.5h-17A2.5 2.5 0 011 18.5v-13A2.5 2.5 0 013.5 3H6zm14.5 4.5h-17a.5.5 0 00-.5.5v10.5c0 .276.224.5.5.5h17c.276 0 .5-.224.5-.5V8a.5.5 0 00-.5-.5zM8 12.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm4 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm4 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-8 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm4 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path></g></svg>`,
    location: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path></g></svg>`,
    disclosure: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M3 2h18.61l-3.5 7 3.5 7H5v6H3V2zm2 12h13.38l-2.5-5 2.5-5H5v10z"></path></g></svg>`,
    more: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></g></svg>`,
    copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></g></svg>`,
    mute: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M18 6.59V1.2L8.71 7H5.5C4.12 7 3 8.12 3 9.5v5C3 15.88 4.12 17 5.5 17h3.21L18 22.8v-5.39l-2-2V7.7l-4.71 2.95-.58-.9 6.29-3.94 1 .78zM16 13.59l-2-2V9.41l2-1.25v5.43zm5.71 8.7l-19-19 1.41-1.41 19 19-1.41 1.41z"></path></g></svg>`,
    block: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.93 0 3.68.68 5.06 1.82L4.82 17.06C3.68 15.68 3 13.93 3 12c0-4.96 4.04-9 9-9zm0 16c-1.93 0-3.68-.68-5.06-1.82L19.18 6.94C20.32 8.32 21 10.07 21 12c0 4.96-4.04 9-9 9z"></path></g></svg>`,
    webShare: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path></g></svg>`
  };

  const EMOJI_CATEGORIES = [
    {
      name: "常用",
      emojis: ["😂", "🤣", "😭", "🥺", "😍", "🥰", "😎", "🤔", "😅", "🙄", "🤫", "🤩", "🤤", "🥳", "🤯", "💀", "🤡", "💩", "👻", "💯", "🔥", "✨", "🎉", "🚀"]
    },
    {
      name: "手势",
      emojis: ["👍", "👎", "👏", "🙌", "🤝", "🙏", "✌️", "🤞", "🫡", "💪", "✊", "👊", "👆", "👇", "👉", "👈", "🤙", "💅", "🫶", "❤️", "💔", "💖", "💙", "🖤"]
    },
    {
      name: "反应",
      emojis: ["👀", "🙈", "🙉", "🙊", "🐶", "🐱", "🐼", "🐵", "🐸", "🍔", "🍕", "🍺", "☕️", "🍦", "☀️", "🌙", "⚡️", "🌈", "💡", "📌", "🎯", "🏆", "💎", "⚠️"]
    }
  ];


  const state = {
    open: false,
    focalTweetId: null,
    focalArticle: null,
    focalModel: null,
    replies: [],
    tree: null,
    expandedThreadIds: new Set(),
    loadedThreadIds: new Set(),
    loadingThreadIds: new Set(),
    threadCursors: new Map(),
    autoLoadReplies: true,
    autoExpandReplyText: false,
    threadPages: new Map(),
    openGatedThreads: new Set(),
    consumedCursors: new Map(),
    anchorCommentId: null,
    resetScrollOnRender: false,
    activeView: "root", // "root" or { type: "drilldown", parentId: string }
    replyTarget: null, // Comment model being replied to, or null for focal tweet
    loading: false,
    error: "",
    isResizing: false,
    subReplyLimit: 1,
    replyMode: "drawer",
    photoMode: "sidex",
    nativeReplyTransfer: null,
    translationProvider: "x",
    threadGeneration: 0
  };

  const pendingRequests = new Map();
  let requestSequence = 0;
  const commentNodes = new Map();
  const translations = new Map();
  const expandedTexts = new Set();
  const expandedQuotes = new Set();
  // Text drafts live only in this page. Attachments stay with the active edit.
  const composerDrafts = new Map();
  const replyDraftTargets = new Map();
  const pendingActions = new Set();
  const nativeActionObservers = new Map();
  const nativeActionArticles = new Map();
  const nativeLayers = globalThis.SidePeekNativeLayers?.createHost({ document });
  let drawerRoot = null;
  let photoViewer = null;
  let dockedPhotoPanel = null;
  let dismissedPhotoId = null;
  const photoScrollPositions = new Map();

  function requestPage(type, payload, timeoutMs = 18000) {
    const requestId = ++requestSequence;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error("等待 X 响应超时，请刷新重试"));
      }, timeoutMs);
      pendingRequests.set(requestId, { resolve, reject, timer });
      window.postMessage({ source: CONTENT_SOURCE, type, requestId, ...payload }, location.origin);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== PAGE_SOURCE) return;
    if (event.data?.type === "URL_CHANGED") {
      checkDetailPageAutoOpen();
      return;
    }
    if (event.data?.type === "REPLY_CREATED") {
      for (const model of Core.collectTweetModels(event.data.payload)) {
        const intent = state.nativeReplyTransfer;
        if (intent?.targetId === model.inReplyToId && intent.draft?.text === intent.text) {
          intent.draft.text = "";
          intent.draft.media.length = 0;
          const currentTarget = state.replyTarget?.id || (state.activeView?.type === "drilldown" ? state.activeView.parentId : state.focalTweetId);
          if (state.focalTweetId === intent.focalId && currentTarget === intent.targetId) {
            const textarea = document.querySelector(".sidepeek-footer-textarea");
            if (textarea) textarea.value = "";
            document.querySelector(".sidepeek-footer-composer")?._sidepeekComposer?.refresh();
          }
          state.nativeReplyTransfer = null;
        }
        acceptCreatedReply(model);
      }
      return;
    }
    const request = pendingRequests.get(event.data.requestId);
    if (!request) return;
    window.clearTimeout(request.timer);
    pendingRequests.delete(event.data.requestId);
    if (event.data.ok) request.resolve(event.data.payload);
    else request.reject(new Error(event.data.error || "X 请求失败"));
  });

  function currentThemeClass() {
    const color = getComputedStyle(document.body).backgroundColor;
    if (/rgb\(0, 0, 0\)/.test(color)) return "sidepeek-theme-dark";
    if (/rgb\((?:21|22), (?:31|32), (?:42|43)\)/.test(color)) return "sidepeek-theme-dim";
    return "sidepeek-theme-light";
  }

  // ==========================================================================
  // Extension State & Internationalization (i18n)
  // ==========================================================================
  let isSideXEnabled = true;
  let overrideLocale = null;

  function getLocale() {
    if (overrideLocale === "zh" || overrideLocale === "en") return overrideLocale;
    const htmlLang = (document.documentElement.lang || navigator.language || "en").toLowerCase();
    return htmlLang.startsWith("zh") ? "zh" : "en";
  }

  const storage = chrome?.storage?.sync || chrome?.storage?.local;
  if (storage) {
    storage.get({ sidex_enabled: true, sidex_auto_load_replies: true, sidex_auto_expand_reply_text: false, sidex_lang: null, sidex_sub_reply_limit: 1, sidex_reply_mode: "drawer", sidex_photo_mode: "sidex", sidex_translation_provider: "x" }, (res) => {
      isSideXEnabled = res.sidex_enabled !== false;
      state.autoLoadReplies = res.sidex_auto_load_replies !== false;
      state.autoExpandReplyText = res.sidex_auto_expand_reply_text === true;
      state.translationProvider = ["x", "google", "external"].includes(res.sidex_translation_provider) ? res.sidex_translation_provider : "x";
      state.photoMode = res.sidex_photo_mode === "native" ? "native" : "sidex";
      if (res.sidex_lang) overrideLocale = res.sidex_lang;
      if (res.sidex_sub_reply_limit !== undefined) {
        state.subReplyLimit = Math.max(1, Number(res.sidex_sub_reply_limit) || 1);
      }
      if (res.sidex_reply_mode !== undefined) {
        state.replyMode = res.sidex_reply_mode === "native" ? "native" : "drawer";
      }
      if (!isSideXEnabled) {
        closeDrawer();
        const root = document.getElementById(ROOT_ID);
        if (root) root.style.display = "none";
      }
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.sidex_auto_expand_reply_text !== undefined) {
        state.autoExpandReplyText = changes.sidex_auto_expand_reply_text.newValue === true;
        if (state.open) renderDrawer();
      }
      if (changes.sidex_auto_load_replies !== undefined) {
        state.autoLoadReplies = changes.sidex_auto_load_replies.newValue !== false;
        if (state.open) renderDrawer();
      }
      if (changes.sidex_enabled !== undefined) {
        isSideXEnabled = changes.sidex_enabled.newValue !== false;
        const root = document.getElementById(ROOT_ID);
        if (!isSideXEnabled) {
          releasePhotoPanel();
          document.documentElement.removeAttribute("data-sidex-photo-view");
          closeDrawer();
          if (root) root.style.display = "none";
        } else {
          if (root) root.style.display = "";
          checkDetailPageAutoOpen();
        }
      }
      if (changes.sidex_photo_mode !== undefined) {
        state.photoMode = changes.sidex_photo_mode.newValue === "native" ? "native" : "sidex";
        dismissedPhotoId = null;
        syncPhotoViewer();
      }
      if (changes.sidex_lang !== undefined) {
        overrideLocale = changes.sidex_lang.newValue;
        if (state.open) renderDrawer();
      }
      if (changes.sidex_translation_provider !== undefined) {
        state.translationProvider = ["x", "google", "external"].includes(changes.sidex_translation_provider.newValue) ? changes.sidex_translation_provider.newValue : "x";
        if (state.open) renderDrawer();
      }
      if (changes.sidex_reply_mode !== undefined) {
        state.replyMode = changes.sidex_reply_mode.newValue === "native" ? "native" : "drawer";
        if (state.open) renderDrawer(true);
      }
      if (changes.sidex_sub_reply_limit !== undefined) {
        state.subReplyLimit = Math.max(1, Number(changes.sidex_sub_reply_limit.newValue) || 1);
        if (state.open) {
          renderDrawer();
          if (state.subReplyLimit > 1) {
            prefetchSubRepliesForRoots();
          }
        }
      }
      if (changes.sidex_reset_width_trigger !== undefined) {
        localStorage.removeItem("sidepeek_custom_width_v2");
        updateDrawerPosition();
        showToast(t("widthResetToast"));
      }
    });
  }

  const TRANSLATIONS = {
    zh: {
      threadBranch: "对话分支",
      backToAll: "返回全部评论",
      resetWidth: "恢复默认宽度",
      widthResetToast: "已恢复默认宽度",
      openOnX: "在 X 详情页打开",
      closeSidebar: "关闭侧栏",
      replyToAuthor: "回复 @{handle}... (按 Ctrl+Enter 发送)",
      replyToUser: "回复 @{handle}...",
      replyToWithPaste: "回复 @{handle}... (支持 Ctrl+V 粘贴图片)",
      ctrlEnterHint: "按 Ctrl+Enter 发送",
      replyBtn: "回复",
      sendBtn: "发送",
      cancelBtn: "取消",
      sending: "发送中...",
      uploading: "上传中...",
      processingGif: "处理 GIF...",
      uploadFailed: "图片上传失败",
      gifUploadFailed: "GIF 上传失败",
      replyFailed: "回复发送失败，请重试",
      replySent: "回复已发布",
      replyStatusUnknown: "X 未返回已发布的回复，草稿已保留。请先在 X 确认发布状态。",
      overCharLimit: "字数超出限制",
      emptyReplies: "暂无评论，快来抢沙发吧~",
      noMoreReplies: "暂无更多子回复",
      loadingReplies: "正在加载评论...",
      loadMoreComments: "加载更多评论",
      loadMoreThreadReplies: "加载更多回复",
      retryBtn: "重试",
      showReplies: "展开 {count} 条回复",
      showMoreReplies: "展开另外 {count} 条已加载回复",
      collapseReplies: "收起回复",
      loadRepliesFailed: "加载回复失败，请重试",
      replyToTag: "回复",
      replyAction: "回复",
      repostAction: "转发",
      undoRepostAction: "撤销转发",
      quoteAction: "引用",
      quoteOpenedToast: "正在打开引用推文",
      followBtn: "关注",
      followingBtn: "正在关注",
      unfollowBtn: "取消关注",
      followsYou: "关注了你",
      followingCountLabel: "正在关注",
      followersCountLabel: "关注者",
      opBadge: "作者",
      opBadgeTitle: "原推文作者",
      moreActionsTitle: "更多操作",
      copyLink: "复制推文链接",
      copyText: "复制正文文本",
      textCopied: "文本已复制到剪贴板",
      openOnXDirect: "在 X 官方打开",
      muteUser: "静音 @{handle}",
      unmuteUser: "取消静音 @{handle}",
      userMuted: "已静音 @{handle}",
      blockUser: "屏蔽 @{handle}",
      unblockUser: "取消屏蔽 @{handle}",
      userBlocked: "已屏蔽 @{handle}",
      translateAction: "翻译推文",
      translating: "翻译中...",
      translatedBy: "由 {provider} 翻译 · {lang}",
      originalLanguage: "原语言",
      translationRetry: "翻译失败，点击重试",
      translationHelp: "X 翻译暂时不可用，可重试或在扩展设置中选择 Google。",
      profileLoading: "正在加载用户资料…",
      profileFailed: "资料加载失败，点击重试",
      mutualFollowers: "你关注的 {names} 也关注了此人",
      mutualFollowersMore: "你关注的 {names} 和另外 {count} 人也关注了此人",
      noMutualFollowers: "你关注的人中没有人关注此账号",
      openFullProfile: "查看完整资料",
      actionFailed: "操作失败，已恢复原状态",
      hideTranslation: "隐藏翻译",
      translateFailed: "翻译失败",
      showMorePost: "显示更多",
      expandQuote: "展开引用",
      collapseQuote: "收起引用",
      likeAction: "喜欢",
      viewsAction: "浏览量",
      bookmarkAction: "书签",
      shareAction: "分享",
      shareVia: "系统分享",
      linkCopied: "链接已复制到剪贴板",
      justNow: "刚刚",
      minutesAgo: "{m}分",
      hoursAgo: "{h}小时",
      mediaToolTitle: "添加图片 (JPG/PNG/WebP，最多4张，支持 Ctrl+V)",
      quickMediaFormats: "快捷保底回复支持 JPG/PNG/WebP；视频和 GIF 请使用官方回复。",
      gifToolTitle: "添加 GIF",
      pollToolTitle: "创建投票",
      emojiToolTitle: "添加表情",
      scheduleToolTitle: "定时发布",
      locationToolTitle: "添加位置",
      disclosureToolTitle: "内容披露（付费合作 / AI 内容）",
      openNativeReplyTitle: "在官方框中回复 (支持长文/富文本/多功能)",
      switchToNativeMode: "切换到官方回复",
      charCountTitle: "字数统计",
      maxMediaReached: "单条回复最多添加 4 个附件",
      mediaStillUploading: "附件正在上传中，请稍候...",
      nativeReplyOpenedToast: "已打开官方回复框",
      nativeDraftAlreadyOpen: "已有官方回复草稿，请先完成或关闭该草稿。",
      nativeMediaKeepDraft: "附件已保留在侧栏；请在当前页打开对应评论后转入官方回复。",
      nativeReplyNotReady: "官方回复框尚未就绪，侧栏草稿已保留。",
      nativeDraftKept: "侧栏草稿已保留，请手动复制到官方回复框。",
      overCharLimitNote: "超出长文最大限制（25,000 字）",
      // Popover
      searchGifPlaceholder: "搜索反应表情 GIF...",
      noGifFound: "未找到相关 GIF",
      allCategory: "全部",
      pollTitle: "创建投票",
      pollOpt1Placeholder: "选项 1 (必填)",
      pollOpt2Placeholder: "选项 2 (必填)",
      pollOpt3Placeholder: "选项 3 (选填)",
      pollOpt4Placeholder: "选项 4 (选填)",
      pollDurationLabel: "时长：",
      pollDay1: "1 天",
      pollDay3: "3 天",
      pollDay7: "7 天",
      pollClear: "清除",
      pollApply: "应用",
      pollValidation: "请至少填写选项 1 和选项 2",
      pollAddedToast: "已添加投票选项",
      pollBadge: "📊 投票 ({count}选项 · {days}天)",
      deletePoll: "删除投票",
      scheduleTitle: "定时发送",
      scheduleLabel: "选择发送时间：",
      scheduleClear: "清除",
      scheduleApply: "设定",
      scheduleSetToast: "已设定定时：{time}",
      scheduleBadge: "🕒 定时：{time}",
      cancelSchedule: "取消定时",
      locationAttachedToast: "已附带位置",
      locationClearedToast: "已清除位置标签",
      locationBadge: "📍 位置已附带",
      deleteLocation: "删除位置",
      emojiCats: {
        frequent: "常用",
        gestures: "手势",
        reactions: "反应"
      },
      gifTags: {
        all: "全部",
        laugh: "哈哈",
        agree: "点赞",
        clap: "鼓掌",
        popcorn: "吃瓜",
        love: "比心",
        shock: "震惊",
        facepalm: "无语",
        cry: "哭泣"
      }
    },
    en: {
      threadBranch: "Thread",
      backToAll: "Back to all replies",
      resetWidth: "Reset width",
      widthResetToast: "Default width restored",
      openOnX: "Open on X",
      closeSidebar: "Close sidebar",
      replyToAuthor: "Reply to @{handle}... (Ctrl+Enter to send)",
      replyToUser: "Reply to @{handle}...",
      replyToWithPaste: "Reply to @{handle}... (Ctrl+V to paste images)",
      ctrlEnterHint: "Ctrl+Enter to send",
      replyBtn: "Reply",
      sendBtn: "Send",
      cancelBtn: "Cancel",
      sending: "Replying...",
      uploading: "Uploading...",
      processingGif: "Processing GIF...",
      uploadFailed: "Failed to upload image",
      gifUploadFailed: "Failed to upload GIF",
      replyFailed: "Failed to send reply. Please try again.",
      replySent: "Reply sent",
      replyStatusUnknown: "X did not return the published reply. Draft kept; check X before trying again.",
      overCharLimit: "Character limit exceeded",
      emptyReplies: "No replies yet. Be the first to reply!",
      noMoreReplies: "No more replies",
      loadingReplies: "Loading replies...",
      loadMoreComments: "Load more comments",
      loadMoreThreadReplies: "Load more replies",
      retryBtn: "Retry",
      showReplies: "Show {count} replies",
      showMoreReplies: "Show {count} more loaded replies",
      collapseReplies: "Collapse replies",
      loadRepliesFailed: "Failed to load replies",
      replyToTag: "Replying to",
      replyAction: "Reply",
      repostAction: "Repost",
      undoRepostAction: "Undo Repost",
      quoteAction: "Quote",
      quoteOpenedToast: "Opening quote tweet",
      followBtn: "Follow",
      followingBtn: "Following",
      unfollowBtn: "Unfollow",
      followsYou: "Follows you",
      followingCountLabel: "Following",
      followersCountLabel: "Followers",
      opBadge: "Author",
      opBadgeTitle: "Post author",
      moreActionsTitle: "More",
      copyLink: "Copy link to post",
      copyText: "Copy post text",
      textCopied: "Text copied to clipboard",
      openOnXDirect: "Open on X",
      muteUser: "Mute @{handle}",
      unmuteUser: "Unmute @{handle}",
      userMuted: "Muted @{handle}",
      blockUser: "Block @{handle}",
      unblockUser: "Unblock @{handle}",
      userBlocked: "Blocked @{handle}",
      translateAction: "Translate post",
      translating: "Translating...",
      translatedBy: "Translated by {provider} · {lang}",
      originalLanguage: "Original language",
      translationRetry: "Translation failed. Retry",
      translationHelp: "X translation is unavailable. Retry or choose Google in extension settings.",
      profileLoading: "Loading profile…",
      profileFailed: "Couldn't load profile. Retry",
      mutualFollowers: "Followed by {names}",
      mutualFollowersMore: "Followed by {names}, and {count} others you follow",
      noMutualFollowers: "Not followed by anyone you’re following",
      openFullProfile: "View full profile",
      actionFailed: "Action failed. Previous state restored",
      hideTranslation: "Hide translation",
      translateFailed: "Translation failed",
      showMorePost: "Show more",
      expandQuote: "Expand quote",
      collapseQuote: "Collapse quote",
      likeAction: "Like",
      viewsAction: "Views",
      bookmarkAction: "Bookmark",
      shareAction: "Share",
      shareVia: "Share via...",
      linkCopied: "Link copied to clipboard",
      justNow: "just now",
      minutesAgo: "{m}m",
      hoursAgo: "{h}h",
      mediaToolTitle: "Add JPG/PNG/WebP images (up to 4, Ctrl+V)",
      quickMediaFormats: "Fallback quick reply supports JPG/PNG/WebP. Use official reply for video or GIF.",
      gifToolTitle: "Add GIF",
      pollToolTitle: "Create poll",
      emojiToolTitle: "Add emoji",
      scheduleToolTitle: "Schedule post",
      locationToolTitle: "Add location",
      disclosureToolTitle: "Content disclosure (paid partnership / AI content)",
      openNativeReplyTitle: "Open in official reply box",
      switchToNativeMode: "Switch to Official Reply",
      charCountTitle: "Character count",
      maxMediaReached: "Maximum 4 attachments allowed",
      mediaStillUploading: "Attachments are still uploading...",
      nativeReplyOpenedToast: "Official reply dialog opened",
      nativeDraftAlreadyOpen: "An official reply draft is already open. Finish or close it first.",
      nativeMediaKeepDraft: "Attachments kept. Open the matching comment on this page before using official reply.",
      nativeReplyNotReady: "Official reply is not ready. Sidebar draft kept.",
      nativeDraftKept: "Sidebar draft kept. Copy it into the official reply editor.",
      overCharLimitNote: "Exceeds long post limit (25,000 characters)",
      // Popover
      searchGifPlaceholder: "Search GIFs...",
      noGifFound: "No GIFs found",
      allCategory: "All",
      pollTitle: "Create a poll",
      pollOpt1Placeholder: "Option 1 (required)",
      pollOpt2Placeholder: "Option 2 (required)",
      pollOpt3Placeholder: "Option 3 (optional)",
      pollOpt4Placeholder: "Option 4 (optional)",
      pollDurationLabel: "Duration:",
      pollDay1: "1 day",
      pollDay3: "3 days",
      pollDay7: "7 days",
      pollClear: "Clear",
      pollApply: "Apply",
      pollValidation: "Please fill in at least Option 1 and Option 2",
      pollAddedToast: "Poll added",
      pollBadge: "📊 Poll ({count} options · {days}d)",
      deletePoll: "Delete poll",
      scheduleTitle: "Schedule post",
      scheduleLabel: "Select date and time:",
      scheduleClear: "Clear",
      scheduleApply: "Confirm",
      scheduleSetToast: "Scheduled for: {time}",
      scheduleBadge: "🕒 Scheduled: {time}",
      cancelSchedule: "Cancel schedule",
      locationAttachedToast: "Location attached",
      locationClearedToast: "Location removed",
      locationBadge: "📍 Location attached",
      deleteLocation: "Delete location",
      emojiCats: {
        frequent: "Frequent",
        gestures: "Gestures",
        reactions: "Reactions"
      },
      gifTags: {
        all: "All",
        laugh: "Laugh",
        agree: "Agree",
        clap: "Clap",
        popcorn: "Popcorn",
        love: "Love",
        shock: "Shock",
        facepalm: "Facepalm",
        cry: "Cry"
      }
    }
  };

  function t(key, params = {}) {
    const locale = getLocale();
    const dict = TRANSLATIONS[locale] || TRANSLATIONS.en;
    let val = dict[key] || TRANSLATIONS.zh[key] || key;
    if (typeof val === "string") {
      for (const [k, v] of Object.entries(params)) {
        val = val.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return val;
  }

  function formatCount(number) {
    if (!number || number <= 0) return "";
    const locale = getLocale();
    if (locale === "zh") {
      if (number >= 10000) return `${(number / 10000).toFixed(1)}万`;
      if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
      return String(number);
    } else {
      if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
      if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
      return String(number);
    }
  }

  function formatTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    const locale = getLocale();
    if (diff < 60) return t("justNow");
    if (diff < 3600) return t("minutesAgo", { m: Math.floor(diff / 60) });
    if (diff < 86400) return t("hoursAgo", { h: Math.floor(diff / 3600) });
    if (locale === "zh") {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    } else {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    }
  }

  function formatFullDateTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const locale = getLocale();
    const hours = date.getHours();
    const mins = String(date.getMinutes()).padStart(2, "0");
    if (locale === "zh") {
      const period = hours < 12 ? "上午" : "下午";
      const h12 = hours % 12 || 12;
      return `${period}${h12}:${mins} · ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } else {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const period = hours < 12 ? "AM" : "PM";
      const h12 = hours % 12 || 12;
      return `${h12}:${mins} ${period} · ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
  }

  function getCurrentUserInfo() {
    let avatar = "";
    let name = "";
    let handle = "";

    const switcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (switcher) {
      const img = switcher.querySelector("img");
      if (img) avatar = img.src;
      const spans = switcher.querySelectorAll("span");
      for (const s of spans) {
        const txt = s.textContent?.trim() || "";
        if (txt.startsWith("@") && !handle) {
          handle = txt.slice(1);
        } else if (txt && !name && !txt.startsWith("@") && !txt.includes("…")) {
          name = txt;
        }
      }
    }

    if (!avatar) {
      avatar = getCurrentUserAvatar();
    }
    if (!name) {
      name = handle || (getLocale() === "zh" ? "我" : "You");
    }
    if (!handle) {
      handle = "you";
    }

    return { avatar, name, handle };
  }

  function getCurrentUserAvatar() {
    const avatarImg = document.querySelector(
      '[data-testid="SideNav_AccountSwitcher_Button"] img, header [data-testid="UserAvatar-Container-unknown"] img, [data-testid="tweetTextarea_0"] img'
    );
    return avatarImg?.src || "";
  }

  // ==========================================================================
  // Drawer DOM Setup & Layout Positioning
  // ==========================================================================
  function ensureDrawerRoot() {
    let root = drawerRoot || document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("aside");
      root.id = ROOT_ID;
      root.className = currentThemeClass();

      // 阻止抽屉内所有 <a> 标签的点击冒泡到外部，防止 Twitter 原生 SPA router 拦截或导致主页异常重定向
      const handleLinkClick = (e) => {
        const link = e.target.closest("a");
        if (link && link.href) {
          e.stopPropagation();
        }
      };
      root.addEventListener("click", handleLinkClick);
      root.addEventListener("auxclick", handleLinkClick);

      document.body.appendChild(root);
    } else {
      root.className = currentThemeClass();
    }
    drawerRoot = root;
    return root;
  }

  function releasePhotoPanel() {
    rememberPhotoScroll();
    // Keep our node and drafts when React removes or replaces the native viewer.
    if (drawerRoot && dockedPhotoPanel?.contains(drawerRoot)) document.body.appendChild(drawerRoot);
    dockedPhotoPanel?.removeAttribute("data-sidex-photo-panel");
    dockedPhotoPanel = null;
  }

  function rememberPhotoScroll() {
    if (dockedPhotoPanel?.isConnected && document.documentElement.dataset.sidexPhotoView === "sidex" && state.focalTweetId) {
      const body = drawerRoot?.querySelector('.sidepeek-body');
      if (body) photoScrollPositions.set(state.focalTweetId, body.scrollTop);
    }
  }

  function findPhotoCollapseButton() {
    return [...(photoViewer?.viewer.querySelectorAll('button') || [])].find(button =>
      !drawerRoot?.contains(button) && button.querySelector('svg path')?.getAttribute('d') === PHOTO_COLLAPSE_PATH);
  }

  function syncPhotoHeader(root) {
    const canCollapse = Boolean(dockedPhotoPanel && findPhotoCollapseButton());
    const collapse = root?.querySelector('.sidepeek-btn-photo-collapse');
    const close = root?.querySelector('.sidepeek-btn-close');
    const reset = root?.querySelector('.sidepeek-btn-reset-width');
    if (collapse) collapse.style.display = canCollapse ? "inline-flex" : "none";
    if (close) close.style.display = "inline-flex";
    if (reset) reset.style.display = dockedPhotoPanel ? "none" : "inline-flex";
  }

  function syncPhotoViewer() {
    if (!isSideXEnabled) return false;
    const match = location.pathname.match(/\/status\/(\d+)\/photo\/\d+\/?$/);
    if (match) {
      const swipe = document.querySelector('#layers [data-testid="swipe-to-dismiss"]');
      const viewer = swipe?.closest('[role="dialog"]');
      const region = viewer?.querySelector('section[role="region"]');
      const panel = region?.parentElement;
      if (!panel || panel.contains(swipe)) {
        releasePhotoPanel();
        document.documentElement.setAttribute("data-sidex-photo-view", "native");
        return true; // Wait for X to finish mounting; never cover the image.
      }
      const tweetId = match[1];
      photoViewer = { viewer, panel, tweetId };
      if (state.photoMode !== "sidex" || dismissedPhotoId === tweetId) {
        releasePhotoPanel();
        document.documentElement.setAttribute("data-sidex-photo-view", "native");
      } else {
        const root = drawerRoot || ensureDrawerRoot();
        const remounting = root.parentElement !== panel;
        if (dockedPhotoPanel !== panel) {
          releasePhotoPanel();
          dockedPhotoPanel = panel;
          panel.setAttribute("data-sidex-photo-panel", "");
        }
        if (root.parentElement !== panel) panel.appendChild(root);
        document.documentElement.setAttribute("data-sidex-photo-view", "sidex");
        if (!state.open || state.focalTweetId !== tweetId) openDrawerForTweet(tweetId, findDetailFocalArticle(tweetId));
        else {
          updateDrawerPosition();
          if (remounting) {
            const body = root.querySelector('.sidepeek-body');
            if (body) body.scrollTop = photoScrollPositions.get(state.focalTweetId) || 0;
          }
        }
        syncPhotoHeader(root);
        updateQuotePreviews(root);
        nativeLayers?.sync(root);
      }
      return true;
    }
    // The reply dialog and its pickers can temporarily cover a photo viewer.
    if (photoViewer?.viewer.isConnected && (nativeReplyOpening || document.querySelector('#layers [role="dialog"]'))) return true;
    if (photoViewer || dockedPhotoPanel) {
      const wasDocked = Boolean(dockedPhotoPanel);
      releasePhotoPanel();
      photoViewer = null;
      dismissedPhotoId = null;
      lastCheckedUrl = "";
      updateDrawerPosition();
      if (wasDocked && state.open) renderDrawer();
    }
    document.documentElement.removeAttribute("data-sidex-photo-view");
    return false;
  }

  function updateDrawerPosition() {
    const root = drawerRoot || document.getElementById(ROOT_ID);
    if (!root || !state.open) return;
    if (dockedPhotoPanel?.contains(root)) {
      root.style.left = "0px";
      root.style.right = "0px";
      root.style.width = "100%";
      return;
    }

    // 使用全新键名，避免继承旧版误保存的大宽度数据
    const savedWidth = Number(localStorage.getItem("sidepeek_custom_width_v2"));
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');

    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      const minWidth = Math.round(rect.width) || 350;
      // 保证最大宽度永远留出至少 12px 边距，确保拖拽到最右侧时不会被浏览器边缘截断或丢失光标
      const maxWidth = Math.max(minWidth, Math.round(window.innerWidth - rect.left) - 12);

      // 默认宽度严格与原生第三列一致（约 350px）
      let targetWidth = minWidth;
      if (savedWidth && savedWidth >= minWidth) {
        targetWidth = Math.min(maxWidth, savedWidth);
      }

      root.style.left = `${rect.left}px`;
      root.style.width = `${targetWidth}px`;
      root.style.right = "auto";
    } else {
      const savedWidth = Number(localStorage.getItem("sidepeek_custom_width_v2")) || 380;
      root.style.right = "0px";
      root.style.left = "auto";
      root.style.width = `${savedWidth}px`;
    }
  }

  function initResizeHandle(root) {
    const handleRight = root.querySelector(".sidepeek-resize-handle-right");
    const handleLeft = root.querySelector(".sidepeek-resize-handle-left");
    const resetBtn = root.querySelector(".sidepeek-btn-reset-width");

    function resetWidth() {
      localStorage.removeItem("sidepeek_custom_width_v2");
      updateDrawerPosition();
      showToast("已恢复默认宽度");
    }

    resetBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      resetWidth();
    });

    function bindDrag(handle, isLeft) {
      if (!handle) return;

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handle.classList.add("dragging");
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        state.isResizing = true;

        const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
        const minWidth = sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 350;
        const initialRect = root.getBoundingClientRect();
        let hasMoved = false;

        function onMouseMove(moveEvent) {
          hasMoved = true;
          if (isLeft) {
            // 拖动左边缘：向左拉宽，向右缩窄（以右边缘为固定锚点）
            let newWidth = initialRect.right - moveEvent.clientX;
            const maxLeftWidth = Math.min(
              window.innerWidth - 80,
              Math.round(initialRect.right - 100)
            );
            newWidth = Math.min(maxLeftWidth, Math.max(minWidth, newWidth));
            const newLeft = initialRect.right - newWidth;

            root.style.left = `${newLeft}px`;
            root.style.width = `${newWidth}px`;
            root.style.right = "auto";
            localStorage.setItem("sidepeek_custom_width_v2", String(Math.round(newWidth)));
          } else {
            // 拖动右边缘：向右拉宽，向左缩窄（以左边缘为固定锚点）
            const leftEdge = root.getBoundingClientRect().left;
            const maxWidth = Math.max(minWidth, Math.round(window.innerWidth - leftEdge) - 12);

            let newWidth = moveEvent.clientX - leftEdge;
            newWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));

            root.style.width = `${newWidth}px`;
            localStorage.setItem("sidepeek_custom_width_v2", String(Math.round(newWidth)));
          }
        }

        function onMouseUp() {
          handle.classList.remove("dragging");
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);

          if (hasMoved) {
            // 彻底拦截本次拖拽释放时触发的 click 事件，防止被 handleTimelineClick 识别为“点击外部空白”而意外关闭抽屉
            const captureClick = (clickEvent) => {
              clickEvent.preventDefault();
              clickEvent.stopPropagation();
              clickEvent.stopImmediatePropagation();
              window.removeEventListener("click", captureClick, true);
            };
            window.addEventListener("click", captureClick, true);
            setTimeout(() => {
              window.removeEventListener("click", captureClick, true);
              state.isResizing = false;
            }, 120);
          } else {
            state.isResizing = false;
          }
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      handle.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetWidth();
      });
    }

    bindDrag(handleRight, false);
    bindDrag(handleLeft, true);
  }

  // ==========================================================================
  // Vertical Drag-to-Scroll Slider (上下拖拽快速滚动滑块)
  // ==========================================================================
  function initScrollSlider(root) {
    const body = root.querySelector(".sidepeek-body");
    const track = root.querySelector(".sidepeek-scroll-track");
    const thumb = root.querySelector(".sidepeek-scroll-thumb");
    const badge = root.querySelector(".sidepeek-scroll-badge");
    if (!body || !track || !thumb) return;
    body.addEventListener("scroll", rememberPhotoScroll);

    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;
    let scrollTimer = null;

    function updateSlider() {
      if (!state.open) return;
      const clientHeight = body.clientHeight;
      const scrollHeight = body.scrollHeight;
      const canScroll = scrollHeight > clientHeight + 4;

      if (!canScroll) {
        track.style.display = "none";
        root.classList.remove("sidepeek-has-scroll");
        return;
      }

      track.style.display = "flex";
      root.classList.add("sidepeek-has-scroll");
      const trackHeight = track.clientHeight;
      if (trackHeight <= 0) return;

      // 保持为小巧精致的胶囊按钮尺寸（固定 44px），绝不笨重拉长
      const thumbHeight = 44;
      thumb.style.height = `${thumbHeight}px`;

      const maxScrollTop = scrollHeight - clientHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      const scrollRatio = maxScrollTop > 0 ? (body.scrollTop / maxScrollTop) : 0;
      const thumbTop = Math.round(scrollRatio * maxThumbTop);

      thumb.style.transform = `translateY(${thumbTop}px)`;

      if (badge && isDragging) {
        const percent = Math.round(scrollRatio * 100);
        badge.textContent = `${percent}%`;
      }
    }

    body.addEventListener("scroll", () => {
      closeRepostMenu();
      closeMoreMenu();
      closeShareMenu();
      hideUserHoverCard();
      if (!isDragging) {
        updateSlider();
        thumb.classList.add("scrolling");
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          thumb.classList.remove("scrolling");
        }, 800);
      }
    }, { passive: true });

    thumb.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      isDragging = true;
      state.isResizing = true;
      startY = e.clientY;
      startScrollTop = body.scrollTop;

      thumb.classList.add("dragging");
      track.classList.add("active");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";

      updateSlider();

      function onMouseMove(moveEvent) {
        if (!isDragging) return;
        const deltaY = moveEvent.clientY - startY;
        const trackHeight = track.clientHeight;
        const thumbHeight = thumb.offsetHeight;
        const maxThumbTop = trackHeight - thumbHeight;
        const maxScrollTop = body.scrollHeight - body.clientHeight;

        if (maxThumbTop > 0 && maxScrollTop > 0) {
          const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
          body.scrollTop = Math.max(0, Math.min(maxScrollTop, startScrollTop + scrollDelta));
          const currentRatio = body.scrollTop / maxScrollTop;
          const currentThumbTop = Math.round(currentRatio * maxThumbTop);
          thumb.style.transform = `translateY(${currentThumbTop}px)`;
          if (badge) {
            badge.textContent = `${Math.round(currentRatio * 100)}%`;
          }
        }
      }

      function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        thumb.classList.remove("dragging");
        track.classList.remove("active");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);

        const captureClick = (clickEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          clickEvent.stopImmediatePropagation();
          window.removeEventListener("click", captureClick, true);
        };
        window.addEventListener("click", captureClick, true);
        setTimeout(() => {
          window.removeEventListener("click", captureClick, true);
          state.isResizing = false;
        }, 120);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    // 点击滚动条轨道直接跳转到目标区域
    track.addEventListener("click", (e) => {
      if (e.target === thumb || thumb.contains(e.target)) return;
      e.stopPropagation();
      const trackRect = track.getBoundingClientRect();
      const clickY = e.clientY - trackRect.top;
      const trackHeight = track.clientHeight;
      const thumbHeight = thumb.offsetHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      const maxScrollTop = body.scrollHeight - body.clientHeight;

      if (maxThumbTop > 0 && maxScrollTop > 0) {
        const targetThumbTop = Math.max(0, Math.min(maxThumbTop, clickY - thumbHeight / 2));
        const targetScrollTop = (targetThumbTop / maxThumbTop) * maxScrollTop;
        body.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      }
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        updateSlider();
        updateQuotePreviews(root);
      });
      ro.observe(body);
    }

    requestAnimationFrame(updateSlider);
    setTimeout(updateSlider, 80);
    setTimeout(updateSlider, 350);
  }

  window.addEventListener("resize", updateDrawerPosition);

  function getDrawerFooterHtml(userAvatar, replyPlaceholder) {
    return `
      <footer class="sidepeek-footer-composer">
        <!-- In-place Popovers -->
        <div class="sidepeek-popover sidepeek-emoji-popover" style="display: none;"></div>

        <div class="sidepeek-footer-inner">
          <div class="sidepeek-footer-avatar-wrap">
            ${userAvatar ? `<img src="${userAvatar}" class="sidepeek-footer-avatar" alt="" />` : `<div class="sidepeek-footer-avatar-default">${ICONS.user}</div>`}
          </div>
          <div class="sidepeek-footer-main">
            <div class="sidepeek-footer-reply-target" style="display:none;">
              <span class="sidepeek-reply-target-text"></span>
              <button type="button" class="sidepeek-cancel-reply-target" title="✕">✕</button>
            </div>
            <textarea class="sidepeek-footer-textarea" rows="1" placeholder="${replyPlaceholder}"></textarea>
            <div class="sidepeek-footer-preview-area"></div>
            <div class="sidepeek-footer-toolbar">
              <div class="sidepeek-footer-tools">
                <label class="sidepeek-tool-btn sidepeek-tool-media" title="${t("mediaToolTitle")}">
                  <input type="file" accept="image/jpeg,image/png,image/webp" class="sidepeek-media-file-input" multiple style="display:none;" />
                  ${ICONS.media}
                </label>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-gif" title="${t("gifToolTitle")}">${ICONS.gif}</button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-poll" title="${t("pollToolTitle")}">${ICONS.poll}</button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-emoji" title="${t("emojiToolTitle")}">
                  ${ICONS.emoji}
                </button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-schedule" title="${t("scheduleToolTitle")}">${ICONS.schedule}</button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-location" title="${t("locationToolTitle")}">${ICONS.location}</button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-disclosure" title="${t("disclosureToolTitle")}">
                  ${ICONS.disclosure}
                </button>
              </div>
              <div class="sidepeek-footer-actions">
                <div class="sidepeek-char-counter" title="${t("charCountTitle")}">
                  <svg class="sidepeek-char-ring" viewBox="0 0 24 24" width="20" height="20">
                    <circle class="sidepeek-char-ring-bg" cx="12" cy="12" r="9" />
                    <circle class="sidepeek-char-ring-progress" cx="12" cy="12" r="9" />
                  </svg>
                  <span class="sidepeek-char-warn-num"></span>
                </div>
                <div class="sidepeek-action-divider"></div>
                <button type="button" class="sidepeek-footer-submit-btn" disabled>${t("replyBtn")}</button>
              </div>
            </div>
          </div>
        </div>
      </footer>`;
  }

  // ==========================================================================
  // UI Rendering
  // ==========================================================================
  let replyObserver = null;

  function renderDrawer() {
    replyObserver?.disconnect();
    replyObserver = null;
    const root = ensureDrawerRoot();
    if (!state.open) {
      nativeLayers?.release();
      root.classList.remove("sidepeek-open");
      return;
    }

    updateDrawerPosition();
    root.classList.add("sidepeek-open");

    // Guard: ensure replyTarget belongs to current focal tweet or tree
    if (state.replyTarget) {
      const isTargetInCurrentTree = Boolean(state.tree && state.tree.byId && state.tree.byId.has(state.replyTarget.id));
      const isTargetFocal = state.replyTarget.id === state.focalTweetId;
      const savedTarget = getSavedReplyTarget(state.focalTweetId);
      if (state.tree && !isTargetInCurrentTree && !isTargetFocal && savedTarget?.id !== state.replyTarget.id) {
        state.replyTarget = null;
      }
    }

    const isDrillDown = state.activeView && typeof state.activeView === "object" && state.activeView.type === "drilldown";
    const drillDownParent = isDrillDown ? state.tree?.byId.get(state.activeView.parentId) : null;
    const userAvatar = getCurrentUserAvatar();
    const replyPlaceholder = state.replyTarget
      ? t("replyToUser", { handle: state.replyTarget.author.handle })
      : isDrillDown
        ? t("replyToUser", { handle: drillDownParent?.author?.handle || (getLocale() === "zh" ? "此人" : "user") })
        : t("replyToAuthor", { handle: state.focalModel?.author?.handle || (getLocale() === "zh" ? "楼主" : "author") });

    const isNativeMode = state.replyMode === "native";

    // 1. 记录重绘前的滚动高度，防止任何操作（展开/收起/加载等）跳回顶部
    const existingBody = root.querySelector(".sidepeek-body");
    const prevScrollTop = (existingBody && !state.resetScrollOnRender) ? existingBody.scrollTop : 0;
    if (state.resetScrollOnRender) {
      state.resetScrollOnRender = false;
    }

    if (!existingBody) {
      root.innerHTML = `
        <div class="sidepeek-resize-handle sidepeek-resize-handle-left" title="${getLocale() === "zh" ? "拖动左边缘调整宽度，双击恢复默认" : "Drag left edge to resize, double-click to reset"}">
          <div class="sidepeek-resize-grip"></div>
        </div>
        <div class="sidepeek-resize-handle sidepeek-resize-handle-right" title="${getLocale() === "zh" ? "拖动右边缘调整宽度，双击恢复默认" : "Drag right edge to resize, double-click to reset"}">
          <div class="sidepeek-resize-grip"></div>
        </div>
        <header class="sidepeek-header">
          <div class="sidepeek-title-wrap">
            <button type="button" class="sidepeek-back-btn" style="display:none;" aria-label="${t("backToAll")}">${ICONS.back}</button>
            <span class="sidepeek-title">SideX</span>
            <span class="sidepeek-count-badge"></span>
          </div>
          <div class="sidepeek-header-actions">
            <button type="button" class="sidepeek-icon-btn sidepeek-btn-reset-width" title="${t("resetWidth")}">${ICONS.resetWidth}</button>
            <a href="#" target="_blank" class="sidepeek-icon-btn sidepeek-btn-external" title="${t("openOnX")}" style="display:none;">${ICONS.external}</a>
            <button type="button" class="sidepeek-icon-btn sidepeek-btn-photo-collapse" style="display:none;" aria-label="${getLocale() === "zh" ? "收起评论，查看大图" : "Collapse comments to view the full image"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PHOTO_COLLAPSE_PATH}"></path></svg></button>
            <button type="button" class="sidepeek-icon-btn sidepeek-btn-close" aria-label="${t("closeSidebar")}">${ICONS.close}</button>
          </div>
        </header>
        <div class="sidepeek-body-wrap">
          <div class="sidepeek-body"></div>
          <div class="sidepeek-scroll-track" title="${getLocale() === "zh" ? "上下拖动快速浏览评论 · 点击轨道直接跳转" : "Drag up/down to scroll comments · Click track to jump"}">
            <div class="sidepeek-scroll-thumb">
              <div class="sidepeek-scroll-thumb-grip">
                <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                  <path d="M8 1.5L10.5 4H8.5V12H10.5L8 14.5L5.5 12H7.5V4H5.5Z"/>
                </svg>
              </div>
              <div class="sidepeek-scroll-badge">0%</div>
            </div>
          </div>
        </div>
        ${isNativeMode ? "" : getDrawerFooterHtml(userAvatar, replyPlaceholder)}
      `;

      initResizeHandle(root);
      initScrollSlider(root);
      if (!isNativeMode) {
        initFooterComposer(root, isDrillDown, drillDownParent);
      }

      root.querySelector(".sidepeek-btn-close")?.addEventListener("click", closeDrawer);
      root.querySelector(".sidepeek-btn-photo-collapse")?.addEventListener("click", () => findPhotoCollapseButton()?.click());
      root.querySelector(".sidepeek-back-btn")?.addEventListener("click", () => {
        state.activeView = "root";
        state.replyTarget = null;
        state.resetScrollOnRender = true;
        renderDrawer();
      });
    }

    // 动态同步 Header 与 Composer 状态
    const backBtn = root.querySelector(".sidepeek-back-btn");
    if (backBtn) backBtn.style.display = isDrillDown ? "inline-flex" : "none";

    const titleEl = root.querySelector(".sidepeek-title");
    if (titleEl) titleEl.textContent = isDrillDown ? t("threadBranch") : "SideX";

    const countBadge = root.querySelector(".sidepeek-count-badge");
    if (countBadge) {
      const model = isDrillDown ? drillDownParent : state.focalModel;
      const directCount = isDrillDown ? (state.tree?.childrenMap.get(drillDownParent.id)?.length || 0) : (state.tree?.rootReplies.length || 0);
      countBadge.textContent = `(${directCount}/${model?.reportedReplyCount ?? "—"})`;
      countBadge.title = getLocale() === "zh" ? "已加载的一级回复 / X 显示的回复数（可能包含不可见回复）" : "Loaded direct replies / Reply count reported by X (may include unavailable replies)";
    }

    const externalBtn = root.querySelector(".sidepeek-btn-external");
    if (externalBtn) {
      if (state.focalModel?.url) {
        externalBtn.href = state.focalModel.url;
        externalBtn.style.display = "inline-flex";
      } else {
        externalBtn.style.display = "none";
      }
    }

    // 动态同步回复栏模式（根据当前 state.replyMode 切换）
    syncPhotoHeader(root);
    const currentFooter = root.querySelector(".sidepeek-footer-composer");
    if (isNativeMode) {
      currentFooter?._sidepeekComposer?.dispose();
      currentFooter?.remove();
    } else if (!currentFooter) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = getDrawerFooterHtml(userAvatar, replyPlaceholder);
      const newFooter = tempDiv.firstElementChild;
      root.appendChild(newFooter);
      initFooterComposer(root, isDrillDown, drillDownParent);
    }

    const replyTargetBox = root.querySelector(".sidepeek-footer-reply-target");
    const replyTargetText = root.querySelector(".sidepeek-reply-target-text");
    const textarea = root.querySelector(".sidepeek-footer-textarea");
    if (replyTargetBox && replyTargetText) {
      if (state.replyTarget) {
        replyTargetBox.style.display = "flex";
        replyTargetText.textContent = `${t("replyToTag")} @${state.replyTarget.author.handle}`;
      } else {
        replyTargetBox.style.display = "none";
        replyTargetText.textContent = "";
      }
    }
    if (textarea) {
      textarea.placeholder = replyPlaceholder;
    }
    root.querySelector(".sidepeek-footer-composer")?._sidepeekComposer?.syncTarget();

    const body = root.querySelector(".sidepeek-body");

    if (state.loading) {
      body.innerHTML = `
        <div class="sidepeek-loading-box">
          <div class="sidepeek-spinner"></div>
          <span>${t("loadingReplies")}</span>
        </div>`;
      return;
    }

    if (state.error) {
      body.innerHTML = `
        <div class="sidepeek-empty-box">
          <span>${state.error}</span>
          <button type="button" class="sidepeek-btn-submit sidepeek-retry-btn">${t("retryBtn")}</button>
        </div>`;
      body.querySelector(".sidepeek-retry-btn")?.addEventListener("click", () => fetchThread(state.focalTweetId));
      return;
    }

    body.innerHTML = "";

    if (isDrillDown && drillDownParent) {
      // Render the parent comment first
      const parentNode = renderCommentNode(drillDownParent, true);
      body.appendChild(parentNode);

      // Render children (深度优先收集所有后代回复)
      const children = state.tree?.getSubtree ? state.tree.getSubtree(drillDownParent.id) : (state.tree?.childrenMap.get(drillDownParent.id) || []);
      const totalReplies = drillDownParent.counts?.replies || 0;
      const isSubLoading = state.loadingThreadIds.has(drillDownParent.id);

      if (children.length === 0 && totalReplies > 0 && !state.loadedThreadIds.has(drillDownParent.id)) {
        if (!isSubLoading) {
          fetchSubReplies(drillDownParent.id);
        }
        const loader = document.createElement("div");
        loader.className = "sidepeek-thread-loader-row";
        loader.style.padding = "24px 16px";
        loader.innerHTML = `
          <div class="sidepeek-mini-spinner"></div>
          <span style="font-size: 13px; color: var(--sp-muted); margin-left: 8px;">${t("loadingReplies")}</span>
        `;
        body.appendChild(loader);
      } else if (children.length === 0 && !hasFoldedReplies(drillDownParent.id)) {
        const empty = document.createElement("div");
        empty.className = "sidepeek-empty-box";
        empty.textContent = t("noMoreReplies");
        body.appendChild(empty);
      } else {
        for (let i = 0; i < children.length; i++) {
          const hasNext = i < children.length - 1;
          appendSectionLabel(body, children[i]);
          body.appendChild(renderCommentNode(children[i], hasNext, true));
        }
      }
      appendReplyPagination(body, drillDownParent.id);
    } else {
      // Root view: 默认就地展示或折叠展开二级回复
      if (dockedPhotoPanel && state.focalModel) {
        const focalNode = renderCommentNode(state.focalModel, false);
        focalNode.classList.add("sidepeek-photo-focal");
        body.appendChild(focalNode);
      }
      const roots = state.tree?.rootReplies || [];
      if (roots.length === 0) {
        const empty = document.createElement("div");
        empty.className = "sidepeek-empty-box";
        empty.textContent = t("emptyReplies");
        body.appendChild(empty);
      }

      const authorChain = authorThreadIds();
      const INLINE_LIMIT = state.subReplyLimit || 1; // 默认展示 1 条二级回复，可在插件设置中自定义

      for (const rootReply of roots) {
        appendSectionLabel(body, rootReply);
        const children = state.tree?.getSubtree ? state.tree.getSubtree(rootReply.id) : (state.tree?.childrenMap.get(rootReply.id) || []);
        const childrenCount = children.length;
        const totalRepliesCount = rootReply.counts?.replies || 0;
        const hasReplies = childrenCount > 0 || totalRepliesCount > 0;

        if (!hasReplies) {
          body.appendChild(renderCommentNode(rootReply, false));
        } else {
          const threadGroup = document.createElement("div");
          threadGroup.className = "sidepeek-thread-group";

          const isExpanded = state.expandedThreadIds.has(rootReply.id);
          const isLoading = state.loadingThreadIds.has(rootReply.id);

          // 父评论带有向下连接子评论的 Thread Line
          threadGroup.appendChild(renderCommentNode(rootReply, true));

          if (isExpanded) {
            // 已展开：显示所有已加载的子回复
            for (let i = 0; i < childrenCount; i++) {
              const child = children[i];
              const hasNext = (i < childrenCount - 1) || isLoading;
              appendSectionLabel(threadGroup, child);
              threadGroup.appendChild(renderCommentNode(child, hasNext, true));
            }

            if (isLoading) {
              const loaderEl = document.createElement("div");
              loaderEl.className = "sidepeek-thread-loader-row";
              loaderEl.innerHTML = `
                <div class="sidepeek-thread-line-col"><div class="sidepeek-thread-line"></div></div>
                <div class="sidepeek-thread-loader-content">
                  <span class="sidepeek-mini-spinner"></span>
                  <span>${t("loadingReplies")}</span>
                </div>
              `;
              threadGroup.appendChild(loaderEl);
            } else if (childrenCount === 0 && !hasFoldedReplies(rootReply.id)) {
              const emptyTip = document.createElement("div");
              emptyTip.className = "sidepeek-thread-loader-row";
              emptyTip.innerHTML = `
                <div class="sidepeek-thread-line-col"></div>
                <div class="sidepeek-thread-empty-tip">${t("noMoreReplies")}</div>
              `;
              threadGroup.appendChild(emptyTip);
            }

            appendReplyPagination(threadGroup, rootReply.id);
            appendUnfetchedReplies(threadGroup, rootReply);

            // 收起按钮
            const collapseRow = document.createElement("div");
            collapseRow.className = "sidepeek-expand-btn-row";
            collapseRow.innerHTML = `
              <div class="sidepeek-thread-line-col"></div>
              <button type="button" class="sidepeek-collapse-btn">
                <span>▲ ${t("collapseReplies")}</span>
              </button>
            `;
            collapseRow.querySelector(".sidepeek-collapse-btn")?.addEventListener("click", () => {
              state.anchorCommentId = rootReply.id;
              state.expandedThreadIds.delete(rootReply.id);
              renderDrawer();
            });
            threadGroup.appendChild(collapseRow);
          } else {
            // Author continuations are visible independently of the preview
            // budget for other branches. Count only actually hidden models.
            const preview = new Set(children.filter(child => !authorChain.has(child.id)).slice(0, INLINE_LIMIT).map(child => child.id));
            const shown = children.filter(child => authorChain.has(child.id) || preview.has(child.id));
            for (let i = 0; i < shown.length; i++) {
              appendSectionLabel(threadGroup, shown[i]);
              threadGroup.appendChild(renderCommentNode(shown[i], i < shown.length - 1, true));
            }
            const hiddenCount = childrenCount - shown.length;
            if (hiddenCount > 0) {
              const row = document.createElement("div");
              row.className = "sidepeek-expand-btn-row";
              const button = document.createElement("button");
              button.type = "button";
              button.className = "sidepeek-expand-btn";
              button.textContent = t("showMoreReplies", { count: hiddenCount });
              button.addEventListener("click", () => {
                state.anchorCommentId = rootReply.id;
                state.expandedThreadIds.add(rootReply.id);
                renderDrawer();
              });
              row.appendChild(button);
              threadGroup.appendChild(row);
            } else {
              appendReplyPagination(threadGroup, rootReply.id);
              appendUnfetchedReplies(threadGroup, rootReply);
            }
          }

          body.appendChild(threadGroup);
        }
      }
      appendReplyPagination(body, state.focalTweetId);
    }

    updateQuotePreviews(root);

    // 恢复滚动条位置，彻底解决“点击展开回复后页面跳回顶部”的问题
    body.scrollTop = prevScrollTop;

    // 若收起后父评论跑到了视口上方，平滑将其拉回视口顶部，避免视口掉入空白
    if (state.anchorCommentId) {
      const anchorCommentId = state.anchorCommentId;
      state.anchorCommentId = null;
      const targetItem = body.querySelector(`.sidepeek-comment-item[data-id="${anchorCommentId}"]`);
      if (targetItem) {
        const bodyRect = body.getBoundingClientRect();
        const itemRect = targetItem.getBoundingClientRect();
        const itemTopInBody = itemRect.top - bodyRect.top;
        if (itemTopInBody < 0) {
          body.scrollTop += itemTopInBody;
        }
      }
    }

    body.dispatchEvent(new Event("scroll"));
    nativeLayers?.sync(root);
  }

  function renderVerifiedBadge(author) {
    if (!author?.verified) return "";
    let color = "#1d9bf0";
    let label = "已认证账号";
    const vType = String(author.verifiedType || "").toLowerCase();
    if (vType === "business" || vType === "gold") {
      color = "#e1ab00";
      label = "认证机构";
    } else if (vType === "government" || vType === "gray") {
      color = "#829aab";
      label = "政府或官方机构";
    }
    return `<span class="sidepeek-verified-badge" title="${label}" style="color: ${color};"><svg viewBox="0 0 22 22" aria-label="${label}" role="img"><g><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.887-1.687-.47-.45-1.054-.755-1.687-.887-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.887-.45.47-.755 1.054-.886 1.687-.13.633-.084 1.29.139 1.897-.585.274-1.082.705-1.435 1.246-.354.54-.551 1.17-.57 1.816.019.646.216 1.276.57 1.817.353.54.85 0.972 1.435 1.245-.223.608-.27 1.265-.14 1.898.131.633.436 1.217.886 1.686.47.45 1.055.756 1.69.887.636.13 1.295.084 1.903-.139.272.585.704 1.084 1.244 1.439.54.354 1.167.551 1.813.568.647-.017 1.274-.214 1.814-.569s.971-.854 1.245-1.44c.604.224 1.26.271 1.893.14.633-.13 1.217-.436 1.687-.887.45-.47.756-1.053.887-1.686.13-.633.083-1.29-.14-1.898.586-.273 1.084-.705 1.438-1.246.354-.54.551-1.17.57-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.136 2.136 5.445-5.445 1.302 1.302-6.747 6.737z" fill="currentColor"></path></g></svg></span>`;
  }

  function formatCommentText(model) {
    if (!model?.text) return "";
    let text = model.text;
    if (!text) return "";

    const tokens = [];
    const tokenPrefix = `__SP_LINK_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_`;

    function createToken(html) {
      const id = `${tokenPrefix}${tokens.length}__`;
      tokens.push({ id, html });
      return id;
    }

    // 1. 优先替换已知 entity URLs（如 t.co 短链 -> 真实目标链接及友好展示域名）
    const entityUrls = model.entities?.urls || [];
    for (const u of entityUrls) {
      if (!u?.url) continue;
      const targetUrl = u.expandedUrl || u.url;
      const display = u.displayUrl || u.expandedUrl || u.url;
      if (!/^https?:\/\//i.test(targetUrl)) continue;

      const safeHref = escapeHtml(targetUrl);
      const safeTitle = escapeHtml(targetUrl);
      const safeDisplay = escapeHtml(display);
      const linkHtml = `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="sidepeek-text-link" title="${safeTitle}">${safeDisplay}</a>`;

      if (text.includes(u.url)) {
        text = text.split(u.url).join(createToken(linkHtml));
      }
    }

    // 2. 匹配并转换文本中其他未被 entities 捕获的原生 URL (http:// 或 https://)
    const URL_REGEX = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:?!(){}\[\]]/gi;
    text = text.replace(URL_REGEX, (rawUrl) => {
      if (rawUrl.startsWith(tokenPrefix)) return rawUrl;
      const safeUrl = escapeHtml(rawUrl);
      const linkHtml = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="sidepeek-text-link" title="${safeUrl}">${safeUrl}</a>`;
      return createToken(linkHtml);
    });

    // 3. 匹配并转换 @用户 提及
    const MENTION_REGEX = /(^|[^\w@])@([A-Za-z0-9_]{1,30})\b/g;
    text = text.replace(MENTION_REGEX, (match, prefix, handle) => {
      const safeHandle = escapeHtml(handle);
      const linkHtml = `<a href="https://x.com/${safeHandle}" target="_blank" rel="noopener noreferrer" class="sidepeek-text-link sidepeek-text-mention">@${safeHandle}</a>`;
      return `${prefix}${createToken(linkHtml)}`;
    });

    // 4. 匹配并转换 #话题 标签（支持中文等各类 Unicode 字符）
    const HASHTAG_REGEX = /(^|[^\w#])#([A-Za-z0-9_\u0080-\uffff]+)/g;
    text = text.replace(HASHTAG_REGEX, (match, prefix, tag) => {
      const safeTag = escapeHtml(tag);
      const encodedTag = encodeURIComponent(tag);
      const linkHtml = `<a href="https://x.com/hashtag/${encodedTag}" target="_blank" rel="noopener noreferrer" class="sidepeek-text-link sidepeek-text-hashtag">#${safeTag}</a>`;
      return `${prefix}${createToken(linkHtml)}`;
    });

    // 5. 匹配并转换 $股票/代币 标识
    const CASHTAG_REGEX = /(^|[^\w$])\$([A-Za-z]{1,6})\b/g;
    text = text.replace(CASHTAG_REGEX, (match, prefix, symbol) => {
      const safeSymbol = escapeHtml(symbol);
      const linkHtml = `<a href="https://x.com/search?q=%24${safeSymbol}" target="_blank" rel="noopener noreferrer" class="sidepeek-text-link sidepeek-text-cashtag">$${safeSymbol}</a>`;
      return `${prefix}${createToken(linkHtml)}`;
    });

    // 6. 对普通文本进行 HTML 转义，彻底防范 XSS
    let escaped = escapeHtml(text);

    // 7. 还原安全的链接 HTML
    for (const { id, html } of tokens) {
      escaped = escaped.split(id).join(html);
    }

    return escaped;
  }

  function updateQuotePreviews(root) {
    for (const card of root.querySelectorAll('.sidepeek-quote-card')) {
      const text = card.querySelector('.sidepeek-quote-text');
      const button = card.querySelector('.sidepeek-quote-toggle');
      if (!text || !button) continue;
      const expanded = expandedQuotes.has(card.dataset.id);
      text.classList.toggle('sidepeek-quote-text-expanded', expanded);
      button.textContent = t(expanded ? 'collapseQuote' : 'expandQuote');
      button.setAttribute('aria-expanded', String(expanded));
      button.hidden = !expanded && text.scrollHeight <= text.clientHeight + 1;
    }
  }

  function renderQuoteCard(quote, ownerId) {
    if (!quote || !quote.id) return "";
    const quoteAuthorName = escapeHtml(quote.author?.name || quote.author?.handle || "");
    const quoteAuthorHandle = escapeHtml(quote.author?.handle || "");
    const quoteTime = formatTime(quote.createdAt);
    const quoteFullTime = formatFullDateTime(quote.createdAt);
    const quoteUrl = quote.url || (quoteAuthorHandle ? `https://x.com/${quoteAuthorHandle}/status/${quote.id}` : "");

    const avatarHtml = quoteAuthorHandle
      ? `<a class="sidepeek-quote-avatar-link" href="https://x.com/${quoteAuthorHandle}" target="_blank"><img class="sidepeek-quote-avatar" src="${quote.author?.avatar || ""}" alt="" /></a>`
      : `<span class="sidepeek-quote-avatar-link"><img class="sidepeek-quote-avatar" src="${quote.author?.avatar || ""}" alt="" /></span>`;

    const nameHtml = quoteAuthorHandle
      ? `<a class="sidepeek-quote-name" href="https://x.com/${quoteAuthorHandle}" target="_blank">${quoteAuthorName}</a>`
      : `<span class="sidepeek-quote-name">${quoteAuthorName}</span>`;

    const timeHtml = quoteUrl
      ? `<a class="sidepeek-quote-time" href="${quoteUrl}" target="_blank" title="${quoteFullTime}">${quoteTime}</a>`
      : `<span class="sidepeek-quote-time" title="${quoteFullTime}">${quoteTime}</span>`;

    return `
      <div class="sidepeek-quote-card" data-id="${quote.id}" data-url="${escapeHtml(quoteUrl)}">
        <div class="sidepeek-quote-header" translate="no">
          ${avatarHtml}
          ${nameHtml}
          ${renderVerifiedBadge(quote.author)}
          <span class="sidepeek-quote-handle">@${quoteAuthorHandle}</span>
          <span class="sidepeek-dot">·</span>
          ${timeHtml}
        </div>
        ${quote.text ? `<div class="sidepeek-quote-body"><div class="sidepeek-quote-text" id="sidepeek-quote-text-${escapeHtml(ownerId)}-${escapeHtml(quote.id)}">${formatCommentText(quote)}</div><button type="button" class="sidepeek-quote-toggle" aria-expanded="false" aria-controls="sidepeek-quote-text-${escapeHtml(ownerId)}-${escapeHtml(quote.id)}" hidden>${t("expandQuote")}</button></div>` : ""}
        ${renderMediaBox(quote.media)}
      </div>
    `;
  }

  function renderLinkCard(card) {
    if (!card || !card.url) return "";
    const domain = card.domain || "";
    const title = escapeHtml(card.title || "");
    const desc = escapeHtml(card.description || "");
    const image = card.image ? escapeHtml(card.image) : "";
    const url = escapeHtml(card.url);

    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="sidepeek-link-card">
        ${image ? `<div class="sidepeek-link-card-img-wrap"><img class="sidepeek-link-card-img" src="${image}" loading="lazy" alt="" /></div>` : ""}
        <div class="sidepeek-link-card-info">
          ${domain ? `<div class="sidepeek-link-card-domain">${escapeHtml(domain)}</div>` : ""}
          ${title ? `<div class="sidepeek-link-card-title">${title}</div>` : ""}
          ${desc ? `<div class="sidepeek-link-card-desc">${desc}</div>` : ""}
        </div>
      </a>
    `;
  }

  function shouldShowTranslate(model) {
    if (state.translationProvider === "external") return false;
    if (!model || !model.text) return false;
    const clean = model.text.trim();
    if (!clean) return false;

    // Strip URLs, @mentions, #hashtags, and punctuation/whitespace/digits/emojis
    const stripped = clean
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/@[A-Za-z0-9_]+/g, "")
      .replace(/#\S+/g, "")
      .replace(/[\d\s\p{P}\p{S}]/gu, "");

    // If text without noise is too short (e.g. pure emojis, symbols, numbers), don't show translate
    if (stripped.length < 2) return false;

    const currentLang = getLocale(); // "zh" or "en"
    const tweetLang = String(model.lang || "").toLowerCase();
    if (tweetLang && tweetLang !== "und" && tweetLang !== "zxx") {
      return tweetLang.split("-")[0] !== currentLang;
    }

    if (currentLang === "zh") {
      // If Twitter detected it as Chinese
      if (tweetLang.startsWith("zh")) return false;

      // If text contains predominantly Chinese characters (>= 30% CJK)
      const cjkChars = (stripped.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (cjkChars > 0 && cjkChars / stripped.length >= 0.3) {
        return false;
      }
    } else if (currentLang === "en") {
      // If Twitter detected it as English
      if (tweetLang === "en") return false;

      // Latin letters alone cannot distinguish English from French, Spanish, etc.
    }

    if (tweetLang && tweetLang === currentLang) return false;

    return true;
  }

  function requestGoogleTranslation(text, destLang) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("GOOGLE_TRANSLATION_TIMEOUT")), 35000);
      try {
        chrome.runtime.sendMessage({ type: "TRANSLATE_TEXT", text, destLang }, response => {
          clearTimeout(timer);
          const error = chrome.runtime.lastError;
          if (error || !response?.ok) reject(new Error(response?.error || error?.message || "GOOGLE_TRANSLATION_FAILED"));
          else resolve(response.payload);
        });
      } catch (error) { clearTimeout(timer); reject(error); }
    });
  }

  function bindTranslation(item, model) {
    const button = item.querySelector(".sidepeek-translate-btn");
    const box = item.querySelector(".sidepeek-translation-box");
    if (!button || !box) return;
    const provider = state.translationProvider;
    const destLang = getLocale();
    const text = model.text || "";
    const key = JSON.stringify([model.id, text, destLang, provider]);
    let entry = translations.get(key);
    if (!entry) {
      entry = { result: null, showing: false, pending: null, error: "" };
      translations.set(key, entry);
      if (translations.size > 500) translations.delete(translations.keys().next().value);
    }
    const update = () => {
      button.disabled = Boolean(entry.pending);
      button.textContent = entry.pending ? t("translating") : entry.error ? t("translationRetry") : entry.showing ? t("hideTranslation") : t("translateAction");
      box.style.display = entry.showing || entry.error ? "block" : "none";
      if (entry.result) {
        box.innerHTML = `<div class="sidepeek-translation-header">${escapeHtml(t("translatedBy", {
          provider: entry.result.provider, lang: entry.result.sourceLanguage || model.lang || t("originalLanguage")
        }))}</div><div class="sidepeek-translation-text" lang="${escapeHtml(destLang)}">${escapeHtml(entry.result.translation)}</div>`;
      } else if (entry.error) {
        box.textContent = (provider === "x" ? t("translationHelp") : t("translateFailed")) + ` (${entry.error})`;
      } else box.textContent = "";
    };
    // A rerender during an in-flight request subscribes to the same result.
    if (entry.pending) entry.pending.then(update);
    button.addEventListener("click", async event => {
      event.stopPropagation();
      if (entry.pending) return;
      if (entry.result) { entry.showing = !entry.showing; update(); return; }
      entry.error = "";
      entry.pending = (async () => {
        try {
          const result = provider === "google"
            ? await requestGoogleTranslation(text, destLang)
            : await requestPage("TRANSLATE_TWEET", { tweetId: model.id, destLang }, 28000);
          if (!result?.translation) throw new Error("TRANSLATION_EMPTY");
          entry.result = result;
          entry.showing = true;
        } catch (error) {
          entry.error = error.message || "TRANSLATION_FAILED";
        } finally { entry.pending = null; }
      })();
      update();
      await entry.pending;
      update();
    });
    update();
  }

  function syncCommentTextExpansion(item, model) {
    const text = item.querySelector(".sidepeek-text");
    if (!text) return;
    const clamp = !state.autoExpandReplyText && !expandedTexts.has(model.id) &&
      Boolean(model.text && (model.text.length > 280 || (model.text.match(/\n/g) || []).length > 4));
    text.classList.toggle("sidepeek-text-clamp", clamp);
    let button = item.querySelector(".sidepeek-show-more-btn");
    if (!clamp) { button?.remove(); return; }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "sidepeek-show-more-btn";
      text.after(button);
    }
    button.textContent = t("showMorePost");
    button.onclick = event => {
      event.stopPropagation();
      expandedTexts.add(model.id);
      if (expandedTexts.size > 500) expandedTexts.delete(expandedTexts.values().next().value);
      syncCommentTextExpansion(item, model);
    };
  }

  // Only real parent links back to the focal author qualify. A reply by that
  // author to somebody else's comment is not a continuation of their thread.
  function authorThreadIds() {
    const ids = new Set();
    const focal = state.focalModel;
    if (!focal || !state.tree) return ids;
    const sameAuthor = model => {
      const a = focal.author, b = model?.author;
      if (a?.id && b?.id) return a.id === b.id;
      return Boolean(a?.handle && b?.handle && a.handle.toLowerCase() === b.handle.toLowerCase());
    };
    for (const model of state.tree.byId.values()) {
      const path = new Set();
      let current = model;
      while (current && current.id !== focal.id && !path.has(current.id) && sameAuthor(current)) {
        path.add(current.id);
        current = current.inReplyToId === focal.id ? focal : state.tree.byId.get(current.inReplyToId);
      }
      if (current?.id === focal.id) for (const id of path) ids.add(id);
    }
    return ids;
  }

  function appendUnfetchedReplies(container, model) {
    if (state.threadPages.has(model.id) || state.loadedThreadIds.has(model.id)) return;
    const direct = (state.tree?.childrenMap.get(model.id) || []).filter(child => child.inReplyToId === model.id).length;
    if ((model.counts?.replies || 0) <= direct) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidepeek-expand-btn sidepeek-fetch-replies-btn";
    button.textContent = t("loadMoreThreadReplies");
    button.disabled = state.loadingThreadIds.has(model.id);
    button.addEventListener("click", () => fetchSubReplies(model.id, false, true));
    container.appendChild(button);
  }

  function renderCommentNode(model, hasThreadLine = false, isChild = false) {
    const signature = JSON.stringify([getLocale(), state.translationProvider, model.text, model.entities, model.lang,
      model.inReplyToHandle, model.createdAt, model.url, model.author, model.media, model.quote, model.card]);
    const cached = commentNodes.get(model.id);
    if (cached && cached.signature === signature) {
      Object.assign(cached.model, model);
      cached.element.classList.toggle("sidepeek-child-comment", isChild);
      const line = cached.element.querySelector(".sidepeek-avatar-col > .sidepeek-thread-line");
      if (hasThreadLine && !line) {
        const newLine = document.createElement("div");
        newLine.className = "sidepeek-thread-line";
        cached.element.querySelector(".sidepeek-avatar-col").appendChild(newLine);
      } else if (!hasThreadLine) line?.remove();
      updateActionButtons(cached.model, cached.element);
      syncCommentTextExpansion(cached.element, cached.model);
      return cached.element;
    }
    const item = document.createElement("article");
    item.className = `sidepeek-comment-item${isChild ? " sidepeek-child-comment" : ""}`;
    item.dataset.id = model.id;

    const authorName = escapeHtml(model.author.name);
    const authorHandle = escapeHtml(model.author.handle);
    const avatarHtml = model.author.handle
      ? `<a class="sidepeek-avatar-link" href="https://x.com/${authorHandle}" target="_blank" title="${authorName} (@${authorHandle})"><img class="sidepeek-avatar" src="${model.author.avatar}" alt="${authorName}" /></a>`
      : `<img class="sidepeek-avatar" src="${model.author.avatar}" alt="${authorName}" />`;

    const nameHtml = model.author.handle
      ? `<a class="sidepeek-name" href="https://x.com/${authorHandle}" target="_blank">${authorName}</a>`
      : `<span class="sidepeek-name">${authorName}</span>`;

    const isOP = Boolean(
      state.focalModel?.author?.handle &&
      model.author?.handle &&
      state.focalModel.author.handle.toLowerCase() === model.author.handle.toLowerCase()
    );
    const opBadgeHtml = isOP ? `<span class="sidepeek-author-badge" title="${t("opBadgeTitle")}">${t("opBadge")}</span>` : "";

    const fullDateTime = formatFullDateTime(model.createdAt);
    const timeHtml = model.url
      ? `<a class="sidepeek-time" href="${model.url}" target="_blank" title="${fullDateTime}">${formatTime(model.createdAt)}</a>`
      : `<span class="sidepeek-time" title="${fullDateTime}">${formatTime(model.createdAt)}</span>`;

    const replyToHtml = model.inReplyToHandle
      ? `<div class="sidepeek-reply-to-tag">${t("replyToTag")} <a href="https://x.com/${escapeHtml(model.inReplyToHandle)}" target="_blank">@${escapeHtml(model.inReplyToHandle)}</a></div>`
      : "";

    const isLongText = !state.autoExpandReplyText && !expandedTexts.has(model.id) && Boolean(model.text && (model.text.length > 280 || (model.text.match(/\n/g) || []).length > 4));
    const textHtml = model.text
      ? `<div class="sidepeek-text ${isLongText ? "sidepeek-text-clamp" : ""}">${formatCommentText(model)}</div>${isLongText ? `<button type="button" class="sidepeek-show-more-btn">${t("showMorePost")}</button>` : ""}`
      : "";

    const canTranslate = shouldShowTranslate(model);
    const translateHtml = canTranslate
      ? `<button type="button" class="sidepeek-translate-btn">${t("translateAction")}</button><div class="sidepeek-translation-box" style="display: none;"></div>`
      : "";

    const quoteHtml = model.quote ? renderQuoteCard(model.quote, model.id) : "";
    const cardHtml = !model.quote && model.card ? renderLinkCard(model.card) : "";

    item.innerHTML = `
      <div class="sidepeek-avatar-col">
        ${avatarHtml}
        ${hasThreadLine ? '<div class="sidepeek-thread-line"></div>' : ""}
      </div>
      <div class="sidepeek-content-col">
        <div class="sidepeek-author-row" translate="no">
          ${nameHtml}
          ${renderVerifiedBadge(model.author)}
          ${opBadgeHtml}
          <a class="sidepeek-handle" href="https://x.com/${authorHandle}" target="_blank">@${authorHandle}</a>
          <span class="sidepeek-dot">·</span>
          ${timeHtml}
          <div class="sidepeek-more-col">
            <button type="button" class="sidepeek-act-more" title="${t("moreActionsTitle")}">
              ${ICONS.more}
            </button>
          </div>
        </div>
        ${replyToHtml}
        ${textHtml}
        ${translateHtml}
        ${renderMediaBox(model.media)}
        ${quoteHtml}
        ${cardHtml}
        <div class="sidepeek-action-bar">
          <button type="button" class="sidepeek-action-btn sidepeek-act-reply" title="${t("replyAction")}">
            <span class="sidepeek-action-btn-surface">${ICONS.reply} <span>${formatCount(model.counts.replies)}</span></span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-repost ${model.flags.reposted ? "active" : ""}" title="${t("repostAction")}">
            <span class="sidepeek-action-btn-surface">${ICONS.repost} <span>${formatCount(model.counts.reposts)}</span></span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-like ${model.flags.liked ? "active" : ""}" title="${t("likeAction")}">
            <span class="sidepeek-action-btn-surface">${model.flags.liked ? ICONS.likeSolid : ICONS.like} <span>${formatCount(model.counts.likes)}</span></span>
          </button>
          <a class="sidepeek-action-btn sidepeek-act-views" href="${escapeHtml(model.url)}/analytics" target="_blank" title="${t("viewsAction")}">
            <span class="sidepeek-action-btn-surface">${ICONS.views} <span>${formatCount(model.counts.views)}</span></span>
          </a>
          <button type="button" class="sidepeek-action-btn sidepeek-act-bookmark ${model.flags.bookmarked ? "active" : ""}" title="${t("bookmarkAction")}">
            <span class="sidepeek-action-btn-surface">${model.flags.bookmarked ? ICONS.bookmarkSolid : ICONS.bookmark}</span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-share" title="${t("shareAction")}">
            <span class="sidepeek-action-btn-surface">${ICONS.share}</span>
          </button>
        </div>
      </div>
    `;

    // Drilldown click
    item.querySelector(".sidepeek-drilldown-trigger")?.addEventListener("click", () => {
      state.activeView = { type: "drilldown", parentId: model.id };
      state.replyTarget = null;
      renderDrawer();
    });

    // Action handlers
    const actReply = item.querySelector(".sidepeek-act-reply");
    const actRepost = item.querySelector(".sidepeek-act-repost");
    const actLike = item.querySelector(".sidepeek-act-like");
    const actBookmark = item.querySelector(".sidepeek-act-bookmark");
    const actShare = item.querySelector(".sidepeek-act-share");
    const actMore = item.querySelector(".sidepeek-act-more");

    actReply?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.replyMode === "native") {
        const draft = composerDrafts.get(`${state.focalTweetId}:${model.id}`);
        openNativeReplyDialog(model.id, draft?.text || "", draft?.media.map(item => item.file).filter(Boolean) || []);
      } else {
        setReplyTarget(model);
      }
    });
    actRepost?.addEventListener("click", (e) => {
      e.stopPropagation();
      openRepostMenu(model, actRepost);
    });
    actLike?.addEventListener("click", () => handleToggleAction(model, "like", actLike));
    actBookmark?.addEventListener("click", () => handleToggleAction(model, "bookmark", actBookmark));
    actShare?.addEventListener("click", (e) => {
      e.stopPropagation();
      openShareMenu(model, actShare);
    });
    actMore?.addEventListener("click", (e) => {
      e.stopPropagation();
      openMoreMenu(model, actMore);
    });

    syncCommentTextExpansion(item, model);

    bindTranslation(item, model);

    // Quote card click & author hover
    const quoteCard = item.querySelector(".sidepeek-quote-card");
    if (quoteCard) {
      quoteCard.querySelector('.sidepeek-quote-toggle')?.addEventListener('click', event => {
        event.stopPropagation();
        const id = quoteCard.dataset.id;
        if (expandedQuotes.has(id)) expandedQuotes.delete(id);
        else expandedQuotes.add(id);
        if (expandedQuotes.size > 500) expandedQuotes.delete(expandedQuotes.values().next().value);
        updateQuotePreviews(drawerRoot);
      });
      quoteCard.addEventListener("click", (e) => {
        if (e.target.closest("a") || e.target.closest("button") || e.target.closest("video") || e.target.closest(".sidepeek-zoomable-img")) return;
        e.stopPropagation();
        const quoteUrl = quoteCard.dataset.url;
        if (quoteUrl) window.open(quoteUrl, "_blank");
      });
      if (model.quote?.author) {
        const qAvatar = quoteCard.querySelector(".sidepeek-quote-avatar-link");
        const qName = quoteCard.querySelector(".sidepeek-quote-name");
        if (qAvatar) attachUserHoverEvents(qAvatar, model.quote.author);
        if (qName) attachUserHoverEvents(qName, model.quote.author);
      }
    }

    // GIF video toggle play/pause
    item.querySelectorAll(".sidepeek-gif-video").forEach((vid) => {
      vid.addEventListener("click", (e) => {
        e.stopPropagation();
        if (vid.paused) vid.play();
        else vid.pause();
      });
    });

    // Avatar & Author Hover Card listeners
    const avatarLink = item.querySelector(".sidepeek-avatar-link") || item.querySelector(".sidepeek-avatar");
    const nameEl = item.querySelector(".sidepeek-name");
    if (avatarLink) attachUserHoverEvents(avatarLink, model.author);
    if (nameEl) attachUserHoverEvents(nameEl, model.author);
    attachUserHoverEvents(item.querySelector(".sidepeek-handle"), model.author);

    // Image zoom / lightbox click
    item.querySelectorAll(".sidepeek-zoomable-img").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(img.dataset.full || img.src);
      });
    });

    item.querySelector(".sidepeek-text")?.setAttribute("lang", model.lang || "und");
    item.querySelector(".sidepeek-text")?.setAttribute("data-testid", "tweetText");
    commentNodes.set(model.id, { element: item, model, signature });
    updateActionButtons(model, item);
    const nativeArticle = findDetailFocalArticle(model.id);
    if (nativeArticle) watchNativeActions(model, nativeArticle);
    return item;
  }

  function renderMediaBox(mediaList) {
    if (!mediaList || mediaList.length === 0) return "";
    const photos = mediaList.filter((m) => m.type === "photo");
    if (photos.length > 0) {
      const count = Math.min(photos.length, 4);
      let itemsHtml = "";
      for (let i = 0; i < count; i++) {
        const p = photos[i];
        const highRes = p.url ? `${p.url.split("?")[0]}?name=large` : p.url;
        itemsHtml += `
          <div class="sidepeek-media-item">
            <img class="sidepeek-zoomable-img" src="${p.url}" data-full="${highRes}" loading="lazy" alt="" />
          </div>`;
      }
      return `<div class="sidepeek-media-grid grid-${count}">${itemsHtml}</div>`;
    }

    const gif = mediaList.find((m) => m.type === "animated_gif");
    if (gif) {
      return `
        <div class="sidepeek-gif-media-box">
          <video class="sidepeek-gif-video" src="${gif.videoUrl}" autoplay loop muted playsinline preload="auto"></video>
          <span class="sidepeek-gif-badge">GIF</span>
        </div>`;
    }

    const video = mediaList.find((m) => m.type === "video");
    if (video) {
      return `<div class="sidepeek-media-box"><video src="${video.videoUrl}" controls playsinline preload="metadata"></video></div>`;
    }
    return "";
  }

  function openLightbox(imgSrc) {
    let lightbox = document.getElementById("sidepeek-lightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "sidepeek-lightbox";
      lightbox.innerHTML = `
        <div class="sidepeek-lightbox-backdrop"></div>
        <div class="sidepeek-lightbox-content">
          <img class="sidepeek-lightbox-img" src="" alt="" />
          <button type="button" class="sidepeek-lightbox-close" title="关闭">✕</button>
        </div>
      `;
      document.body.appendChild(lightbox);
      lightbox.querySelector(".sidepeek-lightbox-backdrop")?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeLightbox();
      });
      lightbox.querySelector(".sidepeek-lightbox-close")?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeLightbox();
      });
      lightbox.querySelector(".sidepeek-lightbox-img")?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
    }
    const imgEl = lightbox.querySelector(".sidepeek-lightbox-img");
    if (imgEl) imgEl.src = imgSrc;
    lightbox.classList.add("active");
  }

  function closeLightbox() {
    document.getElementById("sidepeek-lightbox")?.classList.remove("active");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ==========================================================================
  // Native Reply Dialog Launcher
  // ==========================================================================
  let nativeReplyOpening = false;
  function nativeReplyEditors() {
    return [...document.querySelectorAll('#layers [role="dialog"] [data-testid="tweetTextarea_0"]')]
      .filter(editor => !editor.closest('[role="dialog"]')?.querySelector('[data-testid="swipe-to-dismiss"]'));
  }
  async function openNativeReplyDialog(tweetId, draftText = "", files = [], { tool = null } = {}) {
    const targetId = tweetId || state.focalTweetId;
    if (!targetId || nativeReplyOpening) return false;
    if (nativeReplyEditors().length) {
      showToast(t("nativeDraftAlreadyOpen"));
      return false;
    }
    const replyBtn = findDetailFocalArticle(targetId)?.querySelector('[data-testid="reply"]');
    const focalId = state.focalTweetId;
    nativeReplyOpening = true;
    const existingEditors = new Set(nativeReplyEditors());
    try {
      let finish;
      const ready = new Promise(resolve => {
        const find = () => nativeReplyEditors()
          .find(editor => !existingEditors.has(editor));
        const observer = new MutationObserver(() => { const editor = find(); if (editor) finish(editor); });
        const timer = setTimeout(() => finish(null), 4500);
        finish = editor => { clearTimeout(timer); observer.disconnect(); resolve(editor); };
        observer.observe(document.body, { childList: true, subtree: true });
      });
      let opened = false;
      try { opened = Boolean((await requestPage("OPEN_NATIVE_REPLY", { tweetId: targetId, quickTool: Boolean(tool) }, 2000))?.opened); } catch {}
      // Tool flows need a tracked router entry for Escape. Do not
      // fall back to an untracked composer that would reveal an extra editor.
      if (!opened && tool) { finish(null); showToast(t("nativeReplyNotReady")); return false; }
      if (!opened && replyBtn) replyBtn.click();
      if (!opened && !replyBtn) {
        finish(null);
        if (files.length || tool) { showToast(t("nativeReplyNotReady")); return false; }
        const link = document.createElement("a");
        link.href = `https://x.com/intent/tweet?in_reply_to=${targetId}&text=${encodeURIComponent(draftText)}`;
        link.target = "_self";
        link.dataset.sidexNativeReplyLink = "true";
        document.body.appendChild(link); link.click(); link.remove();
        return true;
      }
      const immediate = nativeReplyEditors().find(editor => !existingEditors.has(editor));
      if (immediate) finish(immediate);
      const editor = await ready;
      if (!editor) { showToast(t("nativeReplyNotReady")); return false; }
      const dialog = editor.closest('[role="dialog"]');
      if (draftText) {
        if (editor.textContent.trim()) { showToast(t("nativeDraftAlreadyOpen")); return false; }
        editor.focus();
        const inserted = document.execCommand?.("insertText", false, draftText);
        if (!inserted && editor.textContent !== draftText) { showToast(t("nativeDraftKept")); return false; }
      }
      if (files.length) {
        const input = dialog.querySelector('input[type="file"]');
        if (!input || typeof DataTransfer !== "function") { showToast(t("nativeMediaKeepDraft")); return false; }
        const transfer = new DataTransfer();
        files.forEach(file => transfer.items.add(file));
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      state.nativeReplyTransfer = { focalId, targetId, draft: composerDrafts.get(`${focalId}:${targetId}`), text: draftText };
      nativeLayers?.sync(document.getElementById(ROOT_ID));
      if (tool) {
        const button = dialog.querySelector(`[data-testid="${tool}"]`);
        if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") button.click();
        else showToast(getLocale() === "zh" ? "X 当前回复框未开放这个工具，草稿已保留" : "X does not offer this tool for the current reply. Your draft is retained.");
      }
      showToast(t("nativeReplyOpenedToast"));
      return true;
    } catch (error) {
      showToast(error.message || t("nativeDraftKept"));
      return false;
    } finally { nativeReplyOpening = false; }
  }

  // ==========================================================================
  // Bottom Reply Target Management
  // ==========================================================================
  function setReplyTarget(model) {
    if (!model) return;
    if (document.querySelector('#layers [role="dialog"] [data-testid="tweetTextarea_0"]')) {
      showToast(t("nativeDraftAlreadyOpen"));
      return;
    }
    state.replyTarget = model;
    document.querySelector(".sidepeek-footer-composer")?._sidepeekComposer?.syncTarget();
    const footer = document.querySelector(".sidepeek-footer-composer");
    if (!footer) return;
    const targetBox = footer.querySelector(".sidepeek-footer-reply-target");
    const targetText = footer.querySelector(".sidepeek-reply-target-text");
    const textarea = footer.querySelector(".sidepeek-footer-textarea");
    if (targetBox && targetText && textarea) {
      targetText.textContent = `${t("replyToTag")} @${model.author.handle}`;
      targetBox.style.display = "flex";
      textarea.placeholder = t("replyToUser", { handle: model.author.handle });
      textarea.focus();
      textarea.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function preserveReplyText() {
    document.querySelector(".sidepeek-footer-composer")?._sidepeekComposer?.saveTextOnly();
    if (!state.open) return;
    const target = state.replyTarget ||
      (state.activeView?.type === "drilldown" ? state.tree?.byId.get(state.activeView.parentId) : null);
    if (target) replyDraftTargets.set(state.focalTweetId, target);
    else replyDraftTargets.delete(state.focalTweetId);
  }

  function getSavedReplyTarget(focalId) {
    const target = replyDraftTargets.get(focalId);
    const draft = target && composerDrafts.get(`${focalId}:${target.id}`);
    return draft?.text || draft?.sending ? target : null;
  }

  function initFooterComposer(root, isDrillDown, drillDownParent) {
    const footer = root.querySelector(".sidepeek-footer-composer");
    if (!footer) return;

    const replyTargetBox = footer.querySelector(".sidepeek-footer-reply-target");
    const replyTargetText = footer.querySelector(".sidepeek-reply-target-text");
    const cancelTargetBtn = footer.querySelector(".sidepeek-cancel-reply-target");

    cancelTargetBtn?.addEventListener("click", () => {
      state.replyTarget = null;
      if (replyTargetBox) replyTargetBox.style.display = "none";
      if (textarea) {
        textarea.placeholder = isDrillDown
          ? t("replyToUser", { handle: drillDownParent?.author?.handle || (getLocale() === "zh" ? "此人" : "user") })
          : t("replyToAuthor", { handle: state.focalModel?.author?.handle || (getLocale() === "zh" ? "楼主" : "author") });
        footer._sidepeekComposer?.syncTarget();
        textarea.focus();
      }
    });

    const textarea = footer.querySelector(".sidepeek-footer-textarea");
    const previewArea = footer.querySelector(".sidepeek-footer-preview-area");
    const submitBtn = footer.querySelector(".sidepeek-footer-submit-btn");
    const fileInput = footer.querySelector(".sidepeek-media-file-input");

    // Toolbar buttons
    const btnMedia = footer.querySelector(".sidepeek-tool-media");
    const btnEmoji = footer.querySelector(".sidepeek-tool-emoji");

    // Popover containers
    const emojiPopover = footer.querySelector(".sidepeek-emoji-popover");

    // Progress ring elements
    const charCounter = footer.querySelector(".sidepeek-char-counter");
    const ringProgress = footer.querySelector(".sidepeek-char-ring-progress");
    const charWarnNum = footer.querySelector(".sidepeek-char-warn-num");

    const MAX_MEDIA = 4;
    let active = true;
    const getTargetId = () => state.replyTarget?.id ||
      (state.activeView?.type === "drilldown" ? state.activeView.parentId : state.focalTweetId);
    const getDraftKey = () => `${state.focalTweetId}:${getTargetId()}`;
    function getDraft(key) {
      if (!composerDrafts.has(key)) composerDrafts.set(key, { text: "", media: [], sending: false });
      return composerDrafts.get(key);
    }
    let draftKey = getDraftKey();
    let draft = getDraft(draftKey);
    textarea.value = draft.text;

    // Use the official text parser for URLs, Unicode weights and emoji groups.
    const calculateTweetLength = Core.tweetLength;

    // Update character progress ring and submit button state
    function updateComposerState() {
      if (!textarea || !ringProgress || !submitBtn) return;
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + "px";

      const text = textarea.value;
      draft.text = text;
      textarea.disabled = draft.sending;
      fileInput.disabled = draft.sending;
      const len = calculateTweetLength(text);
      const circumference = 2 * Math.PI * 9; // ~56.5487
      const standardMax = 280;
      const absoluteMax = 25000;

      const hasMedia = draft.media.length > 0;
      const isMediaUploading = draft.media.some((m) => m.isUploading);
      const hasContent = text.trim().length > 0 || hasMedia;

      if (len === 0) {
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = `${circumference}`;
        ringProgress.style.stroke = "var(--sp-accent)";
        if (charWarnNum) {
          charWarnNum.textContent = "";
          charWarnNum.className = "sidepeek-char-warn-num";
        }
        if (charCounter) charCounter.style.opacity = hasMedia ? "0.8" : "0.4";
      } else if (len <= standardMax) {
        if (charCounter) charCounter.style.opacity = "1";
        const progress = Math.min(1, len / standardMax);
        const offset = circumference * (1 - progress);
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = `${offset}`;

        if (len < 260) {
          ringProgress.style.stroke = "var(--sp-accent)";
          if (charWarnNum) {
            charWarnNum.textContent = "";
            charWarnNum.className = "sidepeek-char-warn-num";
          }
        } else {
          ringProgress.style.stroke = "#ffd400";
          if (charWarnNum) {
            charWarnNum.textContent = String(standardMax - len);
            charWarnNum.className = "sidepeek-char-warn-num warn-amber";
          }
        }
      } else if (len <= absoluteMax) {
        // 会员长文模式 (X Premium Note Tweet: 281 ~ 25,000 字)
        if (charCounter) charCounter.style.opacity = "1";
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = "0";
        ringProgress.style.stroke = "var(--sp-accent)";
        if (charWarnNum) {
          const isZh = getLocale() === "zh";
          charWarnNum.textContent = `${len} ${isZh ? "(需会员)" : "(Premium)"}`;
          charWarnNum.className = "sidepeek-char-warn-num warn-note";
          charWarnNum.title = isZh
            ? "长文模式（需 X Premium 会员权限，非会员上限 280 字）"
            : "Long post mode (requires X Premium, max 280 chars for non-subscribers)";
        }
      } else {
        // 超出绝对上限 (> 25,000 字)
        if (charCounter) charCounter.style.opacity = "1";
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = "0";
        ringProgress.style.stroke = "#f4212e";
        if (charWarnNum) {
          charWarnNum.textContent = String(absoluteMax - len);
          charWarnNum.className = "sidepeek-char-warn-num warn-red";
        }
      }

      const isOverLimit = len > absoluteMax;
      submitBtn.disabled = draft.sending || !hasContent || isOverLimit || isMediaUploading;
      if (draft.sending) {
        submitBtn.textContent = t("sending");
      } else if (isMediaUploading) {
        submitBtn.textContent = t("uploading");
      } else {
        submitBtn.textContent = t("replyBtn");
      }
    }

    textarea?.addEventListener("input", updateComposerState);

    // Popover toggle management
    function closeAllPopovers() {
      [emojiPopover].forEach((p) => {
        if (p) p.style.display = "none";
      });
      [btnEmoji].forEach((btn) => {
        btn?.classList.remove("active");
      });
    }

    function togglePopover(popover, triggerBtn) {
      if (!popover) return;
      const isVisible = popover.style.display !== "none";
      closeAllPopovers();
      if (!isVisible) {
        popover.style.display = "block";
        triggerBtn?.classList.add("active");
      }
    }

    // Close popovers on click outside
    const outsideClickListener = (e) => {
      if (!footer.contains(e.target)) {
        closeAllPopovers();
      }
    };
    document.addEventListener("click", outsideClickListener);

    // Keydown listener for Escape
    footer.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && emojiPopover?.style.display !== "none") {
        e.stopPropagation();
        closeAllPopovers();
      }
    });

    // =========================================================================
    // 1. Emoji Popover
    // =========================================================================
    if (emojiPopover) {
      let activeCategory = 0;
      function renderEmojiPopover() {
        const catKeys = ["frequent", "gestures", "reactions"];
        emojiPopover.innerHTML = `
          <div class="sidepeek-popover-header">
            <div class="sidepeek-popover-tabs">
              ${EMOJI_CATEGORIES.map((cat, idx) => `
                <button type="button" class="sidepeek-popover-tab ${idx === activeCategory ? "active" : ""}" data-idx="${idx}">${t("emojiCats." + catKeys[idx]) || cat.name}</button>
              `).join("")}
            </div>
            <button type="button" class="sidepeek-popover-close" title="✕">✕</button>
          </div>
          <div class="sidepeek-emoji-grid">
            ${EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => `
              <button type="button" class="sidepeek-emoji-item" data-emoji="${emoji}">${emoji}</button>
            `).join("")}
          </div>
        `;

        emojiPopover.querySelectorAll(".sidepeek-popover-tab").forEach((tab) => {
          tab.addEventListener("click", (e) => {
            e.stopPropagation();
            activeCategory = Number(tab.dataset.idx);
            renderEmojiPopover();
          });
        });

        emojiPopover.querySelector(".sidepeek-popover-close")?.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAllPopovers();
        });

        emojiPopover.querySelectorAll(".sidepeek-emoji-item").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const emoji = btn.dataset.emoji;
            const start = textarea.selectionStart || 0;
            const end = textarea.selectionEnd || 0;
            const text = textarea.value;
            textarea.value = text.slice(0, start) + emoji + text.slice(end);
            textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
            textarea.focus();
            updateComposerState();
          });
        });
      }
      renderEmojiPopover();

      btnEmoji?.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePopover(emojiPopover, btnEmoji);
      });
    }

    // =========================================================================
    // 6. Media Upload & Paste Image
    // =========================================================================
    // =========================================================================
    // 6. Media Upload & Attachments (Up to 4)
    // =========================================================================
    function renderMediaPreviews() {
      previewArea.querySelectorAll(".sidepeek-pasted-preview").forEach((el) => el.remove());
      for (const item of draft.media) {
        const previewEl = document.createElement("div");
        previewEl.className = "sidepeek-pasted-preview";
        previewEl.dataset.id = item.id;
        previewEl.innerHTML = `
          <img src="${item.dataUrl || ""}" alt="" />
          ${item.isUploading ? '<div class="sidepeek-preview-loading"><span class="sidepeek-mini-spinner"></span></div>' : ""}
          <button type="button" class="sidepeek-remove-img-btn" title="✕">✕</button>
        `;
        previewEl.querySelector(".sidepeek-remove-img-btn")?.addEventListener("click", (e) => {
          e.stopPropagation();
          draft.media = draft.media.filter((m) => m.id !== item.id);
          renderMediaPreviews();
          updateComposerState();
        });
        previewArea.appendChild(previewEl);
      }
    }

    async function uploadMediaItem(item, mimeType, size, ownerDraft = draft) {
      try {
        const base64 = item.dataUrl.split(",")[1];
        const res = await requestPage("UPLOAD_MEDIA", {
          base64,
          mimeType: mimeType || "image/png",
          size: size || item.file?.size || 0
        });
        if (!res?.mediaId) throw new Error(t("uploadFailed"));
        item.mediaId = res.mediaId;
        item.isUploading = false;
      } catch (err) {
        if (ownerDraft.media.includes(item)) {
          showToast((err.message || t("uploadFailed")) + (item.file?.name ? ` (${item.file.name})` : ""));
        }
        ownerDraft.media = ownerDraft.media.filter((m) => m.id !== item.id);
      } finally {
        if (active) { renderMediaPreviews(); updateComposerState(); }
        else document.querySelector(".sidepeek-footer-composer")?._sidepeekComposer?.refresh();
      }
    }

    function handleImageFiles(fileList) {
      if (draft.sending) return;
      const ownerDraft = draft;
      const files = Array.from(fileList || []).filter((f) => f && /^image\/(?:jpeg|png|webp)$/.test(f.type || ""));
      if (files.length !== Array.from(fileList || []).length) showToast(t("quickMediaFormats"));
      if (!files.length) return;

      const remaining = MAX_MEDIA - draft.media.length;
      if (remaining <= 0) {
        showToast(t("maxMediaReached"));
        return;
      }

      if (files.length > remaining) {
        showToast(t("maxMediaReached"));
      }

      const filesToProcess = files.slice(0, remaining);
      for (const file of filesToProcess) {
        const item = {
          id: "media_" + Math.random().toString(36).slice(2, 9),
          mediaId: null,
          dataUrl: "",
          file,
          isUploading: true
        };
        draft.media.push(item);
        const reader = new FileReader();
        reader.onload = () => {
          if (!ownerDraft.media.includes(item)) return;
          item.dataUrl = reader.result;
          if (active) { renderMediaPreviews(); updateComposerState(); }
          uploadMediaItem(item, file.type, file.size, ownerDraft);
        };
        reader.onerror = () => {
          if (!ownerDraft.media.includes(item)) return;
          ownerDraft.media = ownerDraft.media.filter(media => media.id !== item.id);
          showToast(t("uploadFailed"));
          if (active) { renderMediaPreviews(); updateComposerState(); }
          else document.querySelector(".sidepeek-footer-composer")?._sidepeekComposer?.refresh();
        };
        reader.readAsDataURL(file);
      }
      renderMediaPreviews();
      updateComposerState();
    }

    fileInput?.addEventListener("change", (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleImageFiles(files);
      }
      fileInput.value = "";
    });

    textarea?.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleImageFiles(files);
      }
    });

    for (const [name, tool] of Object.entries({ gif: "gifSearchButton", poll: "createPollButton", schedule: "scheduleOption", location: "geoButton", disclosure: "contentDisclosureButton" })) {
      footer.querySelector(`.sidepeek-tool-${name}`)?.addEventListener("click", e => {
        e.stopPropagation();
        if (draft.sending || draft.media.some(item => item.isUploading)) return;
        openNativeReplyDialog(getTargetId(), textarea?.value || "", draft.media.map(item => item.file).filter(Boolean), { tool });
      });
    }

    // =========================================================================
    // Submit once, retain the draft on failure, and render the confirmed ID.
    // =========================================================================
    async function doSubmit() {
      if (draft.sending) return;
      const ownerDraft = draft;
      const text = textarea.value.trim();
      if (Core.tweetLength(text) > 25000) { showToast(t("overCharLimitNote")); return; }
      if (!text && !ownerDraft.media.length) return;
      if (ownerDraft.media.some(item => item.isUploading || !item.mediaId)) {
        showToast(t("mediaStillUploading")); return;
      }
      const targetId = getTargetId();
      const focalId = state.focalTweetId;
      const generation = state.threadGeneration;
      ownerDraft.sending = true;
      ownerDraft.text = textarea.value;
      updateComposerState();
      try {
        const response = await requestPage("CREATE_REPLY", {
          tweetId: targetId, text, mediaIds: ownerDraft.media.map(item => item.mediaId)
        });
        const created = Core.collectTweetModels(response).find(model => model.inReplyToId === targetId);
        if (!created) throw new Error(t("replyStatusUnknown"));
        ownerDraft.text = "";
        ownerDraft.media = [];
        if (active && draft === ownerDraft) {
          textarea.value = "";
          renderMediaPreviews();
          closeAllPopovers();
        }
        if (state.open && state.focalTweetId === focalId && state.threadGeneration === generation) {
          acceptCreatedReply(created);
        }
        showToast(t("replySent"));
      } catch (err) {
        showToast(err.message || t("replyFailed"));
      } finally {
        ownerDraft.sending = false;
        if (active) updateComposerState();
        else document.querySelector(".sidepeek-footer-composer")?._sidepeekComposer?.refresh(ownerDraft);
      }
    }

    submitBtn?.addEventListener("click", doSubmit);
    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doSubmit();
      }
    });

    footer._sidepeekComposer = {
      syncTarget() {
        const nextKey = getDraftKey();
        if (draftKey === nextKey) return;
        draft.text = textarea.value;
        draft.media = [];
        draftKey = nextKey;
        draft = getDraft(nextKey);
        textarea.value = draft.text;
        closeAllPopovers();
        renderMediaPreviews();
        updateComposerState();
      },
      refresh(changedDraft) {
        if (draft === changedDraft) textarea.value = draft.text;
        renderMediaPreviews(); updateComposerState();
      },
      saveTextOnly() {
        draft.text = textarea.value;
        draft.media = [];
        closeAllPopovers();
        renderMediaPreviews(); updateComposerState();
      },
      dispose() {
        draft.text = textarea.value;
        draft.media = [];
        active = false;
        document.removeEventListener("click", outsideClickListener);
      }
    };
    renderMediaPreviews();
    updateComposerState();
  }

  // ==========================================================================
  // Action Handlers (Like, Repost, Bookmark, Share, More)
  // ==========================================================================
  function updateActionButtons(model, item) {
    for (const [action, flag, count] of [["like", "liked", "likes"], ["repost", "reposted", "reposts"], ["bookmark", "bookmarked", "bookmarks"]]) {
      const button = item.querySelector(`.sidepeek-act-${action}`);
      if (!button) continue;
      button.classList.toggle("active", Boolean(model.flags[flag]));
      button.setAttribute("aria-pressed", String(Boolean(model.flags[flag])));
      button.disabled = pendingActions.has(`${model.id}:${action}`);
      const icon = action === "like" ? (model.flags.liked ? ICONS.likeSolid : ICONS.like)
        : action === "bookmark" ? (model.flags.bookmarked ? ICONS.bookmarkSolid : ICONS.bookmark) : ICONS.repost;
      button.querySelector(".sidepeek-action-btn-surface").innerHTML = icon + (action === "bookmark" ? "" : ` <span>${formatCount(model.counts[count])}</span>`);
    }
  }

  async function handleToggleAction(model, action, btnElement) {
    const key = `${model.id}:${action}`;
    if (pendingActions.has(key)) return;
    const nativeArticle = findDetailFocalArticle(model.id);
    const nativeSelector = action === "like" ? '[data-testid="like"], [data-testid="unlike"]'
      : action === "bookmark" ? '[data-testid="bookmark"], [data-testid="removeBookmark"]' : null;
    const nativeButton = nativeSelector && nativeArticle?.querySelector(nativeSelector);
    if (nativeButton) {
      watchNativeActions(model, nativeArticle);
      if (!nativeButton.disabled) nativeButton.click();
      return;
    }
    const flag = action === "like" ? "liked" : action === "repost" ? "reposted" : "bookmarked";
    const countProp = action === "like" ? "likes" : action === "repost" ? "reposts" : "bookmarks";
    const wasActive = Boolean(model.flags[flag]);
    const oldCount = model.counts[countProp];
    const refresh = () => {
      const item = commentNodes.get(model.id)?.element || btnElement.closest(".sidepeek-comment-item");
      if (item) updateActionButtons(model, item);
    };
    pendingActions.add(key);
    model.flags[flag] = !wasActive;
    model.counts[countProp] = Math.max(0, oldCount + (wasActive ? -1 : 1));
    refresh();
    try {
      await requestPage("TOGGLE_ACTION", { tweetId: model.id, action, active: !wasActive });
    } catch (error) {
      model.flags[flag] = wasActive;
      model.counts[countProp] = oldCount;
      showToast(`${t("actionFailed")} (${error.message})`);
    } finally {
      pendingActions.delete(key);
      refresh();
    }
  }

  function watchNativeActions(model, article) {
    nativeActionObservers.get(model.id)?.disconnect();
    const sync = () => {
      const current = commentNodes.get(model.id)?.model || model;
      for (const [flag, count, off, on] of [
        ["liked", "likes", "like", "unlike"], ["bookmarked", "bookmarks", "bookmark", "removeBookmark"],
        ["reposted", "reposts", "retweet", "unretweet"]
      ]) {
        const button = article.querySelector(`[data-testid="${off}"], [data-testid="${on}"]`);
        if (!button) continue;
        const active = button.dataset.testid === on;
        const aria = (button.getAttribute("aria-label") || "").replace(/[,\s]/g, "");
        const ariaCount = aria.match(/^(\d+)(?![\d.KM万千亿])/i)?.[1];
        const label = ariaCount || button.textContent.replace(/[,\s]/g, "");
        if (/^\d+$/.test(label)) current.counts[count] = Number(label);
        else if (current.flags[flag] !== active) current.counts[count] = Math.max(0, current.counts[count] + (active ? 1 : -1));
        current.flags[flag] = active;
      }
      const node = commentNodes.get(model.id)?.element;
      if (node) updateActionButtons(current, node);
    };
    const observer = new MutationObserver(sync);
    observer.observe(article, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-testid"], characterData: true });
    nativeActionObservers.set(model.id, observer);
    nativeActionArticles.set(model.id, article);
    sync();
  }

  function clearCommentNodes() {
    for (const observer of nativeActionObservers.values()) observer.disconnect();
    nativeActionObservers.clear();
    nativeActionArticles.clear();
    commentNodes.clear();
  }

  function openNativeMenu(model, selector) {
    const article = findDetailFocalArticle(model.id);
    const button = article?.querySelector(selector);
    if (!button || button.disabled) return false;
    closeMoreMenu(); closeShareMenu(); closeRepostMenu();
    watchNativeActions(model, article);
    button.click();
    return true;
  }

  // ==========================================================================
  // More Actions Menu (··· 更多操作菜单)
  // ==========================================================================
  let activeMoreMenu = null;
  let activeMoreBtn = null;

  function closeMoreMenu() {
    if (activeMoreMenu) {
      activeMoreMenu.remove();
      activeMoreMenu = null;
      activeMoreBtn = null;
    }
  }

  function openMoreMenu(model, actMore) {
    if (openNativeMenu(model, '[data-testid="caret"]')) return;
    if (activeMoreBtn === actMore) {
      closeMoreMenu();
      return;
    }
    closeMoreMenu();
    closeShareMenu();
    closeRepostMenu();

    const menu = document.createElement("div");
    menu.className = `sidepeek-more-menu ${currentThemeClass()}`;

    const handle = model.author?.handle || "";

    menu.innerHTML = `
      <button type="button" class="sidepeek-menu-item sidepeek-menu-copy-link">
        <span class="sidepeek-menu-item-icon">${ICONS.copy}</span>
        <span>${t("copyLink")}</span>
      </button>
      <button type="button" class="sidepeek-menu-item sidepeek-menu-copy-text">
        <span class="sidepeek-menu-item-icon">${ICONS.copy}</span>
        <span>${t("copyText")}</span>
      </button>
      <button type="button" class="sidepeek-menu-item sidepeek-menu-open-x">
        <span class="sidepeek-menu-item-icon">${ICONS.external}</span>
        <span>${t("openOnXDirect")}</span>
      </button>
      ${handle ? `
      <button type="button" class="sidepeek-menu-item sidepeek-menu-mute">
        <span class="sidepeek-menu-item-icon">${ICONS.mute}</span>
        <span>${t("muteUser", { handle })}</span>
      </button>
      <button type="button" class="sidepeek-menu-item danger sidepeek-menu-block">
        <span class="sidepeek-menu-item-icon">${ICONS.block}</span>
        <span>${t("blockUser", { handle })}</span>
      </button>
      ` : ""}
    `;

    // Position menu near button
    const rect = actMore.getBoundingClientRect();
    const menuWidth = 190;
    const menuHeight = handle ? 210 : 130;

    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - 4;
    }
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }

    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;

    menu.querySelector(".sidepeek-menu-copy-link")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMoreMenu();
      if (model.url) {
        navigator.clipboard?.writeText(model.url).then(() => {
          showToast(t("linkCopied"));
        });
      }
    });

    menu.querySelector(".sidepeek-menu-copy-text")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMoreMenu();
      const rawText = model.text || "";
      if (rawText) {
        navigator.clipboard?.writeText(rawText).then(() => {
          showToast(t("textCopied"));
        });
      }
    });

    menu.querySelector(".sidepeek-menu-open-x")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMoreMenu();
      if (model.url) window.open(model.url, "_blank");
    });

    menu.querySelector(".sidepeek-menu-mute")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeMoreMenu();
      try {
        await requestPage("TOGGLE_MUTE", { screenName: handle, active: false });
        showToast(t("userMuted", { handle }));
      } catch (err) {
        showToast(err.message || "Failed");
      }
    });

    menu.querySelector(".sidepeek-menu-block")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeMoreMenu();
      try {
        await requestPage("TOGGLE_BLOCK", { screenName: handle, active: false });
        showToast(t("userBlocked", { handle }));
      } catch (err) {
        showToast(err.message || "Failed");
      }
    });

    document.body.appendChild(menu);
    activeMoreMenu = menu;
    activeMoreBtn = actMore;
  }

  // ==========================================================================
  // Share Menu (分享菜单)
  // ==========================================================================
  let activeShareMenu = null;
  let activeShareBtn = null;

  function closeShareMenu() {
    if (activeShareMenu) {
      activeShareMenu.remove();
      activeShareMenu = null;
      activeShareBtn = null;
    }
  }

  function openShareMenu(model, actShare) {
    if (openNativeMenu(model, 'button[aria-label="Share post"], button[aria-label="分享帖子"], button[aria-label="分享推文"]')) return;
    if (activeShareBtn === actShare) {
      closeShareMenu();
      return;
    }
    closeShareMenu();
    closeMoreMenu();
    closeRepostMenu();

    const menu = document.createElement("div");
    menu.className = `sidepeek-share-menu ${currentThemeClass()}`;

    const hasNavShare = Boolean(navigator.share);

    menu.innerHTML = `
      <button type="button" class="sidepeek-menu-item sidepeek-menu-copy-link">
        <span class="sidepeek-menu-item-icon">${ICONS.copy}</span>
        <span>${t("copyLink")}</span>
      </button>
      <button type="button" class="sidepeek-menu-item sidepeek-menu-copy-text">
        <span class="sidepeek-menu-item-icon">${ICONS.copy}</span>
        <span>${t("copyText")}</span>
      </button>
      <button type="button" class="sidepeek-menu-item sidepeek-menu-open-x">
        <span class="sidepeek-menu-item-icon">${ICONS.external}</span>
        <span>${t("openOnXDirect")}</span>
      </button>
      ${hasNavShare ? `
      <button type="button" class="sidepeek-menu-item sidepeek-menu-nav-share">
        <span class="sidepeek-menu-item-icon">${ICONS.webShare}</span>
        <span>${t("shareVia")}</span>
      </button>
      ` : ""}
    `;

    // Position menu near button
    const rect = actShare.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = hasNavShare ? 175 : 130;

    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - 6;
    }
    let left = rect.left - 20;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;

    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;

    menu.querySelector(".sidepeek-menu-copy-link")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeShareMenu();
      if (model.url) {
        navigator.clipboard?.writeText(model.url).then(() => {
          showToast(t("linkCopied"));
        });
      }
    });

    menu.querySelector(".sidepeek-menu-copy-text")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeShareMenu();
      const rawText = model.text || "";
      if (rawText) {
        navigator.clipboard?.writeText(rawText).then(() => {
          showToast(t("textCopied"));
        });
      }
    });

    menu.querySelector(".sidepeek-menu-open-x")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeShareMenu();
      if (model.url) window.open(model.url, "_blank");
    });

    menu.querySelector(".sidepeek-menu-nav-share")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeShareMenu();
      if (navigator.share) {
        navigator.share({
          title: model.author?.name ? `${model.author.name} on X` : "X",
          text: model.text || "",
          url: model.url
        }).catch(() => {});
      }
    });

    document.body.appendChild(menu);
    activeShareMenu = menu;
    activeShareBtn = actShare;
  }

  // ==========================================================================
  // Repost & Quote Popover Menu
  // ==========================================================================
  let activeRepostMenu = null;
  let activeRepostBtn = null;

  function closeRepostMenu() {
    if (activeRepostMenu) {
      activeRepostMenu.remove();
      activeRepostMenu = null;
      activeRepostBtn = null;
    }
  }

  function openRepostMenu(model, actRepost) {
    if (openNativeMenu(model, '[data-testid="retweet"], [data-testid="unretweet"]')) return;
    if (activeRepostBtn === actRepost) {
      closeRepostMenu();
      return;
    }
    closeRepostMenu();
    closeMoreMenu();
    closeShareMenu();

    const menu = document.createElement("div");
    menu.className = `sidepeek-repost-menu ${currentThemeClass()}`;

    const isReposted = Boolean(model.flags.reposted);

    menu.innerHTML = `
      <button type="button" class="sidepeek-repost-menu-item sidepeek-menu-act-repost ${isReposted ? "active" : ""}">
        <span class="sidepeek-menu-item-icon">${ICONS.repost}</span>
        <span class="sidepeek-menu-item-text">${isReposted ? t("undoRepostAction") : t("repostAction")}</span>
      </button>
      <button type="button" class="sidepeek-repost-menu-item sidepeek-menu-act-quote">
        <span class="sidepeek-menu-item-icon">${ICONS.quote}</span>
        <span class="sidepeek-menu-item-text">${t("quoteAction")}</span>
      </button>
    `;

    // Position menu near button
    const rect = actRepost.getBoundingClientRect();
    const menuWidth = 150;
    const menuHeight = 90;

    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - 6;
    }
    let left = rect.left - 16;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;

    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;

    // Click handlers
    const repostItem = menu.querySelector(".sidepeek-menu-act-repost");
    const quoteItem = menu.querySelector(".sidepeek-menu-act-quote");

    repostItem?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeRepostMenu();
      handleToggleAction(model, "repost", actRepost);
    });

    quoteItem?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeRepostMenu();
      handleQuoteAction(model);
    });

    document.body.appendChild(menu);
    activeRepostMenu = menu;
    activeRepostBtn = actRepost;
  }

  function handleQuoteAction(model) {
    const targetId = model.id;
    const handle = model.author?.handle || "i";
    const tweetUrl = model.url || `https://x.com/${handle}/status/${targetId}`;

    // 1. Try finding native tweet article on timeline
    let article = findDetailFocalArticle(targetId);
    if (!article && state.focalTweetId === targetId) {
      article = findDetailFocalArticle(targetId);
    }

    if (article) {
      const nativeRepostBtn = article.querySelector('[data-testid="retweet"]') || article.querySelector('[data-testid="unretweet"]');
      if (nativeRepostBtn) {
        nativeRepostBtn.click();
        setTimeout(() => {
          const menuItems = document.querySelectorAll('[role="menu"] [role="menuitem"], [data-testid="Dropdown"] [role="menuitem"], [data-testid="Dropdown"] a[href*="/compose/post"]');
          let quoteMenuItem = null;
          for (const item of menuItems) {
            const text = item.textContent || "";
            if (item.getAttribute("href")?.includes("/compose/post") || /引用|Quote/i.test(text)) {
              quoteMenuItem = item;
              break;
            }
          }
          if (quoteMenuItem) {
            quoteMenuItem.click();
            showToast(t("quoteOpenedToast"));
            return;
          }
          openQuoteIntent(tweetUrl);
        }, 70);
        return;
      }
    }

    // 2. Fallback to Twitter Web Intent
    openQuoteIntent(tweetUrl);
  }

  function openQuoteIntent(tweetUrl) {
    const intentUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(tweetUrl)}`;
    const popupWidth = 600;
    const popupHeight = 520;
    const left = Math.max(0, Math.round((window.screen.width - popupWidth) / 2));
    const top = Math.max(0, Math.round((window.screen.height - popupHeight) / 2));
    window.open(intentUrl, "_blank", `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`);
    showToast(t("quoteOpenedToast"));
  }

  // ==========================================================================
  // User Profile Hover Card (Avatar / Author Detailed Info Popover)
  // ==========================================================================
  let hoverCardEl = null;
  let hoverCardTimer = null;
  let hoverCardHideTimer = null;
  let activeHoverAuthor = null;
  let hoverCardGeneration = 0;
  let nativeHoverCleanup = null;
  const userProfileCache = new Map();
  const userProfileFetchedAt = new Map();
  const userProfileRequests = new Map();
  const pendingFollows = new Set();

  function ensureHoverCardElement() {
    if (hoverCardEl) return hoverCardEl;
    hoverCardEl = document.createElement("div");
    hoverCardEl.id = "sidepeek-user-hovercard";
    hoverCardEl.className = "sidepeek-user-hovercard";
    hoverCardEl.style.display = "none";

    hoverCardEl.addEventListener("mouseenter", () => {
      clearTimeout(hoverCardHideTimer);
    });
    hoverCardEl.addEventListener("focusin", () => clearTimeout(hoverCardHideTimer));
    hoverCardEl.addEventListener("mouseleave", () => {
      hoverCardHideTimer = setTimeout(() => {
        hideUserHoverCard();
      }, 250);
    });

    document.body.appendChild(hoverCardEl);
    return hoverCardEl;
  }

  function hideUserHoverCard() {
    clearTimeout(hoverCardTimer);
    clearTimeout(hoverCardHideTimer);
    activeHoverAuthor = null;
    hoverCardGeneration++;
    nativeHoverCleanup?.();
    nativeHoverCleanup = null;
    if (!hoverCardEl) return;
    hoverCardEl.classList.remove("visible");
    setTimeout(() => {
      if (!hoverCardEl.classList.contains("visible")) {
        hoverCardEl.style.display = "none";
      }
    }, 180);
  }

  function positionHoverCard(triggerEl, card) {
    const rect = triggerEl.getBoundingClientRect();
    const cardWidth = 300;
    const cardHeight = card.offsetHeight || 240;

    let left = rect.left - 10;
    if (left + cardWidth > window.innerWidth - 12) {
      left = window.innerWidth - cardWidth - 12;
    }
    if (left < 12) left = 12;

    let top = rect.bottom + 6;
    if (top + cardHeight > window.innerHeight - 12) {
      top = rect.top - cardHeight - 6;
      if (top < 12) top = 12;
    }

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function formatBioText(text, urls = []) {
    return formatCommentText({ text, entities: { urls } });
  }

  function showNativeUserHoverCard(author, triggerEl, generation) {
    const handle = author.handle.toLowerCase();
    const source = [...document.querySelectorAll('#react-root a[href], main a[href]')].find(link => {
      if (link.closest('#layers, #sidepeek-drawer-root')) return false;
      try { return new URL(link.href).pathname.toLowerCase() === `/${handle}`; } catch { return false; }
    });
    const layers = document.getElementById("layers");
    if (!source || !layers || typeof HTMLElement.prototype.showPopover !== "function") return Promise.resolve(false);
    nativeHoverCleanup?.();
    return new Promise(resolve => {
      let parent = null;
      let resizeObserver = null;
      let completed = false;
      let timer;
      const finish = value => { if (!completed) { completed = true; resolve(value); } };
      const enter = () => clearTimeout(hoverCardHideTimer);
      const leave = () => { hoverCardHideTimer = setTimeout(hideUserHoverCard, 250); };
      const position = () => {
        if (!parent || !triggerEl.isConnected) return;
        const rect = triggerEl.getBoundingClientRect();
        const cardRect = parent.getBoundingClientRect();
        const width = cardRect.width || 300;
        const height = cardRect.height || 300;
        const left = Math.max(12, Math.min(rect.left - 12, window.innerWidth - width - 12));
        const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12));
        parent.style.setProperty("--sidex-hover-left", `${left}px`);
        parent.style.setProperty("--sidex-hover-top", `${top}px`);
      };
      const observer = new MutationObserver(() => attach());
      const cleanup = () => {
        clearTimeout(timer);
        observer.disconnect();
        resizeObserver?.disconnect();
        if (parent) {
          parent.removeEventListener("mouseenter", enter);
          parent.removeEventListener("mouseleave", leave);
          parent.removeEventListener("focusin", enter);
          parent.removeEventListener("focusout", leave);
          if (parent.matches(":popover-open")) parent.hidePopover();
          parent.removeAttribute("popover");
          parent.removeAttribute("data-sidex-native-hover");
          parent.style.removeProperty("--sidex-hover-left");
          parent.style.removeProperty("--sidex-hover-top");
          parent.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
        }
        source.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
        if (nativeHoverCleanup === cleanup) nativeHoverCleanup = null;
        finish(false);
      };
      const attach = () => {
        if (generation !== hoverCardGeneration || !triggerEl.isConnected) { cleanup(); return; }
        const candidate = layers.querySelector('[data-testid="hoverCardParent"]');
        const identityLink = candidate?.querySelector('[data-testid="HoverCard"] a[href]');
        if (!identityLink || new URL(identityLink.href).pathname.toLowerCase() !== `/${handle}`) return;
        if (parent) return;
        parent = candidate;
        parent.setAttribute("data-sidex-native-hover", "");
        parent.setAttribute("popover", "manual");
        try { parent.showPopover(); } catch { cleanup(); return; }
        position();
        parent.addEventListener("mouseenter", enter);
        parent.addEventListener("mouseleave", leave);
        parent.addEventListener("focusin", enter);
        parent.addEventListener("focusout", leave);
        resizeObserver = new ResizeObserver(position);
        resizeObserver.observe(parent);
        clearTimeout(timer);
        observer.disconnect();
        finish(true);
      };
      nativeHoverCleanup = cleanup;
      observer.observe(layers, { childList: true, subtree: true });
      timer = setTimeout(cleanup, 1500);
      source.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
      attach();
    });
  }

  async function showUserHoverCard(author, triggerEl) {
    if (!author || !author.handle) return;
    nativeHoverCleanup?.();
    if (hoverCardEl) { hoverCardEl.classList.remove("visible"); hoverCardEl.style.display = "none"; }
    const handle = author.handle.toLowerCase();
    const generation = ++hoverCardGeneration;
    activeHoverAuthor = handle;
    if (await showNativeUserHoverCard(author, triggerEl, generation)) return;
    if (generation !== hoverCardGeneration || activeHoverAuthor !== handle || !triggerEl.isConnected) return;
    const cached = userProfileCache.get(handle);
    if (cached) Object.assign(author, cached);
    const fresh = Date.now() - (userProfileFetchedAt.get(handle) || 0) < 60000;
    renderUserHoverCard(author, triggerEl, fresh ? "" : "loading");
    if (fresh) return;
    let request = userProfileRequests.get(handle);
    if (!request) {
      request = requestPage("FETCH_USER_PROFILE", { screenName: author.handle }).then(async rawProfile => {
        const profile = Core.userModel(rawProfile);
        if (!profile?.handle) throw new Error("PROFILE_UNAVAILABLE");
        try { profile.mutual = await requestPage("FETCH_MUTUAL_FOLLOWERS", { userId: profile.id }, 12000); }
        catch { /* Keep the profile usable if relationship context is unavailable. */ }
        userProfileCache.set(handle, profile);
        userProfileFetchedAt.set(handle, Date.now());
        if (userProfileCache.size > 300) {
          const oldest = userProfileCache.keys().next().value;
          userProfileCache.delete(oldest);
          userProfileFetchedAt.delete(oldest);
        }
        return profile;
      }).finally(() => userProfileRequests.delete(handle));
      userProfileRequests.set(handle, request);
    }
    try {
      const profile = await request;
      if (generation !== hoverCardGeneration || activeHoverAuthor !== handle || !triggerEl.isConnected) return;
      Object.assign(author, profile);
      renderUserHoverCard(author, triggerEl);
    } catch {
      if (generation === hoverCardGeneration && activeHoverAuthor === handle && triggerEl.isConnected) {
        renderUserHoverCard(author, triggerEl, "error");
      }
    }
  }

  function formatProfileCount(value) {
    return value == null ? "--" : new Intl.NumberFormat(getLocale()).format(value);
  }

  function renderUserHoverCard(author, triggerEl, status = "") {

    const card = ensureHoverCardElement();
    card.className = `sidepeek-user-hovercard ${currentThemeClass()}`;

    const authorName = escapeHtml(author.name || author.handle);
    const authorHandle = escapeHtml(author.handle);

    const verifiedHtml = renderVerifiedBadge(author);
    const followsYouHtml = author.followedBy
      ? `<span class="sidepeek-hovercard-pill">${t("followsYou")}</span>`
      : "";

    const bioHtml = author.bio
      ? `<div class="sidepeek-hovercard-bio">${formatBioText(author.bio, author.bioUrls)}</div>`
      : "";

    const followingCountStr = formatProfileCount(author.followingCount);
    const followersCountStr = formatProfileCount(author.followersCount);
    const mutual = author.mutual;
    let mutualHtml = "";
    if (Array.isArray(mutual?.users)) {
      const names = mutual.users.slice(0, 2).map(user => user.name || user.handle).join(", ");
      const otherCount = Math.max(0, mutual.count - Math.min(2, mutual.users.length));
      const label = mutual.count === 0 ? t("noMutualFollowers")
        : otherCount ? t("mutualFollowersMore", { names, count: otherCount }) : t("mutualFollowers", { names });
      const avatars = mutual.users.map(user => `<img src="${escapeHtml(user.avatar || "")}" alt="" />`).join("");
      mutualHtml = `<a href="https://x.com/${authorHandle}/followers_you_follow" target="_blank" class="sidepeek-hovercard-mutual">
        ${avatars ? `<span class="sidepeek-mutual-avatars">${avatars}</span>` : ""}<span>${escapeHtml(label)}</span></a>`;
    }

    const currentUser = getCurrentUserInfo();
    const isSelf = Boolean(
      currentUser?.handle &&
      author.handle &&
      currentUser.handle.toLowerCase() === author.handle.toLowerCase()
    );

    const followBtnHtml = isSelf ? "" : `
      <button type="button" class="sidepeek-hovercard-follow-btn ${author.following ? "following" : ""}" ${author.following == null || status === "loading" || pendingFollows.has(author.handle.toLowerCase()) ? "disabled" : ""}>
        <span class="sidepeek-follow-text">${author.following ? t("followingBtn") : t("followBtn")}</span>
        <span class="sidepeek-unfollow-text">${t("unfollowBtn")}</span>
      </button>
    `;

    card.innerHTML = `
      <div class="sidepeek-hovercard-content">
        <div class="sidepeek-hovercard-top">
          <a href="https://x.com/${authorHandle}" target="_blank" class="sidepeek-hovercard-avatar-wrap">
            <img class="sidepeek-hovercard-avatar" src="${author.avatar}" alt="${authorName}" />
          </a>
          ${followBtnHtml}
        </div>
        <div class="sidepeek-hovercard-names">
          <a href="https://x.com/${authorHandle}" target="_blank" class="sidepeek-hovercard-name">
            <span>${authorName}</span>
            ${verifiedHtml}
          </a>
          <div class="sidepeek-hovercard-handle-row">
            <a href="https://x.com/${authorHandle}" target="_blank" class="sidepeek-hovercard-handle">@${authorHandle}</a>
            ${followsYouHtml}
          </div>
        </div>
        ${bioHtml}
        ${status === "loading" ? `<div class="sidepeek-profile-status" role="status">${t("profileLoading")}</div>` : ""}
        ${status === "error" ? `<button type="button" class="sidepeek-profile-retry">${t("profileFailed")}</button>` : ""}
        <div class="sidepeek-hovercard-stats">
          <a href="https://x.com/${authorHandle}/following" target="_blank" class="sidepeek-hovercard-stat">
            <span class="sidepeek-hovercard-count sidepeek-hovercard-following-count">${followingCountStr}</span>
            <span class="sidepeek-hovercard-label">${t("followingCountLabel")}</span>
          </a>
          <a href="https://x.com/${authorHandle}/verified_followers" target="_blank" class="sidepeek-hovercard-stat">
            <span class="sidepeek-hovercard-count sidepeek-hovercard-followers-count">${followersCountStr}</span>
            <span class="sidepeek-hovercard-label">${t("followersCountLabel")}</span>
          </a>
        </div>
        ${mutualHtml}
        <a class="sidepeek-hovercard-full-profile" href="https://x.com/${authorHandle}" target="_blank">${t("openFullProfile")}</a>
      </div>
    `;

    // Follow button click
    const followBtn = card.querySelector(".sidepeek-hovercard-follow-btn");
    followBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      handleToggleFollow(author, followBtn);
    });
    card.querySelector(".sidepeek-profile-retry")?.addEventListener("click", () => showUserHoverCard(author, triggerEl));

    card.style.display = "block";
    positionHoverCard(triggerEl, card);
    requestAnimationFrame(() => {
      card.classList.add("visible");
    });

  }

  function attachUserHoverEvents(triggerEl, author) {
    if (!triggerEl || !author || !author.handle) return;

    const enter = () => {
      clearTimeout(hoverCardTimer);
      clearTimeout(hoverCardHideTimer);
      hoverCardTimer = setTimeout(() => {
        showUserHoverCard(author, triggerEl);
      }, 350);
    };

    const leave = () => {
      clearTimeout(hoverCardTimer);
      hoverCardHideTimer = setTimeout(() => {
        hideUserHoverCard();
      }, 250);
    };
    triggerEl.addEventListener("mouseenter", enter);
    triggerEl.addEventListener("mouseleave", leave);
    triggerEl.addEventListener("focus", enter);
    triggerEl.addEventListener("blur", leave);
  }

  async function handleToggleFollow(author, btn) {
    if (!author || !author.handle) return;
    const key = author.handle.toLowerCase();
    if (pendingFollows.has(key) || author.following == null) return;
    pendingFollows.add(key);
    btn.disabled = true;
    const wasFollowing = Boolean(author.following);
    const oldFollowersCount = author.followersCount;
    // Optimistic UI
    author.following = !wasFollowing;
    author.followersCount = oldFollowersCount == null ? null : Math.max(0, oldFollowersCount + (wasFollowing ? -1 : 1));
    btn.classList.toggle("following", author.following);
    const followText = btn.querySelector(".sidepeek-follow-text");
    if (followText) followText.textContent = author.following ? t("followingBtn") : t("followBtn");
    const countEl = document.querySelector("#sidepeek-user-hovercard .sidepeek-hovercard-followers-count");
    if (countEl) countEl.textContent = formatProfileCount(author.followersCount);
    userProfileCache.set(key, { ...author });

    try {
      await requestPage("TOGGLE_FOLLOW", {
        userId: author.id,
        screenName: author.handle,
        active: wasFollowing
      });
    } catch (err) {
      // Revert on failure
      author.following = wasFollowing;
      author.followersCount = oldFollowersCount;
      btn.classList.toggle("following", wasFollowing);
      if (followText) followText.textContent = wasFollowing ? t("followingBtn") : t("followBtn");
      if (countEl) countEl.textContent = formatProfileCount(author.followersCount);
      userProfileCache.set(key, { ...author });
      showToast(err instanceof Error ? err.message : (getLocale() === "zh" ? "操作失败" : "Action failed"));
    } finally {
      pendingFollows.delete(key);
      btn.disabled = false;
      userProfileCache.set(key, { ...author });
      userProfileFetchedAt.set(key, Date.now());
      if (activeHoverAuthor === key) {
        const currentButton = hoverCardEl?.querySelector(".sidepeek-hovercard-follow-btn");
        if (currentButton) {
          currentButton.disabled = false;
          currentButton.classList.toggle("following", author.following);
          currentButton.querySelector(".sidepeek-follow-text").textContent = author.following ? t("followingBtn") : t("followBtn");
        }
        const currentCount = hoverCardEl?.querySelector(".sidepeek-hovercard-followers-count");
        if (currentCount) currentCount.textContent = formatProfileCount(author.followersCount);
      }
    }
  }

  function showToast(text) {
    let toast = document.getElementById("sidepeek-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sidepeek-toast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 20, 25, 0.9);
        color: #ffffff;
        padding: 8px 16px;
        border-radius: 9999px;
        font-size: 13px;
        z-index: 2147483647;
        pointer-events: none;
        transition: opacity 0.2s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 2000);
  }

  // ==========================================================================
  // Timeline Click Interceptor & Focal Tweet Show More
  // ==========================================================================
  function rememberThreadCursor(tweetId, nextCursor, consumedCursor = null) {
    let consumed = state.consumedCursors.get(tweetId);
    if (!consumed) state.consumedCursors.set(tweetId, consumed = new Set());
    if (consumedCursor) consumed.add(consumedCursor);
    if (nextCursor && !consumed.has(nextCursor)) state.threadCursors.set(tweetId, nextCursor);
    else state.threadCursors.delete(tweetId);
  }

  function acceptCreatedReply(model) {
    if (!state.open || !model?.id || state.replies.some(reply => reply.id === model.id)) return;
    if (model.inReplyToId !== state.focalTweetId && !state.tree?.byId.has(model.inReplyToId)) return;
    state.replies.unshift(model);
    const parent = state.tree?.byId.get(model.inReplyToId);
    if (parent) {
      parent.counts.replies += 1;
      state.expandedThreadIds.add(parent.id);
    }
    state.tree = Core.buildConversationTree(visibleReplies(), state.focalTweetId);
    renderDrawer();
  }

  function visibleReplies() {
    return state.replies.filter(reply => !reply._gateFor || state.openGatedThreads.has(reply._gateFor))
      .slice().sort((a, b) => Boolean(a._gateFor) - Boolean(b._gateFor));
  }

  function appendSectionLabel(container, model) {
    if (!model._gateFor || [...container.querySelectorAll(".sidepeek-section-label")].some(label => label.dataset.scope === model._gateFor)) return;
    const label = document.createElement("div");
    label.className = "sidepeek-section-label";
    label.dataset.scope = model._gateFor;
    label.textContent = model._sectionLabel || foldedText();
    container.appendChild(label);
  }

  function hasFoldedReplies(tweetId) {
    return Boolean(state.threadPages.get(tweetId)?.gated) || state.replies.some(reply => reply._gateFor === tweetId);
  }

  function foldedText() {
    return getLocale() === "zh" ? "X 折叠的回复" : "Replies folded by X";
  }

  function appendReplyPagination(container, tweetId) {
    const page = state.threadPages.get(tweetId) || {};
    const cursor = state.threadCursors.get(tweetId);
    const opened = state.openGatedThreads.has(tweetId);
    const preloaded = state.replies.some(reply => reply._gateFor === tweetId);
    const row = document.createElement("div");
    row.className = "sidepeek-pagination";
    const busy = state.loadingThreadIds.has(tweetId);
    if (opened) appendSectionLabel(container, { _gateFor: tweetId, _sectionLabel: page.sectionLabel });
    if (!opened && ((page.gated && !cursor) || preloaded)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidepeek-expand-btn sidepeek-gated-btn";
      button.textContent = page.gated?.label || foldedText();
      button.disabled = busy;
      button.addEventListener("click", () => {
        state.openGatedThreads.add(tweetId);
        page.sectionLabel ||= page.gated?.label || foldedText();
        if (page.gated?.cursor) {
          state.threadCursors.set(tweetId, page.gated.cursor);
          fetchSubReplies(tweetId, false, true, page.gated.cursor);
        } else {
          state.tree = Core.buildConversationTree(visibleReplies(), state.focalTweetId);
          renderDrawer();
        }
      });
      row.appendChild(button);
    } else if (cursor) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidepeek-expand-btn sidepeek-load-more-btn";
      button.disabled = busy;
      button.textContent = busy ? t("loadingReplies") : t(tweetId === state.focalTweetId ? "loadMoreComments" : "loadMoreThreadReplies");
      button.addEventListener("click", () => fetchSubReplies(tweetId, false, true, cursor));
      row.appendChild(button);
      if (page.error || page.paused) {
        const status = document.createElement("div");
        status.className = page.error ? "sidepeek-pagination-error" : "sidepeek-pagination-paused";
        status.textContent = page.error ? t("loadRepliesFailed") : (getLocale() === "zh" ? "本页没有新增回复，可手动继续加载" : "No new replies on this page. Continue manually.");
        row.prepend(status);
      } else if (state.autoLoadReplies && !opened && !busy && container.classList.contains("sidepeek-body") && typeof IntersectionObserver === "function") {
        const generation = state.threadGeneration;
        const observer = new IntersectionObserver(entries => {
          if (state.autoLoadReplies && replyObserver === observer && generation === state.threadGeneration && state.open &&
              state.threadCursors.get(tweetId) === cursor && entries.some(entry => entry.isIntersecting) &&
              !state.loadingThreadIds.has(tweetId)) fetchSubReplies(tweetId, false, true, cursor);
        }, { root: container, rootMargin: "200px 0px" });
        replyObserver = observer;
        observer.observe(row);
      }
    } else if (page.stalled) {
      row.classList.add("sidepeek-pagination-paused");
      row.textContent = getLocale() === "zh" ? "X 返回了重复的分页位置，已停止继续加载" : "X returned a repeated pagination cursor. Loading stopped.";
    } else if (page.ended || state.threadPages.has(tweetId)) {
      // Completion belongs to the current list, not each inline branch.
      // Keep branch pagination controls above, but only show this at the body end.
      if (!container.classList.contains("sidepeek-body")) return;
      const loaded = tweetId === state.focalTweetId ? state.tree?.rootReplies : state.tree?.childrenMap.get(tweetId);
      if (!loaded?.length) return;
      row.classList.add("sidepeek-pagination-end");
      row.textContent = getLocale() === "zh" ? "已加载完当前可见回复" : "All currently visible replies loaded";
    } else return;
    container.appendChild(row);
  }

  async function fetchThread(tweetId) {
    const generation = ++state.threadGeneration;
    clearCommentNodes();
    state.focalModel = null;
    state.replies = [];
    state.tree = null;
    state.loading = true;
    state.error = "";
    state.resetScrollOnRender = true;
    state.expandedThreadIds.clear();
    state.loadedThreadIds.clear();
    state.loadingThreadIds.clear();
    state.threadCursors.clear();
    state.threadPages.clear();
    state.openGatedThreads.clear();
    state.consumedCursors.clear();
    state.replyTarget = getSavedReplyTarget(tweetId);
    renderDrawer();

    try {
      const json = await requestPage("READ_THREAD", { tweetId });
      if (!state.open || state.focalTweetId !== tweetId || generation !== state.threadGeneration) return;
      const { focal, replies, cursor, pagination } = Core.parseTweetDetail(json, tweetId);
      state.focalModel = focal;
      state.replies = replies;
      state.tree = Core.buildConversationTree(visibleReplies(), tweetId);
      rememberThreadCursor(tweetId, cursor);
      state.threadPages.set(tweetId, pagination);
      state.loading = false;
      state.resetScrollOnRender = true;
      renderDrawer();
      prefetchSubRepliesForRoots();
    } catch (err) {
      if (!state.open || state.focalTweetId !== tweetId || generation !== state.threadGeneration) return;
      state.loading = false;
      state.error = err.message || "读取评论失败，请重试";
      renderDrawer();
    }
  }

  async function fetchSubReplies(commentId, isSilent = false, expandOnSuccess = true, cursor = null) {
    const generation = state.threadGeneration;
    if (!commentId) return;
    if (state.loadingThreadIds.has(commentId)) {
      if (expandOnSuccess && commentId !== state.focalTweetId) state.expandedThreadIds.add(commentId);
      return;
    }
    state.loadingThreadIds.add(commentId);
    if (!isSilent) {
      renderDrawer();
    }

    try {
      const currentFocal = state.focalTweetId;
      const json = await requestPage("READ_THREAD", { tweetId: commentId, ...(cursor ? { cursor } : {}) });
      if (!state.open || state.focalTweetId !== currentFocal || generation !== state.threadGeneration) return;

      const previousPage = state.threadPages.get(commentId) || {};
      const gated = state.openGatedThreads.has(commentId);
      const { focal, replies, cursor: nextCursor, pagination } = Core.parseTweetDetail(json, commentId, [state.focalModel, ...state.replies], gated ? previousPage.sectionLabel || foldedText() : "");
      const beforeIds = new Set(state.replies.map(reply => reply.id));

      // Merge pages by ID so duplicates update their existing model, and a
      // cursor page need not repeat the focal tweet or intermediate parents.
      const existingReplies = new Map(state.replies.map((r) => [r.id, r]));
      for (const r of (replies || [])) {
        if (r.id === state.focalTweetId) continue;
        const existing = existingReplies.get(r.id);
        if (existing) Object.assign(existing, r);
        else {
          if (commentId !== state.focalTweetId) r._subThreadOf = commentId;
          state.replies.push(r);
          existingReplies.set(r.id, r);
        }
      }

      // 如果 focal 自身数据有更新（如 counts），同步更新
      if (focal && state.tree?.byId?.has(commentId)) {
        const existing = state.tree.byId.get(commentId);
        if (focal.counts) Object.assign(existing.counts, focal.counts);
        existing.reportedReplyCount = focal.reportedReplyCount;
      }
      if (focal && commentId === state.focalTweetId) state.focalModel = focal;
      rememberThreadCursor(commentId, nextCursor, cursor);
      state.threadPages.set(commentId, {
        ...pagination,
        gated: gated ? pagination.gated : pagination.gated || previousPage.gated,
        sectionLabel: pagination.sectionLabel || previousPage.sectionLabel || "",
        stalled: Boolean(nextCursor && !state.threadCursors.has(commentId)),
        paused: Boolean(cursor && nextCursor && !replies.some(reply => !beforeIds.has(reply.id)))
      });

      // 重新构建对话树结构
      state.tree = Core.buildConversationTree(visibleReplies(), state.focalTweetId);
      state.loadedThreadIds.add(commentId);
      if (expandOnSuccess && commentId !== state.focalTweetId) {
        state.expandedThreadIds.add(commentId);
      }
    } catch (err) {
      if (!state.open || generation !== state.threadGeneration) return;
      const page = state.threadPages.get(commentId) || {};
      state.threadPages.set(commentId, { ...page, error: true });
      console.warn("[SideX] 读取回复失败:", err);
      if (!isSilent) {
        showToast(t("loadRepliesFailed") || "加载回复失败");
      }
    } finally {
      if (generation === state.threadGeneration) {
        state.loadingThreadIds.delete(commentId);
        if (state.open) renderDrawer();
      }
    }
  }

  async function handleExpandThread(rootReplyId) {
    const children = state.tree?.getSubtree ? state.tree.getSubtree(rootReplyId) : (state.tree?.childrenMap.get(rootReplyId) || []);
    const rootModel = state.tree?.byId?.get(rootReplyId);
    const totalReplies = rootModel?.counts?.replies || 0;

    // 如果本地已经有该二级评论的所有子回复，或者已经成功 fetch 过了，直接就地展开
    if (state.loadedThreadIds.has(rootReplyId) || (children.length >= totalReplies && totalReplies > 0)) {
      state.expandedThreadIds.add(rootReplyId);
      renderDrawer();
      return;
    }

    // 否则发起请求拉取完整的二级回复
    await fetchSubReplies(rootReplyId, /* isSilent */ false, /* expandOnSuccess */ true);
  }

  async function prefetchSubRepliesForRoots() {
    if (!state.open || !state.tree) return;
    const limit = state.subReplyLimit || 1;
    // 如果默认仅展示 1 条，X 原生数据已附带首条回复，无需在后台额外预取，彻底杜绝首次加载后的二次闪烁/重绘
    if (limit <= 1) return;

    const currentFocal = state.focalTweetId;
    const generation = state.threadGeneration;
    const roots = state.tree.rootReplies || [];
    const candidates = roots.filter((r) => {
      const total = r.counts?.replies || 0;
      const current = state.tree.childrenMap.get(r.id)?.length || 0;
      return total > 0 && current < total && current < limit &&
             !state.loadedThreadIds.has(r.id) &&
             !state.loadingThreadIds.has(r.id);
    }).slice(0, 3);

    for (const r of candidates) {
      if (!state.open || state.focalTweetId !== currentFocal || generation !== state.threadGeneration) break;
      try {
        await fetchSubReplies(r.id, /* isSilent */ true, /* expandOnSuccess */ false);
      } catch {}
    }
  }

  let userClosedTweetId = null;
  let lastHandledDetailTweetId = null;
  let lastCheckedUrl = "";

  function findDetailFocalArticle(tweetId) {
    if (!tweetId) return null;
    return [...document.querySelectorAll('article[data-testid="tweet"]')].find(article => {
      const timeLink = [...article.querySelectorAll('time')].map(time => time.closest('a[href*="/status/"]')).find(Boolean);
      return timeLink && Core.postIdFromUrl(timeLink.href) === String(tweetId);
    }) || null;
  }

  function expandFocalShowMore(tweetId) {
    let focalArticle = findDetailFocalArticle(tweetId);
    if (focalArticle) {
      const showMore = focalArticle.querySelector?.('[data-testid="tweet-text-show-more-link"]');
      if (showMore) showMore.click();
      return;
    }
    let retries = 0;
    const retryTimer = setInterval(() => {
      retries++;
      const article = findDetailFocalArticle(tweetId);
      if (article) {
        clearInterval(retryTimer);
        const showMore = article.querySelector?.('[data-testid="tweet-text-show-more-link"]');
        if (showMore) showMore.click();
      } else if (retries >= 15) {
        clearInterval(retryTimer);
      }
    }, 200);
  }

  async function checkDetailPageAutoOpen() {
    if (syncPhotoViewer()) return;
    // Pickers such as GIF search temporarily use /i/foundmedia/search. They
    // are overlays on the current post, not navigation away from its thread.
    if (nativeReplyOpening || document.querySelector('#layers [role="dialog"]')) return;
    if (!isSideXEnabled) return;
    if (state.isResizing) return;
    const currentUrl = location.href;
    if (currentUrl === lastCheckedUrl) return;
    lastCheckedUrl = currentUrl;

    const tweetId = Core.postIdFromUrl(currentUrl);

    if (tweetId) {
      // If the user explicitly closed this same tweet on this page, don't re-open
      if (tweetId === userClosedTweetId) return;

      // If already open for this tweet, nothing to do
      if (state.open && state.focalTweetId === tweetId) return;

      lastHandledDetailTweetId = tweetId;
      if (state.focalTweetId !== tweetId) preserveReplyText();
      const generation = ++state.threadGeneration;
      if (state.open) {
        clearCommentNodes();
        state.focalTweetId = tweetId;
        state.focalModel = null;
        state.replies = [];
        state.tree = null;
        state.threadCursors.clear();
        state.threadPages.clear();
        state.openGatedThreads.clear();
        state.consumedCursors.clear();
        state.loadingThreadIds.clear();
        state.loading = true;
        state.error = "";
        state.activeView = "root";
        state.replyTarget = getSavedReplyTarget(tweetId);
        state.resetScrollOnRender = true;
        renderDrawer();
      }

      // 无论右侧是否出流，主栏长文都原位秒展开
      expandFocalShowMore(tweetId);

      // 静默拉取评论流：仅当确实存在下一级回复时才优雅滑出右侧栏，彻底杜绝零回复时的“弹出来又关闭”闪烁
      try {
        const json = await requestPage("READ_THREAD", { tweetId });
        if (generation !== state.threadGeneration) return;
        // Native quick tools cover the current thread without abandoning it.
        const hasNativeOverlay = nativeReplyOpening || document.querySelector('#layers [role="dialog"]');
        if (Core.postIdFromUrl(location.href) !== tweetId && !(state.open && state.focalTweetId === tweetId && hasNativeOverlay)) return;
        if (userClosedTweetId === tweetId) return;

        const { focal, replies, cursor, pagination } = Core.parseTweetDetail(json, tweetId);

        // 如果完全没有下一级回复，绝对不弹出右侧抽屉，保持完全静默
        if ((!replies || replies.length === 0) && !cursor && !pagination.gated) {
          if (state.open && state.focalTweetId === tweetId) {
            closeDrawer();
          }
          return;
        }

        // 存在下级回复：此时再从容滑出抽屉，内容秒出
        let focalArticle = findDetailFocalArticle(tweetId);
        if (state.focalArticle) {
          state.focalArticle.classList.remove("sidepeek-focal-active");
        }
        state.focalArticle = focalArticle;
        state.focalArticle?.classList.add("sidepeek-focal-active");

        const wasOpenForTweet = state.open && state.focalTweetId === tweetId;
        state.open = true;
        clearCommentNodes();
        state.focalTweetId = tweetId;
        state.focalModel = focal;
        state.replies = replies;
        state.openGatedThreads.clear();
        state.tree = Core.buildConversationTree(visibleReplies(), tweetId);
        state.resetScrollOnRender = true;
        state.expandedThreadIds.clear();
        state.loadedThreadIds.clear();
        state.loadingThreadIds.clear();
        state.threadCursors.clear();
        state.threadPages.clear();
        state.openGatedThreads.clear();
        state.consumedCursors.clear();
        rememberThreadCursor(tweetId, cursor);
        state.threadPages.set(tweetId, pagination);
        state.activeView = "root";
        if (!wasOpenForTweet) state.replyTarget = getSavedReplyTarget(tweetId);
        state.loading = false;
        state.error = "";
        renderDrawer();
        prefetchSubRepliesForRoots();
      } catch (err) {
        if (generation === state.threadGeneration && state.open && state.focalTweetId === tweetId) {
          state.loading = false;
          state.error = err.message || t("loadRepliesFailed");
          renderDrawer();
        }
      }
    } else {
      // Navigated away from a detail page (e.g. back to /home, /explore)
      userClosedTweetId = null;
      if (lastHandledDetailTweetId) {
        lastHandledDetailTweetId = null;
        if (state.open) {
          closeDrawer();
        }
      }
    }
  }

  function openDrawerForTweet(tweetId, articleNode) {
    preserveReplyText();
    userClosedTweetId = null;
    lastHandledDetailTweetId = tweetId;

    // 1. Update focal tweet highlight
    if (state.focalArticle) {
      state.focalArticle.classList.remove("sidepeek-focal-active");
    }
    state.focalArticle = articleNode;
    state.focalArticle?.classList.add("sidepeek-focal-active");

    // 2. Expand "Show more" on focal tweet automatically
    const showMoreBtn = articleNode?.querySelector?.('[data-testid="tweet-text-show-more-link"]');
    if (showMoreBtn) {
      showMoreBtn.click();
    }

    // 3. Open drawer & fetch replies
    state.open = true;
    state.focalTweetId = tweetId;
    state.resetScrollOnRender = true;
    state.activeView = "root";
    state.replyTarget = null;
    fetchThread(tweetId);
  }

  function closeDrawer() {
    if (document.getElementById(ROOT_ID)?.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    preserveReplyText();
    if (photoViewer && dockedPhotoPanel) {
      dismissedPhotoId = photoViewer.tweetId;
      releasePhotoPanel();
      document.documentElement.setAttribute("data-sidex-photo-view", "native");
    }
    state.threadGeneration++;
    for (const observer of nativeActionObservers.values()) observer.disconnect();
    nativeActionObservers.clear();
    closeRepostMenu();
    closeMoreMenu();
    closeShareMenu();
    hideUserHoverCard();
    state.open = false;
    state.replyTarget = null;
    state.resetScrollOnRender = true;
    userClosedTweetId = state.focalTweetId;
    lastCheckedUrl = location.href;
    if (state.focalArticle) {
      state.focalArticle.classList.remove("sidepeek-focal-active");
      state.focalArticle = null;
    }
    renderDrawer();
  }

  /**
   * 精确判断点击位置是否应放行原生交互行为（原生跳转、按钮点击、卡片导航等）
   * 判定规则：
   * 1. 基础交互控件（点赞、转推、回复、书签、菜单、视频、输入框等） -> 放行
   * 2. 任何链接与可点击角色（a[href]、role="link"、作者头像、用户名、@提及、#话题、时间戳等） -> 放行
   * 3. 引用推文 (Quote Tweet) 容器内任何位置 -> 放行跳转到被引用推文
   * 4. 𝕏 Article 长文卡片、网页预览卡片容器内部 -> 放行原生跳转阅读长文/外部网页
   * 5. 主推文自身的正文内容（tweetText）或空白处 -> 拦截并原地呼出 SideX 抽屉
   */
  function shouldSkipClick(target, article) {
    if (!target) return false;

    // 1. 基础交互控件：按钮、表单输入、音视频、操作栏（点赞/转推/回复/书签/菜单/全文展开等）
    if (
      target.closest("button") ||
      target.closest('[role="button"]') ||
      target.closest("video") ||
      target.closest("audio") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest('[data-testid="like"]') ||
      target.closest('[data-testid="unlike"]') ||
      target.closest('[data-testid="retweet"]') ||
      target.closest('[data-testid="unretweet"]') ||
      target.closest('[data-testid="reply"]') ||
      target.closest('[data-testid="bookmark"]') ||
      target.closest('[data-testid="removeBookmark"]') ||
      target.closest('[data-testid="caret"]') ||
      target.closest('[aria-haspopup="menu"]') ||
      target.closest('[data-testid="tweet-text-show-more-link"]')
    ) {
      return true;
    }

    // 2. 超链接与链接角色容器（头像、用户名、@提及、#话题、时间戳、卡片等）
    if (target.closest("a[href]") || target.closest('[role="link"]')) {
      return true;
    }

    // 3. 引用推文 (Quote Tweet) 内部任何区域（包括其内部文本与作者）
    if (
      target.closest('[data-testid="quoteTweet"]') ||
      target.closest('[data-testid="tweet-quote"]') ||
      target.closest('[aria-label*="Quote Tweet" i]') ||
      target.closest('[aria-label*="引用推文" i]')
    ) {
      return true;
    }

    // 4. 𝕏 Article 长文卡片与外部网页卡片容器
    if (
      target.closest('[data-testid="card.wrapper"]') ||
      target.closest('[data-testid*="card."]') ||
      target.closest('[data-testid*="Card"]') ||
      target.closest('[data-testid="article-card"]') ||
      target.closest('[data-testid*="article" i]') ||
      target.closest('[data-testid*="Article"]') ||
      target.closest('[aria-label*="article" i]') ||
      target.closest('[aria-label*="Article"]') ||
      target.closest('a[href*="/article/"]') ||
      target.closest('a[href*="/i/article/"]')
    ) {
      return true;
    }

    // 5. 向上遍历检查是否位于包含 "𝕏 Article" / "Article" 徽章的独立卡片组件内部
    let parent = target.parentElement;
    while (parent && parent !== article) {
      if (parent.tagName === "ARTICLE" || parent.getAttribute?.("data-testid") === "tweet") {
        break;
      }
      if (
        parent.textContent?.includes("𝕏 Article") ||
        parent.textContent?.includes("X Article")
      ) {
        return true;
      }
      parent = parent.parentElement;
    }

    return false;
  }

  function getArticleReplyCount(article) {
    if (!article) return 0;
    const replyBtn = article.querySelector('[data-testid="reply"]');
    if (!replyBtn) return 0;
    const text = replyBtn.textContent?.trim() || "";
    if (!text) return 0;
    if (/k/i.test(text)) {
      const m = text.match(/([\d.]+)/);
      return m ? Math.round(parseFloat(m[1]) * 1000) : 0;
    }
    if (/m/i.test(text)) {
      const m = text.match(/([\d.]+)/);
      return m ? Math.round(parseFloat(m[1]) * 1000000) : 0;
    }
    if (/万/.test(text)) {
      const m = text.match(/([\d.]+)/);
      return m ? Math.round(parseFloat(m[1]) * 10000) : 0;
    }
    const digits = text.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function handleTimelineClick(event) {
    if (!isSideXEnabled) return;
    if (state.isResizing) return;
    if (event.target.closest?.('[data-sidex-native-reply-link]')) return;
    if (event.target.closest?.("#layers, #sidepeek-user-hovercard, .sidepeek-more-menu, .sidepeek-share-menu, .sidepeek-repost-menu")) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    // If clicked inside our drawer or lightbox, don't handle as timeline click
    const drawer = document.getElementById(ROOT_ID);
    if (drawer && drawer.contains(event.target)) return;

    const lightbox = document.getElementById("sidepeek-lightbox");
    if (lightbox && lightbox.contains(event.target)) return;

    const article = event.target.closest?.('article[data-testid="tweet"]');
    if (!article) {
      // Clicked blank space outside drawer -> close drawer
      if (state.open && drawer && !drawer.contains(event.target)) {
        closeDrawer();
      }
      return;
    }

    if (shouldSkipClick(event.target, article)) return;
    // 在通知页面中，如果是没有下一级回复的最新评论，不要拦截弹侧栏，让原生逻辑跳转到原回复贴
    const isNotificationsPage = location.pathname.startsWith("/notifications");
    if (isNotificationsPage) {
      const replyCount = getArticleReplyCount(article);
      if (replyCount === 0) {
        return;
      }
    }

    // Find tweet URL & ID
    // 优先从推文顶部的第一条时间链接提取自身 ID，避免受内嵌引用推文的 status 链接干扰
    const firstTimeAnchor = article.querySelector('time')?.closest('a[href*="/status/"]');
    const firstStatusUrl = firstTimeAnchor ? firstTimeAnchor.getAttribute("href") : null;
    const hrefs = [...article.querySelectorAll('a[href*="/status/"]')].map(a => a.getAttribute("href"));
    const ownUrl = firstStatusUrl || Core.selectOwnPostUrl(hrefs, null, location.href);
    const tweetId = ownUrl ? Core.postIdFromUrl(ownUrl) : null;

    if (!tweetId) return;

    // Prevent default navigation to detail page!
    event.preventDefault();
    event.stopImmediatePropagation();

    openDrawerForTweet(tweetId, article, false);
  }

  document.addEventListener("click", handleTimelineClick, true);
  // Capture before X unmounts the native column or opens another modal.
  document.addEventListener("click", rememberPhotoScroll, true);

  // X may mount its own copy after the drawer data arrives, or recycle it while
  // scrolling. Attach to that copy when it appears instead of keeping a snapshot.
  let nativeSyncScheduled = false;
  new MutationObserver(records => {
    if (nativeSyncScheduled || records.every(record => record.target.closest?.(`#${ROOT_ID}, #sidepeek-user-hovercard`))) return;
    nativeSyncScheduled = true;
    requestAnimationFrame(() => {
      nativeSyncScheduled = false;
      if (syncPhotoViewer()) return;
      if (!state.open) return;
      nativeLayers?.sync(document.getElementById(ROOT_ID));
      for (const [id, entry] of commentNodes) {
        if (nativeActionArticles.get(id)?.isConnected) continue;
        const article = findDetailFocalArticle(id);
        if (article) watchNativeActions(entry.model, article);
      }
    });
  }).observe(document.getElementById("react-root") || document.body, { childList: true, subtree: true });

  // ESC key to close (Lightbox first, then Menus, then Hover Card, then Drawer)
  document.addEventListener("keydown", (event) => {
    if (!isSideXEnabled) return;
    if (event.key === "Escape") {
      if (nativeHoverCleanup) { hideUserHoverCard(); return; }
      if (document.querySelector('#layers [role="dialog"], #layers [role="menu"]')) return;
      const lightbox = document.getElementById("sidepeek-lightbox");
      if (lightbox && lightbox.classList.contains("active")) {
        closeLightbox();
        return;
      }
      if (activeMoreMenu) {
        closeMoreMenu();
        return;
      }
      if (activeShareMenu) {
        closeShareMenu();
        return;
      }
      if (activeRepostMenu) {
        closeRepostMenu();
        return;
      }
      if (hoverCardEl && hoverCardEl.classList.contains("visible")) {
        hideUserHoverCard();
        return;
      }
      if (state.open) {
        closeDrawer();
      }
    }
  });

  // Global click outside to dismiss Repost, More, and Share menus
  document.addEventListener("click", (e) => {
    if (activeRepostMenu && !activeRepostMenu.contains(e.target) && (!activeRepostBtn || !activeRepostBtn.contains(e.target))) {
      closeRepostMenu();
    }
    if (activeMoreMenu && !activeMoreMenu.contains(e.target) && (!activeMoreBtn || !activeMoreBtn.contains(e.target))) {
      closeMoreMenu();
    }
    if (activeShareMenu && !activeShareMenu.contains(e.target) && (!activeShareBtn || !activeShareBtn.contains(e.target))) {
      closeShareMenu();
    }
  }, true);

  // Window resize to close Repost menu, More menu, Share menu, and hovercard
  window.addEventListener("resize", () => {
    closeRepostMenu();
    closeMoreMenu();
    closeShareMenu();
    hideUserHoverCard();
  });

  // URL Watcher: detect SPA transitions, Back/Forward navigation, and auto-open on detail pages
  window.addEventListener("popstate", checkDetailPageAutoOpen);
  window.addEventListener("hashchange", checkDetailPageAutoOpen);
  setInterval(checkDetailPageAutoOpen, 300);

  // Initial check on load
  checkDetailPageAutoOpen();
})();
