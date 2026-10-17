const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { tick, tweet, thread, source, createPage } = require('./helpers.cjs');

function mountPhoto(p, id = '300') {
  let layers = p.query('#layers');
  if (!layers) { layers = p.w.document.createElement('div'); layers.id = 'layers'; p.w.document.body.append(layers); }
  const dialog = p.w.document.createElement('div'); dialog.setAttribute('role', 'dialog');
  dialog.innerHTML = `<div data-testid="swipe-to-dismiss"><img alt="Full-size photo"></div><div class="native-photo-panel" style="position:relative;width:350px"><section role="region"><article data-testid="tweet"><a href="/reader/status/${id}"><time>Today</time></a><div data-testid="tweetText">Photo post ${id}</div></article><div contenteditable="true" data-testid="tweetTextarea_0">Existing photo draft</div></section></div>`;
  layers.append(dialog);
  p.w.history.pushState({}, '', `/reader/status/${id}/photo/1`);
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
  return { dialog, panel: dialog.querySelector('.native-photo-panel'), image: dialog.querySelector('img'), region: dialog.querySelector('section') };
}

test('an explicit official photo preference is preserved and the real settings popup replaces only the right panel without losing drafts', async t => {
  const p = createPage({ settings: { sidex_photo_mode: 'native' } }); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const drawer = p.query('#sidepeek-drawer-root');
  const readCount = p.calls.length;
  const photo = mountPhoto(p); await tick(70);
  assert.equal(p.w.document.documentElement.dataset.sidexPhotoView, 'native');
  assert.equal(photo.panel.hasAttribute('data-sidex-photo-panel'), false);
  assert.equal(drawer.parentElement, p.w.document.body);
  assert.equal(p.calls.length, readCount, 'official mode does not fetch another SideX thread');

  const popup = new JSDOM(source('popup.html'), { runScripts: 'outside-only' });
  t.after(() => popup.window.close());
  const prefs = { sidex_photo_mode: 'native' };
  popup.window.chrome = { runtime: {}, storage: { sync: {
    get(defaults, cb) { cb({ ...defaults, ...prefs }); },
    set(values) { Object.assign(prefs, values); p.change(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]))); }
  } } };
  popup.window.eval(source('popup.js'));
  assert.equal(popup.window.document.querySelector('#btn-photo-native').getAttribute('aria-pressed'), 'true');
  popup.window.document.querySelector('#btn-photo-sidex').click(); await tick(70);
  assert.equal(prefs.sidex_photo_mode, 'sidex');
  assert.equal(prefs.sidex_reply_mode, undefined, 'photo styling and reply behavior are independent');
  assert.equal(drawer.parentElement, photo.panel);
  assert.equal(photo.panel.hasAttribute('data-sidex-photo-panel'), true);
  assert.equal(drawer.style.left, '0px');
  assert.equal(drawer.style.right, '0px');
  assert.equal(drawer.style.width, '100%');
  assert.ok(p.query('.sidepeek-photo-focal[data-id="300"]'), 'the original post remains readable beside its photo');
  assert.ok(p.query('.sidepeek-comment-item[data-id="301"]'));
  assert.equal(photo.image.parentElement.dataset.testid, 'swipe-to-dismiss');
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.value = 'Keep my photo reply'; textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  popup.window.document.querySelector('#btn-photo-native').click(); await tick();
  assert.equal(drawer.parentElement, p.w.document.body);
  assert.equal(photo.panel.hasAttribute('data-sidex-photo-panel'), false);
  assert.equal(photo.region.isConnected, true);
  assert.equal(photo.region.querySelector('[contenteditable]').textContent, 'Existing photo draft');
  popup.window.document.querySelector('#btn-photo-sidex').click(); await tick();
  assert.equal(drawer.parentElement, photo.panel);
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep my photo reply');

  p.query('.sidepeek-btn-close').click();
  photo.dialog.remove();
  p.w.history.pushState({}, '', '/home'); p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick(70);
  assert.equal(drawer.isConnected, true);
  assert.equal(drawer.parentElement, p.w.document.body);
  assert.equal(drawer.classList.contains('sidepeek-open'), false);
  assert.equal(p.w.document.documentElement.hasAttribute('data-sidex-photo-view'), false);
});

test('photo comments default to SideX and survive remounts, image navigation and disabling; empty threads still show the original post', async t => {
  const p = createPage({ settings: { sidex_reply_mode: 'native' },
    request: m => ({ data: [{ tweet_results: { result: tweet(m.tweetId) } }] }) });
  t.after(() => p.w.close()); await tick();
  let photo = mountPhoto(p); await tick(70);
  const drawer = p.query('#sidepeek-drawer-root');
  assert.ok(p.query('.sidepeek-photo-focal[data-id="300"]'));
  assert.equal(p.query('.sidepeek-footer-composer'), null);
  assert.ok(p.query('.sidepeek-empty-box'));
  photo.dialog.remove();
  photo = mountPhoto(p); await tick(70);
  assert.equal(p.query('#sidepeek-drawer-root'), drawer);
  assert.equal(drawer.parentElement, photo.panel);
  p.w.history.pushState({}, '', '/reader/status/300/photo/2');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  assert.equal(p.calls.filter(m => m.type === 'READ_THREAD').length, 1, 'switching images keeps the same conversation');
  p.change({ sidex_enabled: { newValue: false } }); await tick();
  assert.equal(photo.panel.hasAttribute('data-sidex-photo-panel'), false);
  assert.equal(drawer.parentElement, p.w.document.body);
  assert.equal(p.w.document.documentElement.hasAttribute('data-sidex-photo-view'), false);
  p.change({ sidex_enabled: { newValue: true } }); await tick(70);
  assert.equal(drawer.parentElement, photo.panel);
  p.query('.sidepeek-btn-close').click(); await tick(70);
  assert.equal(photo.panel.hasAttribute('data-sidex-photo-panel'), false, 'closing SideX restores the native panel for this viewer');
  assert.equal(photo.dialog.isConnected, true);
});

test('replying from photo comments opens a separate native reply dialog without touching the photo inline draft', async t => {
  let p;
  p = createPage({ settings: { sidex_photo_mode: 'sidex', sidex_reply_mode: 'native' }, request: m => {
    if (m.type !== 'OPEN_NATIVE_REPLY') return thread(m.tweetId);
    const dialog = p.w.document.createElement('div'); dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<div contenteditable="true" tabindex="0" data-testid="tweetTextarea_0"></div>';
    p.query('#layers').append(dialog); p.w.history.pushState({}, '', '/compose/post');
    return { opened: true };
  } });
  t.after(() => p.w.close()); await tick();
  const photo = mountPhoto(p); await tick(70);
  p.query('.sidepeek-comment-item[data-id="301"] .sidepeek-act-reply').click(); await tick(70);
  assert.equal(p.calls.find(m => m.type === 'OPEN_NATIVE_REPLY').tweetId, '301');
  assert.equal(p.query('#layers').children.length, 2);
  assert.equal(photo.region.querySelector('[contenteditable]').textContent, 'Existing photo draft');
  assert.equal(photo.panel.contains(p.query('#sidepeek-drawer-root')), true);
});

test('the SideX collapse button delegates to the native viewer and expanding keeps scroll, draft and the conversation', async t => {
  const p = createPage({ settings: { sidex_photo_mode: 'sidex' } });
  t.after(() => p.w.close()); await tick();
  const photo = mountPhoto(p); await tick(70);
  const drawer = p.query('#sidepeek-drawer-root');
  const toggle = p.w.document.createElement('button');
  toggle.innerHTML = '<svg><path d="M11.59 12L3.54 3.96l1.42-1.42L14.41 12l-9.45 9.46-1.42-1.42L11.59 12zm7 0l-8.05-8.04 1.42-1.42L21.41 12l-9.45 9.46-1.42-1.42L18.59 12z"></path></svg>';
  toggle.addEventListener('click', () => photo.panel.remove());
  photo.dialog.prepend(toggle);
  // A data update renders the header after the native toggle has mounted.
  p.change({ sidex_lang: { newValue: 'zh' } });
  const scroll = p.query('.sidepeek-body'); scroll.scrollTop = 392;
  const textarea = p.query('.sidepeek-footer-textarea'); textarea.value = 'Draft beside photo';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  const reads = p.calls.filter(m => m.type === 'READ_THREAD').length;
  p.query('.sidepeek-btn-photo-collapse').click();
  // A real browser resets layout scroll offsets when this subtree is detached.
  scroll.scrollTop = 0;
  await tick(70);
  assert.equal(photo.panel.isConnected, false, 'X removes its whole column and expands the image');
  assert.equal(drawer.parentElement, p.w.document.body);
  assert.equal(p.w.document.documentElement.dataset.sidexPhotoView, 'native');
  photo.dialog.append(photo.panel); await tick(70);
  assert.equal(drawer.parentElement, photo.panel);
  assert.equal(scroll.scrollTop, 392);
  assert.equal(textarea.value, 'Draft beside photo');
  assert.equal(p.calls.filter(m => m.type === 'READ_THREAD').length, reads);
});

test('leaving a photo while editing closes the drawer and preserves the text draft', async t => {
  const p = createPage(); t.after(() => p.w.close()); await tick();
  const photo = mountPhoto(p); await tick(70);
  const toggle = p.w.document.createElement('button');
  toggle.innerHTML = '<svg><path d="M11.59 12L3.54 3.96l1.42-1.42L14.41 12l-9.45 9.46-1.42-1.42L11.59 12zm7 0l-8.05-8.04 1.42-1.42L21.41 12l-9.45 9.46-1.42-1.42L18.59 12z"></path></svg>';
  photo.dialog.prepend(toggle); p.change({ sidex_lang: { newValue: 'zh' } });
  assert.equal(p.query('.sidepeek-btn-close').style.display, 'inline-flex');
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus(); textarea.value = 'Keep the photo draft';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  photo.dialog.remove();
  p.w.history.pushState({}, '', '/home'); p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick(70);
  const drawer = p.query('#sidepeek-drawer-root');
  assert.equal(drawer.isConnected, true);
  assert.equal(drawer.classList.contains('sidepeek-open'), false);
  assert.equal(p.w.document.documentElement.hasAttribute('data-sidex-photo-view'), false);
  assert.equal(p.query('.sidepeek-btn-close').style.display, 'inline-flex');
  assert.equal(p.query('.sidepeek-btn-photo-collapse').style.display, 'none');
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep the photo draft');
  p.query('.sidepeek-btn-close').click();
  assert.equal(drawer.classList.contains('sidepeek-open'), false);
});

test('photo comments offer an explicit close button alongside the native collapse control', async t => {
  const p = createPage(); t.after(() => p.w.close()); await tick();
  const photo = mountPhoto(p); await tick(70);
  const toggle = p.w.document.createElement('button');
  toggle.innerHTML = '<svg><path d="M11.59 12L3.54 3.96l1.42-1.42L14.41 12l-9.45 9.46-1.42-1.42L11.59 12zm7 0l-8.05-8.04 1.42-1.42L21.41 12l-9.45 9.46-1.42-1.42L18.59 12z"></path></svg>';
  photo.dialog.prepend(toggle); p.change({ sidex_lang: { newValue: 'zh' } });
  p.query('.sidepeek-footer-textarea').focus();
  assert.equal(p.query('.sidepeek-btn-close').style.display, 'inline-flex');
  assert.equal(p.query('.sidepeek-btn-photo-collapse').style.display, 'inline-flex');
  p.query('.sidepeek-btn-close').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
  assert.equal(photo.panel.hasAttribute('data-sidex-photo-panel'), false);
  assert.equal(photo.dialog.isConnected, true);
});

test('navigating between photo posts switches freely and restores each text draft', async t => {
  const p = createPage(); t.after(() => p.w.close()); await tick();
  const photo = mountPhoto(p); await tick(70);
  const drawer = p.query('#sidepeek-drawer-root');
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus(); textarea.value = 'Reply to photo 300';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  photo.dialog.remove();
  const next = mountPhoto(p, '400'); await tick(70);
  assert.equal(drawer.parentElement, next.panel);
  assert.ok(p.query('.sidepeek-photo-focal[data-id="400"]'));
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
  assert.equal(p.calls.some(m => m.type === 'READ_THREAD' && m.tweetId === '400'), true);
  next.dialog.remove(); mountPhoto(p); await tick(70);
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Reply to photo 300');
});

test('opening an official quick tool keeps the active photo reply docked in its viewer', async t => {
  let p;
  p = createPage({ request: m => {
    if (m.type !== 'OPEN_NATIVE_REPLY') return thread(m.tweetId);
    const dialog = p.w.document.createElement('div'); dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<div contenteditable="true" tabindex="0" data-testid="tweetTextarea_0"></div><button data-testid="gifSearchButton">GIF</button>';
    p.query('#layers').append(dialog); p.w.history.pushState({}, '', '/compose/post');
    p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
    return { opened: true };
  } });
  t.after(() => p.w.close());
  p.w.document.execCommand = (_, __, text) => { p.w.document.activeElement.textContent = text; return true; };
  await tick(); const photo = mountPhoto(p); await tick(70);
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus(); textarea.value = 'Photo reply with GIF';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-tool-gif').click(); await tick(70);
  assert.equal(p.query('#sidepeek-drawer-root').parentElement, photo.panel);
  assert.equal(photo.panel.hasAttribute('data-sidex-photo-panel'), true);
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Photo reply with GIF');
});

test('home image links keep native navigation while post text still opens SideX in place under either photo preference', async t => {
  for (const mode of ['native', 'sidex']) {
    const p = createPage({ settings: { sidex_photo_mode: mode } });
    t.after(() => p.w.close()); await tick();
    const link = p.w.document.createElement('a'); link.href = '/reader/status/100/photo/1';
    link.innerHTML = '<img alt="Timeline photo">'; p.w.document.querySelector('article').append(link);
    let allowed = false;
    link.addEventListener('click', event => { allowed = !event.defaultPrevented; event.preventDefault(); });
    link.querySelector('img').click(); await tick();
    assert.equal(allowed, true);
    assert.equal(p.calls.length, 0);
    p.clickPost(0); await tick();
    assert.equal(p.w.location.pathname, '/home');
    assert.ok(p.query('#sidepeek-drawer-root.sidepeek-open'));
    assert.equal(p.query('#sidepeek-drawer-root').parentElement, p.w.document.body);
    assert.equal(p.w.document.documentElement.hasAttribute('data-sidex-photo-view'), false);
    assert.equal(p.calls.find(m => m.type === 'READ_THREAD').tweetId, '100');
  }
});
