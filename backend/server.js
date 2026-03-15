const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { ClerkExpressRequireAuth, ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

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
    rating        INTEGER NOT NULL DEFAULT 0
                          CHECK(rating BETWEEN 0 AND 5),
    date_read     TEXT    NOT NULL DEFAULT '',
    review        TEXT    NOT NULL DEFAULT '',
    tags          TEXT    NOT NULL DEFAULT '[]',
    cover_color   TEXT    NOT NULL DEFAULT '#b30000',
    cover_image   TEXT    NOT NULL DEFAULT '',
    amazon_url    TEXT    NOT NULL DEFAULT '',
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
`);

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseTags = row => {
  try { row.tags = JSON.parse(row.tags); } catch { row.tags = []; }
  return row;
};

// Enrich a list of comics/activity rows with actor alias
const withAlias = (rows) => rows.map(row => {
  const a = db.prepare('SELECT alias FROM alias WHERE user_id = ?').get(row.user_id || row.actor_id);
  return { ...row, alias: a?.alias || null };
});

// ── Auth ──────────────────────────────────────────────────────────────────────
const requireAuth = ClerkExpressRequireAuth();
const withAuth    = ClerkExpressWithAuth();

// ── Alias ─────────────────────────────────────────────────────────────────────
app.get('/api/alias/check/:alias', (req, res) => {
  const row = db.prepare('SELECT user_id FROM alias WHERE alias = ?').get(req.params.alias.toLowerCase());
  res.json({ available: !row });
});

app.post('/api/alias', requireAuth, (req, res) => {
  const userId = req.auth.userId;
  const { alias } = req.body;
  if (!alias || alias.length < 2 || alias.length > 30)
    return res.status(400).json({ error: 'Alias must be 2–30 characters' });
  const clean = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (clean !== alias.toLowerCase())
    return res.status(400).json({ error: 'Only letters, numbers, _ and - allowed' });
  const existing = db.prepare('SELECT user_id FROM alias WHERE alias = ?').get(clean);
  if (existing) return res.status(409).json({ error: 'That alias is already taken' });
  db.prepare('INSERT OR REPLACE INTO alias (user_id, alias) VALUES (?,?)').run(userId, clean);
  res.json({ alias: clean });
});

app.get('/api/alias/mine', requireAuth, (req, res) => {
  const row = db.prepare('SELECT alias FROM alias WHERE user_id = ?').get(req.auth.userId);
  res.json({ alias: row?.alias || null });
});

// ── Comics ─────────────────────────────────────────────────────────────────────
app.get('/api/comics', requireAuth, (req, res) => {
  const { shelf, sort = 'created_at', order = 'desc' } = req.query;
  const safeSort  = ['created_at','date_read','title','rating'].includes(sort) ? sort : 'created_at';
  const safeOrder = ['asc','desc'].includes(order) ? order : 'desc';
  const uid = req.auth.userId;
  if (shelf && ['read','reading','want'].includes(shelf)) {
    return res.json(
      db.prepare(`SELECT * FROM comics WHERE user_id=? AND shelf=? ORDER BY ${safeSort} ${safeOrder}`)
        .all(uid, shelf).map(parseTags)
    );
  }
  res.json(db.prepare(`SELECT * FROM comics WHERE user_id=? ORDER BY ${safeSort} ${safeOrder}`).all(uid).map(parseTags));
});

app.get('/api/comics/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM comics WHERE id=? AND user_id=?').get(req.params.id, req.auth.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(parseTags(row));
});

app.post('/api/comics', requireAuth, (req, res) => {
  const { title, publisher='', writer='', artist='', issue_num='', shelf='read',
          rating=0, date_read='', review='', tags=[], cover_color='#b30000',
          cover_image='', amazon_url='' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const result = db.prepare(`
    INSERT INTO comics (user_id,title,publisher,writer,artist,issue_num,shelf,rating,date_read,review,tags,cover_color,cover_image,amazon_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.auth.userId, title, publisher, writer, artist, issue_num, shelf, rating,
         date_read, review, JSON.stringify(tags), cover_color, cover_image, amazon_url);

  // Notify followers of new read entry
  if (shelf === 'read') {
    const followers = db.prepare('SELECT follower_id FROM follows WHERE following_id=?').all(req.auth.userId);
    const notifStmt = db.prepare('INSERT INTO notifications (user_id, type, actor_id, entity_id) VALUES (?,?,?,?)');
    for (const f of followers) notifStmt.run(f.follower_id, 'new_read', req.auth.userId, result.lastInsertRowid);
  }

  res.status(201).json(parseTags(db.prepare('SELECT * FROM comics WHERE id=?').get(result.lastInsertRowid)));
});

app.put('/api/comics/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM comics WHERE id=? AND user_id=?').get(req.params.id, req.auth.userId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title=existing.title, publisher=existing.publisher, writer=existing.writer,
          artist=existing.artist, issue_num=existing.issue_num, shelf=existing.shelf,
          rating=existing.rating, date_read=existing.date_read, review=existing.review,
          tags=JSON.parse(existing.tags||'[]'), cover_color=existing.cover_color,
          cover_image=existing.cover_image, amazon_url=existing.amazon_url } = req.body;
  db.prepare(`UPDATE comics SET title=?,publisher=?,writer=?,artist=?,issue_num=?,shelf=?,rating=?,date_read=?,review=?,tags=?,cover_color=?,cover_image=?,amazon_url=? WHERE id=? AND user_id=?`)
    .run(title,publisher,writer,artist,issue_num,shelf,rating,date_read,review,
         JSON.stringify(tags),cover_color,cover_image,amazon_url,req.params.id,req.auth.userId);
  res.json(parseTags(db.prepare('SELECT * FROM comics WHERE id=?').get(req.params.id)));
});

app.delete('/api/comics/:id', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM comics WHERE id=? AND user_id=?').run(req.params.id, req.auth.userId);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

app.get('/api/stats', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  const read    = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='read'").get(uid).n;
  const reading = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='reading'").get(uid).n;
  const want    = db.prepare("SELECT COUNT(*) n FROM comics WHERE user_id=? AND shelf='want'").get(uid).n;
  const avg     = db.prepare("SELECT AVG(rating) a FROM comics WHERE user_id=? AND rating>0 AND shelf='read'").get(uid).a;
  const topPub  = db.prepare("SELECT publisher,COUNT(*) n FROM comics WHERE user_id=? AND publisher!='' GROUP BY publisher ORDER BY n DESC LIMIT 1").get(uid);
  res.json({ read, reading, want, avg_rating: avg ? +avg.toFixed(1) : null, top_publisher: topPub?.publisher || null });
});

// ── Follows ───────────────────────────────────────────────────────────────────

// Follow a user by alias
app.post('/api/follow/:alias', requireAuth, (req, res) => {
  const me = req.auth.userId;
  const target = db.prepare('SELECT user_id FROM alias WHERE alias=?').get(req.params.alias.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.user_id === me) return res.status(400).json({ error: 'Cannot follow yourself' });

  const already = db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(me, target.user_id);
  if (already) return res.json({ following: true }); // idempotent

  db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?,?)').run(me, target.user_id);

  // Notify the followed user
  db.prepare('INSERT INTO notifications (user_id, type, actor_id) VALUES (?,?,?)').run(target.user_id, 'new_follower', me);

  res.json({ following: true });
});

// Unfollow
app.delete('/api/follow/:alias', requireAuth, (req, res) => {
  const me = req.auth.userId;
  const target = db.prepare('SELECT user_id FROM alias WHERE alias=?').get(req.params.alias.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').run(me, target.user_id);
  res.json({ following: false });
});

// Get my following list
app.get('/api/following', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT a.alias, a.user_id,
           (SELECT COUNT(*) FROM comics WHERE user_id=a.user_id AND shelf='read') as read_count
    FROM follows f
    JOIN alias a ON a.user_id = f.following_id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
  `).all(req.auth.userId);
  res.json(rows);
});

// Get my followers list
app.get('/api/followers', requireAuth, (req, res) => {
  const uid = req.auth.userId;
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

// Activity feed — recent comics logged by people I follow
app.get('/api/feed', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  const rows = db.prepare(`
    SELECT c.id, c.title, c.publisher, c.issue_num, c.rating, c.cover_color, c.cover_image,
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

// Get unread count
app.get('/api/notifications/count', requireAuth, (req, res) => {
  const n = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0').get(req.auth.userId);
  res.json({ count: n.n });
});

// Get all notifications (marks them read)
app.get('/api/notifications', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  const rows = db.prepare(`
    SELECT n.*, a.alias as actor_alias
    FROM notifications n
    LEFT JOIN alias a ON a.user_id = n.actor_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 30
  `).all(uid);

  // Mark all as read
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=? AND read=0').run(uid);

  res.json(rows);
});

// ── Public profile ─────────────────────────────────────────────────────────────
app.get('/api/profile/:alias', withAuth, (req, res) => {
  const aliasRow = db.prepare('SELECT user_id FROM alias WHERE alias=?').get(req.params.alias.toLowerCase());
  if (!aliasRow) return res.status(404).json({ error: 'Hero not found' });

  const uid = aliasRow.user_id;
  const viewerId = req.auth?.userId || null;

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
    SELECT id,title,publisher,issue_num,rating,cover_color,cover_image,date_read,review
    FROM comics WHERE user_id=? AND shelf='read'
    ORDER BY date_read DESC, created_at DESC LIMIT 8
  `).all(uid).map(parseTags);

  const favourites = db.prepare(`
    SELECT id,title,publisher,issue_num,rating,cover_color,cover_image
    FROM comics WHERE user_id=? AND shelf='read' AND rating=5
    ORDER BY date_read DESC LIMIT 6
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
