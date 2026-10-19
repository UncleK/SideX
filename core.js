(function attachSidePeekCore(root) {
  "use strict";

  const STATUS_PATTERN = /^\/(?:i\/web\/status\/(\d+)|(?:i|([^/?#]+))\/article\/(\d+)|([^/?#]+)\/status\/(\d+))/i;
  const PROFILE_PATTERN = /^\/([A-Za-z0-9_]+)\/?$/;

  function normalizePostUrl(href, baseUrl = "https://x.com/") {
    if (!href || typeof href !== "string") return null;
    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      return null;
    }
    if (!/^(?:x|twitter)\.com$/i.test(url.hostname.replace(/^www\./, ""))) return null;
    const match = url.pathname.match(STATUS_PATTERN);
    if (!match) return null;
    const id = match[1] || match[3] || match[5];
    const handle = match[2] || match[4] || "i";
    return `https://x.com/${handle}/status/${id}`;
  }

  function postIdFromUrl(href) {
    const normalized = normalizePostUrl(href);
    return normalized ? normalized.match(/\/status\/(\d+)$/)?.[1] ?? null : null;
  }

  function isPostDetailUrl(href, baseUrl = "https://x.com/") {
    return Boolean(normalizePostUrl(href, baseUrl));
  }

  function profileHandle(profileHref) {
    return String(profileHref || "").match(PROFILE_PATTERN)?.[1]?.toLowerCase() || null;
  }

  function selectOwnPostUrl(hrefs, profileHref, baseUrl = "https://x.com/") {
    const normalized = [...new Set((hrefs || []).map((href) => normalizePostUrl(href, baseUrl)).filter(Boolean))];
    const handle = profileHandle(profileHref);
    if (!handle) return normalized[0] || null;
    return normalized.find((url) => new URL(url).pathname.split("/")[1]?.toLowerCase() === handle) || normalized[0] || null;
  }

  function objectValue(value) {
    return value && typeof value === "object" ? value : null;
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function tweetLength(text) {
    if (!text) return 0;
    return root.SidePeekTwitterText.parseTweet(String(text)).weightedLength;
  }

  function unwrapResult(value) {
    let current = objectValue(value);
    for (let index = 0; current && index < 6; index += 1) {
      // Visibility wrappers may still contain the original body and media.
      if (current.tweetInterstitial || /Tombstone|Unavailable/i.test(current.__typename || "")) return null;
      if (current.legacy && current.rest_id) return current;
      if (objectValue(current.tweet)) {
        current = current.tweet;
        continue;
      }
      if (objectValue(current.result)) {
        current = current.result;
        continue;
      }
      break;
    }
    return current?.legacy && current?.rest_id ? current : null;
  }

  function unwrapUser(value) {
    let current = objectValue(value);
    for (let index = 0; current && index < 4; index += 1) {
      const hasProfile = current.legacy?.screen_name || current.core?.screen_name || current.avatar?.image_url;
      if (hasProfile || current.__typename === "User") return current;
      if (objectValue(current.result)) {
        current = current.result;
        continue;
      }
      break;
    }
    return current?.legacy || current?.core ? current : null;
  }

  // X now returns profile fields in separate objects; older responses use legacy.
  // Keep unknown counts/relationships unknown instead of displaying a false zero.
  function userModel(value) {
    const user = unwrapUser(value);
    if (!user) return null;
    const legacy = user.legacy || {};
    const core = user.core || {};
    const relations = user.relationship_perspectives || {};
    const counts = user.relationship_counts || {};
    const optionalCount = (value) => value == null ? null : numberValue(value);
    return {
      id: String(user.rest_id || legacy.id_str || ""),
      name: core.name ?? legacy.name ?? "",
      handle: core.screen_name ?? legacy.screen_name ?? "",
      avatar: String(user.avatar?.image_url ?? legacy.profile_image_url_https ?? "").replace("_normal.", "_200x200."),
      banner: user.banner?.image_url ?? legacy.profile_banner_url ?? "",
      bio: user.profile_bio?.description ?? legacy.description ?? core.description ?? "",
      bioUrls: (user.profile_bio?.entities?.description?.urls ?? legacy.entities?.description?.urls ?? []).map(url => ({
        url: url.url, expandedUrl: url.expanded_url, displayUrl: url.display_url
      })),
      followersCount: optionalCount(counts.followers ?? legacy.followers_count),
      followingCount: optionalCount(counts.following ?? legacy.friends_count),
      following: relations.following ?? legacy.following ?? null,
      followedBy: relations.followed_by ?? legacy.followed_by ?? null,
      blocking: relations.blocking ?? legacy.blocking ?? null,
      muting: relations.muting ?? legacy.muting ?? null,
      protected: user.privacy?.protected ?? legacy.protected ?? false,
      location: user.location?.location ?? legacy.location ?? "",
      url: user.profile_bio?.entities?.url?.urls?.[0]?.expanded_url ?? legacy.entities?.url?.urls?.[0]?.expanded_url ?? user.website?.url ?? legacy.url ?? "",
      verified: Boolean(user.is_blue_verified || user.verification?.verified || legacy.verified),
      verifiedType: user.verification?.verified_type || user.verified_type || (user.is_blue_verified || legacy.verified ? "Blue" : "")
    };
  }

  function mediaItems(legacy, tweet) {
    const modernMedia = Array.isArray(tweet?.media)
      ? tweet.media
      : tweet?.media?.all || tweet?.media?.media || [];
    const media = legacy?.extended_entities?.media || legacy?.entities?.media || modernMedia;
    return (media || []).map((item) => {
      const rawType = String(item.type || item.media_type || item.__typename || "").toLowerCase();
      const isGif = rawType.includes("animated") || rawType === "gif";
      const isVideo = rawType.includes("video");
      const type = isGif ? "animated_gif" : isVideo ? "video" : "photo";
      const variants = item.video_info?.variants || item.videoInfo?.variants || [];
      const mp4Variant = variants
        .filter((v) => (v.content_type || "").includes("mp4") && v.url)
        .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0))[0];

      return {
        id: item.id_str || item.media_key || item.media_url_https,
        type,
        url: item.media_url_https || item.media_url || "",
        videoUrl: mp4Variant?.url || "",
        expandedUrl: item.expanded_url || "",
        width: numberValue(item.original_info?.width || item.sizes?.large?.w),
        height: numberValue(item.original_info?.height || item.sizes?.large?.h)
      };
    }).filter((item) => item.url || item.videoUrl);
  }

  function extractCard(tweet, legacy) {
    const card = tweet?.card || tweet?.unified_card;
    if (!card) return null;
    const legacyCard = card.legacy || card;
    const values = Object.create(null);
    for (const b of (legacyCard.binding_values || [])) {
      if (b && b.key && b.value) {
        values[b.key] = b.value.string_value || b.value.image_value?.url || b.value.boolean_value || "";
      }
    }
    const title = values.title || "";
    const description = values.description || "";
    const domain = values.vanity_url || values.domain || "";
    const image = values.summary_photo_image_large || values.photo_image_full_size || values.thumbnail_image || values.player_image || "";
    const url = values.card_url || legacy?.entities?.urls?.[0]?.expanded_url || "";
    if (title || domain || image) {
      return { title, description, domain, image, url };
    }
    return null;
  }

  function tweetModel(value, depth = 0) {
    const tweet = unwrapResult(value);
    if (!tweet) return null;
    const legacy = tweet.legacy || {};
    const user = unwrapUser(tweet.core?.user_results) || unwrapUser(tweet.user_results);
    const userLegacy = user?.legacy || {};
    const userCore = user?.core || {};
    const note = tweet.note_tweet?.note_tweet_results?.result;
    let text = typeof note?.text === "string" ? note.text : String(legacy.full_text || legacy.text || "");
    const handle = userLegacy.screen_name || userCore.screen_name || "";
    const id = String(tweet.rest_id || legacy.id_str || "");
    const quoted = depth < 1 ? tweetModel(tweet.quoted_status_result, depth + 1) : null;
    const media = mediaItems(legacy, tweet);

    // Apply offsets before modifying text. A leading @mention inside the
    // display range is authored content, even when this tweet is a reply.
    const range = legacy.display_text_range;
    if (typeof note?.text !== "string" && Array.isArray(range) &&
        Number.isInteger(range[0]) && range[0] > 0 && range[0] <= text.length) {
      text = text.slice(range[0]);
    }

    // Remove only links identified as attachments. A photo/video reply can
    // also end with a real source link; its t.co hostname proves nothing.
    const mediaEntities = [
      ...(legacy.extended_entities?.media || []),
      ...(legacy.entities?.media || []),
      ...(note?.entity_set?.media || [])
    ];
    const mediaUrls = new Set(mediaEntities.map((m) => m.url).filter(Boolean));
    text = text.replace(/https?:\/\/t\.co\/[A-Za-z0-9]+/g, url => mediaUrls.has(url) ? "" : url).trim();
    const rawUrls = [
      ...(legacy.entities?.urls || []),
      ...(note?.entity_set?.urls || [])
    ];
    const seenUrls = new Set();
    const urls = [];
    for (const u of rawUrls) {
      if (!u || !u.url || seenUrls.has(u.url) || mediaUrls.has(u.url)) continue;
      seenUrls.add(u.url);
      urls.push({
        url: u.url,
        expandedUrl: u.expanded_url || u.url,
        displayUrl: u.display_url || u.expanded_url || u.url
      });
    }

    const rawMentions = [
      ...(legacy.entities?.user_mentions || []),
      ...(note?.entity_set?.user_mentions || [])
    ];
    const userMentions = [];
    const seenMentions = new Set();
    for (const m of rawMentions) {
      const sn = String(m.screen_name || "").toLowerCase();
      if (!sn || seenMentions.has(sn)) continue;
      seenMentions.add(sn);
      userMentions.push({
        screenName: m.screen_name,
        name: m.name || m.screen_name
      });
    }

    const rawHashtags = [
      ...(legacy.entities?.hashtags || []),
      ...(note?.entity_set?.hashtags || [])
    ];
    const hashtags = [];
    const seenHashtags = new Set();
    for (const h of rawHashtags) {
      const tag = String(h.text || "").toLowerCase();
      if (!tag || seenHashtags.has(tag)) continue;
      seenHashtags.add(tag);
      hashtags.push({
        text: h.text
      });
    }

    return {
      id,
      url: handle && id ? `https://x.com/${handle}/status/${id}` : id ? `https://x.com/i/status/${id}` : "",
      text,
      entities: {
        urls,
        userMentions,
        hashtags
      },
      author: userModel(user) || { id: "", name: "X 用户", handle: "", avatar: "" },
      createdAt: legacy.created_at || "",
      conversationId: String(legacy.conversation_id_str || ""),
      inReplyToId: String(legacy.in_reply_to_status_id_str || ""),
      inReplyToHandle: String(legacy.in_reply_to_screen_name || ""),
      reportedReplyCount: Number.isFinite(legacy.reply_count) ? legacy.reply_count : null,
      counts: {
        replies: numberValue(legacy.reply_count),
        reposts: numberValue(legacy.retweet_count),
        likes: numberValue(legacy.favorite_count),
        bookmarks: numberValue(legacy.bookmark_count),
        views: numberValue(tweet.views?.count)
      },
      flags: {
        liked: Boolean(legacy.favorited),
        reposted: Boolean(legacy.retweeted || legacy.current_user_retweet?.id_str),
        bookmarked: Boolean(legacy.bookmarked)
      },
      media,
      quote: quoted,
      card: extractCard(tweet, legacy),
      lang: String(legacy.lang || "").toLowerCase()
    };
  }

  function collectTweetModels(value) {
    const models = [];
    const seenNodes = new Set();
    const seenTweets = new Set();

    function visit(node) {
      if (!node || typeof node !== "object" || seenNodes.has(node)) return;
      seenNodes.add(node);
      if (node.promotedMetadata || node.promoted_metadata) return;
      const result = node.tweet_results?.result || node.tweetResult?.result;
      if (result) {
        const model = tweetModel(result);
        if (model?.id && !seenTweets.has(model.id)) {
          seenTweets.add(model.id);
          models.push(model);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      for (const child of Object.values(node)) visit(child);
    }

    visit(value);
    return models;
  }

  function replyPagination(value, requestTweetId, byId, gateScopeId = requestTweetId) {
    const page = { cursor: null, gated: null, ended: false, sectionLabel: "", inlineCursors: [], inlineModules: [] };
    function modulePagination(moduleId, items) {
      const branchRootId = /^conversationthread-(\d+)$/.exec(moduleId || "")?.[1];
      if (!branchRootId || !byId.has(branchRootId)) return;
      const branch = byId.get(branchRootId);
      const scope = { moduleId, branchRootId, requestTweetId,
        gateFor: branch._gateFor || "" };
      page.inlineModules.push(scope);
      let folded = Boolean(scope.gateFor);
      for (const item of items || []) {
        const content = item.item?.itemContent || item.itemContent;
        if ((content?.itemType || content?.__typename) === "TimelineLabel") folded = true;
        if (content?.cursorType === "ShowMore" && typeof content.value === "string" && content.value) {
          page.inlineCursors.push({ ...scope, gateFor: scope.gateFor || (folded ? gateScopeId : ""), cursor: content.value });
        }
      }
    }
    const seen = new Set();
    function visit(node) {
      if (!node || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      if (node.promotedMetadata || node.promoted_metadata || node.tweet_results || node.tweetResult ||
          /^tweetdetailrelatedtweets-/i.test(node.entryId || "")) return;
      if (node.type === "TimelineTerminateTimeline" && node.direction === "Bottom") page.ended = true;
      if (node.type === "TimelineAddToModule") {
        modulePagination(node.moduleEntryId, node.moduleItems);
        return;
      }
      // Inline cursors have their own scope and must not replace Bottom/Spam.
      if (node.entryType === "TimelineTimelineModule" || node.__typename === "TimelineTimelineModule" ||
          /^conversationthread-/i.test(String(node.entryId || ""))) {
        modulePagination(node.entryId, node.content?.items || node.items);
        return;
      }
      if (node.cursorType === "Bottom" && typeof node.value === "string") page.cursor = node.value;
      if (/^ShowMoreThreads?$/i.test(node.cursorType || "") && typeof node.value === "string") {
        page.gated = { cursor: node.value, label: node.displayTreatment?.actionText || "" };
      }
      if ((node.itemType || node.__typename) === "TimelineLabel" && typeof node.text === "string") page.sectionLabel = node.text;
      if (Array.isArray(node)) node.forEach(visit);
      else Object.values(node).forEach(visit);
    }
    visit(value);
    if (page.ended) page.cursor = null;
    return page;
  }

  // Retain the timeline boundary instead of flattening a folded section into
  // normal replies. Request context carries it across subsequent cursor pages.
  function sectionedTweetModels(value, focalId, section, unavailableIds = new Set()) {
    const models = [];
    function visit(node, label = section || "", sourceEntryId = "") {
      if (!node || typeof node !== "object" || node.promotedMetadata || node.promoted_metadata) return;
      if (/^tweetdetailrelatedtweets-/i.test(node.entryId || "")) return;
      sourceEntryId = node.entryId || sourceEntryId;
      if (Array.isArray(node)) {
        let current = label;
        for (const child of node) {
          const item = child?.content?.itemContent || child?.item?.itemContent || child?.itemContent;
          if ((item?.itemType || item?.__typename) === "TimelineLabel") current = item.text || current;
          visit(child, current, sourceEntryId);
        }
        return;
      }
      const result = node.tweet_results?.result || node.tweetResult?.result;
      if (result) {
        const model = tweetModel(result);
        if (model) {
          if (label && model.id !== focalId) { model._gateFor = focalId; model._sectionLabel = label; }
          models.push(model);
        } else {
          const id = result.rest_id || result.tweet?.rest_id || /(?:^tweet-|-tweet-)(\d+)$/.exec(sourceEntryId)?.[1];
          if (id) unavailableIds.add(String(id));
        }
        return;
      }
      Object.values(node).forEach(child => visit(child, label, sourceEntryId));
    }
    visit(value);
    return [...new Map(models.map(model => [model.id, model])).values()];
  }

  function parseTweetDetail(json, focalTweetId, knownModels = [], section = "") {
    const focalId = String(focalTweetId || "");
    const observed = (json?.sidepeekObservedThreads || []).slice(-12);
    const merged = new Map();
    const unavailable = new Set();
    let currentOrder = [];
    // Native X may have loaded descendants absent from a later, shorter child
    // request (even when that request reports zero replies and no cursor).
    for (const snapshot of [...observed, { json }]) {
      const blocked = new Set();
      const models = sectionedTweetModels(snapshot.json?.data || snapshot.json, focalId,
        snapshot.json === json ? section : "", blocked);
      if (snapshot.json === json) currentOrder = models.map(model => model.id);
      for (const model of models) { merged.set(model.id, model); unavailable.delete(model.id); }
      for (const id of blocked) { merged.delete(id); unavailable.add(id); }
    }
    // Cache insertion order must not move a previously visited reply ahead of
    // the current timeline. Keep cached-only descendants after live models,
    // without changing the content or visibility precedence above.
    const orderedIds = new Set([...currentOrder, ...merged.keys()]);
    const models = [...orderedIds].map(id => merged.get(id)).filter(Boolean);
    // Cursor pages may omit the focal tweet and intermediate parents.
    const byId = new Map([...knownModels, ...models].filter(model => model && !unavailable.has(model.id)).map((model) => [model.id, model]));
    const pagination = replyPagination(json?.data || json, focalId, byId);
    const nativeContinuations = new Map();
    const nativeModules = new Map();
    const liveModules = new Set(pagination.inlineModules.map(entry => `${entry.requestTweetId}:${entry.moduleId}`));
    for (const snapshot of observed) {
      for (const [key, entry] of nativeContinuations) {
        if (entry.requestTweetId === snapshot.requestTweetId && entry.cursor === snapshot.cursor) nativeContinuations.delete(key);
      }
      const nativePage = replyPagination(snapshot.json?.data || snapshot.json, snapshot.requestTweetId, byId, focalId);
      for (const scope of nativePage.inlineModules) {
        const key = `${scope.requestTweetId}:${scope.moduleId}`;
        nativeModules.set(key, scope);
        nativeContinuations.delete(key);
        const next = nativePage.inlineCursors.find(entry => entry.moduleId === scope.moduleId);
        if (next) nativeContinuations.set(key, next);
      }
    }
    for (const [key, scope] of nativeModules) if (!liveModules.has(key)) pagination.inlineModules.push(scope);
    for (const entry of nativeContinuations.values()) {
      if (!liveModules.has(`${entry.requestTweetId}:${entry.moduleId}`)) {
        pagination.inlineCursors.push(entry);
      }
    }
    const focal = byId.get(focalId) || null;

    if (!focal) return { focal: null, replies: [], cursor: null, pagination, unavailableIds: [...unavailable] };

    const ancestors = new Set();
    let ancId = focal.inReplyToId;
    while (ancId && !ancestors.has(ancId)) {
      ancestors.add(ancId);
      ancId = byId.get(ancId)?.inReplyToId || "";
    }

    function descendsFromFocal(model) {
      if (!model || model.id === focalId) return false;
      if (ancestors.has(model.id)) return false;
      // 只要属于当前推文会话（conversation_id 匹配），一律收纳进 replies
      if (model.conversationId && model.conversationId === focalId) return true;
      if (model.inReplyToId === focalId) return true;
      const visited = new Set([model.id]);
      let parentId = model.inReplyToId;
      while (parentId && !visited.has(parentId)) {
        if (parentId === focalId) return true;
        visited.add(parentId);
        parentId = byId.get(parentId)?.inReplyToId || "";
      }
      // Sharing a conversation with a nested focal does not make a sibling
      // its child. Only the conversation root can admit orphaned branches.
      return false;
    }

    const replies = models.filter(descendsFromFocal);
    const inScope = entry => entry.branchRootId === focalId || descendsFromFocal(byId.get(entry.branchRootId));
    pagination.inlineCursors = pagination.inlineCursors.filter(inScope);
    pagination.inlineModules = pagination.inlineModules.filter(inScope);
    return { focal, replies, cursor: pagination.cursor, pagination, unavailableIds: [...unavailable] };
  }

  /**
   * 将平铺的 replies 列表构造成父子树结构，便于渲染 Thread-Line 和子对话下钻 (Drill-down)
   */
  function buildConversationTree(replies, focalId) {
    const byId = new Map(replies.map((r) => [r.id, r]));
    const childrenMap = new Map(); // parentId -> [childModel]
    const rootReplies = [];

    for (const reply of replies) {
      childrenMap.set(reply.id, []);
    }

    for (const reply of replies) {
      const parentId = reply.inReplyToId;
      if (parentId === focalId) {
        rootReplies.push(reply);
      } else if (parentId && byId.has(parentId)) {
        const children = childrenMap.get(parentId) || [];
        children.push(reply);
        childrenMap.set(parentId, children);
      } else if (reply._subThreadOf && byId.has(reply._subThreadOf)) {
        // 如果该回复是由二级评论请求拉取的子回复，归属于该二级评论的子树
        const children = childrenMap.get(reply._subThreadOf) || [];
        children.push(reply);
        childrenMap.set(reply._subThreadOf, children);
      } else {
        rootReplies.push(reply);
      }
    }

    // 递归收集某个评论的所有后代（深度优先遍历，保持阅读对话连贯性）
    function getSubtree(replyId) {
      const result = [];
      const visited = new Set();
      function traverse(id) {
        const list = childrenMap.get(id) || [];
        for (const item of list) {
          if (!visited.has(item.id)) {
            visited.add(item.id);
            result.push(item);
            traverse(item.id);
          }
        }
      }
      traverse(replyId);
      return result;
    }

    return {
      rootReplies,
      childrenMap,
      getSubtree,
      byId
    };
  }

  root.SidePeekCore = Object.freeze({
    normalizePostUrl,
    postIdFromUrl,
    isPostDetailUrl,
    selectOwnPostUrl,
    userModel,
    tweetLength,
    tweetModel,
    collectTweetModels,
    parseTweetDetail,
    buildConversationTree
  });
})(typeof globalThis === "object" ? globalThis : self);
