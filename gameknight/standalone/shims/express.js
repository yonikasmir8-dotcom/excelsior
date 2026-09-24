// A minimal in-browser stand-in for Express: same routing/middleware semantics the
// GameKnight server uses, dispatched from a fetch-like handle() instead of HTTP.

function compile(path) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/\/:([A-Za-z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  return { re, keys };
}

function express() {
  const layers = [];
  const add = (method, path, fns) => {
    if (typeof path === 'function') { fns = [path, ...fns]; path = null; }
    layers.push({ method, path, prefix: method === null, fns, ...(path && method !== null ? compile(path) : {}) });
  };
  const app = {
    set() {},
    listen() {},
    use(path, ...fns) { add(null, path, fns); },
    get(path, ...fns) { add('GET', path, fns); },
    post(path, ...fns) { add('POST', path, fns); },
    put(path, ...fns) { add('PUT', path, fns); },
    delete(path, ...fns) { add('DELETE', path, fns); },
    handle({ method, url, headers = {}, body }) {
      return new Promise(resolve => {
        const u = new URL(url, 'http://local');
        const req = {
          method, path: u.pathname, url, ip: 'local', body: body ?? {},
          query: Object.fromEntries(u.searchParams), params: {},
          headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
          on() {},
        };
        const res = {
          statusCode: 200, done: false,
          status(c) { this.statusCode = c; return this; },
          json(o) { if (!this.done) { this.done = true; resolve({ status: this.statusCode, body: JSON.parse(JSON.stringify(o ?? null)) }); } return this; },
          writeHead() {}, write() {}, end() { this.json({}); },
        };
        const stack = [];
        for (const l of layers) {
          if (l.prefix) {
            if (!l.path || req.path === l.path || req.path.startsWith(l.path + '/')) stack.push({ l, params: {} });
          } else if (l.method === method) {
            const m = req.path.match(l.re);
            if (m) stack.push({ l, params: Object.fromEntries(l.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) });
          }
        }
        const fns = stack.flatMap(({ l, params }) => l.fns.map(fn => ({ fn, params })));
        let i = 0;
        const next = err => {
          while (i < fns.length) {
            const { fn, params } = fns[i++];
            const isErr = fn.length === 4;
            if (err ? !isErr : isErr) continue;
            req.params = params;
            try {
              const r = err ? fn(err, req, res, next) : fn(req, res, next);
              if (r && r.catch) r.catch(next);
            } catch (e) { next(e); }
            return;
          }
          if (!res.done) res.status(err ? 500 : 404).json({ error: err ? String(err.message || err) : 'Not found' });
        };
        next();
      });
    },
  };
  return app;
}
express.json = () => (req, res, next) => next();
express.static = () => (req, res, next) => next();
module.exports = express;
