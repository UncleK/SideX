// Cross-origin Google requests belong in the extension worker, not X's page.
const translationRequests = new Map();
const translationCache = new Map();

function splitTranslationText(text, limit = 1800) {
  const points = Array.from(text);
  const parts = [];
  while (points.length) {
    let end = Math.min(limit, points.length);
    if (end < points.length) {
      for (let i = end - 1; i >= limit / 2; i--) {
        if (/\s/.test(points[i])) { end = i + 1; break; }
      }
    }
    const part = points.splice(0, end).join("");
    const suffix = part.match(/\s+$/)?.[0] || "";
    parts.push({ text: part.slice(0, part.length - suffix.length), suffix });
  }
  return parts;
}

async function translateWithGoogle(text, destLang) {
  const key = JSON.stringify([destLang, text]);
  if (translationCache.has(key)) return translationCache.get(key);
  if (translationRequests.has(key)) return translationRequests.get(key);
  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const translated = [];
      let sourceLanguage = "";
      for (const part of splitTranslationText(text)) {
        if (!part.text) { translated.push(part.suffix); continue; }
        const url = new URL("https://translate.googleapis.com/translate_a/single");
        url.search = new URLSearchParams({ client: "gtx", sl: "auto", tl: destLang === "zh" ? "zh-CN" : destLang, dt: "t", q: part.text });
        const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
        if (!response.ok) throw new Error(`GOOGLE_TRANSLATION_HTTP_${response.status}`);
        const data = await response.json();
        const value = Array.isArray(data?.[0]) ? data[0].map(row => Array.isArray(row) ? row[0] : "").join("") : "";
        if (!value.trim()) throw new Error("GOOGLE_TRANSLATION_EMPTY");
        sourceLanguage ||= data[2] || "";
        translated.push(value + part.suffix);
      }
      const result = { translation: translated.join(""), sourceLanguage, provider: "Google" };
      translationCache.set(key, result);
      if (translationCache.size > 100) translationCache.delete(translationCache.keys().next().value);
      return result;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("GOOGLE_TRANSLATION_TIMEOUT");
      throw error;
    } finally { clearTimeout(timer); }
  })();
  translationRequests.set(key, task);
  try { return await task; } finally { translationRequests.delete(key); }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "TRANSLATE_TEXT") return false;
  const text = String(message.text || "").trim();
  const destLang = message.destLang || "zh";
  if (!text || text.length > 50000 || !/^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(destLang)) {
    sendResponse({ ok: false, error: "INVALID_TRANSLATION_INPUT" });
    return false;
  }
  translateWithGoogle(text, destLang).then(
    payload => sendResponse({ ok: true, payload }),
    error => sendResponse({ ok: false, error: error.message || "GOOGLE_TRANSLATION_FAILED" })
  );
  return true;
});
