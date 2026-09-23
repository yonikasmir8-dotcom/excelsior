Use a workflow. You have full authority over this repo and a long budget. Spend it on getting things right, not on getting done fast.

# Mission

Excelsior! (this repo) is a Letterboxd-style comic tracker: React 18 + Vite on the frontend, one Express + better-sqlite3 `server.js` on the backend, and Clerk for auth. The business goal is **£100/day in revenue, starting from a £100 operating budget.** Your job is to turn the codebase into a product that could hit that number once a human adds API keys and presses deploy. Every decision should trace back to one of three levers:

1. **Acquisition.** Shareable, indexable pages that bring in new readers.
2. **Monetisation.** Affiliate revenue that actually gets credited, plus a £5/month Pro tier.
3. **Retention.** Reasons to come back every Wednesday, when new comics release.

Read `CLAUDE.md` first. It has the project conventions. Then read the code itself, because parts of CLAUDE.md are stale. For example, the backend uses `@clerk/express`, not `@clerk/clerk-sdk-node`. If the docs and the code disagree, trust the code and fix the docs.

# Things I already know are broken or missing (verify each one; don't take my word for it)

- **Data loss on deploy.** The SQLite file is created at `path.join(__dirname, 'excelsior.db')`, and `railway.toml` doesn't mount a volume. Every redeploy wipes all user data. Make the DB path come from an env var such as `DATABASE_PATH`, default it to a volume mount path, and document the Railway volume setup.
- **Affiliate links earn nothing in the UK.** `frontend/src/api.js` hardcodes `amazon.com`, but the target market is British and revenue is in pounds. Localise the links: use amazon.co.uk with a UK tag for GB/IE, amazon.com with a US tag otherwise, and set both tags through env vars. Keep the FTC/ASA disclosure on every page that shows an affiliate link.
- **Nothing is measured.** No affiliate clicks are tracked, so we can't tell whether we're near £100/day. Route buy buttons through a server-side redirect such as `/go/:catalogId`. It should log the click (catalog id, placement, anonymous or user id, country, timestamp) and then 302 to Amazon. Build a small admin-only metrics endpoint on top of it, gated by an env allowlist of Clerk user IDs.
- **Search engines and link previews can't see the site.** It uses hash routing (`#/u/alias`), so crawlers and unfurlers get an empty SPA shell. Keep hash routing inside the app, since CLAUDE.md forbids a router. Add server-rendered public pages on real paths instead, and wire `frontend/vercel.json` rewrites so `/u/*`, `/share/*`, `/comic/*`, `/sitemap.xml` and `/robots.txt` on the frontend domain proxy to the backend. The existing catch-all rewrite must stay last.
- **Social previews are broken.** The OG image is `og-image.svg`, and X, Facebook and most unfurlers won't render SVG. Social previews need PNG, 1200×630.

# What to build, in priority order

Treat each item as a milestone. After each one: commit, push to `claude/revenue-project-100-budget-A3IWE`, and only then move on. Never push to `main`.

1. **Production foundations.** Fix the DB path and volume issue. Add a real `/api/health` route and point `railway.toml` at it. Validate env vars at startup and fail loudly when a required one is missing. Make sure the server still runs with *no* Stripe keys (payments switch off; nothing crashes).
2. **SSR public pages plus SEO.** Add `/u/:alias` (profile), `/comic/:catalogId` (catalog page: community rating, reviews, buy button) and `/series/:title`. Each needs a proper `<title>`, meta description, canonical URL, OG/Twitter tags and JSON-LD (`Book` / `AggregateRating` where honest). Add `sitemap.xml`, covering the seed catalog and public profiles, and `robots.txt`. **Every piece of user-supplied text in server HTML must be escaped.** Use one escaping helper everywhere, and write tests that inject `<script>` into titles, reviews, aliases and publishers. Real visitors should be able to get into the SPA without a jarring bounce; crawlers should get full content.
3. **Year in Comics (the viral engine).** Build `/share/:alias/:year`, a beautiful server-rendered "Wrapped" page, together with a **PNG OG image** generated on the server. `@napi-rs/canvas` or `satori` + `resvg` are both fine; pick one after checking that it installs cleanly under Railway's Nixpacks/Node 20. Add a "Share my year" flow in `ReaderStats.jsx` with copy-link, native share on mobile and download-image buttons. The design standard: a comic fan would *want* to post this on r/comicbooks. Use the existing Bangers / Barlow Condensed type and the red/yellow palette, and make it look intentional, not like a template. Render real screenshots of it at phone and desktop sizes, look at them critically, and iterate until it's genuinely good.
4. **Pro tier (Stripe, £5/month).** Include a subscriptions table, Checkout, the customer portal and a webhook. Known traps:
   - `app.use(express.json())` is global, so the webhook must be registered *before* it with `express.raw()`. Otherwise signature verification always fails.
   - Recent Stripe API versions moved `current_period_end` off the top-level subscription object. Check the installed SDK's pinned API version and read the field from the right place.
   - Webhook handling must be idempotent. Store processed event IDs.
   - Starting a new checkout must never downgrade an existing active subscriber.

   The Pro features should be ones readers would actually pay for: library export (CSV/JSON), extra Year-in-Comics card styles, advanced stats (streaks, series completion %, decade analysis), and a Pro badge. Free-tier logging, rating and social features stay fully free. Put gating on the server; the client-side gating is cosmetic only.
5. **New Releases Wednesday.** Build a weekly new-releases feed in Discover, with a buy button on every item. Find a legitimate data source that can be used without scraping in breach of terms of service. If none exists without a paid key, build the ingestion behind an interface with a seeded fallback and write down exactly what key is needed. Don't invent release data.
6. **Growth kit.** Write `LAUNCH.md` with ready-to-post copy for r/comicbooks, r/Marvel, r/DCcomics, Bluesky and Discord (respecting each subreddit's self-promotion rules), a posting schedule, and a plan for the £50 of the budget reserved for ads, to be spent only after organic traction shows up.

# How to work

- **Plan first, then fan out.** Map the codebase and write a short architecture plan to the scratchpad. After that, run independent milestones in parallel only where they don't touch the same files. `server.js` is already over 1,200 lines. You're authorised to split it into modules under `backend/src/` (for example routes/, db/, ssr/, billing/). Do the split first, as its own behaviour-preserving commit, so that parallel work doesn't collide.
- **Keep the house style.** Plain JSX, inline styles, no TypeScript, no Tailwind, no React Router, and mobile-first bottom-sheet modals. New code should read as if the original author wrote it.
- **Verify like a sceptic.**
  - Add a `node:test` suite for the backend covering SSR escaping, year stats, webhook signature and idempotency (use Stripe's test helpers or signed fixture payloads), Pro gating, the affiliate redirect and sitemap validity.
  - Run the real backend and frontend. Drive them with Playwright using the preinstalled Chromium (`executablePath: '/opt/pw-browsers/chromium'`; never run `playwright install`), and screenshot every new page at 390px and 1280px widths.
  - Clerk can't be completed headlessly without keys, so add a clearly fenced dev-only auth bypass enabled by an env flag that is impossible to turn on in production, and test it.
  - Fetch every SSR page with curl as a crawler would and confirm the content and meta tags are present.
- **Review adversarially before you call anything done.** Run a separate reviewer pass over the full diff for security (XSS, auth bypass, IDOR on private shelves, SQL built by string interpolation, open redirects in `/go/`), for Stripe edge cases and for regressions. Fix what it finds, then re-verify.
- **Stay inside these hard boundaries.** Don't spend money, create accounts, buy domains, deploy to production or use real API keys. Anything that needs a human goes into `LAUNCH.md` as an exact, ordered checklist: which dashboard, which setting, which env var, which value format.

# Definition of done

- All milestones are committed and pushed, each commit is coherent, and the tests pass from a clean `npm ci`.
- `LAUNCH.md` has the human checklist (Railway volume, env vars, Stripe product and price, webhook URL, Clerk domains, Amazon Associates UK+US, domain DNS), the growth kit, and a **revenue model table**. The table should give the MAU, click-through and conversion assumptions needed to reach £100/day, and name which of those assumptions the new `/go/` metrics will confirm or disprove.
- `CLAUDE.md` is updated to reflect the new architecture, routes, env vars and conventions.
- A pull request is opened from the branch to `main`, with screenshots of the Year-in-Comics card and the SSR pages.
- Your final report is honest. Say what works and how you verified it, what you couldn't verify and why, what's stubbed, and the three biggest risks to the £100/day goal. If something failed, show the output; don't paper over it.
