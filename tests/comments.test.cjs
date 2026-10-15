const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { source, tick, tweet, createPage } = require('./helpers.cjs');
const googleSourceComment = require('./fixtures/google-source-comment.json');

function core(t) {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  return dom.window.SidePeekCore;
}

// Public fields observed on Google/status/2110525638322876674 (2026-10-15).
function sourceReply() {
  const result = structuredClone(googleSourceComment);
  result.rest_id = '101';
  Object.assign(result.legacy, { in_reply_to_status_id_str: '100', conversation_id_str: '100', reply_count: 0 });
  result.legacy.extended_entities = { media: result.legacy.entities.media };
  return result;
}

const detail = (values, cursor) => ({ data: { instructions: [{ entries: [
  ...values.map(result => ({ content: { itemContent: { tweet_results: { result } } } })),
  ...(cursor ? [{ content: { cursorType: 'Bottom', value: cursor } }] : [])
] }] } });

test('a photo reply preserves its source-code link while removing only the media link', t => {
  const model = core(t).tweetModel(sourceReply());
  assert.equal(model.text, 'View the source code → https://t.co/bUGtrCJiIO');
  assert.equal(model.entities.urls[0].expandedUrl, 'https://goo.gle/4jYmj8R');
  assert.equal(model.media.length, 1);
});

test('the source-code link is visible and clickable in the rendered comment', async t => {
  const p = createPage({ request: () => detail([tweet('100'), sourceReply()]) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const link = p.query('.sidepeek-text a');
  assert.ok(link);
  assert.equal(link.textContent, 'goo.gle/4jYmj8R');
  assert.equal(link.href, 'https://goo.gle/4jYmj8R');
  assert.equal(p.query('.sidepeek-zoomable-img').src, sourceReply().legacy.entities.media[0].media_url_https);
});

test('reply display ranges preserve intentional leading mentions in both model and DOM', async t => {
  const result = tweet('101', '100');
  Object.assign(result.legacy, { full_text: '@reader @friend thanks for the source',
    in_reply_to_screen_name: 'reader', display_text_range: [8, 37], reply_count: 0 });
  assert.equal(core(t).tweetModel(result).text, '@friend thanks for the source');
  const p = createPage({ request: () => detail([tweet('100'), result]) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-text').textContent, '@friend thanks for the source');
  assert.equal(p.query('.sidepeek-text-mention').href, 'https://x.com/friend');
});

test('note tweets and replies without display ranges retain their authored mentions and links', t => {
  const Core = core(t);
  const result = sourceReply();
  result.note_tweet = { note_tweet_results: { result: { text: '@friend Full note https://t.co/bUGtrCJiIO' } } };
  assert.equal(Core.tweetModel(result).text, '@friend Full note https://t.co/bUGtrCJiIO');
  const plain = tweet('102', '100', '@friend thanks');
  assert.equal(Core.tweetModel(plain).text, '@friend thanks');
});

test('nested conversation reads exclude siblings and retain descendants through known parents', t => {
  const Core = core(t);
  const values = [tweet('100'), tweet('101', '100'), tweet('102', '101'), tweet('103', '100'), tweet('104', '103')];
  values.forEach(v => v.legacy.conversation_id_str = '100');
  const parsed = Core.parseTweetDetail(detail(values), '101');
  assert.deepEqual(Array.from(parsed.replies, v => v.id), ['102']);
  const next = tweet('105', '102'); next.legacy.conversation_id_str = '100';
  const page = Core.parseTweetDetail(detail([next]), '101', [parsed.focal, ...parsed.replies]);
  assert.deepEqual(Array.from(page.replies, v => v.id), ['105']);
});

test('bottom pagination wins over inline thread cursors and promoted entries stay excluded', t => {
  const Core = core(t);
  const json = detail([tweet('100'), tweet('101', '100')], 'next-page');
  json.data.instructions[0].entries.unshift({ content: { entryType: 'TimelineTimelineModule',
    items: [{ item: { itemContent: { cursorType: 'ShowMoreThreads', value: 'inline-only' } } }] } });
  json.data.instructions[0].entries.push({ content: { itemContent: {
    promotedMetadata: { advertiser_results: {} }, tweet_results: { result: tweet('999', '100') }
  } } });
  const result = Core.parseTweetDetail(json, '100');
  assert.equal(result.cursor, 'next-page');
  assert.deepEqual(Array.from(result.replies, v => v.id), ['101']);
  json.data.instructions[0].entries.splice(-2, 1);
  assert.equal(Core.parseTweetDetail(json, '100').cursor, null);
});

test('later comment pages merge without a focal tweet, preserve DOM and stop repeated cursors', async t => {
  let resolvePage;
  const p = createPage({ request: m => m.cursor
    ? new Promise(resolve => { resolvePage = resolve; })
    : detail([tweet('100'), { ...tweet('101', '100'), legacy: { ...tweet('101', '100').legacy, reply_count: 0 } }], 'page-2') });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const first = p.query('.sidepeek-comment-item');
  const body = p.query('.sidepeek-body'); body.scrollTop = 350;
  const button = p.query('.sidepeek-load-more-btn'); assert.ok(button);
  button.click(); button.click(); await tick();
  assert.equal(p.calls.filter(m => m.cursor).length, 1);
  resolvePage(detail([tweet('101', '100'), tweet('102', '100')], 'page-2')); await tick();
  assert.equal(p.query('.sidepeek-comment-item'), first);
  assert.equal(body.scrollTop, 350);
  assert.equal(p.w.document.querySelectorAll('.sidepeek-comment-item[data-id="101"]').length, 1);
  assert.ok(p.query('.sidepeek-comment-item[data-id="102"]'));
  assert.equal(p.query('.sidepeek-load-more-btn'), null);
});

test('failed page loads can retry and stale pages never leak into a newer post', async t => {
  let fail = true; let resolvePage;
  const p = createPage({ request: m => {
    if (m.cursor) {
      if (fail) throw new Error('Temporary failure');
      return new Promise(resolve => { resolvePage = resolve; });
    }
    return detail([tweet(m.tweetId), tweet(String(Number(m.tweetId) + 1), m.tweetId)], 'next');
  } });
  t.after(() => p.w.close());
  const warnings = []; p.w.console.warn = (...args) => warnings.push(args);
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-load-more-btn').disabled, false);
  assert.equal(warnings.length, 1);
  assert.ok(p.query('.sidepeek-comment-item[data-id="101"]'));
  fail = false; p.query('.sidepeek-load-more-btn').click(); await tick();
  p.clickPost(1); await tick();
  resolvePage(detail([tweet('102', '100')])); await tick();
  assert.ok(p.query('.sidepeek-comment-item[data-id="201"]'));
  assert.equal(p.query('.sidepeek-comment-item[data-id="102"]'), null);
});

test('expanding a reply supports its next page without moving siblings into the branch', async t => {
  const values = [tweet('100'), tweet('101', '100'), tweet('110', '100')];
  values[1].legacy.reply_count = 4;
  const p = createPage({ request: m => {
    if (m.tweetId === '100') return detail(values);
    const child = tweet(m.cursor ? '103' : '102', '101'); child.legacy.conversation_id_str = '100';
    return detail(m.cursor ? [child] : [...values, child], m.cursor ? null : 'child-next');
  } });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-expand-btn').click(); await tick();
  const group = p.query('.sidepeek-thread-group');
  assert.equal(group.querySelector('[data-id="110"]'), null);
  const more = group.querySelector('.sidepeek-load-more-btn'); assert.ok(more);
  more.click(); await tick();
  assert.ok(p.query('.sidepeek-thread-group [data-id="103"]'));
  assert.equal(p.calls.at(-1).cursor, 'child-next');
});

test('photo, video, GIF and quoted replies keep genuine links, including a link-only body', t => {
  const Core = core(t);
  for (const type of ['photo', 'video', 'animated_gif']) {
    const result = sourceReply();
    result.legacy.full_text = 'https://t.co/bUGtrCJiIO https://t.co/4iaIwCN93o';
    delete result.legacy.display_text_range;
    result.legacy.entities.media[0].type = type;
    result.quoted_status_result = { result: tweet('500') };
    const model = Core.tweetModel(result);
    assert.equal(model.text, 'https://t.co/bUGtrCJiIO');
    assert.equal(model.media[0].type, type);
    assert.equal(model.quote.id, '500');
  }
});

test('updated URL entities refresh a cached comment even when its text is unchanged', async t => {
  const initial = sourceReply();
  initial.legacy.entities.urls = [];
  const p = createPage({ request: m => m.cursor ? detail([sourceReply()]) : detail([tweet('100'), initial], 'next') });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-text a').href, 'https://t.co/bUGtrCJiIO');
  p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-text a').href, 'https://goo.gle/4jYmj8R');
});

test('a detail page with only a continuation cursor can load its first visible replies', async t => {
  const p = createPage({ request: m => m.cursor ? detail([sourceReply()]) : detail([tweet('100')], 'next') });
  t.after(() => p.w.close());
  await tick();
  p.w.history.pushState({}, '', '/reader/status/100');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.ok(p.query('.sidepeek-text a[href="https://goo.gle/4jYmj8R"]'));
});

test('cursor cycles terminate and escaped source labels cannot inject markup', async t => {
  const reply = sourceReply();
  reply.legacy.entities.urls[0].display_url = '<img src=x onerror=alert(1)>';
  const p = createPage({ request: m => detail([tweet('100'), reply], m.cursor === 'a' ? 'b' : 'a') });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-text a').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(p.query('.sidepeek-text img'), null);
  p.query('.sidepeek-load-more-btn').click(); await tick();
  p.query('.sidepeek-load-more-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-load-more-btn'), null);
});
