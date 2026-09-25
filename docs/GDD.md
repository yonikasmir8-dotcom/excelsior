# The Forgotten Tavern — Game Design Document

**Version:** 1.1 (approved scope decisions applied) · **Release standard:** EGDRS v1.0 · **Build baseline:** branch `claude/zealous-lovelace-fd7ueg`

This document defines what will be built, how each part earns its place, and how every release gate will be *demonstrated*, not claimed. Anything not listed here is out of scope for release.

---

## 1. Vision

**One sentence:** A single-player, party-based action RPG where you lead four heroes out of a tavern at the edge of the multiverse, fight through hand-built realms with a hybrid real-time/tactical combat system, and make enemies who remember you.

**Tone and art:** Heroic painted fantasy. Dramatic storm-light, magic as the main light source, broad-shouldered heroes, cyan-white lightning against warm skies. It is serious and grand, with warmth and humour coming from the characters, not from slapstick. There is no comic-book lettering and no block art.

**Multiverse premise:** The realms are genuinely different genres (fantasy kingdom, city of champions, a derelict star-vessel), all rendered in the same heroic painted style, so the crossover feels like one illustrated world.

| | |
|---|---|
| Genre | Party action RPG (third-person) |
| Players | 1 (single-player, offline). **No multiplayer, no online services.** |
| Business model | One-time purchase. **No in-app purchases, no ads, no telemetry by default.** |
| Launch platforms | Windows 10/11 x64 and macOS 12+ (Apple silicon and Intel), via the desktop app. Linux and Steam Deck are deferred. |
| Input | Keyboard + mouse. Gamepad is deferred past 1.0 (it was only needed for Steam Deck). |
| Language | English at launch. All player-facing text lives in string tables so localisation is possible later. |
| Target length | Story: 5–7 hours. Full completion (all Trials, all lore, Rift depth 10): 15–20 hours. |

---

## 2. Core loop (P2.1)

> **The player repeatedly** enters a realm with a party of four, fights encounters by combining real-time action with planned party combos, and completes quest objectives, **because** each fight rewards XP, gear and nemesis stories that make the party stronger and more personal, **in order to** restore the realm, recover a Loom-Shard and uncover the truth about the Tavern.

**The session loop (about 20–40 minutes):**
1. In the Tavern, talk to people, buy, craft, pick your party.
2. Choose a realm door.
3. Explore, fight and complete objectives.
4. Meet a nemesis.
5. Fight the boss or reach a milestone.
6. Return to the Tavern.

**The long loop:** 3 realms, then the finale. After that come Class Trials and deeper Rifts.

---

## 3. Mechanics — each one must justify itself (P2.2)

Every mechanic below states what it does, why it exists, the decision it creates, the skill it tests, and what it interacts with. The ones marked **CUT** failed this test and will be removed.

| Mechanic | What it does | Decision it creates | Skill tested | Interactions | Verdict |
|---|---|---|---|---|---|
| **d20 attack rolls** | Every attack rolls to hit against armour. A natural 20 crits. | Whether to commit to high-accuracy or high-damage options | Reading risk | Fate Dice, gear, talents | **KEEP.** Rolls are shown only as a small die on crits, never as spam. |
| **Fate Dice** | Each fight starts with a hand of 5 pre-rolled d20s. Arm one and your next attack uses that roll. Sacrifice one to charge the Break. | Spend a 19 now on this elite, or save it for the boss? | Resource timing | Break, class finishers, bosses | **KEEP**, redesigned to be clearer: the player sees their hand, big numbers, and two verbs (Arm / Sacrifice). |
| **Initiative Break** | When the meter is full, time freezes and you choose one action for each hero. It then plays out as a combo. | Which four actions, and in which order? | Tactical planning | Team-Ups, class kits | **KEEP.** It is the game's signature. |
| **Team-Ups** | Specific ability pairs from different heroes combine into a bonus effect. | Party composition and sequencing | Discovery, coordination | Break, class kits | **KEEP, but narrowed**: they trigger only inside Initiative Break and from clearly telegraphed combos, so they are never random-feeling. 12 total, each listed in the Journal once found. |
| **Class signature mechanic** (right mouse) | One unique verb per class (Section 5) | Class-specific timing | Execution | Talents, legendaries | **KEEP.** This is what makes classes feel different. |
| **Nemesis system** | Named captains with traits and weaknesses who remember you, get promoted, adapt, taunt, return and ambush | How to hunt a specific enemy; whether to learn intel first | Preparation, adaptation | Loot, Tavern intel, Rifts | **KEEP.** It creates the memorable enemies you asked for. |
| **Companion AI + tactics** | Three AI companions with Aggressive / Balanced / Defensive stances. They use their class mechanics too. | Party makeup and stance | Team building | Everything | **KEEP.** |
| **Live hero switching (keys 1–4)** | Swap control mid-fight | — | — | Confuses the camera, the HUD and the AI | **CUT.** You choose which hero you lead in the Tavern instead. |
| **Style rank meter** | Scores variety | Duplicates what Fate Dice and the Break already reward | — | HUD clutter | **CUT.** |
| **Onomatopoeia / halftone / comic popups** | Visual noise | — | — | Readability | **CUT** (art direction). |
| **Destructible terrain** | Explosions carve the world | Created softlocks and visual chaos | — | Quest geometry | **CUT.** |
| **Loot affixes** | Gear with stats | Build choices | Build craft | Talents | **KEEP, simplified:** 8 affix types instead of 14, and every item card shows a clear "better / worse than equipped" comparison. |

**Randomness vs agency (P2.3).** The game distinguishes four sources of outcome:
- **Player choice:** abilities, positioning, Fate Dice and the Break.
- **Visible randomness:** d20 rolls, shown when they matter.
- **Scripted events:** boss phases and ambushes, always announced.
- **Unavoidable outcomes:** none. Every enemy attack is telegraphed and can be dodged or blocked.

---

## 4. Controls

| Action | Keyboard + mouse | Gamepad |
|---|---|---|
| Move / camera | WASD / mouse | (future) Left stick / right stick |
| Basic attack | Left mouse | RT |
| Abilities 1–3 / ultimate | Q, E, C / R | X, Y, B / RB+LB together |
| Class mechanic | Right mouse (hold or press) | LT |
| Dodge / jump | Shift / Space | A (tap = dodge, hold = jump) |
| Initiative Break | Tab | — |
| Fate Dice: cycle / arm / sacrifice | Wheel / X / Z | D-pad left-right / D-pad up / D-pad down |
| Interact (hold to revive) | F | A near an object |
| Potion | H | LS click |
| Menus | I, K, J, P, Esc | Start / View |

**Every binding is rebindable.** Hold actions can be switched to toggles. The gamepad column is kept for a future update and is not in 1.0.

---

## 5. Classes — six distinct kits

Each class has:
- a basic attack;
- 3 abilities and an ultimate;
- a **signature mechanic** that no other class has;
- a passive;
- two talent specialisations (14 nodes each, with a keystone);
- 3 class legendaries;
- 3 Class Trials.

**Design test:** a blind player should be able to name the class from ten seconds of footage.

| Class | Fantasy | Signature mechanic (right mouse) | Skill tested | Resource |
|---|---|---|---|---|
| **Fighter** | Shield-and-sword champion | **Guard / Parry:** hold to block 75% of frontal damage; raise it just before a hit to parry, which staggers the attacker and makes your next strike a guaranteed crit | Reaction timing | Resolve (built by blocking) |
| **Sorcerer** | Elemental weaver | **Attunement:** cycle Fire / Frost / Storm; every spell transforms | Sequencing | Resonance (alternate elements to stack damage) |
| **Runesmith** | Battlefield engineer | **Detonate:** set off every ward, rune and totem you've placed | Setup and payoff | Salvage |
| **Cleric** | Battle priest | **Tether:** bind a light-tether to an ally; they take less damage, and your damage heals them | Protecting the right target | Faith |
| **Rogue** | Shadow assassin | **Tumble:** roll through a target and come up behind it for a guaranteed crit | Positioning | Combo points (spent by Eviscerate) |
| **Ranger** | Hunter with a wolf | **Aimed Shot:** hold to draw, release to fire; a full draw pierces everything | Aim and patience | Hunter's Focus |

**Companions:** 8 recruitable, one per class plus two unlockables, each with a personality, banter, a personal recruitment conversation and loyalty lines.

---

## 6. World and content

### 6.1 The Tavern hub
A half-timbered inn on a floating isle. It contains:
- **Services:** Maren (story, rest), Grizzle (shop, nemesis intel), Brassika (forge), Mama Stew (meal buffs), Lute (rumours), Madame Cartographa (Rifts), Sir Wispington (Class Trials), Rollo (dice game).
- **Other features:** the Hall of Doors, the Wanted Wall of nemeses, and a trophy shelf that fills as you defeat bosses.

### 6.2 Realms (story)

Each realm is built for 60–90 minutes, with its own art palette, music, enemy roster, signature mechanic and boss.

| Realm | Genre | Main quest (stages) | Side content | Signature mechanic | Boss |
|---|---|---|---|---|---|
| **Emberwood Reach** | Fantasy | Meet the warden → cleanse 3 ley-stones (defend waves) → breach the Hollow Keep gate → the Hollow King | 5 Lost Pages, 2 side quests, a nemesis warband | Ley-light zones empower magic | The Hollow King (3 phases) |
| **Neon Meridian** | Superhero | Find Spark → rescue 4 citizens → destroy 3 Memory Erasers on the rooftops → NULL | 5 comics, 2 side quests, warband | Launch pads to the rooftops | NULL (3 phases) |
| **The Asterion** | Sci-fi star-vessel | Find Ensign Pell → restore 3 terminals under fire → open the core → CARETAKER | 5 crew logs, 2 side quests, warband | Low-gravity hull breaches | CARETAKER (3 phases, shielded by adds) |
| **The Loom** | Finale | Face the Unraveller → the ending choice | — | Fragments of every realm | The Unraveller (4 phases) |

**New for release (content completeness):** 2 side quests per realm (6 total), each with a named NPC, a unique objective type and a unique reward.

### 6.3 Endgame
- **Rifts:** procedural genre mash-ups across 8 themes. There are 4 objective types (close tears, escort, hold the anchor, hunt the Warden), 10 modifiers, and depth scaling to 10+.
- **Class Trials:** 18 in total (3 per class), each ending in that class's legendary.
- **New Game+:** carries your party into harder scaling.

### 6.4 Story
The realms are fraying, and the Unraveller erases them from memory. Each realm yields a Loom-Shard and a memory. The twist is that the Tavern itself is the knot holding the realms together, and Maren is the Weaver who hid it. There are **three endings**; one needs a skill check to reach.

---

## 7. Enemies, bosses and nemeses
- **Roster:** 16 enemy types across 5 roles: melee, ranged, caster/healer, brute (elite), assassin (blinks). Each realm has 5 types plus an elite.
- **Fairness rule:** every hostile attack telegraphs, either with a windup glow or a rune circle on the ground. This is enforced by an automated check: every enemy attack path must pass through `telegraph()` or a windup.
- **Bosses:** 5, each with 3–4 phases, a phase-change announcement, and a readable pattern set of 4–5 moves.
- **Nemeses:** each realm has a warband of 4 captains, each with 2–3 traits drawn from 22.
  - **They get stronger:** they are promoted when they down a hero or when you flee, and they learn to resist whatever nearly killed them.
  - **They come back:** they can cheat death with new scars, and at high rank they ambush you. When one dies, a witness takes their place.
  - **Intel:** comes from the merchant, the bard, or discovering their traits in battle.

---

## 8. Progression and economy
- **Levels:** 1–20 (reduced from 30 so balance is testable), with one talent point per level. You cannot max both specialisations.
- **Gear:** 3 slots, 5 rarities, 8 affix types, and 18 legendaries that change how a class plays.
- **Gold:** earned from enemies, quests and selling. Spent on potions, forge upgrades and rerolls, meals, respecs, intel and the dice game.
- **Economy guardrails:**
  - Rollo's dice game has a house edge and a daily limit.
  - Shop stock rerolls only on travel.
  - Gold and item counts are capped and clamped; this is tested in hostile QA.
- **Dominant Strategy Audit (P2.5).** These are defects in the current build that will be fixed:
  - **S2 — Probability Engine loop:** sacrificing Fate Dice rerolls them back, giving infinite Break charge.
  - **S2 — Triune Mastery loop:** spamming Attunement refunds cooldowns endlessly.
  - **S3 — Style-rank farming:** removed, since the Style meter is cut.
  - Every keystone and legendary will be run through an automated DPS sim and a survivability sim. Any build more than 35% above the median needs a design sign-off or a fix.

---

## 9. UX and onboarding (P4)
- **First 10 minutes (the new-player path):**
  1. Title screen.
  2. A photosensitivity notice.
  3. Create your hero.
  4. Maren's prologue.
  5. **A first companion joins automatically.**
  6. A guided first fight in the Tavern cellar teaches, in order: move, dodge, attack, your class mechanic, Fate Dice, then the Break.
- **One new system at a time:** new systems unlock gradually, and nothing appears on the HUD before it has been taught.
- **The "what am I supposed to do?" rule:**
  - An objective tracker is always visible, with a world marker.
  - Every interactable shows a prompt.
  - Every quest step says where to go.
- **Feedback:** every action has animation, sound and a visual response.
  - Hits: impact flash, hit sound, a restrained damage number.
  - Crits: a gold number plus a small die.
  - Parries: a shield flare, a distinct sound, and a slow-motion beat.
- **Error recovery (P4.3):** if something fails, a recovery screen says what happened, confirms "Your progress is saved (last save: X minutes ago)", and offers "Continue", "Return to the Tavern" and "Copy error report".
- **Pause menu:** includes **Unstuck**, which returns you to the last safe point with no penalty.

---

## 10. Accessibility
**All of the following ship at launch:**
- **Text and UI:**
  - Text size (4 steps) and UI scale (80–150%).
  - A high-contrast UI option.
  - All dialogue is text; spoken-style barks are always shown with their speaker.
- **Colour:**
  - Colour-blind modes (protanopia, deuteranopia, tritanopia).
  - Telegraphs also use shape and animation, not colour alone.
- **Controls:**
  - Full keyboard and mouse remapping.
  - Hold-to-toggle for guard, draw and revive.
  - A one-handed preset (mouse-only abilities via a radial menu).
- **Motion and flashing:**
  - A **photosensitivity notice** at first launch.
  - Reduce flashing, which disables storm and crit flashes.
  - Screen shake from 0–100%, camera motion smoothing, and field of view from 50–90.
- **Difficulty:** Story / Normal / Hard presets, plus separate sliders for enemy damage, enemy health and timing windows (parry window, telegraph duration).
- **Sound:** subtitled sound cues (optional icons for off-screen threats) and separate volume for music, SFX and UI.
- **Screen readers:** full support is **out of scope for 1.0** and will be declared on the store page. Menus follow a logical focus order so it can be added later.

---

## 11. Performance targets (P5) — measured, not felt

| Tier | Reference hardware | Settings | Target |
|---|---|---|---|
| Minimum | Intel Iris Xe / Radeon 680M, 8 GB RAM | 1080p, Low | Average ≥ 60 fps, 1% low ≥ 45, 0.1% low ≥ 30 |
| Recommended | GTX 1060 / RX 580, 16 GB | 1080p, High | Average ≥ 60, 1% low ≥ 55 |
| High | RTX 3070+ | 1440p, Ultra | Average ≥ 90, 1% low ≥ 70 |

- **Loading:** location load ≤ 5 s on recommended hardware; boot to title ≤ 8 s.
- **Memory:** ≤ 1.5 GB process memory, with < 10% growth over 8 hours.
- **Worst-case benchmark scene:** a boss fight with 4 heroes, 12 adds, 3 nemeses, maximum particles and a storm, in every realm.
- **Quality presets:** Low / Medium / High / Ultra, auto-detected on first launch, plus an FPS and frame-time overlay.

---

## 12. Stability and data (P6)
- **Save system:**
  - In the desktop app, saves are JSON files in the OS user-data folder.
  - Writes are **atomic**: write a temp file, fsync, rename. If a write is interrupted, the previous save survives.
  - **3 rolling backups** per slot. Saves carry a **version number** and a **checksum**.
  - On load, the file is validated and **migrated** from any older version. If it's corrupt, the game falls back to the newest valid backup and tells the player.
  - Saves can be exported and imported.
- **When it saves:** on every realm transition, on quest-stage completion, every 60 s outside combat, and on quit.
- **Hostile save tests:**
  - A corrupt file, a truncated file, a full disk, and the process being killed mid-save.
  - An old-version save, uninstall/reinstall, and manual edits (clamped).
- **Crash handling:** a global error boundary, per-system isolation in the game loop, and local crash logs. Uploading a crash report is opt-in and shows exactly what will be sent.
- **Endurance:** an automated 8-hour soak test (an AI party playing Rifts on a loop) and a 24-hour idle and menu soak.

---

## 13. Online, security, privacy, monetisation (P7 and P8)
- **P7 (online):** **not applicable.** The game is fully offline. There are no accounts and no servers.
- **P8 (security, privacy, monetisation):**
  - No secrets are embedded in the build; this is automated with a scan in CI.
  - No personal data is collected, and opt-in crash reports contain no personal information.
  - There is no monetisation beyond the purchase price, so there are no dark patterns to audit. The store page states "No microtransactions".
  - The Electron app runs with context isolation, no Node integration in the renderer, a content security policy, and no remote code.

---

## 14. Compatibility (P9)
- **Test matrix:** Windows 10 and 11, and macOS on Apple silicon and Intel. Each is tested on a fresh install, an update over the previous build, offline, and with keyboard and mouse.
- **Fonts and assets are bundled locally** (open-licence fonts), with zero network requests. This is verified by an automated check that blocks the network.

---

## 15. Presentation and polish (P10)
- **Art:** heroic painted fantasy.
  - **Rendering:** a painted sky, soft sun shadows, bloom on magic, ACES grading, and a colour script per realm.
  - **Characters:** sculpted with heroic proportions, and **every enemy type gets a unique silhouette**.
- **VFX:** soft glowing particles, lightning bolts, rune-circle telegraphs. There is a particle budget per effect so fights stay readable.
- **Audio:** fully procedural, with a music score per realm and a combat layer.
  - **Approved as final (decision 1):** procedural audio is the intended launch audio, so it is not placeholder under P3.2.
- **Menus:** dark leather and gold-trim panels, with serif display type and body text.
- **Portraits:** rendered from the in-game models, styled as painted cameos.

---

## 16. Content matrix (P3.1)
This table is tracked in `docs/CONTENT_MATRIX.md` and updated at every milestone. It is the baseline for release scope. The matrix currently shows no item as Final or Approved.

| Content | Count | Implemented | Tested | Final | Approved |
|---|---|---|---|---|---|
| Realms (story) | 4 | 4 | automated only | — | — |
| Rift themes / objective types | 8 / 4 | 8 / 1 | — | — | — |
| Main quest stages | 16 | 16 | automated | — | — |
| Side quests | 6 | 0 | — | — | — |
| Classes (kits, talents, legendaries, Trials) | 6 | 6 | partial | — | — |
| Companions | 8 | 8 | — | — | — |
| Enemy types / bosses / nemesis traits | 16 / 5 / 22 | 16 / 5 / 22 | partial | — | — |
| Items (affixes / legendaries) | 8 / 18 | 14 / 18 | — | — | — |
| Dialogue trees | ~30 | ~26 | — | — | — |
| Tutorial | 1 | 0 | — | — | — |
| Music tracks / SFX | 8 / ~45 | 8 / ~45 | — | — | — |
| UI screens | 16 | 13 | — | — | — |
| Settings (graphics, audio, controls, accessibility) | full list in §10–11 | partial | — | — | — |

---

## 17. Verification plan — how each gate is demonstrated

**What I can automate and run myself** (Playwright plus Node, in CI on every push):

| Suite | Covers |
|---|---|
| **Golden Path test** | Install → launch → settings → new game → tutorial → first realm → save → quit → relaunch → load → continue → finish all realms → ending → post-game. Scripted by driving the real UI. |
| **Feature sweep** | Every menu, button, ability, mechanic, item, dialogue node, settings option and quest stage |
| **Save suite** | All hostile save cases listed in §12 |
| **Hostile input fuzzer** | Random rapid and simultaneous input, pausing mid-animation, quitting mid-save, leaving the map, sequence breaking, maximum and minimum currency and progression, repeated deaths and reloads |
| **Balance sims** | Party-vs-encounter and dominant-strategy sims for every class, keystone and legendary |
| **Performance benchmark** | Worst-case scenes. Records average fps, 1% and 0.1% lows and frame-time spikes. |
| **Soak test** | 8-hour memory and performance-drift check |
| **Release hygiene checks** | No placeholders, no debug text, no debug handles in the release build, no network access, no secrets, and every telegraph path covered |
| **Regression suite** | Every S0–S2 fix adds a test that must pass forever |

**What needs humans.** I can't do these; they need you or people you recruit:
- **Real hardware:** running the benchmark on the minimum, recommended and high tiers on Windows and macOS. The benchmark writes a results file you can send back.
- **Blind Player Test:** 5–8 people who have never seen the game. I'll provide the observation sheet and the build.
- **Fresh-eyes review:** someone other than the builder has to sign off each area. That's you, plus any testers.
- **Release Authority:** you act as studio director and sign the scorecard. I'll prepare it with evidence links for every gate.
- **Code signing:** Apple notarisation and Windows code signing need your developer accounts.

**Defect tracking:** GitHub Issues with `S0`–`S4` labels, an owner, and a deferral reason for S3 and S4.

---

## 18. Milestones

| Milestone | Exit gate |
|---|---|
| **M0 — Stabilise** | The in-progress art and class overhaul builds, runs every realm, and passes smoke tests. Pushed. |
| **M1 — Vertical slice** | Tavern, tutorial and Emberwood meet the full standard: art final, UX, accessibility, performance on the minimum tier, and save integrity. **You review it here.** |
| **M2 — Content complete** | All realms, side quests, Rift objectives, Trials and the endgame are in. The content matrix is all "Implemented". |
| **M3 — Systems complete** | Settings, remapping, accessibility, saves, crash handling and performance presets are in. The automation suite is green. |
| **M4 — Beta** | Blind-player test, hardware matrix and balance pass. All S0, S1 and core S2 defects are fixed. |
| **PENCIL DOWN** | Only release blockers can be fixed after this point. |
| **ERC — release candidate** | A reproducible, tagged build; the 24-hour release test; the scorecard signed off. |

---

## 19. Out of scope for 1.0
Multiplayer, online features, in-app purchases, voice acting, localisation beyond English, screen-reader support, mod support, gamepad support, Linux and Steam Deck, and a mobile or web store release.

---

## 20. Decisions (resolved)
1. **Audio:** procedural audio approved as final.
2. **Platforms:** Windows and macOS only for 1.0.
3. **Gamepad / Steam Deck:** deferred past 1.0.
4. **Cuts:** approved. Live hero switching, the Style meter and destructible terrain are removed.
5. **Level cap:** reduced to 20.
