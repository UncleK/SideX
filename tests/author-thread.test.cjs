const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createPage, tweet, user, tick, source } = require('./helpers.cjs');

function post(id, parent = '', author = 'owner', text = `Post ${id}`, replies = 0) {
  const result = tweet(id, parent, text);
  result.core.user_results.result = user(author, { rest_id: author });
  result.legacy.conversation_id_str = '100';
  result.legacy.reply_count = replies;
  return result;
}
const entry = result => ({ content: { itemContent: { tweet_results: { result } } } });
function response(posts, cursor) {
  return { data: { instructions: [{ type: 'TimelineAddEntries', entries: [
    ...posts.map(entry), ...(cursor ? [{ content: { cursorType: 'Bottom', value: cursor } }] : [])
  ] }] } };
}
async function open(t, posts, settings = {}, request) {
  const p = createPage({ settings, request: request || (() => response(posts)) });
  t.after(() => p.w.close()); await tick(); p.clickPost(0); await tick(); return p;
}
function chain(length = 8, author = 'owner', start = 101, parent = '100') {
  return Array.from({ length }, (_, i) => post(String(start + i), i ? String(start + i - 1) : parent, author, `Continuation ${i}`, i < length - 1 ? 1 : 0));
}

test('the focal author continuation is visible beyond the preview limit without extra requests', async t => {
  const p = await open(t, [post('100', '', 'owner', 'Main', 1), ...chain()]);
  for (let id = 101; id <= 108; id++) assert.ok(p.query(`[data-id="${id}"]`));
  assert.equal(p.query('.sidepeek-thread-group .sidepeek-expand-btn'), null);
  assert.equal(p.query('[data-id="107"] .sidepeek-act-reply span span').textContent, '1');
  assert.equal(p.calls.filter(m => m.type === 'READ_THREAD').length, 1);
});

test('non-author continuations and owner replies to other users remain preview-limited', async t => {
  const posts = [post('100', '', 'owner'), ...chain(4, 'other'), post('120', '104', 'owner', 'Owner answers somebody else', 1), post('121', '120', 'owner')];
  const p = await open(t, posts);
  assert.ok(p.query('[data-id="102"]'));
  assert.equal(p.query('[data-id="103"]'), null);
  assert.equal(p.query('[data-id="120"]'), null);
  const expand = p.query('.sidepeek-thread-group .sidepeek-expand-btn');
  assert.equal(expand.textContent, '加载更多回复');
  expand.click(); await tick();
  assert.equal(p.query('[data-id="121"]'), null);
  assert.equal(p.query('.sidepeek-thread-group .sidepeek-expand-btn').textContent, '展开并加载全部回复');
  p.query('.sidepeek-thread-group .sidepeek-expand-btn').click(); await tick();
  assert.ok(p.query('[data-id="121"]'));
  assert.equal(p.calls.filter(m => m.type === 'READ_THREAD').length, 1, 'revealing loaded replies does not fetch');
});

test('popup preview changes apply to manually expanded branches and preserve drafts without requests', async t => {
  const p = await open(t, [post('100'), ...chain(6, 'guest')]);
  const prefs = {};
  const popup = new JSDOM(source('popup.html'), { runScripts: 'outside-only' });
  t.after(() => popup.window.close());
  popup.window.chrome = { storage: { sync: {
    get(defaults, cb) { cb({ ...defaults, ...prefs, sidex_lang: 'zh' }); },
    set(values) { Object.assign(prefs, values); p.change(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]))); }
  } } };
  popup.window.eval(source('popup.js'));
  const visible = () => p.w.document.querySelectorAll('.sidepeek-thread-group .sidepeek-comment-item').length;
  assert.equal(visible(), 2, 'parent plus one preview');
  p.query('.sidepeek-thread-group .sidepeek-expand-btn').click(); await tick();
  assert.equal(visible(), 5);
  p.query('.sidepeek-thread-group .sidepeek-expand-btn').click(); await tick();
  assert.equal(visible(), 6);
  const first = p.query('[data-id="102"]');
  const body = p.query('.sidepeek-body'); body.scrollTop = 170;
  const textarea = p.query('.sidepeek-footer-textarea'); textarea.value = 'Keep preview draft';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  for (const limit of [3, 2, 5, 1]) {
    popup.window.document.querySelector(`[data-limit="${limit}"]`).click(); await tick();
    assert.equal(prefs.sidex_sub_reply_limit, limit);
    assert.equal(visible(), 1 + limit);
    assert.equal(p.query('[data-id="102"]'), first);
    assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep preview draft');
    assert.equal(body.scrollTop, 170);
    assert.equal(p.calls.length, 1, 'changing preview size never fetches another branch');
  }
  assert.match(popup.window.document.querySelector('#txt-subreply-limit-hint').textContent, /再加载 3 条，共 4 条/);
  popup.window.document.querySelector('[data-lang="en"]').click();
  assert.match(popup.window.document.querySelector('#txt-subreply-limit-hint').textContent, /First click/);
});

test('mixed branches count only actually hidden loaded replies and keep author continuations visible', async t => {
  const p = await open(t, [post('100', '', 'owner'), ...chain(7), post('120', '101', 'guest', 'Branch A'), post('121', '120', 'guest', 'Branch B'), post('122', '121', 'owner', 'Owner answer')]);
  assert.ok(p.query('[data-id="107"]'));
  assert.ok(p.query('[data-id="120"]'));
  assert.equal(p.query('[data-id="121"]'), null);
  assert.equal(p.query('[data-id="122"]'), null);
  assert.equal(p.query('.sidepeek-thread-group .sidepeek-expand-btn').textContent, '加载更多回复');
});

test('pagination extends the author chain while retaining manual text expansion', async t => {
  const long = 'Long continuation. '.repeat(40);
  const p = await open(t, [], { sidex_auto_expand_reply_text: false }, m => m.cursor ? response([post('103', '102'), post('104', '103')])
    : response([post('100'), post('101', '100', 'owner', long, 1), post('102', '101', 'owner', 'Second', 1)], 'next'));
  p.query('[data-id="101"] .sidepeek-show-more-btn').click();
  const item = p.query('[data-id="101"]');
  p.query('.sidepeek-body > .sidepeek-pagination .sidepeek-load-more-btn').click(); await tick();
  assert.ok(p.query('[data-id="104"]'));
  assert.equal(p.query('[data-id="101"]'), item);
  assert.equal(item.querySelector('.sidepeek-text').classList.contains('sidepeek-text-clamp'), false);
});

test('unknown child counts keep a simple load-more label without an invented reply count', async t => {
  const p = await open(t, [post('100'), post('101', '100', 'guest', 'Reply', 20)]);
  const button = p.query('.sidepeek-fetch-replies-btn');
  assert.ok(button);
  assert.equal(button.textContent, '加载更多回复');
  assert.doesNotMatch(button.textContent, /20/);
});

test('the saved text-folding preference updates cached comments and preserves manual expansion and drafts', async t => {
  const long = 'Long reply body. '.repeat(40);
  const p = await open(t, [post('100'), post('101', '100', 'guest', long), post('102', '100', 'guest2', long)], { sidex_auto_expand_reply_text: false });
  const a = p.query('[data-id="101"]'), b = p.query('[data-id="102"]');
  assert.ok(a.querySelector('.sidepeek-text-clamp'));
  a.querySelector('.sidepeek-show-more-btn').click();
  const marker = p.w.document.createElement('span'); marker.textContent = 'Translator annotation';
  b.querySelector('.sidepeek-text').appendChild(marker);
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus(); textarea.value = 'Keep draft'; textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  const body = p.query('.sidepeek-body'); body.scrollTop = 250;
  const prefs = { sidex_auto_expand_reply_text: false };
  const popup = new JSDOM(source('popup.html'), { runScripts: 'outside-only' });
  t.after(() => popup.window.close());
  popup.window.chrome = { storage: { sync: {
    get(defaults, cb) { cb({ ...defaults, ...prefs, sidex_lang: 'zh' }); },
    set(values) { Object.assign(prefs, values); p.change(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]))); }
  } } };
  popup.window.eval(source('popup.js'));
  const toggle = popup.window.document.querySelector('#sidex-auto-expand-text');
  assert.equal(toggle.checked, false);
  toggle.click(); await tick();
  assert.equal(prefs.sidex_auto_expand_reply_text, true);
  assert.equal(p.query('[data-id="102"]'), b);
  assert.equal(b.querySelector('.sidepeek-text-clamp'), null);
  assert.equal(b.querySelector('.sidepeek-show-more-btn'), null);
  assert.equal(marker.isConnected, true);
  toggle.click(); await tick();
  assert.equal(a.querySelector('.sidepeek-text-clamp'), null, 'manual expansion survives toggling the preference');
  assert.ok(b.querySelector('.sidepeek-text-clamp'));
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep draft');
  assert.equal(body.scrollTop, 250);
  popup.window.document.querySelector('[data-lang="en"]').click();
  assert.equal(popup.window.document.querySelector('#txt-auto-expand-title').textContent, 'Show full reply text');
});

test('persisted auto-expand text never expands quoted cards or gated author replies', async t => {
  const root = post('100'); const reply = post('101', '100', 'owner', 'Long text. '.repeat(50));
  reply.quoted_status_result = { result: post('999', '', 'guest', 'Long quoted text. '.repeat(50)) };
  const hidden = post('102', '101', 'owner', 'GATED_AUTHOR_TEXT');
  const p = await open(t, [], { sidex_auto_expand_reply_text: true }, () => ({data:{instructions:[{type:'TimelineAddEntries',entries:[entry(root),entry(reply),{content:{itemContent:{itemType:'TimelineLabel',text:'Probable spam'}}},entry(hidden)]}]}}));
  assert.equal(p.query('[data-id="101"] .sidepeek-show-more-btn'), null);
  assert.equal(p.query('[data-id="102"]'), null);
  assert.doesNotMatch(p.query('.sidepeek-body').textContent, /GATED_AUTHOR_TEXT/);
  assert.ok(p.query('.sidepeek-gated-btn'));
  assert.equal(p.query('.sidepeek-quote-toggle').getAttribute('aria-expanded'), 'false', 'quoted cards retain their separate expansion state');
});

test('reply text is fully shown by default while an explicit saved off preference is retained', async t => {
  const long = 'Long reply text. '.repeat(40);
  const p = await open(t, [post('100'), post('101', '100', 'guest', long)]);
  assert.equal(p.query('.sidepeek-text-clamp'), null);
  const popup = new JSDOM(source('popup.html'), { runScripts: 'outside-only' });
  t.after(() => popup.window.close());
  popup.window.chrome = { storage: { sync: { get(defaults, cb) { cb(defaults); }, set() {} } } };
  popup.window.eval(source('popup.js'));
  assert.equal(popup.window.document.querySelector('#sidex-auto-expand-text').checked, true);
  p.change({ sidex_auto_expand_reply_text: { newValue: false } });
  assert.ok(p.query('.sidepeek-text-clamp'));
  p.change({ sidex_auto_expand_reply_text: { newValue: undefined } });
  assert.equal(p.query('.sidepeek-text-clamp'), null, 'removing the preference restores the new default');
});
