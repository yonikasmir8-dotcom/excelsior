// Player controller: third/first-person camera with collision, WASD movement, soft-lock aiming,
// ability input, hero switching, reviving and interaction.
import * as THREE from 'three';
import { G, activeHero } from '../core/state.js';
import { Input } from '../core/input.js';
import { FX } from './effects.js';
import { enemiesOf, revive, armSelectedDie, sacrificeSelectedDie, heal } from './combat.js';
import { Audio } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { startBreak } from './break.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const Cam = { yaw: 0, pitch: 0.25, dist: 6.5, cur: new THREE.Vector3(), look: new THREE.Vector3(), fp: false };
let targetRing = null, holdT = 0, holdTarget = null;
const KEYS = { Q: 'KeyQ', E: 'KeyE', R: 'KeyR' };

export function initPlayer() {
  targetRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 24), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  targetRing.rotation.x = -Math.PI / 2; G.scene.add(targetRing);
}
export function resetCamera() { const h = activeHero(); if (!h) return; Cam.yaw = h.yaw + Math.PI; Cam.cur.copy(h.pos).add(V(0, 3, -6)); }

export function camForward() { return V(-Math.sin(Cam.yaw) * Math.cos(Cam.pitch), -Math.sin(Cam.pitch), -Math.cos(Cam.yaw) * Math.cos(Cam.pitch)).normalize(); }

function pickTarget(h) {
  const cf = camForward(); const origin = G.camera.position;
  let best = null, bs = Infinity;
  for (const e of enemiesOf('party')) {
    if (e.untargetable) continue;
    const to = e.center().sub(origin); const dist = to.length(); if (dist > 34) continue;
    const ang = to.normalize().angleTo(cf);
    const d2h = e.pos.distanceTo(h.pos);
    if (ang > 0.32 && d2h > 3.5) continue;
    const s = ang * 30 + d2h * 0.25 - (e === h.aimTarget ? 3 : 0);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

export function updatePlayer(dt) {
  const h = activeHero(); if (!h || UI.modalOpen()) { if (targetRing) targetRing.visible = false; return; }
  const sens = 0.0024 * G.settings.sens;
  if (Input.locked) { Cam.yaw -= Input.mouse.dx * sens; Cam.pitch = Math.max(-0.9, Math.min(1.2, Cam.pitch + Input.mouse.dy * sens)); }
  if (Input.hit('KeyV')) { Cam.fp = !Cam.fp; G.settings.camera = Cam.fp ? 'first' : 'third'; }
  // switching heroes
  for (let i = 0; i < 4; i++) if (Input.hit('Digit' + (i + 1)) && G.party[i] && !G.party[i].downed && i !== G.activeIndex) { G.activeIndex = i; Audio.play('panel'); UI.toast(`Now controlling ${G.party[i].name}`); }
  if (h.downed) { const alive = G.party.findIndex((p) => !p.downed); if (alive >= 0) G.activeIndex = alive; }
  const H = activeHero();
  // movement
  const f = V(-Math.sin(Cam.yaw), 0, -Math.cos(Cam.yaw)), r = V(-f.z, 0, f.x);
  const mv = V();
  if (Input.down('KeyW')) mv.add(f); if (Input.down('KeyS')) mv.sub(f); if (Input.down('KeyD')) mv.add(r); if (Input.down('KeyA')) mv.sub(r);
  if (mv.lengthSq()) mv.normalize();
  H.moveInput.copy(mv);
  H.speed = H.cls.stats.speed * (1 + H.gearStat('speed') / 100 + H.t('fleetfoot') * 0.05) * (Input.down('ControlLeft') ? 0.5 : 1);
  if (mv.lengthSq() && !Input.mouseDown(0)) { const want = Math.atan2(mv.x, mv.z); let d = want - H.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; H.yaw += d * Math.min(1, dt * 12); }
  if (Input.hit('Space')) H.jump();
  if (Input.hit('ShiftLeft') || Input.hit('ShiftRight')) H.dash(mv);
  // aim
  H.aimTarget = pickTarget(H);
  const T = () => ({ target: H.aimTarget, dir: camForward(), point: aimPoint(), useFate: true });
  if (Input.mouseDown(0)) { const b = H.basicAbility(); if (!(H.cds.basic > 0)) { if (!H.aimTarget) H.yaw = Math.atan2(camForward().x, camForward().z); H.tryCast(b, T()); } }
  const list = H.abilityList();
  const tryKey = (key) => { const ab = list.find((a) => a.key === key); if (!ab) return; if (H.cds[ab.id] > 0) { UI.flashCd(ab.id); Audio.play('miss'); return; } if (H.tryCast(ab, T()) === false) UI.toast('No target in range.'); };
  if (Input.hit(KEYS.Q)) tryKey('Q'); if (Input.hit(KEYS.E)) tryKey('E'); if (Input.hit(KEYS.R)) tryKey('R'); if (Input.mouseHit(2)) tryKey('RMB');
  // fate dice
  if (Input.mouse.wheel && G.combat.dice.length) { G.combat.sel = (G.combat.sel + Input.mouse.wheel + G.combat.dice.length) % G.combat.dice.length; Audio.play('hover'); }
  if (Input.hit('KeyX')) armSelectedDie();
  if (Input.hit('KeyZ')) sacrificeSelectedDie();
  if (Input.hit('Tab')) startBreak();
  if (Input.hit('KeyH')) usePotion(H);
  // interact / revive (hold F)
  const it = nearestInteract(H);
  G.promptTarget = it;
  if (Input.down('KeyF') && it) {
    if (it.hold) {
      if (holdTarget !== it) { holdTarget = it; holdT = 0; it.onHoldStart && it.onHoldStart(); }
      holdT += dt * (it.revive && H.t('jury_rig') ? 2 : 1); G.holdProgress = holdT / it.hold();
      if (holdT >= it.hold()) { holdT = 0; holdTarget = null; G.holdProgress = 0; it.use(); }
    } else if (Input.hit('KeyF')) it.use();
  } else { holdT = 0; holdTarget = null; G.holdProgress = 0; }
  // target ring
  if (H.aimTarget) { targetRing.visible = true; targetRing.position.copy(H.aimTarget.pos).add(V(0, 0.08, 0)); targetRing.scale.setScalar(H.aimTarget.radius * 2 + 0.4); targetRing.rotation.z += dt * 2; }
  else targetRing.visible = false;
}
function aimPoint() {
  const o = G.camera.position.clone(), d = camForward();
  const hit = G.world.raycast(o, d, 60);
  return hit ? V(hit.x + 0.5, hit.y + 1, hit.z + 0.5) : o.add(d.multiplyScalar(20));
}
function nearestInteract(h) {
  let best = null, bd = Infinity;
  for (const p of G.party) if (p.downed && p !== h && p.pos.distanceTo(h.pos) < 2.5) return { pos: p.pos, radius: 2.5, hold: () => 2.2, revive: true, label: () => `Revive ${p.name} (hold)`, use: () => revive(p) };
  for (const it of G.interactables || []) {
    if (it.cond && !it.cond()) continue;
    const d = it.pos.distanceTo(h.pos); if (d < (it.radius || 2) && d < bd) { bd = d; best = it; }
  }
  return best;
}
export function usePotion(h) {
  if (G.save.potions <= 0) { UI.toast('No potions left! Buy more from Grizzle.'); Audio.play('miss'); return; }
  if (h.hp >= h.maxHp) return;
  G.save.potions--; heal(h, h, h.maxHp * 0.45); Audio.play('heal');
}

export function updateCamera(dt) {
  const h = activeHero(); if (!h) return;
  const cam = G.camera;
  G.fovKick = Math.max(0, (G.fovKick || 0) - dt * 30); const fov = 62 + G.fovKick; if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
  const shake = FX.shake; FX.shake = Math.max(0, FX.shake - dt * 2.5);
  const sx = (Math.random() - 0.5) * shake * 0.6, sy = (Math.random() - 0.5) * shake * 0.6;
  if (Cam.fp && !G.inBreak) {
    h.model.root.visible = false;
    const eye = h.pos.clone().add(V(0, h.height * 0.92, 0));
    cam.position.copy(eye); cam.lookAt(eye.clone().add(camForward())); cam.position.x += sx * 0.2; cam.position.y += sy * 0.2;
    return;
  }
  G.party.forEach((p) => (p.model.root.visible = true));
  const pivot = h.pos.clone().add(V(0, h.height * 0.9, 0));
  const back = V(Math.sin(Cam.yaw) * Math.cos(Cam.pitch), Math.sin(Cam.pitch), Math.cos(Cam.yaw) * Math.cos(Cam.pitch));
  const side = V(-back.z, 0, back.x).normalize().multiplyScalar(-0.9); // over-the-shoulder
  let dist = Cam.dist * (G.inBreak ? 1.25 : 1);
  const hit = G.world.raycast(pivot.clone().add(side), back, dist);
  if (hit) dist = Math.max(1.2, hit.dist - 0.4);
  const want = pivot.clone().add(side).add(back.multiplyScalar(dist));
  Cam.cur.lerp(want, Math.min(1, dt * 14));
  if (Cam.cur.distanceTo(want) > 12) Cam.cur.copy(want);
  cam.position.copy(Cam.cur).add(V(sx, sy, 0));
  const look = pivot.clone().add(side).add(camForward().multiplyScalar(6));
  cam.lookAt(look);
}
