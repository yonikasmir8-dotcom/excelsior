// Release hygiene: scans the production build (dist/) and the desktop shell for things that must never ship.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk('dist'); walk('electron');
const text = files.filter((f) => ['.js', '.cjs', '.html', '.css', '.json'].includes(extname(f)));
const rules = [
  ['debug handles', /window\.__(G|API|UI|M|crashLog)\b/],
  ['dev server address', /localhost:\d+|127\.0\.0\.1:\d+/],
  ['remote fonts/CDNs', /fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs/],
  ['secrets', /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{12,}/i],
  ['private keys', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['leftover debugger', /\bdebugger;/],
  ['placeholder text', /\b(TODO|FIXME|XXX|PLACEHOLDER)\b|[Ll]orem ipsum/],
  ['source maps', /sourceMappingURL=/],
];
let fails = 0;
for (const [name, re] of rules) {
  const hits = text.filter((f) => re.test(readFileSync(f, 'utf8')));
  console.log(`${hits.length ? 'FAIL' : 'PASS'}  no ${name}${hits.length ? '  — ' + hits.join(', ') : ''}`); fails += hits.length ? 1 : 0;
}
// the page may only load code/assets from itself (CSP in index.html must stay strict)
const html = readFileSync('dist/index.html', 'utf8');
const csp = /Content-Security-Policy[^>]*content="([^"]+)"/.exec(html)?.[1] || '';
const cspOk = csp.includes("default-src 'self'") && !/https?:/.test(csp);
console.log(`${cspOk ? 'PASS' : 'FAIL'}  strict CSP (self only)${cspOk ? '' : '  — ' + csp}`); fails += cspOk ? 0 : 1;
const maps = files.filter((f) => f.endsWith('.map'));
console.log(`${maps.length ? 'FAIL' : 'PASS'}  no .map files shipped`); fails += maps.length ? 1 : 0;
const total = rules.length + 2; console.log(`\n${total - fails}/${total} passed`); process.exit(fails ? 1 : 0);
