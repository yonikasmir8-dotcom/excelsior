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
