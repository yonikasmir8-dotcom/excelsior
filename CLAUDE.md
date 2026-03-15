# EXCELSIOR! — Comic Book Tracker
> Claude Code project memory. Read this before every session.

---

## What This Is

Excelsior! is a Letterboxd-style comic book tracker. Users log comics they've read, rate them, write reviews, follow friends, and click Amazon affiliate links to buy comics. The platform earns revenue via Amazon Associates (~4% commission per purchase).

**Live status:** Not yet deployed — deployment is the immediate goal.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, plain JSX (no TypeScript), inline styles throughout |
| Backend | Node.js + Express, single `server.js` file |
| Database | SQLite via `better-sqlite3` — file at `backend/excelsior.db` |
| Auth | Clerk (frontend: `@clerk/clerk-react`, backend: `@clerk/clerk-sdk-node`) |
| Affiliate | Amazon Associates — affiliate tag in `VITE_AMAZON_TAG` env var |
| Cover images | Open Library API (free, no key needed) |
| Hosting target | Backend → Railway, Frontend → Vercel |

---

## Project Structure

```
excelsior-v2/
├── CLAUDE.md                   ← you are here
├── backend/
│   ├── server.js               ← entire API in one file
│   ├── package.json
│   ├── .env.example            ← copy to .env before running
│   ├── .env                    ← never commit this
│   └── excelsior.db            ← auto-created on first run
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── .env.example            ← copy to .env before running
    ├── .env                    ← never commit this
    └── src/
        ├── main.jsx            ← entry point, ClerkProvider wrapper
        ├── App.jsx             ← hash router (#/u/:alias for public profiles)
        ├── styles.css          ← global CSS + Clerk component overrides
        ├── api.js              ← all API calls, Amazon URL builder, cover fetch
        ├── AuthPage.jsx        ← landing page, sign in / sign up
        ├── AliasSetup.jsx      ← "choose your secret identity" onboarding
        ├── MainApp.jsx         ← main app: Diary, Collection, Friends, Stats
        ├── ComicModal.jsx      ← add/edit comic (bottom sheet on mobile)
        ├── DetailModal.jsx     ← comic detail + Amazon buy button
        ├── FriendsFeed.jsx     ← activity feed, following, followers, notifs
        └── PublicProfile.jsx   ← public profile page at #/u/:alias
```

---

## Running Locally

Always run backend and frontend in separate terminals.

```bash
# Terminal 1 — Backend
cd backend
npm install
node server.js
# Starts at http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# Starts at http://localhost:5173
```

**Check it's working:** Visit http://localhost:5173 — the top bar should show a green dot confirming API connection.

---

## Environment Variables

### backend/.env
```
CLERK_SECRET_KEY=sk_test_...        # from dashboard.clerk.com → API Keys
FRONTEND_URL=http://localhost:5173  # change to Vercel URL after deploy
PORT=3001
```

### frontend/.env
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # from dashboard.clerk.com → API Keys
VITE_API_URL=http://localhost:3001/api   # change to Railway URL after deploy
VITE_AMAZON_TAG=excelsior-20             # from affiliate-program.amazon.com
```

**Never commit .env files. They are in .gitignore.**

---

## API Routes

All authenticated routes require `Authorization: Bearer <clerk_token>` header.
Public routes marked with 🌐.

### Alias
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/alias/check/:alias` | 🌐 | Check alias availability |
| POST | `/api/alias` | ✓ | Set user alias |
| GET | `/api/alias/mine` | ✓ | Get my alias |

### Comics
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/comics` | ✓ | List my comics (`?shelf=read/reading/want`) |
| GET | `/api/comics/:id` | ✓ | Get single comic |
| POST | `/api/comics` | ✓ | Create comic |
| PUT | `/api/comics/:id` | ✓ | Update comic |
| DELETE | `/api/comics/:id` | ✓ | Delete comic |
| GET | `/api/stats` | ✓ | My stats summary |

### Social
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/follow/:alias` | ✓ | Follow a user |
| DELETE | `/api/follow/:alias` | ✓ | Unfollow |
| GET | `/api/following` | ✓ | My following list |
| GET | `/api/followers` | ✓ | My followers list |
| GET | `/api/feed` | ✓ | Activity feed from people I follow |
| GET | `/api/notifications/count` | ✓ | Unread notification count |
| GET | `/api/notifications` | ✓ | All notifications (marks as read) |

### Public
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/profile/:alias` | 🌐 (optional) | Public profile data |

---

## Database Schema

SQLite file at `backend/excelsior.db`. Tables:

**comics** — user comic entries
- `id`, `user_id` (Clerk user ID), `title`, `publisher`, `writer`, `artist`
- `issue_num`, `shelf` (read/reading/want), `rating` (0-5)
- `date_read`, `review`, `tags` (JSON array), `cover_color`, `cover_image`, `amazon_url`
- `created_at`, `updated_at`

**alias** — user aliases (secret identities)
- `user_id` (PK), `alias` (unique), `created_at`

**follows** — social graph
- `follower_id`, `following_id` (composite PK), `created_at`

**notifications** — new follower / new read events
- `id`, `user_id`, `type` (new_follower/new_read), `actor_id`, `entity_id`, `read` (0/1), `created_at`

---

## Key Design Decisions

- **Inline styles everywhere** — no CSS framework, no Tailwind. All styling is inline JSX. Do not introduce external CSS libraries.
- **Single server.js** — the entire backend is one file. Keep it that way unless it grows past ~500 lines.
- **Hash routing** — the app uses `window.location.hash` for routing (e.g. `#/u/alias`). There is no React Router. Do not add one.
- **No TypeScript** — plain JSX throughout. Do not add TypeScript.
- **Mobile-first modals** — ComicModal and DetailModal are bottom sheets (slide up from bottom) on all screen sizes.
- **isMobile hook** — `useIsMobile()` in MainApp.jsx detects `window.innerWidth <= 640`. Mobile gets a bottom tab bar instead of top nav.
- **Cover images** — fetched from Open Library API (free, commercial-friendly). Falls back to a coloured placeholder with halftone texture.
- **Clerk auth pattern** — frontend uses `useAuth().getToken` passed as `gt` to all API calls. Never store tokens.

---

## Deploying

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit — Excelsior! v2.1"
git remote add origin https://github.com/YOURUSERNAME/excelsior.git
git push -u origin main
```

### Step 2 — Deploy Backend to Railway
```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
railway variables set CLERK_SECRET_KEY=sk_test_...
railway variables set FRONTEND_URL=https://YOUR-VERCEL-URL.vercel.app
railway variables set PORT=3001
railway domain  # note the URL
```

### Step 3 — Deploy Frontend to Vercel
```bash
npm install -g vercel
cd frontend
vercel
# Follow prompts — set root directory to frontend
vercel env add VITE_CLERK_PUBLISHABLE_KEY
vercel env add VITE_API_URL        # = https://your-railway-url.up.railway.app/api
vercel env add VITE_AMAZON_TAG
vercel --prod
```

### Step 4 — Post-deploy checklist
- Update `FRONTEND_URL` in Railway to the Vercel production URL
- Add Vercel URL to Clerk dashboard → Domains
- Test full flow: sign up → alias → log comic → buy button → share profile

---

## Upgrading the Database (when needed)

When SQLite hits its limits (high concurrent writes, multi-server deploys), migrate to PostgreSQL:
1. Install `pg` driver: `npm install pg`
2. Replace `better-sqlite3` calls with `pg` pool queries
3. The SQL is standard — no changes needed to query logic
4. Provision PostgreSQL on Railway (free tier available)

---

## Roadmap (next features to build)

In priority order:

1. **Year in Comics stats card** — shareable page showing annual reading wrapped (Spotify Wrapped for comics). Biggest viral growth driver.
2. **New Releases feed** — pull new comics each Wednesday. Drives weekly retention and Amazon clicks.
3. **Collections / Lists** — user-curated lists like "Essential X-Men Reading Order". SEO-friendly, shareable.
4. **Pro tier** — £3-5/month subscription for custom themes, extended stats, unlimited lists.
5. **Browser extension** — "Log to Excelsior!" button on Amazon comic pages.
6. **PostgreSQL migration** — when concurrent users justify it.

---

## Business Context

- **Revenue model:** Amazon Associates affiliate links (~4% commission). Every comic detail page has a "Buy on Amazon" button.
- **Target users:** Comic book readers who want to track what they've read, discover new comics, and share their collection.
- **Growth strategy:** Public profile sharing drives word-of-mouth. Users share `excelsior.app/#/u/theiralias` on Reddit, Twitter, Discord.
- **Key metric:** Monthly active users clicking Amazon affiliate links.
- **Amazon compliance:** Every page with affiliate links must show: "We may earn a commission from purchases made via this link." Already implemented in DetailModal.jsx.

---

## Common Tasks for Claude Code

**"Add a new API route"** → Edit `backend/server.js`, add route in the appropriate section, add corresponding function to `frontend/src/api.js`

**"Add a new frontend view"** → Create `frontend/src/NewView.jsx`, import it in `MainApp.jsx`, add to the nav arrays (desktop nav + mobile BottomNav tabs), add `{view === 'newview' && <NewView />}` in the main render

**"Fix a production error"** → Paste the Railway or browser console error. Check `server.js` for backend errors, check the relevant `.jsx` file for frontend errors.

**"Deploy latest changes"** → `git add . && git commit -m "description" && git push` — Railway and Vercel auto-deploy on push once set up.

**"Add a database column"** → Add to the `CREATE TABLE IF NOT EXISTS` statement in `server.js` (SQLite adds columns on next restart if using `ALTER TABLE`, or recreate with new schema). Update affected routes and frontend.
