// Chunky voxel character models, animated "on twos" (12 fps) for the Spider-Verse feel.
import * as THREE from 'three';

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = w + ',' + h + ',' + d;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

export class VoxelModel {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.mats = [];
    this.parts = {};
    this.flashT = 0; this.animT = 0; this.stepT = 0;
    this.state = 'idle'; this.stateT = 0;
    const s = spec.scale || 1;
    this.body.scale.setScalar(s);
    const kind = spec.kind || 'humanoid';
    if (kind === 'humanoid' || kind === 'giant') this.buildHumanoid(spec);
    else if (kind === 'beast') this.buildBeast(spec);
    else if (kind === 'drone') this.buildDrone(spec);
    else if (kind === 'blob') this.buildBlob(spec);
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  }
  mat(c) { const m = new THREE.MeshLambertMaterial({ color: c }); this.mats.push(m); return m; }
  box(parent, w, h, d, c, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(boxGeo(w, h, d), typeof c === 'number' || typeof c === 'string' ? this.mat(c) : c);
    m.position.set(x, y, z); parent.add(m); return m;
  }
  pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  buildHumanoid(sp) {
    const C = sp.colors;
    const bulk = sp.bulk || 1;
    const hips = this.pivot(this.body, 0, 0.72, 0); this.parts.hips = hips;
    const torso = this.pivot(hips, 0, 0, 0); this.parts.torso = torso;
    this.box(torso, 0.56 * bulk, 0.66, 0.34 * bulk, C.body, 0, 0.33, 0);
    this.box(torso, 0.58 * bulk, 0.1, 0.36 * bulk, C.accent, 0, 0.05, 0); // belt
    const neck = this.pivot(torso, 0, 0.66, 0); this.parts.head = neck;
    this.box(neck, 0.46, 0.46, 0.46, C.skin, 0, 0.23, 0);
    // eyes — big comic eyes
    const eyeC = C.eye ?? 0x111111;
    this.box(neck, 0.09, 0.12, 0.02, eyeC, -0.1, 0.25, 0.235);
    this.box(neck, 0.09, 0.12, 0.02, eyeC, 0.1, 0.25, 0.235);
    if (sp.glowEyes) { const gm = new THREE.MeshBasicMaterial({ color: sp.glowEyes }); this.box(neck, 0.1, 0.06, 0.03, gm, -0.1, 0.26, 0.24); this.box(neck, 0.1, 0.06, 0.03, gm, 0.1, 0.26, 0.24); }
    if (C.hair) this.box(neck, 0.5, 0.14, 0.5, C.hair, 0, 0.46, -0.02);
    if (C.hair && sp.longHair) this.box(neck, 0.5, 0.4, 0.12, C.hair, 0, 0.22, -0.24);
    if (sp.beard) this.box(neck, 0.4, 0.2, 0.08, sp.beard, 0, 0.06, 0.24);
    const armW = 0.18 * bulk;
    const aL = this.pivot(torso, -0.28 * bulk - armW / 2, 0.6, 0), aR = this.pivot(torso, 0.28 * bulk + armW / 2, 0.6, 0);
    this.box(aL, armW, 0.62, armW, C.body, 0, -0.26, 0); this.box(aL, armW + 0.01, 0.14, armW + 0.01, C.skin, 0, -0.56, 0);
    this.box(aR, armW, 0.62, armW, C.body, 0, -0.26, 0); this.box(aR, armW + 0.01, 0.14, armW + 0.01, C.skin, 0, -0.56, 0);
    this.parts.armL = aL; this.parts.armR = aR;
    const lL = this.pivot(hips, -0.14 * bulk, 0, 0), lR = this.pivot(hips, 0.14 * bulk, 0, 0);
    this.box(lL, 0.22 * bulk, 0.72, 0.24, C.legs, 0, -0.36, 0); this.box(lL, 0.24 * bulk, 0.14, 0.3, C.boots ?? 0x2a1a10, 0, -0.66, 0.03);
    this.box(lR, 0.22 * bulk, 0.72, 0.24, C.legs, 0, -0.36, 0); this.box(lR, 0.24 * bulk, 0.14, 0.3, C.boots ?? 0x2a1a10, 0, -0.66, 0.03);
    this.parts.legL = lL; this.parts.legR = lR;
    this.addHat(neck, sp.hat, C);
    this.addWeapon(aR, sp.weapon, C);
    for (const e of sp.extras || []) this.addExtra(e, C, torso, neck, aL);
  }
  addHat(neck, hat, C) {
    const a = C.hat ?? C.accent;
    switch (hat) {
      case 'wizard': this.box(neck, 0.62, 0.06, 0.62, a, 0, 0.5, 0); this.box(neck, 0.4, 0.22, 0.4, a, 0, 0.64, 0); this.box(neck, 0.26, 0.2, 0.26, a, 0.03, 0.84, -0.03); this.box(neck, 0.12, 0.16, 0.12, a, 0.08, 1.0, -0.08); break;
      case 'helm': this.box(neck, 0.52, 0.3, 0.52, 0x9aa4b0, 0, 0.38, 0); this.box(neck, 0.06, 0.24, 0.06, 0xd04040, 0, 0.62, 0); break;
      case 'hood': this.box(neck, 0.54, 0.5, 0.54, a, 0, 0.3, -0.03); this.box(neck, 0.42, 0.34, 0.02, 0x0c0a10, 0, 0.23, 0.25); break;
      case 'goggles': this.box(neck, 0.5, 0.1, 0.5, 0x5a3a20, 0, 0.36, 0); this.box(neck, 0.14, 0.12, 0.06, 0x60e0ff, -0.1, 0.36, 0.25); this.box(neck, 0.14, 0.12, 0.06, 0x60e0ff, 0.1, 0.36, 0.25); break;
      case 'crown': for (let i = 0; i < 4; i++) this.box(neck, 0.1, 0.18, 0.1, 0xffcc30, -0.18 + i * 0.12, 0.54, 0.2); this.box(neck, 0.5, 0.08, 0.5, 0xffcc30, 0, 0.48, 0); break;
      case 'halo': { const m = new THREE.MeshBasicMaterial({ color: 0xfff080 }); this.box(neck, 0.5, 0.04, 0.08, m, 0, 0.7, 0.2); this.box(neck, 0.5, 0.04, 0.08, m, 0, 0.7, -0.2); this.box(neck, 0.08, 0.04, 0.4, m, 0.22, 0.7, 0); this.box(neck, 0.08, 0.04, 0.4, m, -0.22, 0.7, 0); break; }
      case 'mohawk': this.box(neck, 0.1, 0.24, 0.5, a, 0, 0.56, 0); break;
      case 'cap': this.box(neck, 0.5, 0.12, 0.5, a, 0, 0.5, 0); this.box(neck, 0.5, 0.04, 0.2, a, 0, 0.45, 0.32); break;
      case 'visor': { const m = new THREE.MeshBasicMaterial({ color: C.visor ?? 0xff3050 }); this.box(neck, 0.48, 0.1, 0.04, m, 0, 0.26, 0.24); break; }
      case 'mask': this.box(neck, 0.48, 0.16, 0.04, a, 0, 0.26, 0.235); break;
      case 'antlers': this.box(neck, 0.06, 0.3, 0.06, 0xd8c8a0, -0.18, 0.6, 0); this.box(neck, 0.06, 0.3, 0.06, 0xd8c8a0, 0.18, 0.6, 0); this.box(neck, 0.2, 0.06, 0.06, 0xd8c8a0, -0.26, 0.72, 0); this.box(neck, 0.2, 0.06, 0.06, 0xd8c8a0, 0.26, 0.72, 0); break;
      case 'horns': this.box(neck, 0.1, 0.22, 0.1, 0xe8e0c8, -0.2, 0.52, 0.05); this.box(neck, 0.1, 0.22, 0.1, 0xe8e0c8, 0.2, 0.52, 0.05); break;
      case 'bandana': this.box(neck, 0.5, 0.12, 0.5, a, 0, 0.4, 0); this.box(neck, 0.1, 0.1, 0.2, a, 0, 0.36, -0.3); break;
      case 'chef': this.box(neck, 0.4, 0.34, 0.4, 0xf8f8f8, 0, 0.62, 0); break;
      case 'tophat': this.box(neck, 0.6, 0.04, 0.6, 0x1a1a1a, 0, 0.48, 0); this.box(neck, 0.38, 0.4, 0.38, 0x1a1a1a, 0, 0.7, 0); this.box(neck, 0.39, 0.06, 0.39, a, 0, 0.54, 0); break;
      case 'dome': { const m = new THREE.MeshLambertMaterial({ color: 0xa0e8ff, transparent: true, opacity: 0.35 }); this.mats.push(m); this.box(neck, 0.64, 0.64, 0.64, m, 0, 0.26, 0); break; }
      default: break;
    }
  }
  addWeapon(arm, w, C) {
    const g = this.pivot(arm, 0, -0.58, 0.08); this.parts.weapon = g;
    const metal = 0xc8d0dc, wood = 0x7a4a24;
    switch (w) {
      case 'sword': this.box(g, 0.06, 0.2, 0.06, wood, 0, 0, 0); this.box(g, 0.24, 0.06, 0.08, 0xd0a030, 0, 0.1, 0); this.box(g, 0.1, 0.9, 0.04, metal, 0, 0.58, 0); break;
      case 'greatsword': this.box(g, 0.06, 0.26, 0.06, wood, 0, 0, 0); this.box(g, 0.34, 0.08, 0.1, 0x303030, 0, 0.14, 0); this.box(g, 0.16, 1.3, 0.05, metal, 0, 0.84, 0); break;
      case 'axe': this.box(g, 0.07, 1.0, 0.07, wood, 0, 0.4, 0); this.box(g, 0.34, 0.3, 0.05, metal, 0.12, 0.8, 0); break;
      case 'staff': this.box(g, 0.07, 1.4, 0.07, wood, 0, 0.3, 0); { const m = new THREE.MeshBasicMaterial({ color: C.magic ?? 0xff6a30 }); this.box(g, 0.18, 0.18, 0.18, m, 0, 1.06, 0); } break;
      case 'wand': this.box(g, 0.05, 0.5, 0.05, 0x3a2030, 0, 0.2, 0); { const m = new THREE.MeshBasicMaterial({ color: C.magic ?? 0xc070ff }); this.box(g, 0.09, 0.09, 0.09, m, 0, 0.48, 0); } break;
      case 'wrench': this.box(g, 0.08, 0.7, 0.08, 0x909aa8, 0, 0.3, 0); this.box(g, 0.26, 0.14, 0.08, 0x909aa8, 0, 0.68, 0); this.box(g, 0.08, 0.1, 0.09, 0x222222, 0, 0.76, 0); break;
      case 'mace': this.box(g, 0.07, 0.7, 0.07, wood, 0, 0.3, 0); this.box(g, 0.24, 0.24, 0.24, 0xe0c060, 0, 0.7, 0); break;
      case 'daggers': this.box(g, 0.05, 0.14, 0.05, 0x201818, 0, 0, 0); this.box(g, 0.06, 0.44, 0.03, metal, 0, 0.28, 0);
        { const g2 = this.pivot(this.parts.armL, 0, -0.58, 0.08); this.box(g2, 0.05, 0.14, 0.05, 0x201818, 0, 0, 0); this.box(g2, 0.06, 0.44, 0.03, metal, 0, 0.28, 0); } break;
      case 'bow': this.box(g, 0.06, 1.1, 0.06, wood, 0, 0.2, 0.08); this.box(g, 0.02, 1.0, 0.02, 0xeeeeee, 0, 0.2, -0.04); break;
      case 'gun': this.box(g, 0.1, 0.16, 0.1, 0x303040, 0, 0, 0); this.box(g, 0.1, 0.12, 0.44, 0x404058, 0, 0.1, 0.18); { const m = new THREE.MeshBasicMaterial({ color: C.magic ?? 0x40ffd0 }); this.box(g, 0.06, 0.06, 0.06, m, 0, 0.1, 0.42); } break;
      case 'rifle': this.box(g, 0.1, 0.12, 0.8, 0x2a2a34, 0, 0.1, 0.3); this.box(g, 0.08, 0.2, 0.1, 0x2a2a34, 0, -0.02, 0); break;
      case 'claws': this.box(g, 0.2, 0.06, 0.3, 0xe0e0e0, 0, 0.04, 0.1); break;
      case 'shieldfist': this.box(g, 0.24, 0.24, 0.24, C.accent, 0, 0.06, 0); break;
      case 'club': this.box(g, 0.12, 0.9, 0.12, 0x5a3a1a, 0, 0.4, 0); this.box(g, 0.2, 0.3, 0.2, 0x5a3a1a, 0, 0.8, 0); break;
      case 'baton': { const m = new THREE.MeshBasicMaterial({ color: C.magic ?? 0x40c0ff }); this.box(g, 0.07, 0.7, 0.07, m, 0, 0.3, 0); } break;
      case 'lute': this.box(g, 0.3, 0.36, 0.1, 0xb07030, 0, 0.1, 0.1); this.box(g, 0.06, 0.5, 0.05, 0x5a3010, 0, 0.5, 0.1); break;
      default: break;
    }
  }
  addExtra(e, C, torso, neck, armL) {
    switch (e) {
      case 'cape': { const p = this.pivot(torso, 0, 0.64, -0.18); this.parts.cape = p; this.box(p, 0.56, 0.9, 0.05, C.cape ?? C.accent, 0, -0.45, 0); break; }
      case 'backpack': this.box(torso, 0.44, 0.44, 0.2, 0x8a5a30, 0, 0.38, -0.26); this.box(torso, 0.1, 0.1, 0.1, 0xffb030, 0.12, 0.6, -0.34); break;
      case 'jetpack': this.box(torso, 0.18, 0.44, 0.18, 0x808890, -0.12, 0.38, -0.26); this.box(torso, 0.18, 0.44, 0.18, 0x808890, 0.12, 0.38, -0.26); break;
      case 'shield': this.box(armL, 0.06, 0.6, 0.5, C.shield ?? 0x6080c0, -0.14, -0.3, 0.06); this.box(armL, 0.07, 0.2, 0.2, 0xffd040, -0.15, -0.3, 0.06); break;
      case 'shoulder': this.box(torso, 0.26, 0.14, 0.4, 0x9aa4b0, -0.36, 0.64, 0); this.box(torso, 0.26, 0.14, 0.4, 0x9aa4b0, 0.36, 0.64, 0); break;
      case 'quiver': this.box(torso, 0.16, 0.5, 0.16, 0x6a4020, 0.12, 0.44, -0.24); this.box(torso, 0.12, 0.14, 0.12, 0xf0f0f0, 0.12, 0.74, -0.24); break;
      case 'scar': this.box(neck, 0.04, 0.24, 0.02, 0xa02020, 0.14, 0.26, 0.236); break;
      case 'eyepatch': this.box(neck, 0.14, 0.14, 0.03, 0x111111, 0.1, 0.26, 0.24); this.box(neck, 0.48, 0.04, 0.48, 0x111111, 0, 0.3, 0); break;
      case 'metaljaw': this.box(neck, 0.44, 0.14, 0.06, 0xb0b8c0, 0, 0.06, 0.23); break;
      case 'bandage': this.box(neck, 0.48, 0.06, 0.48, 0xf0e8d8, 0, 0.36, 0); break;
      case 'tail': { const t = this.pivot(this.parts.hips, 0, 0.05, -0.18); this.parts.tail = t; this.box(t, 0.1, 0.1, 0.5, C.body, 0, 0, -0.25); break; }
      case 'spikes': for (let i = 0; i < 3; i++) this.box(torso, 0.08, 0.2, 0.08, 0xe0e0e0, 0, 0.3 + i * 0.16, -0.2); break;
      case 'apron': this.box(torso, 0.5, 0.6, 0.02, 0xf0e8d0, 0, 0.1, 0.18); break;
      case 'robe': this.box(this.parts.hips, 0.58, 0.6, 0.38, C.body, 0, -0.3, 0); break;
      case 'chestlight': { const m = new THREE.MeshBasicMaterial({ color: C.magic ?? 0x60e0ff }); this.box(torso, 0.16, 0.16, 0.02, m, 0, 0.44, 0.18); break; }
      case 'emblem': this.box(torso, 0.24, 0.2, 0.02, C.emblem ?? 0xffd020, 0, 0.44, 0.18); break;
      case 'wings': { const p = this.pivot(torso, 0, 0.5, -0.2); this.parts.wings = p; this.box(p, 1.4, 0.5, 0.04, C.wing ?? 0x303040, 0, 0.1, 0); break; }
      default: break;
    }
  }
  buildBeast(sp) {
    const C = sp.colors;
    const hips = this.pivot(this.body, 0, 0.62, 0); this.parts.hips = hips;
    const torso = this.pivot(hips, 0, 0, 0); this.parts.torso = torso;
    this.box(torso, 0.6, 0.5, 1.1, C.body, 0, 0.15, 0);
    const neck = this.pivot(torso, 0, 0.35, 0.55); this.parts.head = neck;
    this.box(neck, 0.46, 0.42, 0.5, C.body, 0, 0.1, 0.18);
    this.box(neck, 0.3, 0.2, 0.26, C.skin ?? C.body, 0, 0.0, 0.52);
    this.box(neck, 0.1, 0.18, 0.1, C.body, -0.16, 0.36, 0.1); this.box(neck, 0.1, 0.18, 0.1, C.body, 0.16, 0.36, 0.1);
    const eye = sp.glowEyes ? new THREE.MeshBasicMaterial({ color: sp.glowEyes }) : (C.eye ?? 0xffe040);
    this.box(neck, 0.08, 0.08, 0.02, eye, -0.12, 0.18, 0.44); this.box(neck, 0.08, 0.08, 0.02, eye, 0.12, 0.18, 0.44);
    const legs = [[-0.2, 0.4], [0.2, 0.4], [-0.2, -0.4], [0.2, -0.4]].map(([x, z]) => { const p = this.pivot(hips, x, 0, z); this.box(p, 0.18, 0.62, 0.18, C.legs ?? C.body, 0, -0.3, 0); return p; });
    this.parts.legs = legs;
    this.parts.legL = legs[0]; this.parts.legR = legs[1];
    const t = this.pivot(hips, 0, 0.25, -0.55); this.parts.tail = t; this.box(t, 0.12, 0.12, 0.5, C.body, 0, 0, -0.25);
    for (const e of sp.extras || []) if (e === 'spikes') for (let i = 0; i < 4; i++) this.box(torso, 0.08, 0.2, 0.08, 0xe0e0e0, 0, 0.5, -0.4 + i * 0.25);
  }
  buildDrone(sp) {
    const C = sp.colors;
    const core = this.pivot(this.body, 0, 1.2, 0); this.parts.torso = core; this.parts.head = core;
    this.box(core, 0.7, 0.5, 0.7, C.body, 0, 0, 0);
    this.box(core, 0.8, 0.1, 0.8, C.accent, 0, 0.28, 0);
    const eye = new THREE.MeshBasicMaterial({ color: sp.glowEyes ?? 0xff3040 });
    this.box(core, 0.3, 0.16, 0.04, eye, 0, 0, 0.36);
    const rL = this.pivot(core, -0.55, 0.1, 0), rR = this.pivot(core, 0.55, 0.1, 0);
    this.box(rL, 0.3, 0.06, 0.3, C.accent, 0, 0, 0); this.box(rR, 0.3, 0.06, 0.3, C.accent, 0, 0, 0);
    this.parts.armL = rL; this.parts.armR = rR;
  }
  buildBlob(sp) {
    const C = sp.colors;
    const core = this.pivot(this.body, 0, 0, 0); this.parts.torso = core; this.parts.head = core;
    this.box(core, 0.9, 0.7, 0.9, C.body, 0, 0.35, 0);
    this.box(core, 0.6, 0.3, 0.6, C.body, 0, 0.8, 0);
    const eye = sp.glowEyes ? new THREE.MeshBasicMaterial({ color: sp.glowEyes }) : 0x111111;
    this.box(core, 0.12, 0.16, 0.02, eye, -0.16, 0.55, 0.46); this.box(core, 0.12, 0.16, 0.02, eye, 0.16, 0.55, 0.46);
    if (sp.hat === 'mushroom') { this.box(core, 1.2, 0.3, 1.2, C.accent, 0, 1.05, 0); this.box(core, 0.2, 0.08, 0.2, 0xffffff, 0.3, 1.21, 0.2); this.box(core, 0.2, 0.08, 0.2, 0xffffff, -0.3, 1.21, -0.2); }
  }

  flash(color = 0xffffff, t = 0.12) { this.flashT = t; this.flashColor = color; }
  play(state, dur = 0.4) { this.state = state; this.stateT = dur; this.stateDur = dur; }

  update(dt, moving, speed01, grounded) {
    this.animT += dt;
    const st = Math.floor(this.animT * 12) / 12; // on twos
    if (this.stateT > 0) { this.stateT -= dt; if (this.stateT <= 0) this.state = 'idle'; }
    const P = this.parts;
    const k = this.stateT > 0 ? 1 - this.stateT / this.stateDur : 0;
    const q = Math.floor(k * 6) / 6;
    const walk = moving ? Math.sin(st * 11 * (0.6 + speed01 * 0.6)) : 0;
    if (P.legL) { P.legL.rotation.x = walk * 0.8; P.legR.rotation.x = -walk * 0.8; }
    if (P.legs) { P.legs[2].rotation.x = -walk * 0.8; P.legs[3].rotation.x = walk * 0.8; }
    if (P.armL && P.armL.rotation) { P.armL.rotation.x = -walk * 0.7; P.armR.rotation.x = walk * 0.7; P.armL.rotation.z = 0; P.armR.rotation.z = 0; }
    if (P.hips && this.spec.kind !== 'beast') P.hips.position.y = 0.72 + (moving ? Math.abs(walk) * 0.06 : Math.sin(st * 2) * 0.015);
    if (P.torso && this.spec.kind === 'drone') P.torso.position.y = 1.2 + Math.sin(st * 3) * 0.12;
    if (P.torso && this.spec.kind === 'blob') P.torso.scale.set(1 + Math.sin(st * 5) * 0.06, 1 - Math.sin(st * 5) * 0.06, 1 + Math.sin(st * 5) * 0.06);
    if (P.tail) P.tail.rotation.y = Math.sin(st * 6) * 0.5;
    if (P.cape) P.cape.rotation.x = 0.1 + (moving ? 0.5 : 0.05) + Math.sin(st * 4) * 0.05;
    if (P.wings) P.wings.rotation.x = Math.sin(st * 8) * 0.15;
    if (!grounded && P.legL) { P.legL.rotation.x = -0.6; P.legR.rotation.x = 0.3; if (P.armL && P.armR) { P.armL.rotation.z = -0.6; P.armR.rotation.z = 0.6; } }
    this.body.rotation.set(0, 0, 0); this.body.position.y = 0;
    if (P.torso) P.torso.rotation.set(0, 0, 0);
    switch (this.state) {
      case 'attack': if (P.armR) { P.armR.rotation.x = q < 0.4 ? -2.6 : -2.6 + (q - 0.4) * 5.5; P.armR.rotation.z = 0; } if (P.torso) P.torso.rotation.y = q < 0.4 ? 0.4 : -0.5; break;
      case 'thrust': if (P.armR) P.armR.rotation.x = -1.5; if (P.armL && P.armL.rotation) P.armL.rotation.x = -1.5; if (P.torso) P.torso.rotation.y = -0.2; break;
      case 'cast': if (P.armR) { P.armR.rotation.x = -2.8; P.armL.rotation.x = -2.8; P.armR.rotation.z = 0.3; P.armL.rotation.z = -0.3; } break;
      case 'shoot': if (P.armR) { P.armR.rotation.x = -1.57; P.armL.rotation.x = -1.4; P.armL.rotation.z = 0.5; } break;
      case 'spin': this.body.rotation.y = q * Math.PI * 2; if (P.armR) { P.armR.rotation.z = 1.4; P.armL.rotation.z = -1.4; } break;
      case 'slam': if (P.armR) { P.armR.rotation.x = q < 0.5 ? -3 : 0; P.armL.rotation.x = q < 0.5 ? -3 : 0; } this.body.position.y = q < 0.5 ? q * 0.8 : 0; break;
      case 'hurt': this.body.rotation.x = -0.25; break;
      case 'bite': if (P.head) P.head.rotation.x = q < 0.5 ? -0.5 : 0.3; this.body.position.z = q < 0.5 ? 0 : 0.3; break;
      case 'down': this.body.rotation.x = -Math.PI / 2; this.body.position.y = 0.2; break;
      case 'cheer': if (P.armR) { P.armR.rotation.z = Math.PI - 0.3 + Math.sin(st * 20) * 0.2; P.armL.rotation.z = -Math.PI + 0.3; } this.body.position.y = Math.abs(Math.sin(st * 10)) * 0.2; break;
      case 'drink': if (P.armR) P.armR.rotation.x = -2.2; if (P.head) P.head.rotation.x = -0.4; break;
      case 'sit': if (P.legL) { P.legL.rotation.x = -1.5; P.legR.rotation.x = -1.5; } this.body.position.y = -0.45; break;
      default: if (P.head) P.head.rotation.x = 0; break;
    }
    if (this.downed) { this.body.rotation.x = -Math.PI / 2; this.body.position.y = 0.25; }
    if (this.flashT > 0) {
      this.flashT -= dt;
      const on = this.flashT > 0;
      for (const m of this.mats) { if (m.emissive) m.emissive.setHex(on ? this.flashColor : 0x000000); }
    }
  }
  dispose() { for (const m of this.mats) m.dispose(); }
}
