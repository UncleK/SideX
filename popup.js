(function initSideXPopup() {
  "use strict";

  const autoExpandInput = document.getElementById("sidex-auto-expand-text");
  const autoLoadInput = document.getElementById("sidex-auto-load-input");
  const toggleInput = document.getElementById("sidex-toggle-input");
  const switchTitle = document.getElementById("txt-switch-title");
  const switchDesc = document.getElementById("txt-switch-desc");
  const replyModeLabel = document.getElementById("txt-reply-mode-label");
  const autoPinInput = document.getElementById("sidex-auto-pin");
  const autoPinLabel = document.getElementById("txt-auto-pin-label");
  const autoPinHint = document.getElementById("txt-auto-pin-hint");
  const replyModeGroup = document.getElementById("sidex-reply-mode-group");
  const photoModeGroup = document.getElementById("sidex-photo-mode-group");
  const subReplyLimitLabel = document.getElementById("txt-subreply-limit-label");
  const limitGroup = document.getElementById("sidex-limit-group");
  const resetLabel = document.getElementById("txt-reset-label");
  const resetBtn = document.getElementById("btn-reset-defaults");
  const resetBtnText = document.getElementById("txt-reset-btn");
  const hintEsc = document.getElementById("txt-hint-esc");
  const langGroup = document.getElementById("sidex-lang-group");
  const versionBadge = document.getElementById("sidex-version-badge");
  const translationSelect = document.getElementById("sidex-translation-provider");
  const DEFAULT_SETTINGS = Object.freeze({ sidex_enabled: true, sidex_auto_load_replies: true,
    sidex_auto_expand_reply_text: true, sidex_lang: null, sidex_sub_reply_limit: 1,
    sidex_reply_mode: "drawer", sidex_photo_mode: "sidex", sidex_translation_provider: "x", sidex_auto_pin: false });

  // Dynamically sync version from manifest
  try {
    const manifestVer = chrome?.runtime?.getManifest?.()?.version;
    if (manifestVer && versionBadge) {
      versionBadge.textContent = `v${manifestVer}`;
    }
  } catch (e) {}

  const STRINGS = {
    zh: {
      readingTitle: "评论阅读",
      moreSettingsTitle: "更多设置",
      moreSettingsHint: "回复方式、图片、翻译与侧栏",
      refreshNotice: "请刷新 X 生效",
      autoExpandTitle: "完整显示回复长文",
      autoExpandDesc: "侧栏长回复直接显示全文，无需点“显示更多”。",
      autoLoadTitle: "滚动到底继续加载评论",
      autoLoadDesc: "靠近底部时加载下一页一级评论；手动加载后暂停。",
      enabledTitle: "插件已启用",
      enabledDesc: "点击推文原地展开评论流",
      disabledTitle: "插件已停用",
      disabledDesc: "已恢复 X 原生跳转与浏览行为",
      replyModeLabel: "回复模式",
      autoPinLabel: "侧栏默认保持打开",
      autoPinHint: "新侧栏默认固定，点击页面空白或按 Esc 不会关闭。",
      replyModeDrawer: "快捷回复",
      replyModeNative: "官方弹窗",
      photoModeLabel: "图片评论区",
      photoModeNative: "官方样式",
      photoModeSideX: "SideX 样式",
      photoModeHint: "打开图片时，选择右侧使用官方评论区或 SideX。切换立即生效。",
      replyModeHints: { drawer: "点击评论的回复图标，在侧栏底部快捷回复。", native: "点击评论的回复图标，直接打开当前页的 X 官方回复框。" },
      translationLabel: "翻译方式",
      translationNative: "X 官方",
      translationExternal: "已有翻译插件",
      translationHints: {
        x: "使用 X 当前的官方翻译服务。",
        google: "点击翻译时将正文发送给 Google；免费接口可能限流。",
        external: "保留正文，隐藏 SideX 翻译按钮。请使用已有插件的划词或网页翻译。"
      },
      subReplyLimitLabel: "默认展开回复数",
      subReplyLimitHint: "每条评论下先显示 {limit} 条回复；首次再加载 {batch} 条，共 {total} 条；再次展开全部。作者连续自回复保持完整。",
      resetLabel: "默认设置",
      resetBtn: "全部恢复",
      resetDone: "已全部恢复",
      resetHint: "恢复所有选项和侧栏宽度，语言跟随浏览器；保留回复草稿。",
      hintEsc: "关闭抽屉或大图"
    },
    en: {
      readingTitle: "Reading comments",
      moreSettingsTitle: "More settings",
      moreSettingsHint: "Reply tools, photos, translation and sidebar",
      refreshNotice: "Refresh X to apply.",
      autoExpandTitle: "Show full reply text",
      autoExpandDesc: "Read long sidebar replies without clicking Show more.",
      autoLoadTitle: "Load comments as you scroll",
      autoLoadDesc: "Load the next page of top-level comments near the bottom. Pauses after a manual load.",
      enabledTitle: "Extension Enabled",
      enabledDesc: "Click tweets to open comment stream",
      disabledTitle: "Extension Paused",
      disabledDesc: "Native X navigation restored",
      replyModeLabel: "Reply Mode",
      autoPinLabel: "Keep new sidebars open",
      autoPinHint: "Pin new panels so outside clicks and Esc do not close them.",
      replyModeDrawer: "Quick reply",
      replyModeNative: "Official",
      photoModeLabel: "Photo comments",
      photoModeNative: "Official",
      photoModeSideX: "SideX",
      photoModeHint: "Choose the official or SideX comments on the right of the photo viewer. Changes apply immediately.",
      replyModeHints: { drawer: "Comment reply icons focus the quick composer in the sidebar.", native: "Comment reply icons open X's official reply dialog in this page." },
      translationLabel: "Translation",
      translationNative: "X official",
      translationExternal: "Your extension",
      translationHints: {
        x: "Use X's current official translation service.",
        google: "Send text to Google when you click Translate. The free endpoint may rate limit requests.",
        external: "Keep post text and hide SideX translation buttons. Use your extension's selection or page translation."
      },
      subReplyLimitLabel: "Sub-reply Preview",
      subReplyLimitHint: "Start with {limit} replies per comment. First click adds {batch}, up to {total} total; next click loads all. Author continuations stay visible.",
      resetLabel: "Default settings",
      resetBtn: "Reset all",
      resetDone: "Defaults restored",
      resetHint: "Reset all options and sidebar width, use your browser language, and keep reply drafts.",
      hintEsc: "Close drawer or lightbox"
    }
  };

  let currentLang = "zh";
  let isEnabled = true;
  let currentSubReplyLimit = 1;
  let currentReplyMode = "drawer";
  let currentPhotoMode = "sidex";
  let translationProvider = "x";

  function saveSettings(values) {
    storage?.set(values);
    document.querySelector(".sidex-refresh-notice").hidden = false;
  }

  function getSystemLang() {
    const nav = (navigator.language || "zh").toLowerCase();
    return nav.startsWith("zh") ? "zh" : "en";
  }

  function updateTexts() {
    const s = STRINGS[currentLang] || STRINGS.zh;
    document.getElementById("txt-reading-title").textContent = s.readingTitle;
    document.getElementById("txt-more-settings-title").textContent = s.moreSettingsTitle;
    document.getElementById("txt-more-settings-hint").textContent = s.moreSettingsHint;
    document.getElementById("txt-refresh-notice").textContent = s.refreshNotice;
    document.getElementById("txt-reset-hint").textContent = s.resetHint;
    document.getElementById("txt-auto-expand-title").textContent = s.autoExpandTitle;
    document.getElementById("txt-auto-expand-desc").textContent = s.autoExpandDesc;
    document.getElementById("txt-auto-load-title").textContent = s.autoLoadTitle;
    document.getElementById("txt-auto-load-desc").textContent = s.autoLoadDesc;
    if (isEnabled) {
      switchTitle.textContent = s.enabledTitle;
      switchTitle.style.color = "";
      switchDesc.textContent = s.enabledDesc;
    } else {
      switchTitle.textContent = s.disabledTitle;
      switchTitle.style.color = "var(--sidex-muted)";
      switchDesc.textContent = s.disabledDesc;
    }
    if (replyModeLabel) replyModeLabel.textContent = s.replyModeLabel;
    if (autoPinLabel) autoPinLabel.textContent = s.autoPinLabel;
    if (autoPinHint) autoPinHint.textContent = s.autoPinHint;
    const btnDrawer = document.getElementById("btn-mode-drawer");
    const btnNative = document.getElementById("btn-mode-native");
    if (btnDrawer) btnDrawer.textContent = s.replyModeDrawer;
    if (btnNative) btnNative.textContent = s.replyModeNative;
    updateReplyModeButtons(currentReplyMode);
    document.getElementById("txt-photo-mode-label").textContent = s.photoModeLabel;
    document.getElementById("btn-photo-native").textContent = s.photoModeNative;
    document.getElementById("btn-photo-sidex").textContent = s.photoModeSideX;
    document.getElementById("txt-photo-mode-hint").textContent = s.photoModeHint;
    updatePhotoModeButtons();

    if (subReplyLimitLabel) subReplyLimitLabel.textContent = s.subReplyLimitLabel;
    updateLimitButtons(currentSubReplyLimit);
    resetLabel.textContent = s.resetLabel;
    resetBtnText.textContent = s.resetBtn;
    hintEsc.textContent = s.hintEsc;
    document.getElementById("txt-translation-label").textContent = s.translationLabel;
    translationSelect.querySelector('[value="x"]').textContent = s.translationNative;
    translationSelect.querySelector('[value="external"]').textContent = s.translationExternal;
    translationSelect.value = translationProvider;
    document.getElementById("txt-translation-hint").textContent = s.translationHints[translationProvider];

    // Update active language button
    langGroup.querySelectorAll(".sidex-lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === currentLang);
    });
  }

  function updateLimitButtons(limit) {
    if (!limitGroup) return;
    limitGroup.querySelectorAll(".sidex-pill-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.limit) === Number(limit));
      btn.setAttribute("aria-pressed", String(Number(btn.dataset.limit) === Number(limit)));
    });
    const counts = { limit, batch: limit + 2, total: limit * 2 + 2 };
    document.getElementById("txt-subreply-limit-hint").textContent = (STRINGS[currentLang] || STRINGS.zh)
      .subReplyLimitHint.replace(/\{(limit|batch|total)\}/g, (_, key) => counts[key]);
  }

  function updateReplyModeButtons(mode) {
    if (!replyModeGroup) return;
    replyModeGroup.querySelectorAll(".sidex-pill-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
    });
    const hint = document.getElementById("txt-reply-mode-hint");
    if (hint) hint.textContent = (STRINGS[currentLang] || STRINGS.zh).replyModeHints[mode];
  }

  function updateBadge(enabled) {
    if (!chrome?.action?.setBadgeText) return;
    if (enabled) {
      chrome.action.setBadgeText({ text: "" });
    } else {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#71767b" });
    }
  }

  function updatePhotoModeButtons() {
    photoModeGroup.querySelectorAll(".sidex-pill-btn").forEach(btn => {
      const selected = btn.dataset.photoMode === currentPhotoMode;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", String(selected));
    });
  }

  photoModeGroup.addEventListener("click", event => {
    const mode = event.target.closest("[data-photo-mode]")?.dataset.photoMode;
    if (!["native", "sidex"].includes(mode) || mode === currentPhotoMode) return;
    currentPhotoMode = mode;
    saveSettings({ sidex_photo_mode: mode });
    updatePhotoModeButtons();
  });

  // Load saved settings
  const storage = chrome?.storage?.sync || chrome?.storage?.local;
  if (storage) {
    storage.get(DEFAULT_SETTINGS, (res) => {
      isEnabled = res.sidex_enabled !== false;
      currentLang = res.sidex_lang || getSystemLang();
      currentSubReplyLimit = Number(res.sidex_sub_reply_limit) || 1;
      currentReplyMode = res.sidex_reply_mode === "native" ? "native" : "drawer";
      currentPhotoMode = res.sidex_photo_mode === "native" ? "native" : "sidex";
      autoPinInput.checked = res.sidex_auto_pin === true;
      translationProvider = ["x", "google", "external"].includes(res.sidex_translation_provider) ? res.sidex_translation_provider : "x";
      toggleInput.checked = isEnabled;
      autoLoadInput.checked = res.sidex_auto_load_replies !== false;
      autoExpandInput.checked = res.sidex_auto_expand_reply_text !== false;
      updateTexts();
      updateBadge(isEnabled);
      updateLimitButtons(currentSubReplyLimit);
      updateReplyModeButtons(currentReplyMode);
    });
  } else {
    currentLang = getSystemLang();
    updateTexts();
    updateLimitButtons(currentSubReplyLimit);
    updateReplyModeButtons(currentReplyMode);
  }

  autoExpandInput.addEventListener("change", () => {
    saveSettings({ sidex_auto_expand_reply_text: autoExpandInput.checked });
  });

  autoLoadInput.addEventListener("change", () => {
    saveSettings({ sidex_auto_load_replies: autoLoadInput.checked });
  });

  // Toggle switch change handler
  translationSelect.addEventListener("change", () => {
    translationProvider = translationSelect.value;
    saveSettings({ sidex_translation_provider: translationProvider });
    updateTexts();
  });

  toggleInput.addEventListener("change", () => {
    isEnabled = toggleInput.checked;
    updateTexts();
    updateBadge(isEnabled);
    if (storage) {
      saveSettings({ sidex_enabled: isEnabled });
    }
  });

  autoPinInput?.addEventListener("change", () => {
    saveSettings({ sidex_auto_pin: autoPinInput.checked });
  });

  // Language switch buttons handler
  langGroup.addEventListener("click", (e) => {
    const btn = e.target.closest(".sidex-lang-btn");
    if (!btn) return;
    const lang = btn.dataset.lang;
    if (lang && lang !== currentLang) {
      currentLang = lang;
      updateTexts();
      if (storage) {
        saveSettings({ sidex_lang: currentLang });
      }
    }
  });

  // Reply mode pill buttons handler
  if (replyModeGroup) {
    replyModeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".sidex-pill-btn");
      if (!btn) return;
      const mode = btn.dataset.mode;
      if (mode && mode !== currentReplyMode) {
        currentReplyMode = mode;
        updateReplyModeButtons(currentReplyMode);
        if (storage) {
          saveSettings({ sidex_reply_mode: currentReplyMode });
        }
      }
    });
  }

  // Sub-reply limit pill buttons handler
  if (limitGroup) {
    limitGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".sidex-pill-btn");
      if (!btn) return;
      const limit = Number(btn.dataset.limit);
      if (limit && limit !== currentSubReplyLimit) {
        currentSubReplyLimit = limit;
        updateLimitButtons(currentSubReplyLimit);
        if (storage) {
          saveSettings({ sidex_sub_reply_limit: currentSubReplyLimit });
        }
      }
    });
  }

  // Restore every setting, while the content script retains text drafts.
  resetBtn.addEventListener("click", () => {
    saveSettings({ ...DEFAULT_SETTINGS, sidex_reset_defaults_trigger: Date.now() });
    isEnabled = true;
    currentLang = getSystemLang();
    currentSubReplyLimit = DEFAULT_SETTINGS.sidex_sub_reply_limit;
    currentReplyMode = DEFAULT_SETTINGS.sidex_reply_mode;
    currentPhotoMode = DEFAULT_SETTINGS.sidex_photo_mode;
    translationProvider = DEFAULT_SETTINGS.sidex_translation_provider;
    toggleInput.checked = true;
    autoLoadInput.checked = true;
    autoExpandInput.checked = true;
    autoPinInput.checked = false;
    updateTexts();
    updateBadge(true);
    const s = STRINGS[currentLang] || STRINGS.zh;
    resetBtnText.textContent = s.resetDone;
    setTimeout(() => {
      resetBtnText.textContent = s.resetBtn;
    }, 1200);
  });
})();
