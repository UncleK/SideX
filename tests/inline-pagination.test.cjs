const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createPage, tweet, tick, source } = require('./helpers.cjs');

// Minimal public shape from JorWang/status/2111045574695047464:
// a conversation module has its own ShowMore despite outer Bottom termination.
const item = result => ({ entryId: `tweet-${result.rest_id}`, item: { itemContent: { tweet_results: { result } } } });
function moduleEntry(id, posts, cursor) {
  return { entryId: `conversationthread-${id}`, content: {
    entryType: 'TimelineTimelineModule', items: [...posts.map(item),
      ...(cursor ? [{ entryId: `cursor-${id}`, item: { itemContent: {
        itemType: 'TimelineTimelineCursor', cursorType: 'ShowMore', value: cursor,
        displayTreatment: { actionText: 'Show replies' }
      } } }] : [])]
  } };
}
const entry = result => ({ content: { itemContent: { tweet_results: { result } } } });
function detail(modules, { posts = [tweet('100', '99')], bottom, end = true } = {}) {
  return { data: { instructions: [{ type: 'TimelineAddEntries', entries: [
    ...posts.map(entry), ...modules,
    ...(bottom ? [{ content: { cursorType: 'Bottom', value: bottom } }] : [])
  ] }, ...(end ? [{ type: 'TimelineTerminateTimeline', direction: 'Bottom' }] : [])] } };
}
function initial(cursor = 'branch-next') {
  const parent = tweet('101', '100'); parent.legacy.reply_count = 1;
  return detail([moduleEntry('101', [parent, tweet('102', '101')], cursor)]);
}
async function open(t, request, settings = {}, setupWindow) {
  const p = createPage({ request, settings, setupWindow }); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); return p;
}

function observeNative(p, json) {
  p.w.dispatchEvent(new p.w.MessageEvent('message', { source: p.w, origin: p.w.location.origin,
    data: { source: 'sidepeek-page', type: 'NATIVE_THREAD_OBSERVED',
      payload: { sidepeekObservedThreads: [{ requestTweetId: '100', json }] } } }));
}

test('switching to a reply and returning preserves the current response order and cached descendants', async t => {
  let visitedChild = false;
  const current = detail([], { posts: [tweet('100'), tweet('101', '100', 'CURRENT_A'),
    tweet('102', '100'), tweet('103', '100')] });
  const child = detail([], { posts: [tweet('100'), tweet('103', '100'), tweet('104', '103')] });
  const p = await open(t, m => {
    if (m.tweetId === '103') { visitedChild = true; return child; }
    return visitedChild ? { ...current, sidepeekObservedThreads: [{ requestTweetId: '103', json: child }] } : current;
  }, { sidex_auto_load_replies: false }, w => {
    w.document.querySelector('a[href="/reader/status/200"]').href = '/reader/status/103';
  });
  const roots = () => [...p.w.document.querySelectorAll('.sidepeek-comment-item:not(.sidepeek-child-comment)')]
    .map(node => node.dataset.id);
  assert.deepEqual(roots(), ['101', '102', '103']);
  p.clickPost(1); await tick();
  assert.ok(p.query('[data-id="104"]'));
  p.clickPost(0); await tick();
  assert.deepEqual(roots(), ['101', '102', '103']);
  assert.ok(p.query('[data-id="104"]'), 'the cached descendant is retained after returning');
  assert.equal(p.w.document.querySelectorAll('[data-id="103"]').length, 1);
});

test('current response order and model updates win over multiple cached reply visits', t => {
  const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  const json = detail([], { posts: [tweet('100'), tweet('101', '100'),
    tweet('102', '100', 'CURRENT_B'), tweet('103', '100')] });
  json.sidepeekObservedThreads = [
    { requestTweetId: '103', json: detail([], { posts: [tweet('100'), tweet('103', '100'), tweet('104', '103')] }) },
    { requestTweetId: '102', json: detail([], { posts: [tweet('100'), tweet('102', '100', 'STALE_B')] }) }
  ];
  const core = dom.window.SidePeekCore;
  const parsed = core.parseTweetDetail(json, '100');
  assert.deepEqual(Array.from(core.buildConversationTree(parsed.replies, '100').rootReplies, r => r.id), ['101', '102', '103']);
  assert.equal(parsed.replies.find(r => r.id === '102').text, 'CURRENT_B');
  assert.deepEqual(Array.from(parsed.replies, r => r.id), ['101', '102', '103', '104']);
});

test('an observation-only update retains cached reply order when the current response has no models', t => {
  const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  const parsed = dom.window.SidePeekCore.parseTweetDetail({ data: {}, sidepeekObservedThreads: [
    { requestTweetId: '100', json: detail([], { posts: [tweet('100'), tweet('103', '100'), tweet('101', '100')] }) }
  ] }, '100');
  assert.deepEqual(Array.from(parsed.replies, r => r.id), ['103', '101']);
});

for (const addsReply of [false, true]) {
  test('native observations preserve an in-flight inline request, with a new reply ' + addsReply, async t => {
    let finish;
    const p = await open(t, m => m.cursor ? new Promise(resolve => { finish = resolve; }) : initial(),
      { sidex_auto_load_replies: false });
    const editor = p.query('.sidepeek-footer-textarea'); editor.value = 'Keep this reply';
    editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
    p.query('.sidepeek-inline-load-more-btn').click(); await tick();
    const observed = initial();
    if (addsReply) observed.data.instructions[0].entries.push(entry(tweet('110', '100')));
    observeNative(p, observed); await tick();
    assert.equal(p.query('.sidepeek-inline-load-more-btn').disabled, true, 'the same cursor is still being loaded');
    p.query('.sidepeek-inline-load-more-btn').click(); await tick();
    assert.equal(p.calls.filter(m => m.cursor).length, 1);
    finish(detail([moduleEntry('101', [tweet('103', '102')])], { posts: [] })); await tick();
    assert.ok(p.query('[data-id="103"]'), 'the original successful response is accepted');
    assert.equal(p.query('.sidepeek-inline-load-more-btn'), null);
    assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep this reply');
    if (addsReply) assert.ok(p.query('[data-id="110"]'));
  });
}

test('native visibility updates reclassify existing replies and hide their cached descendants', async t => {
  const p = await open(t, () => initial(null));
  assert.ok(p.query('[data-id="101"]')); assert.ok(p.query('[data-id="102"]'));
  const editor = p.query('.sidepeek-footer-textarea'); editor.value = 'Keep draft';
  editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  const folded = detail([]);
  folded.data.instructions[0].entries.push(
    { content: { itemContent: { itemType: 'TimelineLabel', text: 'Probable spam' } } },
    entry(tweet('101', '100', 'UPDATED_FOLDED_REPLY')));
  observeNative(p, folded); await tick();
  assert.equal(p.query('[data-id="101"]'), null);
  assert.equal(p.query('[data-id="102"]'), null, 'cached descendants inherit the folded parent boundary');
  assert.ok(p.query('.sidepeek-gated-btn'));
  observeNative(p, detail([], { posts: [tweet('100'), tweet('101', '100', 'UPDATED_NORMAL_REPLY')] })); await tick();
  assert.match(p.query('[data-id="101"]').textContent, /UPDATED_NORMAL_REPLY/);
  assert.ok(p.query('[data-id="102"]'));
  assert.equal(p.query('.sidepeek-section-label'), null);
  assert.equal(p.query('.sidepeek-gated-btn'), null);
  observeNative(p, folded); await tick();
  p.query('.sidepeek-gated-btn').click(); await tick();
  assert.match(p.query('[data-id="101"]').textContent, /UPDATED_FOLDED_REPLY/);
  assert.ok(p.query('[data-id="102"]'));
  assert.equal(p.query('.sidepeek-section-label').textContent, 'Probable spam');
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep draft');
});

test('native unavailability hides an existing reply and its descendants until a valid update arrives', async t => {
  const p = await open(t, () => initial(null));
  const unavailable = detail([]);
  unavailable.data.instructions[0].entries.push({ entryId: 'tweet-101',
    content: { itemContent: { tweet_results: { result: { __typename: 'TweetUnavailable' } } } } });
  observeNative(p, unavailable); await tick();
  assert.equal(p.query('[data-id="101"]'), null);
  assert.equal(p.query('[data-id="102"]'), null);
  observeNative(p, detail([], { posts: [tweet('100'), tweet('101', '100')] })); await tick();
  assert.ok(p.query('[data-id="101"]'));
  assert.ok(p.query('[data-id="102"]'));
});

test('an ended outer timeline retains a separately scoped inline continuation', t => {
  const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  const result = dom.window.SidePeekCore.parseTweetDetail(initial(), '100');
  assert.equal(result.cursor, null);
  assert.equal(result.pagination.ended, true);
  assert.equal(result.pagination.inlineCursors.length, 1);
  assert.equal(result.pagination.inlineCursors[0].branchRootId, '101');
  assert.equal(result.pagination.inlineCursors[0].requestTweetId, '100');
});

test('a known inline cursor replaces speculative count-based fetching', async t => {
  const json = initial();
  json.data.instructions[0].entries[1].content.items[0].item.itemContent.tweet_results.result.legacy.reply_count = 10;
  const p = await open(t, () => json);
  assert.ok(p.query('.sidepeek-inline-load-more-btn'));
  assert.equal(p.query('.sidepeek-fetch-replies-btn'), null);
});

test('a child request with zero reported replies still includes native-observed descendants', async t => {
  const native = detail([moduleEntry('101', [tweet('101', '100'), tweet('102', '101'),
    tweet('103', '102'), tweet('104', '103')])]);
  const p = await open(t, m => {
    if (m.tweetId === '200') return detail([], { posts: [tweet('200')] });
    // This is the actual failing shape: focal 100, a single child 101, no
    // ShowMore, Bottom terminated; native X has already loaded 102..104.
    const json = detail([moduleEntry('101', [tweet('101', '100')])]);
    json.sidepeekObservedThreads = [{ requestTweetId: '99', json: native }];
    return json;
  });
  assert.ok(p.query('[data-id="104"]'), 'native descendants must not disappear');
  assert.equal(p.query('.sidepeek-count-badge').textContent, '(1/0)');
});

test('native observations arriving after the child panel opens restore only its descendants', async t => {
  const p = await open(t, () => detail([moduleEntry('101', [tweet('101', '100')])]));
  const native = detail([moduleEntry('101', [tweet('101', '100'), tweet('102', '101'), tweet('103', '102')]),
    moduleEntry('200', [tweet('200', '99')])]);
  p.w.dispatchEvent(new p.w.MessageEvent('message', { source: p.w, origin: p.w.location.origin,
    data: { source: 'sidepeek-page', type: 'NATIVE_THREAD_OBSERVED',
      payload: { sidepeekObservedThreads: [{ requestTweetId: '99', json: native }] } } }));
  await tick();
  assert.ok(p.query('[data-id="103"]'));
  assert.equal(p.query('[data-id="200"]'), null);
});

test('replaying a consumed native module cursor never rebinds it to a child request', t => {
  const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  const json = detail([moduleEntry('102', [tweet('102', '101')])], { posts: [tweet('101', '100')] });
  json.sidepeekObservedThreads = [
    { requestTweetId: '100', json: initial('native-next') },
    { requestTweetId: '100', cursor: 'native-next', json: { data: { instructions: [{
      type: 'TimelineAddToModule', moduleEntryId: 'conversationthread-101',
      moduleItems: [item(tweet('103', '102')), item(tweet('104', '103'))]
    }] } } }
  ];
  const parsed = dom.window.SidePeekCore.parseTweetDetail(json, '101');
  assert.deepEqual(Array.from(parsed.replies, r => r.id), ['102', '103', '104']);
  assert.equal(parsed.pagination.inlineCursors.length, 0);
});

test('native cached folded bodies never become normal visible replies', async t => {
  const native = initial();
  native.data.instructions[0].entries.splice(1, 0, { content: { itemContent: { itemType: 'TimelineLabel', text: 'Probable spam' } } });
  native.data.instructions[0].entries[2] = moduleEntry('101', [tweet('101', '100'), tweet('102', '101', 'FOLDED_BODY')]);
  const p = await open(t, () => {
    const json = detail([], { posts: [tweet('100')] });
    json.sidepeekObservedThreads = [{ requestTweetId: '99', json: native }];
    return json;
  });
  assert.doesNotMatch(p.query('.sidepeek-body').textContent, /FOLDED_BODY/);
  p.query('.sidepeek-gated-btn').click(); await tick();
  assert.match(p.query('.sidepeek-body').textContent, /FOLDED_BODY/);
});

test('a module-local folded boundary also protects its continuation', async t => {
  const native = initial();
  native.data.instructions[0].entries[1].content.items.splice(1, 0,
    { item: { itemContent: { itemType: 'TimelineLabel', text: 'Probable spam' } } });
  const p = await open(t, () => {
    const json = detail([], { posts: [tweet('100')] });
    json.sidepeekObservedThreads = [{ requestTweetId: '99', json: native }];
    return json;
  });
  assert.ok(p.query('[data-id="101"]'));
  assert.equal(p.query('[data-id="102"]'), null);
  assert.equal(p.query('.sidepeek-inline-load-more-btn'), null);
});

test('a live visibility restriction overrides an older cached body', t => {
  const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  const json = detail([moduleEntry('101', [tweet('101', '100')])]);
  json.data.instructions[0].entries.push({ content: { itemContent: { tweet_results: { result: {
    __typename: 'TweetWithVisibilityResults', tweet: tweet('102', '101', 'RESTRICTED_BODY'),
    tweetInterstitial: { text: { text: 'Unavailable' } }
  } } } } });
  json.sidepeekObservedThreads = [{ requestTweetId: '100', json: detail([moduleEntry('101', [tweet('101', '100'), tweet('102', '101', 'RESTRICTED_BODY')])]) }];
  const parsed = dom.window.SidePeekCore.parseTweetDetail(json, '100');
  assert.deepEqual(Array.from(parsed.replies, p => p.id), ['101']);
  json.data.instructions[0].entries.at(-1).entryId = 'tweet-102';
  json.data.instructions[0].entries.at(-1).content.itemContent.tweet_results.result = { __typename: 'TweetUnavailable' };
  const tombstone = dom.window.SidePeekCore.parseTweetDetail(json, '100');
  assert.deepEqual(Array.from(tombstone.replies, p => p.id), ['101']);
});

test('related and sibling module cursors cannot enter a nested focal scope', t => {
  const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  const json = initial();
  const sibling = tweet('110', '99'); sibling.legacy.conversation_id_str = '99';
  json.data.instructions[0].entries.push(moduleEntry('110', [sibling], 'sibling'));
  const related = moduleEntry('120', [tweet('120', '100')], 'related');
  related.entryId = 'tweetdetailrelatedtweets-120';
  json.data.instructions[0].entries.push(related);
  const result = dom.window.SidePeekCore.parseTweetDetail(json, '100');
  assert.deepEqual(Array.from(result.pagination.inlineCursors, c => c.cursor), ['branch-next']);
});

test('the missing replies load via the original request scope without changing the direct count', async t => {
  const p = await open(t, m => m.cursor ? detail([moduleEntry('101', [tweet('103', '101'), tweet('104', '103')])], { posts: [] })
    : initial(), { sidex_auto_load_replies: false });
  assert.equal(p.query('.sidepeek-pagination-end'), null);
  const button = p.query('.sidepeek-inline-load-more-btn'); assert.ok(button);
  button.click(); await tick();
  assert.equal(p.calls.at(-1).tweetId, '100');
  assert.equal(p.calls.at(-1).cursor, 'branch-next');
  assert.ok(p.query('[data-id="103"]'));
  assert.ok(p.query('[data-id="104"]'));
  assert.equal(p.query('.sidepeek-count-badge').textContent, '(1/0)');
  assert.equal(p.query('.sidepeek-inline-load-more-btn'), null);
  assert.equal(p.w.document.querySelectorAll('.sidepeek-pagination-end').length, 1);
});

test('module append responses preserve other branches and outer pagination', async t => {
  const p = await open(t, m => m.cursor ? { data: { instructions: [{ type: 'TimelineAddToModule',
    moduleEntryId: 'conversationthread-101', moduleItems: [item(tweet('103', '102'))] }] } }
    : detail([moduleEntry('101', [tweet('101', '100'), tweet('102', '101')], 'a'),
      moduleEntry('110', [tweet('110', '100')], 'b')], { bottom: 'outer', end: false }));
  assert.equal(p.w.document.querySelectorAll('.sidepeek-inline-load-more-btn').length, 2);
  p.query('.sidepeek-inline-load-more-btn').click(); await tick();
  assert.ok(p.query('[data-id="103"]'));
  assert.equal(p.w.document.querySelectorAll('.sidepeek-inline-load-more-btn').length, 1);
  assert.ok(p.query('.sidepeek-body > .sidepeek-pagination .sidepeek-load-more-btn'));
  p.query('.sidepeek-inline-load-more-btn').click(); await tick();
  assert.equal(p.calls.at(-1).cursor, 'b');
});

test('inline cursor cycles stop, and empty changed pages require manual continuation', async t => {
  const p = await open(t, m => m.cursor ? detail([moduleEntry('101', [], m.cursor === 'a' ? 'b' : 'a')], { posts: [] })
    : initial('a'));
  p.query('.sidepeek-inline-load-more-btn').click(); await tick();
  assert.ok(p.query('.sidepeek-inline-pagination .sidepeek-pagination-paused'));
  assert.equal(p.query('.sidepeek-inline-load-more-btn').disabled, false);
  p.query('.sidepeek-inline-load-more-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-inline-load-more-btn').disabled, true);
  assert.equal(p.query('.sidepeek-pagination-end'), null);
  assert.equal(p.calls.length, 3);
});

test('a failed inline request retries the same cursor and preserves loaded nodes and drafts', async t => {
  let fail = true;
  const p = await open(t, m => {
    if (!m.cursor) return initial();
    if (fail) throw new Error('offline');
    return detail([moduleEntry('101', [tweet('103', '102')])], { posts: [] });
  });
  const node = p.query('[data-id="102"]');
  const body = p.query('.sidepeek-body'); body.scrollTop = 170;
  const text = p.query('.sidepeek-footer-textarea'); text.value = 'Keep draft';
  text.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-inline-load-more-btn').click(); await tick();
  assert.ok(p.query('.sidepeek-inline-pagination .sidepeek-pagination-error'));
  fail = false; p.query('.sidepeek-inline-load-more-btn').click(); await tick();
  assert.equal(p.calls.at(-1).cursor, 'branch-next');
  assert.equal(p.query('[data-id="102"]'), node);
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep draft');
  assert.equal(body.scrollTop, 170);
});

function observers() {
  const all = [];
  return { setup(w) { w.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; all.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.targets = []; }
  }; }, fire() { for (const observer of [...all]) {
    observer.callback(observer.targets.filter(t => t.isConnected).map(target => ({ target, isIntersecting: true })));
  } }, all };
}

test('automatic outer and inline pages are single-flight and respond immediately to the preference', async t => {
  const io = observers(); let resolve;
  const p = await open(t, m => m.cursor ? new Promise(r => { resolve = r; })
    : detail([moduleEntry('101', [tweet('101', '100'), tweet('102', '101')], 'a')], { bottom: 'outer', end: false }),
    { sidex_auto_load_replies: false }, io.setup);
  io.fire(); await tick(); assert.equal(p.calls.length, 1);
  p.change({ sidex_auto_load_replies: { newValue: true } }); await tick();
  io.fire(); io.fire(); await tick(); assert.equal(p.calls.length, 2);
  p.change({ sidex_auto_load_replies: { newValue: false } });
  resolve(detail([], { posts: [] })); await tick();
  io.fire(); await tick(); assert.equal(p.calls.length, 2);
  // Finishing the outer page must preserve its outstanding module cursor.
  assert.ok(p.query('.sidepeek-inline-load-more-btn'));
  assert.equal(p.query('.sidepeek-pagination-end'), null);
});

test('inline automation only observes visible continuations and ignores late callbacks and responses', async t => {
  const io = observers(); let resolve;
  const p = await open(t, m => m.cursor ? new Promise(r => { resolve = r; })
    : m.tweetId === '200' ? detail([], { posts: [tweet('200')] }) : initial(), {}, io.setup);
  const old = io.all.find(o => o.targets.length); assert.ok(old);
  io.fire(); await tick();
  p.clickPost(1); await tick();
  old.callback([{ isIntersecting: true }]);
  resolve(detail([moduleEntry('101', [tweet('103', '102')])], { posts: [] })); await tick();
  assert.equal(p.query('[data-id="103"]'), null);
  assert.equal(p.query('.sidepeek-inline-load-more-btn'), null);
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
});

test('a folded preview must be expanded before its inline continuation is observed', async t => {
  const io = observers();
  const posts = [tweet('101', '100'), tweet('102', '101'), tweet('103', '102')];
  for (const post of posts) post.core.user_results.result.rest_id = 'other-author';
  const p = await open(t, () => detail([moduleEntry('101', posts, 'a')]), {}, io.setup);
  assert.equal(p.query('.sidepeek-inline-load-more-btn'), null);
  io.fire(); await tick(); assert.equal(p.calls.length, 1);
  p.query('.sidepeek-thread-group .sidepeek-expand-btn').click(); await tick();
  assert.ok(p.query('.sidepeek-inline-load-more-btn'));
});

test('gated inline continuations are not exposed or fetched before explicit expansion', async t => {
  const io = observers();
  const json = initial();
  json.data.instructions[0].entries.splice(1, 0, { content: { itemContent: { itemType: 'TimelineLabel', text: 'Probable spam' } } });
  const p = await open(t, () => json, {}, io.setup);
  assert.equal(p.query('[data-id="101"]'), null);
  assert.equal(p.query('.sidepeek-inline-load-more-btn'), null);
  io.fire(); await tick(); assert.equal(p.calls.length, 1);
  p.query('.sidepeek-gated-btn').click(); await tick();
  assert.ok(p.query('[data-id="101"]'));
  assert.ok(p.query('.sidepeek-inline-load-more-btn'));
  assert.ok(p.query('.sidepeek-section-label'));
  io.fire(); await tick(); assert.equal(p.calls.length, 1, 'spam continuation remains manual');
});
