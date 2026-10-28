const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPage, tweet, user, tick } = require('./helpers.cjs');

function post(id, parent = '', replies = 0) {
  const value = tweet(id, parent, `Reply ${id}`);
  value.core.user_results.result = user(parent ? 'guest' : 'owner', { rest_id: parent ? 'guest' : 'owner' });
  value.legacy.conversation_id_str = '100';
  value.legacy.reply_count = replies;
  return value;
}
const entry = result => ({ content: { itemContent: { tweet_results: { result } } } });
function page(posts, cursor, gate = false) {
  return { data: { instructions: [{ type: 'TimelineAddEntries', entries: [
    ...posts.map(entry), ...(cursor ? [{ content: { cursorType: 'Bottom', value: cursor } }] : []),
    ...(gate ? [{ content: { cursorType: 'ShowMoreThreads', value: 'spam', displayTreatment: { actionText: 'Probable spam' } } }] : [])
  ] }] } };
}
const children = (start, count) => Array.from({ length: count }, (_, i) => post(String(start + i), '101'));
const group = p => p.query('[data-id="101"]').closest('.sidepeek-thread-group');
const visible = p => group(p).querySelectorAll('.sidepeek-child-comment').length;
const more = p => group(p).querySelector('.sidepeek-expand-btn');
async function open(t, request, limit = 1) {
  const p = createPage({ settings: { sidex_sub_reply_limit: limit, sidex_auto_load_replies: false }, request });
  t.after(() => p.w.close()); await tick(); p.clickPost(0); await tick(); return p;
}

for (const limit of [1, 2, 3, 5]) {
  test(`cached previews follow ${limit}, ${limit + 2}, all, collapse without requests`, async t => {
    const p = await open(t, () => page([post('100'), post('101', '100', 9), ...children(102, 9)]), limit);
    assert.equal(visible(p), limit);
    more(p).click(); await tick(); assert.equal(visible(p), limit + 2);
    assert.equal(more(p).textContent, '展开并加载全部回复');
    more(p).click(); await tick(); assert.equal(visible(p), 9);
    group(p).querySelector('.sidepeek-collapse-btn').click(); await tick();
    assert.equal(visible(p), limit);
    more(p).click(); await tick(); assert.equal(visible(p), limit + 2, 'collapse resets the next click');
    assert.equal(p.calls.length, 1);
  });
}

test('first click fetches one page within N+2; second drains only this branch and leaves Spam folded', async t => {
  const p = await open(t, m => {
    if (m.tweetId === '100') return page([post('100'), post('101', '100', 20), post('150', '100', 3), post('102', '101')], 'outer');
    if (!m.cursor) return page([post('101', '100', 20), ...children(102, 4)], 'next-1');
    if (m.cursor === 'next-1') return page(children(106, 2), 'next-2');
    return page(children(108, 2), null, true);
  });
  more(p).click(); await tick();
  assert.equal(visible(p), 3);
  assert.equal(p.calls.length, 2);
  more(p).click(); await tick(); await tick();
  assert.equal(visible(p), 8);
  assert.deepEqual(p.calls.map(m => [m.tweetId, m.cursor || '']), [['100', ''], ['101', ''], ['101', 'next-1'], ['101', 'next-2']]);
  assert.ok(group(p).querySelector('.sidepeek-gated-btn'));
  assert.ok(p.query('.sidepeek-body > .sidepeek-pagination .sidepeek-load-more-btn'));
});

test('all-reply loading stops after an empty page and retains its manual continuation', async t => {
  const p = await open(t, m => m.tweetId === '100'
    ? page([post('100'), post('101', '100', 20), ...children(102, 5)])
    : !m.cursor ? page([post('101', '100', 20), ...children(107, 1)], 'next')
      : page([], 'changed-but-empty'));
  more(p).click(); await tick(); more(p).click(); await tick(); await tick();
  assert.equal(p.calls.length, 3);
  assert.ok(group(p).querySelector('.sidepeek-pagination-paused'));
  assert.ok(group(p).querySelector('.sidepeek-load-more-btn'));
});

for (const cancel of ['collapse', 'setting', 'switch']) {
  test(`${cancel} cancels all-reply continuation while its current request settles`, async t => {
    let finish;
    const p = await open(t, m => m.tweetId === '200' ? page([post('200'), post('201', '200')])
      : m.tweetId === '100' ? page([post('100'), post('101', '100', 20), ...children(102, 5)])
        : new Promise(resolve => { finish = resolve; }));
    more(p).click(); await tick(); more(p).click(); await tick();
    assert.equal(p.calls.length, 2);
    if (cancel === 'collapse') group(p).querySelector('.sidepeek-collapse-btn').click();
    else if (cancel === 'setting') p.change({ sidex_sub_reply_limit: { newValue: 2 } });
    else p.clickPost(1);
    await tick(); finish(page([post('101', '100', 20), post('110', '101')], 'must-not-follow')); await tick();
    assert.equal(p.calls.filter(m => m.cursor).length, 0);
    if (cancel === 'switch') assert.equal(p.query('[data-id="110"]'), null);
    else assert.equal(visible(p), cancel === 'setting' ? 2 : 1);
  });
}

test('an inline branch keeps its original request scope while the second click drains its pages', async t => {
  function modules(posts, cursor) {
    return { data: { instructions: [{ type: 'TimelineAddEntries', entries: [entry(post('100')),
      { entryId: 'conversationthread-101', content: { entryType: 'TimelineTimelineModule', items: [
        ...posts.map(value => ({ entryId: `tweet-${value.rest_id}`, item: { itemContent: { tweet_results: { result: value } } } })),
        ...(cursor ? [{ entryId: 'cursor-101', item: { itemContent: { itemType: 'TimelineTimelineCursor', cursorType: 'ShowMore', value: cursor } } }] : [])
      ] } }
    ] }] } };
  }
  const p = await open(t, m => !m.cursor ? modules([post('101', '100', 8), ...children(102, 4)], 'a')
    : m.cursor === 'a' ? modules(children(106, 2), 'b') : modules(children(108, 2)));
  more(p).click(); await tick(); assert.equal(visible(p), 3); assert.equal(p.calls.length, 1);
  more(p).click(); await tick(); await tick();
  assert.equal(visible(p), 8);
  assert.deepEqual(p.calls.map(m => [m.tweetId, m.cursor || '']), [['100', ''], ['100', 'a'], ['100', 'b']]);
});
