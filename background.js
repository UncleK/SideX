chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "TRANSLATE_TEXT") {
    const text = String(message.text || "").trim();
    const destLang = message.destLang || "zh";
    const targetLang = destLang === "zh" ? "zh-CN" : destLang;

    if (!text) {
      sendResponse({ ok: false, error: "文本内容为空" });
      return false;
    }

    const cleanText = text.replace(/https?:\/\/[^\s]+/g, "").trim();
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(cleanText || text)}`;

    fetch(gUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Google 翻译接口错误 (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translation = data[0].map((item) => (Array.isArray(item) ? item[0] : "")).filter(Boolean).join("");
          const sourceLanguage = data[2] || "原语言";
          if (translation) {
            sendResponse({
              ok: true,
              payload: {
                translation,
                sourceLanguage,
                provider: "Google"
              }
            });
            return;
          }
        }
        throw new Error("翻译数据解析失败");
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || "翻译请求失败" });
      });

    return true; // Keep message port open for async response
  }
});
