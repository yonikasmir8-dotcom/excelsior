# The Forgotten Tavern

A blocky, comic-book multiverse RPG. Minecraft-style voxel worlds, drawn like a Spider-Verse comic, with D&D rules underneath.

Every realm is fraying. One tavern remembers them all. Gather a party of heroes, walk through its doors into fantasy kingdoms, superhero cities and derelict starships, and find out what is unmaking reality, and why it keeps following *you*.

## Play it

```bash
npm install
npm run dev        # open http://localhost:5173
```

Desktop app (Electron):

```bash
npm run desktop    # builds and opens the game in a native window
npm run package    # builds an installer into release/
```

Keyboard + mouse. Fullscreen recommended.

## What's in the game

- **The Hearth Between**: a hub tavern floating in the void. It has 8 regulars (barkeep, merchant, bard, cartographer, dice shark, cook, ghost, and a very suspicious stranger) and 8 recruitable companions.
- **Six classes**: Fighter, Sorcerer, Artificer, Cleric, Rogue and Ranger. Each has a basic attack, 4 abilities including an ultimate, a unique passive, and two 14-node specialisation trees with keystones. Each class also has 3 legendaries that change how it plays.
- **Realm resonance**: abilities rename and re-flavour in each genre, so a Sorcerer's Firebolt becomes Hot-Shot Blast in the superhero city and Plasma Lance on the starship. Each realm also boosts certain classes.
- **Three flagship realms**, each with its own art style, music, mechanics and boss:
  - **Emberwood Reach** (fantasy): cleanse ley-stones, breach the Hollow Keep, defeat the Hollow King.
  - **Neon Meridian** (superhero): rescue civilians, use jump pads to reach the rooftops, smash Memory Erasers, defeat NULL.
  - **The Asterion** (sci-fi): hack terminals under fire, survive low-gravity hull breaches, shut down CARETAKER.
- **Endless Rifts**: procedural genre mash-ups (Gothic Moon, Candy Apocalypse, Neon Jungle and more) with stacking modifiers, Rift Wardens, Class Trials and scaling loot.
- **The Loom**: the finale, with three endings. One of them needs a skill check to reach.
- **Combat you plan and play**:
  - Real-time action with a visible d20 on every attack.
  - **Fate Dice**: a hand of pre-rolled d20s you spend on the attacks that matter.
  - **Initiative Break**: freeze time and plan a combo for the whole party on a comic page.
  - **14 Team-Ups** that trigger when the right abilities meet.
  - A **Style rank** that rewards variety with bonus loot.
- **Nemesis system**: named captains with traits, weaknesses, scars and memories.
  - They are promoted when they down a hero or escape.
  - They learn to resist whatever nearly killed them, and taunt you with your shared history.
  - They can cheat death and come back, or become Rift-Walkers who hunt you across realms.
  - When one falls for good, someone who saw it happen takes their place.
- **Loot**: 6 rarity tiers, 14 affix types, genre-flavoured names, 18 class legendaries, a shop, and a forge for upgrades and rerolls.
- **Everything is procedural**: voxel worlds, character models, synthesised music and sound. There are no asset files.

## Controls

| Key | Action |
|---|---|
| WASD / Mouse | Move / look |
| Space / Shift | Jump (double jump) / dash |
| LMB, Q, E, RMB, R | Basic attack, abilities (R = ultimate) |
| 1–4 | Switch hero |
| F | Talk / interact / revive (hold) |
| Tab | Initiative Break |
| Wheel, X, Z | Pick / arm / sacrifice Fate Dice |
| H | Potion |
| I, K, P, J | Inventory, Talents, Party, Journal |
| V | First / third person |
| Esc | Pause |

## Tech

Three.js + Vite, plain JavaScript, no build-time assets. The comic look comes from one post-processing shader (`src/core/renderer.js`) that inks depth and normal edges, posterises, adds halftone dots and hatching, and misregisters the colour plates.
