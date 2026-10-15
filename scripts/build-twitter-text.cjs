const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');

(async () => {
  const result = await esbuild.build({
    stdin: { contents: "export {default as parseTweet} from 'twitter-text/dist/esm/parseTweet.js';", resolveDir: root },
    bundle: true, minify: true, format: 'iife', globalName: 'SidePeekTwitterText',
    target: 'chrome114', outfile: path.join(root, 'vendor', 'twitter-text.js'), metafile: true,
    // Chromium already provides these ES2015 methods. Avoid global polyfills
    // in both the X page and the extension's isolated content-script world.
    plugins: [{ name: 'native-chromium-builtins', setup(build) {
      build.onResolve({ filter: /^core-js\// }, args => ({ path: args.path, namespace: 'native-builtins' }));
      build.onLoad({ filter: /.*/, namespace: 'native-builtins' }, () => ({ contents: '', loader: 'js' }));
    } }]
  });
  const packages = new Map();
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.startsWith('node_modules/')) continue;
    const parts = input.slice('node_modules/'.length).split('/');
    const name = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    if (packages.has(name)) continue;
    const dir = path.join(root, 'node_modules', name);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find(file => fs.existsSync(path.join(dir, file)));
    if (!license) throw new Error(`Missing bundled license: ${name}`);
    packages.set(name, `${name} ${meta.version}\n${fs.readFileSync(path.join(dir, license), 'utf8')}`);
  }
  fs.writeFileSync(path.join(root, 'vendor', 'twitter-text.LICENSE.txt'), [...packages.values()].join('\n\n--------------------\n\n'));
  console.log(`Bundled twitter-text with ${packages.size} license notices.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
