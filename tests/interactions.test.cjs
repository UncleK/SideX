const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { source, tick, user, tweet, thread, createPage } = require('./helpers.cjs');

test('current and legacy profile shapes preserve zero and unknown values', () => {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  dom.window.eval(source('core.js'));
  const Core = dom.window.SidePeekCore;
  const profile = Core.userModel(user('reader', { profile_bio: { description: 'Full bio' }, relationship_counts: { followers: 0, following: 7 } }));
  assert.equal(profile.bio, 'Full bio');
  assert.equal(profile.followersCount, 0);
  assert.equal(profile.followedBy, true);
  assert.equal(Core.userModel({ __typename: 'User', core: { screen_name: 'empty' } }).followersCount, null);
  assert.equal(Core.userModel({ legacy: { screen_name: 'old', description: 'Old bio', followers_count: 42 } }).followersCount, 42);
  dom.window.close();
});

test('translation, expanded text and extension-inserted DOM survive reply expansion; switching posts resets scroll', async t => {
  const p = createPage({ request: m => m.type === 'TRANSLATE_TWEET' ? { translation: '完整译文', provider: 'X / Grok', sourceLanguage: 'en' } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const item = p.query('.sidepeek-comment-item');
  const text = item.querySelector('.sidepeek-text');
  const marker = p.w.document.createElement('span'); marker.textContent = 'Third-party translation'; text.append(marker);
  item.querySelector('.sidepeek-show-more-btn').click();
  item.querySelector('.sidepeek-translate-btn').click(); await tick();
  const body = p.query('.sidepeek-body'); body.scrollTop = 600;
  p.query('.sidepeek-expand-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-comment-item'), item);
  assert.equal(body.scrollTop, 600);
  assert.equal(item.querySelector('.sidepeek-translation-text').textContent, '完整译文');
  assert.equal(text.contains(marker), true);
  assert.equal(text.classList.contains('sidepeek-text-clamp'), false);
  p.clickPost(1); await tick();
  assert.equal(body.scrollTop, 0);
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
  body.scrollTop = 700;
  p.w.history.pushState({}, '', '/reader/status/300');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  assert.equal(body.scrollTop, 0);
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '301');
});

test('a late response cannot replace the newer post or reopen a closed drawer', async t => {
  const pending = new Map();
  const p = createPage({ request: m => new Promise(resolve => pending.set(m.tweetId, resolve)) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); p.clickPost(1); await tick();
  pending.get('200')(thread('200')); await tick();
  pending.get('100')(thread('100')); await tick();
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
  p.clickPost(0); await tick();
  p.query('.sidepeek-btn-close').click();
  pending.get('100')(thread('100')); await tick();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

for (const action of ['outside', 'Escape', 'close']) {
  test(action + ' closes without prompting and reopening restores the text draft', async t => {
    const p = createPage(); t.after(() => p.w.close());
    await tick(); p.clickPost(0); await tick();
    const editor = p.query('.sidepeek-footer-textarea');
    editor.focus(); editor.value = 'Retained reply';
    editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
    if (action === 'outside') p.w.document.querySelector('main').click();
    else if (action === 'Escape') p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    else p.query('.sidepeek-btn-close').click();
    assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
    assert.equal(p.query('#sidepeek-toast'), null);
    p.clickPost(0); await tick();
    assert.equal(p.query('.sidepeek-footer-textarea').value, 'Retained reply');
    assert.equal(p.query('.sidepeek-footer-submit-btn').textContent, '回复');
  });
}

for (const area of ['text', 'blank']) {
  test('editing never blocks in-place post switching from ' + area + ' and each post keeps its text draft', async t => {
    const p = createPage(); t.after(() => p.w.close());
    const navigated = [];
    p.w.document.querySelector('main').addEventListener('click', event => {
      const article = event.target.closest('article[data-testid="tweet"]');
      if (!article || event.defaultPrevented) return;
      navigated.push(article.querySelector('time').closest('a').getAttribute('href'));
    });
    await tick(); p.clickPost(0); await tick();
    const editor = p.query('.sidepeek-footer-textarea');
    editor.focus();
    const postB = p.w.document.querySelectorAll('main article')[1];
    const target = area === 'text' ? postB.querySelector('[data-testid="tweetText"]') : postB;
    target.click(); await tick();
    assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
    p.clickPost(0); await tick();
    editor.value = 'Draft on A'; editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
    target.click(); await tick();
    assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
    assert.equal(p.query('.sidepeek-footer-textarea').value, '');
    editor.value = 'Draft on B'; editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
    p.clickPost(0); await tick();
    assert.equal(p.query('.sidepeek-footer-textarea').value, 'Draft on A');
    target.click(); await tick();
    assert.equal(p.query('.sidepeek-footer-textarea').value, 'Draft on B');
    assert.deepEqual(navigated, [], 'ordinary post clicks stay in SideX');
    assert.equal(p.w.location.pathname, '/home');
    assert.equal(p.query('#sidepeek-toast'), null);
  });
}

test('editing still allows explicit timestamps, photos, quoted posts and native action buttons', async t => {
  const p = createPage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); p.query('.sidepeek-footer-textarea').focus();
  const article = p.w.document.querySelectorAll('main article')[1];
  const photo = p.w.document.createElement('a'); photo.href = '/reader/status/200/photo/1';
  photo.innerHTML = '<img alt="Photo">'; article.append(photo);
  const quote = p.w.document.createElement('div'); quote.dataset.testid = 'quoteTweet'; quote.textContent = 'Quoted post'; article.append(quote);
  const like = p.w.document.createElement('button'); like.dataset.testid = 'like'; article.append(like);
  const allowed = [];
  for (const target of [article.querySelector('time'), photo.querySelector('img'), quote, like]) {
    target.addEventListener('click', event => { allowed.push(!event.defaultPrevented); event.preventDefault(); event.stopPropagation(); });
    target.click();
  }
  assert.deepEqual(allowed, [true, true, true, true]);
});

test('failed replies retain their text for retry even after closing and reopening', async t => {
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? Promise.reject(new Error('Rejected')) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const editor = p.query('.sidepeek-footer-textarea'); editor.value = 'Retry while open';
  editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-footer-submit-btn').click(); await tick();
  assert.equal(editor.value, 'Retry while open');
  assert.equal(p.query('.sidepeek-footer-submit-btn').disabled, false);
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Retry while open');
});

test('leaving a detail page preserves text and a late load cannot reopen the drawer', async t => {
  let finish;
  const p = createPage({ request: m => m.tweetId === '200' ? new Promise(resolve => { finish = resolve; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  const editor = p.query('.sidepeek-footer-textarea'); editor.focus(); editor.value = 'Draft while loading';
  editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.w.history.pushState({}, '', '/explore'); p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  finish(thread('200')); await tick();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
  p.w.history.pushState({}, '', '/home'); p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  p.clickPost(1); await tick(); finish(thread('200')); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Draft while loading');
});

test('quoted text expands in place without opening a window, keeps its links and expanded state, and can collapse again', async t => {
  const quoteText = 'Some words about the photograph. '.repeat(40) + ' https://example.com/source';
  const p = createPage({ request: m => {
    const json = thread(m.tweetId);
    const result = json.data.find(entry => entry.tweet_results.result.rest_id === '101')?.tweet_results.result;
    if (result) result.quoted_status_result = { result: tweet('500', '', quoteText) };
    return json;
  } });
  t.after(() => p.w.close()); await tick(); p.clickPost(0); await tick();
  const card = p.query('.sidepeek-quote-card');
  const text = card.querySelector('.sidepeek-quote-text');
  const toggle = card.querySelector('.sidepeek-quote-toggle');
  Object.defineProperty(text, 'clientHeight', { get: () => 57 });
  Object.defineProperty(text, 'scrollHeight', { get: () => 900 });
  const opened = []; p.w.open = (...args) => opened.push(args);
  p.change({ sidex_lang: { newValue: 'zh' } });
  assert.equal(toggle.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(text.classList.contains('sidepeek-quote-text-expanded'), true);
  assert.equal(opened.length, 0);
  assert.match(text.textContent, /example.com\/source/);
  assert.ok(text.querySelector('a[href="https://example.com/source"]'));
  assert.equal(toggle.getAttribute('aria-controls'), text.id);
  p.change({ sidex_reply_mode: { newValue: 'native' } });
  assert.equal(p.query('.sidepeek-quote-card'), card);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  toggle.click();
  assert.equal(text.classList.contains('sidepeek-quote-text-expanded'), false);
  assert.equal(opened.length, 0);
  card.click();
  assert.equal(opened[0][0], 'https://x.com/reader/status/500');
});

test('failed actions restore count, icon and pressed state; duplicate clicks send one request', async t => {
  let rejectAction;
  const p = createPage({ request: m => m.type === 'TOGGLE_ACTION' ? new Promise((_, reject) => { rejectAction = reject; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const like = p.query('.sidepeek-act-like');
  like.click(); like.click(); await tick();
  assert.equal(p.calls.filter(m => m.type === 'TOGGLE_ACTION').length, 1);
  assert.equal(like.getAttribute('aria-pressed'), 'true');
  assert.equal(like.textContent.trim(), '5');
  rejectAction(new Error('Rejected')); await tick();
  assert.equal(like.getAttribute('aria-pressed'), 'false');
  assert.equal(like.textContent.trim(), '4');
  assert.equal(like.disabled, false);
});

test('hovering the handle hydrates partial profiles once, including empty bio and zero followers', async t => {
  const p = createPage({ request: m => m.type === 'FETCH_USER_PROFILE'
    ? user('reader', { relationship_counts: { followers: 0, following: 9 } })
    : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const handle = p.query('.sidepeek-handle');
  handle.dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
  assert.equal(p.query('.sidepeek-hovercard-followers-count').textContent, '0');
  assert.equal(p.query('.sidepeek-hovercard-following-count').textContent, '9');
  assert.equal(p.calls.filter(m => m.type === 'FETCH_USER_PROFILE').length, 1);
  handle.dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
  assert.equal(p.calls.filter(m => m.type === 'FETCH_USER_PROFILE').length, 1);
});

test('hover response arriving after dismissal cannot reopen the card', async t => {
  let resolveProfile;
  const p = createPage({ request: m => m.type === 'FETCH_USER_PROFILE' ? new Promise(resolve => { resolveProfile = resolve; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const handle = p.query('.sidepeek-handle');
  handle.dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(380);
  handle.dispatchEvent(new p.w.MouseEvent('mouseleave')); await tick(460);
  resolveProfile(user('reader')); await tick();
  assert.equal(p.query('#sidepeek-user-hovercard').style.display, 'none');
});

test('translation settings preserve accurate provider and support external translators', async t => {
  const p = createPage(); t.after(() => p.w.close());
  p.w.chrome.runtime.sendMessage = (m, callback) => callback({ ok: true, payload: { translation: 'Google 译文', provider: 'Google', sourceLanguage: 'en' } });
  await tick(); p.clickPost(0); await tick();
  p.change({ sidex_translation_provider: { newValue: 'google' } });
  p.query('.sidepeek-translate-btn').click(); await tick();
  assert.match(p.query('.sidepeek-translation-header').textContent, /Google/);
  p.change({ sidex_translation_provider: { newValue: 'external' } });
  assert.equal(p.query('.sidepeek-translate-btn'), null);
  assert.ok(p.query('.sidepeek-text').textContent.length > 0);
});

test('native buttons and menus are reused, and native rollback updates the sidebar', async t => {
  const p = createPage(); t.after(() => p.w.close());
  const native = p.w.document.createElement('article');
  native.dataset.testid = 'tweet';
  native.innerHTML = '<a href="/reader/status/101"><time>Now</time></a><button data-testid="like">4</button><button data-testid="caret">More</button>';
  p.w.document.querySelector('main').append(native);
  let likes = 0; let menus = 0;
  const nativeLike = native.querySelector('button');
  nativeLike.addEventListener('click', () => { likes++; nativeLike.dataset.testid = 'unlike'; nativeLike.textContent = '5'; });
  native.querySelector('[data-testid="caret"]').addEventListener('click', () => menus++);
  await tick(); p.clickPost(0); await tick();
  const like = p.query('.sidepeek-act-like'); like.click(); await tick();
  assert.equal(likes, 1);
  assert.equal(p.calls.filter(m => m.type === 'TOGGLE_ACTION').length, 0);
  assert.equal(like.getAttribute('aria-pressed'), 'true');
  nativeLike.dataset.testid = 'like'; nativeLike.textContent = '4'; await tick();
  assert.equal(like.getAttribute('aria-pressed'), 'false');
  assert.equal(like.textContent.trim(), '4');
  p.query('.sidepeek-act-more').click(); await tick();
  assert.equal(menus, 1);
  assert.equal(p.query('.sidepeek-more-menu'), null);
});

for (const testId of ['GrokDrawer', 'chat-drawer-root', 'DMDrawer']) {
  test(testId + ' stays above SideX without moving its native editor or swallowing Escape', async t => {
    const open = new Set();
    const p = createPage({ setupWindow(w) {
      w.HTMLElement.prototype.showPopover = function () { open.add(this); };
      w.HTMLElement.prototype.hidePopover = function () { open.delete(this); };
      const layers = w.document.createElement('div'); layers.id = 'layers';
      layers.innerHTML = `<section data-testid="${testId}"><input value="Native draft"><button>Native control</button></section>`;
      layers.firstElementChild.getBoundingClientRect = () => ({ height: 400 });
      w.document.body.append(layers);
    } });
    t.after(() => p.w.close());
    await tick(); p.clickPost(0); await tick();
    const layers = p.query('#layers'), editor = layers.querySelector('input'), parent = editor.parentElement;
    const quick = p.query('.sidepeek-footer-textarea'); quick.value = 'SideX draft';
    const reads = p.calls.filter(m => m.type === 'READ_THREAD').length;
    assert.equal(open.has(layers), true);
    layers.querySelector('button').click();
    p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
    assert.equal(editor.parentElement, parent);
    assert.equal(editor.value, 'Native draft');
    assert.equal(quick.value, 'SideX draft');
    assert.equal(p.calls.filter(m => m.type === 'READ_THREAD').length, reads);
    layers.replaceChildren(); await tick();
    assert.equal(open.has(layers), false);
    assert.equal(layers.hasAttribute('popover'), false);
  });
}

test('the Grok header action is single-flight and preserves the quick reply draft', async t => {
  let finish;
  const p = createPage({ request: m => m.type === 'OPEN_NATIVE_GROK' ? new Promise(resolve => { finish = resolve; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const editor = p.query('.sidepeek-footer-textarea'); editor.value = 'Keep this draft';
  const grok = p.query('.sidepeek-act-grok'); grok.click(); grok.click(); await tick();
  assert.equal(p.calls.filter(m => m.type === 'OPEN_NATIVE_GROK').length, 1);
  assert.equal(p.calls.find(m => m.type === 'OPEN_NATIVE_GROK').tweetId, '101');
  assert.equal(grok.disabled, true);
  finish({ opened: true }); await tick();
  assert.equal(grok.disabled, false);
  assert.equal(editor.value, 'Keep this draft');
});

test('a pre-existing native drawer is promoted while replies are still loading, and its collapsed bar does not block Escape', async t => {
  const open = new Set(); let finish;
  const p = createPage({ request: () => new Promise(resolve => { finish = resolve; }), setupWindow(w) {
    w.HTMLElement.prototype.showPopover = function () { open.add(this); };
    w.HTMLElement.prototype.hidePopover = function () { open.delete(this); };
    const layers = w.document.createElement('div'); layers.id = 'layers';
    layers.innerHTML = '<div data-testid="GrokDrawer"></div>';
    layers.firstElementChild.getBoundingClientRect = () => ({ height: 56 });
    w.document.body.append(layers);
  } });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  assert.equal(open.has(p.query('#layers')), true, 'loading must not leave an existing native panel behind SideX');
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
  assert.equal(open.has(p.query('#layers')), false);
  finish(thread('100')); await tick();
});

test('Quote opens the exact sidebar target in the official composer once and preserves the quick draft', async t => {
  let finish;
  const p = createPage({ request: m => m.type === 'OPEN_NATIVE_QUOTE' ? new Promise(resolve => { finish = resolve; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  p.w.open = () => assert.fail('Quote must not open a Web Intent popup');
  await tick(); p.clickPost(0); await tick();
  const editor = p.query('.sidepeek-footer-textarea'); editor.value = 'Keep this reply';
  editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  for (let i = 0; i < 2; i++) {
    p.query('.sidepeek-act-repost').click(); p.query('.sidepeek-menu-act-quote').click();
  }
  await tick();
  assert.equal(p.calls.filter(m => m.type === 'OPEN_NATIVE_QUOTE').length, 1);
  assert.equal(p.calls.find(m => m.type === 'OPEN_NATIVE_QUOTE').tweetId, '101');
  finish({ opened: true }); await tick();
  assert.equal(editor.value, 'Keep this reply');
  assert.equal(p.w.location.pathname, '/home');
  assert.equal(p.calls.some(m => m.type === 'CREATE_REPLY' || m.type === 'TOGGLE_ACTION'), false);
});

test('an unavailable native quote reports the failure without pasting a URL or opening another window', async t => {
  const p = createPage({ request: m => m.type === 'OPEN_NATIVE_QUOTE' ? { opened: false } : thread(m.tweetId) });
  t.after(() => p.w.close()); p.w.open = () => assert.fail('No bare-link fallback');
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-act-repost').click(); p.query('.sidepeek-menu-act-quote').click(); await tick();
  assert.match(p.query('#sidepeek-toast').textContent, /官方引用暂时不可用/);
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
});

test('Share uses the official menu at the sidebar anchor and stale dismissal cannot clear a newer menu', async t => {
  const p = createPage({ request: m => /NATIVE_SHARE$/.test(m.type) ? { opened: true } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const button = p.query('.sidepeek-act-share');
  button.getBoundingClientRect = () => ({ left: 700, top: 200, width: 40, height: 34 });
  button.click(); await tick();
  const first = p.calls.find(m => m.type === 'OPEN_NATIVE_SHARE');
  assert.equal(first.tweetId, '101');
  assert.deepEqual({ ...first.anchor }, { left: 700, top: 200, width: 40, height: 34 });
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(p.query('.sidepeek-share-menu'), null);
  const host = p.w.document.createElement('div'); host.dataset.sidexNativeShare = '101';
  const native = p.w.document.createElement('button'); host.append(native); p.w.document.body.append(host);
  native.click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  host.remove();
  button.click(); await tick();
  const second = p.calls.filter(m => m.type === 'OPEN_NATIVE_SHARE').at(-1);
  const notify = menuToken => p.w.dispatchEvent(new p.w.MessageEvent('message', { source: p.w, origin: p.w.location.origin,
    data: { source: 'sidepeek-page', type: 'NATIVE_SHARE_CLOSED', tweetId: '101', menuToken } }));
  notify(first.menuToken);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  notify(second.menuToken);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

test('an absent native reply never clicks an unrelated post containing its quoted link', async t => {
  const p = createPage({ settings: { sidex_reply_mode: 'native' } }); t.after(() => p.w.close());
  const article = p.w.document.querySelector('article');
  const quote = p.w.document.createElement('a'); quote.href = '/reader/status/101'; quote.textContent = 'Quoted post'; article.append(quote);
  const button = p.w.document.createElement('button'); button.dataset.testid = 'reply'; article.append(button);
  let wrongReplies = 0; button.addEventListener('click', () => wrongReplies++);
  let opened; p.w.open = () => assert.fail('Official reply must stay in the current window');
  p.w.document.addEventListener('click', event => {
    if (event.target.matches('[data-sidex-native-reply-link]')) { opened = event.target.href; event.preventDefault(); }
  });
  await tick(); p.clickPost(0); await tick(); p.query('.sidepeek-act-reply').click();
  await tick();
  assert.equal(wrongReplies, 0);
  assert.match(opened, /in_reply_to=101/);
});

test('navigating to a quoted post with no replies clears the old conversation', async t => {
  const p = createPage({ request: m => m.tweetId === '300' ? { data: [] } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-body').scrollTop = 600;
  p.w.history.pushState({}, '', '/reader/status/300');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
  assert.equal(p.query('.sidepeek-comment-item'), null);
});

test('native hover card keeps the actual component, original handlers and full content', async t => {
  const p = createPage(); t.after(() => p.w.close());
  const openPopovers = new WeakSet();
  const matches = p.w.HTMLElement.prototype.matches;
  p.w.HTMLElement.prototype.matches = function (selector) { return selector === ':popover-open' ? openPopovers.has(this) : matches.call(this, selector); };
  p.w.HTMLElement.prototype.showPopover = function () { openPopovers.add(this); };
  p.w.HTMLElement.prototype.hidePopover = function () { openPopovers.delete(this); };
  const layers = p.w.document.createElement('div'); layers.id = 'layers'; p.w.document.body.append(layers);
  const sourceLink = p.w.document.createElement('a'); sourceLink.href = '/reader'; sourceLink.textContent = 'Native Reader'; p.w.document.querySelector('main').append(sourceLink);
  const card = p.w.document.createElement('div'); card.dataset.testid = 'hoverCardParent';
  card.innerHTML = '<div data-testid="HoverCard"><a href="/reader">Reader</a><div>Followed by A, B and 13 others</div><button>Profile Summary</button></div>';
  sourceLink.addEventListener('mouseover', () => layers.append(card));
  let actions = 0; card.querySelector('button').addEventListener('click', () => actions++);
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-handle').dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
  card.className = 'native-react-updated-class';
  assert.equal(p.query('[data-sidex-native-hover]'), card);
  assert.equal(card.parentElement, layers);
  assert.equal(openPopovers.has(card), true);
  assert.equal(p.calls.some(m => m.type === 'FETCH_USER_PROFILE'), false);
  card.querySelector('button').click(); assert.equal(actions, 1);
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(openPopovers.has(card), false);
  assert.equal(card.hasAttribute('popover'), false);
  assert.equal(card.hasAttribute('data-sidex-native-hover'), false);
});

test('native profile overlays leave the avatar reachable while cards and other dialogs remain interactive', t => {
  const dom = new JSDOM('<div id="layers" data-sidex-native-layers><div id="hover-overlay" style="pointer-events:auto">'
    + '<div><div data-testid="hoverCardParent" style="pointer-events:auto"><button>Profile Summary</button></div></div></div>'
    + '<div id="other-dialog" role="dialog"><button>Close</button></div></div>');
  t.after(() => dom.window.close());
  const style = dom.window.document.createElement('style'); style.textContent = source('sidebar.css');
  dom.window.document.head.append(style);
  const pointerEvents = selector => dom.window.getComputedStyle(dom.window.document.querySelector(selector)).pointerEvents;
  assert.equal(pointerEvents('#hover-overlay'), 'none', 'the full-screen transparent wrapper must not steal avatar hover');
  assert.equal(pointerEvents('[data-testid="hoverCardParent"]'), 'auto');
  assert.equal(pointerEvents('#other-dialog'), 'auto');
});

function nativeHoverFixture() {
  const open = new WeakSet(); let opens = 0, requests = 0;
  const p = createPage({ setupWindow(w) {
    const matches = w.HTMLElement.prototype.matches;
    w.HTMLElement.prototype.matches = function (selector) { return selector === ':popover-open' ? open.has(this) : matches.call(this, selector); };
    w.HTMLElement.prototype.showPopover = function () { open.add(this); opens++; };
    w.HTMLElement.prototype.hidePopover = function () { open.delete(this); };
    const layers = w.document.createElement('div'); layers.id = 'layers'; w.document.body.append(layers);
    const source = w.document.createElement('a'); source.href = '/reader'; w.document.querySelector('main').append(source);
    source.addEventListener('mouseover', () => { requests++; layers.append(card); });
  } });
  const card = p.w.document.createElement('div'); card.dataset.testid = 'hoverCardParent';
  card.innerHTML = '<div data-testid="HoverCard"><a href="/reader">Reader</a><button>Profile Summary</button></div>';
  card.getBoundingClientRect = () => ({ width: 300, height: 300 });
  return { ...p, card, open, get opens() { return opens; }, get requests() { return requests; } };
}

for (const native of [false, true]) {
  test('re-entering the ' + (native ? 'native' : 'fallback') + ' profile card cancels every pending dismissal', async t => {
    const p = native ? nativeHoverFixture() : createPage({ request: m => m.type === 'FETCH_USER_PROFILE'
      ? user('reader') : m.type === 'FETCH_MUTUAL_FOLLOWERS' ? { count: 0, users: [] } : thread(m.tweetId) });
    t.after(() => p.w.close());
    await tick(); p.clickPost(0); await tick();
    const avatar = p.query('.sidepeek-avatar-link');
    avatar.dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
    const card = native ? p.card : p.query('#sidepeek-user-hovercard');
    avatar.dispatchEvent(new p.w.MouseEvent('mouseleave', { relatedTarget: p.w.document.body }));
    card.dispatchEvent(new p.w.MouseEvent('mouseleave', { relatedTarget: p.w.document.body }));
    card.dispatchEvent(new p.w.MouseEvent('mouseenter'));
    await tick(300);
    assert.equal(native ? p.open.has(card) : card.classList.contains('visible'), true);
  });
}

test('moving between the same author avatar and name keeps one native card session', async t => {
  const p = nativeHoverFixture(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const avatar = p.query('.sidepeek-avatar-link'), name = p.query('.sidepeek-name');
  avatar.dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
  avatar.dispatchEvent(new p.w.MouseEvent('mouseleave', { relatedTarget: name }));
  name.dispatchEvent(new p.w.MouseEvent('mouseenter', { relatedTarget: avatar })); await tick(390);
  assert.equal(p.requests, 1, 'moving within one author must not replay native mouseover');
  assert.equal(p.opens, 1, 'keep the existing top-layer card');
  assert.equal(p.open.has(p.card), true);
});

test('a native profile card near the viewport bottom opens above the avatar without covering it', async t => {
  const p = nativeHoverFixture(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const avatar = p.query('.sidepeek-avatar-link');
  avatar.getBoundingClientRect = () => ({ left: 700, right: 736, top: 700, bottom: 736, width: 36, height: 36 });
  avatar.dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
  const top = Number(p.card.style.getPropertyValue('--sidex-hover-top').replace('px', ''));
  assert.ok(top + 300 <= 700 - 4, 'the card must not occlude its own trigger');
});

test('hydrating an already visible fallback profile does not restart its visibility animation', async t => {
  let finish;
  const p = createPage({ request: m => m.type === 'FETCH_USER_PROFILE' ? new Promise(resolve => { finish = resolve; })
    : m.type === 'FETCH_MUTUAL_FOLLOWERS' ? { count: 0, users: [] } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-avatar-link').dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
  const card = p.query('#sidepeek-user-hovercard');
  assert.equal(card.classList.contains('visible'), true);
  let becameHidden = false;
  const observer = new p.w.MutationObserver(() => { if (!card.classList.contains('visible')) becameHidden = true; });
  observer.observe(card, { attributes: true, attributeFilter: ['class'] });
  finish(user('reader')); await tick(50); observer.disconnect();
  assert.equal(becameHidden, false);
  assert.equal(card.classList.contains('visible'), true);
});

test('fallback profile preserves bio formatting, expanded links and mutual-follower context', async t => {
  const profile = user('reader', {
    profile_bio: { description: 'Building @friend\n\nhttps://t.co/demo', entities: { description: { urls: [{ url: 'https://t.co/demo', expanded_url: 'https://example.com', display_url: 'example.com' }] } } },
    relationship_counts: { followers: 5882, following: 1598 }, banner: { image_url: 'https://pbs.twimg.com/banner.jpg' }
  });
  const p = createPage({ request: m => m.type === 'FETCH_USER_PROFILE' ? profile : m.type === 'FETCH_MUTUAL_FOLLOWERS'
    ? { count: 15, users: [{ name: 'Alice', handle: 'alice' }, { name: 'Bob', handle: 'bob' }, { name: 'Carol', handle: 'carol' }] } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-handle').dispatchEvent(new p.w.MouseEvent('mouseenter')); await tick(390);
  assert.equal(p.query('.sidepeek-hovercard-banner'), null);
  assert.equal(p.query('.sidepeek-hovercard-followers-count').textContent, '5,882');
  assert.equal(p.query('.sidepeek-hovercard-bio a[href="https://example.com"]').textContent, 'example.com');
  assert.match(p.query('.sidepeek-hovercard-bio').textContent, /\n\n/);
  assert.match(p.query('.sidepeek-hovercard-mutual').textContent, /Alice, Bob.*13/);
  p.query('.sidepeek-hovercard-follow-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-hovercard-followers-count').textContent, '5,883');
});

test('late-mounted native posts update the sidebar without counting animated digits twice', async t => {
  const p = createPage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const native = p.w.document.createElement('article'); native.dataset.testid = 'tweet';
  native.innerHTML = '<a href="/reader/status/101"><time>Now</time></a><button data-testid="like" aria-label="11 Likes. Like"><span>10</span><span>11</span></button>';
  p.w.document.querySelector('main').append(native); await tick(50);
  assert.equal(p.query('.sidepeek-act-like').textContent.trim(), '11');
});
