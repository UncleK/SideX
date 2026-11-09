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

function xWebBridgeFixture(w, { depth = 140, index = 7, respond = () => ({ data: { success: true } }) } = {}) {
  const calls = [], routed = [], traveled = [];
  const entries = new Map([[index, w.location.pathname + w.location.search]]);
  const nativeHistory = {
    location: { state: { __TSR_index: index } },
    go(delta) {
      traveled.push(delta);
      this.location.state.__TSR_index += delta;
      const path = entries.get(this.location.state.__TSR_index);
      if (path) w.history.replaceState({}, '', path);
    }
  };
  const navigation = {
    push(path, state) {
      routed.push({ path, state });
      nativeHistory.location.state.__TSR_index++;
      entries.set(nativeHistory.location.state.__TSR_index, path);
      w.history.pushState({}, '', path);
    },
    replace(path) { w.history.replaceState({}, '', path); },
    goBack() { nativeHistory.go(-1); },
    preload() {}
  };
  const environment = { getNetwork: () => ({ execute(operation, variables, cacheConfig) {
    const call = { operation, variables, cacheConfig }; calls.push(call);
    return { subscribe(observer) {
      queueMicrotask(() => {
        try {
          const result = respond(call);
          if (result instanceof Error || result instanceof w.Error) observer.error(result);
          else { if (result !== undefined) observer.next(result); observer.complete(); }
        } catch (error) { observer.error(error); }
      });
      return { unsubscribe() { call.unsubscribed = true; } };
    } };
  } }) };
  w.document.head.innerHTML = '<script src="https://abs.twimg.com/x-web/x-web/entry-client-test.js"></script>';
  const link = w.document.createElement('a'); link.href = '/compose/post'; w.document.body.append(link);
  let fiber = { tag: 10, memoizedProps: { value: { environment } } };
  fiber = { tag: 10, memoizedProps: { value: { buildLocation() {}, history: nativeHistory } }, return: fiber };
  fiber = { tag: 10, memoizedProps: { value: navigation }, return: fiber };
  for (let i = 0; i < depth; i++) fiber = { memoizedProps: {}, return: fiber };
  link.__reactFiber$xWebFixture = fiber;
  return { calls, routed, traveled, nativeHistory, navigation, environment };
}

test('x-web toggles use the six observed native Relay operations with camelCase target variables', async t => {
  let fixture;
  const b = bridge(null, w => { fixture = xWebBridgeFixture(w); }); t.after(() => b.w.close());
  const cases = [
    ['like', true, 'FavoriteTweet', 'gWHQmsY1Atd_XuOoMR2v5A'],
    ['like', false, 'likeButtonControlUnfavoriteMutation', 'jd_5MSDRzKH4MJ3c4BmrqQ'],
    ['bookmark', true, 'BookmarkAdd', '9559L3Eb62SZndMSVHIeNw'],
    ['bookmark', false, 'BookmarkDelete', 'jTTS9lZmxUq-eYwmY8pHiA'],
    ['repost', true, 'CreateRetweet', 'lBRHQaQKWQwF0eaGzH209w'],
    ['repost', false, 'retweetButtonUnretweetMutation', 'TSIYEnua4u_yleM5nrWzFw']
  ];
  for (const [action, active, name, id] of cases) {
    await b.send({ type: 'TOGGLE_ACTION', action, active, tweetId: '123' });
    const call = fixture.calls.at(-1);
    assert.equal(call.operation.name, name);
    assert.equal(call.operation.id, id);
    assert.equal(call.operation.operationKind, 'mutation');
    assert.equal(call.operation.text, null);
    assert.deepEqual(JSON.parse(JSON.stringify(call.variables)), { tweetId: '123' });
    assert.equal(call.cacheConfig.force, true);
  }
  assert.equal(fixture.calls.length, 6);
  assert.equal(b.requests.length, 0, 'the extension must not bypass X\'s native network and transaction headers');
});

test('x-web native mutation errors and missing confirmations never retry through another transport', async t => {
  for (const kind of ['network', 'graphql', 'empty']) {
    let fixture;
    const b = bridge(null, w => { fixture = xWebBridgeFixture(w, { respond: () => kind === 'network'
      ? new w.Error('Native network unavailable') : kind === 'graphql' ? { errors: [{ message: 'Denied by X' }] } : undefined }); });
    t.after(() => b.w.close());
    await assert.rejects(b.send({ type: 'TOGGLE_ACTION', action: 'like', active: true, tweetId: '123' }),
      kind === 'network' ? /Native network unavailable/ : kind === 'graphql' ? /Denied by X/ : /确认/);
    assert.equal(fixture.calls.length, 1);
    assert.equal(b.requests.length, 0, 'an unconfirmed write cannot be sent again as a fallback fetch');
  }
});

test('x-web writes fail before sending if the native Relay environment is unavailable', async t => {
  const b = bridge(null, w => {
    w.document.head.innerHTML = '<script src="https://abs.twimg.com/x-web/x-web/entry-client-test.js"></script>';
    w.document.body.innerHTML = '<a href="/compose/post">Post</a>';
  }); t.after(() => b.w.close());
  await assert.rejects(b.send({ type: 'TOGGLE_ACTION', action: 'bookmark', active: true, tweetId: '123' }), /原生请求入口尚未就绪/);
  assert.equal(b.requests.length, 0, 'missing native headers cannot trigger a direct-fetch fallback');
});

test('x-web replies retain the 280-character boundary, exact recipient, media and original success payload', async t => {
  const success = { data: { create_tweet: { tweet_results: { result: tweet('999', '123') } } }, extensions: { trace: 'native-confirmation' } };
  const downvoteProvider = '__relay_internal__pv__replydownvoteenabledrelayprovider';
  let fixture;
  const b = bridge(null, w => { fixture = xWebBridgeFixture(w, { respond: ({ variables }) =>
    Object.hasOwn(variables, downvoteProvider) ? success : new w.Error('HTTP 422: missing Relay variable') }); });
  t.after(() => b.w.close());
  for (const [text, name, id, mediaIds] of [
    ['x'.repeat(280), 'CreateTweet', 'JUPTZ5nUJjopwMyPw0DYiQ', []],
    ['x'.repeat(281), 'createTweetNoteTweetMutation', '8TlLvl0sHLceb7rlGZZ6bg', ['456']],
    ['https://example.com/' + 'a'.repeat(350), 'CreateTweet', 'JUPTZ5nUJjopwMyPw0DYiQ', []],
    ['', 'CreateTweet', 'JUPTZ5nUJjopwMyPw0DYiQ', ['456']]
  ]) {
    const result = await b.send({ type: 'CREATE_REPLY', tweetId: '123', text, mediaIds });
    assert.deepEqual(result, success);
    const call = fixture.calls.at(-1), variables = call.variables;
    assert.equal(call.operation.name, name); assert.equal(call.operation.id, id);
    assert.equal(variables.tweet_text, text);
    assert.deepEqual(JSON.parse(JSON.stringify(variables.reply)), { in_reply_to_tweet_id: '123', exclude_reply_user_ids: [] });
    if (mediaIds.length) {
      assert.deepEqual(JSON.parse(JSON.stringify(variables.media)), { media_entities: [{ media_id: '456', tagged_users: [] }], possibly_sensitive: false });
    } else assert.equal(Object.hasOwn(variables, 'media'), false);
    assert.equal(Object.hasOwn(variables, 'dark_request'), false);
    assert.equal(Object.hasOwn(variables, 'disallowed_reply_options'), false);
    assert.equal(Object.hasOwn(variables, 'semantic_annotation_ids'), false);
    assert.equal(variables[downvoteProvider], false);
    assert.equal(variables.__relay_internal__pv__xclientsfeaturesappviewerisloggedinrelayprovider, true);
  }
  assert.equal(fixture.calls.length, 4);
  assert.equal(b.requests.length, 0);
});

test('x-web long-reply failure is returned without a second publication or mutation of the submitted draft', async t => {
  const draft = { type: 'CREATE_REPLY', tweetId: '123', text: 'Keep this unfinished reply. '.repeat(20), mediaIds: ['456'] };
  const original = structuredClone(draft);
  let fixture;
  const b = bridge(null, w => { fixture = xWebBridgeFixture(w, { respond: () => new w.Error('Ambiguous native failure') }); });
  t.after(() => b.w.close());
  await assert.rejects(b.send(draft), /Ambiguous native failure/);
  assert.deepEqual(draft, original);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].operation.name, 'createTweetNoteTweetMutation');
  assert.equal(b.requests.length, 0);
});

test('deep x-web providers open replies and quoted posts for the exact requested ID without fetching or publishing', async t => {
  let fixture;
  const b = bridge(null, w => { fixture = xWebBridgeFixture(w, { depth: 180 }); }); t.after(() => b.w.close());
  b.w.open = () => assert.fail('No new windows');
  assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123' })).opened, true);
  assert.equal(fixture.routed[0].path, '/compose/post?in_reply_to=123');
  assert.equal((await b.send({ type: 'OPEN_NATIVE_QUOTE', tweetId: '456' })).opened, true);
  assert.equal(fixture.routed[1].path, '/compose/post?quote_tweet_id=456');
  assert.equal(fixture.calls.length, 0); assert.equal(b.requests.length, 0);
});

test('an existing x-web native textarea draft blocks reply and quote launch without overwriting its content', async t => {
  let fixture;
  const b = bridge(null, w => { fixture = xWebBridgeFixture(w); }); t.after(() => b.w.close());
  b.w.document.body.insertAdjacentHTML('beforeend', '<div role="dialog" data-slot="xds-modal-surface"><textarea aria-multiline="true">Keep official draft</textarea></div>');
  for (const type of ['OPEN_NATIVE_REPLY', 'OPEN_NATIVE_QUOTE']) {
    await assert.rejects(b.send({ type, tweetId: '123' }), /NATIVE_DRAFT_ALREADY_OPEN/);
  }
  assert.equal(b.w.document.querySelector('textarea').value, 'Keep official draft');
  assert.equal(fixture.routed.length, 0); assert.equal(fixture.calls.length, 0); assert.equal(b.requests.length, 0);
});

test('x-web quick-tool Escape returns once to the captured TSR entry, including an underlying photo route', async t => {
  for (const path of ['/home', '/reader/status/123/photo/1']) {
    let fixture;
    const b = bridge(null, w => {
      w.history.replaceState({}, '', path);
      fixture = xWebBridgeFixture(w, { index: 12, depth: 180 });
    });
    t.after(() => b.w.close());
    let nativeEsc = 0;
    b.w.addEventListener('keydown', () => nativeEsc++, true);
    assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123', quickTool: true })).opened, true);
    b.w.document.body.insertAdjacentHTML('beforeend', '<div role="dialog" data-slot="xds-modal-surface"><input aria-label="Search for GIFs"></div>');
    fixture.navigation.push('/i/foundmedia/search');
    const first = new b.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    b.w.document.dispatchEvent(first);
    assert.equal(first.defaultPrevented, true);
    assert.deepEqual(fixture.traveled, [-2]);
    assert.equal(fixture.nativeHistory.location.state.__TSR_index, 12);
    assert.equal(b.w.location.pathname, path);
    assert.equal(nativeEsc, 0);
    b.w.document.dispatchEvent(new b.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.deepEqual(fixture.traveled, [-2], 'a second Escape belongs to X, not the completed tool session');
    assert.equal(nativeEsc, 1);
    assert.equal(fixture.calls.length, 0); assert.equal(b.requests.length, 0);
  }
});

test('an untracked x-web quick tool does not open a composer that Escape could not restore', async t => {
  let fixture;
  const b = bridge(null, w => { fixture = xWebBridgeFixture(w, { index: undefined });
    delete fixture.nativeHistory.location.state.__TSR_index;
  }); t.after(() => b.w.close());
  assert.equal((await b.send({ type: 'OPEN_NATIVE_REPLY', tweetId: '123', quickTool: true })).opened, false);
  assert.equal(fixture.routed.length, 0);
});

test('sidebar-only profile sources use the requested handle, native contexts and token-scoped cleanup', async t => {
  const rendered = [];
  const b = bridge(null, w => {
    const Provider = {};
    function NativeProfile() {}
    const react = { useState() {}, createElement: (type, props, children) => ({ type, props, children }) };
    const reactDom = { createRoot: host => ({ render(tree) {
      assert.equal(tree.type, Provider); assert.equal(tree.props.value, 'X context');
      const profile = tree.children; assert.equal(profile.type, NativeProfile);
      assert.equal(profile.props.onAvatarClick, undefined, 'do not inherit the source profile action');
      rendered.push(profile.props.screenName);
      const link = w.document.createElement('a'); link.href = profile.children.props.href; host.append(link);
    }, unmount() { host.replaceChildren(); } }) };
    const runtime = { c: { react: { exports: react }, dom: { exports: reactDom } }, m: {} };
    w.webpackChunkProfileFixture = []; w.webpackChunkProfileFixture.push = entry => entry[2](runtime);
    w.document.body.innerHTML = '<main><a href="/source">Source</a></main>';
    w.document.querySelector('a').__reactFiber$fixture = { return: { type: NativeProfile,
      memoizedProps: { screenName: 'source', children: {}, onAvatarClick: () => assert.fail('wrong profile') },
      return: { tag: 10, type: Provider, memoizedProps: { value: 'X context' } } } };
  });
  t.after(() => b.w.close());
  assert.equal((await b.send({ type: 'PREPARE_NATIVE_USER_HOVER', screenName: 'mentioned', hoverToken: 1,
    anchor: { left: 900, top: 200, width: 80, height: 20 } })).ready, true);
  assert.equal(b.w.document.querySelector('[data-sidex-native-profile-source="1"] a').pathname, '/mentioned');
  assert.equal((await b.send({ type: 'PREPARE_NATIVE_USER_HOVER', screenName: 'other_user', hoverToken: 2 })).ready, true);
  assert.equal(b.w.document.querySelector('[data-sidex-native-profile-source="1"]'), null);
  await b.send({ type: 'CLOSE_NATIVE_USER_HOVER', hoverToken: 1 });
  assert.ok(b.w.document.querySelector('[data-sidex-native-profile-source="2"]'), 'an old dismissal cannot remove a newer user');
  await b.send({ type: 'CLOSE_NATIVE_USER_HOVER', hoverToken: 2 });
  assert.equal(b.w.document.querySelector('[data-sidex-native-profile-source]'), null);
  assert.deepEqual(rendered, ['mentioned', 'other_user']);
  assert.equal(b.requests.length, 0);
});

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

test('x-web can read the first detail without a Webpack registry or previous detail navigation', async t => {
  const b = bridge(null, w => {
    w.document.head.innerHTML = '<script src="https://abs.twimg.com/x-web/x-web/entry-client-test.js"></script>';
  });
  t.after(() => b.w.close());
  await b.send({ type: 'READ_THREAD', tweetId: '100', cursor: 'opaque-next' });
  const request = b.requests.at(-1);
  assert.equal(request.url.origin, 'https://api.x.com');
  assert.equal(request.url.pathname, '/graphql/L4cB5UHNoH3-RjFtwlfluw/TweetDetail');
  const variables = JSON.parse(request.url.searchParams.get('variables'));
  assert.equal(variables.focalTweetId, '100');
  assert.equal(variables.cursor, 'opaque-next');
  assert.equal(variables.withFocalTweet, true);
  assert.equal(request.url.searchParams.has('features'), false);
});

test('observed x-web detail IDs, endpoint and provider switches override the compatibility defaults', async t => {
  const b = bridge(); t.after(() => b.w.close());
  const observed = new URL('https://api.x.com/graphql/fresh-native-id/TweetDetail');
  observed.searchParams.set('variables', JSON.stringify({ focalTweetId: '200', cursor: 'old-cursor',
    __relay_internal__pv__postctafetchenabledrelayprovider: true,
    __relay_internal__pv__xclientsfeaturestweetcomponentsgrokanalyzepostrelayprovider: false }));
  await b.w.fetch(observed.toString());
  await b.send({ type: 'READ_THREAD', tweetId: '100' });
  const request = b.requests.at(-1);
  assert.equal(request.url.origin, 'https://api.x.com');
  assert.equal(request.url.pathname, '/graphql/fresh-native-id/TweetDetail');
  const variables = JSON.parse(request.url.searchParams.get('variables'));
  assert.equal(variables.focalTweetId, '100');
  assert.equal(variables.cursor, null);
  assert.equal(variables.__relay_internal__pv__postctafetchenabledrelayprovider, true);
  assert.equal(variables.__relay_internal__pv__xclientsfeaturestweetcomponentsgrokanalyzepostrelayprovider, false);
  observed.pathname = '/graphql/newer-native-id/TweetDetail';
  await b.w.fetch(observed.toString());
  await b.send({ type: 'READ_THREAD', tweetId: '200' });
  assert.equal(b.requests.at(-1).url.pathname, '/graphql/newer-native-id/TweetDetail', 'a cached operation cannot override a newer native ID');
});

test('a fallback sidebar read is cached without being broadcast as a separate native observation', async t => {
  const json = { data: { instructions: [{ entries: [tweet('101', '100'), tweet('102', '101')]
    .map(result => ({ content: { itemContent: { tweet_results: { result } } } })) }] } };
  const b = bridge(r => JSON.parse(r.url.searchParams.get('variables') || '{}').rankingMode
    ? { ok: false, status: 500, json: async () => ({ errors: [{ message: 'retry captured request' }] }) }
    : { ok: true, json: async () => json, clone: () => ({ json: async () => json }) });
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D'); await tick();
  const notifications = [];
  b.w.addEventListener('message', event => { if (event.data?.type === 'NATIVE_THREAD_OBSERVED') notifications.push(event.data); });
  const result = await b.send({ type: 'READ_THREAD', tweetId: '101' }); await tick();
  assert.equal(b.requests.length, 3, 'one failed primary attempt and one captured fallback');
  assert.equal(notifications.length, 0, 'the caller owns applying the scoped response');
  assert.ok(result.sidepeekObservedThreads.some(page => page.requestTweetId === '101'));
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

function nativeMenuFixture(w, kind = 'share') {
  const routed = [], normalized = [], rendered = [], copied = [], imports = [], grok = [];
  const store = { state: { tweets: {} }, getState() { return this.state; },
    dispatch(action) { imports.push(action); this.state.tweets = { ...this.state.tweets, ...action.payload.tweets }; } };
  const original = { id_str: '100', user: { screen_name: 'timeline' }, permalink: '/timeline/status/100' };
  class NativeActions {
    constructor(props) { this.props = props; this.context = { store }; }
    _getShareMenuActionItems() {}
    _renderShareAction() { return this.props.tweet; }
    _renderCurationActionMenu() {}
    _renderGrokButton() {}
    _openGrok(payload) { grok.push(payload); }
    render() { return this.props.tweet; }
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
          if (kind === 'more') button.dataset.testid = 'caret';
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
  if (kind !== 'share') w.document.querySelector('button').dataset.testid = 'caret';
  return { routed, normalized, rendered, copied, original, props, imports, grok };
}

test('native More targets a sidebar-only reply, drops source-row callbacks and retains native dialogs until dismissed', async t => {
  let fixture;
  const b = bridge(() => ({ ok: true, json: async () => ({ data: tweet('123') }) }), w => { fixture = nativeMenuFixture(w, 'more'); });
  t.after(() => b.w.close());
  fixture.props.onTweetDismiss = () => assert.fail('Source row callback must not be copied');
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D');
  assert.equal((await b.send({ type: 'OPEN_NATIVE_MORE', tweetId: '123', menuToken: 1,
    anchor: { left: 900, top: 200, width: 26, height: 26 } })).opened, true);
  assert.equal(fixture.rendered[0].target.id_str, '123');
  assert.equal(fixture.rendered[0].props.onTweetDismiss, undefined);
  assert.equal(fixture.props.tweet.id_str, '100');
  const host = b.w.document.querySelector('[data-sidex-native-more]');
  assert.equal(host.parentElement, b.w.document.body);
  assert.equal(host.style.left, '900px');
  const dialog = b.w.document.createElement('div'); dialog.setAttribute('role', 'dialog');
  b.w.document.querySelector('#layers').append(dialog);
  b.w.document.querySelector('[role="menu"] button').click(); await tick();
  assert.ok(host.isConnected, 'native Embed and disclosure dialogs keep their owning React root');
  dialog.remove(); await tick();
  assert.equal(host.isConnected, false);
});

test('Grok uses the explicit requested entity and permalink without changing the source row', async t => {
  let fixture;
  const b = bridge(() => ({ ok: true, json: async () => ({ data: tweet('123') }) }), w => { fixture = nativeMenuFixture(w, 'more'); });
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D');
  assert.equal((await b.send({ type: 'OPEN_NATIVE_GROK', tweetId: '123' })).opened, true);
  assert.equal(fixture.grok.length, 1);
  assert.equal(fixture.grok[0].analysisEntityId, '123');
  assert.equal(fixture.grok[0].text, 'https://x.com/reader/status/123');
  assert.equal(fixture.grok[0].autoSubmit, true);
  assert.equal(fixture.original.id_str, '100');
  assert.equal(fixture.rendered.length, 0);
});

test('canceling pending More hydration prevents its menu from reopening', async t => {
  let fixture, finish, waiting = false;
  const b = bridge(() => waiting ? new Promise(resolve => { finish = resolve; }) : { ok: true, json: async () => ({ data: {} }) },
    w => { fixture = nativeMenuFixture(w, 'more'); });
  t.after(() => b.w.close());
  await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D'); waiting = true;
  const pending = b.send({ type: 'OPEN_NATIVE_MORE', tweetId: '123', anchor: { left: 0, top: 0, width: 26, height: 26 } });
  await tick(); await b.send({ type: 'CLOSE_NATIVE_MORE', tweetId: '123' });
  finish({ ok: true, json: async () => ({ data: tweet('123') }) });
  assert.equal((await pending).opened, false);
  assert.equal(fixture.rendered.length, 0);
});

for (const ownThread of [true, false]) {
  test('More derives reply moderation from the selected thread author: ' + ownThread, async t => {
    let fixture;
    const b = bridge(() => ({ ok: true, json: async () => ({ data: tweet('123', '100') }) }), w => {
      fixture = nativeMenuFixture(w, 'more');
      const owner = w.document.querySelector('article button').__reactFiber$fixture.return;
      owner.stateNode.context.viewerUserId = 'viewer';
      owner.stateNode.context.store.state.tweets['100'] = { ...fixture.original,
        user: { ...fixture.original.user, id_str: ownThread ? 'viewer' : 'other' } };
      fixture.props.withHideReply = !ownThread;
    });
    t.after(() => b.w.close());
    await b.w.fetch('/i/api/graphql/observed/TweetDetail?variables=%7B%7D');
    assert.equal((await b.send({ type: 'OPEN_NATIVE_MORE', tweetId: '123', focalTweetId: '100',
      anchor: { left: 20, top: 20, width: 26, height: 26 } })).opened, true);
    assert.equal(fixture.rendered[0].props.withHideReply, ownThread);
    assert.equal(fixture.rendered[0].props.withViewHiddenReplies, true);
    assert.equal(fixture.props.withHideReply, !ownThread, 'the original row stays unchanged');
  });
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
