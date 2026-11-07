const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { source } = require('./helpers.cjs');

for (const [theme, color] of [['light', 'rgb(255, 255, 255)'], ['dark', 'rgb(0, 0, 0)'], ['dim', 'rgb(21, 32, 43)']]) {
  test(`promoting an x-web profile surface preserves its native paint and banner clipping in ${theme}`, t => {
    const dom = new JSDOM('<div data-base-ui-portal><div data-base-ui-focusable data-side="bottom" class="bg-modal" data-sidex-native-hover popover="manual"><img alt="Profile banner"></div></div>');
    t.after(() => dom.window.close());
    const { document } = dom.window;
    const native = document.createElement('style');
    native.textContent = `.bg-modal { background: ${color}; border: 0.5px solid rgb(120, 120, 120); border-radius: 12px; overflow: hidden; }`;
    document.head.append(native);
    const extension = document.createElement('style'); extension.textContent = source('sidebar.css'); document.head.append(extension);
    const card = document.querySelector('[data-sidex-native-hover]'), paint = dom.window.getComputedStyle(card);
    assert.equal(paint.backgroundColor, color);
    assert.equal(paint.borderTopWidth, '0.5px');
    assert.equal(paint.borderRadius, '12px');
    assert.equal(paint.overflow, 'hidden');
    assert.equal(paint.position, 'fixed');
  });
}

test('legacy hover promotion still leaves the wrapper transparent and its inner card painted', t => {
  const dom = new JSDOM('<div data-testid="hoverCardParent" data-sidex-native-hover popover="manual"><div class="inner">Profile</div></div>');
  t.after(() => dom.window.close());
  const style = dom.window.document.createElement('style');
  style.textContent = '.inner { background: rgb(0, 0, 0); }\n' + source('sidebar.css'); dom.window.document.head.append(style);
  assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('[data-testid]')).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('.inner')).backgroundColor, 'rgb(0, 0, 0)');
});

test('modern focal and pinned posts receive the same marker as legacy posts', t => {
  const dom = new JSDOM('<main><article class="group/post sidepeek-focal-active"></article><article class="group/post" data-sidex-pinned-active="dark"></article></main>');
  t.after(() => dom.window.close());
  const style = dom.window.document.createElement('style'); style.textContent = source('sidebar.css'); dom.window.document.head.append(style);
  for (const post of dom.window.document.querySelectorAll('article')) {
    assert.match(dom.window.getComputedStyle(post).boxShadow, /inset/);
  }
  assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('[data-sidex-pinned-active]')).backgroundColor, 'rgba(255, 255, 255, 0.03)');
});
