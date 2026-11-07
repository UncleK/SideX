const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createPage, tick, tweet, user, source } = require('./helpers.cjs');
const actualDetail = require('./fixtures/x-web-tweet-detail-20261108.json');

// Reduced from X's x-web DOM and TweetDetail response observed on 2026-11-08.
// The outer navigation row is a link; the post itself has no data-testid/time.
function modernPost(w) {
  const main = w.document.querySelector('main');
  main.innerHTML = `<div data-navigation-stop role="link" data-href="/reader/status/100">
    <a aria-hidden="true" tabindex="-1" href="/reader/status/100"></a>
    <article class="group/post"><div data-post-avatar><a href="/reader">Reader</a></div>
      <a data-base-ui-tooltip-trigger href="/reader/status/100">1h</a>
      <div dir="auto"><span>Modern post body</span></div>
      <div role="link" data-href="/quoted/status/900">Quoted body</div>
      <div data-engagement-action="reply"><a href="/compose/post?in_reply_to=100" aria-label="3 Replies. Reply">3</a></div>
      <div data-engagement-action="like"><button aria-pressed="false" aria-label="4 Likes. Like">4</button></div>
    </article><span data-padding>Row padding</span>
  </div>`;
}

for (const target of ['article [dir="auto"] span', 'article', '[data-padding]']) {
  test(`x-web ${target} opens replies without navigating through the outer link`, async t => {
    const p = createPage({ setupWindow: modernPost });
    t.after(() => p.w.close()); await tick();
    const navigated = [];
    p.w.document.querySelector('main').addEventListener('click', e => {
      if (!e.defaultPrevented) navigated.push(e.target.closest('[data-href]')?.dataset.href);
    });
    p.query(target).click(); await tick();
    assert.deepEqual(navigated, []);
    assert.ok(p.query('#sidepeek-drawer-root.sidepeek-open'));
    assert.equal(p.calls.find(m => m.type === 'READ_THREAD')?.tweetId, '100');
    assert.equal(p.w.location.pathname, '/home');
  });
}

test('x-web explicit links, quotes and engagement controls retain native behavior', async t => {
  const p = createPage({ setupWindow: modernPost });
  t.after(() => p.w.close()); await tick();
  const targets = ['[data-post-avatar] a', 'article > a', 'article [data-href]', '[data-engagement-action="reply"] a', 'button'];
  const allowed = [];
  for (const selector of targets) {
    const node = p.query(selector);
    node.addEventListener('click', e => { allowed.push(!e.defaultPrevented); e.preventDefault(); });
    node.click();
  }
  assert.deepEqual(allowed, targets.map(() => true));
  assert.equal(p.calls.length, 0);
});

test('x-web details, counts and perspective retain ordinary reply text and actual state', async t => {
  const focal = tweet('100');
  const reply = {
    rest_id: '101', core: { user_results: { result: user() } },
    legacy: { conversation_id_str: '100', in_reply_to_status_id_str: '100', lang: 'zh', entities: {} },
    details: { full_text: '@reader 新版评论正文 https://t.co/source', display_text_range: [0, 42], created_at_ms: 1794054765000,
      hashtag_entities: [{ text: 'SideX' }] },
    counts: { reply_count: 3, favorite_count: 7, retweet_count: 2, bookmark_count: 1 },
    perspective: { favorited: true, retweeted: false, bookmarked: true },
    url_entities: [{ url: 'https://t.co/source', expanded_url: 'https://example.com/source', display_url: 'example.com/source' }],
    mention_entities: [{ screen_name: 'reader', name: 'Reader' }],
    quoted_tweet_results: { result: tweet('900', '', 'Quoted post') },
    media_entities2: [{ id_str: 'm1', type: 'photo', media_url_https: 'https://pbs.twimg.com/media/test.jpg' }]
  };
  const p = createPage({ request: () => ({ data: [focal, reply].map(result => ({ tweet_results: { result } })) }) });
  t.after(() => p.w.close()); await tick(); p.clickPost(0); await tick();
  const Core = p.w.SidePeekCore;
  const model = Core.tweetModel(reply);
  assert.equal(model.text, reply.details.full_text);
  assert.equal(model.reportedReplyCount, 3);
  assert.equal(model.counts.likes, 7);
  assert.equal(model.flags.liked, true);
  assert.equal(model.flags.bookmarked, true);
  assert.equal(model.createdAt, '2026-11-07T12:32:45.000Z');
  assert.equal(model.entities.urls[0].expandedUrl, 'https://example.com/source');
  assert.equal(model.entities.userMentions[0].screenName, 'reader');
  assert.equal(model.entities.hashtags[0].text, 'SideX');
  assert.equal(model.media.length, 1);
  assert.equal(model.quote.text, 'Quoted post');
  assert.match(p.query('[data-id="101"] .sidepeek-text').textContent, /新版评论正文/);
});

test('the reported public x-web thread retains all three bodies, reply parents, media and totals', async t => {
  const p = createPage(); t.after(() => p.w.close());
  const detail = p.w.SidePeekCore.parseTweetDetail(actualDetail, '2119005016740741146');
  assert.equal(detail.focal.reportedReplyCount, 3);
  assert.equal(detail.focal.media[0].type, 'video');
  assert.doesNotMatch(detail.focal.text, /t\.co/);
  assert.equal(detail.replies.length, 3);
  for (const reply of detail.replies) {
    assert.equal(reply.inReplyToId, detail.focal.id);
    assert.equal(reply.inReplyToHandle, 'fxmqs');
    assert.ok(reply.text.length > 5);
    assert.doesNotMatch(reply.text, /^@fxmqs/);
  }
  const nested = structuredClone(actualDetail.data[2].tweet_results.result);
  nested.reply_to_results.rest_id = detail.replies[0].id;
  const updated = { data: [...actualDetail.data.slice(0, 2), { tweet_results: { result: nested } }] };
  const parsed = p.w.SidePeekCore.parseTweetDetail(updated, detail.focal.id);
  const tree = p.w.SidePeekCore.buildConversationTree(parsed.replies, detail.focal.id);
  assert.equal(tree.rootReplies.length, 1);
  assert.equal(tree.childrenMap.get(detail.replies[0].id)[0].id, nested.rest_id);
});

test('x-web native Like is reused and its aria-pressed update reaches the sidebar', async t => {
  const p = createPage({ setupWindow: modernPost }); t.after(() => p.w.close()); await tick();
  const button = p.query('[data-engagement-action="like"] button');
  let clicks = 0;
  button.addEventListener('click', () => {
    clicks++;
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', '5 Likes. Unlike');
  });
  p.query('article [dir="auto"]').click(); await tick();
  // This fixture's root post is also rendered in a sidebar reply row.
  p.w.document.querySelector('main [data-href]').setAttribute('data-href', '/reader/status/101');
  p.query('.sidepeek-comment-item[data-id="101"] .sidepeek-act-like').click(); await tick();
  assert.equal(clicks, 1);
  assert.equal(p.calls.filter(m => m.type === 'TOGGLE_ACTION').length, 0);
  assert.equal(p.query('[data-id="101"] .sidepeek-act-like').getAttribute('aria-pressed'), 'true');
});

test('x-web Show more expands the main post without navigating or clicking the quoted post', async t => {
  const p = createPage({ setupWindow: modernPost }); t.after(() => p.w.close()); await tick();
  let expanded = 0;
  const more = p.w.document.createElement('button'); more.textContent = 'Show more';
  p.query('article [dir="auto"]').append(more);
  more.addEventListener('click', () => { expanded++; });
  p.query('article [dir="auto"] span').click(); await tick();
  assert.equal(expanded, 1);
  assert.equal(p.w.location.pathname, '/home');
  assert.ok(p.query('#sidepeek-drawer-root.sidepeek-open'));
});

test('x-web detail retry expands Show more after the article first appears', t => {
  const p = createPage({ setupWindow: modernPost }); t.after(() => p.w.close());
  const more = p.w.document.createElement('button'); more.textContent = 'Show more';
  let expanded = 0; more.addEventListener('click', () => { expanded++; });
  p.query('article [dir="auto"]').append(more);
  const js = source('content.js');
  const retry = js.slice(js.indexOf('  function expandFocalShowMore('), js.indexOf('  async function checkDetailPageAutoOpen('));
  const helperStart = js.indexOf('  function nativeShowMore(');
  const helper = js.slice(helperStart, js.indexOf('  /**', helperStart));
  let mounted = false, retryCallback, cleared = false;
  const context = vm.createContext({
    findDetailFocalArticle: () => mounted ? p.query('article') : null,
    setInterval(callback) { retryCallback = callback; return 1; },
    clearInterval() { cleared = true; }
  });
  vm.runInContext(helper + retry + ';expandFocalShowMore("100");', context);
  assert.equal(expanded, 0);
  mounted = true; retryCallback();
  assert.equal(expanded, 1);
  assert.equal(cleared, true);
});

test('x-web native modal portals stay above SideX and clicks do not dismiss the reading panel', async t => {
  const opened = new Set();
  const p = createPage({ setupWindow(w) {
    w.HTMLElement.prototype.showPopover = function () { opened.add(this); };
    w.HTMLElement.prototype.hidePopover = function () { opened.delete(this); };
  } }); t.after(() => p.w.close()); await tick(); p.clickPost(0); await tick();
  const portal = p.w.document.createElement('div'); portal.dataset.baseUiPortal = '';
  portal.innerHTML = '<div role="dialog" data-slot="xds-modal-surface"><button>Native tool</button></div>';
  p.w.document.body.append(portal); await tick(30);
  assert.equal(opened.has(portal), true);
  const parent = portal.parentElement;
  portal.querySelector('button').click();
  assert.ok(p.query('#sidepeek-drawer-root.sidepeek-open'));
  assert.equal(portal.parentElement, parent);
  portal.remove(); await tick(30);
  assert.equal(opened.has(portal), false);
});

test('x-web textarea receives only the requested quick draft and opens its official GIF tool', async t => {
  let p, entered = '', toolClicks = 0;
  p = createPage({ request(m) {
    if (m.type !== 'OPEN_NATIVE_REPLY') return require('./helpers.cjs').thread(m.tweetId);
    const portal = p.w.document.createElement('div'); portal.dataset.baseUiPortal = '';
    portal.innerHTML = '<div role="dialog" data-slot="xds-modal-surface"><textarea aria-multiline="true"></textarea><button aria-label="Add GIF">GIF</button></div>';
    portal.querySelector('textarea').addEventListener('input', e => { entered = e.target.value; });
    portal.querySelector('button').addEventListener('click', () => { toolClicks++; });
    p.w.document.body.append(portal);
    return { opened: true };
  } }); t.after(() => p.w.close()); await tick(); p.clickPost(0); await tick();
  const quick = p.query('.sidepeek-footer-textarea');
  quick.value = 'Retained quick draft'; quick.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-tool-gif').click(); await tick(30);
  assert.equal(entered, 'Retained quick draft');
  assert.equal(toolClicks, 1);
  assert.equal(quick.value, 'Retained quick draft');
  assert.equal(p.calls.some(m => m.type === 'CREATE_REPLY'), false);
});
