// Friendly characters you can talk to.
import { G } from '../core/state.js';
import { Actor } from './actor.js';

export class NPC extends Actor {
  constructor(id, def, pos, opts = {}) {
    super({ name: def.name, team: 'npc', pos, model: { ...def.look, scale: (def.look.scale || 1) * (opts.scale || 1) }, hp: 999 });
    this.npcId = id; this.def = def; this.dialogue = opts.dialogue || id; this.idle = opts.idle || def.idle || 'stand';
    this.yaw = opts.yaw ?? Math.PI; this.homeYaw = this.yaw; this.home = pos.clone(); this.talkable = opts.talkable !== false;
    this.label = opts.label || def.name; this.untargetable = true; this.invuln = true;
    this.onTalk = opts.onTalk || null;
    G.entities.push(this);
  }
  update(dt) {
    this.moveInput.set(0, 0, 0);
    const p = G.party[G.activeIndex];
    if (p && p.pos.distanceTo(this.pos) < 5) this.faceTo(p.pos, dt * 4); else { let d = this.homeYaw - this.yaw; this.yaw += d * Math.min(1, dt * 2); }
    if (this.idle === 'sit') this.model.state = 'sit', this.model.stateT = 1, this.model.stateDur = 1;
    else if (this.idle === 'cheer' && Math.random() < dt * 0.3) this.model.play('cheer', 1.2);
    else if (this.idle === 'drink' && Math.random() < dt * 0.25) this.model.play('drink', 1.2);
    super.update(dt);
  }
}
