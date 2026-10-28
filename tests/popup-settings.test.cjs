const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createPage, source, tick } = require('./helpers.cjs');

function popup(t, prefs = {}, onWrite = () => {}) {
  const dom = new JSDOM(source('popup.html'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.chrome = { storage: { sync: {
    get(defaults, cb) { cb({ ...defaults, ...prefs }); },
    set(values) { Object.assign(prefs, values); onWrite(values); }
  } } };
  dom.window.eval(source('popup.js'));
  return { w: dom.window, query: selector => dom.window.document.querySelector(selector) };
}

test('refresh reminder appears only after an actual preference change and resets when reopened', t => {
  const prefs = { sidex_lang: 'zh', sidex_sub_reply_limit: 3 };
  const p = popup(t, prefs);
  assert.equal(p.query('.sidex-refresh-notice').hidden, true);
  p.query('[data-limit="3"]').click();
  assert.equal(p.query('.sidex-refresh-notice').hidden, true, 'reselecting the same setting changes nothing');
  p.query('[data-limit="2"]').click();
  assert.equal(p.query('.sidex-refresh-notice').hidden, false);
  assert.equal(p.query('#txt-refresh-notice').textContent, '请刷新 X 生效');
  assert.match(p.query('#txt-subreply-limit-hint').textContent, /再加载 4 条，共 6 条/);
  assert.equal(popup(t, prefs).query('.sidex-refresh-notice').hidden, true);
});

test('restore all writes every default, restores width, and preserves the open reply draft', async t => {
  const prefs = { sidex_lang: 'zh', sidex_sub_reply_limit: 3, sidex_auto_load_replies: false,
    sidex_auto_expand_reply_text: false, sidex_auto_pin: true, sidex_translation_provider: 'google',
    sidex_reply_mode: 'drawer', sidex_photo_mode: 'native' };
  const page = createPage({ settings: prefs });
  t.after(() => page.w.close()); await tick(); page.clickPost(0); await tick();
  page.w.localStorage.setItem('sidepeek_custom_width_v2', '700');
  const textarea = page.query('.sidepeek-footer-textarea');
  textarea.value = 'Keep this unsent reply';
  textarea.dispatchEvent(new page.w.Event('input', { bubbles: true }));
  let written;
  const p = popup(t, prefs, values => {
    written = values;
    page.change(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])));
  });
  p.query('#btn-reset-defaults').click(); await tick();
  assert.deepEqual(Object.fromEntries(Object.entries(written).filter(([key]) => key !== 'sidex_reset_defaults_trigger')), {
    sidex_enabled: true, sidex_auto_load_replies: true, sidex_auto_expand_reply_text: true,
    sidex_lang: null, sidex_sub_reply_limit: 1, sidex_reply_mode: 'drawer', sidex_photo_mode: 'sidex',
    sidex_translation_provider: 'x', sidex_auto_pin: false
  });
  assert.equal(typeof written.sidex_reset_defaults_trigger, 'number');
  assert.equal(page.w.localStorage.getItem('sidepeek_custom_width_v2'), null);
  assert.equal(page.query('.sidepeek-footer-textarea').value, 'Keep this unsent reply');
  assert.equal(p.query('#sidex-auto-expand-text').checked, true);
  assert.equal(p.query('[data-photo-mode]').dataset.photoMode, 'sidex');
  assert.equal(p.query('.sidex-refresh-notice').hidden, false);
});
