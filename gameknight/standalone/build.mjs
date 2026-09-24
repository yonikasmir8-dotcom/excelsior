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

// 3. Crests: embed shrunk copies as data: URIs so they show inside sandboxed viewers
//    (which block external images). Skipped gracefully when the crest host is unreachable.
{
  const { PNG } = require('pngjs')
  const crests = JSON.parse(fs.readFileSync(path.join(frontend, 'src', 'crests.json'), 'utf8'))
  const urls = [...new Set([...Object.values(crests.comps), ...Object.values(crests.teams)].filter(Boolean))]
  const mirror = process.env.CREST_MIRROR // for testing: serve crests from elsewhere
  const inline = {}
  let failures = 0
  const shrink = (buf, size = 96) => {
    const src = PNG.sync.read(buf)
    const out = new PNG({ width: size, height: size })
    const k = src.width / size
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0]; let n = 0
      for (let yy = Math.floor(y * k); yy < Math.floor((y + 1) * k); yy++) for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) {
        const i = (yy * src.width + xx) * 4, a = src.data[i + 3] / 255
        acc[0] += src.data[i] * a; acc[1] += src.data[i + 1] * a; acc[2] += src.data[i + 2] * a; acc[3] += src.data[i + 3]; n++
      }
      const o = (y * size + x) * 4, alpha = acc[3] / n
      for (let c = 0; c < 3; c++) out.data[o + c] = alpha ? Math.round(acc[c] / n / (alpha / 255)) : 0
      out.data[o + 3] = Math.round(alpha)
    }
    return PNG.sync.write(out, { colorType: 6 })
  }
  for (const u of urls) {
    if (failures >= 3 && !Object.keys(inline).length) break
    const src = mirror ? u.replace('https://assets.football-logos.cc', mirror) : u
    try {
      const buf = execFileSync('curl', ['-sfL', '--max-time', '8', src], { maxBuffer: 20e6 })
      inline[u] = `data:image/png;base64,${shrink(buf).toString('base64')}`
    } catch { failures++ }
  }
  const n = Object.keys(inline).length
  fs.writeFileSync(path.join(out, 'crests-inline.js'), `export const CRESTS_INLINE = ${JSON.stringify(inline)};\nexport const CRESTS_ONLY = ${n > 0};\n`)
  console.log(n ? `crests: embedded ${n}/${urls.length}` : 'crests: host unreachable — app will fall back to club-colour shields')
}

// 4. Frontend in standalone mode
execFileSync(path.join(frontend, 'node_modules', '.bin', 'vite'), ['build', '--mode', 'standalone'], { cwd: frontend, stdio: 'inherit' });

// 5. Inline the JS bundle into the HTML
const dist = path.join(frontend, 'dist-standalone');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, src) => {
  const js = fs.readFileSync(path.join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '');
fs.writeFileSync(path.join(dist, 'gameknight.html'), html);
console.log(`standalone: ${path.relative(root, path.join(dist, 'gameknight.html'))} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);

// 6. Fragment variant for hosts that supply their own <html>/<head>/<body> skeleton (e.g. Claude artifacts)
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<title>[^<]*<\/title>/, '<title>GameKnight</title>');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const fragment = `${head}\n<style>:root { color-scheme: dark; } html, body { background: #0b110e; }</style>\n${body}`;
fs.writeFileSync(path.join(dist, 'gameknight.fragment.html'), fragment);
