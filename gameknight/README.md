# Game Knight: Football Opinions Exchange

*Your Insights. Your Opinions. Your Win!*

A Polymarket-style prediction exchange built only for football. Fans buy and sell **YES/NO shares** on match results, goal lines and season outrights. The price of a YES share is the market's probability: **54¢ means 54%**. A winning share redeems for 100¢ (1 KC).

> **Play money.** Knight Coins (KC) have no cash value. They can't be bought, sold or withdrawn, and no real-money wagering happens here. See [Going real-money](#going-real-money) for what that would take.

## What makes it viable from day one

| | |
|---|---|
| **Central limit order book** | One book per binary market, with price-time priority. It supports limit orders (resting), market orders (immediate-or-cancel), post-only orders and self-trade prevention. YES and NO trade against each other, minting and merging pairs, so both sides share one pool of liquidity. |
| **House market maker** | This solves the cold-start problem. A designated market maker quotes a three-level ladder (1¢/3¢/6¢ from its fair value) on every market from the moment it's listed. Its fair value follows order flow. In mutually exclusive groups (1X2, title winner) the prices are renormalised to sum to ~100%. It never crosses users, so traders can always step in front of it. |
| **Coherent opening odds** | Match markets open from an independent-Poisson goals model on each side's expected goals. 1X2, O/U 1.5/2.5/3.5 and BTTS are consistent with each other from the first second. |
| **Live data feed** | With `FOOTBALL_DATA_TOKEN` set, upcoming fixtures from the Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the Champions League are listed automatically. They resolve from the official 90-minute score, and postponed or abandoned matches are voided at 50/50. No admin work is needed. |
| **Trading API** | API keys, a REST API for every action, dry-run order previews and a Server-Sent Events stream. External market makers and bots can plug in (`#/docs` in the app). |
| **Correct money** | All cash is integer cents and every balance change is written to a ledger. An admin health check confirms balance = Σ ledger and YES outstanding = NO outstanding in every market. A 1,500-order fuzz test asserts conservation of money. |
| **Social + discovery** | Trending, volume, liquidity and ending-soon sorting. Search and competition filters. Comments showing each commenter's position, top holders, activity feeds, public profiles, and profit and volume leaderboards. |
| **Live UI** | Prices, charts, order books, comments and balances update in real time over SSE. Mobile-first, with a bottom-sheet trade ticket. |

### Markets

- **Every match (7 markets):** Home win · Draw · Away win · Over 1.5 · Over 2.5 · Over 3.5 · Both teams to score. All settle on the 90-minute score, with extra time and penalties excluded.
- **Outrights:** a title winner, Champions League winner, Golden Boot or any custom event, with one binary market per contender. An admin can eliminate a contender early or resolve the winner.

## Design

The UI follows the Game Knight pitch deck:

- **Brand:** true-black canvas with a purple cast, `#171717` cards on `#303030` strips, magenta `#d103e6` for the backed outcome and the active tab, green for Buy and profit, red for loss, Helvetica-style bold type, and the magenta footballer logo.
- **Navigation:** the deck's five tabs, *News · Calendar · Home · Opinions · Profile*, with a "Hey, {name}" header, white search bar and ✦ insights bar.
- **Screens:**
  - **Simple Yes/No:** opinion cards with the Players and Ends-in strip, price boxes (₭0.49 per unit) and club-colour tiles.
  - **Opinion detail:** # of Units → Potential Win → Buy, the Yes/No Opinions Graph, News Sources, Opinion Rules and Related Opinions.
  - **Tailored:** follow #teams, #players and #leagues.
  - **Complete stack:** fixtures calendar with Add to My Calendar.
  - **Shareability:** a news wire with share buttons.
  - **Transparency:** Profit, Invested and Closing on every opinion.
- **Trading depth:** power features (order book, limit orders, selling) sit behind "Advanced" on each opinion.

Prices are shown in Knight Coins (₭). One winning unit pays ₭1.00, and the API still works in integer hundredths.

## Club crests

Crests come from [football-logos.cc](https://football-logos.cc) via the MIT-licensed `football-logos` package.

- **Mapping:** `frontend/scripts/gen-crests.mjs` maps every club in the top five leagues, the Championship and UEFA competitions to its crest URL, writing `src/crests.json` (18 KB).
- **Where they load:** the hosted app loads crests in the fan's browser. The phone build embeds 96px copies whenever the build machine can reach the crest host.
- **Fallback:** anything missing falls back to a club-colour shield with the club's three-letter code.

**Licensing:** club crests and league marks are trademarks. Using them in a commercial product (especially one with prices on outcomes) needs rights from the clubs or leagues, or a data provider licence that includes them. Clear this before a public launch.

## Run it on a phone (no server)

```bash
node standalone/build.mjs     # → frontend/dist-standalone/gameknight.html (~2 MB, one file)
```

The whole exchange runs inside the phone's browser:

- the unchanged backend is bundled with sql.js (SQLite in JavaScript) and small browser shims for express and crypto
- it ships with a pre-seeded database and saves to IndexedDB
- it auto-settles matches with simulated scores and lists new fixtures, so the demo stays alive

The hosted version is also an installable PWA (manifest, icons, service worker).

## Architecture

```
backend/
  db.js           schema (SQLite, WAL, integer cents)
  exchange.js     order book, matching engine, escrow, mint/merge, resolution
  events.js       market templates, Poisson odds model, match/outright resolution
  marketmaker.js  house liquidity
  feed.js         football-data.org fixtures + results
  server.js       REST API, auth, API keys, SSE, rate limiting, admin
  seed.js         demo data (15 fixtures, 3 outrights, a week of bot trading)
  test/           exchange unit + fuzz tests, API end-to-end tests
frontend/src/
  HomePage        market grid, search, filters
  EventPage       chart, market rows with Buy Yes / Buy No, order book, comments/activity/holders/rules
  TradeWidget     Buy/Sell × Market/Limit × Yes/No ticket with live server preview
  OrderBook, PriceChart, PortfolioPage, LeaderboardPage, ProfilePage, SettingsPage (API keys), DocsPage, AdminPage
```

### The one-book trick

Every order is expressed on the YES book:

| Order | Book side | Book price |
|---|---|---|
| buy YES @ p | bid | p |
| sell YES @ p | ask | p |
| buy NO @ q | ask | 100 − q |
| sell NO @ q | bid | 100 − q |

When a bid meets an ask at YES price P, one of four things happens:

- **Transfer (YES):** buy YES × sell YES. YES shares move from seller to buyer.
- **Mint:** buy YES × buy NO. A new pair is created; the buyers pay P and 100 − P.
- **Merge:** sell NO × sell YES. A pair is destroyed; the sellers receive 100 − P and P.
- **Transfer (NO):** sell NO × buy NO. NO shares move from seller to buyer.

Anyone who ends up holding both YES and NO in the same market has the pair merged back into cash automatically.

## Run locally

```bash
# Terminal 1 — API on :4000 (creates + seeds gameknight.db on first run)
cd gameknight/backend && cp .env.example .env && npm install && npm start

# Terminal 2 — UI on :5174 (proxies /api to :4000)
cd gameknight/frontend && npm install && npm run dev
```

Register as **`admin`** to get the admin panel. To use real fixtures instead of demo data, add a free football-data.org key as `FOOTBALL_DATA_TOKEN`.

```bash
cd gameknight/backend && npm test   # exchange, fuzz, API and feed tests
```

## Deploy (single service)

The backend serves `frontend/dist` itself:

```bash
npm --prefix frontend ci && npm --prefix frontend run build && npm --prefix backend ci   # build
npm --prefix backend start                                                              # start
```

On Railway, Render or Fly, set the root to `gameknight`, mount a volume and point `DB_PATH` at it. Run a single instance: the matching engine is in-process, and SQLite is the source of truth.

## Scaling notes

The current single-process design handles thousands of users. Beyond that:

- **Leaderboard:** move it to a periodic materialised table. It currently marks every account to market per request.
- **Database:** migrate from SQLite to Postgres. The SQL is standard, and each order already runs in one transaction.
- **Matching:** run one matching worker per market shard.
- **Live stream:** fan SSE out through Redis pub/sub.

## Going real-money

Competing with Polymarket for cash is a licensing problem, not a code problem. Sports event contracts are regulated as gambling or derivatives almost everywhere:

- **UK:** Gambling Commission operating licence (betting intermediary / betting exchange).
- **US:** a CFTC-registered DCM (Kalshi's route), or state sportsbook licences.
- **EU:** national licences.

A real-money version also needs KYC and age verification, geofencing, AML monitoring, segregated customer funds, responsible-gambling tools (deposit limits, self-exclusion, GAMSTOP) and integrity monitoring with the leagues.

The exchange engine is currency-agnostic, and the ledger was built to be auditable. The payments, identity and compliance layers are deliberately not included.
