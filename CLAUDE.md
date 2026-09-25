# The Forgotten Tavern — project memory

Browser/desktop voxel action-RPG. Three.js + Vite, plain JS (ES modules), no TypeScript, no asset files (everything procedural).

## Run
- `npm run dev` → http://localhost:5173
- `npm run build` → `dist/`; `npm run desktop` → Electron window

## Layout
- `src/core/` — state (`G`), renderer (comic post shader + per-realm STYLES), input, audio (Web Audio synth), rng/noise, events bus
- `src/world/` — `voxel.js` (chunked meshing, collision, raycast, explode), `palettes.js`, `gen.js` (tavern / emberwood / neon / asterion / rift / loom generators)
- `src/entities/` — `actor.js` base physics, `hero.js`, `enemy.js` (AI + captains), `minion.js` (turret/bot/wolf/decoy), `npc.js`, `model.js` (voxel models animated at 12 fps)
- `src/game/` — `classes.js` (6 classes, abilities, talents, legendary flags), `combat.js` (d20 rolls, Fate Dice, damage, Style, Team-Ups), `break.js` (Initiative Break), `ai.js` (companions), `bosses.js`, `nemesis.js`, `loot.js`, `realms.js` (location loading + realm quest scripts), `progress.js` (xp, drops, nemesis reactions, banter), `player.js` (controller + camera), `save.js`
- `src/content/` — `npcs.js`, `dialogue.js` (all conversations; nodes support skill checks), `banter.js`
- `src/ui/` — `ui.js` (HUD, menus, dialogue, break page, nemesis cards, inventory, talents, shop, forge, journal), `style.css`

## Conventions
- Everything talks through `G` (src/core/state.js) and the event bus (`on/emit`).
- Abilities: `{ id, key, lvl, name, cd, tags, desc, cast(caster, T) }`; `T = { target, dir, point, forced }`. Tags drive Team-Ups.
- Every hostile attack must telegraph (windup flash or ground `telegraph()`), so combat stays fair.
- Dialogue lives in `content/dialogue.js`; game actions come via the `A` API object built in `main.js`.
- Saves are JSON in localStorage (`forgotten-tavern-save-N`), so keep the save shape backward compatible.
- Debug handles: `window.__G`, `window.__API`, `window.__UI`.
