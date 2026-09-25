// INITIATIVE BREAK — freeze time, plan one action for every party member on a comic page,
// then watch it play out as a slow-motion combo. Matching tags trigger Team-Ups for free.
import * as THREE from 'three';
import { G, activeHero } from '../core/state.js';
import { Audio } from '../core/audio.js';
import { emit } from '../core/events.js';
import { UI } from '../ui/ui.js';
import { nearestEnemy, TEAMUPS, triggerTeamUp, addStyle } from './combat.js';
import { shake } from './effects.js';

export function startBreak() {
  const C = G.combat;
  if (G.inBreak) return;
  if (!C.active) { UI.toast('Initiative Break only works in combat.'); return; }
  if (C.meter < 100) { UI.toast(`Break meter at ${Math.floor(C.meter)}%. Land hits, take hits, or sacrifice Fate Dice to fill it.`); Audio.play('miss'); return; }
  G.inBreak = true; G.timeScale = 0; Audio.play('breakStart'); shake(0.3); UI.speedlines(true);
  const members = G.party.filter((h) => !h.downed);
  UI.openBreak(members, (choices) => execute(choices));
}

function execute(choices) {
  G.combat.meter = 0;
  UI.closeBreak();
  G.timeScale = 0.3;
  let i = 0;
  const step = () => {
    if (i >= choices.length) { finish(choices); return; }
    const { hero, ability } = choices[i++];
    if (hero.downed || !ability) { step(); return; }
    const t = (activeHero().aimTarget && !activeHero().aimTarget.dead) ? activeHero().aimTarget : nearestEnemy(hero, 'party', 30);
    if (!t) { step(); return; }
    UI.breakPanel(hero, ability, i, choices.length);
    Audio.play('panel');
    hero.faceTo(t.pos, 1);
    const T = { target: t, dir: t.center().sub(hero.center()).normalize(), point: t.pos.clone(), forced: true, useFate: false };
    // melee heroes leap to their target first
    if ((ability.id === 'basic' || ['cleave', 'whirlwind', 'shadowstep', 'charge'].includes(ability.id)) && hero.pos.distanceTo(t.pos) > 3) {
      const dir = t.pos.clone().sub(hero.pos); dir.y = 0; const d = dir.length() - 1.5; dir.normalize(); hero.pos.addScaledVector(dir, Math.max(0, d)); hero.pos.y = t.pos.y + 0.2;
    }
    hero.tryCast(ability, T);
    setTimeout(step, 650);
  };
  G.inBreak = false;
  step();
}
function finish(choices) {
  // team-ups between chosen abilities (each pair once)
  const done = new Set();
  for (let a = 0; a < choices.length; a++) for (let b = a + 1; b < choices.length; b++) {
    const A = choices[a], B = choices[b]; if (!A.ability || !B.ability) continue;
    for (const ta of A.ability.tags || []) for (const tb of B.ability.tags || []) {
      const tu = TEAMUPS.find((t) => (t.a === ta && t.b === tb) || (t.a === tb && t.b === ta));
      if (tu && !done.has(tu.id)) {
        done.add(tu.id);
        const tgt = nearestEnemy(A.hero, 'party', 30);
        const pos = tgt ? tgt.pos.clone() : A.hero.pos.clone();
        setTimeout(() => triggerTeamUp(tu, pos, A.hero, B.hero), 300 * done.size);
      }
    }
  }
  addStyle(50);
  setTimeout(() => { G.timeScale = 1; UI.breakDone(done.size); emit('breakDone'); }, 300 * (done.size + 1) + 200);
}
