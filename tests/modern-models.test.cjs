const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { source, tweet, user } = require('./helpers.cjs');
const observedDetail = require('./fixtures/x-web-tweet-detail-20261108.json');

function core(t) {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(source('core.js'));
  return dom.window.SidePeekCore;
}

test('mixed user responses use the same current handle for author and post URL', t => {
  const raw = tweet('101', '', 'Body');
  raw.core.user_results.result = user('current', { legacy: { screen_name: 'stale' } });
  const model = core(t).tweetModel(raw);
  assert.equal(model.author.handle, 'current');
  assert.equal(model.url, 'https://x.com/current/status/101');
});

test('current x-web URL entities take precedence over stale legacy expansions', t => {
  const raw = tweet('101', '', 'Old body');
  raw.details = { full_text: 'Current source https://t.co/source' };
  raw.legacy.entities = { urls: [{ url: 'https://t.co/source', expanded_url: 'https://stale.example/source' }] };
  raw.url_entities = [{ url: 'https://t.co/source', expanded_url: 'https://current.example/source', display_url: 'current.example/source' }];
  const model = core(t).tweetModel(raw);
  assert.equal(model.entities.urls[0].expandedUrl, 'https://current.example/source');
});

test('a note body uses its own URL expansions when a short-text entity is also present', t => {
  const raw = tweet('101', '', 'Short https://t.co/source');
  raw.url_entities = [{ url: 'https://t.co/source', expanded_url: 'https://short.example/source' }];
  raw.note_tweet = { note_tweet_results: { result: {
    text: 'Full note https://t.co/source',
    entity_set: { urls: [{ url: 'https://t.co/source', expanded_url: 'https://note.example/source' }] }
  } } };
  const model = core(t).tweetModel(raw);
  assert.equal(model.text, 'Full note https://t.co/source');
  assert.equal(model.entities.urls[0].expandedUrl, 'https://note.example/source');
});

test('x-web cards recover their destination from modern URL entities', t => {
  const raw = tweet('101', '', 'Card https://t.co/card');
  raw.legacy.entities = {};
  raw.card = { legacy: { binding_values: [{ key: 'title', value: { string_value: 'Source' } }] } };
  raw.url_entities = [{ url: 'https://t.co/card', expanded_url: 'https://example.com/card' }];
  assert.equal(core(t).tweetModel(raw).card.url, 'https://example.com/card');
  raw.card.legacy.url = 'https://t.co/card';
  raw.url_entities.unshift({ url: 'https://t.co/unrelated', expanded_url: 'https://example.com/unrelated' });
  assert.equal(core(t).tweetModel(raw).card.url, 'https://example.com/card', 'the card identity wins over another link in the post');
});

test('x-web display ranges are Unicode code-point offsets', t => {
  // The shipped x-web client slices details.full_text with Array.from(...).
  const raw = tweet('101', '', 'Legacy text');
  raw.details = { full_text: '😀😀 @reader Visible body', display_text_range: [11, 23] };
  assert.equal(core(t).tweetModel(raw).text, 'Visible body');
});

test('an emoji before a modern media attachment cannot leave its t.co URL in the body', t => {
  const raw = structuredClone(observedDetail.data[0].tweet_results.result);
  raw.details.full_text = '😀 ' + raw.details.full_text;
  raw.media_entities2[0].indices = raw.media_entities2[0].indices.map(index => index + 2);
  const model = core(t).tweetModel(raw);
  assert.match(model.text, /^😀 gpt/);
  assert.doesNotMatch(model.text, /https:\/\/t\.co/);
  assert.equal(model.media[0].type, 'video');
});

test('x-web short text is HTML-unescaped after code-point slicing while note text remains plain', t => {
  // x-web's text adapter marks details.full_text HtmlEscaped and notes Plain.
  const raw = tweet('101', '', 'Legacy text');
  raw.details = { full_text: '😀😀 @reader &lt;tag&gt; &amp; &#x1F680;', display_text_range: [11, 48] };
  const Core = core(t);
  assert.equal(Core.tweetModel(raw).text, '<tag> & 🚀');
  raw.note_tweet = { note_tweet_results: { result: { text: 'Use &amp; as the literal HTML entity' } } };
  assert.equal(Core.tweetModel(raw).text, 'Use &amp; as the literal HTML entity');
});

test('explicit modern zero counts and false flags override stale legacy values', t => {
  const raw = tweet('101', '', 'Body');
  Object.assign(raw.legacy, { reply_count: 9, favorite_count: 12, retweet_count: 4, bookmark_count: 3,
    favorited: true, retweeted: true, bookmarked: true });
  raw.counts = { reply_count: 0, favorite_count: 0, retweet_count: 0, bookmark_count: 0 };
  raw.perspective = { favorited: false, retweeted: false, bookmarked: false };
  const model = core(t).tweetModel(raw);
  assert.equal(model.reportedReplyCount, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(model.counts)), { replies: 0, reposts: 0, likes: 0, bookmarks: 0, views: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(model.flags)), { liked: false, reposted: false, bookmarked: false });
});
