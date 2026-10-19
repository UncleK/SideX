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
  const resetBtn = document.getElementById("btn-reset-width");
  const resetBtnText = document.getElementById("txt-reset-btn");
  const hintEsc = document.getElementById("txt-hint-esc");
  const langGroup = document.getElementById("sidex-lang-group");
  const versionBadge = document.getElementById("sidex-version-badge");
  const translationSelect = document.getElementById("sidex-translation-provider");

  // Dynamically sync version from manifest
  try {
    const manifestVer = chrome?.runtime?.getManifest?.()?.version;
    if (manifestVer && versionBadge) {
      versionBadge.textContent = `v${manifestVer}`;
    }
  } catch (e) {}

  const STRINGS = {
    zh: {
      autoExpandTitle: "自动展开回复正文",
      autoExpandDesc: "显示已加载的完整正文",
      autoLoadTitle: "自动加载更多评论",
      autoLoadDesc: "主列表自动加载，手动加载后暂停",
      enabledTitle: "插件已启用",
      enabledDesc: "点击推文原地展开评论流",
      disabledTitle: "插件已停用",
      disabledDesc: "已恢复 X 原生跳转与浏览行为",
      replyModeLabel: "回复模式",
      autoPinLabel: "打开面板时自动固定",
      autoPinHint: "自动固定新打开的侧栏",
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
      subReplyLimitLabel: "二级回复展示",
      resetLabel: "抽屉宽度",
      resetBtn: "恢复默认",
      resetDone: "已恢复！",
      hintEsc: "关闭抽屉或大图"
    },
    en: {
      autoExpandTitle: "Auto-expand reply text",
      autoExpandDesc: "Show the full loaded text",
      autoLoadTitle: "Auto-load more replies",
      autoLoadDesc: "Main list; pauses after a manual load",
      enabledTitle: "Extension Enabled",
      enabledDesc: "Click tweets to open comment stream",
      disabledTitle: "Extension Paused",
      disabledDesc: "Native X navigation restored",
      replyModeLabel: "Reply Mode",
      autoPinLabel: "Automatically pin new panels",
      autoPinHint: "Automatically pin new sidebars",
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
      resetLabel: "Drawer Width",
      resetBtn: "Reset",
      resetDone: "Restored!",
      hintEsc: "Close drawer or lightbox"
    }
  };

  let currentLang = "zh";
  let isEnabled = true;
  let currentSubReplyLimit = 1;
  let currentReplyMode = "drawer";
  let currentPhotoMode = "sidex";
  let translationProvider = "x";

  function getSystemLang() {
    const nav = (navigator.language || "zh").toLowerCase();
    return nav.startsWith("zh") ? "zh" : "en";
  }

  function updateTexts() {
    const s = STRINGS[currentLang] || STRINGS.zh;
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
    });
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
    storage?.set({ sidex_photo_mode: mode });
    updatePhotoModeButtons();
  });

  // Load saved settings
  const storage = chrome?.storage?.sync || chrome?.storage?.local;
  if (storage) {
    storage.get({ sidex_enabled: true, sidex_auto_load_replies: true, sidex_auto_expand_reply_text: false, sidex_lang: null, sidex_sub_reply_limit: 1, sidex_reply_mode: "drawer", sidex_photo_mode: "sidex", sidex_translation_provider: "x", sidex_auto_pin: false }, (res) => {
      isEnabled = res.sidex_enabled !== false;
      currentLang = res.sidex_lang || getSystemLang();
      currentSubReplyLimit = Number(res.sidex_sub_reply_limit) || 1;
      currentReplyMode = res.sidex_reply_mode === "native" ? "native" : "drawer";
      currentPhotoMode = res.sidex_photo_mode === "native" ? "native" : "sidex";
      autoPinInput.checked = res.sidex_auto_pin === true;
      translationProvider = ["x", "google", "external"].includes(res.sidex_translation_provider) ? res.sidex_translation_provider : "x";
      toggleInput.checked = isEnabled;
      autoLoadInput.checked = res.sidex_auto_load_replies !== false;
      autoExpandInput.checked = res.sidex_auto_expand_reply_text === true;
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
    storage?.set({ sidex_auto_expand_reply_text: autoExpandInput.checked });
  });

  autoLoadInput.addEventListener("change", () => {
    storage?.set({ sidex_auto_load_replies: autoLoadInput.checked });
  });

  // Toggle switch change handler
  translationSelect.addEventListener("change", () => {
    translationProvider = translationSelect.value;
    storage?.set({ sidex_translation_provider: translationProvider });
    updateTexts();
  });

  toggleInput.addEventListener("change", () => {
    isEnabled = toggleInput.checked;
    updateTexts();
    updateBadge(isEnabled);
    if (storage) {
      storage.set({ sidex_enabled: isEnabled });
    }
  });

  autoPinInput?.addEventListener("change", () => {
    storage?.set({ sidex_auto_pin: autoPinInput.checked });
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
        storage.set({ sidex_lang: currentLang });
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
          storage.set({ sidex_reply_mode: currentReplyMode });
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
          storage.set({ sidex_sub_reply_limit: currentSubReplyLimit });
        }
      }
    });
  }

  // Reset width button handler
  resetBtn.addEventListener("click", () => {
    if (storage) {
      storage.set({ sidex_reset_width_trigger: Date.now() });
    }
    const s = STRINGS[currentLang] || STRINGS.zh;
    resetBtnText.textContent = s.resetDone;
    setTimeout(() => {
      resetBtnText.textContent = s.resetBtn;
    }, 1200);
  });
})();
