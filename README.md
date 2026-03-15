# ⚡ EXCELSIOR! v2 — Comic Book Tracker

A full-stack, multi-user comic book tracking platform with:
- **Clerk authentication** with "secret identity" onboarding
- **Amazon affiliate buy buttons** on every comic
- **Automatic cover art** fetched from Open Library (free, commercial-friendly)
- **User-scoped SQLite database** (easy upgrade path to PostgreSQL)
- **React + Vite frontend** with full mobile responsiveness

---

## Project Structure

```
excelsior-v2/
├── backend/
│   ├── server.js          ← Express REST API (Node.js)
│   ├── package.json
│   ├── .env.example       ← Copy to .env and fill in
│   └── excelsior.db       ← Auto-created on first run
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── .env.example       ← Copy to .env and fill in
    └── src/
        ├── main.jsx       ← Entry point + Clerk provider
        ├── App.jsx        ← Auth routing (signed in/out)
        ├── styles.css     ← Global styles + Clerk overrides
        ├── api.js         ← API calls, Amazon URL builder, cover fetch
        ├── AuthPage.jsx   ← Landing / sign-in / sign-up page
        ├── AliasSetup.jsx ← "Choose your secret identity" onboarding
        ├── MainApp.jsx    ← Main app: Diary, Collection, Stats views
        ├── ComicModal.jsx ← Add/edit comic with live cover fetch
        └── DetailModal.jsx← Detail view with Amazon buy button
```

---

## Step 1 — Get Your API Keys

### Clerk (authentication)
1. Go to [clerk.com](https://clerk.com) and create a free account
2. Create a new application — name it "Excelsior"
3. In the dashboard, go to **API Keys**
4. Copy your **Publishable Key** (`pk_test_...`) and **Secret Key** (`sk_test_...`)

### Amazon Associates (affiliate links)
1. Go to [affiliate-program.amazon.com](https://affiliate-program.amazon.com)
2. Sign up with your Amazon account
3. Your **Associate Tag** looks like `yourname-20`
4. You earn commission every time a user clicks "Buy on Amazon" and purchases

---

## Step 2 — Configure Environment Variables

**Backend** — copy `.env.example` to `.env`:
```bash
cd backend
cp .env.example .env
```
Fill in:
```env
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
FRONTEND_URL=http://localhost:5173
PORT=3001
```

**Frontend** — copy `.env.example` to `.env`:
```bash
cd frontend
cp .env.example .env
```
Fill in:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
VITE_API_URL=http://localhost:3001/api
VITE_AMAZON_TAG=your-associate-tag-20
```

---

## Step 3 — Install & Run

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm install
node server.js
# → ⚡ EXCELSIOR! API running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
# → Local: http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) — you should see the landing page.

---

## Step 4 — Deploy to Production

### Backend → Railway
1. Push your project to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo, set the **root directory** to `backend`
4. Add environment variables in Railway's dashboard (same as your `.env`)
5. Railway gives you a live URL like `https://excelsior-backend.up.railway.app`

### Frontend → Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set the **root directory** to `frontend`
3. Add environment variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` = your Clerk publishable key
   - `VITE_API_URL` = your Railway backend URL + `/api`
   - `VITE_AMAZON_TAG` = your Amazon tag
4. Vercel gives you a live URL — add a custom domain from Namecheap if you have one

### Update CORS
Once deployed, update `FRONTEND_URL` in your Railway backend env vars to your Vercel URL.

### Update Clerk
In your Clerk dashboard → **Domains**, add your Vercel production URL as an allowed origin.

---

## API Reference

All routes require a `Authorization: Bearer <clerk_token>` header.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/comics` | List user's comics |
| GET | `/api/comics?shelf=read` | Filter by shelf |
| GET | `/api/comics/:id` | Single comic |
| POST | `/api/comics` | Create comic |
| PUT | `/api/comics/:id` | Update comic |
| DELETE | `/api/comics/:id` | Delete comic |
| GET | `/api/stats` | User stats summary |
| GET | `/api/alias/mine` | Get user's alias |
| POST | `/api/alias` | Set alias |
| GET | `/api/alias/check/:alias` | Check availability (no auth) |

### Comic object shape
```json
{
  "id": 1,
  "user_id": "user_clerk_id",
  "title": "Watchmen",
  "publisher": "DC Comics",
  "writer": "Alan Moore",
  "artist": "Dave Gibbons",
  "issue_num": "#1–12",
  "shelf": "read",
  "rating": 5,
  "date_read": "2024-11-01",
  "review": "The deconstruction to end all deconstructions.",
  "tags": ["classic", "mature"],
  "cover_color": "#1a2744",
  "cover_image": "https://covers.openlibrary.org/b/id/12345-L.jpg",
  "amazon_url": "https://www.amazon.com/s?k=Watchmen+DC+Comics&tag=excelsior-20&i=stripbooks",
  "created_at": "2024-11-01T12:00:00",
  "updated_at": "2024-11-01T12:00:00"
}
```

---

## Upgrading to PostgreSQL (when you're ready)

1. Provision a Postgres database on Railway (free tier available)
2. In `backend/`, install the pg driver: `npm install pg`
3. Replace the `better-sqlite3` database calls with `pg` queries — the SQL is standard and works as-is
4. Set `DATABASE_URL` in your Railway environment variables

---

## Cover Images

Covers are auto-fetched from **Open Library** when you type a title. This is free and commercially licensed. If no cover is found, the coloured placeholder with halftone texture is used instead. You can always paste a direct image URL into the cover field manually.

---

## Amazon Affiliate Disclosure

Per Amazon Associates policy, every page that contains affiliate links must include a disclosure. The detail modal already includes: *"We may earn a commission from purchases made via this link."* When you launch publicly, also add a disclosure to your site footer.
