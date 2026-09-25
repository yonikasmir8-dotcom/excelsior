// Heroic character models: sculpted from smooth primitives with heroic proportions (broad shoulders,
// tapered waist), real armour, cloth and weapons. Same part/animation API as before.
import * as THREE from 'three';

const geo = new Map();
function G_(key, make) { if (!geo.has(key)) geo.set(key, make()); return geo.get(key); }
const capsule = (r, l) => G_(`cap${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));
const sphere = (r) => G_(`sph${r}`, () => new THREE.SphereGeometry(r, 16, 12));
const cyl = (a, b, h, s = 12) => G_(`cyl${a}|${b}|${h}|${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const cone = (r, h, s = 12) => G_(`cone${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const boxg = (w, h, d) => G_(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const torus = (r, t, s = 16) => G_(`tor${r}|${t}|${s}`, () => new THREE.TorusGeometry(r, t, 6, s));
const halfSphere = (r) => G_(`hs${r}`, () => new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
const blade = (w, l) => G_(`blade${w}|${l}`, () => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, l * 0.85); s.lineTo(0, l); s.lineTo(-w / 2, l * 0.85); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1 }); g.translate(0, 0, -0.01); return g; });

const METAL = 0xb8bcc8, LEATHER = 0x6a4a30, FUR = 0xd8c8a8, GOLD = 0xd8a840;

export class VoxelModel {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.mats = []; this.matCache = new Map();
    this.parts = {};
    this.flashT = 0; this.animT = Math.random() * 10;
    this.state = 'idle'; this.stateT = 0;
    this.body.scale.setScalar(spec.scale || 1);
    const kind = spec.kind || 'humanoid';
    if (kind === 'humanoid' || kind === 'giant') this.buildHumanoid(spec);
    else if (kind === 'beast') this.buildBeast(spec);
    else if (kind === 'drone') this.buildDrone(spec);
    else if (kind === 'blob') this.buildBlob(spec);
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  }
  mat(c, o = {}) {
    const key = c + '|' + (o.metal || 0) + '|' + (o.glow || 0) + '|' + (o.rough || 0);
    if (this.matCache.has(key)) return this.matCache.get(key);
    const m = o.glow ? new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(c), emissiveIntensity: o.glow, roughness: 0.4 })
      : new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? (o.metal ? 0.32 : 0.72), metalness: o.metal || 0 });
    if (!o.glow) this.mats.push(m);
    this.matCache.set(key, m); return m;
  }
  add(parent, g, c, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(g, typeof c === 'object' ? c : this.mat(c, o));
    m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    if (o.s) m.scale.set(...(Array.isArray(o.s) ? o.s : [o.s, o.s, o.s]));
    parent.add(m); return m;
  }
  pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  buildHumanoid(sp) {
    const C = sp.colors; const bulk = sp.bulk || 1; const heroic = sp.heroic ?? 1;
    const skin = C.skin ?? 0xe0a880, cloth = C.body, legs = C.legs, acc = C.accent ?? GOLD, boots = C.boots ?? 0x4a3020;
    const hips = this.pivot(this.body, 0, 0.95, 0); this.parts.hips = hips;
    const torso = this.pivot(hips, 0, 0, 0); this.parts.torso = torso;
    const sw = (0.26 + 0.05 * heroic) * bulk; // shoulder half-width
    // waist → chest: tapered, heroic V
    this.add(torso, cyl(0.2 * bulk, 0.17 * bulk, 0.3), cloth, 0, 0.14, 0);
    this.add(torso, sphere(0.25), cloth, 0, 0.5, 0, { s: [1.35 * bulk * (0.9 + heroic * 0.1), 1.05, 0.82 * bulk] });
    this.add(torso, torus(0.2 * bulk, 0.035), acc, 0, 0.02, 0, { rx: Math.PI / 2, s: [1, 0.85, 1] }); // belt
    this.add(torso, cyl(0.035, 0.035, 0.08, 8), GOLD, 0, 0.02, 0.19 * bulk, { rx: Math.PI / 2, metal: 0.8 }); // buckle
    this.add(torso, sphere(0.13), cloth, -sw, 0.64, 0, { s: bulk }); this.add(torso, sphere(0.13), cloth, sw, 0.64, 0, { s: bulk });
    this.add(torso, cyl(0.07, 0.08, 0.14, 10), skin, 0, 0.78, 0);
    const neck = this.pivot(torso, 0, 0.84, 0); this.parts.head = neck;
    this.add(neck, sphere(0.16), skin, 0, 0.13, 0.01, { s: [0.95, 1.12, 1] });
    this.add(neck, sphere(0.06), skin, 0, 0.06, 0.1, { s: [1.3, 0.8, 1] }); // jaw
    const eye = sp.glowEyes ? this.mat(sp.glowEyes, { glow: 3 }) : (C.eye ?? 0x1a1414);
    this.add(neck, sphere(0.022), eye, -0.055, 0.15, 0.135); this.add(neck, sphere(0.022), eye, 0.055, 0.15, 0.135);
    this.add(neck, boxg(0.1, 0.018, 0.02), C.hair ?? 0x3a2a1a, -0.055, 0.195, 0.14, { rz: 0.15 }); this.add(neck, boxg(0.1, 0.018, 0.02), C.hair ?? 0x3a2a1a, 0.055, 0.195, 0.14, { rz: -0.15 });
    if (C.hair != null) {
      this.add(neck, halfSphere(0.172), C.hair, 0, 0.17, -0.01, { s: [1, 0.9, 1.05] });
      if (sp.longHair) this.add(neck, capsule(0.12, 0.25), C.hair, 0, 0.02, -0.1, { s: [1.3, 1, 0.6] });
    }
    if (sp.beard) this.add(neck, cone(0.1, 0.2, 10), sp.beard, 0, 0.0, 0.1, { rx: Math.PI });
    // arms (shoulder pivot → upper arm → elbow → forearm → hand)
    const armR_ = 0.07 * bulk * (0.9 + heroic * 0.15);
    const mkArm = (side) => {
      const a = this.pivot(torso, side * (sw + 0.06), 0.64, 0);
      this.add(a, capsule(armR_ * 1.05, 0.22), skin, 0, -0.17, 0);
      const el = this.pivot(a, 0, -0.34, 0); el.rotation.x = -0.25;
      this.add(el, capsule(armR_, 0.2), skin, 0, -0.14, 0);
      this.add(el, cyl(armR_ * 1.25, armR_ * 1.35, 0.14, 10), sp.bracers ?? LEATHER, 0, -0.16, 0);
      this.add(el, sphere(armR_ * 1.1), skin, 0, -0.32, 0.01);
      a.userData.hand = el; return a;
    };
    this.parts.armL = mkArm(-1); this.parts.armR = mkArm(1);
    if (sp.sleeves) { this.add(this.parts.armL, capsule(armR_ * 1.2, 0.18), cloth, 0, -0.15, 0); this.add(this.parts.armR, capsule(armR_ * 1.2, 0.18), cloth, 0, -0.15, 0); }
    // legs
    const mkLeg = (side) => {
      const l = this.pivot(hips, side * 0.11 * bulk, 0, 0);
      this.add(l, capsule(0.085 * bulk, 0.34), legs, 0, -0.24, 0);
      this.add(l, capsule(0.07 * bulk, 0.3), legs, 0, -0.58, 0);
      this.add(l, cyl(0.085 * bulk, 0.095 * bulk, 0.26, 10), boots, 0, -0.76, 0.0);
      this.add(l, sphere(0.09), boots, 0, -0.9, 0.06, { s: [1 * bulk, 0.55, 1.5] });
      if (sp.fur) this.add(l, cyl(0.12 * bulk, 0.11 * bulk, 0.14, 10), FUR, 0, -0.62, 0, { rough: 1 });
      return l;
    };
    this.parts.legL = mkLeg(-1); this.parts.legR = mkLeg(1);
    this.add(hips, cyl(0.19 * bulk, 0.22 * bulk, 0.14), legs, 0, -0.06, 0); // pelvis
    this.addHat(neck, sp.hat, C);
    this.addWeapon(this.parts.armR.userData.hand, sp.weapon, C, sp);
    for (const e of sp.extras || []) this.addExtra(e, C, torso, neck, sp, sw);
  }
  addHat(neck, hat, C) {
    const a = C.hat ?? C.accent ?? GOLD; const y = 0.2;
    switch (hat) {
      case 'wizard': this.add(neck, torus(0.24, 0.04, 20), a, 0, y + 0.05, 0, { rx: Math.PI / 2 }); this.add(neck, cone(0.17, 0.5, 14), a, 0.02, y + 0.3, -0.03, { rz: -0.15 }); break;
      case 'helm': this.add(neck, halfSphere(0.185), METAL, 0, y - 0.02, 0, { metal: 0.8 }); this.add(neck, boxg(0.03, 0.12, 0.04), METAL, 0, 0.13, 0.16, { metal: 0.8 }); this.add(neck, boxg(0.04, 0.1, 0.3), C.plume ?? 0xb02a2a, 0, y + 0.18, -0.02); break;
      case 'hood': this.add(neck, sphere(0.2), a, 0, 0.16, -0.03, { s: [1, 1.05, 1.05] }); this.add(neck, cone(0.13, 0.25, 10), a, 0, 0.12, -0.2, { rx: -1.9 }); this.add(neck, sphere(0.15), 0x0c0a10, 0, 0.12, 0.07, { s: [0.9, 0.95, 0.6] }); break;
      case 'goggles': this.add(neck, torus(0.17, 0.02), LEATHER, 0, y + 0.02, 0, { rx: Math.PI / 2 }); this.add(neck, torus(0.04, 0.015), GOLD, -0.06, y + 0.04, 0.14, { metal: 0.8 }); this.add(neck, torus(0.04, 0.015), GOLD, 0.06, y + 0.04, 0.14, { metal: 0.8 }); break;
      case 'crown': this.add(neck, cyl(0.17, 0.16, 0.08, 16), GOLD, 0, y + 0.08, 0, { metal: 0.9 }); for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; this.add(neck, cone(0.03, 0.12, 6), GOLD, Math.sin(t) * 0.16, y + 0.17, Math.cos(t) * 0.16, { metal: 0.9 }); } break;
      case 'halo': this.add(neck, torus(0.2, 0.02, 24), this.mat(0xffe890, { glow: 3 }), 0, y + 0.22, -0.05, { rx: Math.PI / 2 - 0.2 }); break;
      case 'mohawk': this.add(neck, boxg(0.04, 0.14, 0.3), a, 0, y + 0.08, 0); break;
      case 'cap': this.add(neck, halfSphere(0.175), a, 0, y - 0.02, 0); this.add(neck, cyl(0.1, 0.1, 0.02, 12), a, 0, y - 0.01, 0.14, { s: [1, 1, 0.8] }); break;
      case 'visor': this.add(neck, boxg(0.3, 0.05, 0.05), this.mat(C.visor ?? 0xff3050, { glow: 3 }), 0, 0.15, 0.13); break;
      case 'mask': this.add(neck, boxg(0.3, 0.08, 0.04), a, 0, 0.15, 0.135); break;
      case 'antlers': for (const s of [-1, 1]) { this.add(neck, cyl(0.02, 0.03, 0.35, 6), 0xd8c8a0, s * 0.12, y + 0.2, 0, { rz: -s * 0.4 }); this.add(neck, cyl(0.015, 0.02, 0.18, 6), 0xd8c8a0, s * 0.22, y + 0.3, 0.04, { rz: -s * 1.1 }); } break;
      case 'horns': for (const s of [-1, 1]) this.add(neck, cone(0.05, 0.28, 8), 0xe8e0c8, s * 0.15, y + 0.1, 0.02, { rz: -s * 0.6 }); break;
      case 'bandana': this.add(neck, halfSphere(0.172), a, 0, y - 0.03, 0); break;
      case 'chef': this.add(neck, cyl(0.15, 0.13, 0.22, 14), 0xf4f4f0, 0, y + 0.13, 0); this.add(neck, sphere(0.16), 0xf4f4f0, 0, y + 0.26, 0, { s: [1, 0.6, 1] }); break;
      case 'tophat': this.add(neck, cyl(0.25, 0.25, 0.02, 18), 0x1a1a1a, 0, y + 0.04, 0); this.add(neck, cyl(0.14, 0.15, 0.28, 16), 0x1a1a1a, 0, y + 0.18, 0); this.add(neck, cyl(0.152, 0.152, 0.04, 16), a, 0, y + 0.07, 0); break;
      case 'dome': this.add(neck, sphere(0.26), new THREE.MeshStandardMaterial({ color: 0xa0e8ff, transparent: true, opacity: 0.3, roughness: 0.05 }), 0, 0.14, 0); break;
      default: break;
    }
  }
  addWeapon(hand, w, C, sp) {
    const g = this.pivot(hand, 0, -0.33, 0.02); g.rotation.x = Math.PI / 2 * 0.95; this.parts.weapon = g;
    const wood = 0x6a4428, magic = this.mat(C.magic ?? 0x9ae8ff, { glow: 3 });
    const steel = (x) => this.mat(x ?? 0xd8dce4, { metal: 0.9, rough: 0.25 });
    switch (w) {
      case 'sword': this.add(g, cyl(0.025, 0.025, 0.18, 8), LEATHER, 0, 0, 0); this.add(g, boxg(0.26, 0.04, 0.06), GOLD, 0, 0.1, 0, { metal: 0.8 }); this.add(g, blade(0.08, 0.95), steel(), 0, 0.12, 0); this.add(g, sphere(0.035), GOLD, 0, -0.1, 0, { metal: 0.8 }); break;
      case 'greatsword': this.add(g, cyl(0.03, 0.03, 0.3, 8), LEATHER, 0, 0, 0); this.add(g, boxg(0.4, 0.05, 0.08), 0x303038, 0, 0.16, 0, { metal: 0.7 }); this.add(g, blade(0.13, 1.4), steel(), 0, 0.18, 0); break;
      case 'axe': this.add(g, cyl(0.03, 0.03, 1.0, 8), wood, 0, 0.4, 0); this.add(g, boxg(0.3, 0.28, 0.03), steel(), 0.13, 0.8, 0, { s: [1, 1, 1] }); break;
      case 'staff': this.add(g, cyl(0.03, 0.035, 1.6, 8), wood, 0, 0.35, 0); this.add(g, torus(0.07, 0.015), GOLD, 0, 1.12, 0, { metal: 0.8 }); this.add(g, sphere(0.075), magic, 0, 1.2, 0); break;
      case 'wand': this.add(g, cyl(0.018, 0.022, 0.45, 8), 0x3a2030, 0, 0.2, 0); this.add(g, sphere(0.04), magic, 0, 0.45, 0); break;
      case 'wrench': this.add(g, cyl(0.03, 0.03, 0.55, 8), wood, 0, 0.25, 0); this.add(g, boxg(0.22, 0.14, 0.14), steel(0x8a8c90), 0, 0.58, 0); this.add(g, boxg(0.23, 0.04, 0.15), this.mat(0x6ae8ff, { glow: 2 }), 0, 0.58, 0); break;
      case 'mace': this.add(g, cyl(0.03, 0.03, 0.6, 8), wood, 0, 0.25, 0); this.add(g, G_('ico', () => new THREE.IcosahedronGeometry(0.11, 0)), steel(0xd8c070), 0, 0.6, 0); break;
      case 'daggers': { this.add(g, cyl(0.02, 0.02, 0.12, 6), LEATHER, 0, 0, 0); this.add(g, blade(0.05, 0.4), steel(), 0, 0.06, 0);
        const g2 = this.pivot(this.parts.armL.userData.hand, 0, -0.33, 0.02); g2.rotation.x = Math.PI / 2 * 0.95; this.add(g2, cyl(0.02, 0.02, 0.12, 6), LEATHER, 0, 0, 0); this.add(g2, blade(0.05, 0.4), steel(), 0, 0.06, 0); break; }
      case 'bow': { const bw = this.pivot(this.parts.armL.userData.hand, 0, -0.32, 0.03); this.add(bw, G_('bow', () => new THREE.TorusGeometry(0.62, 0.022, 6, 24, Math.PI * 0.9)), wood, 0, 0, 0, { rz: Math.PI / 2 + Math.PI * 0.05, ry: Math.PI / 2 }); this.add(bw, cyl(0.004, 0.004, 1.2, 4), 0xeeeeee, 0, 0, -0.05); g.visible = false; this.parts.bow = bw; break; }
      case 'gun': case 'rifle': this.add(g, boxg(0.08, 0.1, 0.5), 0x3a3a44, 0, 0.18, 0, { metal: 0.6 }); this.add(g, boxg(0.4, 0.03, 0.04), wood, 0, 0.35, 0); this.add(g, sphere(0.03), magic, 0, 0.44, 0); break;
      case 'claws': this.add(g, boxg(0.16, 0.25, 0.04), steel(), 0, 0.15, 0); break;
      case 'shieldfist': this.add(g, sphere(0.14), steel(C.accent), 0, 0.02, 0); break;
      case 'club': this.add(g, cyl(0.05, 0.1, 0.9, 8), 0x5a3a1a, 0, 0.4, 0); break;
      case 'baton': this.add(g, cyl(0.025, 0.025, 0.6, 8), magic, 0, 0.25, 0); break;
      case 'lute': this.add(g, sphere(0.16), 0xb07030, 0, 0.1, 0.05, { s: [1, 1.2, 0.5] }); this.add(g, boxg(0.05, 0.45, 0.04), 0x5a3010, 0, 0.45, 0.05); break;
      default: break;
    }
  }
  addExtra(e, C, torso, neck, sp, sw) {
    switch (e) {
      case 'cape': { const p = this.pivot(torso, 0, 0.72, -0.14); this.parts.cape = p; const g = G_('capeg', () => { const g = new THREE.PlaneGeometry(0.62, 1.2, 4, 6); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, -Math.abs(x) * 0.25 - (0.6 - y) * 0.05); pos.setX(i, x * (1 + (0.6 - y) * 0.4)); } g.translate(0, -0.6, 0); g.computeVertexNormals(); return g; }); const m = new THREE.MeshStandardMaterial({ color: C.cape ?? C.accent, roughness: 0.9, side: THREE.DoubleSide }); this.mats.push(m); this.add(p, g, m); break; }
      case 'backpack': this.add(torso, boxg(0.34, 0.4, 0.18), LEATHER, 0, 0.45, -0.25); this.add(torso, cyl(0.06, 0.06, 0.36, 8), 0x8a6a4a, 0, 0.7, -0.25, { rz: Math.PI / 2 }); break;
      case 'jetpack': this.add(torso, cyl(0.07, 0.07, 0.4, 10), METAL, -0.1, 0.45, -0.24, { metal: 0.7 }); this.add(torso, cyl(0.07, 0.07, 0.4, 10), METAL, 0.1, 0.45, -0.24, { metal: 0.7 }); break;
      case 'shield': { const s = this.pivot(this.parts.armL.userData.hand, -0.08, -0.12, 0.02); s.rotation.z = Math.PI / 2; this.add(s, cyl(0.3, 0.3, 0.05, 20), C.shield ?? 0x3a5aa0, 0, 0, 0); this.add(s, torus(0.3, 0.025, 20), GOLD, 0, 0, 0, { rx: Math.PI / 2, metal: 0.85 }); this.add(s, sphere(0.07), GOLD, 0, -0.03, 0, { metal: 0.85 }); this.parts.shield = s; break; }
      case 'shoulder': for (const s of [-1, 1]) { this.add(torso, halfSphere(0.16), METAL, s * (sw + 0.03), 0.68, 0, { metal: 0.75, rz: -s * 0.4 }); this.add(torso, torus(0.15, 0.02), GOLD, s * (sw + 0.03), 0.68, 0, { rx: Math.PI / 2, rz: -s * 0.4, metal: 0.85 }); } break;
      case 'harness': this.add(torso, boxg(0.07, 0.62, 0.02), LEATHER, 0, 0.5, 0.2, { rz: 0.7 }); this.add(torso, sphere(0.06), METAL, 0.0, 0.52, 0.21, { metal: 0.8, s: [1, 1, 0.4] }); this.add(torso, sphere(0.27), METAL, 0, 0.56, 0.02, { metal: 0.75, s: [1.3, 0.55, 0.85] }); break;
      case 'plate': this.add(torso, sphere(0.26), METAL, 0, 0.5, 0.02, { metal: 0.75, s: [1.35 * (sp.bulk || 1), 1.05, 0.9] }); this.add(torso, torus(0.24, 0.02), GOLD, 0, 0.3, 0, { rx: Math.PI / 2, metal: 0.8, s: [1.3, 0.8, 1] }); break;
      case 'quiver': this.add(torso, cyl(0.07, 0.06, 0.55, 10), LEATHER, 0.12, 0.55, -0.22, { rz: 0.35 }); for (let i = 0; i < 4; i++) this.add(torso, boxg(0.02, 0.1, 0.04), 0xf0f0f0, 0.2 + i * 0.012, 0.86, -0.22 + (i - 1.5) * 0.02, { rz: 0.35 }); break;
      case 'scar': this.add(neck, boxg(0.012, 0.12, 0.012), 0x8a2020, 0.07, 0.15, 0.152); break;
      case 'eyepatch': this.add(neck, sphere(0.04), 0x111111, 0.055, 0.15, 0.14, { s: [1, 1, 0.4] }); this.add(neck, torus(0.165, 0.008), 0x111111, 0, 0.16, 0, { rx: Math.PI / 2 - 0.2 }); break;
      case 'metaljaw': this.add(neck, sphere(0.08), METAL, 0, 0.05, 0.09, { metal: 0.9, s: [1.4, 0.8, 1] }); break;
      case 'bandage': this.add(neck, torus(0.165, 0.025), 0xf0e8d8, 0, 0.22, 0, { rx: Math.PI / 2 }); break;
      case 'tail': { const t = this.pivot(this.parts.hips, 0, 0.05, -0.18); this.parts.tail = t; this.add(t, cone(0.06, 0.6, 8), C.body, 0, 0, -0.3, { rx: -Math.PI / 2 }); break; }
      case 'spikes': for (let i = 0; i < 3; i++) this.add(torso, cone(0.05, 0.18, 6), 0xe0e0e0, 0, 0.35 + i * 0.16, -0.22, { rx: -0.8 }); break;
      case 'apron': this.add(torso, boxg(0.36, 0.6, 0.02), 0xe8dcc0, 0, 0.05, 0.2); break;
      case 'robe': this.add(this.parts.hips, cyl(0.21 * (sp.bulk || 1), 0.4 * (sp.bulk || 1), 0.9, 16), C.robe ?? C.body, 0, -0.45, 0); this.add(this.parts.hips, torus(0.39 * (sp.bulk || 1), 0.02, 20), C.accent ?? GOLD, 0, -0.88, 0, { rx: Math.PI / 2 }); break;
      case 'chestlight': this.add(torso, sphere(0.05), this.mat(C.magic ?? 0x60e0ff, { glow: 3 }), 0, 0.55, 0.23); break;
      case 'emblem': this.add(torso, cyl(0.08, 0.08, 0.02, 16), C.emblem ?? GOLD, 0, 0.55, 0.23, { rx: Math.PI / 2, metal: 0.8 }); break;
      case 'wings': { const p = this.pivot(torso, 0, 0.6, -0.2); this.parts.wings = p; for (const s of [-1, 1]) this.add(p, G_('wing', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.4, 0.5, 1.1, 0.6, 1.3, 0.3); sh.lineTo(0.8, 0.0); sh.lineTo(1.1, -0.4); sh.lineTo(0.5, -0.2); sh.lineTo(0.5, -0.6); sh.closePath(); return new THREE.ShapeGeometry(sh); }), new THREE.MeshStandardMaterial({ color: C.wing ?? 0xf0f0f0, side: THREE.DoubleSide, roughness: 0.8 }), 0, 0, 0, { s: [s, 1, 1] }); break; }
      default: break;
    }
  }
  buildBeast(sp) {
    const C = sp.colors;
    const hips = this.pivot(this.body, 0, 0.62, 0); this.parts.hips = hips;
    const torso = this.pivot(hips, 0, 0, 0); this.parts.torso = torso;
    this.add(torso, capsule(0.24, 0.55), C.body, 0, 0.1, 0, { rx: Math.PI / 2 });
    this.add(torso, sphere(0.3), C.body, 0, 0.15, 0.3, { s: [1, 1.05, 1] }); // chest ruff
    const neck = this.pivot(torso, 0, 0.3, 0.52); this.parts.head = neck;
    this.add(neck, sphere(0.2), C.body, 0, 0.08, 0.05);
    this.add(neck, cone(0.1, 0.28, 10), C.skin ?? C.body, 0, 0.03, 0.26, { rx: Math.PI / 2 });
    this.add(neck, sphere(0.035), 0x111111, 0, 0.04, 0.4);
    for (const s of [-1, 1]) this.add(neck, cone(0.06, 0.16, 6), C.body, s * 0.1, 0.27, 0.0);
    const eye = sp.glowEyes ? this.mat(sp.glowEyes, { glow: 3 }) : (C.eye ?? 0xffd040);
    this.add(neck, sphere(0.03), eye, -0.08, 0.12, 0.18); this.add(neck, sphere(0.03), eye, 0.08, 0.12, 0.18);
    const legs = [[-0.15, 0.32], [0.15, 0.32], [-0.15, -0.3], [0.15, -0.3]].map(([x, z]) => { const p = this.pivot(hips, x, 0, z); this.add(p, capsule(0.065, 0.42), C.legs ?? C.body, 0, -0.3, 0); return p; });
    this.parts.legs = legs; this.parts.legL = legs[0]; this.parts.legR = legs[1];
    const t = this.pivot(hips, 0, 0.2, -0.5); this.parts.tail = t; this.add(t, cone(0.08, 0.55, 8), C.body, 0, 0, -0.25, { rx: -Math.PI / 2 - 0.4 });
    if ((sp.extras || []).includes('spikes')) for (let i = 0; i < 4; i++) this.add(torso, cone(0.05, 0.2, 6), 0xe0e0e0, 0, 0.4, -0.3 + i * 0.2);
  }
  buildDrone(sp) {
    const C = sp.colors;
    const core = this.pivot(this.body, 0, 1.3, 0); this.parts.torso = core; this.parts.head = core;
    this.add(core, sphere(0.34), C.body, 0, 0, 0, { metal: 0.5 });
    this.add(core, sphere(0.14), this.mat(sp.glowEyes ?? 0xff3040, { glow: 4 }), 0, 0, 0.26);
    const rL = this.pivot(core, 0, 0, 0), rR = this.pivot(core, 0, 0, 0);
    this.add(rL, torus(0.5, 0.025, 24), C.accent, 0, 0, 0, { metal: 0.7 }); this.add(rR, torus(0.58, 0.02, 24), C.accent, 0, 0, 0, { rx: Math.PI / 2, metal: 0.7 });
    this.parts.armL = rL; this.parts.armR = rR; this.parts.rings = [rL, rR];
  }
  buildBlob(sp) {
    const C = sp.colors;
    const core = this.pivot(this.body, 0, 0, 0); this.parts.torso = core; this.parts.head = core;
    this.add(core, cyl(0.3, 0.42, 0.9, 14), C.body, 0, 0.45, 0);
    const eye = sp.glowEyes ? this.mat(sp.glowEyes, { glow: 3 }) : 0x111111;
    this.add(core, sphere(0.05), eye, -0.12, 0.62, 0.3); this.add(core, sphere(0.05), eye, 0.12, 0.62, 0.3);
    if (sp.hat === 'mushroom') this.add(core, halfSphere(0.75), this.mat(C.accent, { glow: 0.6 }), 0, 0.85, 0, { s: [1, 0.55, 1] });
    else this.add(core, sphere(0.35), C.body, 0, 0.9, 0);
  }

  flash(color = 0xffffff, t = 0.1) { this.flashT = t; this.flashColor = color; }
  play(state, dur = 0.4) { this.state = state; this.stateT = dur; this.stateDur = dur; }

  update(dt, moving, speed01, grounded) {
    this.animT += dt;
    const st = this.animT;
    if (this.stateT > 0) { this.stateT -= dt; if (this.stateT <= 0) this.state = 'idle'; }
    const P = this.parts;
    const k = this.stateT > 0 ? 1 - this.stateT / this.stateDur : 0;
    const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const q = ease(k);
    const freq = 7 + speed01 * 5;
    const walk = moving ? Math.sin(st * freq) : 0;
    const lerpR = (o, x, a = 12) => { o.rotation.x += (x - o.rotation.x) * Math.min(1, dt * a); };
    if (P.legL) { lerpR(P.legL, walk * 0.7 * (0.6 + speed01 * 0.5)); lerpR(P.legR, -walk * 0.7 * (0.6 + speed01 * 0.5)); }
    if (P.legs) { lerpR(P.legs[2], -walk * 0.7); lerpR(P.legs[3], walk * 0.7); }
    const armSwing = moving ? walk * 0.55 : Math.sin(st * 1.5) * 0.04;
    if (P.armL && P.armR && this.spec.kind !== 'drone') { lerpR(P.armL, -armSwing); lerpR(P.armR, armSwing); P.armL.rotation.z = 0.08; P.armR.rotation.z = -0.08; }
    if (P.hips && this.spec.kind !== 'beast') P.hips.position.y = 0.95 + (moving ? Math.abs(walk) * 0.05 : Math.sin(st * 2) * 0.012);
    if (P.torso && this.spec.kind !== 'drone' && this.spec.kind !== 'blob') { P.torso.rotation.set(0, 0, 0); P.torso.rotation.x = moving ? 0.08 * speed01 : 0; P.torso.scale.y = 1 + Math.sin(st * 2) * 0.008; }
    if (this.spec.kind === 'drone') { P.torso.position.y = 1.3 + Math.sin(st * 2.5) * 0.1; P.rings[0].rotation.y += dt * 1.5; P.rings[1].rotation.z += dt * 2; }
    if (this.spec.kind === 'blob') P.torso.scale.set(1 + Math.sin(st * 3) * 0.03, 1 - Math.sin(st * 3) * 0.03, 1 + Math.sin(st * 3) * 0.03);
    if (P.tail) P.tail.rotation.y = Math.sin(st * 5) * 0.35;
    if (P.cape) P.cape.rotation.x = 0.08 + (moving ? 0.35 * speed01 + 0.1 : 0.02) + Math.sin(st * 3) * 0.04;
    if (P.wings) P.wings.rotation.y = Math.sin(st * 3) * 0.12;
    if (!grounded && P.legL && P.armL && P.armR && this.spec.kind === 'humanoid') { P.legL.rotation.x = -0.5; P.legR.rotation.x = 0.25; P.armL.rotation.z = 0.5; P.armR.rotation.z = -0.5; }
    this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0);
    if (P.head) P.head.rotation.x = 0;
    switch (this.state) {
      case 'attack': if (P.armR) { P.armR.rotation.x = k < 0.35 ? -2.4 * (k / 0.35) : -2.4 + (k - 0.35) / 0.65 * 3.2; P.armR.rotation.z = -0.3; } if (P.torso) P.torso.rotation.y = k < 0.35 ? 0.45 * (k / 0.35) : 0.45 - (k - 0.35) * 1.6; break;
      case 'thrust': if (P.armR) P.armR.rotation.x = -1.55 * Math.sin(k * Math.PI); if (P.torso) P.torso.rotation.y = -0.3 * Math.sin(k * Math.PI); break;
      case 'cast': if (P.armR) { P.armR.rotation.x = -2.9 * Math.sin(Math.min(1, k * 1.5) * Math.PI / 2); P.armL.rotation.x = -1.4 * Math.sin(k * Math.PI); } break;
      case 'shoot': if (P.armR && P.armL) { P.armL.rotation.x = -1.5; P.armL.rotation.z = 0.1; P.armR.rotation.x = -1.4; P.armR.rotation.z = 0.5 * (1 - k); } break;
      case 'draw': if (P.armR && P.armL) { P.armL.rotation.x = -1.55; P.armR.rotation.x = -1.45; P.armR.rotation.z = 0.7; } break;
      case 'guard': if (P.armL) { P.armL.rotation.x = -1.3; P.armL.rotation.z = 0.6; } if (P.armR) P.armR.rotation.x = -0.6; this.body.position.y = -0.06; break;
      case 'spin': this.body.rotation.y = q * Math.PI * 2; if (P.armR) { P.armR.rotation.z = -1.3; P.armL.rotation.z = 1.3; } break;
      case 'slam': if (P.armR) { P.armR.rotation.x = k < 0.5 ? -3 * (k * 2) : -3 + (k - 0.5) * 6; P.armL.rotation.x = P.armR.rotation.x; } this.body.position.y = Math.sin(k * Math.PI) * 0.4; break;
      case 'hurt': this.body.rotation.x = -0.18 * Math.sin(k * Math.PI); break;
      case 'bite': if (P.head) P.head.rotation.x = -0.4 * Math.sin(k * Math.PI); this.body.position.z = 0.25 * Math.sin(k * Math.PI); break;
      case 'cheer': case 'raise': if (P.armR) { P.armR.rotation.x = -3.0; P.armR.rotation.z = -0.15; P.armL.rotation.z = 0.5; } this.body.position.y = Math.sin(st * 6) * 0.03; break;
      case 'drink': if (P.armR) P.armR.rotation.x = -2.0; if (P.head) P.head.rotation.x = -0.35; break;
      case 'sit': if (P.legL) { P.legL.rotation.x = -1.45; P.legR.rotation.x = -1.45; } this.body.position.y = -0.42; break;
      case 'roll': this.body.rotation.x = q * Math.PI * 2; this.body.position.y = -0.5 * Math.sin(k * Math.PI); break;
      default: break;
    }
    if (this.downed) { this.body.rotation.x = -Math.PI / 2; this.body.position.y = 0.25; }
    if (this.flashT > 0) {
      this.flashT -= dt; const on = this.flashT > 0; const i = on ? Math.min(1, this.flashT * 10) : 0;
      for (const m of this.mats) { m.emissive.setHex(this.flashColor); m.emissiveIntensity = i * 0.6; }
    }
  }
  dispose() { for (const m of this.mats) m.dispose(); }
}
