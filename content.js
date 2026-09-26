(function initSidePeek() {
  "use strict";

  if (window.top !== window.self) return;

  const Core = globalThis.SidePeekCore;
  const ROOT_ID = "sidepeek-drawer-root";
  const CONTENT_SOURCE = "sidepeek-content";
  const PAGE_SOURCE = "sidepeek-page";

  // SVG Icons (Official Twitter/X SVGs matching web client)
  const ICONS = {
    reply: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg>`,
    repost: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg>`,
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
    location: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path></g></svg>`
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

  const REACTION_GIFS = [
    { tag: "哈哈", title: "大笑", url: "https://media.giphy.com/media/26n6Gx9moCgs1qxxt/giphy.gif" },
    { tag: "哈哈", title: "狂笑", url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif" },
    { tag: "点赞", title: "赞", url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif" },
    { tag: "点赞", title: "干得漂亮", url: "https://media.giphy.com/media/mgqefOvJJToHrp2qt8/giphy.gif" },
    { tag: "鼓掌", title: "海豹鼓掌", url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif" },
    { tag: "鼓掌", title: "全场起立", url: "https://media.giphy.com/media/nbvFVPiEiJH6JOGIok/giphy.gif" },
    { tag: "吃瓜", title: "爆米花", url: "https://media.giphy.com/media/tyqcJoNjNv0Fq/giphy.gif" },
    { tag: "吃瓜", title: "吃瓜中", url: "https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif" },
    { tag: "比心", title: "心动", url: "https://media.giphy.com/media/R6gVNROjZa40JYg3u8/giphy.gif" },
    { tag: "比心", title: "飞吻", url: "https://media.giphy.com/media/uw0KqTWZSm8gg/giphy.gif" },
    { tag: "震惊", title: "张大嘴", url: "https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif" },
    { tag: "震惊", title: "不可思议", url: "https://media.giphy.com/media/tfUW8mhiFk8NlRezUS/giphy.gif" },
    { tag: "无语", title: "扶额", url: "https://media.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif" },
    { tag: "无语", title: "白眼", url: "https://media.giphy.com/media/6yRVg0HWzgS88/giphy.gif" },
    { tag: "哭泣", title: "大哭", url: "https://media.giphy.com/media/L95W4wvNFOM4LBWP68/giphy.gif" },
    { tag: "哭泣", title: "抹眼泪", url: "https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif" }
  ];

  const state = {
    open: false,
    focalTweetId: null,
    focalArticle: null,
    focalModel: null,
    replies: [],
    tree: null,
    expandedThreadIds: new Set(),
    activeView: "root", // "root" or { type: "drilldown", parentId: string }
    replyTarget: null, // Comment model being replied to, or null for focal tweet
    loading: false,
    error: "",
    isResizing: false
  };

  const pendingRequests = new Map();
  let requestSequence = 0;

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
    storage.get({ sidex_enabled: true, sidex_lang: null }, (res) => {
      isSideXEnabled = res.sidex_enabled !== false;
      if (res.sidex_lang) overrideLocale = res.sidex_lang;
      if (!isSideXEnabled) {
        closeDrawer();
        const root = document.getElementById(ROOT_ID);
        if (root) root.style.display = "none";
      }
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.sidex_enabled !== undefined) {
        isSideXEnabled = changes.sidex_enabled.newValue !== false;
        const root = document.getElementById(ROOT_ID);
        if (!isSideXEnabled) {
          closeDrawer();
          if (root) root.style.display = "none";
        } else {
          if (root) root.style.display = "";
        }
      }
      if (changes.sidex_lang !== undefined) {
        overrideLocale = changes.sidex_lang.newValue;
        if (state.open) renderDrawer();
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
      overCharLimit: "字数超出限制",
      emptyReplies: "暂无评论，快来抢沙发吧~",
      noMoreReplies: "暂无更多子回复",
      loadingReplies: "正在加载评论...",
      retryBtn: "重试",
      showMoreReplies: "展开另外 {count} 条回复",
      collapseReplies: "收起回复",
      replyToTag: "回复",
      replyAction: "回复",
      repostAction: "转发",
      likeAction: "喜欢",
      viewsAction: "浏览量",
      bookmarkAction: "书签",
      shareAction: "复制链接",
      linkCopied: "链接已复制到剪贴板",
      justNow: "刚刚",
      minutesAgo: "{m}分",
      hoursAgo: "{h}小时",
      mediaToolTitle: "添加媒体 (图片/视频，支持 Ctrl+V)",
      gifToolTitle: "添加 GIF",
      pollToolTitle: "创建投票",
      emojiToolTitle: "添加表情",
      scheduleToolTitle: "定时发布",
      locationToolTitle: "添加位置",
      charCountTitle: "字数统计",
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
      overCharLimit: "Character limit exceeded",
      emptyReplies: "No replies yet. Be the first to reply!",
      noMoreReplies: "No more replies",
      loadingReplies: "Loading replies...",
      retryBtn: "Retry",
      showMoreReplies: "Show {count} more replies",
      collapseReplies: "Collapse replies",
      replyToTag: "Replying to",
      replyAction: "Reply",
      repostAction: "Repost",
      likeAction: "Like",
      viewsAction: "Views",
      bookmarkAction: "Bookmark",
      shareAction: "Copy link",
      linkCopied: "Link copied to clipboard",
      justNow: "just now",
      minutesAgo: "{m}m",
      hoursAgo: "{h}h",
      mediaToolTitle: "Add media (Images/video, Ctrl+V)",
      gifToolTitle: "Add GIF",
      pollToolTitle: "Create poll",
      emojiToolTitle: "Add emoji",
      scheduleToolTitle: "Schedule post",
      locationToolTitle: "Add location",
      charCountTitle: "Character count",
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
    let root = document.getElementById(ROOT_ID);
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
    return root;
  }

  function updateDrawerPosition() {
    const root = document.getElementById(ROOT_ID);
    if (!root || !state.open) return;

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
      });
      ro.observe(body);
    }

    requestAnimationFrame(updateSlider);
    setTimeout(updateSlider, 80);
    setTimeout(updateSlider, 350);
  }

  window.addEventListener("resize", updateDrawerPosition);

  // ==========================================================================
  // UI Rendering
  // ==========================================================================
  function renderDrawer() {
    const root = ensureDrawerRoot();
    if (!state.open) {
      root.classList.remove("sidepeek-open");
      return;
    }

    updateDrawerPosition();
    root.classList.add("sidepeek-open");

    // Guard: ensure replyTarget belongs to current focal tweet or tree
    if (state.replyTarget) {
      const isTargetInCurrentTree = Boolean(state.tree && state.tree.byId && state.tree.byId.has(state.replyTarget.id));
      const isTargetFocal = state.replyTarget.id === state.focalTweetId;
      if (state.tree && !isTargetInCurrentTree && !isTargetFocal) {
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

    root.innerHTML = `
      <div class="sidepeek-resize-handle sidepeek-resize-handle-left" title="${getLocale() === "zh" ? "拖动左边缘调整宽度，双击恢复默认" : "Drag left edge to resize, double-click to reset"}">
        <div class="sidepeek-resize-grip"></div>
      </div>
      <div class="sidepeek-resize-handle sidepeek-resize-handle-right" title="${getLocale() === "zh" ? "拖动右边缘调整宽度，双击恢复默认" : "Drag right edge to resize, double-click to reset"}">
        <div class="sidepeek-resize-grip"></div>
      </div>
      <header class="sidepeek-header">
        <div class="sidepeek-title-wrap">
          ${isDrillDown ? `<button type="button" class="sidepeek-back-btn" aria-label="${t("backToAll")}">${ICONS.back}</button>` : ""}
          <span class="sidepeek-title">${isDrillDown ? t("threadBranch") : "SideX"}</span>
          <span class="sidepeek-count-badge">(${isDrillDown ? (state.tree?.childrenMap.get(drillDownParent?.id)?.length || 0) : (state.tree?.rootReplies.length || 0)})</span>
        </div>
        <div class="sidepeek-header-actions">
          <button type="button" class="sidepeek-icon-btn sidepeek-btn-reset-width" title="${t("resetWidth")}">${ICONS.resetWidth}</button>
          ${state.focalModel?.url ? `<a href="${state.focalModel.url}" target="_blank" class="sidepeek-icon-btn" title="${t("openOnX")}">${ICONS.external}</a>` : ""}
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
      <footer class="sidepeek-footer-composer">
        <!-- In-place Popovers -->
        <div class="sidepeek-popover sidepeek-emoji-popover" style="display: none;"></div>
        <div class="sidepeek-popover sidepeek-gif-popover" style="display: none;"></div>
        <div class="sidepeek-popover sidepeek-poll-popover" style="display: none;"></div>
        <div class="sidepeek-popover sidepeek-schedule-popover" style="display: none;"></div>

        <div class="sidepeek-footer-inner">
          <div class="sidepeek-footer-avatar-wrap">
            ${userAvatar ? `<img src="${userAvatar}" class="sidepeek-footer-avatar" alt="" />` : `<div class="sidepeek-footer-avatar-default">${ICONS.user}</div>`}
          </div>
          <div class="sidepeek-footer-main">
            <div class="sidepeek-footer-reply-target" style="${state.replyTarget ? 'display:flex;' : 'display:none;'}">
              <span class="sidepeek-reply-target-text">${state.replyTarget ? `${t("replyToTag")} @${state.replyTarget.author.handle}` : ""}</span>
              <button type="button" class="sidepeek-cancel-reply-target" title="✕">✕</button>
            </div>
            <textarea class="sidepeek-footer-textarea" rows="1" placeholder="${replyPlaceholder}"></textarea>
            <div class="sidepeek-footer-preview-area"></div>
            <div class="sidepeek-footer-toolbar">
              <div class="sidepeek-footer-tools">
                <label class="sidepeek-tool-btn sidepeek-tool-media" title="${t("mediaToolTitle")}">
                  <input type="file" accept="image/*,video/*" class="sidepeek-media-file-input" style="display:none;" />
                  ${ICONS.media}
                </label>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-gif" title="${t("gifToolTitle")}">
                  ${ICONS.gif}
                </button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-poll" title="${t("pollToolTitle")}">
                  ${ICONS.poll}
                </button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-emoji" title="${t("emojiToolTitle")}">
                  ${ICONS.emoji}
                </button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-schedule" title="${t("scheduleToolTitle")}">
                  ${ICONS.schedule}
                </button>
                <button type="button" class="sidepeek-tool-btn sidepeek-tool-location" title="${t("locationToolTitle")}">
                  ${ICONS.location}
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
      </footer>
    `;

    initResizeHandle(root);
    initScrollSlider(root);
    initFooterComposer(root, isDrillDown, drillDownParent);

    // Event listeners on header
    root.querySelector(".sidepeek-btn-close")?.addEventListener("click", closeDrawer);
    if (isDrillDown) {
      root.querySelector(".sidepeek-back-btn")?.addEventListener("click", () => {
        state.activeView = "root";
        state.replyTarget = null;
        renderDrawer();
      });
    }

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

    if (isDrillDown && drillDownParent) {
      // Render the parent comment first
      const parentNode = renderCommentNode(drillDownParent, true);
      body.appendChild(parentNode);

      // Render children
      const children = state.tree?.childrenMap.get(drillDownParent.id) || [];
      if (children.length === 0) {
        const empty = document.createElement("div");
        empty.className = "sidepeek-empty-box";
        empty.textContent = t("noMoreReplies");
        body.appendChild(empty);
      } else {
        for (let i = 0; i < children.length; i++) {
          const hasNext = i < children.length - 1;
          body.appendChild(renderCommentNode(children[i], hasNext, true));
        }
      }
    } else {
      // Root view: 默认直接展开二级回复
      const roots = state.tree?.rootReplies || [];
      if (roots.length === 0) {
        body.innerHTML = `<div class="sidepeek-empty-box"><span>${t("emptyReplies")}</span></div>`;
        return;
      }

      const INLINE_LIMIT = 2; // 默认就地展示最多 2 条二级回复

      for (const rootReply of roots) {
        const children = state.tree?.childrenMap.get(rootReply.id) || [];
        const childrenCount = children.length;

        if (childrenCount === 0) {
          body.appendChild(renderCommentNode(rootReply, false));
        } else {
          const threadGroup = document.createElement("div");
          threadGroup.className = "sidepeek-thread-group";

          // 父评论带有向下连接子评论的 Thread Line
          threadGroup.appendChild(renderCommentNode(rootReply, true));

          const isExpanded = state.expandedThreadIds.has(rootReply.id);
          const showAll = isExpanded || childrenCount <= INLINE_LIMIT;
          const visibleChildren = showAll ? children : children.slice(0, INLINE_LIMIT);

          for (let i = 0; i < visibleChildren.length; i++) {
            const child = visibleChildren[i];
            const isLast = (i === visibleChildren.length - 1) && (showAll || isExpanded);
            const childHasLine = !isLast;
            threadGroup.appendChild(renderCommentNode(child, childHasLine, true));
          }

          if (!showAll) {
            const remaining = childrenCount - INLINE_LIMIT;
            const moreBtn = document.createElement("button");
            moreBtn.type = "button";
            moreBtn.className = "sidepeek-drilldown-trigger";
            moreBtn.textContent = t("showMoreReplies", { count: remaining });
            moreBtn.addEventListener("click", () => {
              state.expandedThreadIds.add(rootReply.id);
              renderDrawer();
            });
            threadGroup.appendChild(moreBtn);
          } else if (childrenCount > INLINE_LIMIT && isExpanded) {
            const collapseBtn = document.createElement("button");
            collapseBtn.type = "button";
            collapseBtn.className = "sidepeek-drilldown-trigger";
            collapseBtn.textContent = t("collapseReplies");
            collapseBtn.addEventListener("click", () => {
              state.expandedThreadIds.delete(rootReply.id);
              renderDrawer();
            });
            threadGroup.appendChild(collapseBtn);
          }

          body.appendChild(threadGroup);
        }
      }
    }
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

  function cleanCommentBody(text, inReplyToHandle) {
    if (!text) return "";
    if (inReplyToHandle) {
      const stripped = text.replace(/^(?:@[A-Za-z0-9_]+\s*)+/, "").trim();
      return stripped || text;
    }
    return text;
  }

  function formatCommentText(model) {
    if (!model?.text) return "";
    let text = cleanCommentBody(model.text, model.inReplyToHandle);
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

  function renderCommentNode(model, hasThreadLine = false, isChild = false) {
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

    const timeHtml = model.url
      ? `<a class="sidepeek-time" href="${model.url}" target="_blank">${formatTime(model.createdAt)}</a>`
      : `<span class="sidepeek-time">${formatTime(model.createdAt)}</span>`;

    const replyToHtml = model.inReplyToHandle
      ? `<div class="sidepeek-reply-to-tag">${t("replyToTag")} <a href="https://x.com/${escapeHtml(model.inReplyToHandle)}" target="_blank">@${escapeHtml(model.inReplyToHandle)}</a></div>`
      : "";

    item.innerHTML = `
      <div class="sidepeek-avatar-col">
        ${avatarHtml}
        ${hasThreadLine ? '<div class="sidepeek-thread-line"></div>' : ""}
      </div>
      <div class="sidepeek-content-col">
        <div class="sidepeek-author-row">
          ${nameHtml}
          ${renderVerifiedBadge(model.author)}
          <span class="sidepeek-handle">@${authorHandle}</span>
          <span class="sidepeek-dot">·</span>
          ${timeHtml}
        </div>
        ${replyToHtml}
        <div class="sidepeek-text">${formatCommentText(model)}</div>
        ${renderMediaBox(model.media)}
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
          <button type="button" class="sidepeek-action-btn sidepeek-act-views" title="${t("viewsAction")}">
            <span class="sidepeek-action-btn-surface">${ICONS.views} <span>${formatCount(model.counts.views)}</span></span>
          </button>
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

    actReply?.addEventListener("click", (e) => {
      e.stopPropagation();
      setReplyTarget(model);
    });
    actRepost?.addEventListener("click", () => handleToggleAction(model, "repost", actRepost));
    actLike?.addEventListener("click", () => handleToggleAction(model, "like", actLike));
    actBookmark?.addEventListener("click", () => handleToggleAction(model, "bookmark", actBookmark));
    actShare?.addEventListener("click", () => handleShare(model));

    // Image zoom / lightbox click
    item.querySelectorAll(".sidepeek-zoomable-img").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(img.dataset.full || img.src);
      });
    });

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

    const video = mediaList.find((m) => m.type === "video" || m.type === "animated_gif");
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
    return div.innerHTML;
  }

  // ==========================================================================
  // Bottom Reply Target Management
  // ==========================================================================
  function setReplyTarget(model) {
    if (!model) return;
    state.replyTarget = model;
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
        textarea.focus();
      }
    });

    const textarea = footer.querySelector(".sidepeek-footer-textarea");
    const previewArea = footer.querySelector(".sidepeek-footer-preview-area");
    const submitBtn = footer.querySelector(".sidepeek-footer-submit-btn");
    const fileInput = footer.querySelector(".sidepeek-media-file-input");

    // Toolbar buttons
    const btnMedia = footer.querySelector(".sidepeek-tool-media");
    const btnGif = footer.querySelector(".sidepeek-tool-gif");
    const btnPoll = footer.querySelector(".sidepeek-tool-poll");
    const btnEmoji = footer.querySelector(".sidepeek-tool-emoji");
    const btnSchedule = footer.querySelector(".sidepeek-tool-schedule");
    const btnLocation = footer.querySelector(".sidepeek-tool-location");

    // Popover containers
    const emojiPopover = footer.querySelector(".sidepeek-emoji-popover");
    const gifPopover = footer.querySelector(".sidepeek-gif-popover");
    const pollPopover = footer.querySelector(".sidepeek-poll-popover");
    const schedulePopover = footer.querySelector(".sidepeek-schedule-popover");

    // Progress ring elements
    const charCounter = footer.querySelector(".sidepeek-char-counter");
    const ringProgress = footer.querySelector(".sidepeek-char-ring-progress");
    const charWarnNum = footer.querySelector(".sidepeek-char-warn-num");

    let pastedMediaId = null;
    let pastedBlob = null;
    let activePoll = null;
    let activeSchedule = null;
    let activeLocation = null;

    const targetTweetId = isDrillDown && drillDownParent ? drillDownParent.id : state.focalTweetId;

    // Helper: calculate character count (ASCII=1, CJK/Emoji/Fullwidth=2, Limit=280)
    function calculateTweetLength(text) {
      let len = 0;
      for (const ch of (text || "")) {
        const code = ch.codePointAt(0);
        if (code <= 127) len += 1;
        else len += 2;
      }
      return len;
    }

    // Update character progress ring and submit button state
    function updateComposerState() {
      if (!textarea || !ringProgress || !submitBtn) return;
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";

      const text = textarea.value;
      const len = calculateTweetLength(text);
      const circumference = 2 * Math.PI * 9; // ~56.5487
      const maxLen = 280;

      if (len === 0) {
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = `${circumference}`;
        ringProgress.style.stroke = "var(--sp-accent)";
        if (charWarnNum) {
          charWarnNum.textContent = "";
          charWarnNum.className = "sidepeek-char-warn-num";
        }
        if (charCounter) charCounter.style.opacity = "0.4";
      } else {
        if (charCounter) charCounter.style.opacity = "1";
        const progress = Math.min(1, len / maxLen);
        const offset = circumference * (1 - progress);
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = `${offset}`;

        if (len < 260) {
          ringProgress.style.stroke = "var(--sp-accent)";
          if (charWarnNum) {
            charWarnNum.textContent = "";
            charWarnNum.className = "sidepeek-char-warn-num";
          }
        } else if (len <= 280) {
          ringProgress.style.stroke = "#ffd400";
          if (charWarnNum) {
            charWarnNum.textContent = String(maxLen - len);
            charWarnNum.className = "sidepeek-char-warn-num warn-amber";
          }
        } else {
          ringProgress.style.stroke = "#f4212e";
          if (charWarnNum) {
            charWarnNum.textContent = String(maxLen - len);
            charWarnNum.className = "sidepeek-char-warn-num warn-red";
          }
        }
      }

      const hasContent = (len > 0 && len <= maxLen) || pastedMediaId !== null || activePoll !== null;
      const isOverLimit = len > maxLen;
      submitBtn.disabled = !hasContent || isOverLimit;
    }

    textarea?.addEventListener("input", updateComposerState);

    // Popover toggle management
    function closeAllPopovers() {
      [emojiPopover, gifPopover, pollPopover, schedulePopover].forEach((p) => {
        if (p) p.style.display = "none";
      });
      [btnGif, btnPoll, btnEmoji, btnSchedule].forEach((btn) => {
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
      if (e.key === "Escape") {
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
    // 2. GIF Popover
    // =========================================================================
    if (gifPopover) {
      let selectedTag = "全部";
      function renderGifPopover(searchQuery = "") {
        const query = searchQuery.trim().toLowerCase();
        const filteredGifs = REACTION_GIFS.filter((item) => {
          if (query) {
            return item.title.toLowerCase().includes(query) || item.tag.toLowerCase().includes(query);
          }
          return selectedTag === "全部" || item.tag === selectedTag;
        });

        const rawTags = ["全部", ...new Set(REACTION_GIFS.map((g) => g.tag))];

        gifPopover.innerHTML = `
          <div class="sidepeek-popover-header">
            <input type="text" class="sidepeek-gif-search-input" placeholder="${t("searchGifPlaceholder")}" value="${query}" />
            <button type="button" class="sidepeek-popover-close" title="✕">✕</button>
          </div>
          <div class="sidepeek-gif-tags">
            ${rawTags.map((tag) => {
              const tagLabel = tag === "全部" ? t("allCategory") : (t("gifTags." + {
                "哈哈": "laugh",
                "点赞": "agree",
                "鼓掌": "clap",
                "吃瓜": "popcorn",
                "比心": "love",
                "震惊": "shock",
                "无语": "facepalm",
                "哭泣": "cry"
              }[tag]) || tag);
              return `<button type="button" class="sidepeek-gif-tag ${tag === selectedTag ? "active" : ""}" data-tag="${tag}">${tagLabel}</button>`;
            }).join("")}
          </div>
          <div class="sidepeek-gif-grid">
            ${filteredGifs.length > 0 ? filteredGifs.map((gif) => `
              <div class="sidepeek-gif-item" data-url="${gif.url}" data-title="${gif.title}">
                <img src="${gif.url}" alt="${gif.title}" loading="lazy" />
                <span class="sidepeek-gif-label">${gif.title}</span>
              </div>
            `).join("") : `<div class="sidepeek-popover-empty">${t("noGifFound")}</div>`}
          </div>
        `;

        const searchInput = gifPopover.querySelector(".sidepeek-gif-search-input");
        searchInput?.addEventListener("input", (e) => {
          renderGifPopover(e.target.value);
          gifPopover.querySelector(".sidepeek-gif-search-input")?.focus();
        });

        gifPopover.querySelector(".sidepeek-popover-close")?.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAllPopovers();
        });

        gifPopover.querySelectorAll(".sidepeek-gif-tag").forEach((tBtn) => {
          tBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedTag = tBtn.dataset.tag;
            renderGifPopover();
          });
        });

        gifPopover.querySelectorAll(".sidepeek-gif-item").forEach((item) => {
          item.addEventListener("click", async (e) => {
            e.stopPropagation();
            const gifUrl = item.dataset.url;
            const gifTitle = item.dataset.title;
            closeAllPopovers();

            previewArea.innerHTML = `
              <div class="sidepeek-pasted-preview">
                <img src="${gifUrl}" alt="${gifTitle}" />
                <div class="sidepeek-gif-badge">GIF</div>
                <button type="button" class="sidepeek-remove-img-btn" title="✕">✕</button>
              </div>
            `;
            previewArea.querySelector(".sidepeek-remove-img-btn")?.addEventListener("click", () => {
              previewArea.innerHTML = "";
              pastedMediaId = null;
              pastedBlob = null;
              updateComposerState();
            });

            try {
              submitBtn.disabled = true;
              submitBtn.textContent = t("processingGif");
              const resp = await fetch(gifUrl);
              const blob = await resp.blob();
              pastedBlob = blob;
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(",")[1];
                try {
                  submitBtn.textContent = t("uploading");
                  const res = await requestPage("UPLOAD_MEDIA", { base64, mimeType: "image/gif", size: blob.size });
                  pastedMediaId = res.mediaId;
                } catch (err) {
                  showToast(err.message || t("gifUploadFailed"));
                  previewArea.innerHTML = "";
                  pastedMediaId = null;
                } finally {
                  submitBtn.textContent = t("replyBtn");
                  updateComposerState();
                }
              };
              reader.readAsDataURL(blob);
            } catch {
              showToast(t("gifUploadFailed"));
              submitBtn.textContent = t("replyBtn");
              updateComposerState();
            }
          });
        });
      }
      renderGifPopover();

      btnGif?.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePopover(gifPopover, btnGif);
      });
    }

    // =========================================================================
    // 3. Poll Popover
    // =========================================================================
    if (pollPopover) {
      function renderPollPopover() {
        pollPopover.innerHTML = `
          <div class="sidepeek-popover-header">
            <span class="sidepeek-popover-title">${t("pollTitle")}</span>
            <button type="button" class="sidepeek-popover-close" title="✕">✕</button>
          </div>
          <div class="sidepeek-poll-body">
            <input type="text" class="sidepeek-poll-input" id="sp-poll-opt1" placeholder="${t("pollOpt1Placeholder")}" maxlength="25" />
            <input type="text" class="sidepeek-poll-input" id="sp-poll-opt2" placeholder="${t("pollOpt2Placeholder")}" maxlength="25" />
            <input type="text" class="sidepeek-poll-input" id="sp-poll-opt3" placeholder="${t("pollOpt3Placeholder")}" maxlength="25" />
            <input type="text" class="sidepeek-poll-input" id="sp-poll-opt4" placeholder="${t("pollOpt4Placeholder")}" maxlength="25" />
            <div class="sidepeek-poll-footer">
              <label>${t("pollDurationLabel")}
                <select class="sidepeek-poll-duration">
                  <option value="1">${t("pollDay1")}</option>
                  <option value="3">${t("pollDay3")}</option>
                  <option value="7">${t("pollDay7")}</option>
                </select>
              </label>
              <div class="sidepeek-poll-btns">
                <button type="button" class="sidepeek-poll-btn-clear">${t("pollClear")}</button>
                <button type="button" class="sidepeek-poll-btn-apply">${t("pollApply")}</button>
              </div>
            </div>
          </div>
        `;

        pollPopover.querySelector(".sidepeek-popover-close")?.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAllPopovers();
        });

        pollPopover.querySelector(".sidepeek-poll-btn-clear")?.addEventListener("click", (e) => {
          e.stopPropagation();
          activePoll = null;
          updatePollBadge();
          closeAllPopovers();
        });

        pollPopover.querySelector(".sidepeek-poll-btn-apply")?.addEventListener("click", (e) => {
          e.stopPropagation();
          const opt1 = pollPopover.querySelector("#sp-poll-opt1")?.value.trim();
          const opt2 = pollPopover.querySelector("#sp-poll-opt2")?.value.trim();
          const opt3 = pollPopover.querySelector("#sp-poll-opt3")?.value.trim();
          const opt4 = pollPopover.querySelector("#sp-poll-opt4")?.value.trim();
          const duration = pollPopover.querySelector(".sidepeek-poll-duration")?.value;

          if (!opt1 || !opt2) {
            showToast(t("pollValidation"));
            return;
          }
          const options = [opt1, opt2];
          if (opt3) options.push(opt3);
          if (opt4) options.push(opt4);

          activePoll = { options, duration };
          updatePollBadge();
          closeAllPopovers();
          showToast(t("pollAddedToast"));
          updateComposerState();
        });
      }

      function updatePollBadge() {
        const existing = previewArea.querySelector(".sidepeek-poll-badge");
        if (existing) existing.remove();
        if (activePoll) {
          const badge = document.createElement("div");
          badge.className = "sidepeek-composer-tag sidepeek-poll-badge";
          badge.innerHTML = `
            <span>${t("pollBadge", { count: activePoll.options.length, days: activePoll.duration })}</span>
            <button type="button" class="sidepeek-tag-remove" title="${t("deletePoll")}">✕</button>
          `;
          badge.querySelector(".sidepeek-tag-remove")?.addEventListener("click", () => {
            activePoll = null;
            badge.remove();
            updateComposerState();
          });
          previewArea.appendChild(badge);
        }
      }

      renderPollPopover();

      btnPoll?.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePopover(pollPopover, btnPoll);
      });
    }

    // =========================================================================
    // 4. Schedule Popover
    // =========================================================================
    if (schedulePopover) {
      function renderSchedulePopover() {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 10);
        const defaultTime = now.toISOString().slice(0, 16);

        schedulePopover.innerHTML = `
          <div class="sidepeek-popover-header">
            <span class="sidepeek-popover-title">${t("scheduleTitle")}</span>
            <button type="button" class="sidepeek-popover-close" title="✕">✕</button>
          </div>
          <div class="sidepeek-schedule-body">
            <label class="sidepeek-schedule-label">${t("scheduleLabel")}</label>
            <input type="datetime-local" class="sidepeek-schedule-input" value="${defaultTime}" />
            <div class="sidepeek-schedule-footer">
              <button type="button" class="sidepeek-schedule-btn-clear">${t("scheduleClear")}</button>
              <button type="button" class="sidepeek-schedule-btn-apply">${t("scheduleApply")}</button>
            </div>
          </div>
        `;

        schedulePopover.querySelector(".sidepeek-popover-close")?.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAllPopovers();
        });

        schedulePopover.querySelector(".sidepeek-schedule-btn-clear")?.addEventListener("click", (e) => {
          e.stopPropagation();
          activeSchedule = null;
          updateScheduleBadge();
          closeAllPopovers();
        });

        schedulePopover.querySelector(".sidepeek-schedule-btn-apply")?.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = schedulePopover.querySelector(".sidepeek-schedule-input")?.value;
          if (!val) return;
          activeSchedule = val;
          updateScheduleBadge();
          closeAllPopovers();
          showToast(t("scheduleSetToast", { time: val.replace("T", " ") }));
          updateComposerState();
        });
      }

      function updateScheduleBadge() {
        const existing = previewArea.querySelector(".sidepeek-schedule-badge");
        if (existing) existing.remove();
        if (activeSchedule) {
          const badge = document.createElement("div");
          badge.className = "sidepeek-composer-tag sidepeek-schedule-badge";
          badge.innerHTML = `
            <span>${t("scheduleBadge", { time: activeSchedule.replace("T", " ") })}</span>
            <button type="button" class="sidepeek-tag-remove" title="${t("cancelSchedule")}">✕</button>
          `;
          badge.querySelector(".sidepeek-tag-remove")?.addEventListener("click", () => {
            activeSchedule = null;
            badge.remove();
            updateComposerState();
          });
          previewArea.appendChild(badge);
        }
      }

      renderSchedulePopover();

      btnSchedule?.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePopover(schedulePopover, btnSchedule);
      });
    }

    // =========================================================================
    // 5. Location Button
    // =========================================================================
    btnLocation?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopovers();
      if (activeLocation) {
        activeLocation = null;
        previewArea.querySelector(".sidepeek-location-badge")?.remove();
        showToast(t("locationClearedToast"));
      } else {
        activeLocation = "current";
        const badge = document.createElement("div");
        badge.className = "sidepeek-composer-tag sidepeek-location-badge";
        badge.innerHTML = `
          <span>${t("locationBadge")}</span>
          <button type="button" class="sidepeek-tag-remove" title="${t("deleteLocation")}">✕</button>
        `;
        badge.querySelector(".sidepeek-tag-remove")?.addEventListener("click", () => {
          activeLocation = null;
          badge.remove();
          updateComposerState();
        });
        previewArea.appendChild(badge);
        showToast(t("locationAttachedToast"));
      }
      updateComposerState();
    });

    // =========================================================================
    // 6. Media Upload & Paste Image
    // =========================================================================
    function handleImageFile(file) {
      if (!file || !file.type.startsWith("image/")) return;
      pastedBlob = file;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(",")[1];

        previewArea.innerHTML = `
          <div class="sidepeek-pasted-preview">
            <img src="${dataUrl}" alt="" />
            <button type="button" class="sidepeek-remove-img-btn" title="✕">✕</button>
          </div>
        `;
        previewArea.querySelector(".sidepeek-remove-img-btn")?.addEventListener("click", () => {
          previewArea.innerHTML = "";
          pastedMediaId = null;
          pastedBlob = null;
          updateComposerState();
        });

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = t("uploading");
          const res = await requestPage("UPLOAD_MEDIA", { base64, mimeType: file.type, size: file.size });
          pastedMediaId = res.mediaId;
        } catch (err) {
          showToast(err.message || t("uploadFailed"));
          previewArea.innerHTML = "";
          pastedMediaId = null;
        } finally {
          submitBtn.textContent = t("replyBtn");
          updateComposerState();
        }
      };
      reader.readAsDataURL(file);
    }

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
      fileInput.value = "";
    });

    textarea?.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleImageFile(file);
          break;
        }
      }
    });

    // =========================================================================
    // 7. Submit Reply: Optimistic In-Place Append (无刷新直接添加到回复)
    // =========================================================================
    async function doSubmit() {
      const text = textarea.value.trim();
      const len = calculateTweetLength(text);
      if (len > 280) {
        showToast(t("overCharLimit"));
        return;
      }
      if (!text && !pastedMediaId && !activePoll) return;

      submitBtn.disabled = true;
      submitBtn.textContent = t("sending");

      // Safety check: ensure repliedModel belongs to current conversation tree or focal tweet
      let repliedModel = state.replyTarget;
      if (repliedModel && state.tree && !state.tree.byId.has(repliedModel.id) && repliedModel.id !== state.focalTweetId) {
        repliedModel = null;
        state.replyTarget = null;
      }
      const effectiveTargetId = repliedModel ? repliedModel.id : (isDrillDown && drillDownParent ? drillDownParent.id : state.focalTweetId);

      try {
        let finalText = text;
        if (activePoll) {
          finalText += `\n[${t("pollTitle")}: ${activePoll.options.join(" / ")}]`;
        }

        const mediaIds = pastedMediaId ? [pastedMediaId] : [];
        await requestPage("CREATE_REPLY", {
          tweetId: effectiveTargetId,
          text: finalText,
          mediaIds
        });

        // 1. Snapshot user info & media preview before clearing
        const currentUser = getCurrentUserInfo();
        const mediaSnapshot = pastedBlob ? [{ type: "photo", url: previewArea.querySelector("img")?.src || "" }] : [];

        // 2. Reset composer inputs immediately
        textarea.value = "";
        previewArea.innerHTML = "";
        pastedMediaId = null;
        pastedBlob = null;
        activePoll = null;
        activeSchedule = null;
        activeLocation = null;
        state.replyTarget = null;
        if (replyTargetBox) replyTargetBox.style.display = "none";
        textarea.placeholder = isDrillDown
          ? t("replyToUser", { handle: drillDownParent?.author?.handle || (getLocale() === "zh" ? "此人" : "user") })
          : t("replyToAuthor", { handle: state.focalModel?.author?.handle || (getLocale() === "zh" ? "楼主" : "author") });
        submitBtn.textContent = t("replyBtn");
        updateComposerState();
        closeAllPopovers();

        // 3. Create Optimistic Comment Model
        const optimisticId = `local-${Date.now()}`;
        const newReplyModel = {
          id: optimisticId,
          text: finalText,
          createdAt: new Date().toISOString(),
          author: {
            name: currentUser.name,
            handle: currentUser.handle,
            avatar: currentUser.avatar,
            verified: false
          },
          inReplyToHandle: repliedModel ? repliedModel.author.handle : (isDrillDown && drillDownParent ? drillDownParent.author.handle : state.focalModel?.author?.handle || ""),
          counts: { replies: 0, reposts: 0, likes: 0, bookmarks: 0 },
          flags: { liked: false, reposted: false, bookmarked: false },
          media: mediaSnapshot,
          url: ""
        };

        // 4. In-place DOM Insertion without any full-drawer loading/clearing!
        const body = root.querySelector(".sidepeek-body");
        if (body) {
          // If body currently displays "No replies yet", clear it!
          const emptyBox = body.querySelector(".sidepeek-empty-box");
          if (emptyBox) emptyBox.remove();

          if (repliedModel) {
            // Replying to a specific comment: add as child
            if (!state.tree.childrenMap.has(repliedModel.id)) {
              state.tree.childrenMap.set(repliedModel.id, []);
            }
            state.tree.childrenMap.get(repliedModel.id).push(newReplyModel);
            state.tree.byId.set(newReplyModel.id, newReplyModel);

            // Update reply count on replied comment
            repliedModel.counts.replies = (repliedModel.counts.replies || 0) + 1;
            const targetArticle = body.querySelector(`article[data-id="${repliedModel.id}"]`);
            if (targetArticle) {
              const replyCountSpan = targetArticle.querySelector(".sidepeek-act-reply span span");
              if (replyCountSpan) replyCountSpan.textContent = formatCount(repliedModel.counts.replies);
            }

            const node = renderCommentNode(newReplyModel, false, true);
            node.classList.add("sidepeek-just-posted");

            const threadGroup = targetArticle?.closest(".sidepeek-thread-group");
            if (threadGroup) {
              threadGroup.appendChild(node);
            } else if (targetArticle && targetArticle.parentNode) {
              targetArticle.parentNode.insertBefore(node, targetArticle.nextSibling);
            } else {
              body.appendChild(node);
            }
            node.scrollIntoView({ behavior: "smooth", block: "nearest" });
          } else if (isDrillDown && drillDownParent) {
            // Append to drilldown list
            if (!state.tree.childrenMap.has(drillDownParent.id)) {
              state.tree.childrenMap.set(drillDownParent.id, []);
            }
            state.tree.childrenMap.get(drillDownParent.id).push(newReplyModel);
            state.tree.byId.set(newReplyModel.id, newReplyModel);

            const node = renderCommentNode(newReplyModel, false, true);
            node.classList.add("sidepeek-just-posted");
            body.appendChild(node);
            node.scrollIntoView({ behavior: "smooth", block: "nearest" });

            const badge = root.querySelector(".sidepeek-count-badge");
            if (badge) {
              const count = state.tree.childrenMap.get(drillDownParent.id).length;
              badge.textContent = `(${count})`;
            }
          } else {
            // Prepend to root replies
            if (!state.tree) {
              state.tree = { rootReplies: [], childrenMap: new Map(), byId: new Map() };
            }
            state.tree.rootReplies.unshift(newReplyModel);
            state.tree.byId.set(newReplyModel.id, newReplyModel);

            const node = renderCommentNode(newReplyModel, false);
            node.classList.add("sidepeek-just-posted");
            body.prepend(node);
            body.scrollTo({ top: 0, behavior: "smooth" });

            const badge = root.querySelector(".sidepeek-count-badge");
            if (badge) {
              badge.textContent = `(${state.tree.rootReplies.length})`;
            }
          }
        }

        showToast(t("replySent"));
      } catch (err) {
        showToast(err.message || t("replyFailed"));
        submitBtn.disabled = false;
        submitBtn.textContent = t("replyBtn");
      }
    }

    submitBtn?.addEventListener("click", doSubmit);
    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doSubmit();
      }
    });

    updateComposerState();
  }

  // ==========================================================================
  // Action Handlers (Like, Repost, Bookmark, Share)
  // ==========================================================================
  async function handleToggleAction(model, action, btnElement) {
    const flag = action === "like" ? "liked" : action === "repost" ? "reposted" : "bookmarked";
    const countProp = action === "like" ? "likes" : action === "repost" ? "reposts" : "bookmarks";
    const wasActive = Boolean(model.flags[flag]);

    // Optimistic UI update
    model.flags[flag] = !wasActive;
    model.counts[countProp] = Math.max(0, model.counts[countProp] + (wasActive ? -1 : 1));

    btnElement.classList.toggle("active", model.flags[flag]);
    const iconSpan = btnElement.querySelector(".sidepeek-action-btn-surface");
    if (action === "like") {
      iconSpan.innerHTML = `${model.flags.liked ? ICONS.likeSolid : ICONS.like} <span>${formatCount(model.counts.likes)}</span>`;
    } else if (action === "repost") {
      iconSpan.innerHTML = `${ICONS.repost} <span>${formatCount(model.counts.reposts)}</span>`;
    } else if (action === "bookmark") {
      iconSpan.innerHTML = `${model.flags.bookmarked ? ICONS.bookmarkSolid : ICONS.bookmark}`;
    }

    try {
      await requestPage("TOGGLE_ACTION", {
        tweetId: model.id,
        action,
        active: wasActive
      });
    } catch {
      // Revert on failure
      model.flags[flag] = wasActive;
      model.counts[countProp] = Math.max(0, model.counts[countProp] + (wasActive ? 1 : -1));
      btnElement.classList.toggle("active", wasActive);
    }
  }

  function handleShare(model) {
    if (!model.url) return;
    navigator.clipboard.writeText(model.url).then(() => {
      showToast(t("linkCopied"));
    }).catch(() => {
      showToast(getLocale() === "zh" ? "复制链接失败" : "Failed to copy link");
    });
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
  async function fetchThread(tweetId) {
    state.loading = true;
    state.error = "";
    state.expandedThreadIds.clear();
    state.replyTarget = null;
    renderDrawer();

    try {
      const json = await requestPage("READ_THREAD", { tweetId });
      const { focal, replies } = Core.parseTweetDetail(json, tweetId);
      state.focalModel = focal;
      state.replies = replies;
      state.tree = Core.buildConversationTree(replies, tweetId);
      state.loading = false;
      renderDrawer();
    } catch (err) {
      state.loading = false;
      state.error = err.message || "读取评论失败，请重试";
      renderDrawer();
    }
  }

  let userClosedTweetId = null;
  let lastHandledDetailTweetId = null;
  let lastCheckedUrl = "";

  function findDetailFocalArticle(tweetId) {
    if (!tweetId) return null;
    // Look for tweet article that contains link to this status
    const matching = document.querySelector(`article[data-testid="tweet"] a[href*="/status/${tweetId}"]`)?.closest('article[data-testid="tweet"]');
    if (matching) return matching;
    // Or the primary tweet article on the detail page
    return document.querySelector('article[data-testid="tweet"]');
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

      // 无论右侧是否出流，主栏长文都原位秒展开
      expandFocalShowMore(tweetId);

      // 静默拉取评论流：仅当确实存在下一级回复时才优雅滑出右侧栏，彻底杜绝零回复时的“弹出来又关闭”闪烁
      try {
        const json = await requestPage("READ_THREAD", { tweetId });
        // 确保异步返回时用户没有跳转到其他帖子
        if (Core.postIdFromUrl(location.href) !== tweetId) return;
        if (userClosedTweetId === tweetId) return;

        const { focal, replies } = Core.parseTweetDetail(json, tweetId);

        // 如果完全没有下一级回复，绝对不弹出右侧抽屉，保持完全静默
        if (!replies || replies.length === 0) {
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

        state.open = true;
        state.focalTweetId = tweetId;
        state.focalModel = focal;
        state.replies = replies;
        state.tree = Core.buildConversationTree(replies, tweetId);
        state.activeView = "root";
        state.replyTarget = null;
        state.loading = false;
        state.error = "";
        renderDrawer();
      } catch (err) {
        // 静默处理，避免在详情页异常弹窗
      }
    } else {
      // Navigated away from a detail page (e.g. back to /home, /explore)
      userClosedTweetId = null;
      state.replyTarget = null;
      if (lastHandledDetailTweetId) {
        lastHandledDetailTweetId = null;
        if (state.open) {
          closeDrawer();
        }
      }
    }
  }

  function openDrawerForTweet(tweetId, articleNode) {
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
    state.activeView = "root";
    state.replyTarget = null;
    renderDrawer();
    fetchThread(tweetId);
  }

  function closeDrawer() {
    state.open = false;
    state.replyTarget = null;
    userClosedTweetId = state.focalTweetId;
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

    // 在通知页面中，如果是没有下一级回复的最新评论，不要拦截弹侧栏，让原生逻辑跳转到原回复贴
    const isNotificationsPage = location.pathname.startsWith("/notifications");
    if (isNotificationsPage) {
      const replyCount = getArticleReplyCount(article);
      if (replyCount === 0) {
        return;
      }
    }

    if (shouldSkipClick(event.target, article)) return;

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

  // ESC key to close (Lightbox first, then Drawer)
  document.addEventListener("keydown", (event) => {
    if (!isSideXEnabled) return;
    if (event.key === "Escape") {
      const lightbox = document.getElementById("sidepeek-lightbox");
      if (lightbox && lightbox.classList.contains("active")) {
        closeLightbox();
        return;
      }
      if (state.open) {
        closeDrawer();
      }
    }
  });

  // URL Watcher: detect SPA transitions, Back/Forward navigation, and auto-open on detail pages
  window.addEventListener("popstate", checkDetailPageAutoOpen);
  window.addEventListener("hashchange", checkDetailPageAutoOpen);
  setInterval(checkDetailPageAutoOpen, 300);

  // Initial check on load
  checkDetailPageAutoOpen();
})();
