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
  // Read-only compatibility for x-web's Relay client (observed 2026-11-08).
  // Native observations always take precedence. The Vite client has no
  // Webpack registry to discover an unvisited TweetDetail operation from.
  const X_WEB_TWEET_DETAIL = {
    queryId: "L4cB5UHNoH3-RjFtwlfluw",
    operationName: "TweetDetail",
    modern: true,
    variables: {
      cursor: null, rankingMode: null, referrer: null, withFocalTweet: true,
      __relay_internal__pv__xclientsfeaturesappviewerisloggedinrelayprovider: true,
      __relay_internal__pv__xclientsfeaturestranslationgroktranslatedpostenabledrelayprovider: false,
      __relay_internal__pv__postctafetchenabledrelayprovider: false,
      __relay_internal__pv__xclientsfeaturestweetcomponentsgrokanalyzepostrelayprovider: false,
      __relay_internal__pv__xclientsfeaturestranslationnoteautotranslationenabledrelayprovider: false,
      __relay_internal__pv__liveeventpostcontextenabledrelayprovider: false,
      __relay_internal__pv__sportspostcontextenabledrelayprovider: false
    }
  };
  // Persisted-operation data from X's current Relay artifacts. These are
  // parameters, never downloaded executable code; native observations win.
  const X_WEB_OPERATIONS = {
    TweetDetail: X_WEB_TWEET_DETAIL,
    UserByScreenName: { queryId: '8UhuvB9RJovmX8e5Qu2tNg', operationName: 'UserByScreenName' },
    CreateTweet: { queryId: 'oYN2wNon5cYp3VrfXrwImw', operationName: 'CreateTweet' },
    CreateNoteTweet: { queryId: '_cIwQ6XY_C81R09ZGyWc-Q', operationName: 'createTweetNoteTweetMutation' },
    FavoriteTweet: { queryId: 'gWHQmsY1Atd_XuOoMR2v5A', operationName: 'FavoriteTweet' },
    UnfavoriteTweet: { queryId: 'jd_5MSDRzKH4MJ3c4BmrqQ', operationName: 'likeButtonControlUnfavoriteMutation' },
    CreateBookmark: { queryId: '9559L3Eb62SZndMSVHIeNw', operationName: 'BookmarkAdd' },
    DeleteBookmark: { queryId: 'jTTS9lZmxUq-eYwmY8pHiA', operationName: 'BookmarkDelete' },
    CreateRetweet: { queryId: 'lBRHQaQKWQwF0eaGzH209w', operationName: 'CreateRetweet' },
    DeleteRetweet: { queryId: 'TSIYEnua4u_yleM5nrWzFw', operationName: 'retweetButtonUnretweetMutation' }
  };

  function isXWebClient() {
    return Boolean(document.querySelector('script[src*="abs.twimg.com/x-web/"], main article[class~="group/post"]'));
  }
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
    if (operationCache.get(operationName)?.queryId !== queryId) operationCache.delete(operationName);
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
    const modern = isXWebClient() && X_WEB_OPERATIONS[operationName];
    if (modern) return { ...modern, modern: true,
      queryId: captured.queryIds.get(modern.operationName) || modern.queryId };
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
    const transportName = operation.operationName || operationName;
    const template = captured.templates.get(transportName) || captured.templates.get(operationName);
    const templateUrl = template ? new URL(template.url, location.origin) : null;
    const modern = operation.modern || (templateUrl?.hostname === "api.x.com" && templateUrl.pathname.startsWith('/graphql/'));
    const path = `${modern ? '/graphql' : '/i/api/graphql'}/${operation.queryId}/${transportName}`;
    const endpoint = new URL(path, modern ? 'https://api.x.com' : location.origin);
    if (modern && operationName === "TweetDetail") {
      let observed = {};
      try { observed = JSON.parse(templateUrl?.searchParams.get('variables') || template?.body || '{}');
        if (observed.variables) observed = observed.variables;
      } catch {}
      variables = { ...X_WEB_TWEET_DETAIL.variables, ...observed, focalTweetId: variables.focalTweetId, cursor: variables.cursor || null };
    }
    if (modern && method === 'POST') {
      const json = await executeXWebMutation(operation, variables);
      if (json?.errors?.length || !json?.data) throw new Error(json?.errors?.[0]?.message || 'X 未返回操作确认，请在 X 核对状态');
      return json;
    }
    let features = toggleMap(operation.metadata?.featureSwitches);
    let fieldToggles = toggleMap(operation.metadata?.fieldToggles);
    // Preserve switches observed on the official client instead of enabling all of them.
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
      const url = endpoint;
      url.searchParams.set("variables", JSON.stringify(variables));
      if (!modern) {
        url.searchParams.set("features", JSON.stringify(features));
        url.searchParams.set("fieldToggles", JSON.stringify(fieldToggles));
      }
      response = await nativeFetch(url.toString(), { method, headers, credentials: "include", cache: "no-store", signal });
    } else {
      response = await nativeFetch(endpoint.toString(), {
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

  function nativeRelayEnvironment() {
    for (const link of document.querySelectorAll('a[href="/compose/post"], a[href="/compose/tweet"]')) {
      const key = Object.keys(link).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = key && link[key], depth = 0; fiber && depth < 800; fiber = fiber.return, depth++) {
        const environment = fiber.memoizedProps?.value?.environment;
        if (typeof environment?.getNetwork === 'function') return environment;
      }
    }
    return null;
  }

  function executeXWebMutation(operation, variables) {
    const environment = nativeRelayEnvironment();
    if (!environment) throw new Error('X 原生请求入口尚未就绪，请刷新后重试或使用官方回复框');
    return new Promise((resolve, reject) => {
      let subscription, response, settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => {
        subscription?.unsubscribe();
        finish(new Error('X 操作确认超时，请先在 X 核对结果，草稿已保留'));
      }, 25000);
      try {
        subscription = environment.getNetwork().execute({ id: operation.queryId,
          name: operation.operationName, operationKind: 'mutation', text: null, metadata: {} }, variables, { force: true }).subscribe({
          next(value) { response = value; }, error(error) { finish(error); }, complete() { finish(null, response); }
        });
      } catch (error) { finish(error); }
    });
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
    const response = await nativeFetch(url.toString(), {
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
    const variables = isXWebClient() ? { tweetId: String(tweetId) } : action === "repost" && !desiredActive
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

    if (isXWebClient()) {
      delete variables.dark_request;
      delete variables.disallowed_reply_options;
      for (const [name, value] of Object.entries(X_WEB_TWEET_DETAIL.variables)) {
        if (name.startsWith('__relay_internal__pv__')) variables[name] = value;
      }
    }

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
    const variables = isXWebClient() ? { screenName: handle, withIdentity: false,
      __relay_internal__pv__xclientsfeaturesappviewerisloggedinrelayprovider: true }
      : { screen_name: handle, withSafetyModeUserFields: true };
    const res = await graphql("UserByScreenName", variables, "GET");
    const userResult = res?.data?.user_result_by_screen_name?.result || res?.data?.user?.result;
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

  function nativeComposerEditors() {
    return [...document.querySelectorAll('#layers [role="dialog"] [data-testid="tweetTextarea_0"], [role="dialog"][data-slot="xds-modal-surface"] textarea[aria-multiline="true"]')]
      .filter(editor => !editor.closest('[role="dialog"]')?.querySelector('[data-testid="swipe-to-dismiss"], svg[data-icon="icon-double-chevron-right"], svg[data-icon="icon-double-chevron-left"]'));
  }

  function xWebNavigation() {
    let navigation, history, router;
    for (const link of document.querySelectorAll('a[href="/compose/post"], a[href="/compose/tweet"]')) {
      const key = Object.keys(link).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = key && link[key], depth = 0; fiber && depth < 800; fiber = fiber.return, depth++) {
        const value = fiber.memoizedProps?.value;
        if (!value || typeof value !== 'object') continue;
        if (typeof value.push === 'function' && typeof value.replace === 'function' &&
            typeof value.goBack === 'function' && typeof value.preload === 'function') navigation ||= value;
        if (typeof value.buildLocation === 'function' && typeof value.history?.go === 'function') {
          history ||= value.history; router ||= value;
        }
      }
      if (navigation && history) break;
    }
    return navigation ? { navigation, history, router } : null;
  }

  const xWebMounts = new WeakMap();
  let xWebMountSequence = 0;
  const xWebElement = (type, props, children) => ({ $$typeof: Symbol.for('react.transitional.element'),
    type, key: props?.key ?? null, props: children === undefined ? props : { ...props, children }, _owner: null });

  // Use the already mounted native renderer. No remote imports, copied React
  // runtime, source-row props mutation, or replacement of X's DOM are needed.
  function xWebCreateRoot(host, options = {}) {
    let boundary;
    for (const element of document.querySelectorAll('main article[class~="group/post"] a[href]')) {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = key && element[key], depth = 0; fiber && depth < 800; fiber = fiber.return, depth++) {
        if (fiber.tag === 1 && typeof fiber.stateNode?.forceUpdate === 'function') { boundary = fiber; break; }
      }
      if (boundary) break;
    }
    if (!boundary) throw new Error('X_NATIVE_RENDERER_UNAVAILABLE');
    let Base = boundary.type;
    while (Base && !Object.hasOwn(Base.prototype || {}, 'setState')) Base = Object.getPrototypeOf(Base);
    if (!Base) throw new Error('X_NATIVE_COMPONENT_UNAVAILABLE');
    const instance = boundary.stateNode;
    let mount = xWebMounts.get(instance), component, tree = null, closed = false;
    if (!mount) {
      const original = instance.render;
      mount = { original, children: new Map(), wrapper: null };
      mount.wrapper = function () { return [original.call(this), ...mount.children.values()]; };
      instance.render = mount.wrapper;
      xWebMounts.set(instance, mount);
    }
    const key = `sidex-native-${++xWebMountSequence}`;
    class SideXNativeHost extends Base {
      constructor(props) { super(props); this.state = { tree, failed: false }; }
      static getDerivedStateFromError() { return { failed: true }; }
      componentDidCatch(error) { options.onUncaughtError?.(error); }
      render() { return this.state.failed ? null : { $$typeof: Symbol.for('react.portal'), key,
        children: this.state.tree, containerInfo: host, implementation: null }; }
    }
    const ref = value => { component = value; };
    mount.children.set(key, xWebElement(SideXNativeHost, { key, ref }));
    return {
      render(next) {
        if (closed) return;
        tree = next;
        if (component) component.setState({ tree, failed: false });
        else instance.forceUpdate();
      },
      unmount() {
        if (closed) return;
        closed = true;
        mount.children.delete(key);
        if (!mount.children.size) {
          if (instance.render === mount.wrapper) instance.render = mount.original;
          xWebMounts.delete(instance);
        }
        instance.forceUpdate();
      }
    };
  }

  function xWebTemplate(kind, tweetId, focalTweetId) {
    const selectors = { more: 'button:has(use[href="#icon-more-dots-hor"])', share: '[data-engagement-action="share"]',
      grok: 'button:has(svg[data-icon="icon-logo-grok"])' };
    const fragment = { more: 'moreMenu_tweet', share: 'shareButton_tweet', grok: 'grokAnalyzeButton_tweet' }[kind];
    let fallback;
    for (const button of document.querySelectorAll(`main article[class~="group/post"] ${selectors[kind]}`)) {
      const key = Object.keys(button).find(name => name.startsWith('__reactFiber$'));
      let template;
      const providers = [];
      for (let fiber = key && button[key], depth = 0; fiber && depth < 800; fiber = fiber.return, depth++) {
        if (!template && fiber.memoizedProps?.tweet?.__fragments?.[fragment]) template = fiber;
        if (template && fiber.tag === 10 && fiber.memoizedProps && 'value' in fiber.memoizedProps) {
          const original = fiber.memoizedProps.value;
          // Feed-entry callbacks belong to the original row, not this reply.
          let value = original && typeof original === 'object' && ('entryId' in original || 'dismiss' in original)
            ? { ...original, entryId: undefined, feedbackInfo: undefined, dismiss: undefined } : original;
          if (original && typeof original === 'object' && 'focalTweetId' in original) value = { ...value, focalTweetId: focalTweetId || tweetId };
          providers.push({ type: fiber.type, value });
        }
      }
      if (!template) continue;
      const found = { template, providers };
      if (template.memoizedProps.tweet.permalink?.restId === tweetId) return found;
      fallback ||= found;
    }
    return fallback;
  }

  async function xWebTweetReference(tweetId, source) {
    const environment = nativeRelayEnvironment();
    if (!environment) return null;
    const supportsTarget = request => ['TweetDetail', 'TweetResultByRestId'].includes(request?.node?.params?.name);
    const retainedRequest = () => [...(environment.getStore()._roots?.values() || [])].reverse()
      .map(entry => entry.operation?.request).find(supportsTarget);
    let request = supportsTarget(source.__fragmentOwner) ? source.__fragmentOwner : retainedRequest();
    if (!request) {
      const native = xWebNavigation(), raw = cachedRawTweet(tweetId);
      const handle = raw?.core?.user_results?.result?.core?.screen_name || 'i';
      if (typeof native?.router?.preloadRoute !== 'function') return null;
      let timer;
      try {
        await Promise.race([native.router.preloadRoute({ to: `/${handle}/status/${tweetId}` }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('X_NATIVE_READ_TIMEOUT')), 12000); })]);
      } finally { clearTimeout(timer); }
      request = retainedRequest();
    }
    if (!request) return null;
    const variables = request.node.params.name === 'TweetResultByRestId'
      ? { ...request.variables, restId: tweetId, withFocalTweet: true }
      : { ...request.variables, focalTweetId: tweetId, cursor: null, withFocalTweet: true };
    const descriptor = { ...request, variables,
      identifier: request.node.params.id + JSON.stringify(Object.fromEntries(Object.entries(variables).sort(([a], [b]) => a.localeCompare(b)))) };
    const operation = { request: descriptor,
      root: { dataID: 'client:root', node: request.node.operation, variables },
      fragment: { dataID: 'client:root', node: request.node.fragment, variables, owner: descriptor, isWithinUnmatchedTypeRefinement: false } };
    let raw;
    const retention = environment.retain(operation);
    try {
      await new Promise((resolve, reject) => {
        let subscription;
        const timer = setTimeout(() => { subscription?.unsubscribe(); reject(new Error('X_NATIVE_READ_TIMEOUT')); }, 12000);
        subscription = environment.execute({ operation }).subscribe({ next(json) {
          const visit = node => {
            if (!node || typeof node !== 'object' || raw) return;
            if (node.rest_id === tweetId && node.id && node.core) { raw = node; return; }
            Object.values(node).forEach(visit);
          };
          visit(json?.data);
        }, error(error) { clearTimeout(timer); reject(error); }, complete() { clearTimeout(timer); resolve(); } });
      });
      if (!raw) { retention.dispose(); return null; }
      return { reference: { __id: raw.id, __fragments: source.__fragments, __fragmentOwner: descriptor }, release: () => retention.dispose() };
    } catch (error) { retention.dispose(); throw error; }
  }
  // Installed at document_start, before X's own Escape handler. A quick tool
  // owns the whole modal stack it opened, rather than just its last picker.
  window.addEventListener("keydown", event => {
    const session = quickToolSession;
    if (event.key !== "Escape" || !session || !document.querySelector('#layers [role="dialog"], [role="dialog"][data-slot="xds-modal-surface"]')) return;
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
    if (nativeComposerEditors().length) throw new Error("NATIVE_DRAFT_ALREADY_OPEN");
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
    const modern = xWebNavigation();
    if (modern) {
      const index = modern.history?.location?.state?.__TSR_index;
      if (quickTool && !Number.isInteger(index)) return { opened: false };
      const path = location.pathname + location.search;
      quickToolSession = quickTool ? {
        path, index, router: {
          get _currentLocationIndex() { return modern.history.location.state.__TSR_index; },
          go(delta) { modern.history.go(delta); }
        }
      } : null;
      modern.navigation.push(`/compose/post?in_reply_to=${tweetId}`);
      return { opened: true };
    }
    return { opened: false };
  }

  // Use X's loaded schemas and React components. Do not copy a timeline
  // button's handlers: those closures would still act on the timeline post.
  function nativePostRuntime() {
    if (isXWebClient()) return { react: { createElement: xWebElement }, reactDom: { createRoot: xWebCreateRoot } };
    const modules = Object.values(getWebpackRuntime()?.c || {}).map(module => module?.exports).filter(Boolean);
    let normalize, denormalize, tweetSchema, tweetApi, react, reactDom;
    for (const exports of modules) {
      if (Object.hasOwn(exports, "createElement") && typeof exports.createElement === "function" && typeof exports.useState === "function") react = exports;
      if (Object.hasOwn(exports, "createRoot") && typeof exports.createRoot === "function") reactDom = exports;
      const values = Object.values(exports);
      tweetApi ||= values.find(value => value && Object.hasOwn(value, "addTweet") && value.namespace === "tweets" &&
        typeof value.add === "function" && typeof value.selectHydrated === "function");
      const normalizer = values.find(value => typeof value === "function" &&
        Function.prototype.toString.call(value).includes("Unexpected input given to normalize"));
      if (normalizer) {
        normalize = normalizer;
        denormalize = values.find(value => typeof value === "function" && value.length === 3 && value !== normalize);
      }
      tweetSchema ||= values.find(value => value?.key === "tweets" && value._idAttribute === "rest_id" &&
        typeof value.normalize === "function" && typeof value.denormalize === "function");
    }
    return { normalize, denormalize, tweetSchema, tweetApi, react, reactDom };
  }

  let nativeUserHover = null;
  function closeNativeUserHover(token) {
    const session = nativeUserHover;
    if (!session || (token !== undefined && session.token !== token)) return;
    nativeUserHover = null;
    session.finish?.(false);
    session.root?.unmount();
    session.host.remove();
  }

  async function prepareNativeUserHover(screenName, token, anchor) {
    if (!/^[A-Za-z0-9_]{1,30}$/.test(screenName) || !Number.isSafeInteger(token)) return { ready: false };
    const runtime = nativePostRuntime();
    if (!runtime.react || !runtime.reactDom) return { ready: false };
    let template = null;
    const providers = [];
    for (const link of document.querySelectorAll('#react-root a[href], main a[href]')) {
      if (link.closest('#sidepeek-drawer-root, #layers')) continue;
      const key = Object.keys(link).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = key && link[key], depth = 0; fiber && depth < 800; fiber = fiber.return, depth++) {
        const props = fiber.memoizedProps;
        // X's own profile-hover wrapper accepts screenName and a child link.
        // Re-render it for the requested handle instead of copying callbacks
        // that still refer to the timeline author's profile.
        if (typeof props?.screenName === 'string' && props.children &&
            (isXWebClient() || (!template && ('onAvatarClick' in props || 'onScreenNameClick' in props)))) {
          template = fiber;
          providers.length = 0;
        }
        if (template && fiber.tag === 10 && props && 'value' in props) providers.push({ type: fiber.type, value: props.value });
      }
      if (template) break;
    }
    if (!template) return { ready: false };
    closeNativeUserHover();
    const host = document.createElement('div');
    host.dataset.sidexNativeProfileSource = String(token);
    host.setAttribute('aria-hidden', 'true');
    const coord = value => Number.isFinite(value) ? value : 0;
    Object.assign(host.style, { position: 'fixed', left: `${coord(anchor?.left)}px`, top: `${coord(anchor?.top)}px`,
      width: `${Math.max(1, coord(anchor?.width))}px`, height: `${Math.max(1, coord(anchor?.height))}px`, opacity: '0', pointerEvents: 'none' });
    document.body.append(host);
    const session = { token, host, root: null, finish: null };
    nativeUserHover = session;
    const ready = new Promise(resolve => {
      const observer = new MutationObserver(() => { if (host.querySelector('a')) session.finish(true); });
      const timer = setTimeout(() => session.finish(false), 1500);
      session.finish = value => { clearTimeout(timer); observer.disconnect(); resolve(value); };
      observer.observe(host, { childList: true, subtree: true });
    });
    try {
      const React = runtime.react;
      let tree = React.createElement(template.type, { screenName },
        React.createElement('a', { href: `/${screenName}`, tabIndex: -1 }, `@${screenName}`));
      for (const provider of providers) tree = React.createElement(provider.type, { value: provider.value }, tree);
      session.root = runtime.reactDom.createRoot(host, { onUncaughtError: () => closeNativeUserHover(token) });
      session.root.render(tree);
      if (host.querySelector('a')) session.finish(true);
      if (await ready && nativeUserHover === session) {
        if (isXWebClient()) {
          const link = host.querySelector('a');
          const key = Object.keys(link).find(name => name.startsWith('__reactFiber$'));
          let opened = false;
          for (let fiber = key && link[key], depth = 0; fiber && depth < 100; fiber = fiber.return, depth++) {
            const store = fiber.memoizedProps?.value;
            if (typeof store?.setOpen !== 'function' || !store.state?.floatingRootContext) continue;
            store.setOpen(true, { trigger: link, reason: 'trigger-hover',
              event: new MouseEvent('mouseenter', { clientX: coord(anchor?.left) + 4, clientY: coord(anchor?.top) + 4 }) });
            opened = true;
            break;
          }
          if (!opened) { closeNativeUserHover(token); return { ready: false }; }
        }
        return { ready: true };
      }
    } catch { /* The readable fallback remains available if X changes its wrapper. */ }
    closeNativeUserHover(token);
    return { ready: false };
  }

  function nativeActionTemplate(tweetId) {
    let fallback = null;
    for (const button of document.querySelectorAll('article[data-testid="tweet"] button[aria-haspopup="menu"]')) {
      const key = Object.keys(button).find(name => name.startsWith("__reactFiber$"));
      let template = null;
      const providers = [];
      for (let fiber = key && button[key], depth = 0; fiber && depth < 800; fiber = fiber.return, depth++) {
        if (!template && typeof fiber.stateNode?._renderShareAction === "function" &&
            typeof fiber.stateNode?._getShareMenuActionItems === "function") template = fiber;
        if (fiber.tag === 10 && fiber.memoizedProps && "value" in fiber.memoizedProps) {
          providers.push({ type: fiber.type, value: fiber.memoizedProps.value });
        }
      }
      if (!template) continue;
      const found = { template, providers };
      if (String(template.memoizedProps?.tweet?.id_str) === tweetId) return found;
      fallback ||= found;
    }
    return fallback;
  }

  function nativeHeaderTemplate(tweetId, kind) {
    let fallback = null;
    for (const button of document.querySelectorAll('article[data-testid="tweet"] button[data-testid="caret"], article[data-testid="tweet"] button[aria-label="Grok actions"]')) {
      const key = Object.keys(button).find(name => name.startsWith("__reactFiber$"));
      let template = null, owner = null;
      const providers = [];
      for (let fiber = key && button[key], depth = 0; fiber && depth < 800; fiber = fiber.return, depth++) {
        if (!owner && (kind === "grok" ? typeof fiber.stateNode?._renderGrokButton === "function" &&
            typeof fiber.stateNode?._openGrok === "function" : typeof fiber.stateNode?._renderCurationActionMenu === "function")) {
          owner = template = fiber;
        }
        // Keep the native connected wrapper so its account and author state
        // is selected again for the requested tweet instead of the source row.
        if (owner && kind === "more" && fiber.memoizedProps?.tweet === owner.memoizedProps.tweet &&
            typeof fiber.type?.preload === "function" && typeof fiber.type?.render === "function") {
          template = fiber;
          providers.length = 0;
        }
        if (fiber.tag === 10 && fiber.memoizedProps && "value" in fiber.memoizedProps) {
          providers.push({ type: fiber.type, value: fiber.memoizedProps.value });
        }
      }
      if (!template) continue;
      const found = { template, owner, providers };
      if (String(template.memoizedProps?.tweet?.id_str) === tweetId) return found;
      fallback ||= found;
    }
    return fallback;
  }

  async function openNativeGrok(tweetId) {
    if (isXWebClient()) return openXWebNativeControl(tweetId, { left: 0, top: 0, width: 32, height: 32 }, undefined, 'grok');
    const found = nativeHeaderTemplate(tweetId, "grok");
    if (!found) return { opened: false };
    const tweet = await nativeTweet(tweetId, found.owner, nativePostRuntime());
    if (!tweet) return { opened: false };
    const target = tweet.retweeted_status || tweet;
    // This native navigator accepts an explicit analysis entity and prompt;
    // a copied row's onClick would keep analyzing that row's original tweet.
    await found.owner.stateNode._openGrok({
      text: `https://x.com${target.permalink || `/${target.user.screen_name}/status/${target.id_str}`}`,
      analysisEntityId: target.id_str, autoSubmit: true, source: "post_analysis_timeline",
      promptMetadata: { promptSource: "GROK_ANALYZE", action: "INPUT", properties: { element: "BUTTON" } }
    });
    return { opened: true };
  }

  function cachedRawTweet(tweetId) {
    const seen = new Set();
    function visit(value) {
      if (!value || typeof value !== "object" || seen.has(value)) return null;
      seen.add(value);
      if (value.tweet && String(value.tweet.rest_id) === tweetId && (value.tweet.legacy || value.tweet.details) && value.tweet.core) {
        return { ...value.tweet, limitedActionResults: value.limitedActionResults || value.tweet.limitedActionResults,
          mediaVisibilityResults: value.mediaVisibilityResults || value.tweet.mediaVisibilityResults };
      }
      if (String(value.rest_id || value.legacy?.id_str || "") === tweetId && (value.legacy || value.details) && value.core) return value;
      for (const child of Object.values(value)) {
        const found = visit(child);
        if (found) return found;
      }
      return null;
    }
    for (const entry of [...observedThreadCache.values()].reverse()) {
      const found = visit(entry.json);
      if (found) return found;
    }
    return null;
  }

  async function nativeTweet(tweetId, template, runtime) {
    const existing = template?.memoizedProps?.tweet;
    if (String(existing?.id_str) === tweetId) return existing;
    const store = template?.stateNode?.context?.store;
    const hydrated = store && runtime.tweetApi?.selectHydrated(store.getState(), tweetId);
    if (String(hydrated?.id_str) === tweetId && hydrated.user?.screen_name) return hydrated;
    let raw = cachedRawTweet(tweetId);
    if (!raw) {
      const json = await readThread(tweetId);
      cacheThreadResponse(tweetId, "", json);
      raw = cachedRawTweet(tweetId);
    }
    if (!raw || !runtime.normalize || !runtime.denormalize || !runtime.tweetSchema) return null;
    // Import real source entities through X's own cache action. Its Quote and
    // Chat previews select the target from that cache, even with router data.
    const result = runtime.normalize(raw, runtime.tweetSchema);
    if (store && runtime.tweetApi) {
      store.dispatch({ ...runtime.tweetApi.add({}), payload: result.entities });
      const tweet = runtime.tweetApi.selectHydrated(store.getState(), tweetId);
      if (String(tweet?.id_str) === tweetId && tweet.user?.screen_name) return tweet;
    }
    const tweet = runtime.denormalize(result.result, runtime.tweetSchema, result.entities);
    if (String(tweet?.id_str) !== tweetId || !tweet.user?.screen_name) return null;
    // The normalizer supplies entities; X's hydrated selector adds this link.
    // Quote previews and Copy link both require it even with a complete tweet.
    return { ...tweet, permalink: tweet.permalink || `/${tweet.user.screen_name}/status/${tweetId}` };
  }

  function hasNativeComposer() {
    return nativeComposerEditors().length > 0;
  }

  async function openNativeQuote(tweetId) {
    if (hasNativeComposer()) throw new Error("NATIVE_DRAFT_ALREADY_OPEN");
    if (isXWebClient()) {
      const native = xWebNavigation();
      if (!native) return { opened: false };
      native.navigation.push(`/compose/post?quote_tweet_id=${tweetId}`);
      return { opened: true };
    }
    const { template } = nativeActionTemplate(tweetId) || {};
    const tweet = await nativeTweet(tweetId, template, nativePostRuntime());
    if (!tweet) return { opened: false };
    // This is the state used by X's actual Quote menu item, rather than a
    // Web Intent URL which pastes a bare link into the editable text.
    const router = template?.memoizedProps?.history;
    if (typeof router?.push !== "function") return { opened: false };
    // A composer may have opened while the target was being read.
    if (hasNativeComposer()) throw new Error("NATIVE_DRAFT_ALREADY_OPEN");
    router.push("/compose/post", { quotedStatus: tweet, fromApp: true, previousPath: location.pathname + location.search });
    return { opened: true };
  }

  let nativeShareSession = null;
  let nativeShareGeneration = 0;
  function closeNativeShare() {
    nativeShareGeneration++;
    nativeShareSession?.close();
    nativeShareSession = null;
    return { closed: true };
  }

  async function openXWebNativeControl(tweetId, anchor, menuToken, kind, focalTweetId) {
    closeNativeShare();
    const generation = nativeShareGeneration;
    const found = xWebTemplate(kind, tweetId, focalTweetId);
    if (!found || !anchor || ![anchor.left, anchor.top, anchor.width, anchor.height].every(Number.isFinite)) return { opened: false };
    const target = await xWebTweetReference(tweetId, found.template.memoizedProps.tweet);
    if (!target || generation !== nativeShareGeneration) { target?.release(); return { opened: false }; }
    const host = document.createElement('div');
    host.setAttribute(`data-sidex-native-${kind}`, tweetId);
    Object.assign(host.style, { position: 'fixed', left: `${anchor.left}px`, top: `${anchor.top}px`,
      width: `${anchor.width}px`, height: `${anchor.height}px`, opacity: '0', pointerEvents: 'none' });
    document.body.append(host);
    const props = { ...found.template.memoizedProps, tweet: target.reference, promotion: undefined };
    for (const key of Object.keys(props)) if (/^on[A-Z]/.test(key)) delete props[key];
    let tree = xWebElement(found.template.type, props);
    for (const provider of found.providers) tree = xWebElement(provider.type, { value: provider.value, children: tree });
    return new Promise(resolve => {
      let root, observer, timer, clicked = false, opened = false, settled = false, closed = false;
      const finish = value => { if (!settled) { settled = true; resolve({ opened: value }); } };
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer); observer?.disconnect(); root?.unmount(); host.remove(); target.release();
        if (nativeShareSession?.close === close) nativeShareSession = null;
        if (kind !== 'grok') window.postMessage({ source: PAGE_SOURCE, type: kind === 'more' ? 'NATIVE_MORE_CLOSED' : 'NATIVE_SHARE_CLOSED', tweetId, menuToken }, location.origin);
        finish(false);
      };
      nativeShareSession = { close };
      try {
        root = xWebCreateRoot(host, { onUncaughtError: close });
        observer = new MutationObserver(() => {
          if (!host.isConnected || generation !== nativeShareGeneration) { close(); return; }
          const button = host.querySelector(kind === 'grok' ? 'button' : 'button[aria-haspopup="menu"]');
          if (!button) return;
          if (!clicked) {
            if (button.disabled || button.getAttribute('aria-disabled') === 'true') { close(); return; }
            clicked = true; button.click();
            if (kind === 'grok') { clearTimeout(timer); finish(true); timer = setTimeout(close, 15000); }
          } else if (button.getAttribute('aria-expanded') === 'true' && document.querySelector('[data-base-ui-portal] [role="menu"]')) {
            opened = true; clearTimeout(timer); finish(true);
          } else if (opened && button.getAttribute('aria-expanded') !== 'true' && !nativeComposerEditors().length && !document.querySelector('[data-base-ui-portal] [role="dialog"]')) close();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
        timer = setTimeout(close, 5000);
        root.render(tree);
      } catch { close(); }
    });
  }

  async function openNativeShare(tweetId, anchor, menuToken, kind = "share", focalTweetId) {
    if (isXWebClient()) return openXWebNativeControl(tweetId, anchor, menuToken, kind, focalTweetId);
    closeNativeShare();
    const generation = nativeShareGeneration;
    if (!anchor || ![anchor.left, anchor.top, anchor.width, anchor.height].every(Number.isFinite)) return { opened: false };
    const found = kind === "more" ? nativeHeaderTemplate(tweetId, kind) : nativeActionTemplate(tweetId);
    const runtime = nativePostRuntime();
    if (!found || !runtime.react || !runtime.reactDom) return { opened: false };
    const { template, providers } = found;
    const tweet = await nativeTweet(tweetId, found.owner || template, runtime);
    if (!tweet || generation !== nativeShareGeneration) return { opened: false };
    const context = found.owner?.stateNode?.context;
    const focal = context?.store && /^\d+$/.test(focalTweetId || "") &&
      runtime.tweetApi?.selectHydrated(context.store.getState(), focalTweetId);
    const canHideReply = Boolean(tweet.in_reply_to_status_id_str && context?.viewerUserId &&
      focal?.user?.id_str === context.viewerUserId && tweet.user?.id_str !== context.viewerUserId);
    const React = runtime.react;
    const Base = template.type;
    let NativeShare = Base;
    if (kind === "share") NativeShare = class extends Base {
      render() { return this._renderShareAction({ color: "gray700", iconSize: "normal", withCount: false }); }
    };
    const host = document.createElement("div");
    host.setAttribute(`data-sidex-native-${kind}`, tweetId);
    Object.assign(host.style, { position: "fixed", left: `${anchor.left}px`, top: `${anchor.top}px`,
      width: `${anchor.width}px`, height: `${anchor.height}px`, zIndex: "2147483646" });
    // The drawer is transformed, so a fixed child would add the drawer's
    // offset a second time. Keep the native anchor in viewport coordinates.
    document.body.append(host);
    return new Promise(resolve => {
      let root, observer, timer, clicked = false, opened = false, settled = false, closed = false;
      const finish = value => { if (!settled) { settled = true; resolve({ opened: value }); } };
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        observer?.disconnect();
        root?.unmount();
        host.remove();
        if (nativeShareSession?.close === close) nativeShareSession = null;
        window.postMessage({ source: PAGE_SOURCE, type: kind === "more" ? "NATIVE_MORE_CLOSED" : "NATIVE_SHARE_CLOSED", tweetId, menuToken }, location.origin);
        finish(false);
      };
      nativeShareSession = { close };
      try {
        // Replace every target-specific prop. Retain X's providers and bound
        // session actions so folders, Chat and media use their official flows.
        const menuProps = { ...template.memoizedProps, ref: undefined,
          id: tweetId, tweetId, tweet, isFocalTweet: false, liveCounts: {}, promotedContent: undefined,
          socialContext: undefined, forwardPivotInfo: undefined, nudges: undefined,
          bookmarkFolderId: undefined, withRemoveFromBookmarks: false };
        if (kind === "more") Object.assign(menuProps, {
          // Timeline feedback and dismiss callbacks close over their source row.
          feedbackItems: undefined, forwardPivotDisplayType: undefined, forwardPivotLandingUrl: undefined,
          onMenuClick: undefined, onTweetDismiss: undefined, setLeaveBehindActionItems: undefined,
          withImmediateDismiss: false, isDisabled: false,
          isPinned: Boolean(tweet.user?.pinned_tweet_ids_str?.includes(tweetId)),
          isNsfwUser: Boolean(tweet.user?.possibly_sensitive),
          withHideReply: canHideReply && !tweet.is_hidden,
          withUnhideReply: canHideReply && Boolean(tweet.is_hidden), withViewHiddenReplies: true
        });
        let tree = React.createElement(NativeShare, menuProps);
        for (const { type, value } of providers) tree = React.createElement(type, { value }, tree);
        observer = new MutationObserver(() => {
          if (!host.isConnected || generation !== nativeShareGeneration) { close(); return; }
          const button = host.querySelector(kind === "more" ? 'button[data-testid="caret"]' : 'button[aria-haspopup="menu"]');
          if (!button) return;
          if (!clicked) {
            if (button.disabled || button.getAttribute("aria-disabled") === "true") { close(); return; }
            clicked = true;
            button.click();
          } else if (button.getAttribute("aria-expanded") === "true" && document.querySelector('#layers [role="menu"]')) {
            opened = true; clearTimeout(timer); finish(true);
          } else if (opened && button.getAttribute("aria-expanded") !== "true" && !document.querySelector('#layers [role="dialog"]')) close();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
        timer = setTimeout(close, 2500);
        root = runtime.reactDom.createRoot(host, { onUncaughtError: () => setTimeout(close, 0) });
        root.render(tree);
      } catch { close(); }
    });
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.source !== CONTENT_SOURCE || !Number.isInteger(message.requestId)) return;

    if (message.type === "PREPARE_NATIVE_USER_HOVER" || message.type === "CLOSE_NATIVE_USER_HOVER") {
      try {
        const payload = message.type === "PREPARE_NATIVE_USER_HOVER"
          ? await prepareNativeUserHover(String(message.screenName || ''), message.hoverToken, message.anchor)
          : (closeNativeUserHover(message.hoverToken), { closed: true });
        respond(message.requestId, true, payload);
      } catch { respond(message.requestId, true, { ready: false }); }
      return;
    }

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
      else if (message.type === "OPEN_NATIVE_QUOTE") payload = await openNativeQuote(tweetId);
      else if (message.type === "OPEN_NATIVE_SHARE") payload = await openNativeShare(tweetId, message.anchor, message.menuToken);
      else if (message.type === "OPEN_NATIVE_MORE") payload = await openNativeShare(tweetId, message.anchor, message.menuToken, "more", message.focalTweetId);
      else if (message.type === "OPEN_NATIVE_GROK") payload = await openNativeGrok(tweetId);
      else if (message.type === "CLOSE_NATIVE_MORE") payload = closeNativeShare();
      else if (message.type === "CLOSE_NATIVE_SHARE") payload = closeNativeShare();
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
