const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { source } = require('./helpers.cjs');

function bridge(fetchResult) {
  const dom = new JSDOM('', { url: 'https://x.com/home', runScripts: 'outside-only' });
  const w = dom.window;
  const requests = [];
  w.Headers = Headers;
  w.Request = Request;
  w.document.cookie = 'ct0=test-session';
  w.fetch = async (url, options = {}) => {
    const request = { url: new URL(url, w.location.origin), ...options };
    requests.push(request);
    return fetchResult?.(request) || { ok: true, json: async () => ({ data: { success: true } }) };
  };
  w.eval(source('page-bridge.js'));
  let id = 0;
  const send = data => new Promise((resolve, reject) => {
    const requestId = ++id;
    const listener = event => {
      if (event.data?.source !== 'sidepeek-page' || event.data.requestId !== requestId) return;
      w.removeEventListener('message', listener);
      if (event.data.ok) resolve(event.data.payload); else reject(new Error(event.data.error));
    };
    w.addEventListener('message', listener);
    w.dispatchEvent(new w.MessageEvent('message', { source: w, origin: w.location.origin,
      data: { source: 'sidepeek-content', requestId, ...data } }));
  });
  return { w, requests, send };
}

test('all six toggle operations map desired state to the correct X action', async t => {
  const b = bridge(); t.after(() => b.w.close());
  const cases = [ ['like', true, 'FavoriteTweet'], ['like', false, 'UnfavoriteTweet'],
    ['bookmark', true, 'CreateBookmark'], ['bookmark', false, 'DeleteBookmark'],
    ['repost', true, 'CreateRetweet'], ['repost', false, 'DeleteRetweet'] ];
  for (const [action, active, operation] of cases) {
    await b.w.fetch(`/i/api/graphql/test/${operation}`, { method: 'POST', body: '{}' });
    await b.send({ type: 'TOGGLE_ACTION', action, active, tweetId: '123' });
    const last = b.requests.at(-1);
    assert.ok(last.url.pathname.endsWith('/' + operation));
    const variables = JSON.parse(last.body).variables;
    assert.equal(action === 'repost' && !active ? variables.source_tweet_id : variables.tweet_id, '123');
  }
});

test('official translation uses the observed Grok contract and parses result.text', async t => {
  const b = bridge(() => ({ ok: true, json: async () => ({ result: { content_type: 'POST', text: '官方译文' } }) }));
  t.after(() => b.w.close());
  const result = await b.send({ type: 'TRANSLATE_TWEET', tweetId: '123', destLang: 'zh' });
  const last = b.requests.at(-1);
  assert.equal(last.url.href, 'https://api.x.com/2/grok/translation.json');
  assert.equal(last.method, 'POST');
  assert.deepEqual(JSON.parse(last.body), { content_type: 'POST', id: '123', dst_lang: 'zh' });
  assert.equal(result.provider, 'X / Grok');
  assert.equal(result.translation, '官方译文');
});

test('translation failures remain actionable and never silently call Google', async t => {
  const b = bridge(() => ({ ok: false, status: 429, json: async () => ({}) }));
  t.after(() => b.w.close());
  await assert.rejects(b.send({ type: 'TRANSLATE_TWEET', tweetId: '123', destLang: 'zh' }), /429/);
  assert.equal(b.requests.length, 1);
});

test('captured official feature switches stay false when X disabled them', async t => {
  const b = bridge(); t.after(() => b.w.close());
  const url = new URL('https://x.com/i/api/graphql/observed/UserByScreenName');
  url.searchParams.set('features', JSON.stringify({ enabled: true, disabled: false }));
  await b.w.fetch(url.href);
  await assert.rejects(b.send({ type: 'FETCH_USER_PROFILE', screenName: 'reader' }));
  assert.deepEqual(JSON.parse(b.requests.at(-1).url.searchParams.get('features')), { enabled: true, disabled: false });
});

test('Google chunks preserve the complete Unicode text, links and whitespace; requests are deduplicated', async () => {
  const requests = [];
  const context = vm.createContext({ URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    chrome: { runtime: { onMessage: { addListener() {} } } },
    fetch: async url => {
      const text = url.searchParams.get('q'); requests.push(text);
      return { ok: true, json: async () => [[[text, '', null]], null, 'en'] };
    }
  });
  vm.runInContext(source('background.js'), context);
  const text = ('Hello 😀 https://example.com\n\n').repeat(200);
  const [first, second] = await Promise.all([context.translateWithGoogle(text, 'zh'), context.translateWithGoogle(text, 'zh')]);
  assert.equal(first.translation, text);
  assert.equal(second, first);
  assert.ok(requests.length > 1);
  assert.ok(requests.every(part => Array.from(part).length <= 1800));
  const count = requests.length;
  await context.translateWithGoogle(text, 'zh');
  assert.equal(requests.length, count);
});
