const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { source, createPage, tick } = require('./helpers.cjs');

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

for (const client of ['legacy', 'x-web']) {
  test(`${client} selection keeps the native row background until the panel switches or closes`, async t => {
    const modern = client === 'x-web';
    // JSDOM exposes the declared var() expression without resolving it.
    const selectedColor = 'var(--x-hover-faint, rgba(0, 0, 0, 0.03))';
    const p = createPage({ setupWindow(w) {
      const style = w.document.createElement('style');
      style.textContent = source('sidebar.css');
      w.document.head.append(style);
      if (modern) {
        w.document.querySelector('main').innerHTML = ['100', '200'].map(id => `
          <div data-navigation-stop role="link" data-href="/reader/status/${id}">
            <article class="group/post"><div dir="auto">Long post ${id} with replies</div></article>
          </div>`).join('');
      }
    } });
    t.after(() => p.w.close());
    await tick();
    const [first, second] = p.w.document.querySelectorAll('main article');
    const firstRow = modern ? first.parentElement : first;
    const secondRow = modern ? second.parentElement : second;
    const readPaint = node => {
      const { backgroundColor, boxShadow, outline, border } = p.w.getComputedStyle(node);
      return { backgroundColor, boxShadow, outline, border };
    };
    const firstPaint = readPaint(firstRow);
    const secondPaint = readPaint(secondRow);
    const articlePaint = readPaint(first);
    first.querySelector('[dir="auto"], [data-testid="tweetText"]').click();
    await tick();
    assert.ok(p.query('#sidepeek-drawer-root.sidepeek-open'));
    firstRow.dispatchEvent(new p.w.MouseEvent('mouseleave'));
    assert.deepEqual(readPaint(firstRow), { ...firstPaint, backgroundColor: selectedColor });
    if (modern) assert.deepEqual(readPaint(first), articlePaint);
    assert.deepEqual(readPaint(secondRow), secondPaint);

    p.query('.sidepeek-btn-pin').click();
    p.query('.sidepeek-btn-pin').click();
    assert.equal(readPaint(firstRow).backgroundColor, selectedColor);

    second.querySelector('[dir="auto"], [data-testid="tweetText"]').click();
    await tick();
    assert.deepEqual(readPaint(firstRow), firstPaint);
    assert.deepEqual(readPaint(secondRow), { ...secondPaint, backgroundColor: selectedColor });
    p.query('.sidepeek-btn-close').click();
    assert.deepEqual(readPaint(secondRow), secondPaint);
  });
}
