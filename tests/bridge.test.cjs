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
  w.eval(source('vendor/twitter-text.js'));
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

test('comment pagination forwards the focal ID and opaque cursor to TweetDetail', async t => {
  const b = bridge(); t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D');
  await b.send({ type: 'READ_THREAD', tweetId: '123', cursor: 'opaque+/cursor==' });
  const variables = JSON.parse(b.requests.at(-1).url.searchParams.get('variables'));
  assert.equal(variables.focalTweetId, '123');
  assert.equal(variables.cursor, 'opaque+/cursor==');
});

test('native replies use X router state for the exact target without navigation, publication or another window', async t => {
  const b = bridge(); t.after(() => b.w.close());
  const link = b.w.document.createElement('a'); link.href = '/compose/post'; b.w.document.body.append(link);
  const routed = [];
  link.__reactFiber$test = { return: { memoizedProps: { history: { push: (...args) => routed.push(args) } } } };
  b.w.open = () => assert.fail('No new windows');
  assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123' })).opened, true);
  assert.equal(routed[0][0], '/compose/post');
  assert.equal(routed[0][1].inReplyToStatusId, '123');
  assert.equal(routed[0][1].previousPath, '/home');
  assert.equal(b.requests.length, 0);
  const modal = b.w.document.createElement('div'); modal.id = 'layers';
  modal.innerHTML = '<div role="dialog"><div data-testid="tweetTextarea_0">Other draft</div></div>'; b.w.document.body.append(modal);
  await assert.rejects(b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '456' }), /NATIVE_DRAFT_ALREADY_OPEN/);
  assert.equal(routed.length, 1);
  assert.equal(modal.textContent, 'Other draft');
});

test('an ambiguous long-post failure never retries through another publication operation', async t => {
  const b = bridge(() => ({ ok: false, status: 503, json: async () => ({ errors: [{ message: 'Temporary failure' }] }) }));
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/note/CreateNoteTweet', { method: 'POST', body: '{}' });
  await assert.rejects(b.send({ type: 'CREATE_REPLY', tweetId: '100', text: 'x'.repeat(300) }), /Temporary failure/);
  assert.equal(b.requests.length, 2);
  assert.equal(b.requests.some(r => r.url.pathname.endsWith('/CreateTweet')), false);
});

test('Escape from a quick tool returns directly to its starting entry, including a photo viewer, and leaves official replies alone', async t => {
  for (const path of ['/home', '/reader/status/123/photo/1']) {
    const b = bridge(); t.after(() => b.w.close());
    b.w.history.replaceState({}, '', path);
    const link = b.w.document.createElement('a'); link.href = '/compose/post'; b.w.document.body.append(link);
    const layers = b.w.document.createElement('div'); layers.id = 'layers'; b.w.document.body.append(layers);
    const router = { _currentLocationIndex: 5,
      push(url) { this._currentLocationIndex++; b.w.history.pushState({}, '', url); },
      go(delta) {
        assert.equal(delta, -2, 'skip both the picker and intermediate composer');
        this._currentLocationIndex += delta; layers.replaceChildren();
        b.w.history.replaceState({}, '', path);
      } };
    link.__reactFiber$test = { memoizedProps: { history: router } };
    let nativeEsc = 0;
    b.w.addEventListener('keydown', () => nativeEsc++, true);
    assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123', quickTool: true })).opened, true);
    layers.innerHTML = '<div role="dialog"><input aria-label="Search for GIFs"></div>';
    router.push('/i/foundmedia/search');
    const event = new b.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    b.w.document.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(nativeEsc, 0);
    assert.equal(b.w.location.pathname, path);
    assert.equal(layers.children.length, 0);
    assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123' })).opened, true);
    layers.innerHTML = '<div role="dialog"><div data-testid="tweetTextarea_0"></div></div>';
    b.w.document.dispatchEvent(new b.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(nativeEsc, 1, 'explicit official replies retain the official handler');
    assert.equal(b.requests.length, 0);
  }
});

test('quick tools require a tracked return entry, while photo inline editors are not mistaken for unrelated reply dialogs', async t => {
  const b = bridge(); t.after(() => b.w.close());
  const link = b.w.document.createElement('a'); link.href = '/compose/post'; b.w.document.body.append(link);
  let opened = 0;
  link.__reactFiber$test = { memoizedProps: { history: { push() { opened++; } } } };
  assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123', quickTool: true })).opened, false);
  assert.equal(opened, 0);
  const layers = b.w.document.createElement('div'); layers.id = 'layers';
  layers.innerHTML = '<div role="dialog"><div data-testid="swipe-to-dismiss"></div><section role="region"><div data-testid="tweetTextarea_0">Photo inline draft</div></section></div>';
  b.w.document.body.append(layers);
  assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123' })).opened, true);
  assert.equal(opened, 1);
  assert.equal(layers.textContent, 'Photo inline draft');
});

test('native creation responses notify the sidebar without consuming the response body', async t => {
  const payload = { data: { create_tweet: { tweet_results: { result: { rest_id: '999' } } } } };
  let clones = 0;
  const b = bridge(() => ({ ok: true, clone() { clones++; return { json: async () => payload }; }, json: async () => payload }));
  t.after(() => b.w.close());
  const event = new Promise(resolve => b.w.addEventListener('message', message => {
    if (message.data?.type === 'REPLY_CREATED') resolve(message.data);
  }));
  const response = await b.w.fetch('/i/api/graphql/create/CreateTweet', { method: 'POST', body: '{}' });
  assert.equal((await event).payload.data.create_tweet.tweet_results.result.rest_id, '999');
  assert.equal(clones, 1);
  assert.deepEqual(await response.json(), payload);
});

test('a long raw URL is still a standard tweet after official URL weighting', async t => {
  const b = bridge(); t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/create/CreateTweet', { method: 'POST', body: '{}' });
  await b.send({ type: 'CREATE_REPLY', tweetId: '100', text: 'https://example.com/' + 'a'.repeat(350) });
  assert.equal(b.requests.length, 2);
  assert.ok(b.requests.at(-1).url.pathname.endsWith('/CreateTweet'));
});

test('a failed upload INIT is rejected even when its error payload contains a media ID', async t => {
  const b = bridge(() => ({ ok: false, status: 400, json: async () => ({ media_id_string: '77' }) }));
  t.after(() => b.w.close());
  await assert.rejects(b.send({ type: 'UPLOAD_MEDIA', base64: 'aGVsbG8=', mimeType: 'image/png', size: 5 }), /400/);
  assert.equal(b.requests.length, 1);
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
