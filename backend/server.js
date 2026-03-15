const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { clerkMiddleware, getAuth } = require('@clerk/express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(clerkMiddleware());

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'excelsior.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS comics (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT    NOT NULL,
    title         TEXT    NOT NULL,
    publisher     TEXT    NOT NULL DEFAULT '',
    writer        TEXT    NOT NULL DEFAULT '',
    artist        TEXT    NOT NULL DEFAULT '',
    issue_num     TEXT    NOT NULL DEFAULT '',
    shelf         TEXT    NOT NULL DEFAULT 'read'
                          CHECK(shelf IN ('read','reading','want')),
    rating_plot   INTEGER NOT NULL DEFAULT 0 CHECK(rating_plot   BETWEEN 0 AND 5),
    rating_art    INTEGER NOT NULL DEFAULT 0 CHECK(rating_art    BETWEEN 0 AND 5),
    rating_writing INTEGER NOT NULL DEFAULT 0 CHECK(rating_writing BETWEEN 0 AND 5),
    rating        REAL    NOT NULL DEFAULT 0,
    date_read     TEXT    NOT NULL DEFAULT '',
    review        TEXT    NOT NULL DEFAULT '',
    tags          TEXT    NOT NULL DEFAULT '[]',
    cover_color   TEXT    NOT NULL DEFAULT '#b30000',
    cover_image   TEXT    NOT NULL DEFAULT '',
    amazon_url    TEXT    NOT NULL DEFAULT '',
    catalog_id    INTEGER DEFAULT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS comics_updated_at
  AFTER UPDATE ON comics
  BEGIN
    UPDATE comics SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

  CREATE TABLE IF NOT EXISTS alias (
    user_id       TEXT    PRIMARY KEY,
    alias         TEXT    NOT NULL UNIQUE,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id   TEXT    NOT NULL,
    following_id  TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id)
  );

  CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT    NOT NULL,
    type          TEXT    NOT NULL,
    actor_id      TEXT    NOT NULL,
    entity_id     INTEGER,
    read          INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);

  -- Comic catalog: the shared index of known comics
  CREATE TABLE IF NOT EXISTS comic_catalog (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    issue_num     TEXT    NOT NULL DEFAULT '',
    publisher     TEXT    NOT NULL DEFAULT '',
    writer        TEXT    NOT NULL DEFAULT '',
    artist        TEXT    NOT NULL DEFAULT '',
    cover_image   TEXT    NOT NULL DEFAULT '',
    tags          TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_catalog_title ON comic_catalog(title);
`);

// ── Migrate existing DB: add new rating columns if they don't exist ──────────
try {
  db.exec(`ALTER TABLE comics ADD COLUMN rating_plot INTEGER NOT NULL DEFAULT 0`);
} catch(e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE comics ADD COLUMN rating_art INTEGER NOT NULL DEFAULT 0`);
} catch(e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE comics ADD COLUMN rating_writing INTEGER NOT NULL DEFAULT 0`);
} catch(e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE comics ADD COLUMN catalog_id INTEGER DEFAULT NULL`);
} catch(e) { /* column already exists */ }

// Migrate old single rating → rating_plot + rating_art + rating_writing if needed
// (only runs if there are comics with old rating > 0 but all 3 sub-ratings = 0)
try {
  db.exec(`
    UPDATE comics SET rating_plot = rating, rating_art = rating, rating_writing = rating
    WHERE rating > 0 AND rating_plot = 0 AND rating_art = 0 AND rating_writing = 0
  `);
} catch(e) {}

// Make rating column REAL if it was INTEGER (for averages)
// SQLite is flexible with types so this works without ALTER

// ── Seed catalog if empty ────────────────────────────────────────────────────
const catalogCount = db.prepare('SELECT COUNT(*) n FROM comic_catalog').get().n;
if (catalogCount === 0) {
  const seedPath = path.join(__dirname, 'seed-catalog.json');
  if (fs.existsSync(seedPath)) {
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const insert = db.prepare(`
      INSERT INTO comic_catalog (title, issue_num, publisher, writer, artist, cover_image, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((comics) => {
      for (const c of comics) {
        insert.run(c.title, c.issue_num || '', c.publisher || '', c.writer || '',
                   c.artist || '', c.cover_image || '', c.tags || '');
      }
    });
    insertMany(seed);
    console.log(`📚 Seeded catalog with ${seed.length} comics`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseTags = row => {
  try { row.tags = JSON.parse(row.tags); } catch { row.tags = []; }
  return row;
};

// Compute overall rating from sub-ratings
const computeRating = (plot, art, writing) => {
  const rated = [plot, art, writing].filter(r => r > 0);
  if (rated.length === 0) return 0;
  return +(rated.reduce((a,b) => a+b, 0) / rated.length).toFixed(1);
};

// Enrich rows with alias
const withAlias = (rows) => rows.map(row => {
  const a = db.prepare('SELECT alias FROM alias WHERE user_id = ?').get(row.user_id || row.actor_id);
  return { ...row, alias: a?.alias || null };
});

// ── Auth ──────────────────────────────────────────────────────────────────────
// clerkMiddleware() is applied globally above; getAuth(req) extracts userId
// For API routes, we use a simple middleware that returns 401 instead of redirecting
const apiAuth = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ── Catalog search ───────────────────────────────────────────────────────────
app.get('/api/catalog/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  // Fuzzy search: split query into words and match all
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let sql = 'SELECT * FROM comic_catalog WHERE 1=1';
  const params = [];
  for (const w of words) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(writer) LIKE ? OR LOWER(artist) LIKE ? OR LOWER(publisher) LIKE ?)';
    const p = `%${w}%`;
    params.push(p, p, p, p);
  }
  sql += ' ORDER BY title ASC, issue_num ASC LIMIT 30';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Get single catalog entry
app.get('/api/catalog/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM comic_catalog WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ── Predefined tags list ─────────────────────────────────────────────────────
const PREDEFINED_TAGS = [
  'superhero', 'sci-fi', 'horror', 'noir', 'fantasy', 'comedy', 'romance',
  'thriller', 'manga', 'indie', 'graphic-novel', 'one-shot', 'limited-series',
  'event', 'origin-story', 'team-up', 'cosmic', 'first-appearance', 'classic',
  'mystery', 'action', 'drama', 'western', 'war', 'crime', 'anthology',
  'crossover', 'reboot', 'award-winner', 'adult', 'all-ages', 'slice-of-life',
  'dystopian', 'cyberpunk', 'steampunk', 'post-apocalyptic', 'spy',
  'martial-arts', 'supernatural', 'satire', 'biographical', 'historical'
];

app.get('/api/tags', (req, res) => {
  res.json(PREDEFINED_TAGS);
});

// ── Universal ratings ────────────────────────────────────────────────────────

// Get universal (community) rating for a catalog entry
app.get('/api/catalog/:id/ratings', (req, res) => {
  const catId = req.params.id;
  const rows = db.prepare(`
    SELECT rating_plot, rating_art, rating_writing, rating
    FROM comics WHERE catalog_id = ? AND rating > 0
  `).all(catId);

  if (rows.length === 0) return res.json({ count: 0, avg_plot: null, avg_art: null, avg_writing: null, avg_overall: null });

  const avg = (arr) => arr.length ? +(arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(1) : null;
  const plots = rows.filter(r => r.rating_plot > 0).map(r => r.rating_plot);
  const arts = rows.filter(r => r.rating_art > 0).map(r => r.rating_art);
  const writings = rows.filter(r => r.rating_writing > 0).map(r => r.rating_writing);
  const overalls = rows.map(r => r.rating);

  res.json({
    count: rows.length,
    avg_plot: avg(plots),
    avg_art: avg(arts),
    avg_writing: avg(writings),
    avg_overall: avg(overalls)
  });
});

// ── Similar raters ───────────────────────────────────────────────────────────
app.get('/api/similar-raters', apiAuth, (req, res) => {
  const me = getAuth(req).userId;

  // Get my ratings keyed by catalog_id
  const myRatings = db.prepare(`
    SELECT catalog_id, rating FROM comics
    WHERE user_id = ? AND catalog_id IS NOT NULL AND rating > 0
  `).all(me);

  if (myRatings.length < 3) return res.json([]); // need at least 3 rated comics

  const myMap = {};
  for (const r of myRatings) myMap[r.catalog_id] = r.rating;
  const myCatIds = Object.keys(myMap);

  // Find other users who rated the same catalog entries
  const otherUsers = db.prepare(`
    SELECT DISTINCT user_id FROM comics
    WHERE catalog_id IN (${myCatIds.map(() => '?').join(',')})
      AND user_id != ? AND rating > 0
  `).all(...myCatIds, me);

  const similarities = [];
  for (const { user_id } of otherUsers) {
    const theirRatings = db.prepare(`
      SELECT catalog_id, rating FROM comics
      WHERE user_id = ? AND catalog_id IN (${myCatIds.map(() => '?').join(',')}) AND rating > 0
    `).all(user_id, ...myCatIds);

    if (theirRatings.length < 2) continue; // need overlap

    // Cosine similarity on overlapping ratings
    let dotProduct = 0, magA = 0, magB = 0;
    for (const tr of theirRatings) {
      const myR = myMap[tr.catalog_id];
      if (!myR) continue;
      dotProduct += myR * tr.rating;
      magA += myR * myR;
      magB += tr.rating * tr.rating;
    }
    if (magA === 0 || magB === 0) continue;
    const similarity = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));

    const aliasRow = db.prepare('SELECT alias FROM alias WHERE user_id = ?').get(user_id);
    similarities.push({
      user_id,
      alias: aliasRow?.alias || null,
      similarity: +similarity.toFixed(3),
      overlap: theirRatings.length
    });
  }

  similarities.sort((a, b) => b.similarity - a.similarity);
  res.json(similarities.slice(0, 10));
});

// ── Alias ─────────────────────────────────────────────────────────────────────
app.get('/api/alias/check/:alias', (req, res) => {
  const row = db.prepare('SELECT user_id FROM alias WHERE alias = ?').get(req.params.alias.toLowerCase());
  res.json({ available: !row });
});

app.post('/api/alias', apiAuth, (req, res) => {
  const userId = getAuth(req).userId;
  const { alias } = req.body;
  if (!alias || alias.length < 2 || alias.length > 30)
    return res.status(400).json({ error: 'Alias must be 2–30 characters' });
  const clean = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (clean !== alias.toLowerCase())
    return res.status(400).json({ error: 'Only letters, numbers, _ and - allowed' });
  const existing = db.prepare('SELECT user_id FROM alias WHERE alias = ?').get(clean);
  if (existing && existing.user_id !== userId) return res.status(409).json({ error: 'That alias is already taken' });
  db.prepare('INSERT OR REPLACE INTO alias (user_id, alias) VALUES (?,?)').run(userId, clean);
  res.json({ alias: clean });
});

app.get('/api/alias/mine', apiAuth, (req, res) => {
  const row = db.prepare('SELECT alias FROM alias WHERE user_id = ?').get(getAuth(req).userId);
  res.json({ alias: row?.alias || null });
});

// ── Comics ─────────────────────────────────────────────────────────────────────
app.get('/api/comics', apiAuth, (req, res) => {
  const { shelf, sort = 'created_at', order = 'desc' } = req.query;
  const safeSort  = ['created_at','date_read','title','rating'].includes(sort) ? sort : 'created_at';
  const safeOrder = ['asc','desc'].includes(order) ? order : 'desc';
  const uid = getAuth(req).userId;
  if (shelf && ['read','reading','want'].includes(shelf)) {
    return res.json(
      db.prepare(`SELECT * FROM comics WHERE user_id=? AND shelf=? ORDER BY ${safeSort} ${safeOrder}`)
        .all(uid, shelf).map(parseTags)
    );
  }
  res.json(db.prepare(`SELECT * FROM comics WHERE user_id=? ORDER BY ${safeSort} ${safeOrder}`).all(uid).map(parseTags));
});

app.get('/api/comics/:id', apiAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM comics WHERE id=? AND user_id=?').get(req.params.id, getAuth(req).userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(parseTags(row));
});

app.post('/api/comics', apiAuth, (req, res) => {
  const { title, publisher='', writer='', artist='', issue_num='', shelf='read',
          rating_plot=0, rating_art=0, rating_writing=0,
          date_read='', review='', tags=[], cover_color='#b30000',
          cover_image='', amazon_url='', catalog_id=null } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const rating = computeRating(rating_plot, rating_art, rating_writing);

  const result = db.prepare(`
    INSERT INTO comics (user_id,title,publisher,writer,artist,issue_num,shelf,
      rating_plot,rating_art,rating_writing,rating,
      date_read,review,tags,cover_color,cover_image,amazon_url,catalog_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(getAuth(req).userId, title, publisher, writer, artist, issue_num, shelf,
         rating_plot, rating_art, rating_writing, rating,
         date_read, review, JSON.stringify(tags), cover_color, cover_image, amazon_url, catalog_id);

  // If this comic isn't in the catalog yet, add it for future users
  if (!catalog_id && title) {
    const existsInCatalog = db.prepare(
      'SELECT id FROM comic_catalog WHERE LOWER(title)=LOWER(?) AND LOWER(issue_num)=LOWER(?) LIMIT 1'
    ).get(title, issue_num || '');
    if (!existsInCatalog) {
      const newCat = db.prepare(
        'INSERT INTO comic_catalog (title,issue_num,publisher,writer,artist,cover_image,tags) VALUES (?,?,?,?,?,?,?)'
      ).run(title, issue_num || '', publisher, writer, artist, cover_image, Array.isArray(tags) ? tags.join(',') : '');
      // Link back
      db.prepare('UPDATE comics SET catalog_id=? WHERE id=?').run(newCat.lastInsertRowid, result.lastInsertRowid);
    }
  }

  // Notify followers of new read entry
  if (shelf === 'read') {
    const followers = db.prepare('SELECT follower_id FROM follows WHERE following_id=?').all(getAuth(req).userId);
    const notifStmt = db.prepare('INSERT INTO notifications (user_id, type, actor_id, entity_id) VALUES (?,?,?,?)');
    for (const f of followers) notifStmt.run(f.follower_id, 'new_read', getAuth(req).userId, result.lastInsertRowid);
  }

  res.status(201).json(parseTags(db.prepare('SELECT * FROM comics WHERE id=?').get(result.lastInsertRowid)));
});

app.put('/api/comics/:id', apiAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM comics WHERE id=? AND user_id=?').get(req.params.id, getAuth(req).userId);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { title=existing.title, publisher=existing.publisher, writer=existing.writer,
          artist=existing.artist, issue_num=existing.issue_num, shelf=existing.shelf,
          rating_plot=existing.rating_plot, rating_art=existing.rating_art,
          rating_writing=existing.rating_writing,
          date_read=existing.date_read, review=existing.review,
          tags=JSON.parse(existing.tags||'[]'), cover_color=existing.cover_color,
          cover_image=existing.cover_image, amazon_url=existing.amazon_url,
          catalog_id=existing.catalog_id } = req.body;

  const rating = computeRating(rating_plot, rating_art, rating_writing);

  db.prepare(`UPDATE comics SET title=?,publisher=?,writer=?,artist=?,issue_num=?,shelf=?,
    rating_plot=?,rating_art=?,rating_writing=?,rating=?,
    date_read=?,review=?,tags=?,cover_color=?,cover_image=?,amazon_url=?,catalog_id=?
    WHERE id=? AND user_id=?`)
    .run(title,publisher,writer,artist,issue_num,shelf,
         rating_plot,rating_art,rating_writing,rating,
         date_read,review,JSON.stringify(tags),cover_color,cover_image,amazon_url,catalog_id,
         req.params.id,getAuth(req).userId);

  res.json(parseTags(db.prepare('SELECT * FROM comics WHERE id=?').get(req.params.id)));
});

app.delete('/api/comics/:id', apiAuth, (req, res) => {
  const r = db.prepare('DELETE FROM comics WHERE id=? AND user_id=?').run(req.params.id, getAuth(req).userId);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

app.get('/api/stats', apiAuth, (req, res) => {
  const uid = getAuth(req).userId;
  const read    = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='read'").get(uid).n;
  const reading = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='reading'").get(uid).n;
  const want    = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='want'").get(uid).n;
  const avg     = db.prepare("SELECT AVG(rating) a FROM comics WHERE user_id=? AND rating>0 AND shelf='read'").get(uid).a;
  const avgPlot = db.prepare("SELECT AVG(rating_plot) a FROM comics WHERE user_id=? AND rating_plot>0 AND shelf='read'").get(uid).a;
  const avgArt  = db.prepare("SELECT AVG(rating_art) a FROM comics WHERE user_id=? AND rating_art>0 AND shelf='read'").get(uid).a;
  const avgWriting = db.prepare("SELECT AVG(rating_writing) a FROM comics WHERE user_id=? AND rating_writing>0 AND shelf='read'").get(uid).a;
  const topPub  = db.prepare("SELECT publisher,COUNT(*) n FROM comics WHERE user_id=? AND publisher!='' GROUP BY publisher ORDER BY n DESC LIMIT 1").get(uid);
  res.json({
    read, reading, want,
    avg_rating: avg ? +avg.toFixed(1) : null,
    avg_plot: avgPlot ? +avgPlot.toFixed(1) : null,
    avg_art: avgArt ? +avgArt.toFixed(1) : null,
    avg_writing: avgWriting ? +avgWriting.toFixed(1) : null,
    top_publisher: topPub?.publisher || null
  });
});

// ── Follows ───────────────────────────────────────────────────────────────────

app.post('/api/follow/:alias', apiAuth, (req, res) => {
  const me = getAuth(req).userId;
  const target = db.prepare('SELECT user_id FROM alias WHERE alias=?').get(req.params.alias.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.user_id === me) return res.status(400).json({ error: 'Cannot follow yourself' });

  const already = db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(me, target.user_id);
  if (already) return res.json({ following: true });

  db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?,?)').run(me, target.user_id);
  db.prepare('INSERT INTO notifications (user_id, type, actor_id) VALUES (?,?,?)').run(target.user_id, 'new_follower', me);
  res.json({ following: true });
});

app.delete('/api/follow/:alias', apiAuth, (req, res) => {
  const me = getAuth(req).userId;
  const target = db.prepare('SELECT user_id FROM alias WHERE alias=?').get(req.params.alias.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').run(me, target.user_id);
  res.json({ following: false });
});

app.get('/api/following', apiAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT a.alias, a.user_id,
           (SELECT COUNT(*) FROM comics WHERE user_id=a.user_id AND shelf='read') as read_count
    FROM follows f
    JOIN alias a ON a.user_id = f.following_id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
  `).all(getAuth(req).userId);
  res.json(rows);
});

app.get('/api/followers', apiAuth, (req, res) => {
  const uid = getAuth(req).userId;
  const rows = db.prepare(`
    SELECT a.alias, a.user_id,
           (SELECT COUNT(*) FROM comics WHERE user_id=a.user_id AND shelf='read') as read_count,
           (SELECT 1 FROM follows WHERE follower_id=? AND following_id=a.user_id) as i_follow_back
    FROM follows f
    JOIN alias a ON a.user_id = f.follower_id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
  `).all(uid, uid);
  res.json(rows);
});

app.get('/api/feed', apiAuth, (req, res) => {
  const uid = getAuth(req).userId;
  const rows = db.prepare(`
    SELECT c.id, c.title, c.publisher, c.issue_num, c.rating, c.rating_plot, c.rating_art, c.rating_writing,
           c.cover_color, c.cover_image,
           c.date_read, c.review, c.shelf, c.created_at, c.user_id,
           a.alias
    FROM comics c
    JOIN follows f ON f.following_id = c.user_id
    JOIN alias a   ON a.user_id = c.user_id
    WHERE f.follower_id = ?
      AND c.shelf IN ('read','reading')
    ORDER BY c.created_at DESC
    LIMIT 40
  `).all(uid).map(parseTags);
  res.json(rows);
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get('/api/notifications/count', apiAuth, (req, res) => {
  const n = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0').get(getAuth(req).userId);
  res.json({ count: n.n });
});

app.get('/api/notifications', apiAuth, (req, res) => {
  const uid = getAuth(req).userId;
  const rows = db.prepare(`
    SELECT n.*, a.alias as actor_alias
    FROM notifications n
    LEFT JOIN alias a ON a.user_id = n.actor_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 30
  `).all(uid);

  db.prepare('UPDATE notifications SET read=1 WHERE user_id=? AND read=0').run(uid);
  res.json(rows);
});

// ── Public profile ─────────────────────────────────────────────────────────────
app.get('/api/profile/:alias', (req, res) => {
  const aliasRow = db.prepare('SELECT user_id FROM alias WHERE alias=?').get(req.params.alias.toLowerCase());
  if (!aliasRow) return res.status(404).json({ error: 'Hero not found' });

  const uid = aliasRow.user_id;
  const viewerId = getAuth(req)?.userId || null;

  const read    = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='read'").get(uid).n;
  const reading = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='reading'").get(uid).n;
  const want    = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='want'").get(uid).n;
  const avg     = db.prepare("SELECT AVG(rating) a FROM comics WHERE user_id=? AND rating>0 AND shelf='read'").get(uid).a;
  const topPub  = db.prepare("SELECT publisher,COUNT(*) n FROM comics WHERE user_id=? AND publisher!='' GROUP BY publisher ORDER BY n DESC LIMIT 1").get(uid);

  const followerCount  = db.prepare('SELECT COUNT(*) n FROM follows WHERE following_id=?').get(uid).n;
  const followingCount = db.prepare('SELECT COUNT(*) n FROM follows WHERE follower_id=?').get(uid).n;
  const viewerFollows  = viewerId
    ? !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(viewerId, uid)
    : false;

  const recent = db.prepare(`
    SELECT id,title,publisher,issue_num,rating,rating_plot,rating_art,rating_writing,cover_color,cover_image,date_read,review
    FROM comics WHERE user_id=? AND shelf='read'
    ORDER BY date_read DESC, created_at DESC LIMIT 8
  `).all(uid).map(parseTags);

  const favourites = db.prepare(`
    SELECT id,title,publisher,issue_num,rating,cover_color,cover_image
    FROM comics WHERE user_id=? AND shelf='read' AND rating>=4.5
    ORDER BY rating DESC, date_read DESC LIMIT 6
  `).all(uid).map(parseTags);

  const currentlyReading = db.prepare(`
    SELECT id,title,publisher,issue_num,cover_color,cover_image
    FROM comics WHERE user_id=? AND shelf='reading'
    ORDER BY created_at DESC LIMIT 4
  `).all(uid).map(parseTags);

  res.json({
    alias: req.params.alias.toLowerCase(),
    stats: { read, reading, want, avg_rating: avg ? +avg.toFixed(1) : null, top_publisher: topPub?.publisher || null },
    follower_count: followerCount,
    following_count: followingCount,
    viewer_follows: viewerFollows,
    is_own_profile: viewerId === uid,
    recent,
    favourites,
    currently_reading: currentlyReading,
  });
});

app.listen(PORT, () => console.log(`\n⚡ EXCELSIOR! API → http://localhost:${PORT}\n`));
