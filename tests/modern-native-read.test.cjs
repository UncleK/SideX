const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { source } = require('./helpers.cjs');

function nativeRead({ preloaded = true, fail = false } = {}) {
  const roots = new Map(), calls = [], retained = [];
  const request = { node: { params: { name: 'TweetResultByRestId', id: 'native-artifact' }, operation: {}, fragment: {} },
    variables: { restId: 'original', withFocalTweet: true } };
  const add = () => roots.set('native', { operation: { request } });
  if (preloaded) add();
  const environment = { getStore: () => ({ _roots: roots }),
    retain(operation) { retained.push(operation); return { dispose() { retained.pop(); } }; },
    execute({ operation }) { calls.push(operation); return { subscribe(observer) {
      queueMicrotask(() => {
        if (fail) observer.error(new Error('native read failed'));
        else { observer.next({ data: { tweet_results: { result: { rest_id: '123', id: 'relay-123', core: {} } } } }); observer.complete(); }
      }); return { unsubscribe() {} };
    } }; } };
  const preloads = [];
  const context = vm.createContext({ setTimeout, clearTimeout, nativeRelayEnvironment: () => environment,
    cachedRawTweet: () => ({ core: { user_results: { result: { core: { screen_name: 'reader' } } } } }),
    xWebNavigation: () => ({ router: { async preloadRoute(input) { preloads.push(input); add(); } } }) });
  const js = source('page-bridge.js');
  const start = js.indexOf('  async function xWebTweetReference(');
  const end = js.indexOf('  // Installed at document_start', start);
  vm.runInContext(js.slice(start, end), context);
  return { read: context.xWebTweetReference, calls, retained, preloads };
}

test('native menu target uses the retained TweetResultByRestId artifact without source-row IDs', async () => {
  const n = nativeRead(), fragments = { moreMenu_tweet: {} };
  const target = await n.read('123', { __fragments: fragments });
  assert.equal(n.calls[0].request.variables.restId, '123');
  assert.equal('focalTweetId' in n.calls[0].request.variables, false);
  assert.equal(target.reference.__id, 'relay-123');
  assert.equal(target.reference.__fragments, fragments);
  assert.equal(n.retained.length, 1);
  target.release(); assert.equal(n.retained.length, 0);
});

test('fresh home preloads the target route without navigation before native menu normalization', async () => {
  const n = nativeRead({ preloaded: false });
  const target = await n.read('123', { __fragments: { shareButton_tweet: {} } });
  assert.equal(n.preloads[0].to, '/reader/status/123');
  assert.equal(target.reference.__fragmentOwner.variables.restId, '123');
  target.release();
});

test('native menu read failure releases retention and does not retry', async () => {
  const n = nativeRead({ fail: true });
  await assert.rejects(n.read('123', { __fragments: {} }), /native read failed/);
  assert.equal(n.calls.length, 1);
  assert.equal(n.retained.length, 0);
});
