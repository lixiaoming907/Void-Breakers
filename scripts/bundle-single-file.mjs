import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assetsDir = join(dist, 'assets');
const files = readdirSync(assetsDir);
const jsName = files.find((f) => f.endsWith('.js') && !f.endsWith('.map'));
const cssName = files.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) throw new Error('missing js/css');

const js = readFileSync(join(assetsDir, jsName));
const css = readFileSync(join(assetsDir, cssName), 'utf8');
const jsB64 = js.toString('base64');

// Keep original HTML shell, swap in CSS + base64 module script (no raw </script> issues)
let out = html
  .replace(/<link rel="stylesheet"[^>]*>/g, '')
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/g, '')
  .replace('</head>', `<style>\n${css}\n</style>\n</head>`)
  .replace(
    '</body>',
    `<script type="module">import("data:text/javascript;base64,${jsB64}").then(m=>{void m;}).catch(e=>console.error(e));</script>\n</body>`,
  );

// The default import path for vite modules is side-effect only; data: import works for classic bundles.
// Vite output is a module with side effects at top level — dynamic import executes it.

writeFileSync(join('..', '虚空破阵-VOIDBREAKERS.html'), out, 'utf8');
console.log('wrote single-file', out.length, 'jsB64', jsB64.length);
