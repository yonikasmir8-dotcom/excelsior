// SQLite connection + schema. All money is stored as integer cents and all share
// counts as integers, so the exchange never accumulates floating-point dust.
// 1 share of the winning side redeems for 100¢ (= 1 KC).

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'gameknight.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,          -- available cash, cents
    granted INTEGER NOT NULL DEFAULT 0,          -- cash ever given (signup + bonuses), for P&L
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_bot INTEGER NOT NULL DEFAULT 0,
    is_house INTEGER NOT NULL DEFAULT 0,          -- the designated market maker
    bio TEXT NOT NULL DEFAULT '',
    last_bonus_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    label TEXT NOT NULL,
    last_used_at TEXT,
    created_at TEXT NOT NULL
  );
  -- Every change to a user's cash balance, for audit + reconciliation
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,                        -- signup | bonus | order_escrow | order_refund | fill | merge | payout
    ref TEXT,
    created_at TEXT NOT NULL
  );

  -- An event groups binary markets: a fixture ("Arsenal v Chelsea") or an outright ("Premier League winner")
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,                          -- match | outright
    competition TEXT NOT NULL,
    title TEXT NOT NULL,
    home TEXT,
    away TEXT,
    starts_at TEXT,                              -- kick-off (match)
    closes_at TEXT NOT NULL,                     -- trading stops
    status TEXT NOT NULL DEFAULT 'open',         -- open | resolved | void
    home_score INTEGER,
    away_score INTEGER,
    external_id TEXT UNIQUE,                     -- id from the fixtures feed
    description TEXT NOT NULL DEFAULT '',
    resolved_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS markets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                          -- HOME | DRAW | AWAY | OVER15 | OVER25 | OVER35 | BTTS | TEAM
    label TEXT NOT NULL,                         -- short name, e.g. "Arsenal"
    question TEXT NOT NULL,                      -- "Will Arsenal beat Chelsea?"
    rules TEXT NOT NULL,
    grp TEXT NOT NULL,                           -- display group: result | goals | btts | winner
    status TEXT NOT NULL DEFAULT 'open',         -- open | resolved | void
    outcome TEXT,                                -- YES | NO | VOID
    fair INTEGER NOT NULL,                       -- house market maker's current mid, cents
    last_price INTEGER NOT NULL,                 -- last traded YES price, cents
    sort INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  -- Resting + historical orders. book_side/book_price express every order on the single YES book:
  --   buy YES @p  → bid @p        sell YES @p → ask @p
  --   sell NO @q  → bid @(100-q)  buy NO @q  → ask @(100-q)
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL,                       -- YES | NO
    side TEXT NOT NULL,                          -- buy | sell
    price INTEGER NOT NULL,                      -- limit, in the order's own outcome, cents
    size INTEGER NOT NULL,
    filled INTEGER NOT NULL DEFAULT 0,
    book_side TEXT NOT NULL,                     -- bid | ask
    book_price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',         -- open | filled | cancelled
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,                      -- YES price, cents
    size INTEGER NOT NULL,
    notional INTEGER NOT NULL,                   -- cents that changed hands on the taker's side
    taker_id INTEGER NOT NULL,
    maker_id INTEGER NOT NULL,
    taker_outcome TEXT NOT NULL,
    taker_side TEXT NOT NULL,
    maker_outcome TEXT NOT NULL,
    maker_side TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS positions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    yes INTEGER NOT NULL DEFAULT 0,
    no INTEGER NOT NULL DEFAULT 0,
    yes_cost INTEGER NOT NULL DEFAULT 0,         -- remaining cost basis, cents
    no_cost INTEGER NOT NULL DEFAULT 0,
    realized INTEGER NOT NULL DEFAULT 0,         -- realised P&L, cents
    PRIMARY KEY (user_id, market_id)
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_book ON orders(market_id, status, book_side, book_price, id);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id, id);
  CREATE INDEX IF NOT EXISTS idx_trades_time ON trades(created_at);
  CREATE INDEX IF NOT EXISTS idx_history ON price_history(market_id, id);
  CREATE INDEX IF NOT EXISTS idx_markets_event ON markets(event_id, sort);
  CREATE INDEX IF NOT EXISTS idx_comments_event ON comments(event_id, id);
  CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, id);
`);

module.exports = db;
