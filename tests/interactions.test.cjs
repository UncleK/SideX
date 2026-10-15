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

test('an active reply stays with its post through outside clicks, Escape and X navigation', async t => {
  const p = createPage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'Draft for post A';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));

  p.w.document.querySelector('main').click();
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  p.clickPost(1); await tick();
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  p.w.history.pushState({}, '', '/reader/status/200/photo/1');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  p.w.history.pushState({}, '', '/home');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();

  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  assert.equal(p.query('.sidepeek-comment-item').dataset.id, '101');
  assert.equal(textarea.value, 'Draft for post A');
  assert.equal(p.calls.some(m => m.type === 'READ_THREAD' && m.tweetId === '200'), false);
});

test('focusing an empty reply box starts protection until explicit close', async t => {
  const p = createPage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  p.query('.sidepeek-footer-textarea').focus();
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  p.query('.sidepeek-btn-close').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

test('a failed reply keeps the editing guard and draft', async t => {
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? Promise.reject(new Error('Rejected')) : thread(m.tweetId) });
  t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'Please keep this draft';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-footer-submit-btn').click(); await tick();
  p.w.document.querySelector('main').click();
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  assert.equal(textarea.value, 'Please keep this draft');
});

test('a successful reply restores outside-click dismissal', async t => {
  const created = { data: { create_tweet: { tweet_results: { result: tweet('999', '100', 'Sent reply') } } } };
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? created : thread(m.tweetId) });
  t.after(() => p.w.close());
  p.w.HTMLElement.prototype.scrollTo = function () {};
  await tick(); p.clickPost(0); await tick();
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'Sent reply';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-footer-submit-btn').click(); await tick();
  assert.equal(p.calls.some(m => m.type === 'CREATE_REPLY'), true);
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
});

test('focusing a second reply after sending starts a new editing session', async t => {
  const created = { data: { create_tweet: { tweet_results: { result: tweet('999', '100', 'Sent reply') } } } };
  const p = createPage({ request: m => m.type === 'CREATE_REPLY' ? created : thread(m.tweetId) });
  t.after(() => p.w.close());
  p.w.HTMLElement.prototype.scrollTo = function () {};
  await tick(); p.clickPost(0); await tick();
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'First reply';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.query('.sidepeek-footer-submit-btn').click(); await tick();
  textarea.blur();
  textarea.focus();
  textarea.value = 'Second draft';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
  assert.equal(textarea.value, 'Second draft');
});

test('the close button ends reply protection without losing the same-page draft', async t => {
  const p = createPage(); t.after(() => p.w.close());
  await tick(); p.clickPost(0); await tick();
  const textarea = p.query('.sidepeek-footer-textarea');
  textarea.focus();
  textarea.value = 'Saved on this page';
  textarea.dispatchEvent(new p.w.Event('input', { bubbles: true }));
  p.w.history.pushState({}, '', '/reader/status/200');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  p.query('.sidepeek-btn-close').click(); await tick(350);
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), false);
  p.w.history.pushState({}, '', '/home');
  p.w.dispatchEvent(new p.w.PopStateEvent('popstate')); await tick();
  p.clickPost(0); await tick();
  assert.equal(p.query('.sidepeek-footer-textarea').value, 'Saved on this page');
  p.query('.sidepeek-footer-textarea').focus();
  p.w.document.querySelector('main').click();
  assert.equal(p.query('#sidepeek-drawer-root').classList.contains('sidepeek-open'), true);
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
  p.query('.sidepeek-act-more').click();
  assert.equal(menus, 1);
  assert.equal(p.query('.sidepeek-more-menu'), null);
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
