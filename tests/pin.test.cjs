const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { tick, source, thread, tweet, createPage } = require('./helpers.cjs');

function nativePost(p, id) {
  return [...p.w.document.querySelectorAll('article[data-testid="tweet"]')].find(article => {
    const href = article.querySelector('time')?.closest('a[href*="/status/"]')?.getAttribute('href');
    return href?.match(/\/status\/(\d+)/)?.[1] === String(id);
  }) || null;
}

function mountPhoto(p, id = '100') {
  let layers = p.query('#layers');
  if (!layers) {
    layers = p.w.document.createElement('div');
    layers.id = 'layers';
    p.w.document.body.append(layers);
  }
  const dialog = p.w.document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.innerHTML = `<div data-testid="swipe-to-dismiss"><img alt="Post image"></div><div class="native-photo-panel" style="position:relative;width:350px"><button><svg><path d="M11.59 12L3.54 3.96l1.42-1.42L14.41 12l-9.45 9.46-1.42-1.42L11.59 12zm7 0l-8.05-8.04 1.42-1.42L21.41 12l-9.45 9.46-1.42-1.42L18.59 12z"></path></svg></button><section role="region"><article data-testid="tweet"><a href="/reader/status/${id}"><time>Today</time></a><div data-testid="tweetText">Photo post</div></article></section></div>`;
  layers.append(dialog);
  p.w.history.pushState({}, '', `/reader/status/${id}/photo/1`);
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  return { dialog, panel: dialog.querySelector('.native-photo-panel') };
}

test('a pinned sidebar stays open for outside clicks and Escape while other posts still switch its content', async t => {
  const p = createPage();
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();

  const pin = p.query('.sidepeek-btn-pin');
  assert.ok(pin, 'the ordinary sidebar exposes a Pin control');
  pin.click();
  assert.equal(pin.getAttribute('aria-pressed'), 'true');

  p.w.document.querySelector('main').click();
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);

  p.clickPost(1);
  await tick();
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'true');
});

test('manual close ends a temporary pin session and unpin does not close immediately', async t => {
  const p = createPage();
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();

  p.query('.sidepeek-btn-pin').click();
  p.query('.sidepeek-btn-close').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);

  p.clickPost(0);
  await tick();
  const pin = p.query('.sidepeek-btn-pin');
  assert.equal(pin.getAttribute('aria-pressed'), 'false');
  pin.click();
  pin.click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

test('the default auto-pin preference starts off, applies to future sessions, and persists from the popup', async t => {
  const p = createPage();
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'false');

  p.change({ sidex_auto_pin: { newValue: true } });
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'false', 'changing the preference does not affect the open session');
  p.query('.sidepeek-btn-close').click();
  p.clickPost(0);
  await tick();
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'true');
  assert.equal(nativePost(p, '100').getAttribute('data-sidex-pinned-active'), 'light');

  const popup = new JSDOM(source('popup.html'), { runScripts: 'outside-only' });
  t.after(() => popup.window.close());
  const prefs = {};
  popup.window.chrome = { runtime: {}, storage: { sync: {
    get(defaults, cb) { cb({ ...defaults, ...prefs }); },
    set(values) { Object.assign(prefs, values); }
  } } };
  popup.window.eval(source('popup.js'));
  const setting = popup.window.document.querySelector('#sidex-auto-pin');
  assert.equal(setting.checked, false);
  setting.checked = true;
  setting.dispatchEvent(new popup.window.Event('change', { bubbles: true }));
  assert.equal(prefs.sidex_auto_pin, true);
  popup.window.document.querySelector('[data-lang="en"]').click();
  assert.equal(popup.window.document.querySelector('#txt-auto-pin-hint').textContent, 'Pin new panels so outside clicks and Esc do not close them.');
});

test('pinned highlight survives X replacing the post class, follows the panel, and clears on unpin or close', async t => {
  const p = createPage();
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  const first = nativePost(p, '100');
  const second = nativePost(p, '200');
  p.query('.sidepeek-btn-pin').click();

  assert.equal(first.getAttribute('data-sidex-pinned-active'), 'light');
  assert.equal(second.hasAttribute('data-sidex-pinned-active'), false);
  first.className = 'x-hover-state-replaced-the-entire-class';
  assert.equal(first.getAttribute('data-sidex-pinned-active'), 'light', 'X class rewrites do not remove the independent pinned marker');

  p.clickPost(1);
  await tick();
  assert.equal(first.hasAttribute('data-sidex-pinned-active'), false);
  assert.equal(second.getAttribute('data-sidex-pinned-active'), 'light');

  p.query('.sidepeek-btn-pin').click();
  assert.equal(second.hasAttribute('data-sidex-pinned-active'), false);
  p.query('.sidepeek-btn-pin').click();
  assert.equal(second.getAttribute('data-sidex-pinned-active'), 'light');
  p.query('.sidepeek-btn-close').click();
  assert.equal(second.hasAttribute('data-sidex-pinned-active'), false);
});

test('Pin toggles and empty-thread navigation leave the original article classes alone', async t => {
  const p = createPage({ request: m => m.tweetId === '200'
    ? { data: [{ tweet_results: { result: tweet('200') } }] }
    : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  const first = nativePost(p, '100');
  const second = nativePost(p, '200');
  first.className = 'x-managed-post-state';
  second.className = 'x-managed-other-post-state';
  p.query('.sidepeek-btn-pin').click();
  assert.equal(first.getAttribute('data-sidex-pinned-active'), 'light');
  p.query('.sidepeek-btn-pin').click();
  assert.equal(first.className, 'x-managed-post-state');
  assert.equal(first.hasAttribute('data-sidex-pinned-active'), false);
  p.query('.sidepeek-btn-pin').click();
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick();
  assert.equal(second.getAttribute('data-sidex-pinned-active'), 'light');
  assert.equal(second.className, 'x-managed-other-post-state');
});

test('disabling SideX clears a pinned focal marker and closes the panel', async t => {
  const p = createPage();
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  const article = nativePost(p, '100');
  p.query('.sidepeek-btn-pin').click();
  assert.equal(article.getAttribute('data-sidex-pinned-active'), 'light');

  p.change({ sidex_enabled: { newValue: false } });
  assert.equal(article.hasAttribute('data-sidex-pinned-active'), false);
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

test('auto-pinned highlight follows theme changes and a remounted own post, without marking a quoted post', async t => {
  const p = createPage({ settings: { sidex_auto_pin: true } });
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  const original = nativePost(p, '100');
  const quote = p.w.document.createElement('article');
  quote.dataset.testid = 'tweet';
  quote.innerHTML = '<a href="/quoted/status/999"><time>Today</time></a><div data-testid="tweetText">Quoted post</div>';
  original.append(quote);
  await tick(20);
  assert.equal(original.getAttribute('data-sidex-pinned-active'), 'light');
  assert.equal(quote.hasAttribute('data-sidex-pinned-active'), false);

  p.w.document.body.style.backgroundColor = 'rgb(0, 0, 0)';
  await tick(20);
  assert.equal(original.getAttribute('data-sidex-pinned-active'), 'dark');
  p.w.document.body.style.backgroundColor = 'rgb(21, 31, 42)';
  await tick(20);
  assert.equal(original.getAttribute('data-sidex-pinned-active'), 'dim');

  const ownTimeLink = original.querySelector('time').closest('a');
  ownTimeLink.setAttribute('href', '/reader/status/777');
  await tick(20);
  assert.equal(original.hasAttribute('data-sidex-pinned-active'), false, 'a recycled post link loses the marker when it no longer matches the panel');
  ownTimeLink.setAttribute('href', '/reader/status/100');
  await tick(20);
  assert.equal(original.getAttribute('data-sidex-pinned-active'), 'dim');

  const replacement = p.w.document.createElement('article');
  replacement.dataset.testid = 'tweet';
  replacement.innerHTML = '<a href="/reader/status/100"><time>Today</time></a><div data-testid="tweetText">Post A remounted</div>';
  original.replaceWith(replacement);
  await tick(20);
  assert.equal(original.hasAttribute('data-sidex-pinned-active'), false);
  assert.equal(replacement.getAttribute('data-sidex-pinned-active'), 'dim');
  assert.equal(nativePost(p, '200').hasAttribute('data-sidex-pinned-active'), false);

  const css = source('sidebar.css');
  assert.match(css, /article\[data-testid="tweet"\]\[data-sidex-pinned-active\]/);
  assert.match(css, /background-color: rgba\(0, 0, 0, 0\.03\)/);
  assert.match(css, /background-color: rgba\(255, 255, 255, 0\.03\)/);
});

test('a pinned sidebar switches posts and restores its text draft and highlight on return', async t => {
  const p = createPage();
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  p.query('.sidepeek-btn-pin').click();
  const first = nativePost(p, '100');
  const second = nativePost(p, '200');
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'Reply draft';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));

  p.clickPost(1);
  await tick();
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
  assert.equal(first.hasAttribute('data-sidex-pinned-active'), false);
  assert.equal(second.getAttribute('data-sidex-pinned-active'), 'light');
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');

  p.clickPost(0);
  await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Reply draft');
  assert.equal(first.getAttribute('data-sidex-pinned-active'), 'light');
  assert.equal(second.hasAttribute('data-sidex-pinned-active'), false);

  p.query('.sidepeek-btn-close').click();
  assert.equal(first.hasAttribute('data-sidex-pinned-active'), false);
});

test('a pinned child draft restores its recipient after switching posts and closing', async t => {
  const p = createPage({ request: m => m.type === 'CREATE_REPLY'
    ? { data: [{ tweet_results: { result: tweet('999', m.tweetId, m.text) } }] } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-btn-pin').click();
  p.query('.sidepeek-act-reply').click();
  const editor = p.query('.sidepeek-footer-textarea');
  editor.value = 'Child draft';
  editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.clickPost(1); await tick();
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Child draft');
  assert.equal(p.query('.sidepeek-footer-reply-target').style.display, 'flex');
  p.query('.sidepeek-btn-close').click();
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'false');
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Child draft');
  p.query('.sidepeek-footer-submit-btn').click(); await tick();
  assert.equal(p.calls.find(m => m.type === 'CREATE_REPLY').tweetId, '101');
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
  assert.equal(p.query('.sidepeek-footer-submit-btn').textContent, '回复');
});

test('a pinned panel follows X detail navigation and remains open on an empty thread', async t => {
  const p = createPage({ request: m => m.tweetId === '300'
    ? { data: [{ tweet_results: { result: tweet('300') } }] }
    : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  p.query('.sidepeek-btn-pin').click();
  assert.equal(nativePost(p, '100').getAttribute('data-sidex-pinned-active'), 'light');

  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick();
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
  assert.equal(nativePost(p, '100').hasAttribute('data-sidex-pinned-active'), false);
  assert.equal(nativePost(p, '200').getAttribute('data-sidex-pinned-active'), 'light');

  p.w.history.pushState({}, '', '/reader/status/300');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  assert.ok(p.query('.sidepeek-empty-box'));
  assert.equal(p.query('.sidepeek-comment-item'), null);

  p.w.history.pushState({}, '', '/home');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick();
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '201');
});

for (const action of ['keep pinned', 'unpin', 'close', 'switch']) {
  test('a pending detail request settles correctly after returning home and ' + action, async t => {
    let finish;
    const p = createPage({ request: m => m.tweetId === '200'
      ? new Promise(resolve => { finish = resolve; }) : thread(m.tweetId) });
    t.after(() => p.w.close());
    await tick(); p.clickPost(0); await tick(); p.query('.sidepeek-btn-pin').click();
    p.w.history.pushState({}, '', '/reader/status/200');
    p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
    assert.ok(p.query('.sidepeek-body .sidepeek-spinner'));
    const editor = p.query('.sidepeek-footer-textarea'); editor.value = 'Draft while loading';
    editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
    p.w.history.pushState({}, '', '/home');
    p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
    if (action === 'unpin') p.query('.sidepeek-btn-pin').click();
    else if (action === 'close') p.query('.sidepeek-btn-close').click();
    else if (action === 'switch') { p.clickPost(0); await tick(); }
    finish(thread('200')); await tick();
    if (action === 'close') {
      assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
    } else {
      assert.equal(p.query('.sidepeek-body .sidepeek-spinner'), null);
      assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
      assert.ok(p.query(action === 'switch' ? '[data-id="101"]' : '[data-id="201"]'));
      if (action !== 'switch') assert.equal(p.query('.sidepeek-footer-textarea').value, 'Draft while loading');
    }
    if (action === 'switch' || action === 'close') assert.equal(p.query('[data-id="201"]'), null);
    if (action === 'close') {
      p.clickPost(1); await tick(); finish(thread('200')); await tick();
      assert.ok(p.query('[data-id="201"]'));
      assert.equal(p.query('.sidepeek-body .sidepeek-spinner'), null);
      assert.equal(p.query('.sidepeek-footer-textarea').value, 'Draft while loading');
    }
  });
}

test('a failed retained detail load shows retry after returning home and can finish successfully', async t => {
  let finish, fail;
  const p = createPage({ request: m => m.tweetId === '200'
    ? new Promise((resolve, reject) => { finish = resolve; fail = reject; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); p.query('.sidepeek-btn-pin').click();
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  p.w.history.pushState({}, '', '/home');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  fail(new Error('offline')); await tick();
  assert.equal(p.query('.sidepeek-body .sidepeek-spinner'), null);
  assert.ok(p.query('.sidepeek-retry-btn'));
  p.query('.sidepeek-retry-btn').click(); await tick(); finish(thread('200')); await tick();
  assert.ok(p.query('[data-id="201"]'));
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'true');
});

test('a pinned empty detail response retains a restored child draft and its recipient', async t => {
  let empty = false;
  const p = createPage({ request: m => m.tweetId === '200' && empty
    ? { data: [{ tweet_results: { result: tweet('200') } }] } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(1); await tick(); p.query('.sidepeek-act-reply').click();
  const editor = p.query('.sidepeek-footer-textarea'); editor.value = 'Reply to child 201';
  editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.clickPost(0); await tick(); p.query('.sidepeek-btn-pin').click(); empty = true;
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  assert.ok(p.query('.sidepeek-empty-box'));
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Reply to child 201');
  assert.equal(p.query('.sidepeek-footer-reply-target').style.display, 'flex');
});

test('auto-pin also applies when a detail route opens the sidebar without a timeline click', async t => {
  const p = createPage({ settings: { sidex_auto_pin: true } });
  t.after(() => p.w.close());
  await tick();
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'true');
  assert.equal(nativePost(p, '200').getAttribute('data-sidex-pinned-active'), 'light');
});

test('pinned highlight follows the active post when switching from a detail-page main post to a reply', async t => {
  const p = createPage({ settings: { sidex_auto_pin: true } });
  t.after(() => p.w.close());
  await tick();
  p.w.history.pushState({}, '', '/reader/status/100');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick();

  const mainPost = nativePost(p, '100');
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'true');
  assert.equal(mainPost.getAttribute('data-sidex-pinned-active'), 'light');

  const replyPost = p.w.document.createElement('article');
  replyPost.dataset.testid = 'tweet';
  replyPost.innerHTML = '<a href="/reader/status/201"><time>Today</time></a><div data-testid="tweetText">A reply in the thread</div>';
  p.w.document.querySelector('main').append(replyPost);
  replyPost.querySelector('[data-testid="tweetText"]').click();
  await tick();

  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '202');
  assert.equal(mainPost.hasAttribute('data-sidex-pinned-active'), false);
  assert.equal(replyPost.getAttribute('data-sidex-pinned-active'), 'light', 'a thread reply opened by SideX remains the highlighted focal post');
});

test('unpinning during reply composition restores dismissal and keeps the text draft', async t => {
  const p = createPage();
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  p.query('.sidepeek-btn-pin').click();
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'Reply draft';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-btn-pin').click();

  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
  p.clickPost(0);
  await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Reply draft');
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'false');
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '101');
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

test('a successful reply restores its button without removing the independent pin', async t => {
  const created = { data: { create_tweet: { tweet_results: { result: tweet('999', '100', 'Sent reply') } } } };
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? created : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick();
  p.clickPost(0);
  await tick();
  p.query('.sidepeek-btn-pin').click();
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'Sent reply';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-footer-submit-btn').click();
  await tick();
  assert.equal(p.query('.sidepeek-footer-submit-btn').textContent, '回复');
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  p.query('.sidepeek-btn-pin').click();
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

test('the photo viewer hides Pin, preserves its native controls, then restores the session preference', async t => {
  const p = createPage({ settings: { sidex_auto_pin: true } });
  t.after(() => p.w.close());
  await tick();
  const photo = mountPhoto(p);
  await tick(70);
  const drawer = p.query('#sidepeek-drawer-root');
  const pin = p.query('.sidepeek-btn-pin');
  assert.equal(pin.getAttribute('aria-pressed'), 'true');
  assert.equal(pin.style.display, 'none');
  assert.equal(p.query('article[data-testid="tweet"]').hasAttribute('data-sidex-pinned-active'), false);
  assert.equal(drawer.parentElement, photo.panel);
  assert.equal(p.query('.sidepeek-btn-photo-collapse').style.display, 'inline-flex');
  assert.equal(p.query('.sidepeek-btn-close').style.display, 'inline-flex');

  photo.dialog.remove();
  p.w.history.pushState({}, '', '/reader/status/100');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  await tick(70);
  assert.equal(drawer.parentElement, p.w.document.body);
  assert.equal(p.query('.sidepeek-btn-pin').style.display, 'inline-flex');
  assert.equal(p.query('.sidepeek-btn-pin').getAttribute('aria-pressed'), 'true');
  assert.equal(p.query('article[data-testid="tweet"]').getAttribute('data-sidex-pinned-active'), 'light', 'the active post highlight resumes after leaving the photo viewer');
});
