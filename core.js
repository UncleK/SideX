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

  function unwrapResult(value) {
    let current = objectValue(value);
    for (let index = 0; current && index < 6; index += 1) {
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

    // 清理正文中被 X 附带在末尾的媒体 t.co 短链接
    const mediaEntities = [
      ...(legacy.extended_entities?.media || []),
      ...(legacy.entities?.media || []),
      ...(note?.entity_set?.media || [])
    ];
    for (const m of mediaEntities) {
      if (m.url) {
        text = text.replace(m.url, "").trim();
      }
    }
    if (media.length > 0) {
      text = text.replace(/\s*https:\/\/t\.co\/[A-Za-z0-9]+$/, "").trim();
    }

    // 清理回复推文中由 X 自动附加在开头的 @用户名 前缀（因顶部已渲染「回复 @xxx」标签）
    const inReplyToHandle = String(legacy.in_reply_to_screen_name || "");
    const inReplyToId = String(legacy.in_reply_to_status_id_str || "");
    if (inReplyToHandle || inReplyToId) {
      const range = legacy.display_text_range;
      if (Array.isArray(range) && range.length === 2 && typeof range[0] === "number" && range[0] > 0 && typeof note?.text !== "string") {
        text = text.slice(range[0]).trim();
      } else {
        text = text.replace(/^(?:@[A-Za-z0-9_]+\s*)+/, "").trim();
      }
    }

    const mediaUrls = new Set(mediaEntities.map((m) => m.url).filter(Boolean));
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
      author: {
        id: String(user?.rest_id || userLegacy.id_str || ""),
        name: userLegacy.name || userCore.name || handle || "X 用户",
        handle,
        avatar: String(userLegacy.profile_image_url_https || user?.avatar?.image_url || "").replace("_normal.", "_200x200."),
        verified: Boolean(user?.is_blue_verified || userLegacy.verified || user?.verification?.verified),
        verifiedType: user?.verification?.verified_type || user?.verified_type || (user?.is_blue_verified ? "Blue" : userLegacy.verified ? "Blue" : "")
      },
      createdAt: legacy.created_at || "",
      conversationId: String(legacy.conversation_id_str || ""),
      inReplyToId: String(legacy.in_reply_to_status_id_str || ""),
      inReplyToHandle: String(legacy.in_reply_to_screen_name || ""),
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
      media: mediaItems(legacy, tweet),
      quote: quoted
    };
  }

  function collectTweetModels(value) {
    const models = [];
    const seenNodes = new Set();
    const seenTweets = new Set();

    function visit(node) {
      if (!node || typeof node !== "object" || seenNodes.has(node)) return;
      seenNodes.add(node);
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

  function bottomCursor(value) {
    let cursor = null;
    const seen = new Set();
    function visit(node) {
      if (cursor || !node || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      if (/^Bottom$/i.test(String(node.cursorType || "")) && typeof node.value === "string") {
        cursor = node.value;
        return;
      }
      if (/^(?:ShowMoreThreads|ShowMoreThread)$/i.test(String(node.cursorType || "")) && typeof node.value === "string" && !cursor) {
        cursor = node.value;
      }
      if (Array.isArray(node)) node.forEach(visit);
      else for (const child of Object.values(node)) visit(child);
    }
    visit(value);
    return cursor;
  }

  function parseTweetDetail(json, focalTweetId) {
    const focalId = String(focalTweetId || "");
    const models = collectTweetModels(json?.data || json);
    const byId = new Map(models.map((model) => [model.id, model]));
    const focal = byId.get(focalId) || null;

    if (!focal) return { focal: null, replies: [], cursor: null };

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
      // 如果推特返回了当前 focalId 会话中的其他子回复，即使中间父节点未完整返回，只要属于同一个会话且不是祖先，也作为回复纳入
      if (focal.conversationId && model.conversationId && model.conversationId === focal.conversationId) {
        return true;
      }
      return false;
    }

    const replies = models.filter(descendsFromFocal);
    return { focal, replies, cursor: bottomCursor(json) };
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
    tweetModel,
    collectTweetModels,
    parseTweetDetail,
    buildConversationTree
  });
})(typeof globalThis === "object" ? globalThis : self);
