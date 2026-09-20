(function initSidePeek() {
  "use strict";

  if (window.top !== window.self) return;

  const Core = globalThis.SidePeekCore;
  const ROOT_ID = "sidepeek-drawer-root";
  const CONTENT_SOURCE = "sidepeek-content";
  const PAGE_SOURCE = "sidepeek-page";

  // SVG Icons (Official Twitter SVGs matching original composer)
  const ICONS = {
    reply: `<svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>`,
    repost: `<svg viewBox="0 0 256 256"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>`,
    like: `<svg viewBox="0 0 256 256"><path d="M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z"/></svg>`,
    likeSolid: `<svg viewBox="0 0 256 256"><path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"/></svg>`,
    bookmark: `<svg viewBox="0 0 256 256"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,177.57-51.77-32.35a8,8,0,0,0-8.48,0L72,209.57V48H184Z"/></svg>`,
    bookmarkSolid: `<svg viewBox="0 0 256 256"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Z"/></svg>`,
    share: `<svg viewBox="0 0 256 256"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z"/></svg>`,
    close: `<svg viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>`,
    back: `<svg viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>`,
    external: `<svg viewBox="0 0 256 256"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"/></svg>`,
    resetWidth: `<svg viewBox="0 0 256 256"><path d="M224,128a96,96,0,1,1-21.84-60.61L224,48v48H176l18.53-18.53A80,80,0,1,0,207.82,136H224A95.54,95.54,0,0,1,224,128Z"/></svg>`,
    user: `<svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM128,120a40,40,0,1,1,40-40A40,40,0,0,1,128,120Zm65.2,66.19a79.89,79.89,0,0,0-36.06-28.74,56,56,0,1,0-58.28,0,79.89,79.89,0,0,0-36.06,28.74,88,88,0,1,1,130.4,0Z"/></svg>`,
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
    activeComposerReplyId: null,
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

    const isDrillDown = state.activeView && typeof state.activeView === "object" && state.activeView.type === "drilldown";
    const drillDownParent = isDrillDown ? state.tree?.byId.get(state.activeView.parentId) : null;
    const userAvatar = getCurrentUserAvatar();
    const replyPlaceholder = isDrillDown
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
          <button type="button" class="sidepeek-icon-btn sidepeek-btn-lang" title="${getLocale() === 'zh' ? 'Switch to English' : '切换为中文'}"><span style="font-size: 11px; font-weight: 700; line-height: 1;">${getLocale() === 'zh' ? 'EN' : '中'}</span></button>
          <button type="button" class="sidepeek-icon-btn sidepeek-btn-reset-width" title="${t("resetWidth")}">${ICONS.resetWidth}</button>
          ${state.focalModel?.url ? `<a href="${state.focalModel.url}" target="_blank" class="sidepeek-icon-btn" title="${t("openOnX")}">${ICONS.external}</a>` : ""}
          <button type="button" class="sidepeek-icon-btn sidepeek-btn-close" aria-label="${t("closeSidebar")}">${ICONS.close}</button>
        </div>
      </header>
      <div class="sidepeek-body"></div>
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
    initFooterComposer(root, isDrillDown, drillDownParent);

    // Event listeners on header
    root.querySelector(".sidepeek-btn-lang")?.addEventListener("click", () => {
      const nextLang = getLocale() === "zh" ? "en" : "zh";
      overrideLocale = nextLang;
      if (storage) storage.set({ sidex_lang: nextLang });
      renderDrawer();
      showToast(nextLang === "zh" ? "已切换为中文" : "Switched to English");
    });
    root.querySelector(".sidepeek-btn-close")?.addEventListener("click", closeDrawer);
    if (isDrillDown) {
      root.querySelector(".sidepeek-back-btn")?.addEventListener("click", () => {
        state.activeView = "root";
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

  function renderCommentNode(model, hasThreadLine = false, isChild = false) {
    const item = document.createElement("article");
    item.className = `sidepeek-comment-item${isChild ? " sidepeek-child-comment" : ""}`;
    item.dataset.id = model.id;

    item.innerHTML = `
      <div class="sidepeek-avatar-col">
        <img class="sidepeek-avatar" src="${model.author.avatar}" alt="${model.author.name}" />
        ${hasThreadLine ? '<div class="sidepeek-thread-line"></div>' : ""}
      </div>
      <div class="sidepeek-content-col">
        <div class="sidepeek-author-row">
          <a class="sidepeek-name" href="https://x.com/${model.author.handle}" target="_blank">${model.author.name}</a>
          ${model.author.verified ? `<span class="sidepeek-verified-badge">✓</span>` : ""}
          <span class="sidepeek-handle">@${model.author.handle}</span>
          <span class="sidepeek-dot">·</span>
          <a class="sidepeek-time" href="${model.url}" target="_blank">${formatTime(model.createdAt)}</a>
        </div>
        ${model.inReplyToHandle ? `<div class="sidepeek-reply-to-tag">${t("replyToTag")} <a href="https://x.com/${model.inReplyToHandle}" target="_blank">@${model.inReplyToHandle}</a></div>` : ""}
        <div class="sidepeek-text">${escapeHtml(model.text)}</div>
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
          <button type="button" class="sidepeek-action-btn sidepeek-act-bookmark ${model.flags.bookmarked ? "active" : ""}" title="${t("bookmarkAction")}">
            <span class="sidepeek-action-btn-surface">${model.flags.bookmarked ? ICONS.bookmarkSolid : ICONS.bookmark}</span>
          </button>
          <button type="button" class="sidepeek-action-btn sidepeek-act-share" title="${t("shareAction")}">
            <span class="sidepeek-action-btn-surface">${ICONS.share}</span>
          </button>
        </div>
        <!-- Inline Accordion Composer Container -->
        <div class="sidepeek-inline-composer" id="composer-${model.id}"></div>
      </div>
    `;

    // Drilldown click
    item.querySelector(".sidepeek-drilldown-trigger")?.addEventListener("click", () => {
      state.activeView = { type: "drilldown", parentId: model.id };
      renderDrawer();
    });

    // Action handlers
    const actReply = item.querySelector(".sidepeek-act-reply");
    const actRepost = item.querySelector(".sidepeek-act-repost");
    const actLike = item.querySelector(".sidepeek-act-like");
    const actBookmark = item.querySelector(".sidepeek-act-bookmark");
    const actShare = item.querySelector(".sidepeek-act-share");

    actReply?.addEventListener("click", () => toggleInlineComposer(model));
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

    // If composer is active for this item
    if (state.activeComposerReplyId === model.id) {
      renderInlineComposer(item.querySelector(`#composer-${model.id}`), model);
    }

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
  // Inline Accordion Composer & Paste Image Upload
  // ==========================================================================
  function toggleInlineComposer(model) {
    if (state.activeComposerReplyId === model.id) {
      state.activeComposerReplyId = null;
    } else {
      state.activeComposerReplyId = model.id;
    }
    renderDrawer();
  }

  function renderInlineComposer(container, targetModel) {
    if (!container) return;
    container.classList.add("expanded");

    let pastedMediaId = null;
    let pastedBlob = null;

    container.innerHTML = `
      <div class="sidepeek-composer-inner">
        <textarea class="sidepeek-composer-textarea" placeholder="${t("replyToWithPaste", { handle: targetModel.author.handle })}"></textarea>
        <div class="sidepeek-composer-preview-area"></div>
        <div class="sidepeek-composer-footer">
          <span class="sidepeek-composer-hint">${t("ctrlEnterHint")}</span>
          <div class="sidepeek-composer-btns">
            <button type="button" class="sidepeek-btn-cancel">${t("cancelBtn")}</button>
            <button type="button" class="sidepeek-btn-submit">${t("sendBtn")}</button>
          </div>
        </div>
      </div>
    `;

    const textarea = container.querySelector(".sidepeek-composer-textarea");
    const previewArea = container.querySelector(".sidepeek-composer-preview-area");
    const cancelBtn = container.querySelector(".sidepeek-btn-cancel");
    const submitBtn = container.querySelector(".sidepeek-btn-submit");

    textarea.focus();

    cancelBtn.addEventListener("click", () => {
      container.classList.remove("expanded");
      state.activeComposerReplyId = null;
    });

    // Paste Image listener
    textarea.addEventListener("paste", async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          pastedBlob = file;
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result;
            const base64 = dataUrl.split(",")[1];

            // Render thumbnail preview immediately
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
            });

            // Upload via page-bridge in background
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
              submitBtn.disabled = false;
              submitBtn.textContent = t("sendBtn");
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    });

    // Submit handler: Optimistic In-Place Append (无刷新直接添加到回复)
    async function doSubmit() {
      const text = textarea.value.trim();
      if (!text && !pastedMediaId) return;

      submitBtn.disabled = true;
      submitBtn.textContent = t("sending");

      try {
        const mediaIds = pastedMediaId ? [pastedMediaId] : [];
        await requestPage("CREATE_REPLY", {
          tweetId: targetModel.id,
          text,
          mediaIds
        });

        const currentUser = getCurrentUserInfo();
        const mediaSnapshot = pastedBlob ? [{ type: "photo", url: previewArea.querySelector("img")?.src || "" }] : [];

        // Close inline composer immediately
        container.classList.remove("expanded");
        state.activeComposerReplyId = null;
        container.innerHTML = "";

        // Create Optimistic Comment Model
        const optimisticId = `local-${Date.now()}`;
        const newReplyModel = {
          id: optimisticId,
          text,
          createdAt: new Date().toISOString(),
          author: {
            name: currentUser.name,
            handle: currentUser.handle,
            avatar: currentUser.avatar,
            verified: false
          },
          inReplyToHandle: targetModel.author.handle,
          counts: { replies: 0, reposts: 0, likes: 0, bookmarks: 0 },
          flags: { liked: false, reposted: false, bookmarked: false },
          media: mediaSnapshot,
          url: ""
        };

        // Add to state tree
        if (!state.tree.childrenMap.has(targetModel.id)) {
          state.tree.childrenMap.set(targetModel.id, []);
        }
        state.tree.childrenMap.get(targetModel.id).push(newReplyModel);
        state.tree.byId.set(newReplyModel.id, newReplyModel);

        // Update targetModel reply count
        targetModel.counts.replies = (targetModel.counts.replies || 0) + 1;
        const parentArticle = container.closest(".sidepeek-comment-item");
        if (parentArticle) {
          const replyCountSpan = parentArticle.querySelector(".sidepeek-act-reply span span");
          if (replyCountSpan) replyCountSpan.textContent = formatCount(targetModel.counts.replies);
        }

        // Render child comment node
        const childNode = renderCommentNode(newReplyModel, false, true);
        childNode.classList.add("sidepeek-just-posted");

        // Insert into DOM
        const threadGroup = parentArticle?.closest(".sidepeek-thread-group");
        if (threadGroup) {
          threadGroup.appendChild(childNode);
        } else if (parentArticle && parentArticle.parentNode) {
          parentArticle.parentNode.insertBefore(childNode, parentArticle.nextSibling);
        }

        childNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
        showToast(t("replySent"));
      } catch (err) {
        showToast(err.message || t("replyFailed"));
        submitBtn.disabled = false;
        submitBtn.textContent = t("sendBtn");
      }
    }

    submitBtn.addEventListener("click", doSubmit);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doSubmit();
      }
    });
  }

  function initFooterComposer(root, isDrillDown, drillDownParent) {
    const footer = root.querySelector(".sidepeek-footer-composer");
    if (!footer) return;

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

      try {
        let finalText = text;
        if (activePoll) {
          finalText += `\n[${t("pollTitle")}: ${activePoll.options.join(" / ")}]`;
        }

        const mediaIds = pastedMediaId ? [pastedMediaId] : [];
        await requestPage("CREATE_REPLY", {
          tweetId: targetTweetId,
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
          inReplyToHandle: isDrillDown && drillDownParent ? drillDownParent.author.handle : state.focalModel?.author?.handle || "",
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

          if (isDrillDown && drillDownParent) {
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

  function openDrawerForTweet(tweetId, articleNode) {
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
    state.activeComposerReplyId = null;
    renderDrawer();
    fetchThread(tweetId);
  }

  function closeDrawer() {
    state.open = false;
    if (state.focalArticle) {
      state.focalArticle.classList.remove("sidepeek-focal-active");
      state.focalArticle = null;
    }
    renderDrawer();
  }

  function shouldSkipClick(target) {
    return Boolean(
      target.closest("a[href]") ||
      target.closest("button") ||
      target.closest('[role="button"]') ||
      target.closest("video") ||
      target.closest("audio") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest('[data-testid="like"]') ||
      target.closest('[data-testid="retweet"]') ||
      target.closest('[data-testid="reply"]') ||
      target.closest('[data-testid="bookmark"]') ||
      target.closest('[data-testid="tweet-text-show-more-link"]')
    );
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

    if (shouldSkipClick(event.target)) return;

    // Find tweet URL & ID
    const hrefs = [...article.querySelectorAll('a[href*="/status/"]')].map(a => a.getAttribute("href"));
    const ownUrl = Core.selectOwnPostUrl(hrefs, null, location.href);
    const tweetId = ownUrl ? Core.postIdFromUrl(ownUrl) : null;

    if (!tweetId) return;

    // Prevent default navigation to detail page!
    event.preventDefault();
    event.stopImmediatePropagation();

    openDrawerForTweet(tweetId, article);
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
})();
