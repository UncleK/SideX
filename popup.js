(function initSideXPopup() {
  "use strict";

  const toggleInput = document.getElementById("sidex-toggle-input");
  const switchTitle = document.getElementById("txt-switch-title");
  const switchDesc = document.getElementById("txt-switch-desc");
  const replyModeLabel = document.getElementById("txt-reply-mode-label");
  const replyModeGroup = document.getElementById("sidex-reply-mode-group");
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
      enabledTitle: "插件已启用",
      enabledDesc: "点击推文原地展开评论流",
      disabledTitle: "插件已停用",
      disabledDesc: "已恢复 X 原生跳转与浏览行为",
      replyModeLabel: "回复模式",
      replyModeDrawer: "侧栏",
      replyModeNative: "官方",
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
      enabledTitle: "Extension Enabled",
      enabledDesc: "Click tweets to open comment stream",
      disabledTitle: "Extension Paused",
      disabledDesc: "Native X navigation restored",
      replyModeLabel: "Reply Mode",
      replyModeDrawer: "Drawer",
      replyModeNative: "Native",
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
  let translationProvider = "x";

  function getSystemLang() {
    const nav = (navigator.language || "zh").toLowerCase();
    return nav.startsWith("zh") ? "zh" : "en";
  }

  function updateTexts() {
    const s = STRINGS[currentLang] || STRINGS.zh;
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
    const btnDrawer = document.getElementById("btn-mode-drawer");
    const btnNative = document.getElementById("btn-mode-native");
    if (btnDrawer) btnDrawer.textContent = s.replyModeDrawer;
    if (btnNative) btnNative.textContent = s.replyModeNative;

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
    });
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

  // Load saved settings
  const storage = chrome?.storage?.sync || chrome?.storage?.local;
  if (storage) {
    storage.get({ sidex_enabled: true, sidex_lang: null, sidex_sub_reply_limit: 1, sidex_reply_mode: "drawer", sidex_translation_provider: "x" }, (res) => {
      isEnabled = res.sidex_enabled !== false;
      currentLang = res.sidex_lang || getSystemLang();
      currentSubReplyLimit = Number(res.sidex_sub_reply_limit) || 1;
      currentReplyMode = res.sidex_reply_mode === "native" ? "native" : "drawer";
      translationProvider = ["x", "google", "external"].includes(res.sidex_translation_provider) ? res.sidex_translation_provider : "x";
      toggleInput.checked = isEnabled;
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
