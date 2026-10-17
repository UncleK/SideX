const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPage, tweet, tick } = require('./helpers.cjs');

// Minimal public TweetDetail shapes observed on williamlong/status/2110964469480526016.
// In particular, X can retain a Bottom cursor alongside a Bottom termination.
const entry = result => ({ content: { itemContent: { tweet_results: { result } } } });
function page({ replies = [tweet('101', '100')], cursor, gate, label, end, focal = true, total = 3 } = {}) {
  const root = tweet('100'); root.legacy.reply_count = total;
  return { data: { threaded_conversation_with_injections_v2: { instructions: [
    { type: 'TimelineAddEntries', entries: [
      ...(focal ? [entry(root)] : []),
      ...(label ? [{ entryId: 'label-0', content: { itemContent: { itemType: 'TimelineLabel', text: label } } }] : []),
      ...replies.map(entry),
      ...(cursor ? [{ content: { cursorType: 'Bottom', value: cursor } }] : []),
      ...(gate ? [{ content: { cursorType: 'ShowMoreThreads', value: gate,
        displayTreatment: { actionText: 'Show probable spam' } } }] : [])
    ] },
    ...(end ? [{ type: 'TimelineTerminateTimeline', direction: end }] : [])
  ] } } };
}
async function open(t, request, setupWindow) {
  const p = createPage({ request, setupWindow }); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); return p;
}
function observers() {
  const instances = [];
  return { setup(w) { w.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; instances.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.targets = []; }
  }; }, fire() { for (const i of [...instances]) { const targets = i.targets.filter(n => n.isConnected); if (targets.length) i.callback(targets.map(target => ({ target, isIntersecting: true }))); } }, instances };
}

for (const focalId of ['100', '200']) {
  test(`completed inline branches only show one end message at the list bottom (focal ${focalId})`, async t => {
    const parentId = String(Number(focalId) + 1);
    const childId = String(Number(focalId) + 2);
    const root = tweet(focalId, focalId === '200' ? '99' : '');
    const parent = tweet(parentId, focalId); parent.legacy.reply_count = 1;
    const child = tweet(childId, parentId);
    const p = createPage({ request: m => page({ focal: false, end: 'Bottom',
      replies: m.tweetId === focalId ? [root, parent] : [parent, child] }) });
    t.after(() => p.w.close()); await tick();
    p.clickPost(focalId === '100' ? 0 : 1); await tick();
    p.query('.sidepeek-fetch-replies-btn').click(); await tick();
    const body = p.query('.sidepeek-body');
    assert.ok(body.querySelector(`[data-id="${childId}"]`));
    assert.equal(body.querySelectorAll('.sidepeek-pagination-end').length, 1);
    assert.ok(body.lastElementChild.classList.contains('sidepeek-pagination-end'));
    assert.equal(body.querySelector('.sidepeek-thread-group .sidepeek-pagination-end'), null);
    p.query('.sidepeek-collapse-btn').click(); await tick();
    assert.equal(body.querySelectorAll('.sidepeek-pagination-end').length, 1);
    p.change({ sidex_lang: { newValue: 'en' } }); await tick();
    assert.equal(body.querySelector('.sidepeek-pagination-end').textContent, 'All currently visible replies loaded');
  });
}

test('inline completion stays hidden while the outer list has more pages, and branch cursors remain actionable', async t => {
  const parent = tweet('101', '100'); parent.legacy.reply_count = 2;
  const p = await open(t, m => m.tweetId === '100' ? page({ replies: [parent], cursor: 'outer-next' })
    : page({ focal: false, replies: [parent, tweet('102', '101')],
      ...(m.cursor ? { end: 'Bottom' } : { cursor: 'branch-next' }) }));
  p.query('.sidepeek-fetch-replies-btn').click(); await tick();
  assert.ok(p.query('.sidepeek-thread-group .sidepeek-load-more-btn'));
  p.query('.sidepeek-thread-group .sidepeek-load-more-btn').click(); await tick();
  assert.ok(p.calls.some(m => m.tweetId === '101' && m.cursor === 'branch-next'));
  assert.equal(p.query('.sidepeek-pagination-end'), null);
  assert.ok(p.query('.sidepeek-body > .sidepeek-pagination .sidepeek-load-more-btn'));
});

test('an explicit bottom termination wins over an otherwise valid bottom cursor', async t => {
  const p = await open(t, () => page({ cursor: 'still-present', end: 'Bottom' }));
  assert.equal(p.query('.sidepeek-load-more-btn'), null);
  assert.match(p.query('.sidepeek-pagination-end').textContent, /可见|visible/i);
  assert.equal(p.query('.sidepeek-count-badge').textContent, '(1/3)');
});
test('top termination does not exhaust bottom pagination', async t => {
  const p = await open(t, () => page({ cursor: 'next', end: 'Top' }));
  assert.ok(p.query('.sidepeek-load-more-btn'));
});
test('the native spam gate is opt-in and its native heading persists after pagination', async t => {
  const p = await open(t, m => m.cursor === 'spam'
    ? page({ replies: [tweet('102', '100')], focal: false, label: 'Probable spam', cursor: 'spam-next' })
    : m.cursor === 'spam-next' ? page({ replies: [tweet('103', '100')], focal: false, end: 'Bottom' })
      : page({ gate: 'spam' }));
  assert.equal(p.query('.sidepeek-load-more-btn'), null);
  const gate = p.query('.sidepeek-gated-btn'); assert.equal(gate.textContent, 'Show probable spam');
  assert.equal(p.calls.filter(m => m.cursor).length, 0);
  gate.click(); await tick();
  assert.equal(p.query('.sidepeek-section-label').textContent, 'Probable spam');
  assert.ok(p.query('[data-id="102"]'));
  p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-section-label').textContent, 'Probable spam');
  assert.ok(p.query('[data-id="103"]'));
  assert.equal(p.query('.sidepeek-load-more-btn'), null);
});
test('preloaded gated content and explicitly restricted bodies never leak into the normal list', async t => {
  const blocked = { __typename: 'TweetWithVisibilityResults', tweet: tweet('104', '100', 'SECRET_RESTRICTED_BODY'), tweetInterstitial: { text: { text: 'Unavailable' } } };
  const response = page({ replies: [tweet('102', '100', 'GATED_BODY'), blocked], label: 'Probable spam' });
  const p = await open(t, () => response);
  assert.doesNotMatch(p.query('.sidepeek-body').textContent, /GATED_BODY|SECRET_RESTRICTED_BODY/);
  p.query('.sidepeek-gated-btn').click(); await tick();
  assert.match(p.query('.sidepeek-body').textContent, /GATED_BODY/);
  assert.doesNotMatch(p.query('.sidepeek-body').textContent, /SECRET_RESTRICTED_BODY/);
});
test('near-bottom loading is single-flight and preserves existing nodes and reading position', async t => {
  const io = observers(); let resolve;
  const p = await open(t, m => m.cursor ? new Promise(r => { resolve = r; }) : page({ cursor: 'next' }), io.setup);
  const item = p.query('[data-id="101"]'); const body = p.query('.sidepeek-body'); body.scrollTop = 300;
  io.fire(); io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  resolve(page({ replies: [tweet('102', '100')], focal: false, end: 'Bottom' })); await tick();
  assert.equal(p.query('[data-id="101"]'), item);
  assert.equal(body.scrollTop, 300);
  assert.ok(p.query('[data-id="102"]'));
  io.fire(); await tick(); assert.equal(p.calls.filter(m => m.cursor).length, 1);
});
test('a changed cursor with no new replies pauses automation without claiming completion', async t => {
  const io = observers();
  const p = await open(t, m => m.cursor ? page({ replies: [], focal: false, cursor: 'another' }) : page({ cursor: 'next' }), io.setup);
  io.fire(); await tick(); io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  assert.ok(p.query('.sidepeek-pagination-paused'));
  assert.equal(p.query('.sidepeek-pagination-end'), null);
  assert.ok(p.query('.sidepeek-load-more-btn'));
});
test('failed automatic pages require manual retry and cannot reopen a closed panel', async t => {
  const io = observers(); let fail = true;
  const p = await open(t, m => { if (!m.cursor) return page({ cursor: 'next' }); if (fail) throw new Error('offline'); return page({ focal: false, end: 'Bottom' }); }, io.setup);
  io.fire(); await tick(); io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  assert.ok(p.query('.sidepeek-pagination-error'));
  fail = false; p.query('.sidepeek-load-more-btn').click(); await tick();
  p.query('.sidepeek-btn-close').click(); io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 2);
});
test('X totals are not a progress target and unknown totals remain unknown', async t => {
  const root = tweet('100'); delete root.legacy.reply_count;
  const p = await open(t, () => ({data:[entry(root),entry(tweet('101','100'))]}));
  assert.equal(p.query('.sidepeek-count-badge').textContent, '(1/—)');
  assert.match(p.query('.sidepeek-count-badge').title, /已加载.*X/);
});

test('ordinary pages finish before a retained spam gate and spam never auto-loads', async t => {
  const io = observers();
  const p = await open(t, m => m.cursor === 'normal-next'
    ? page({ replies: [tweet('102', '100')], focal: false, end: 'Bottom' })
    : m.cursor === 'spam' ? page({ replies: [tweet('103', '100')], focal: false, label: 'Probable spam', end: 'Bottom' })
      : page({ cursor: 'normal-next', gate: 'spam' }), io.setup);
  assert.equal(p.query('.sidepeek-gated-btn'), null);
  io.fire(); await tick();
  assert.ok(p.query('[data-id="102"]'));
  assert.equal(p.query('.sidepeek-gated-btn').textContent, 'Show probable spam');
  io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  p.query('.sidepeek-gated-btn').click(); await tick();
  assert.ok(p.query('[data-id="103"]'));
  assert.equal(p.query('.sidepeek-section-label').textContent, 'Probable spam');
});

test('failed explicit spam expansion has a manual retry and keeps the boundary', async t => {
  const io = observers(); let fail = true;
  const p = await open(t, m => {
    if (!m.cursor) return page({ gate: 'spam' });
    if (fail) throw new Error('offline');
    return page({ replies: [tweet('102', '100')], focal: false, label: 'Probable spam', end: 'Bottom' });
  }, io.setup);
  p.query('.sidepeek-gated-btn').click(); await tick();
  assert.ok(p.query('.sidepeek-pagination-error'));
  assert.ok(p.query('.sidepeek-section-label'));
  io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  fail = false; p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.ok(p.query('[data-id="102"]'));
  assert.equal(p.query('.sidepeek-section-label').textContent, 'Probable spam');
});

test('native section text is inert and restricted quoted bodies and media stay hidden', async t => {
  const reply = tweet('101', '100');
  reply.quoted_status_result = { result: { __typename: 'TweetWithVisibilityResults',
    tweet: tweet('999', '', 'RESTRICTED_QUOTE'), tweetInterstitial: { text: 'Unavailable' } } };
  const p = await open(t, () => page({ replies: [reply], gate: 'spam' }));
  assert.doesNotMatch(p.query('.sidepeek-body').textContent, /RESTRICTED_QUOTE/);
  const q = await open(t, m => m.cursor ? page({ focal: false, replies: [tweet('102', '100')], label: '<img src=x onerror=alert(1)>', end: 'Bottom' }) : page({ gate: 'spam' }));
  q.query('.sidepeek-gated-btn').click(); await tick();
  const label = q.query('.sidepeek-section-label');
  assert.equal(label.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(label.querySelector('img'), null);
});

test('late observer callbacks cannot load another page after switching posts', async t => {
  const io = observers();
  const p = await open(t, m => m.tweetId === '100' ? page({ cursor: 'old-next' }) : { data: [entry(tweet('200'))] }, io.setup);
  const old = io.instances.find(i => i.targets.length);
  const target = old.targets[0];
  assert.equal(old.options.root, p.query('.sidepeek-body'));
  p.clickPost(1); await tick();
  old.callback([{ target, isIntersecting: true }]); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 0);
});

test('subthread prefetch retains its own folded gate without fetching or exposing it', async t => {
  const child = tweet('102', '101', 'FOLDED_CHILD'); child.legacy.conversation_id_str = '100';
  const p = createPage({ settings: { sidex_sub_reply_limit: 3 }, request: m => {
    if (m.tweetId === '100') return page();
    const parent = tweet('101', '100');
    return { data: { instructions: [{ type: 'TimelineAddEntries', entries: [entry(parent),
      { content: { itemContent: { itemType: 'TimelineLabel', text: 'Probable spam' } } }, entry(child)] }] } };
  } });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); await tick();
  assert.doesNotMatch(p.query('.sidepeek-body').textContent, /FOLDED_CHILD/);
  assert.equal(p.calls.filter(m => m.tweetId === '101').length, 1);
  const gate = p.query('.sidepeek-thread-group .sidepeek-gated-btn'); assert.ok(gate);
  gate.click(); await tick();
  const group = p.query('.sidepeek-thread-group');
  assert.match(group.textContent, /FOLDED_CHILD/);
  assert.equal(group.querySelector('.sidepeek-section-label').textContent, 'Probable spam');
  assert.equal(p.calls.filter(m => m.tweetId === '101').length, 1);
  assert.equal(p.query('.sidepeek-count-badge').textContent, '(1/3)');
});

test('matching or exceeded X totals do not terminate a valid cursor', async t => {
  for (const total of [0, 1]) {
    const p = await open(t, () => page({ total, cursor: 'next' }));
    assert.equal(p.query('.sidepeek-count-badge').textContent, `(1/${total})`);
    assert.ok(p.query('.sidepeek-load-more-btn'));
  }
});
test('a repeated cursor stops without claiming that X has no more replies', async t => {
  const p = await open(t, m => page({ cursor: 'same', focal: !m.cursor }));
  p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.ok(p.query('.sidepeek-pagination-paused'));
  assert.equal(p.query('.sidepeek-pagination-end'), null);
  assert.equal(p.query('.sidepeek-load-more-btn'), null);
});

test('popup preference immediately toggles automatic loading while manual loading remains available', async t => {
  const { JSDOM } = require('jsdom');
  const { source } = require('./helpers.cjs');
  const io = observers();
  const prefs = { sidex_lang: 'zh', sidex_auto_load_replies: false };
  const p = createPage({ settings: prefs, setupWindow: io.setup,
    request: m => m.cursor ? page({ replies: [tweet('102', '100')], focal: false, end: 'Bottom' }) : page({ cursor: 'next' }) });
  t.after(() => p.w.close());
  const popup = new JSDOM(source('popup.html'), { runScripts: 'outside-only' });
  t.after(() => popup.window.close());
  popup.window.chrome = { storage: { sync: {
    get(defaults, callback) { callback({ ...defaults, ...prefs }); },
    set(values) {
      Object.assign(prefs, values);
      p.change(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])));
    }
  } } };
  popup.window.eval(source('popup.js'));
  await tick(); p.clickPost(0); await tick();
  const toggle = popup.window.document.querySelector('#sidex-auto-load-input');
  assert.equal(toggle.checked, false);
  io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 0);
  assert.ok(p.query('.sidepeek-load-more-btn'));
  toggle.click(); await tick();
  assert.equal(prefs.sidex_auto_load_replies, true);
  const observer = io.instances.find(i => i.targets.length);
  assert.ok(observer);
  const target = observer.targets[0];
  toggle.click(); await tick();
  observer.callback([{ target, isIntersecting: true }]);
  io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 0);
  p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.ok(p.query('[data-id="102"]'));
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  popup.window.document.querySelector('[data-lang="en"]').click();
  assert.equal(popup.window.document.querySelector('#txt-auto-load-title').textContent, 'Auto-load more replies');
});


test('an empty conversation shows its empty state without a redundant pagination end message', async t => {
  for (const total of [0, 3]) {
    const p = await open(t, () => page({ replies: [], total, end: 'Bottom' }));
    assert.equal(p.query('.sidepeek-count-badge').textContent, `(0/${total})`);
    assert.ok(p.query('.sidepeek-empty-box'));
    assert.equal(p.query('.sidepeek-pagination-end'), null);
  }
});

test('auto-pagination preserves drafts and gated replies while allowing post switching', async t => {
  const io = observers();
  const p = await open(t, m => m.cursor === 'normal-next'
    ? page({ replies: [tweet('102', '100')], focal: false, gate: 'spam', end: 'Bottom' })
    : m.cursor === 'spam' ? page({ replies: [tweet('103', '100')], focal: false, label: 'Probable spam', end: 'Bottom' })
      : page({ cursor: 'normal-next' }), io.setup);
  const composer = p.query('.sidepeek-footer-textarea');
  composer.focus(); composer.value = 'Keep this reply draft';
  composer.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  io.fire(); await tick();
  assert.ok(p.query('[data-id="102"]'));
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep this reply draft');
  assert.ok(p.query('.sidepeek-gated-btn'));
  io.fire(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  assert.equal(p.calls.some(m => m.cursor === 'spam'), false);
  p.query('.sidepeek-gated-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-section-label').textContent, 'Probable spam');
  assert.ok(p.query('[data-id="103"]'));
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep this reply draft');
  composer.blur(); p.clickPost(1); await tick();
  assert.equal(p.calls.filter(m => m.tweetId === '200').length, 1);
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep this reply draft');
  p.query('.sidepeek-btn-close').click();
});
