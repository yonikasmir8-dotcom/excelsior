# Launch state

Live tracker for `launch/PLAYBOOK.md`. The **launch-director** updates this file on every `/launch` run: it updates statuses, never deletes rows, and adds dated notes.

**Status:** `todo` · `doing` · `done` · `blocked`. **HUMAN GATE** rows need a person to act or decide. Agents prepare everything up to that point.

Current phase: **0: Foundations**. Last updated: 2026-09-24.

## Phase 0: Foundations

| # | Task | Owner | Depends on | Status | Result / link |
|---|---|---|---|---|---|
| 0.1 | Incorporate company, open business bank account | HUMAN GATE | none | todo | |
| 0.2 | Engage GB gambling counsel + betting-duty accountant | HUMAN GATE | none | todo | |
| 0.3 | Deploy play-money platform (volume, HTTPS, backups, monitoring) | platform-engineer | none | todo | |
| 0.4 | Production credentials + DNS for 0.3 | HUMAN GATE | 0.3 | todo | |
| 0.5 | Release gate on the deployed build | qa-auditor | 0.4 | todo | |
| 0.6 | Obligations register v1 (LCCP/RTS/AML/marketing → controls in code) | compliance-officer | none | todo | |
| 0.7 | Trademark search for "Game Knight" + domain | HUMAN GATE | none | todo | |
| G0 | **Gate: company exists, counsel engaged, play-money site live** | HUMAN GATE | 0.1–0.5 | todo | |

## Phase 1: Free-to-play growth

| # | Task | Owner | Depends on | Status | Result / link |
|---|---|---|---|---|---|
| 1.1 | Positioning + 8-week content calendar around fixtures | growth-marketer | G0 | todo | |
| 1.2 | Discord/Reddit blueprint + in-app moderation policy | community-manager | G0 | todo | |
| 1.3 | PLG tickets: match invites, opinion invites, shareable win stats, daily leaderboards | growth-marketer | G0 | todo | |
| 1.4 | KPI definitions + weekly report | data-analyst | 0.3 | todo | |
| 1.5 | Free prize competition design + T&Cs draft | compliance-officer | 0.2 | todo | |
| 1.6 | Approve and launch prize competition | HUMAN GATE | 1.5 | todo | |
| 1.7 | Help centre v1 | support-lead | none | todo | |
| G1 | **Gate: 10k MAU or clear trajectory, and go/no-go on applying** | HUMAN GATE | 1.1–1.4 | todo | |

## Phase 2: Licence (runs in parallel from week 2)

| # | Task | Owner | Depends on | Status | Result / link |
|---|---|---|---|---|---|
| 2.1 | Decide house market maker: keep (+ general betting licence) or off in real money | HUMAN GATE | 0.2 | todo | |
| 2.2 | Policies: AML/CTF risk assessment, safer gambling, customer interaction, complaints/ADR, customer funds, marketing, data protection | compliance-officer | 0.6 | todo | |
| 2.3 | Application pack: business plan, org chart, PMLs, financials template, technical description | licensing-agent | 2.1, 2.2 | todo | |
| 2.4 | Vendor shortlist + sandbox accounts (open banking, debit card, IDV, GAMSTOP, credit reference, sanctions) | payments-engineer | 0.1 | todo | |
| 2.5 | Open vendor sandbox accounts | HUMAN GATE | 2.4 | todo | |
| 2.6 | Real adapters against vendor sandboxes (payments, IDV, GAMSTOP, affordability) | payments-engineer + identity-safety-engineer | 2.5 | todo | |
| 2.7 | Customer-interaction (harm markers) engine | identity-safety-engineer | none | todo | |
| 2.8 | Security hardening + audit evidence pack; 2FA for withdrawals/admin | platform-engineer | 0.3 | todo | |
| 2.9 | Postgres migration (when load justifies) | platform-engineer | 0.3 | todo | |
| 2.10 | Official data + integrity provider selection | market-ops | 0.2 | todo | |
| G2 | **Gate: submit application + pay fees** | HUMAN GATE | 2.1–2.3 | todo | |
| G3 | **Gate: licence granted** | HUMAN GATE | G2 | todo | |

## Phase 3: Real-money beta

| # | Task | Owner | Depends on | Status | Result / link |
|---|---|---|---|---|---|
| 3.1 | Production vendor contracts + keys; segregated customer-funds account | HUMAN GATE | G3 | todo | |
| 3.2 | Configure production env; `assertLaunchReady()` passes | platform-engineer | 3.1 | todo | |
| 3.3 | Full real-money release gate | qa-auditor | 3.2 | todo | |
| 3.4 | Flip `MONEY_MODE=real` for invite-only cohort | HUMAN GATE | 3.3 | todo | |
| 3.5 | Daily reconciliation + weekly compliance review | payments-engineer + compliance-officer | 3.4 | todo | |
| G4 | **Gate: 4 clean weeks → public launch** | HUMAN GATE | 3.5 | todo | |

## Log
- 2026-09-24: Real-money layer built and locked (money.js, 8 sandbox tests). Agent team and playbook created. Starting Phase 0.
