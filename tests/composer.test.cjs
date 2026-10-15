const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tick, tweet, thread, createPage, source } = require('./helpers.cjs');
const { JSDOM } = require('jsdom');

function input(p, value) {
  const editor = p.query('.sidepeek-footer-textarea');
  editor.value = value;
  editor.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  return editor;
}
const created = (id = '999', parent = '100', text = 'Published') => ({ data: {
  create_tweet: { tweet_results: { result: tweet(id, parent, text) } }
} });

test('quick reply keeps drafts separate by post, reply target and reply mode', async t => {
  const p = createPage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); input(p, 'Root draft');
  p.query('.sidepeek-act-reply').click(); input(p, 'Child draft');
  p.query('.sidepeek-cancel-reply-target').click();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Root draft');
  p.query('.sidepeek-btn-close').click();
  p.clickPost(1); await tick(); input(p, 'Other post');
  p.query('.sidepeek-btn-close').click();
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Root draft');
  p.change({ sidex_reply_mode: { newValue: 'native' } });
  p.change({ sidex_reply_mode: { newValue: 'drawer' } });
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Root draft');
  p.query('.sidepeek-act-reply').click();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Child draft');
});

test('Ctrl+Enter is single-flight and successful replies use the real server ID and persist through rerender', async t => {
  let finish;
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? new Promise(resolve => { finish = resolve; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const editor = input(p, 'Hello');
  for (let i = 0; i < 3; i++) editor.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  await tick(); assert.equal(p.calls.filter(m => m.type === 'CREATE_REPLY').length, 1);
  finish(created()); await tick();
  assert.ok(p.query('.sidepeek-comment-item[data-id="999"]'));
  assert.equal(p.query('.sidepeek-comment-item[data-id="999"] .sidepeek-time').href, 'https://x.com/reader/status/999');
  p.change({ sidex_sub_reply_limit: { newValue: 2 } }); await tick();
  assert.ok(p.query('.sidepeek-comment-item[data-id="999"]'));
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
});

test('an old send cannot clear a newer draft or insert into a different conversation', async t => {
  let finish;
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? new Promise(resolve => { finish = resolve; }) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); input(p, 'Sending on A');
  p.query('.sidepeek-footer-submit-btn').click(); await tick();
  p.query('.sidepeek-btn-close').click();
  p.clickPost(1); await tick(); input(p, 'Draft on B');
  finish(created()); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Draft on B');
  assert.equal(p.query('.sidepeek-comment-item[data-id="999"]'), null);
  p.query('.sidepeek-btn-close').click();
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
});

test('missing publication confirmation keeps the draft and does not invent a local success', async t => {
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? { data: {} } : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); input(p, 'Keep me');
  p.query('.sidepeek-footer-submit-btn').click(); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Keep me');
  assert.equal(p.query('[data-id^="local-"]'), null);
  assert.equal(p.query('.sidepeek-footer-submit-btn').disabled, false);
});

test('the counter uses URL weights and Unicode emoji sequences from twitter-text', async t => {
  const p = createPage(); t.after(() => p.w.close());
  const Core = p.w.SidePeekCore;
  assert.equal(Core.tweetLength('é'), 1);
  assert.equal(Core.tweetLength('中文'), 4);
  assert.equal(Core.tweetLength('👨‍👩‍👧‍👦'), 2);
  assert.equal(Core.tweetLength('https://example.com/' + 'a'.repeat(300)), 23);
  await tick(); p.clickPost(0); await tick();
  input(p, 'https://example.com/' + 'a'.repeat(300));
  assert.equal(p.query('.sidepeek-char-warn-num').textContent, '');
  assert.equal(p.query('.sidepeek-footer-submit-btn').disabled, false);
  input(p, '   ');
  assert.equal(p.query('.sidepeek-footer-submit-btn').disabled, true);
});

test('quick reply retains all seven toolbar entries and working local image and emoji controls', async t => {
  const p = createPage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-tools').children.length, 7);
  for (const name of ['poll', 'gif', 'schedule', 'location', 'disclosure']) assert.ok(p.query(`.sidepeek-tool-${name}`));
  assert.equal(p.query('.sidepeek-tool-native-reply'), null);
  assert.ok(p.query('.sidepeek-tool-media'));
  p.query('.sidepeek-tool-emoji').click();
  p.query('.sidepeek-emoji-item').click();
  assert.ok(p.query('.sidepeek-footer-textarea').value.length > 0);
});

test('native reply transfer targets the new dialog editor and never overwrites the clipboard or timeline editor', async t => {
  const p = createPage({ request: m => {
    if (m.type !== 'OPEN_NATIVE_REPLY') return thread(m.tweetId);
    reply.click(); return { opened: true };
  } }); t.after(() => p.w.close());
  const article = p.w.document.querySelector('article');
  const reply = p.w.document.createElement('button'); reply.dataset.testid = 'reply'; article.append(reply);
  const timelineEditor = p.w.document.createElement('div'); timelineEditor.dataset.testid = 'tweetTextarea_0';
  timelineEditor.textContent = 'Existing timeline draft'; p.w.document.body.append(timelineEditor);
  const layers = p.w.document.createElement('div'); layers.id = 'layers'; p.w.document.body.append(layers);
  reply.addEventListener('click', () => {
    const modal = p.w.document.createElement('div'); modal.setAttribute('role', 'dialog');
    modal.innerHTML = '<div data-testid="tweetTextarea_0" contenteditable="true" tabindex="0"></div><button data-testid="gifSearchButton">GIF</button>';
    layers.append(modal);
  });
  p.w.document.execCommand = (_, __, text) => { p.w.document.activeElement.textContent = text; return true; };
  Object.defineProperty(p.w.navigator, 'clipboard', { value: { writeText() { assert.fail('Do not overwrite clipboard'); } } });
  await tick(); p.clickPost(0); await tick(); input(p, 'My draft');
  p.query('.sidepeek-tool-gif').click(); await tick();
  assert.equal(layers.querySelector('[data-testid="tweetTextarea_0"]').textContent, 'My draft');
  assert.equal(timelineEditor.textContent, 'Existing timeline draft');
});

function nativePage() {
  let p;
  const open = new WeakSet();
  const actions = [];
  let shell, host;
  const mount = (text = '') => {
    shell = p.w.document.createElement('div'); shell.style.padding = '9px';
    shell.innerHTML = '<div role="dialog" aria-modal="true"><article>Native reply context</article><section><div contenteditable="true" tabindex="0" data-testid="tweetTextarea_0"></div>' +
      ['gifSearchButton', 'createPollButton', 'scheduleOption', 'geoButton', 'contentDisclosureButton', 'tweetButton'].map(id => `<button data-testid="${id}">${id}</button>`).join('') + '</section></div>';
    host = shell.querySelector('section');
    host.querySelector('[contenteditable]').textContent = text;
    for (const button of host.querySelectorAll('button')) button.addEventListener('click', () => actions.push(button.dataset.testid));
    p.query('#layers').append(shell);
    return host;
  };
  p = createPage({ request: m => {
    if (m.type !== 'OPEN_NATIVE_REPLY') return thread(m.tweetId);
    mount(); p.w.history.pushState({}, '', '/compose/post');
    p.w.dispatchEvent(new p.w.PopStateEvent('popstate'));
    return { opened: true };
  } });
  p.w.HTMLElement.prototype.showPopover = function () { open.add(this); };
  p.w.HTMLElement.prototype.hidePopover = function () { open.delete(this); };
  const layers = p.w.document.createElement('div'); layers.id = 'layers'; p.w.document.body.append(layers);
  p.w.document.execCommand = (_, __, text) => { p.w.document.activeElement.textContent = text; return true; };
  p.w.open = () => assert.fail('Native reply must not open another window');
  return { ...p, open, actions, mount, get host() { return host; }, get shell() { return shell; } };
}

test('advanced tools and disclosure open native overlays above the drawer without replacing or restyling the quick composer', async t => {
  for (const [name, id] of [['gif', 'gifSearchButton'], ['poll', 'createPollButton'], ['schedule', 'scheduleOption'], ['location', 'geoButton'], ['disclosure', 'contentDisclosureButton']]) {
    const p = nativePage(); t.after(() => p.w.close());
    await tick(); p.clickPost(0); await tick();
    p.query('.sidepeek-act-reply').click(); const quick = input(p, 'My child reply');
    const footer = p.query('.sidepeek-footer-composer'); const originalClass = footer.className;
    p.query(`.sidepeek-tool-${name}`).click(); await tick(50);
    assert.equal(p.calls.find(m => m.type === 'OPEN_NATIVE_REPLY').tweetId, '101');
    assert.equal(p.calls.find(m => m.type === 'OPEN_NATIVE_REPLY').quickTool, true);
    assert.deepEqual(p.actions, [id]);
    assert.equal(p.query('[data-sidex-native-composer]'), null);
    assert.equal(p.query('.sidepeek-footer-textarea'), quick);
    assert.equal(footer.className, originalClass);
    assert.equal(quick.value, 'My child reply');
    assert.equal(p.query('[data-sidex-native-layers]'), p.query('#layers'));
    assert.equal(p.open.has(p.query('#layers')), true);
    assert.equal(p.host.parentElement.getAttribute('role'), 'dialog', 'retain the original React parent');
    assert.equal(p.host.querySelector('[contenteditable]').textContent, 'My child reply');
    assert.equal(p.shell.style.visibility, '');
    assert.equal(p.calls.some(m => m.type === 'CREATE_REPLY'), false);
    p.change({ sidex_reply_mode: { newValue: 'native' } });
    assert.equal(p.shell.style.visibility, '');
    assert.equal(p.host.hasAttribute('popover'), false);
    assert.equal(p.host.querySelector('[contenteditable]').textContent, 'My child reply');
  }
});

test('picker navigation preserves the thread, scroll and quick footer while keeping native overlays in the top layer', async t => {
  const p = nativePage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); input(p, 'Preserved native draft');
  p.query('.sidepeek-tool-poll').click(); await tick(50);
  const drawer = p.query('#sidepeek-drawer-root');
  const quick = p.query('.sidepeek-footer-textarea');
  const scroll = p.query('.sidepeek-body'); scroll.scrollTop = 470;
  const readCount = p.calls.filter(m => m.type === 'READ_THREAD').length;
  const layers = p.query('#layers'); const oldHost = p.host; const oldShell = p.shell;
  layers.innerHTML = '<div role="dialog" aria-modal="true"><input aria-label="Search for GIFs"></div>';
  p.w.history.pushState({}, '', '/i/foundmedia/search');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick(350);
  assert.equal(drawer.classList.contains('sidepeek-open'), true);
  assert.equal(scroll.scrollTop, 470);
  assert.equal(p.open.has(oldHost), false);
  assert.equal(oldShell.style.visibility, '');
  assert.equal(p.open.has(layers), true);
  assert.equal(p.query('.sidepeek-footer-textarea'), quick);
  layers.replaceChildren();
  const newHost = p.mount('Preserved native draft');
  p.w.history.pushState({}, '', '/compose/post');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick(50);
  assert.notEqual(newHost, oldHost);
  assert.equal(p.open.has(newHost), false, 'the editor remains in its original portal');
  assert.equal(p.open.has(layers), true);
  assert.equal(p.query('[data-sidex-native-composer]'), null);
  assert.equal(newHost.querySelector('[contenteditable]').textContent, 'Preserved native draft');
  assert.equal(p.calls.filter(m => m.type === 'READ_THREAD').length, readCount);
  assert.equal(scroll.scrollTop, 470);
  layers.replaceChildren();
  p.w.history.pushState({}, '', '/explore');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  assert.equal(drawer.classList.contains('sidepeek-open'), true, 'reply editing keeps the drawer open across navigation');
  p.query('.sidepeek-btn-close').click();
  assert.equal(drawer.classList.contains('sidepeek-open'), false, 'the close button dismisses the drawer');
  assert.equal(newHost.hasAttribute('data-sidex-native-composer'), false);
  assert.equal(layers.hasAttribute('popover'), false);
  assert.equal(layers.hasAttribute('data-sidex-native-layers'), false);
});

test('a confirmed native publication clears only its transferred quick draft and keeps the real reply', async t => {
  const p = nativePage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); input(p, 'Transferred draft');
  p.query('.sidepeek-tool-poll').click(); await tick(50);
  p.w.dispatchEvent(new p.w.MessageEvent('message', { source: p.w, origin: p.w.location.origin,
    data: { source: 'sidepeek-page', type: 'REPLY_CREATED', payload: created('998', '100', 'Transferred draft') } }));
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
  assert.ok(p.query('.sidepeek-comment-item[data-id="998"]'));
  p.change({ sidex_reply_mode: { newValue: 'native' } });
  p.change({ sidex_reply_mode: { newValue: 'drawer' } });
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
});

test('the actual popup mode selection makes comment reply icons open official dialogs or focus quick reply, retaining drafts', async t => {
  const p = nativePage(); t.after(() => p.w.close());
  const popup = new JSDOM(source('popup.html'), { url: 'https://example.test/popup', runScripts: 'outside-only' });
  t.after(() => popup.window.close());
  const prefs = { sidex_lang: 'zh', sidex_reply_mode: 'drawer' };
  popup.window.chrome = { runtime: { getManifest: () => ({ version: 'test' }) },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    storage: { sync: { get(defaults, callback) { callback({ ...defaults, ...prefs }); }, set(values) {
      Object.assign(prefs, values);
      p.change(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])));
    } } } };
  popup.window.eval(source('popup.js'));
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-act-reply').click(); input(p, 'Saved child draft');
  assert.equal(p.calls.some(m => m.type === 'OPEN_NATIVE_REPLY'), false);
  popup.window.document.querySelector('#btn-mode-native').click();
  assert.equal(prefs.sidex_reply_mode, 'native');
  assert.equal(popup.window.document.querySelector('#btn-mode-native').getAttribute('aria-pressed'), 'true');
  assert.match(popup.window.document.querySelector('#txt-reply-mode-hint').textContent, /回复图标.*官方回复框/);
  assert.equal(p.query('.sidepeek-footer-textarea'), null);
  assert.equal(p.query('.sidepeek-footer-composer'), null);
  p.query('.sidepeek-act-reply').click(); await tick(50);
  assert.equal(p.calls.find(m => m.type === 'OPEN_NATIVE_REPLY').tweetId, '101');
  assert.equal(p.calls.find(m => m.type === 'OPEN_NATIVE_REPLY').quickTool, false);
  assert.equal(p.host.querySelector('[contenteditable]').textContent, 'Saved child draft');
  assert.equal(p.host.hasAttribute('popover'), false);
  assert.equal(p.shell.style.visibility, '');
  assert.equal(p.open.has(p.query('#layers')), true);
  p.query('#layers').replaceChildren();
  popup.window.document.querySelector('#btn-mode-drawer').click();
  assert.equal(prefs.sidex_reply_mode, 'drawer');
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Saved child draft');
  p.query('.sidepeek-act-reply').click(); await tick();
  assert.equal(p.calls.filter(m => m.type === 'OPEN_NATIVE_REPLY').length, 1);
});

test('a native confirmation arriving after dialog dismissal cannot clear another post draft', async t => {
  const p = nativePage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick(); input(p, 'Transferred A');
  p.query('.sidepeek-tool-disclosure').click(); await tick(50);
  p.query('#layers').replaceChildren(); p.query('.sidepeek-btn-close').click();
  p.clickPost(1); await tick(); input(p, 'Draft B');
  p.w.dispatchEvent(new p.w.MessageEvent('message', { source: p.w, origin: p.w.location.origin,
    data: { source: 'sidepeek-page', type: 'REPLY_CREATED', payload: created('998', '100', 'Transferred A') } }));
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Draft B');
  p.query('.sidepeek-btn-close').click();
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, '');
});
