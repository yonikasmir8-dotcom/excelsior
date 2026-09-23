# ♞ GameKnight — Football Prediction Market

GameKnight is a **play-money** prediction market for football. Fans buy and sell shares in match outcomes. Each winning share pays **1 Knight Coin (KC)**, so a share's price is the crowd's implied probability. For example, Arsenal at 59% means the market gives them a 59% chance.

> Knight Coins have no cash value. They can't be bought, sold or withdrawn, and no real-money wagering happens here. Taking real money would need a gambling licence (e.g. UK Gambling Commission), KYC/age verification and responsible-gambling tooling. None of that is in this codebase.

## Features

- **Three markets per fixture:** match result (1X2), total goals over/under 2.5, and both teams to score.
- **LMSR automated market maker** (`backend/lmsr.js`). There is always a counterparty and prices always sum to 100%. Liquidity `b` caps the house subsidy at `b·ln(n)` per market.
- **Buy with a coin stake, sell shares any time before kick-off.** Every trade shows a live quote first: shares, average price, price impact and payout.
- **Settlement from the final score.** An admin enters the score and all three markets pay out. **Void** refunds the remaining cost basis (for postponed matches).
- **Portfolio:** cash, mark-to-market positions, unrealised and realised P&L.
- **League table:** managers ranked by profit (net worth minus coins received).
- **Price history chart**, live trade feed, and decimal odds next to every price.
- **Daily +100 KC bonus**, 1,000 KC starting balance.
- **Admin panel** to create fixtures with opening odds and to settle or void them.
- Mobile-first layout with a bottom tab bar.
- **Demo seed:** 10 upcoming fixtures across the Premier League, La Liga, Serie A, Bundesliga and the Champions League, plus one settled match and six bot traders.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, plain JSX, inline styles, hash routing |
| Backend | Node + Express, SQLite via `better-sqlite3` |
| Auth | Username + password (scrypt), bearer session tokens |

## Run locally

```bash
# Terminal 1 — API on :4000 (creates + seeds gameknight.db on first run)
cd gameknight/backend && cp .env.example .env && npm install && npm start

# Terminal 2 — UI on :5174 (proxies /api to :4000)
cd gameknight/frontend && npm install && npm run dev
```

Open http://localhost:5174 and register. With the default `.env`, the username **`admin`** gets admin rights. If `ADMIN_USERS` is empty, the first account registered becomes admin instead.

Tests (LMSR maths and the full create → trade → settle/void lifecycle):

```bash
cd gameknight/backend && npm test
```

## Single-service deploy

The backend serves `frontend/dist` if it exists, so one service is enough:

```bash
cd gameknight/frontend && npm install && npm run build
cd ../backend && npm install && npm start
```

On Railway or Render, set the root to `gameknight`. Use `npm --prefix frontend ci && npm --prefix frontend run build && npm --prefix backend ci` as the build command and `npm --prefix backend start` as the start command. Mount a volume and point `DB_PATH` at it so the SQLite file survives redeploys.

## API

| Method | Route | Auth | |
|---|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` | — / — / ✓ | |
| GET | `/api/me` | ✓ | balance, net worth, profit |
| POST | `/api/me/bonus` | ✓ | claim daily 100 KC |
| GET | `/api/fixtures?state=open\|awaiting\|settled\|void\|all&competition=` | | fixtures + market prices |
| GET | `/api/fixtures/:id` | optional | markets, price history, recent trades, your positions |
| POST | `/api/markets/:id/quote` | ✓ | `{outcomeId, side:'buy', amount}` or `{outcomeId, side:'sell', shares}`, no side-effects |
| POST | `/api/markets/:id/trade` | ✓ | same body; executes |
| GET | `/api/portfolio` · `/api/leaderboard` · `/api/activity` · `/api/competitions` | ✓ / — / — / — | |
| POST | `/api/admin/fixtures` | admin | `{competition, home, away, kickoff, probs:{home,draw,away,over25,btts}, liquidity}` |
| POST | `/api/admin/fixtures/:id/settle` | admin | `{home_score, away_score}` |
| POST | `/api/admin/fixtures/:id/void` | admin | refunds cost basis |

## Ideas for next

- Pull fixtures and results automatically from a football data API (e.g. football-data.org) instead of the admin panel.
- More markets: correct score, first goalscorer, Asian handicap, season outrights (title winner, relegation).
- In-play trading with live match events.
- Private leagues with friends and weekly leaderboards.
- Rate limiting on auth routes before a public launch.
