// Builds GameKnight as ONE self-contained HTML file that runs entirely on a phone:
// the React frontend + the real backend (matching engine, market maker, SQLite via
// sql.js) + a pre-seeded database. No server, no install.
//
//   node standalone/build.mjs   →   frontend/dist-standalone/gameknight.html

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const frontend = path.join(root, 'frontend');
const out = path.join(here, '.build');
fs.mkdirSync(out, { recursive: true });
const require = createRequire(path.join(frontend, 'package.json'));
const esbuild = require('esbuild');

// 1. Seeded database → gzip → base64 module
const dbFile = path.join(out, 'seed.db');
execFileSync(process.execPath, [path.join(here, 'make-seed.js'), dbFile], { cwd: path.join(root, 'backend'), stdio: 'inherit' });
const gz = zlib.gzipSync(fs.readFileSync(dbFile), { level: 9 });
fs.writeFileSync(path.join(out, 'seed.js'), `export const BUILT_AT = ${Date.now()};\nexport const SEED_B64 = "${gz.toString('base64')}";\n`);
console.log(`seed gz: ${(gz.length / 1024).toFixed(0)} KB`);

// 2. Backend → browser ESM bundle with Node modules swapped for shims
const shim = n => path.join(here, 'shims', `${n}.js`);
await esbuild.build({
  entryPoints: [path.join(here, 'backend-entry.js')],
  outfile: path.join(out, 'backend.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true, legalComments: 'none',
  nodePaths: [path.join(root, 'backend', 'node_modules'), path.join(frontend, 'node_modules')],
  alias: {
    'better-sqlite3': shim('better-sqlite3'), express: shim('express'), cors: shim('cors'),
    crypto: shim('crypto'), fs: shim('fs'), path: shim('path'), events: shim('events'),
    'node:fs': shim('fs'), 'node:crypto': shim('crypto'), 'node:path': shim('path'),
  },
  define: { __dirname: '"/"' },
  logLevel: 'warning',
});

// 3. Frontend in standalone mode
execFileSync(path.join(frontend, 'node_modules', '.bin', 'vite'), ['build', '--mode', 'standalone'], { cwd: frontend, stdio: 'inherit' });

// 4. Inline the JS bundle into the HTML
const dist = path.join(frontend, 'dist-standalone');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, src) => {
  const js = fs.readFileSync(path.join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '');
fs.writeFileSync(path.join(dist, 'gameknight.html'), html);
console.log(`standalone: ${path.relative(root, path.join(dist, 'gameknight.html'))} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);

// 5. Fragment variant for hosts that supply their own <html>/<head>/<body> skeleton (e.g. Claude artifacts)
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<title>[^<]*<\/title>/, '<title>GameKnight</title>');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const fragment = `${head}\n<style>:root { color-scheme: dark; } html, body { background: #0b110e; }</style>\n${body}`;
fs.writeFileSync(path.join(dist, 'gameknight.fragment.html'), fragment);
