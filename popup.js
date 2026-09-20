(function initSideXPopup() {
  "use strict";

  const toggleInput = document.getElementById("sidex-toggle-input");
  const switchTitle = document.getElementById("txt-switch-title");
  const switchDesc = document.getElementById("txt-switch-desc");
  const resetLabel = document.getElementById("txt-reset-label");
  const resetBtn = document.getElementById("btn-reset-width");
  const resetBtnText = document.getElementById("txt-reset-btn");
  const hintToggle = document.getElementById("txt-hint-toggle");
  const hintEsc = document.getElementById("txt-hint-esc");
  const langGroup = document.getElementById("sidex-lang-group");

  const STRINGS = {
    zh: {
      enabledTitle: "插件已启用",
      enabledDesc: "点击推文原地展开评论流",
      disabledTitle: "插件已停用",
      disabledDesc: "已恢复 X 原生跳转与浏览行为",
      resetLabel: "抽屉宽度",
      resetBtn: "恢复默认",
      resetDone: "已恢复！",
      hintToggle: "切换侧栏展开/收起",
      hintEsc: "关闭抽屉或大图"
    },
    en: {
      enabledTitle: "Extension Enabled",
      enabledDesc: "Click tweets to open comment stream",
      disabledTitle: "Extension Paused",
      disabledDesc: "Native X navigation restored",
      resetLabel: "Drawer Width",
      resetBtn: "Reset",
      resetDone: "Restored!",
      hintToggle: "Toggle sidebar expand/collapse",
      hintEsc: "Close drawer or lightbox"
    }
  };

  let currentLang = "zh";
  let isEnabled = true;

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
    resetLabel.textContent = s.resetLabel;
    resetBtnText.textContent = s.resetBtn;
    hintToggle.textContent = s.hintToggle;
    hintEsc.textContent = s.hintEsc;

    // Update active language button
    langGroup.querySelectorAll(".sidex-lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === currentLang);
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
    storage.get({ sidex_enabled: true, sidex_lang: null }, (res) => {
      isEnabled = res.sidex_enabled !== false;
      currentLang = res.sidex_lang || getSystemLang();
      toggleInput.checked = isEnabled;
      updateTexts();
      updateBadge(isEnabled);
    });
  } else {
    currentLang = getSystemLang();
    updateTexts();
  }

  // Toggle switch change handler
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
