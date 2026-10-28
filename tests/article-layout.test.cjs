const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPage, tick } = require('./helpers.cjs');

function addQuote(w, { width = 0, height = 3280, article = true, rowWidth = 520 } = {}) {
  const quote = w.document.createElement('div');
  quote.setAttribute('role', 'link');
  quote.innerHTML = `<div style="display:flex;flex-direction:row">
    <div>${article ? '<div data-testid="article-cover-image"></div>' : '<img alt="Photo">'}</div>
    <div data-testid="testCondensedMedia"></div>
    <div><div data-testid="tweetText">Quoted caption</div></div>
  </div>`;
  const row = quote.firstElementChild;
  row.getBoundingClientRect = () => ({ width: rowWidth, height });
  quote.querySelector('[data-testid="tweetText"]').getBoundingClientRect = () => ({ width, height });
  w.document.querySelector('article').append(quote);
  return row;
}

test('only a tall zero-width Article caption receives the native layout repair', async t => {
  let rows;
  const p = createPage({ setupWindow(w) {
    rows = [addQuote(w), addQuote(w, { width: 200, height: 100 }),
      addQuote(w, { article: false }), addQuote(w, { rowWidth: 0 }), addQuote(w, { height: 80 })];
  } });
  t.after(() => p.w.close()); await tick();
  assert.deepEqual(rows.map(row => row.hasAttribute('data-sidex-article-quote-layout')), [true, false, false, false, false]);
  assert.equal(p.calls.length, 0, 'a layout repair does not open or fetch a conversation');
});

test('late Article quotes are repaired with the sidebar closed and restored on disable or recycling', async t => {
  const p = createPage(); t.after(() => p.w.close()); await tick();
  const row = addQuote(p.w); await tick(50);
  assert.equal(row.hasAttribute('data-sidex-article-quote-layout'), true);
  p.change({ sidex_enabled: { newValue: false } });
  assert.equal(row.hasAttribute('data-sidex-article-quote-layout'), false);
  p.change({ sidex_enabled: { newValue: true } });
  assert.equal(row.hasAttribute('data-sidex-article-quote-layout'), true);
  row.querySelector('[data-testid="article-cover-image"]').remove(); await tick(50);
  assert.equal(row.hasAttribute('data-sidex-article-quote-layout'), false);
});

test('disabled SideX leaves native quote layouts alone until enabled', async t => {
  let row;
  const p = createPage({ settings: { sidex_enabled: false }, setupWindow(w) { row = addQuote(w); } });
  t.after(() => p.w.close()); await tick();
  assert.equal(row.hasAttribute('data-sidex-article-quote-layout'), false);
  p.change({ sidex_enabled: { newValue: true } });
  assert.equal(row.hasAttribute('data-sidex-article-quote-layout'), true);
});
