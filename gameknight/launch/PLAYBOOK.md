# Game Knight launch playbook

The pathway from today's play-money product to a licensed real-money football opinions exchange in Great Britain. The agents in `.claude/agents/` execute it; `launch/STATE.md` tracks it. Run a cycle with `/launch` in Claude Code, from the `gameknight/` folder.

> Nothing here is legal, tax or financial advice. Every regulatory number must be confirmed with gambling counsel and an accountant before you rely on it. Figures were checked on 24 Sep 2026 against the sources at the end.

---

## 1. The decision: which route to real money

Game Knight lets customers back and oppose outcomes against **each other** on an order book. In Great Britain, that is betting on sporting events, regulated by the **Gambling Commission**, not the FCA. Taking real money without an operating licence is a criminal offence.

| Route | What it means | Time to cash | Cost | Control | Verdict |
|---|---|---|---|---|---|
| **A. Own Gambling Commission licence** | *Remote betting intermediary* licence (customers bet against each other; you take a fee). Also *remote general betting* if the house market maker keeps trading as principal. | 6–12 months | Highest upfront (see §5) | Full | **Recommended.** It's the durable business. |
| **B. White-label on a licensed operator** | Run under a licensed operator's licence and platform. | 2–4 months | Revenue share | Low: the licensee owns compliance and your customers | Only as a bridge. The Commission is scrutinising white-labels for AML risk, and any breach is the licensee's, so good partners are cautious. |
| **C. Free-to-play prize competitions** | Stay play money; offer prizes via genuinely free entry and skill-based contests. | Now | Low | Full | **Do this immediately** to grow the audience while A is in flight. |
| **D. Crypto (USDC etc.)** | Stablecoin deposits. | Not faster | Higher | Full | **No.** It doesn't remove the need for a gambling licence in GB. It adds FCA crypto-asset rules, harder banking and AML, and friction for mainstream fans. Polymarket itself had to leave the US and later buy a CFTC-licensed exchange to come back. |

**Chosen pathway:** C now, A in parallel, with B as a fallback if the licence slips past month 9. Cash only: GBP via **open banking** (instant pay-by-bank deposits and fast withdrawals, the dominant rail for GB operators) plus **debit cards**. Credit cards are banned for gambling in GB.

**House market maker:** the house bot takes positions, which makes Game Knight a principal (a bookmaker) as well as an intermediary. Either:

- add a remote general betting licence, or
- run real-money markets with the house off and liquidity from external market makers (API keys + fee rebates).

The code supports both (`HOUSE_MARKET_MAKER`, `GENERAL_BETTING_LICENCE`).

---

## 2. Phases and gates

Each phase ends at a **gate**: a human decision recorded in STATE.md. Agents can't pass a gate.

### Phase 0: Foundations (weeks 0–2)
- Incorporate (Ltd), business bank account, domain, brand trademark search. *(HUMAN)*
- Engage gambling counsel and an accountant familiar with betting duties. *(HUMAN)*
- Deploy the play-money platform publicly (platform-engineer).
- **Gate G0:** company exists, counsel engaged, play-money site live.

### Phase 1: Free-to-play growth, the "POC" (weeks 2–16)
- Weekly football content engine and community (growth-marketer, community-manager).
- Product-led growth from the deck: match invites, opinion invites, calendar sync, shareable win stats, daily leaderboards.
- Optional lawful prize competition (free entry, skill-based), with T&Cs approved by counsel. *(HUMAN gate)*
- Metrics: the deck's **10k MAU = proof of concept**. Weekly retention and opinions per user feed the licence business plan (data-analyst).
- **Gate G1:** 10k MAU (or a clear trajectory) and the go/no-go on applying.

### Phase 2: Licence application (starts in parallel at week 2; determination typically 4–6+ months)
- Key people and Personal Management Licences, policies, AML/CTF risk assessment, customer-funds protection level, complaints/ADR (IBAS), marketing and social-responsibility policies (compliance-officer, licensing-agent).
- Technical: security controls and an independent security audit plan; GAMSTOP integration; age/ID verification before any gambling; financial-risk checks (identity-safety-engineer, platform-engineer).
- Vendor shortlists and sandbox integrations. Payment and IDV vendors will want your licence (or a pending application) before production contracts (payments-engineer).
- **Gate G2:** application submitted and fees paid *(HUMAN)*.
- **Gate G3:** licence granted *(HUMAN)*.

### Phase 3: Real-money beta (weeks 0–8 after licence)
- Production vendor contracts and keys *(HUMAN)*. Segregated customer-funds account opened *(HUMAN)*.
- Flip `MONEY_MODE=real` with production providers. The server refuses to start until licence, operator name and non-sandbox providers are set (`backend/money.js → assertLaunchReady`).
- Invite-only cohort, low default deposit limits, daily reconciliation, qa-auditor sign-off on every release.
- **Gate G4:** clean reconciliation for 4 consecutive weeks, zero unresolved compliance findings, and the complaints and safer-gambling processes working. Then open to the public.

### Phase 4: Scale, toward "PMF" (month 6+ after licence)
- Paid marketing within the gambling ad codes; club, creator and media partnerships; native apps (Apple and Google both require the licensed entity to publish gambling apps).
- AI Insights as a paid, per-credit product (deck revenue line); external market-maker programme; Postgres + sharded matching.
- Deck target: **1M MAU = product-market fit**.

---

## 3. The agent team

| Agent | Runs autonomously | Always needs a human |
|---|---|---|
| **launch-director** | Reads STATE, delegates, verifies, updates the tracker, briefs you | Passing any gate |
| **compliance-officer** | Obligations register, policy drafts, code reviews against rules, regulatory watch | Legal sign-off; anything sent to the Commission or IBAS |
| **licensing-agent** | Builds the full application pack from the codebase and policies | Submitting and paying |
| **payments-engineer** | Provider adapters (sandbox), webhooks, reconciliation, funds reporting | Vendor contracts and production keys |
| **identity-safety-engineer** | IDV/GAMSTOP/affordability adapters, safer-gambling tools, harm-marker engine | Vendor contracts; UX copy approval |
| **platform-engineer** | Deployment scripts, monitoring, backups, security hardening, audit evidence | Production credentials, DNS, paid infrastructure |
| **qa-auditor** | Full tests, invariant checks, browser journeys, ship/no-ship verdicts | Overriding a no-ship |
| **market-ops** | Listing fixtures, odds, market-maker limits, integrity flags | Settling or voiding real-money markets; integrity reports |
| **growth-marketer** | Positioning, content calendar, copy, SEO pages, outreach drafts | Publishing, ad spend, messaging people |
| **community-manager** | Discord/Reddit blueprints, moderation policy, feedback digests | Posting as the brand |
| **data-analyst** | KPI reports, funnels, market quality, safer-gambling indicators | Nothing, since it's read-only |
| **support-lead** | Help centre, macros, complaints and ADR process, vulnerable-customer playbook | Replying to real customers |

**How to make it autonomous:**
- **Scheduled runs:** set up a scheduled task (a Claude Code Routine) that runs `/launch` every weekday morning. Each run delegates the next unblocked work, verifies it, updates STATE.md, and ends with the list of decisions it needs from you.
- **Your weekly role:** you only step in at HUMAN GATE rows.
- **Faster progress:** run several cloud sessions in parallel, one per workstream: licence pack, payments, marketing.

---

## 4. Vendors and APIs

| Need | Options | Notes |
|---|---|---|
| Pay-by-bank deposits and withdrawals | Trustly, TrueLayer, Volt, Brite | Instant deposits, Faster Payments payouts; best UX in GB |
| Debit cards | Nuvei, Paysafe, Worldpay | Credit cards banned for GB gambling; block at the adapter |
| Identity and age (KYC) | GBG, Onfido (Entrust), Veriff, Jumio, Sumsub | Must be complete before any gambling or deposit |
| Self-exclusion | GAMSTOP API | Mandatory for online operators |
| Affordability / financial risk | Credit reference data (Experian, TransUnion, Equifax) via vendors | Frictionless checks at **£150 net deposits over 30 days** (since Feb 2026). Fuller financial risk assessments are staged, targeting £1,000/24h or £3,000/90 days at full rollout. |
| Sanctions / PEP screening | ComplyAdvantage, LexisNexis | AML/CTF |
| Location | Cloudflare / MaxMind IP intelligence | GB-only (`ALLOWED_COUNTRIES`, `GEO_ENFORCE`) |
| Fixtures and results | football-data.org (now), API-Football or Sportmonks, then official data (Genius Sports, Sportradar, Stats Perform) | Official data for settlement and integrity at real-money scale |
| Integrity | IBIA membership, or Sportradar's integrity service | Suspicious-betting monitoring and reporting |
| Crests / logos | Club and league licences, or a data provider that includes them | Trademarks: clear before commercial launch |
| Email / SMS / push | Postmark or Resend, Twilio, FCM/APNs | 2FA for withdrawals and admin |
| Analytics / errors | PostHog, Sentry | |
| Complaints ADR | IBAS | Named in T&Cs and final-response letters |
| AI Insights | Claude API | Paid per-credit Insights (deck revenue line) |

Adapter contracts for payments, identity and exclusion are documented at the top of `backend/money.js`. Sandbox adapters ship now; each vendor adds one adapter.

---

## 5. Money: costs and revenue (estimates, verify all)

**One-off, pre-launch** (typical ranges for a small GB applicant):

| Item | Estimate |
|---|---|
| Counsel (application, T&Cs, policies) | £20k–£60k |
| Security audit and pen test | £10k–£30k |
| Licence application fees (both licences, fee band depends on projected GGY; up ~25% from 1 Oct 2026) | Low thousands to tens of thousands |
| Vendor setup and minimums (payments, IDV, data) | £5k–£25k |
| Working capital (runway, market-maker float if house MM kept, reserves) | Varies |

A realistic all-in pre-launch budget is **£75k–£200k**, plus runway.

**Recurring:**
- annual licence fees
- the statutory gambling levy (% of gross gambling yield)
- betting duty on your fee income (for betting intermediaries, duty is on commission; UK remote betting duty is changing, so confirm the current rate with your accountant)
- vendors, data, hosting and staff

**Revenue model (deck):** a per-trade platform fee (`TAKER_FEE_BPS`, e.g. 200 = 2% of the cash traded by the taker), then paid AI Insights, then meme-merch.

---

## 6. What's already built

- **Exchange:** order book, mint/merge, a house market maker, settlement from results, and a conservation-of-money fuzz test.
- **Real-money layer** (`backend/money.js`), locked by default:
  - GBP wallet; deposits credit only on provider confirmation
  - withdrawals debit immediately and reverse on failure
  - idempotent, signed webhooks
  - identity + 18+ + GAMSTOP before any deposit or trade
  - GB-only country gate
  - deposit limits with 24h cooling-off on increases
  - take-a-break and self-exclusion (cancel open orders, block play, never block withdrawals)
  - affordability flags at £150 net/30d and the financial-risk thresholds
  - append-only audit log, customer-funds report, reality-check prompts, and the regulatory footer
- **Launch lock:** `MONEY_MODE=real` refuses to start without `LICENCE_NUMBER`, `OPERATOR_LEGAL_NAME`, and non-sandbox payment, identity and exclusion providers. It also refuses without `GENERAL_BETTING_LICENCE` if the house market maker is on.
- **Tests:** 28 backend tests, including 8 real-money tests against sandbox providers.

---

## Sources
- Gambling Commission, licence fees and activities: https://www.gamblingcommission.gov.uk/licensees-and-businesses/licences-and-fees/remote-betting-intermediary-operating-licence
- DCMS, fee changes from 1 October 2026: https://www.gov.uk/government/consultations/proposed-changes-to-gambling-commission-fees/outcome/government-response-to-the-propsals-for-changes-to-gambling-commission-fees-from-1-october-2026
- 25% fee rise coverage: https://igamingbusiness.com/legal-compliance/licensing/dcms-confirm-25-increase-gambling-commission-licence-fees-october/
- Financial vulnerability checks: https://www.gamblingcommission.gov.uk/blog/post/financial-vulnerability-checks-insights-from-implementation
- Staged financial risk assessments (July 2026): https://www.yogonet.com/international/news/2026/07/08/125276-uk-gambling-commission-to-start-staged-financial-risk-assessments-with-higher-threshold
- White-label AML risk: https://www.casino.com/news/industry/gambling-commission-flags-white-label-partnerships-as-money-laundering-risk/
- Open banking in GB gambling: https://www.einpresswire.com/article/686096398/trustly-truelayer-and-plaid-revealed-as-leading-open-banking-payments-providers-in-global-gambling-iq-leaderboard
- Curaçao LOK fees (for comparison; not usable for GB customers): https://www.thepointlegal.com/guides/curacao-gaming-licence
