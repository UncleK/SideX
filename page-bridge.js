(function installSidePeekPageBridge() {
  "use strict";

  if (window.__sidePeekPageBridgeInstalled) return;
  window.__sidePeekPageBridgeInstalled = true;

  const CONTENT_SOURCE = "sidepeek-content";
  const PAGE_SOURCE = "sidepeek-page";
  const GRAPHQL_PATH = /\/graphql\/([^/]+)\/([^/?#]+)/;
  const TRANSLATION_PATH = /\/2\/grok\/translation\.json$/;
  const nativeFetch = window.fetch.bind(window);
  const AUTH_HEADER_NAMES = new Set([
    "authorization",
    "x-twitter-auth-type",
    "x-twitter-active-user",
    "x-twitter-client-language",
    "x-client-uuid"
  ]);
  const ACTIONS = Object.freeze({
    like: { active: "UnfavoriteTweet", inactive: "FavoriteTweet" },
    repost: { active: "DeleteRetweet", inactive: "CreateRetweet" },
    bookmark: { active: "DeleteBookmark", inactive: "CreateBookmark" }
  });
  const DEFAULT_BEARER = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  const captured = {
    auth: Object.create(null),
    templates: new Map(),
    queryIds: new Map(),
    translationTemplate: null
  };
  const operationCache = new Map();
  const observedThreadCache = new Map();
  const observedCursorScopes = new Map();
  const OBSERVED_THREAD_TTL = 5 * 60 * 1000;
  let webpackRuntime = null;
  let transactionIdFunction = null;

  function objectValue(value) {
    return value && (typeof value === "object" || typeof value === "function") ? value : null;
  }

  function normalizeHeaders(value) {
    const normalized = Object.create(null);
    try {
      new Headers(value || {}).forEach((headerValue, name) => {
        normalized[name.toLowerCase()] = headerValue;
      });
    } catch {
      if (!value || typeof value !== "object") return normalized;
      for (const [name, headerValue] of Object.entries(value)) {
        if (headerValue !== undefined) normalized[name.toLowerCase()] = String(headerValue);
      }
    }
    return normalized;
  }

  function rememberRequest(urlValue, methodValue, headersValue, body) {
    let parsedUrl;
    try { parsedUrl = new URL(String(urlValue || ""), location.origin); } catch { return; }
    if (!/^(?:api\.)?(?:x|twitter)\.com$/.test(parsedUrl.hostname)) return;
    const url = parsedUrl.toString();
    const headers = normalizeHeaders(headersValue);
    for (const [name, value] of Object.entries(headers)) {
      if (AUTH_HEADER_NAMES.has(name) && value) captured.auth[name] = value;
    }
    if (TRANSLATION_PATH.test(parsedUrl.pathname)) {
      captured.translationTemplate = {
        url,
        method: String(methodValue || "GET").toUpperCase(),
        headers,
        body: typeof body === "string" ? body : null
      };
    }
    const match = url.match(GRAPHQL_PATH);
    if (!match) return;
    const queryId = match[1];
    const operationName = match[2];
    captured.queryIds.set(operationName, queryId);
    captured.templates.set(operationName, {
      url,
      method: String(methodValue || "GET").toUpperCase(),
      headers,
      body: typeof body === "string" ? body : null
    });
  }

  function patchXhr() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    const requests = new WeakMap();

    XMLHttpRequest.prototype.open = function sidePeekOpen(method, url, ...rest) {
      requests.set(this, { method, url: String(url), headers: Object.create(null) });
      return Reflect.apply(originalOpen, this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.setRequestHeader = function sidePeekSetRequestHeader(name, value) {
      const request = requests.get(this);
      if (request) request.headers[String(name).toLowerCase()] = String(value);
      return Reflect.apply(originalSetRequestHeader, this, [name, value]);
    };
    XMLHttpRequest.prototype.send = function sidePeekSend(body) {
      const request = requests.get(this);
      if (request) rememberRequest(request.url, request.method, request.headers, body);
      if (request && /\/(?:TweetDetail|CreateTweet|CreateNoteTweet)(?:[?#]|$)/.test(request.url)) {
        this.addEventListener("load", () => {
          if (this.status < 200 || this.status >= 300) return;
          try {
            const json = this.responseType === "json" ? this.response : JSON.parse(this.responseText);
            if (/\/TweetDetail(?:[?#]|$)/.test(request.url)) observeNativeThread(request.url, json, body);
            else observeCreatedReply(request.url, json);
          }
          catch { /* Observing must never affect X's own request. */ }
        }, { once: true });
      }
      return Reflect.apply(originalSend, this, [body ?? null]);
    };
  }

  function patchFetch() {
    const originalFetch = window.fetch;
    window.fetch = function sidePeekFetch(input, init) {
      try {
        const request = input instanceof Request ? input : null;
        const headers = normalizeHeaders(request?.headers);
        Object.assign(headers, normalizeHeaders(init?.headers));
        rememberRequest(request?.url || input, init?.method || request?.method || "GET", headers, init?.body);
      } catch {
        // Safe fallback
      }
      const result = Reflect.apply(originalFetch, this, [input, init]);
      const url = input instanceof Request ? input.url : String(input);
      if (/\/(?:TweetDetail|CreateTweet|CreateNoteTweet)(?:[?#]|$)/.test(url)) {
        result.then(response => {
          try {
            if (response.ok && typeof response.clone === "function") {
              response.clone().json().then(json => {
                if (/\/TweetDetail(?:[?#]|$)/.test(url)) observeNativeThread(url, json, init?.body);
                else observeCreatedReply(url, json);
              }).catch(() => {});
            }
          } catch { /* Never affect the native response reader. */ }
        }, () => {});
      }
      return result;
    };
  }

  function observeCreatedReply(urlValue, json) {
    let url;
    try { url = new URL(urlValue, location.origin); } catch { return; }
    if (!/^(?:api\.)?(?:x|twitter)\.com$/.test(url.hostname) || !json?.data || json.errors?.length) return;
    window.postMessage({ source: PAGE_SOURCE, type: "REPLY_CREATED", payload: json }, location.origin);
  }

  function observedThreads() {
    const now = Date.now();
    for (const [key, entry] of observedThreadCache) if (now - entry.at > OBSERVED_THREAD_TTL) observedThreadCache.delete(key);
    return [...observedThreadCache.values()].map(({ requestTweetId, cursor, json }) => ({ requestTweetId, cursor, json }));
  }

  function observeNativeThread(urlValue, json, body) {
    let url, variables;
    try {
      url = new URL(urlValue, location.origin);
      if (!/^(?:api\.)?(?:x|twitter)\.com$/.test(url.hostname) || !/\/TweetDetail$/.test(url.pathname)) return;
      variables = JSON.parse(url.searchParams.get("variables") || "null") || JSON.parse(body || "{}").variables;
    } catch { return; }
    cacheThreadResponse(String(variables?.focalTweetId || ""), variables?.cursor || "", json, true);
  }

  function cacheThreadResponse(requestTweetId, cursor, json, notify = false) {
    if (!/^\d+$/.test(requestTweetId) || !json?.data || json.errors?.length) return;
    // Unknown cursor responses may belong to an already opened Spam section.
    // Only replay continuation pages whose normal boundary we actually observed.
    const boundary = observedCursorScopes.get(`${requestTweetId}:${cursor}`);
    if (cursor && (!boundary || boundary.gated || Date.now() - boundary.at > OBSERVED_THREAD_TTL)) return;
    if (JSON.stringify(json).length > 1000000) return;
    function visit(node, gated = false) {
      if (!node || typeof node !== "object" || node.tweet_results || node.tweetResult ||
          node.promotedMetadata || node.promoted_metadata || /^tweetdetailrelatedtweets-/i.test(node.entryId || "")) return;
      if (Array.isArray(node)) {
        let folded = gated;
        for (const child of node) {
          const item = child?.content?.itemContent || child?.item?.itemContent || child?.itemContent;
          if ((item?.itemType || item?.__typename) === "TimelineLabel") folded = true;
          visit(child, folded);
        }
        return;
      }
      if (node.cursorType && typeof node.value === "string") {
        observedCursorScopes.set(`${requestTweetId}:${node.value}`, {
          at: Date.now(), gated: gated || !/^(?:Bottom|ShowMore)$/.test(node.cursorType)
        });
      }
      Object.values(node).forEach(child => visit(child, gated));
    }
    visit(json.data);
    while (observedCursorScopes.size > 256) observedCursorScopes.delete(observedCursorScopes.keys().next().value);
    const key = `${requestTweetId}:${cursor}`;
    observedThreadCache.delete(key);
    observedThreadCache.set(key, { requestTweetId, cursor, json, at: Date.now() });
    while (observedThreadCache.size > 12) observedThreadCache.delete(observedThreadCache.keys().next().value);
    if (notify) window.postMessage({ source: PAGE_SOURCE, type: "NATIVE_THREAD_OBSERVED",
      payload: { sidepeekObservedThreads: observedThreads() } }, location.origin);
  }

  function getWebpackRuntime() {
    if (webpackRuntime?.c && webpackRuntime?.m) return webpackRuntime;
    try {
      const chunkName = Object.keys(window).find((name) => name.startsWith("webpackChunk") && Array.isArray(window[name]));
      const chunk = chunkName ? window[chunkName] : null;
      if (!chunk) return null;
      let runtime = null;
      chunk.push([[`sidepeek-${Date.now()}`], {}, (candidate) => { runtime = candidate; }]);
      if (runtime?.c && runtime?.m) webpackRuntime = runtime;
    } catch {
      webpackRuntime = null;
    }
    return webpackRuntime;
  }

  function deepFind(value, predicate, maxDepth = 5, seen = new Set()) {
    const current = objectValue(value);
    if (!current || maxDepth < 0 || seen.has(current)) return null;
    seen.add(current);
    try {
      if (predicate(current)) return current;
      for (const key of Object.keys(current)) {
        let child;
        try {
          child = current[key];
        } catch {
          continue;
        }
        const found = deepFind(child, predicate, maxDepth - 1, seen);
        if (found) return found;
      }
    } catch {
      return null;
    }
    return null;
  }

  function findOperation(operationName) {
    const cached = operationCache.get(operationName);
    if (cached) return cached;
    const runtime = getWebpackRuntime();
    const predicate = (value) => value?.operationName === operationName && typeof value?.queryId === "string";

    for (const module of Object.values(runtime?.c || {})) {
      const found = deepFind(module?.exports, predicate);
      if (found) {
        operationCache.set(operationName, found);
        return found;
      }
    }

    for (const [moduleId, factory] of Object.entries(runtime?.m || {})) {
      let source = "";
      try {
        source = Function.prototype.toString.call(factory);
      } catch {
        continue;
      }
      if (!source.includes(operationName)) continue;
      try {
        const exports = runtime(moduleId);
        const found = deepFind(exports, predicate);
        if (found) {
          operationCache.set(operationName, found);
          return found;
        }
      } catch {
        // Module might be environment-specific
      }
    }

    if (captured.queryIds.has(operationName)) {
      const op = {
        queryId: captured.queryIds.get(operationName),
        operationName,
        metadata: { featureSwitches: [], fieldToggles: [] }
      };
      operationCache.set(operationName, op);
      return op;
    }

    if (operationName === "CreateNoteTweet") {
      const op = {
        queryId: "Pwg0RQVkQa_axfgLgqQ4qA",
        operationName: "CreateNoteTweet",
        metadata: { featureSwitches: [], fieldToggles: [] }
      };
      operationCache.set(operationName, op);
      return op;
    }

    return null;
  }

  function findTransactionIdFunction() {
    if (transactionIdFunction) return transactionIdFunction;
    const runtime = getWebpackRuntime();
    if (!runtime) return null;
    for (const [moduleId, module] of Object.entries(runtime.c)) {
      const factory = runtime.m[moduleId];
      let source = "";
      try {
        source = Function.prototype.toString.call(factory);
      } catch {
        continue;
      }
      const candidate = module?.exports?.kc;
      if (typeof candidate === "function" && candidate.length === 3 && source.includes("x-client-transaction-id")) {
        transactionIdFunction = candidate;
        return candidate;
      }
    }
    for (const [moduleId, factory] of Object.entries(runtime.m)) {
      let source = "";
      try {
        source = Function.prototype.toString.call(factory);
      } catch {
        continue;
      }
      if (!source.includes("x-client-transaction-id")) continue;
      try {
        const exports = runtime(moduleId);
        if (typeof exports?.kc === "function" && exports.kc.length === 3) {
          transactionIdFunction = exports.kc;
          return exports.kc;
        }
      } catch {
        // Scanning
      }
    }
    return null;
  }

  function csrfToken() {
    return decodeURIComponent((document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1] || "");
  }

  function toggleMap(items) {
    const result = Object.create(null);
    for (const item of items || []) {
      if (typeof item === "string") result[item] = true;
      else if (typeof item?.name === "string") result[item.name] = item.value ?? true;
    }
    return result;
  }

  async function requestHeaders(path, method, requiresCsrf) {
    const headers = {
      "content-type": "application/json",
      "x-twitter-active-user": captured.auth["x-twitter-active-user"] || "yes",
      "x-twitter-auth-type": captured.auth["x-twitter-auth-type"] || "OAuth2Session",
      "authorization": captured.auth.authorization || DEFAULT_BEARER
    };
    for (const name of ["x-twitter-client-language", "x-client-uuid"]) {
      if (captured.auth[name]) headers[name] = captured.auth[name];
    }
    const csrf = csrfToken();
    if (csrf) headers["x-csrf-token"] = csrf;
    if (requiresCsrf && !csrf) throw new Error("当前登录会话缺少 CSRF 信息，请刷新后重试");
    const makeTransactionId = findTransactionIdFunction();
    if (makeTransactionId) {
      try {
        const transactionId = await makeTransactionId(location.host, path, method);
        if (transactionId && !String(transactionId).startsWith("e:")) headers["x-client-transaction-id"] = transactionId;
      } catch {
        // Optional header
      }
    }
    return headers;
  }

  async function graphql(operationName, variables, method = "POST", signal) {
    const operation = findOperation(operationName);
    if (!operation) throw new Error(`当前页面尚未加载 ${operationName} 操作，请刷新页面后重试`);
    const path = `/i/api/graphql/${operation.queryId}/${operationName}`;
    let features = toggleMap(operation.metadata?.featureSwitches);
    let fieldToggles = toggleMap(operation.metadata?.fieldToggles);
    // Preserve switches observed on the official client instead of enabling all of them.
    const template = captured.templates.get(operationName);
    if (template) {
      try {
        const params = new URL(template.url, location.origin).searchParams;
        const body = template.body ? JSON.parse(template.body) : {};
        features = JSON.parse(params.get("features") || "null") || body.features || features;
        fieldToggles = JSON.parse(params.get("fieldToggles") || "null") || body.fieldToggles || fieldToggles;
      } catch { /* Use operation metadata until an official request is observed. */ }
    }
    const headers = await requestHeaders(path, method, method === "POST");
    let response;
    if (method === "GET") {
      const url = new URL(path, location.origin);
      url.searchParams.set("variables", JSON.stringify(variables));
      url.searchParams.set("features", JSON.stringify(features));
      url.searchParams.set("fieldToggles", JSON.stringify(fieldToggles));
      response = await nativeFetch(url.toString(), { method, headers, credentials: "include", cache: "no-store", signal });
    } else {
      response = await nativeFetch(path, {
        method,
        headers,
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ variables, features, queryId: operation.queryId })
      });
    }
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.errors?.length || !json?.data) {
      const message = json?.errors?.[0]?.message || `X 请求失败（${response.status}）`;
      throw new Error(message);
    }
    return json;
  }

  async function replayTweetDetail(tweetId, cursor) {
    const template = captured.templates.get("TweetDetail");
    if (!template) throw new Error("X 详情接口尚未就绪，请刷新页面后重试");
    const url = new URL(template.url, location.origin);
    const variables = JSON.parse(url.searchParams.get("variables") || "{}");
    variables.focalTweetId = tweetId;
    if (cursor) variables.cursor = cursor;
    else delete variables.cursor;
    url.searchParams.set("variables", JSON.stringify(variables));
    const headers = { ...template.headers, ...await requestHeaders(url.pathname, template.method, false) };
    const response = await fetch(url.toString(), {
      method: template.method,
      headers,
      credentials: "include",
      cache: "no-store"
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || (!json?.data && json?.errors?.length)) throw new Error(json?.errors?.[0]?.message || `X 请求失败（${response.status}）`);
    return json;
  }

  async function readThread(tweetId, cursor) {
    const variables = {
      focalTweetId: tweetId,
      referrer: "home",
      with_rux_injections: false,
      rankingMode: "Relevance",
      includePromotedContent: true,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true
    };
    if (cursor) variables.cursor = cursor;
    try {
      return await graphql("TweetDetail", variables, "GET");
    } catch (primaryError) {
      try {
        return await replayTweetDetail(tweetId, cursor);
      } catch {
        throw primaryError;
      }
    }
  }

  async function toggleAction(action, tweetId, desiredActive) {
    const mapping = ACTIONS[action];
    if (!mapping) throw new Error("不支持的互动操作");
    const operationName = desiredActive ? mapping.inactive : mapping.active;
    const variables = action === "repost" && !desiredActive
      ? { source_tweet_id: tweetId, dark_request: false }
      : action === "repost"
        ? { tweet_id: tweetId, dark_request: false }
        : { tweet_id: tweetId };
    return graphql(operationName, variables);
  }

  async function uploadMedia(base64, mimeType, size) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType || "image/png" });

    const host = location.hostname.includes("twitter.com") ? "upload.twitter.com" : "upload.x.com";
    const uploadUrl = `https://${host}/i/media/upload.json`;
    
    // Step 1: INIT
    const initHeaders = await requestHeaders(uploadUrl, "POST", true);
    initHeaders["content-type"] = "application/x-www-form-urlencoded";
    const initParams = new URLSearchParams({
      command: "INIT",
      total_bytes: String(size || blob.size),
      media_type: mimeType || "image/png",
      media_category: "tweet_image"
    });

    const initRes = await fetch(uploadUrl, {
      method: "POST",
      headers: initHeaders,
      credentials: "include",
      body: initParams.toString()
    });
    const initJson = await initRes.json().catch(() => null);
    const mediaId = initJson?.media_id_string || String(initJson?.media_id || "");
    if (!initRes.ok || !mediaId) {
      const errMsg = initJson?.errors?.[0]?.message || `初始化图片上传失败 (${initRes.status})`;
      throw new Error(errMsg);
    }

    // Step 2: APPEND
    const appendHeaders = await requestHeaders(uploadUrl, "POST", true);
    delete appendHeaders["content-type"]; // multipart boundary handled automatically
    const appendForm = new FormData();
    appendForm.append("command", "APPEND");
    appendForm.append("media_id", mediaId);
    appendForm.append("segment_index", "0");
    appendForm.append("media", blob);

    const appendRes = await fetch(uploadUrl, {
      method: "POST",
      headers: appendHeaders,
      credentials: "include",
      body: appendForm
    });
    if (!appendRes.ok) {
      const appendJson = await appendRes.json().catch(() => null);
      const errMsg = appendJson?.errors?.[0]?.message || `上传图片数据失败 (${appendRes.status})`;
      throw new Error(errMsg);
    }

    // Step 3: FINALIZE
    const finalizeHeaders = await requestHeaders(uploadUrl, "POST", true);
    finalizeHeaders["content-type"] = "application/x-www-form-urlencoded";
    const finalizeParams = new URLSearchParams({
      command: "FINALIZE",
      media_id: mediaId
    });

    const finalizeRes = await fetch(uploadUrl, {
      method: "POST",
      headers: finalizeHeaders,
      credentials: "include",
      body: finalizeParams.toString()
    });
    const finalizeJson = await finalizeRes.json().catch(() => null);
    if (!finalizeRes.ok) {
      const errMsg = finalizeJson?.errors?.[0]?.message || `完成图片上传失败 (${finalizeRes.status})`;
      throw new Error(errMsg);
    }
    return finalizeJson?.media_id_string || mediaId;
  }

  async function createReply(tweetId, text, mediaIds = []) {
    const replyText = String(text || "").trim();
    const mediaEntities = (mediaIds || []).map((id) => ({ media_id: String(id), tagged_users: [] }));
    if (!replyText && !mediaEntities.length) throw new Error("回复内容或图片不能为空");

    const variables = {
      tweet_text: replyText,
      dark_request: false,
      media: { media_entities: mediaEntities, possibly_sensitive: false },
      semantic_annotation_ids: [],
      disallowed_reply_options: null,
      reply: { in_reply_to_tweet_id: tweetId, exclude_reply_user_ids: [] }
    };

    const textLen = globalThis.SidePeekTwitterText.parseTweet(replyText).weightedLength;

    // If text exceeds standard 280 characters, use CreateNoteTweet for Premium members
    if (textLen > 280) {
      try {
        return await graphql("CreateNoteTweet", variables);
      } catch (noteErr) {
        const errMsg = noteErr?.message || "";
        if (errMsg.toLowerCase().includes("premium") || errMsg.toLowerCase().includes("subscriber") || errMsg.includes("会员") || errMsg.includes("shorter")) {
          throw new Error("发布长文失败：该功能需 X Premium (会员) 权限，非会员请精简至 280 字内或在官方回复框中操作");
        }
        throw noteErr;
      }
    }

    return graphql("CreateTweet", variables);
  }

  async function fetchUserProfile(screenName) {
    const handle = String(screenName || "").trim();
    if (!handle) throw new Error("用户名不能为空");
    const variables = { screen_name: handle, withSafetyModeUserFields: true };
    const res = await graphql("UserByScreenName", variables, "GET");
    const userResult = res?.data?.user?.result;
    if (!userResult) throw new Error("未找到用户信息");
    return userResult;
  }

  async function toggleFollow(userId, screenName, active) {
    const isCurrentlyFollowing = Boolean(active);
    const endpoint = isCurrentlyFollowing
      ? "/i/api/1.1/friendships/destroy.json"
      : "/i/api/1.1/friendships/create.json";
    const path = endpoint;
    const headers = await requestHeaders(path, "POST", true);
    headers["content-type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    if (userId && /^\d+$/.test(String(userId))) {
      params.set("user_id", String(userId));
    }
    if (screenName) {
      params.set("screen_name", String(screenName));
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      credentials: "include",
      body: params.toString()
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const errMsg = json?.errors?.[0]?.message || `操作失败 (${response.status})`;
      throw new Error(errMsg);
    }
    return json;
  }

  async function fetchMutualFollowers(userId) {
    if (!/^\d+$/.test(String(userId))) throw new Error("用户 ID 无效");
    // Same endpoint and parameters used by X's official HoverCard.
    const path = "/i/api/1.1/friends/following/list.json";
    const url = new URL(path, location.origin);
    url.search = new URLSearchParams({
      include_profile_interstitial_type: "1", include_blocking: "1", include_blocked_by: "1",
      include_followed_by: "1", include_want_retweets: "1", include_mute_edge: "1",
      include_can_dm: "1", include_can_media_tag: "1", include_ext_is_blue_verified: "1",
      include_ext_verified_type: "1", include_ext_profile_image_shape: "1", skip_status: "1",
      cursor: "-1", user_id: String(userId), count: "3", with_total_count: "true"
    });
    const response = await nativeFetch(url.toString(), {
      headers: await requestHeaders(path, "GET", false), credentials: "include",
      signal: AbortSignal.timeout(10000)
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(json?.users)) throw new Error(`X_PROFILE_CONTEXT_${response.status}`);
    return { count: Number(json.total_count || 0), users: json.users.slice(0, 3).map(user => ({
      name: user.name, handle: user.screen_name, avatar: user.profile_image_url_https
    })) };
  }

  async function translateTweet(tweetId, text, destLang = "zh") {
    if (!/^\d+$/.test(String(tweetId))) throw new Error("帖子 ID 无效");
    if (!/^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(destLang)) throw new Error("翻译语言无效");
    // Observed on X's official Show translation button (2026-10-09).
    const template = captured.translationTemplate;
    const url = new URL(template?.url || "https://api.x.com/2/grok/translation.json");
    const headers = await requestHeaders(url.pathname, "POST", true);
    let body = {};
    try { body = JSON.parse(template?.body || "{}"); } catch { /* Default request below. */ }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await nativeFetch(url.toString(), {
        method: "POST", headers, credentials: "include", signal: controller.signal,
        body: JSON.stringify({ ...body, content_type: "POST", id: String(tweetId), dst_lang: destLang })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`X_TRANSLATION_HTTP_${response.status}`);
      const translation = json?.result?.text;
      if (typeof translation !== "string" || !translation.trim()) throw new Error("X_TRANSLATION_EMPTY");
      return { translation, sourceLanguage: json.result.src_lang || "", provider: "X / Grok" };
    } catch (error) {
      if (error.name === "AbortError") throw new Error("X_TRANSLATION_TIMEOUT");
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function toggleMute(screenName, active) {
    const endpoint = active
      ? "/i/api/1.1/mutes/users/destroy.json"
      : "/i/api/1.1/mutes/users/create.json";
    const path = endpoint;
    const headers = await requestHeaders(path, "POST", true);
    headers["content-type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams({ screen_name: String(screenName) });
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      credentials: "include",
      body: params.toString()
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.errors?.[0]?.message || `静音操作失败 (${response.status})`);
    }
    return json;
  }

  async function toggleBlock(screenName, active) {
    const endpoint = active
      ? "/i/api/1.1/blocks/destroy.json"
      : "/i/api/1.1/blocks/create.json";
    const path = endpoint;
    const headers = await requestHeaders(path, "POST", true);
    headers["content-type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams({ screen_name: String(screenName) });
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      credentials: "include",
      body: params.toString()
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.errors?.[0]?.message || `屏蔽操作失败 (${response.status})`);
    }
    return json;
  }

  function respond(requestId, ok, payload) {
    window.postMessage({ source: PAGE_SOURCE, requestId, ok, ...(ok ? { payload } : { error: payload }) }, location.origin);
  }

  let quickToolSession = null;
  // Installed at document_start, before X's own Escape handler. A quick tool
  // owns the whole modal stack it opened, rather than just its last picker.
  window.addEventListener("keydown", event => {
    const session = quickToolSession;
    if (event.key !== "Escape" || !session || !document.querySelector('#layers [role="dialog"]')) return;
    quickToolSession = null;
    try {
      const index = session.router._currentLocationIndex;
      if (Number.isInteger(session.index) && Number.isInteger(index) && index > session.index && typeof session.router.go === "function") {
        // Returning to the captured entry also preserves an underlying photo
        // viewer; close-all would otherwise close that viewer as well.
        session.router.go(session.index - index);
      } else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    } catch {}
  }, true);

  function clearFinishedToolSession() {
    if (quickToolSession && location.pathname + location.search === quickToolSession.path) quickToolSession = null;
  }
  window.addEventListener("popstate", clearFinishedToolSession);

  function openNativeReply(tweetId, quickTool = false) {
    if ([...document.querySelectorAll('#layers [role="dialog"] [data-testid="tweetTextarea_0"]')]
      .some(editor => !editor.closest('[role="dialog"]')?.querySelector('[data-testid="swipe-to-dismiss"]'))) throw new Error("NATIVE_DRAFT_ALREADY_OPEN");
    // Use X's own router so a full reply editor opens without replacing the
    // reading page. Avoid fixed webpack IDs and do not mutate React props.
    for (const link of document.querySelectorAll('a[href="/compose/post"], a[href="/compose/tweet"]')) {
      const key = Object.keys(link).find(name => name.startsWith("__reactFiber$"));
      for (let fiber = key && link[key], depth = 0; fiber && depth < 100; fiber = fiber.return, depth++) {
        const router = fiber.memoizedProps?.history;
        if (typeof router?.push !== "function") continue;
        if (quickTool && (typeof router.go !== "function" || !Number.isInteger(router._currentLocationIndex) || router._currentLocationIndex < 0)) continue;
        const path = location.pathname + location.search;
        quickToolSession = quickTool ? { router, path, index: router._currentLocationIndex } : null;
        router.push("/compose/post", { fromApp: true, inReplyToStatusId: tweetId,
          isSelfThreadReply: false, previousPath: path });
        return { opened: true };
      }
    }
    return { opened: false };
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.source !== CONTENT_SOURCE || !Number.isInteger(message.requestId)) return;

    if (message.type === "UPLOAD_MEDIA") {
      try {
        const mediaId = await uploadMedia(message.base64, message.mimeType, message.size);
        respond(message.requestId, true, { mediaId });
      } catch (error) {
        respond(message.requestId, false, error instanceof Error ? error.message : "图片上传失败");
      }
      return;
    }

    if (message.type === "FETCH_USER_PROFILE") {
      try {
        const payload = await fetchUserProfile(message.screenName);
        respond(message.requestId, true, payload);
      } catch (error) {
        respond(message.requestId, false, error instanceof Error ? error.message : "获取用户信息失败");
      }
      return;
    }

    if (message.type === "FETCH_MUTUAL_FOLLOWERS") {
      try { respond(message.requestId, true, await fetchMutualFollowers(message.userId)); }
      catch (error) { respond(message.requestId, false, error.message || "PROFILE_CONTEXT_UNAVAILABLE"); }
      return;
    }

    if (message.type === "TOGGLE_FOLLOW") {
      try {
        const payload = await toggleFollow(message.userId, message.screenName, message.active);
        respond(message.requestId, true, payload);
      } catch (error) {
        respond(message.requestId, false, error instanceof Error ? error.message : "关注操作失败");
      }
      return;
    }

    if (message.type === "TRANSLATE_TWEET") {
      try {
        const payload = await translateTweet(message.tweetId, message.text, message.destLang);
        respond(message.requestId, true, payload);
      } catch (error) {
        respond(message.requestId, false, error instanceof Error ? error.message : "翻译失败");
      }
      return;
    }

    if (message.type === "TOGGLE_MUTE") {
      try {
        const payload = await toggleMute(message.screenName, message.active);
        respond(message.requestId, true, payload);
      } catch (error) {
        respond(message.requestId, false, error instanceof Error ? error.message : "静音操作失败");
      }
      return;
    }

    if (message.type === "TOGGLE_BLOCK") {
      try {
        const payload = await toggleBlock(message.screenName, message.active);
        respond(message.requestId, true, payload);
      } catch (error) {
        respond(message.requestId, false, error instanceof Error ? error.message : "屏蔽操作失败");
      }
      return;
    }

    const tweetId = String(message.tweetId || "");
    if (!/^\d+$/.test(tweetId)) return respond(message.requestId, false, "帖子 ID 无效");

    try {
      let payload;
      if (message.type === "OPEN_NATIVE_REPLY") payload = openNativeReply(tweetId, message.quickTool === true);
      else if (message.type === "READ_THREAD") {
        payload = await readThread(tweetId, message.cursor);
        // Preserve replies SideX itself already loaded before switching to a
        // child panel; that child's fresh response can be shorter as well.
        cacheThreadResponse(tweetId, message.cursor || "", payload);
        payload = { ...payload, sidepeekObservedThreads: observedThreads() };
      }
      else if (message.type === "TOGGLE_ACTION") payload = await toggleAction(message.action, tweetId, Boolean(message.active));
      else if (message.type === "CREATE_REPLY") payload = await createReply(tweetId, message.text, message.mediaIds);
      else throw new Error("未知请求类型");
      respond(message.requestId, true, payload);
    } catch (error) {
      respond(message.requestId, false, error instanceof Error ? error.message : "X 请求失败");
    }
  });

  function patchHistory() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function sidePeekPushState(...args) {
      const result = Reflect.apply(origPush, this, args);
      clearFinishedToolSession();
      try {
        window.postMessage({ source: PAGE_SOURCE, type: "URL_CHANGED", url: location.href }, location.origin);
      } catch {}
      return result;
    };
    history.replaceState = function sidePeekReplaceState(...args) {
      const result = Reflect.apply(origReplace, this, args);
      clearFinishedToolSession();
      try {
        window.postMessage({ source: PAGE_SOURCE, type: "URL_CHANGED", url: location.href }, location.origin);
      } catch {}
      return result;
    };
  }

  patchXhr();
  patchFetch();
  patchHistory();
  getWebpackRuntime();
  window.postMessage({ source: PAGE_SOURCE, type: "READY" }, location.origin);
})();
