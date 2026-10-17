const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

function user(handle = 'reader', overrides = {}) {
  return { __typename: 'User', rest_id: '77', core: { name: 'Reader', screen_name: handle },
    avatar: { image_url: 'https://pbs.twimg.com/test_normal.png' },
    profile_bio: { description: '' }, relationship_counts: { followers: 12, following: 7 },
    relationship_perspectives: { following: false, followed_by: true }, ...overrides };
}
function tweet(id, parent = '', text = 'A thoughtful reply in English.', overrides = {}) {
  return { rest_id: id, core: { user_results: { result: user() } },
    legacy: { full_text: text, lang: 'en', in_reply_to_status_id_str: parent,
      conversation_id_str: parent || id, created_at: 'Thu Oct 08 08:00:00 +0000 2026',
      favorite_count: 4, reply_count: id === '101' ? 3 : 0, retweet_count: 2 }, ...overrides };
}
function thread(id) {
  const values = id === '101' ? [tweet('101', '100'), tweet('102', '101'), tweet('103', '101'), tweet('104', '101')]
    : [tweet(id), ...Array.from({ length: 25 }, (_, i) => tweet(String(Number(id) + i + 1), id,
      i === 0 ? 'This is a long reply. '.repeat(25) : `Reply ${i + 1}: a thoughtful reply in English.`))];
  return { data: values.map(result => ({ tweet_results: { result } })) };
}
const html = `<!doctype html><html lang="zh"><body><main data-testid="primaryColumn">
  <article data-testid="tweet"><a href="/reader/status/100"><time>Today</time></a><div data-testid="tweetText">Post A</div></article>
  <article data-testid="tweet"><a href="/reader/status/200"><time>Today</time></a><div data-testid="tweetText">Post B</div></article>
  </main><div data-testid="sidebarColumn"></div></body></html>`;

function createPage({ request, settings = {}, setupWindow } = {}) {
  const dom = new JSDOM(html, { url: 'https://x.com/home', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const calls = [];
  let changeListener;
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.chrome = { runtime: { getURL: name => name }, storage: {
    sync: { get(defaults, callback) { queueMicrotask(() => callback({ ...defaults, ...settings })); }, set() {} },
    onChanged: { addListener(fn) { changeListener = fn; } }
  } };
  w.postMessage = message => {
    if (message.source !== 'sidepeek-content') return;
    calls.push(message);
    Promise.resolve().then(() => request ? request(message) : thread(message.tweetId)).then(
      payload => w.dispatchEvent(new w.MessageEvent('message', { source: w, origin: w.location.origin,
        data: { source: 'sidepeek-page', requestId: message.requestId, ok: true, payload } })),
      error => w.dispatchEvent(new w.MessageEvent('message', { source: w, origin: w.location.origin,
        data: { source: 'sidepeek-page', requestId: message.requestId, ok: false, error: error.message } }))
    );
  };
  setupWindow?.(w);
  w.eval(source('vendor/twitter-text.js'));
  w.eval(source('core.js'));
  w.eval(source('content.js'));
  return { dom, w, calls, change: changes => changeListener(changes),
    clickPost: index => w.document.querySelectorAll('[data-testid="tweetText"]')[index].click(),
    query: selector => w.document.querySelector(selector) };
}
module.exports = { source, tick, user, tweet, thread, html, createPage };
