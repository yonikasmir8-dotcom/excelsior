# Release log (evidence per milestone)

## M0 — Stabilise ✅ (automated evidence, headless Chromium / SwiftShader)
| Check | Result |
|---|---|
| Production build (`vite build`) | PASS |
| Combat smoke test: 6 classes × 5 realms, all abilities and signature mechanics exercised | PASS, 0 runtime errors |
| Golden story chain: Emberwood → Neon → Asterion quest stages → Maren confession → Loom boss → ending | PASS, 0 errors |
| Class Trial (Ranger I) awards the correct legendary | PASS |
| Nemesis ambush spawns a ranked captain mid-realm | PASS |
| Location load times (target ≤ 5 s) | Tavern 0.05 s · Emberwood 1.7 s · Neon 1.8 s · Asterion 0.1 s · Rift 0.2 s · Loom 0.05 s |
| Boot to title (target ≤ 8 s) | 5.2 s (SwiftShader; real GPU expected faster) |

**Defects found and fixed in M0:**
- S2 Triune cooldown-refund loop.
- S2 Probability Engine infinite-Break loop.
- S2 enemy density (Asterion had 157 enemies, now capped at roughly 50–70).
- S2 foliage blocking the camera.

**Carried forward:**
- S2 balance: normal groups die in about 5 s. Retune in M4 with the sims.
- UI is still in the old comic style (M1).
- Not yet verified on real hardware (needs a human, see GDD §17).

## M1 — Vertical slice ✅ automated gates (awaiting Release Authority review)
Run everything with `npm run dev` in one terminal and `npm test` in another.

| Check | Suite | Result |
|---|---|---|
| Save integrity: corruption, truncation, bad checksum, future version, backup fallback, migration, export/import, quit-save | `tests/save-integrity.mjs` | 14/14, 3 consecutive runs |
| Crash boundary: error bursts show the recovery screen; a single stray error is contained | `tests/save-integrity.mjs` | PASS |
| New-player path: title → create → prologue → 9-step cellar tutorial → Tavern, with HUD revealed as taught and no crash screen | `tests/tutorial.mjs` | 12/12 |
| Golden Path: fresh save → Emberwood → Neon → Asterion → confession → Loom → ending → save | `tests/golden-path.mjs` | 13/13, 0 page errors |
| Release hygiene on `dist/` + `electron/`: no debug handles, localhost, CDNs, secrets, keys, `debugger`, placeholder text or source maps; CSP is self-only | `tests/hygiene.mjs` | 10/10 |
| Production build boots to the title and starts a new game with no debug handles exposed | manual script | PASS |

**What M1 delivered:**
- M1a: heroic UI, bundled fonts, credits, CSP.
- M1b: settings, key rebinding, quality presets, accessibility.
- M1c: saves, crash recovery, Unstuck.
- M1d: tutorial and onboarding, release hygiene.

**Defects found and fixed in M1:**
- S1: New Game was broken because the skip-tutorial checkbox was read after its modal closed.
- S1: the world-marker reuse TypeError caused the crash screen during the Break lesson.
- S2: the HUD `hidden` attribute was overridden by CSS, so the dice showed before they were taught.
- S3: the training dummy alerted the whole room.
- S3: gameplay tips interrupted the tutorial.

**Carried forward:**
- S2 balance (M4).
- S4 keybind column offset.
- Real hardware, blind test and signing need humans (GDD §17).
