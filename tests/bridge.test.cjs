const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { source, tweet, tick, html } = require('./helpers.cjs');

function bridge(fetchResult, setupWindow) {
  const dom = new JSDOM('', { url: 'https://x.com/home', runScripts: 'outside-only', pretendToBeVisual: true });
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
  setupWindow?.(w);
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

test('native TweetDetail responses supplement shorter child reads without consuming native bodies', async t => {
  const data = posts => ({ data: { instructions: [{ entries: posts.map(result => ({ content: { itemContent: { tweet_results: { result } } } })) }] } });
  const full = data([tweet('100'), tweet('101', '100'), tweet('102', '101'), tweet('103', '102')]);
  const short = data([tweet('101', '100'), tweet('102', '101')]);
  let originalReads = 0;
  const b = bridge(r => {
    const vars = JSON.parse(r.url.searchParams.get('variables') || '{}');
    const json = vars.focalTweetId === '100' ? full : short;
    return { ok: true, json: async () => { originalReads++; return json; }, clone: () => ({ json: async () => json }) };
  }); t.after(() => b.w.close());
  const url = new URL('https://x.com/i/api/graphql/test/TweetDetail');
  url.searchParams.set('variables', JSON.stringify({ focalTweetId: '100' }));
  const native = await b.w.fetch(url.href); await tick();
  assert.equal(originalReads, 0, 'capture reads a clone only');
  assert.equal(await native.json(), full);
  const payload = await b.send({ type: 'READ_THREAD', tweetId: '101' });
  assert.equal(payload.sidepeekObservedThreads.filter(p => p.requestTweetId === '100').length, 1);
  b.w.eval(source('core.js'));
  const parsed = b.w.SidePeekCore.parseTweetDetail(payload, '101');
  assert.deepEqual(Array.from(parsed.replies, p => p.id), ['102', '103']);
});

test('native response replay excludes unknown and Spam cursor pages and expires its cache', async t => {
  const b = bridge(r => {
    const variables = JSON.parse(r.url.searchParams.get('variables') || '{}');
    const json = { data: { instructions: [{ entries: [
      { content: { cursorType: 'ShowMore', value: 'ordinary' } },
      { content: { cursorType: 'ShowMoreThreads', value: 'spam' } }
    ] }], marker: variables.cursor || 'initial' } };
    return { ok: true, json: async () => json, clone: () => ({ json: async () => json }) };
  }); t.after(() => b.w.close());
  const capture = async cursor => {
    const url = new URL('https://x.com/i/api/graphql/test/TweetDetail');
    url.searchParams.set('variables', JSON.stringify({ focalTweetId: '100', ...(cursor ? { cursor } : {}) }));
    await b.w.fetch(url.href); await tick();
  };
  await capture(); await capture('spam'); await capture('unknown'); await capture('ordinary');
  const payload = await b.send({ type: 'READ_THREAD', tweetId: '101' });
  assert.deepEqual(Array.from(payload.sidepeekObservedThreads.filter(p => p.requestTweetId === '100'), p => p.json.data.marker), ['initial', 'ordinary']);
  b.w.Date.now = () => Date.now() + 6 * 60 * 1000;
  assert.equal((await b.send({ type: 'READ_THREAD', tweetId: '101' })).sidepeekObservedThreads.some(p => p.requestTweetId === '100'), false);
});

test('observed response snapshots are bounded to twelve recent requests', async t => {
  const b = bridge(() => ({ ok: true, json: async () => ({ data: {} }) })); t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/test/TweetDetail?variables=%7B%7D');
  for (let id = 1; id <= 15; id++) await b.send({ type: 'READ_THREAD', tweetId: String(id) });
  const result = await b.send({ type: 'READ_THREAD', tweetId: '15' });
  assert.equal(result.sidepeekObservedThreads.length, 12);
  assert.equal(result.sidepeekObservedThreads[0].requestTweetId, '4');
});

test('page bridge, parser and drawer retain native descendants across a shorter child request', async t => {
  const detail = posts => ({ data: { instructions: [{ entries: posts.map(result => ({ content: { itemContent: { tweet_results: { result } } } })) }] } });
  const full = detail([tweet('99'), tweet('100', '99'), tweet('101', '100'), tweet('102', '101'), tweet('103', '102')]);
  const short = detail([tweet('100', '99'), tweet('101', '100')]);
  const b = bridge(r => {
    const vars = JSON.parse(r.url.searchParams.get('variables') || '{}');
    const json = vars.focalTweetId === '99' ? full : short;
    return { ok: true, json: async () => json, clone: () => ({ json: async () => json }) };
  }, w => {
    w.document.body.innerHTML = html;
    w.ResizeObserver = class { observe() {} disconnect() {} };
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.chrome = { runtime: { getURL: name => name }, storage: {
      sync: { get(defaults, cb) { queueMicrotask(() => cb(defaults)); }, set() {} },
      onChanged: { addListener() {} }
    } };
    w.postMessage = data => queueMicrotask(() => w.dispatchEvent(new w.MessageEvent('message', {
      source: w, origin: w.location.origin, data
    })));
  }); t.after(() => b.w.close());
  const url = new URL('https://x.com/i/api/graphql/test/TweetDetail');
  url.searchParams.set('variables', JSON.stringify({ focalTweetId: '99' }));
  await b.w.fetch(url.href); await tick();
  b.w.eval(source('core.js')); b.w.eval(source('content.js')); await tick();
  b.w.document.querySelector('[data-testid="tweetText"]').click(); await tick();
  assert.ok(b.w.document.querySelector('#sidepeek-drawer-root [data-id="103"]'));
  assert.equal(b.requests.length, 2, 'supplementing known replies adds no network requests');
});

test('successful sidebar reads also preserve descendants when the user switches to a child', async t => {
  const detail = posts => ({ data: { instructions: [{ entries: posts.map(result => ({ content: { itemContent: { tweet_results: { result } } } })) }] } });
  const b = bridge(r => {
    const vars = JSON.parse(r.url.searchParams.get('variables') || '{}');
    const json = detail(vars.focalTweetId === '100'
      ? [tweet('100'), tweet('101', '100'), tweet('102', '101'), tweet('103', '102')]
      : [tweet('101', '100'), tweet('102', '101')]);
    return { ok: true, json: async () => json };
  }); t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/test/TweetDetail?variables=%7B%7D');
  await b.send({ type: 'READ_THREAD', tweetId: '100' });
  const child = await b.send({ type: 'READ_THREAD', tweetId: '101' });
  b.w.eval(source('core.js'));
  assert.deepEqual(Array.from(b.w.SidePeekCore.parseTweetDetail(child, '101').replies, r => r.id), ['102', '103']);
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

function nativeMenuFixture(w) {
  const routed = [], normalized = [], rendered = [], copied = [], imports = [];
  const store = { state: { tweets: {} }, getState() { return this.state; },
    dispatch(action) { imports.push(action); this.state.tweets = { ...this.state.tweets, ...action.payload.tweets }; } };
  const original = { id_str: '100', user: { screen_name: 'timeline' }, permalink: '/timeline/status/100' };
  class NativeActions {
    constructor(props) { this.props = props; this.context = { store }; }
    _getShareMenuActionItems() {}
    _renderShareAction() { return this.props.tweet; }
  }
  const props = { tweet: original, id: '100', history: { push: (...args) => routed.push(args) }, promotedContent: { id: 'original-ad' } };
  const Provider = {};
  const react = { useState() {}, createElement: (type, props, children) => ({ type, props, children }) };
  const reactDom = { createRoot(host) {
    let menu;
    return {
      render(tree) {
        queueMicrotask(() => {
          const providers = [];
          while (tree.type === Provider) { providers.push(tree.props.value); tree = tree.children; }
          const instance = new tree.type(tree.props);
          const target = instance.render();
          rendered.push({ props: tree.props, target, providers });
          const button = w.document.createElement('button');
          button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
          button.addEventListener('click', () => {
            menu = w.document.createElement('div'); menu.setAttribute('role', 'menu');
            const copy = w.document.createElement('button'); copy.textContent = 'Copy link';
            copy.addEventListener('click', () => { copied.push(target.permalink); menu.remove(); button.setAttribute('aria-expanded', 'false'); });
            menu.append(copy); w.document.querySelector('#layers').append(menu); button.setAttribute('aria-expanded', 'true');
          });
          host.append(button);
        });
      },
      unmount() { menu?.remove(); host.replaceChildren(); }
    };
  } };
  const schema = { key: 'tweets', _idAttribute: 'rest_id', normalize() {}, denormalize() {} };
  function normalize(raw) {
    // Unexpected input given to normalize: match the loaded normalizr API.
    normalized.push(raw);
    const value = { ...raw.legacy, id_str: raw.rest_id, note_tweet: raw.note_tweet,
      limited_action_results: raw.limitedActionResults, extended_entities: raw.legacy.extended_entities,
      user: { screen_name: raw.core.user_results.result.core.screen_name } };
    return { result: raw.rest_id, entities: { tweets: { [raw.rest_id]: value } } };
  }
  function denormalize(id, schema, entities) { return entities.tweets[id]; }
  const tweetApi = { namespace: 'tweets', addTweet() {}, add: tweets => ({ type: 'native/add-entities', payload: { tweets } }),
    selectHydrated: (state, id) => {
      const value = state.tweets[id];
      return value && { ...value, permalink: `/${value.user.screen_name}/status/${id}` };
    } };
  const runtime = { c: { react: { exports: react }, dom: { exports: reactDom }, schema: { exports: { schema } },
    normalizer: { exports: { normalize, denormalize } }, api: { exports: { tweetApi } } }, m: {} };
  w.webpackChunkMenuFixture = [];
  w.webpackChunkMenuFixture.push = entry => entry[2](runtime);
  w.document.body.innerHTML = '<main><article data-testid="tweet"><button aria-haspopup="menu">Native share</button></article></main>' +
    '<div id="layers"></div><aside id="sidepeek-drawer-root"></aside>';
  let parent = { tag: 10, type: Provider, memoizedProps: { value: 'outer-X-context' } };
  for (let i = 0; i < 350; i++) parent = { return: parent };
  w.document.querySelector('button').__reactFiber$fixture = { return: { type: NativeActions,
    stateNode: new NativeActions(props), memoizedProps: props, return: parent } };
  return { routed, normalized, rendered, copied, original, props, imports };
}

test('quoting a sidebar-only reply uses native schemas and a hydrated permalink for the exact post', async t => {
  let fixture;
  const raw = tweet('123', '100', 'Source text');
  raw.note_tweet = { note_tweet_results: { result: { id: 'note', text: 'Long source text' } } };
  raw.legacy.extended_entities = { media: [{ type: 'video', media_key: 'source-media' }] };
  const restrictions = { limited_actions: [{ action: 'SendViaDm' }] };
  const b = bridge(() => ({ ok: true, json: async () => ({ data: { result: { tweet: raw, limitedActionResults: restrictions } } }) }),
    w => { fixture = nativeMenuFixture(w); });
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D');
  assert.equal((await b.send({ type: 'OPEN_NATIVE_QUOTE', tweetId: '123' })).opened, true);
  const [path, state] = fixture.routed[0];
  assert.equal(path, '/compose/post');
  assert.equal(state.quotedStatus.id_str, '123');
  assert.equal(state.quotedStatus.permalink, '/reader/status/123');
  assert.equal(state.quotedStatus.note_tweet, raw.note_tweet);
  assert.equal(state.quotedStatus.extended_entities, raw.legacy.extended_entities);
  assert.equal(state.quotedStatus.limited_action_results, restrictions);
  assert.equal(fixture.imports.length, 1);
  assert.equal(fixture.imports[0].payload.tweets['123'].id_str, '123');
  assert.equal(state.previousPath, '/home');
  assert.equal(fixture.props.tweet, fixture.original);
  assert.equal(fixture.original.id_str, '100');
  assert.equal(b.requests.every(request => !request.method || request.method === 'GET'), true);
});

test('native share targets the sidebar reply, inherits the full provider chain and cleans up after Copy link', async t => {
  let fixture;
  const b = bridge(() => ({ ok: true, json: async () => ({ data: tweet('123') }) }), w => { fixture = nativeMenuFixture(w); });
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D');
  assert.equal((await b.send({ type: 'OPEN_NATIVE_SHARE', tweetId: '123', menuToken: 7,
    anchor: { left: 800, top: 300, width: 34, height: 34 } })).opened, true);
  assert.equal(fixture.rendered[0].target.id_str, '123');
  assert.deepEqual(fixture.rendered[0].providers, ['outer-X-context']);
  assert.equal(fixture.rendered[0].props.promotedContent, undefined);
  assert.equal(fixture.props.promotedContent.id, 'original-ad');
  const host = b.w.document.querySelector('[data-sidex-native-share]');
  assert.equal(host.parentElement, b.w.document.body, 'viewport anchor must stay outside the transformed drawer');
  assert.equal(host.style.left, '800px');
  b.w.document.querySelector('[role="menu"] button').click(); await tick();
  assert.deepEqual(fixture.copied, ['/reader/status/123']);
  assert.equal(b.w.document.querySelector('[data-sidex-native-share]'), null);
  assert.equal(fixture.props.tweet, fixture.original);
});

test('canceling a pending native share prevents a late target read from reopening its menu', async t => {
  let fixture, finish, waiting = false;
  const b = bridge(() => waiting ? new Promise(resolve => { finish = resolve; }) : { ok: true, json: async () => ({ data: {} }) },
    w => { fixture = nativeMenuFixture(w); });
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D'); waiting = true;
  const pending = b.send({ type: 'OPEN_NATIVE_SHARE', tweetId: '123', anchor: { left: 0, top: 0, width: 34, height: 34 } });
  await tick();
  await b.send({ type: 'CLOSE_NATIVE_SHARE', tweetId: '123' });
  finish({ ok: true, json: async () => ({ data: tweet('123') }) });
  assert.equal((await pending).opened, false);
  assert.equal(fixture.rendered.length, 0);
});

test('an official composer opened during quote loading keeps its draft and prevents a second composer', async t => {
  let fixture, finish, waiting = false;
  const b = bridge(() => waiting ? new Promise(resolve => { finish = resolve; }) : { ok: true, json: async () => ({ data: {} }) },
    w => { fixture = nativeMenuFixture(w); });
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D'); waiting = true;
  const pending = b.send({ type: 'OPEN_NATIVE_QUOTE', tweetId: '123' });
  const checked = assert.rejects(pending, /NATIVE_DRAFT_ALREADY_OPEN/);
  await tick();
  b.w.document.querySelector('#layers').innerHTML = '<div role="dialog"><div data-testid="tweetTextarea_0">Keep my draft</div></div>';
  finish({ ok: true, json: async () => ({ data: tweet('123') }) });
  await checked;
  assert.equal(fixture.routed.length, 0);
  assert.equal(b.w.document.querySelector('[data-testid="tweetTextarea_0"]').textContent, 'Keep my draft');
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
