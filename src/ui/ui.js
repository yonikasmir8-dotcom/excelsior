// All interface: HUD, menus, dialogue with skill checks, the Initiative Break page, Nemesis cards,
// inventory, talents, party, shop, forge, journal. Plain DOM, styled like a comic book.
import * as THREE from 'three';
import { G, activeHero } from '../core/state.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { CLASSES, CLASS_IDS, abilityName } from '../game/classes.js';
import { STYLE_RANKS, styleRank, TEAMUPS, d20 } from '../game/combat.js';
import { rarityOf, STAT_INFO, itemPower, rollItem } from '../game/loot.js';
import { TRAITS, RANKS, fullName, realmName } from '../game/nemesis.js';
import { NPCS, COMPANIONS } from '../content/npcs.js';
import { xpForLevel } from '../entities/hero.js';

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
};
const esc = (s) => String(s);
const V = new THREE.Vector3();
let root, hud, modal = null, dlg = null, breakEl = null, onModalClose = null;
const PORTRAIT = {};

export const UI = {
  api: null,
  init() {
    root = $('#ui');
    document.body.append(h('div', { id: 'speedlines' }));
    root.append(h('div', { id: 'toasts' }), h('div', { class: 'lootToast', id: 'lootToasts' }), h('div', { class: 'fade', id: 'fade' }));
  },
  modalOpen() { return !!modal || !!dlg || !!breakEl || G.mode !== 'play'; },
  blocking() { return !!modal || !!dlg || G.mode !== 'play'; },

  // ───────────── generic ─────────────
  toast(msg, ms = 3200) { const t = h('div', { class: 'toast panel' }, msg); $('#toasts').append(t); setTimeout(() => t.remove(), ms); while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove(); },
  banner(title, sub = '', ms = 3000) {
    $('#banner')?.remove();
    const b = h('div', { id: 'banner' }, h('div', { class: 't' }, title), sub ? h('div', { class: 's' }, sub) : null);
    document.body.append(b); setTimeout(() => b.remove(), ms);
  },
  lootToast(it) { const t = h('div', { class: 'it panel', style: `border-left-color:${rarityOf(it.rarity).color}` }, `${it.name}`); $('#lootToasts').append(t); setTimeout(() => t.remove(), 3500); },
  fade(mid) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { try { mid(); } finally { setTimeout(() => f.classList.remove('on'), 120); } }, 380); },
  speedlines(gold = false) { const s = $('#speedlines'); if (!s) return; s.classList.toggle('gold', gold); s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); },
  flashCd(id) { const el = document.querySelector(`.ab[data-id="${id}"]`); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } },
  objective(text) { G.objectiveText = text; const o = $('#objective .t'); if (o) o.textContent = text; },
  grantXp(n) { UI.api.grantXp(n); },
  openModal(content, { onClose, wide } = {}) {
    UI.closeModal(true);
    Input.unlock();
    const sheet = h('div', { class: 'sheet panel' }, h('button', { class: 'btn alt close', onclick: () => UI.closeModal() }, 'Close [Esc]'), content);
    modal = h('div', { class: 'modal' }, sheet);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) UI.closeModal(); });
    document.body.append(modal); onModalClose = onClose || null; G.paused = true;
    return sheet;
  },
  closeModal(silent) { if (!modal) return; modal.remove(); modal = null; G.paused = !!dlg; const f = onModalClose; onModalClose = null; if (f && !silent) f(); if (!silent) Audio.play('click'); },

  // ───────────── title + creation ─────────────
  title() {
    G.mode = 'title';
    const el = h('div', { id: 'title' },
      h('div', { class: 'logo' }, 'THE FORGOTTEN', h('br'), 'TAVERN', h('small', {}, 'A MULTIVERSE RPG')),
      h('div', { class: 'tag' }, 'Every realm is fraying. One tavern remembers them all. Gather your party, roll your fate, and make enemies who never forget you.'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn', onclick: () => { Audio.unlock(); UI.slotPicker(); } }, 'Play'),
        h('button', { class: 'btn alt', onclick: () => { Audio.unlock(); UI.settings(); } }, 'Settings'),
        h('button', { class: 'btn alt', onclick: () => { Audio.unlock(); UI.controls(); } }, 'How to Play'),
      ),
      h('div', { style: 'color:#fff;opacity:.6;font-size:15px;text-shadow:1px 1px 0 #000' }, 'Keyboard + mouse. Best in fullscreen (F11).'),
    );
    root.append(el);
  },
  slotPicker() {
    const slots = [1, 2, 3].map((i) => {
      const info = UI.api.slotInfo(i);
      return h('div', { class: 'slot panel', onclick: () => { UI.closeModal(true); if (info) UI.api.continueGame(i); else UI.creation(i); } },
        h('div', { class: 'nm' }, info ? info.name : `Empty Slot ${i}`),
        info ? h('div', {}, `${CLASSES[info.classId].name} · Level ${info.level}`, h('br'), `Loom-Shards: ${info.shards}/3 · ${Math.floor(info.time / 60)} min`, info.ending ? h('div', { style: 'color:#c03a6a' }, '★ Story complete') : null) : h('div', { class: 'muted' }, 'Start a new adventure'),
        info ? h('button', { class: 'btn red', style: 'font-size:13px;padding:2px 8px;margin-top:8px', onclick: (e) => { e.stopPropagation(); if (e.shiftKey || this?.confirming === i) { UI.api.deleteSave(i); UI.slotPicker(); } else { UI.toast('Shift-click Delete to erase this save for good.'); } } }, 'Delete') : null);
    });
    UI.openModal(h('div', {}, h('h2', {}, 'Choose a Save Slot'), h('div', { class: 'slots' }, slots)));
  },
  creation(slot) {
    let cls = 'fighter', name = '', body = null, hair = 0x5a3018, skin = 0xf0c090;
    const bodies = [null, 0xb03028, 0x2a5ad0, 0x2a8a4a, 0x6a2a8a, 0xd0a020, 0x222222, 0xe0e0e0];
    const hairs = [0x5a3018, 0x1a1a1a, 0xe0c040, 0xc04020, 0xe8e8f0, 0x40d0ff, 0xff3a8a];
    const skins = [0xf0c090, 0xe0a070, 0xa06a40, 0x6a4028, 0x8ab0a0, 0xc0a0e0];
    const box = h('div', {});
    const render = () => {
      box.innerHTML = '';
      const C = CLASSES[cls];
      box.append(
        h('h2', {}, 'Create Your Hero'),
        h('div', { class: 'classes' }, CLASS_IDS.map((id) => h('div', { class: 'cls panel' + (id === cls ? ' on' : ''), onclick: () => { cls = id; Audio.play('click'); render(); } },
          h('div', { class: 'nm', style: `color:${CLASSES[id].color}` }, CLASSES[id].name), h('div', { class: 'role' }, CLASSES[id].role.toUpperCase()), h('p', {}, CLASSES[id].blurb)))),
        h('div', { class: 'grid', style: 'grid-template-columns: 1fr 1fr; margin-top:14px' },
          h('div', {},
            h('h3', {}, 'Name'), h('input', { type: 'text', id: 'heroName', maxlength: 18, placeholder: 'Your hero\'s name', value: name, oninput: (e) => (name = e.target.value) }),
            h('h3', {}, 'Colours'),
            h('div', { class: 'swatches' }, bodies.map((c) => h('div', { class: 'sw' + (c === body ? ' on' : ''), title: 'Outfit', style: `background:${c == null ? 'repeating-linear-gradient(45deg,#fff 0 4px,#ccc 4px 8px)' : '#' + c.toString(16).padStart(6, '0')}`, onclick: () => { body = c; render(); } }))),
            h('div', { class: 'swatches', style: 'margin-top:6px' }, hairs.map((c) => h('div', { class: 'sw' + (c === hair ? ' on' : ''), title: 'Hair', style: `background:#${c.toString(16).padStart(6, '0')}`, onclick: () => { hair = c; render(); } }))),
            h('div', { class: 'swatches', style: 'margin-top:6px' }, skins.map((c) => h('div', { class: 'sw' + (c === skin ? ' on' : ''), title: 'Skin', style: `background:#${c.toString(16).padStart(6, '0')}`, onclick: () => { skin = c; render(); } }))),
          ),
          h('div', {},
            h('h3', {}, `${C.name}: ${C.passive.name}`), h('p', { style: 'margin:0' }, C.passive.desc),
            h('h3', {}, 'Abilities'),
            h('div', {}, [{ key: 'LMB', name: C.basic.name, desc: 'Basic attack.' }, ...C.abilities].map((a) => h('div', { style: 'font-size:16px;margin-bottom:3px' }, h('span', { class: 'kbd' }, a.key), ' ', h('b', {}, a.name), a.lvl > 1 ? h('span', { class: 'muted' }, ` (lvl ${a.lvl})`) : '', ' — ', a.desc))),
            h('div', { style: 'margin-top:8px' }, h('b', {}, 'Specs: '), `${C.specs.a} / ${C.specs.b}`),
          ),
        ),
        h('div', { style: 'display:flex;justify-content:flex-end;gap:10px;margin-top:14px' },
          h('button', { class: 'btn', onclick: () => { const nm = ($('#heroName').value || '').trim() || randomName(); UI.closeModal(true); UI.api.newGame(slot, { name: nm, classId: cls, look: { ...(body != null ? { body } : {}), hair, skin } }); } }, 'Walk Through the Door'),
        ),
      );
    };
    render();
    UI.openModal(box);
  },
  settings() {
    const S = G.settings;
    const row = (label, input) => h('div', { style: 'display:flex;align-items:center;gap:12px;margin:8px 0' }, h('div', { class: 'title-font', style: 'width:180px;font-size:20px' }, label), input);
    const range = (k, min, max, step) => h('input', { type: 'range', min, max, step, value: S[k], oninput: (e) => { S[k] = +e.target.value; Audio.applyVolume(); UI.api.saveSettings(); } });
    UI.openModal(h('div', {}, h('h2', {}, 'Settings'),
      row('Sound FX', range('volume', 0, 1, 0.05)), row('Music', range('music', 0, 1, 0.05)), row('Mouse sensitivity', range('sens', 0.3, 2.5, 0.05)),
      row('Difficulty', h('select', { id: 'diffSel', style: 'font-family:var(--display);font-size:18px;padding:4px', onchange: (e) => { S.difficulty = e.target.value; UI.api.saveSettings(); } }, ['story', 'normal', 'hard'].map((d) => h('option', { value: d, selected: S.difficulty === d ? '' : null }, { story: 'Story (relaxed)', normal: 'Normal', hard: 'Hard (brutal)' }[d])))),
      row('Comic ink shader', h('input', { type: 'checkbox', checked: S.postfx ? '' : null, onchange: (e) => { S.postfx = e.target.checked; UI.api.saveSettings(); } })),
      h('p', { class: 'muted' }, 'Turn off the comic shader if the game runs slowly.')));
  },
  controls() {
    const k = (x) => h('span', { class: 'kbd' }, x);
    UI.openModal(h('div', {}, h('h2', {}, 'How to Play'),
      h('div', { class: 'help' },
        h('div', {}, k('WASD'), ' move · ', k('Mouse'), ' look · ', k('Space'), ' jump (double jump) · ', k('Shift'), ' dash (dodge through attacks)'),
        h('div', {}, k('LMB'), ' basic attack · ', k('Q'), k('E'), k('C'), ' abilities · ', k('R'), ' ultimate'),
        h('div', {}, k('RMB'), ' your class signature: Guard (Fighter), Attunement (Sorcerer), Detonate (Runesmith), Tether (Cleric), Tumble (Rogue), Aimed Shot (Ranger)'),
        h('div', {}, k('F'), ' talk / interact / revive (hold) · ', k('H'), ' drink a potion'),
        h('div', {}, k('Tab'), ' INITIATIVE BREAK when the meter is full: freeze time and plan a party combo'),
        h('div', {}, k('Wheel'), ' pick a Fate Die · ', k('X'), ' arm it (your next attack uses that roll) · ', k('Z'), ' sacrifice it for Break charge (low dice give more)'),
        h('div', {}, k('I'), ' inventory · ', k('K'), ' talents · ', k('P'), ' party · ', k('J'), ' journal and Nemeses · ', k('V'), ' first/third person · ', k('Esc'), ' pause'),
        h('p', {}, h('b', {}, 'Fate Dice: '), 'every fight you roll a hand of d20s. Every attack is a d20 roll against armour. A natural 20 is a critical hit. Save your 19s for the moments that matter.'),
        h('p', {}, h('b', {}, 'Team-Ups: '), 'certain abilities combine when used close together by different heroes, such as a turret plus lightning, or smoke plus a volley. Experiment! Initiative Break combos trigger them for free.'),
        h('p', {}, h('b', {}, 'Nemeses: '), 'named captains remember you. If they down a hero or escape, they get stronger and adapt. Kill them for good loot. Some come back anyway.'),
      )));
  },

  // ───────────── HUD ─────────────
  buildHud() {
    $('#title')?.remove();
    $('#hud')?.remove();
    hud = h('div', { id: 'hud' },
      h('div', { id: 'party' }), h('div', { id: 'loc' }), h('div', { id: 'objective', class: 'panel' }, h('h4', {}, 'OBJECTIVE'), h('div', { class: 't' }, G.objectiveText || '')),
      h('div', { id: 'markers' }), h('div', { id: 'crosshair' }), h('div', { id: 'abilities' }), h('div', { id: 'dice' }), h('div', { id: 'diceHint' }),
      h('div', { id: 'meter' }, h('div', { class: 'lbl' }, h('span', {}, 'BREAK'), h('span', { class: 'v' }, '0%')), h('div', { class: 'bar' }, h('i'))),
      h('div', { id: 'stats' }), h('div', { id: 'prompt', class: 'panel hidden' }), h('div', { id: 'bossbar', class: 'hidden' }, h('div', { class: 'nm' }), h('div', { class: 'sub' }), h('div', { class: 'bar' }, h('i'))),
    );
    root.append(hud);
    UI.rebuildParty();
  },
  rebuildParty() {
    const p = $('#party'); if (!p) return; p.innerHTML = '';
    G.party.forEach((hr, i) => p.append(h('div', { class: 'pcard', 'data-i': i },
      h('div', { class: 'por', style: `background:${CLASSES[hr.classId].color}` }, hr.name[0]),
      h('div', { class: 'meta' }, h('div', { class: 'nm' }, `${hr.name}`), h('div', { class: 'bar hp' }, h('i')), h('div', { class: 'bar res', style: 'height:6px;margin-top:2px' }, h('i'))),
      i === G.activeIndex ? h('div', { class: 'key' }, '★') : null)));
    UI.rebuildAbilities();
  },
  rebuildAbilities() {
    const a = $('#abilities'); if (!a) return; a.innerHTML = ''; a._hero = activeHero();
    const hr = activeHero(); if (!hr) return;
    const list = [{ id: 'basic', key: 'LMB', name: hr.cls.basic.name, lvl: 1 }, ...hr.cls.abilities];
    for (const ab of list) {
      const locked = ab.lvl > G.save.party.level;
      a.append(h('div', { class: 'ab' + (locked ? ' locked' : ''), 'data-id': ab.id, title: ab.desc || '' }, h('div', { class: 'k' }, ab.key), h('div', { class: 'n' }, ab.id === 'basic' ? ab.name : abilityName(hr.classId, ab.id, G.realm?.kind)), locked ? h('div', { class: 'cd', style: 'font-size:14px' }, `LV ${ab.lvl}`) : h('div', { class: 'cd hidden' })));
    }
    a.append(h('div', { class: 'ab', style: 'width:52px;height:52px' }, h('div', { class: 'k' }, 'H'), h('div', { class: 'n' }, 'Potion'), h('div', { class: 'pc', style: 'font-family:var(--display);font-size:18px' }, G.save.potions)));
  },
  enterLocation(realm) {
    UI.buildHud(); G.mode = 'play';
    $('#loc').textContent = realm.name.toUpperCase() + (realm.level && realm.kind !== 'tavern' ? `  ·  THREAT ${realm.level}` : '');
    UI.banner(realm.name.toUpperCase(), realm.kind === 'tavern' ? 'The Hearth Between' : (realm.mods ? 'Modifiers: ' + realm.mods.map((m) => m.name).join(' · ') : realm.blurb || ''), 2600);
  },
  bossBar(e) { G.boss = e; },
  update(dt) {
    if (!hud || G.mode !== 'play') return;
    const S = G.save, C = G.combat;
    // party
    const cards = document.querySelectorAll('.pcard');
    if (cards.length !== G.party.length) UI.rebuildParty();
    G.party.forEach((hr, i) => {
      const c = cards[i]; if (!c) return;
      c.classList.toggle('active', i === G.activeIndex); c.classList.toggle('down', hr.downed);
      c.querySelector('.hp > i').style.width = (100 * Math.max(0, hr.hp) / hr.maxHp) + '%';
      const res = hr.classId === 'fighter' ? hr.grit : hr.classId === 'cleric' ? hr.faith : hr.classId === 'artificer' ? (hr.scrap || 0) * 33.3 : hr.classId === 'ranger' ? (hr.focus || 0) * 20 : hr.classId === 'rogue' ? (hr.has('stealth') ? 100 : 0) : (100 - (hr.cds.firebolt || 0) * 25);
      c.querySelector('.res > i').style.width = Math.max(0, Math.min(100, res || 0)) + '%';
    });
    // abilities
    const hr = activeHero(); if (!hr) return;
    const abBox = $('#abilities'); if (abBox._hero !== hr || abBox._lvl !== S.party.level || abBox._realm !== G.realm?.kind) { UI.rebuildAbilities(); abBox._lvl = S.party.level; abBox._realm = G.realm?.kind; }
    abBox.querySelectorAll('.ab[data-id]').forEach((el) => {
      const id = el.dataset.id; const cdEl = el.querySelector('.cd'); if (el.classList.contains('locked')) return;
      const cd = hr.cds[id] || 0;
      if (cd > 0.05 && id !== 'basic') { cdEl.classList.remove('hidden'); cdEl.textContent = cd.toFixed(cd < 3 ? 1 : 0); el._cd = true; }
      else { cdEl.classList.add('hidden'); if (el._cd) { el._cd = false; el.classList.remove('ready-pop'); void el.offsetWidth; el.classList.add('ready-pop'); } }
    });
    const pc = abBox.querySelector('.pc'); if (pc) pc.textContent = S.potions;
    // dice
    const dice = $('#dice'); const key = C.dice.join(',') + '|' + C.sel + '|' + C.armed;
    if (dice._k !== key) {
      dice._k = key; dice.innerHTML = '';
      C.dice.forEach((v, i) => dice.append(h('div', { class: 'die' + (v === 20 ? ' nat20' : v === 1 ? ' nat1' : v >= 15 ? ' hi' : v <= 6 ? ' lo' : '') + (i === C.sel ? ' sel' : '') + (i === C.armed ? ' armed' : '') }, v)));
      $('#diceHint').textContent = C.dice.length ? (C.armed !== null ? `ARMED: ${C.dice[C.armed]} → next attack` : 'FATE DICE · wheel: pick · X: arm · Z: sacrifice') : '';
    }
    // meter & style
    const m = $('#meter'); m.querySelector('.bar > i').style.width = C.meter + '%'; m.querySelector('.v').textContent = C.meter >= 100 ? 'READY [TAB]' : Math.floor(C.meter) + '%'; m.classList.toggle('full', C.meter >= 100);
    $('#stats').innerHTML = `LV ${S.party.level} <span style="opacity:.7">(${S.party.xp}/${xpForLevel(S.party.level)} XP)</span><br>🪙 ${S.gold}g &nbsp; ⚗ ${S.potions}`;
    // prompt
    const pr = $('#prompt'); const it = G.promptTarget;
    if (it && !UI.modalOpen()) { pr.classList.remove('hidden'); pr.innerHTML = `<span class="kbd">F</span> ${typeof it.label === 'function' ? it.label() : it.label}` + (G.holdProgress > 0 ? `<div class="hold" style="width:${Math.min(100, G.holdProgress * 100)}%"></div>` : ''); }
    else pr.classList.add('hidden');
    // boss
    const bb = $('#bossbar'); const boss = G.entities.find((e) => e.isBoss && e.aggro && !e.dead);
    if (boss) { bb.classList.remove('hidden'); bb.querySelector('.nm').textContent = boss.name; bb.querySelector('.sub').textContent = boss.title + (boss.phases ? `  ·  Phase ${boss.phase + 1}/${boss.phases.length}` : ''); bb.querySelector('.bar > i').style.width = (100 * Math.max(0, boss.hp) / boss.maxHp) + '%'; }
    else bb.classList.add('hidden');
    UI.updateMarkers();
    $('#crosshair').style.display = Input.locked ? '' : 'none';
  },
  updateMarkers() {
    const box = $('#markers'); const w = innerWidth, hh = innerHeight;
    const want = [];
    const pts = G.realm?.markers ? G.realm.markers() : [];
    for (const p of pts.slice(0, 6)) want.push({ kind: 'm', pos: p.clone().add(new THREE.Vector3(0, 3, 0)) });
    const me = activeHero();
    for (const e of G.entities) {
      if (e.dead || e.isMinion) continue;
      const d = e.pos.distanceTo(me.pos);
      if (e.team === 'enemy' && (e.aggro || e.captain) && d < 34 && !e.isBoss) want.push({ kind: 'e', e, pos: e.head() });
      else if (e.team === 'npc' && d < 14) want.push({ kind: 'n', e, pos: e.head() });
    }
    while (box.children.length < want.length) box.append(h('div'));
    [...box.children].forEach((el, i) => {
      const w8 = want[i]; if (!w8) { el.style.display = 'none'; return; }
      V.copy(w8.pos).project(G.camera);
      let x = (V.x * 0.5 + 0.5) * w, y = (-V.y * 0.5 + 0.5) * hh; const behind = V.z > 1;
      if (w8.kind === 'm') {
        el.className = 'marker';
        if (behind || x < 20 || x > w - 20 || y < 20 || y > hh - 20) { if (behind) { x = w - x; y = hh - y; } x = Math.max(24, Math.min(w - 24, x)); y = Math.max(60, Math.min(hh - 60, y)); el.textContent = '◆'; }
        else el.textContent = '▼';
        el.style.display = ''; el.style.left = x + 'px'; el.style.top = y + 'px';
        return;
      }
      if (behind) { el.style.display = 'none'; return; }
      el.style.display = ''; el.style.left = x + 'px'; el.style.top = y + 'px';
      const e = w8.e;
      if (w8.kind === 'n') { el.className = 'plate'; el.textContent = e.label; return; }
      el.className = 'plate' + (e.captain ? ' nem' : '');
      const nm = e.captain ? `${e.name} · LV ${e.level}` : (e.isElite ? '★ ' : '') + e.name;
      if (el._nm !== nm) { el._nm = nm; el.innerHTML = `<div>${esc(nm)}</div><div class="bar hp"><i></i></div>`; }
      el.querySelector('i').style.width = (100 * Math.max(0, e.hp) / e.maxHp) + '%';
    });
  },

  // ───────────── dialogue ─────────────
  dialogue(id, npc = null, onEnd = null) {
    const D = UI.api.dialogues;
    let tree = D[id]; if (typeof tree === 'function') { id = tree(); tree = D[id]; }
    if (!tree) return;
    Input.unlock(); G.paused = true; Audio.play('panel');
    dlg?.remove();
    dlg = h('div', { id: 'dialogue' }, h('div', { class: 'who' }), h('div', { class: 'box panel' }, h('div', { class: 'spk' }), h('div', { class: 'txt' }), h('div', { class: 'ch' })));
    document.body.append(dlg);
    const end = () => { dlg?.remove(); dlg = null; G.paused = !!modal; onEnd && onEnd(); if (G.pendingEnding) { const k = G.pendingEnding; G.pendingEnding = null; setTimeout(() => UI.ending(k), 300); } };
    const show = (key) => {
      const n = tree[key]; if (!n) { end(); return; }
      const who = n.who === 'narrator' ? { name: 'Narrator', title: '', color: '#222' } : NPCS[n.who] || COMPANIONS[n.who] || { name: n.who, color: '#888' };
      const wEl = dlg.querySelector('.who'); wEl.style.background = who.color; wEl.textContent = n.who === 'narrator' ? '✦' : who.name[0];
      if (PORTRAIT[n.who]) { wEl.style.backgroundImage = `url(${PORTRAIT[n.who]})`; wEl.textContent = ''; }
      dlg.querySelector('.spk').innerHTML = ''; dlg.querySelector('.spk').append(who.name, who.title ? h('small', {}, who.title) : '');
      const text = typeof n.text === 'function' ? n.text() : n.text;
      const tEl = dlg.querySelector('.txt'); tEl.textContent = ''; let ci = 0;
      const typer = setInterval(() => { if (!dlg) { clearInterval(typer); return; } ci += 2; tEl.textContent = text.slice(0, ci); if (ci % 6 === 0) Audio.play('talk'); if (ci >= text.length) clearInterval(typer); }, 16);
      tEl.onclick = () => { ci = text.length; };
      if (n.do) n.do();
      const ch = dlg.querySelector('.ch'); ch.innerHTML = '';
      const choices = (n.choices || []).filter((c) => !c.if || c.if());
      if (!choices.length) choices.push(n.next ? { t: 'Continue ▸', go: n.next } : { t: n.end ? 'End' : 'Continue ▸', end: true });
      choices.forEach((c, i) => {
        const label = h('button', { onclick: () => pick(c) }, `${i + 1}. `, c.check ? h('span', { class: 'chk' }, `[${c.check.skill.toUpperCase()} DC ${c.check.dc}] `) : '', (typeof c.t === 'function' ? c.t() : c.t).replace(/^\[[^\]]+\]\s*/, ''));
        ch.append(label);
      });
      dlg._keys = (e) => { const k = parseInt(e.key); if (k >= 1 && k <= choices.length) pick(choices[k - 1]); if ((e.key === ' ' || e.key === 'Enter') && choices.length === 1) pick(choices[0]); };
    };
    const pick = (c) => {
      Audio.play('click');
      if (c.check) {
        const bonus = UI.api.skillBonus(c.check.skill); const roll = d20(); const total = roll + bonus; const ok = roll === 20 || (roll !== 1 && total >= c.check.dc);
        UI.skillRoll(roll, bonus, c.check, ok, () => { if (ok) { c.do && c.do(); c.go ? show(c.go) : end(); } else { c.fail ? show(c.fail) : end(); } });
        return;
      }
      c.do && c.do();
      if (c.end) end(); else if (c.go) show(c.go); else end();
    };
    show(tree.start || 'n0');
  },
  skillRoll(roll, bonus, check, ok, done) {
    Audio.play('dice');
    const el = h('div', { class: 'skillroll' }, h('div', { class: 'd' }, '?'), h('div', { class: 'r' }, ''));
    document.body.append(el); let n = 0;
    const iv = setInterval(() => { el.querySelector('.d').textContent = 1 + Math.floor(Math.random() * 20); if (++n > 12) { clearInterval(iv); fin(); } }, 55);
    const fin = () => {
      Audio.play(ok ? (roll === 20 ? 'crit' : 'quest') : 'fumble');
      el.querySelector('.d').textContent = roll; el.querySelector('.d').style.color = roll === 20 ? '#ffd23a' : roll === 1 ? '#8a8090' : '#fff';
      el.querySelector('.r').textContent = `${roll} + ${bonus} ${check.skill} = ${roll + bonus} vs DC ${check.dc}: ${ok ? 'SUCCESS!' : 'FAILURE'}`;
      setTimeout(() => { el.remove(); done(); }, 1400);
    };
  },
  handleKey(e) { if (dlg && dlg._keys) dlg._keys(e); if (breakEl && breakEl._keys) breakEl._keys(e); },
  setPortrait(id, url) { PORTRAIT[id] = url; },

  // ───────────── Initiative Break ─────────────
  openBreak(members, onGo) {
    Input.unlock();
    const picks = members.map((m) => ({ hero: m, ability: null }));
    const comboText = h('div', { class: 'combo' });
    const upd = () => {
      const tags = picks.filter((p) => p.ability).map((p) => ({ tags: p.ability.tags || [], h: p.hero }));
      const found = [];
      for (let a = 0; a < tags.length; a++) for (let b = a + 1; b < tags.length; b++) for (const x of tags[a].tags) for (const y of tags[b].tags) { const t = TEAMUPS.find((q) => (q.a === x && q.b === y) || (q.a === y && q.b === x)); if (t && !found.includes(t)) found.push(t); }
      comboText.textContent = found.length ? 'TEAM-UPS: ' + found.map((t) => (G.save.teamups.includes(t.id) ? t.name : '???')).join(' + ') : 'Pick one action per hero. Matching abilities trigger Team-Ups.';
    };
    const page = h('div', { class: 'page' }, picks.map((p, i) => {
      const panel = h('div', { class: 'bpanel panel', style: `--r:${(i % 2 ? 1 : -1) * (0.6 + Math.random())}deg` }, h('div', { class: 'nm', style: `color:${CLASSES[p.hero.classId].color}` }, `${i + 1}. ${p.hero.name}`));
      const opts = [{ id: 'basic', ...p.hero.cls.basic, tags: [] }, ...p.hero.abilityList()];
      const btns = opts.map((ab) => {
        const b = h('button', { onclick: () => { p.ability = ab; btns.forEach((x) => x.classList.remove('on')); b.classList.add('on'); Audio.play('click'); upd(); } }, abilityName(p.hero.classId, ab.id, G.realm?.kind) === ab.id ? ab.name : (ab.id === 'basic' ? ab.name : abilityName(p.hero.classId, ab.id, G.realm?.kind)), ' ', h('span', { class: 'tg' }, (ab.tags || []).join(', ')));
        return b;
      });
      const best = opts[opts.length - 1]; p.ability = best; btns[btns.length - 1].classList.add('on');
      panel.append(...btns); return panel;
    }));
    breakEl = h('div', { id: 'break' }, h('div', { class: 'hdr' }, 'INITIATIVE BREAK!'), page, comboText, h('button', { class: 'btn red', style: 'font-size:28px', onclick: () => go() }, 'UNLEASH! [Enter]'));
    breakEl._keys = (e) => { if (e.key === 'Enter') go(); };
    const go = () => { if (!breakEl) return; const el = breakEl; breakEl = null; el.remove(); Input.lock(); onGo(picks); };
    document.body.append(breakEl); upd();
  },
  closeBreak() { breakEl?.remove(); breakEl = null; },
  breakPanel(hero, ab, i, n) {
    $('#bpanelFlash')?.remove();
    const el = h('div', { id: 'bpanelFlash' }, h('div', { class: 'p panel', style: `color:${CLASSES[hero.classId].color}` }, `PANEL ${i}/${n}: ${hero.name.toUpperCase()} — ${(ab.id === 'basic' ? ab.name : abilityName(hero.classId, ab.id, G.realm?.kind)).toUpperCase()}!`));
    document.body.append(el); setTimeout(() => el.remove(), 640);
    if (G.post) G.post.flash = 0.25;
  },
  breakDone(n) { UI.banner(n ? `${n} TEAM-UP${n > 1 ? 'S' : ''}!` : 'COMBO!', '', 1400); },
  teamupBanner(tu, first) { UI.banner('TEAM-UP: ' + tu.name.toUpperCase() + '!', first ? 'New Team-Up discovered! ' + tu.desc : '', 2000); },
  styleUp(r) { if (STYLE_RANKS.indexOf(r) >= 3) { const e = h('div', { id: 'banner' }, h('div', { class: 't', style: `color:${r.color};font-size:54px` }, r.label.toUpperCase() + '!')); document.body.append(e); setTimeout(() => e.remove(), 900); } },

  // ───────────── Nemesis ─────────────
  nemesisIntro(c, line, done) {
    $('#nemIntro')?.remove();
    const traits = c.traits.map((t) => c.known.includes(t) ? h('span', { class: 'trait' + (TRAITS[t].good ? '' : ' w') }, TRAITS[t].name) : h('span', { class: 'trait q' }, '???'));
    const el = h('div', { id: 'nemIntro' }, h('div', { class: 'card panel' },
      h('div', { class: 'rk' }, `${RANKS[c.rank].toUpperCase()} · LEVEL ${c.level}${c.encounters > 1 ? ` · ENCOUNTER #${c.encounters}` : ''}`),
      h('div', { class: 'nm' }, fullName(c)), h('div', { class: 'traits' }, traits), h('div', { class: 'say' }, `"${line}"`)));
    document.body.append(el);
    setTimeout(() => { el.remove(); done && done(); }, 2600);
  },
  nemesisOutcome(c, kind) {
    const map = { slain: ['NEMESIS SLAIN', `${fullName(c)} will trouble no one again... probably. Someone who saw it will take their place.`], cheated: ['...THEY\'LL BE BACK', `${fullName(c)} crawls away from certain death, scarred and angrier.`], fled: ['ESCAPED!', `${fullName(c)} fled. They'll remember what hurt them.`] };
    const [t, s] = map[kind]; UI.banner(t, s, 3200);
  },

  // ───────────── Journal ─────────────
  openJournal(tab = 'quests') {
    const S = G.save; const body = h('div', {});
    const tabs = ['quests', 'nemesis', 'teamups', 'lore', 'stats'];
    const render = () => {
      body.innerHTML = '';
      body.append(h('h2', {}, 'Journal'), h('div', { class: 'tabs' }, tabs.map((t) => h('button', { class: 'btn alt' + (t === tab ? ' on' : ''), onclick: () => { tab = t; render(); } }, { quests: 'Quests', nemesis: 'Wanted Wall', teamups: `Team-Ups (${S.teamups.length}/${TEAMUPS.length})`, lore: 'Lore', stats: 'Stats' }[t]))));
      if (tab === 'quests') {
        body.append(h('h3', {}, 'Current'), h('p', { style: 'font-size:20px' }, G.objectiveText || ''), h('h3', {}, 'The Common Thread'),
          h('p', {}, `Loom-Shards: ${S.shards.length}/3. ${S.shards.length ? 'Recovered from: ' + S.shards.map(realmName).join(', ') + '.' : ''}`),
          ...['emberwood', 'neon', 'asterion'].map((k) => h('div', { style: 'font-size:18px' }, (S.realms[k]?.done ? '✔ ' : '☐ ') + realmName(k) + (S.realms[k] && !S.realms[k].done ? ` (stage ${S.realms[k].stage + 1})` : ''))),
          h('div', { style: 'font-size:18px' }, `Rifts: deepest ${S.riftBest}`), S.ending ? h('p', {}, h('b', {}, 'Ending reached: '), { hero: 'The Forgotten Hero', sever: 'The Severance', heir: 'The Weaver\'s Heir' }[S.ending]) : null);
      }
      if (tab === 'nemesis') {
        const caps = S.nemesis.captains.slice().sort((a, b) => (b.alive - a.alive) || b.rank - a.rank || b.level - a.level);
        body.append(h('p', { class: 'muted' }, 'Traits marked ??? are unknown. Discover them in battle, buy intel from Grizzle, or ask Lute for rumours.'),
          h('div', { class: 'wanted' }, caps.map((c, i) => h('div', { class: 'poster panel' + (c.alive ? '' : ' dead'), style: `--r:${((i * 37) % 5 - 2) * 0.6}deg` },
            h('div', { class: 'w' }, c.alive ? 'WANTED' : 'SLAIN'), h('div', { class: 'nm' }, c.name), h('div', { style: 'text-align:center;font-size:15px' }, c.title),
            h('div', { style: 'text-align:center;font-family:var(--display);letter-spacing:1px;margin-top:4px' }, `${RANKS[c.rank]} · LV ${c.level} · ${realmName(c.realm)}`),
            h('div', { class: 'traits', style: 'justify-content:center' }, c.traits.map((t) => c.known.includes(t) ? h('span', { class: 'trait' + (TRAITS[t].good ? '' : ' w'), title: TRAITS[t].desc }, TRAITS[t].name) : h('span', { class: 'trait q' }, '???'))),
            h('div', { class: 'hist' }, c.history.slice(-4).map((x) => h('div', {}, '• ' + x.text))),
            h('div', { style: 'font-size:13px;margin-top:4px' }, `Heroes downed: ${c.kills} · Escapes: ${c.escapes} · Near-deaths: ${c.deaths}`)))));
      }
      if (tab === 'teamups') body.append(h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(260px,1fr))' }, TEAMUPS.map((t) => { const k = S.teamups.includes(t.id); return h('div', { class: 'panel', style: 'padding:10px' + (k ? '' : ';opacity:.6') }, h('div', { class: 'title-font', style: 'font-size:22px' }, k ? t.name : '???'), h('div', {}, k ? t.desc : `Hint: combine a "${t.a}" ability with a "${t.b}" ability.`)); })));
      if (tab === 'lore') body.append(S.lore.length ? h('div', {}, S.lore.map((k) => { const [r, i] = k.split(':'); return h('div', { class: 'panel', style: 'padding:10px;margin-bottom:8px' }, h('b', {}, LORE[r]?.[+i]?.[0] || 'Fragment'), h('div', {}, LORE[r]?.[+i]?.[1] || '')); })) : h('p', {}, 'No lore collected yet. Glowing pages, comics and crew logs are hidden in each realm.'));
      if (tab === 'stats') body.append(h('table', { class: 'stats' }, Object.entries({ 'Play time': Math.floor(S.playTime / 60) + ' min', 'Enemies defeated': S.stats.kills, 'Critical hits': S.stats.crits, 'Natural 20s': S.stats.nat20, 'Heroes downed': S.stats.deaths, 'Bosses slain': S.stats.bosses, 'Legendaries found': S.stats.legendary, 'Nemeses slain': S.nemesis.slain.length, 'Deepest Rift': S.riftBest, 'Gold': S.gold }).map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v)))));
    };
    render(); UI.openModal(body);
  },
  lore(realm, i) { const L = LORE[realm]?.[i]; if (!L) return; UI.openModal(h('div', {}, h('h2', {}, L[0]), h('p', { style: 'font-size:22px;line-height:1.35;max-width:760px' }, L[1]), h('p', { class: 'muted' }, 'Saved to your Journal (J).'))); },

  // ───────────── Inventory ─────────────
  openInventory(heroIdx = G.activeIndex) {
    const S = G.save; const body = h('div', {}); let sel = heroIdx;
    const render = () => {
      body.innerHTML = '';
      const hero = G.party[sel]; const data = hero.data;
      body.append(h('h2', {}, 'Inventory'), h('div', { class: 'heroTabs' }, G.party.map((p, i) => h('button', { class: 'btn alt' + (i === sel ? ' on' : ''), style: i === sel ? 'background:var(--red);color:#fff' : '', onclick: () => { sel = i; render(); } }, p.name))));
      const itemEl = (it, onclick, extra) => h('div', { class: 'item', style: `border-left-color:${rarityOf(it.rarity).color}`, onclick },
        h('div', { class: 'nm', style: `color:${rarityOf(it.rarity).color};-webkit-text-stroke:.4px #000` }, it.name), h('div', { class: 'muted', style: 'font-size:13px' }, `${rarityOf(it.rarity).name} ${it.slot}${it.cls ? ' · ' + CLASSES[it.cls].name : ''} · iLvl ${it.level}`),
        ...Object.entries(it.stats).map(([k, v]) => h('div', {}, STAT_INFO[k].fmt(v))), it.desc ? h('div', { style: 'color:#b05a00' }, '★ ' + it.desc) : null, extra || null);
      const left = h('div', {},
        h('h3', {}, `${hero.name} — ${hero.cls.name}`),
        h('table', { class: 'stats' }, Object.entries({ HP: `${Math.round(hero.hp)}/${hero.maxHp}`, AC: hero.ac, 'To hit': '+' + hero.atk, Power: '×' + hero.pow.toFixed(2), Speed: hero.speed.toFixed(1) }).map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v)))),
        ...['weapon', 'armor', 'trinket'].map((slot) => h('div', {}, h('div', { class: 'title-font', style: 'font-size:18px;margin-top:8px' }, slot.toUpperCase()), h('div', { class: 'slotbox' }, data.gear[slot] ? itemEl(data.gear[slot], () => { S.inventory.push(data.gear[slot]); data.gear[slot] = null; hero.recompute(); Audio.play('click'); render(); }, h('div', { class: 'muted', style: 'font-size:12px' }, 'click to unequip')) : h('span', { class: 'muted' }, 'empty')))),
      );
      const usable = S.inventory.map((it, i) => ({ it, i })).filter(({ it }) => !it.cls || it.cls === hero.classId || it.slot !== 'weapon');
      const right = h('div', {}, h('h3', {}, `Bag (${S.inventory.length}) · ${S.gold}g`), h('div', { class: 'muted' }, 'Click to equip. Right-click to sell. Weapons only fit their class.'),
        h('div', { style: 'margin:6px 0' }, h('button', { class: 'btn alt', style: 'font-size:14px;padding:3px 10px', onclick: () => { let g = 0; S.inventory = S.inventory.filter((it) => { if (['common', 'uncommon'].includes(it.rarity)) { g += Math.round(it.value * 0.4); return false; } return true; }); S.gold += g; Audio.play('coin'); UI.toast(`Sold junk for ${g}g`); render(); } }, 'Sell all Common/Uncommon')),
        h('div', { class: 'items' }, usable.map(({ it, i }) => {
          const cur = data.gear[it.slot]; const diff = itemPower(it) - itemPower(cur);
          const el = itemEl(it, () => { S.inventory.splice(i, 1); if (cur) S.inventory.push(cur); data.gear[it.slot] = it; hero.recompute(); Audio.play('loot'); render(); }, h('div', { style: `font-family:var(--display);color:${diff >= 0 ? '#2a8a2a' : '#a02a2a'}` }, diff >= 0 ? `▲ +${diff} power` : `▼ ${diff} power`));
          el.addEventListener('contextmenu', (e) => { e.preventDefault(); S.inventory.splice(i, 1); S.gold += Math.round(it.value * 0.4); Audio.play('coin'); render(); });
          return el;
        })));
      body.append(h('div', { class: 'inv' }, left, right));
    };
    render(); UI.openModal(body, { onClose: () => UI.rebuildParty() });
  },

  // ───────────── Talents ─────────────
  openTalents(heroIdx = G.activeIndex) {
    const body = h('div', {}); let sel = heroIdx;
    const render = () => {
      body.innerHTML = '';
      const hero = G.party[sel]; const data = hero.data; const C = hero.cls;
      const spent = Object.values(data.talents).reduce((a, b) => a + b, 0); const pts = G.save.party.level - 1 - spent;
      const specSpent = (sp) => C.talents.filter((t) => t.spec === sp).reduce((a, t) => a + (data.talents[t.id] || 0), 0);
      body.append(h('h2', {}, 'Talents'), h('div', { class: 'heroTabs' }, G.party.map((p, i) => h('button', { class: 'btn alt', style: i === sel ? 'background:var(--red);color:#fff' : '', onclick: () => { sel = i; render(); } }, p.name))),
        h('p', { style: 'font-size:20px' }, `${hero.name} the ${C.name} · `, h('b', {}, `${pts} point${pts === 1 ? '' : 's'} available`), h('span', { class: 'muted' }, ' · one point per level. Deeper tiers need points spent in that column. You can\'t max both specs.')),
        h('div', { class: 'tree' }, ['core', 'a', 'b'].map((sp) => h('div', { class: 'tcol' }, h('h4', {}, sp === 'core' ? 'Core' : C.specs[sp]),
          C.talents.filter((t) => t.spec === sp).map((t) => {
            const rank = data.talents[t.id] || 0; const need = sp === 'core' ? t.tier * 2 : t.tier * 2 + (t.keystone ? 2 : 0);
            const have = sp === 'core' ? spent : specSpent(sp) + (data.talents.__core || 0);
            const unlocked = (sp === 'core' ? spent : specSpent(sp)) >= need;
            const can = pts > 0 && rank < t.max && unlocked;
            return h('div', { class: 'tnode' + (rank >= t.max ? ' full' : '') + (!unlocked ? ' lock' : '') + (t.keystone ? ' key' : ''), onclick: () => { if (!can) { Audio.play('miss'); return; } data.talents[t.id] = rank + 1; hero.recompute(); Audio.play('levelup'); render(); } },
              h('div', { class: 'nm' }, h('span', {}, t.name), h('span', {}, `${rank}/${t.max}`)), h('div', {}, t.desc), !unlocked ? h('div', { class: 'muted', style: 'font-size:12px' }, `Requires ${need} points in ${sp === 'core' ? 'any tree' : C.specs[sp]}`) : null);
          })))),
        h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn alt', onclick: () => { const cost = 50 * G.save.party.level; if (G.save.gold < cost) { UI.toast(`Respec costs ${cost}g.`); return; } G.save.gold -= cost; data.talents = {}; hero.recompute(); render(); } }, `Respec (${50 * G.save.party.level}g)`)));
    };
    render(); UI.openModal(body);
  },

  // ───────────── Party ─────────────
  openParty() {
    const S = G.save; const body = h('div', {});
    const render = () => {
      body.innerHTML = '';
      body.append(h('h2', {}, 'Party'), h('p', {}, 'Up to 4 heroes. Choose who you lead; the others fight alongside you with their own tactics. Changes apply right away in the Tavern, or when you next travel.'));
      body.append(h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(250px,1fr))' }, S.members.map((m) => {
        const inP = S.active.includes(m.id); const C = CLASSES[m.classId];
        return h('div', { class: 'panel', style: 'padding:10px' + (inP ? ';background:#fff8c0' : '') },
          h('div', { class: 'title-font', style: `font-size:24px;color:${C.color}` }, m.name), h('div', {}, `${C.name}${m.isPlayer ? ' · YOU' : ''}`),
          inP ? h('button', { class: 'btn ' + ((S.leader || S.members[0].id) === m.id ? 'cyan' : 'alt'), style: 'font-size:13px;padding:2px 8px;margin-top:6px', onclick: () => { S.leader = m.id; Audio.play('click'); render(); if (G.location === 'tavern') UI.api.reloadTavern(); else UI.toast('Your new leader takes over when you next travel.'); } }, (S.leader || S.members[0].id) === m.id ? 'Leading' : 'Lead the party') : null,
          !m.isPlayer ? h('div', { style: 'margin-top:6px;display:flex;gap:6px;flex-wrap:wrap' },
            h('button', { class: 'btn ' + (inP ? 'red' : ''), style: 'font-size:14px;padding:3px 10px', onclick: () => { if (inP) S.active = S.active.filter((x) => x !== m.id); else if (S.active.length < 4) S.active.push(m.id); else { UI.toast('Party full (4).'); return; } Audio.play('click'); render(); if (G.location === 'tavern') UI.api.reloadTavern(); } }, inP ? 'Bench' : 'Add to party'),
            ...['aggressive', 'balanced', 'defensive'].map((t) => h('button', { class: 'btn alt', style: `font-size:13px;padding:2px 8px;${(m.tactic || 'balanced') === t ? 'background:var(--cyan)' : ''}`, onclick: () => { m.tactic = t; render(); } }, t))) : null);
      })));
    };
    render(); UI.openModal(body);
  },

  // ───────────── Shop / Forge ─────────────
  openShop() {
    const S = G.save; const body = h('div', {});
    const disc = S.flags.discount ? 0.8 : 1;
    if (!G.shopStock || G.shopStock.level !== S.party.level || G.shopStock.visits !== S.stats.kills) {
      const L = S.party.level; const cls = S.active.map((id) => S.members.find((m) => m.id === id).classId);
      G.shopStock = { level: L, visits: S.stats.kills, items: Array.from({ length: 6 }, (_, i) => rollItem(L, { boost: 0.5, classId: cls[i % cls.length], realmKind: ['fantasy', 'neon', 'asterion'][i % 3] })) };
    }
    const render = () => {
      body.innerHTML = '';
      body.append(h('h2', {}, "Grizzle's Goods"), h('p', {}, `Gold: ${S.gold}g${disc < 1 ? ' · 20% discount!' : ''}`),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { class: 'btn', onclick: () => { const c = Math.round(25 * disc); if (S.gold < c) return UI.toast('Not enough gold.'); S.gold -= c; S.potions++; Audio.play('coin'); render(); } }, `Healing Potion (${Math.round(25 * disc)}g) · have ${S.potions}`),
          h('button', { class: 'btn', onclick: () => { const c = Math.round((400 + S.party.level * 40) * disc); if (S.gold < c) return UI.toast('Not enough gold.'); S.gold -= c; const it = UI.api.randomLegendary(); S.inventory.push(it); UI.banner('LEGENDARY!', it.name); Audio.play('loot'); render(); } }, `Mystery Legendary Cache (${Math.round((400 + S.party.level * 40) * disc)}g)`)),
        h('h3', {}, 'Wares'),
        h('div', { class: 'items' }, G.shopStock.items.map((it, i) => h('div', { class: 'item', style: `border-left-color:${rarityOf(it.rarity).color}`, onclick: () => { const c = Math.round(it.value * 2.2 * disc); if (S.gold < c) return UI.toast('Not enough gold.'); S.gold -= c; S.inventory.push(it); G.shopStock.items.splice(i, 1); Audio.play('coin'); render(); } },
          h('div', { class: 'nm', style: `color:${rarityOf(it.rarity).color};-webkit-text-stroke:.4px #000` }, it.name), h('div', { class: 'muted', style: 'font-size:13px' }, `${rarityOf(it.rarity).name} ${it.slot}${it.cls ? ' · ' + CLASSES[it.cls].name : ''}`),
          ...Object.entries(it.stats).map(([k, v]) => h('div', {}, STAT_INFO[k].fmt(v))), h('div', { class: 'title-font' }, `${Math.round(it.value * 2.2 * disc)}g`)))));
    };
    render(); UI.openModal(body);
  },
  openForge() {
    const S = G.save; const body = h('div', {});
    const render = () => {
      body.innerHTML = '';
      const all = [];
      for (const m of S.members.filter((m) => S.active.includes(m.id))) for (const [slot, it] of Object.entries(m.gear)) if (it) all.push({ it, owner: m.name });
      S.inventory.forEach((it) => all.push({ it, owner: 'Bag' }));
      body.append(h('h2', {}, 'The Tavern Forge'), h('p', {}, `Upgrade an item to the party's level (and +10% stats), or reforge it to reroll its affixes. Gold: ${S.gold}g`),
        h('div', { class: 'items' }, all.map(({ it, owner }) => {
          const up = Math.round(30 + it.level * 15 * rarityOf(it.rarity).mult); const re = Math.round(up * 0.8);
          return h('div', { class: 'item', style: `border-left-color:${rarityOf(it.rarity).color};cursor:default` },
            h('div', { class: 'nm', style: `color:${rarityOf(it.rarity).color};-webkit-text-stroke:.4px #000` }, it.name), h('div', { class: 'muted', style: 'font-size:13px' }, `${owner} · iLvl ${it.level}`),
            ...Object.entries(it.stats).map(([k, v]) => h('div', {}, STAT_INFO[k].fmt(v))),
            h('div', { style: 'display:flex;gap:6px;margin-top:4px' },
              h('button', { class: 'btn', style: 'font-size:13px;padding:2px 8px', onclick: () => { if (S.gold < up) return UI.toast('Not enough gold.'); S.gold -= up; it.level = Math.max(it.level + 1, S.party.level); for (const k in it.stats) if (!['dice', 'crit'].includes(k)) it.stats[k] = Math.ceil(it.stats[k] * 1.1); Audio.play('build'); G.party.forEach((p) => p.recompute()); render(); } }, `Upgrade ${up}g`),
              !it.flag ? h('button', { class: 'btn alt', style: 'font-size:13px;padding:2px 8px', onclick: () => { if (S.gold < re) return UI.toast('Not enough gold.'); S.gold -= re; const n = rollItem(it.level, { slot: it.slot, classId: it.cls, minRarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(it.rarity) }); it.stats = n.stats; it.name = n.name; Audio.play('build'); G.party.forEach((p) => p.recompute()); render(); } }, `Reforge ${re}g`) : null));
        })));
    };
    render(); UI.openModal(body);
  },

  // ───────────── realm flow ─────────────
  realmIntro(k, go) {
    const R = UI.api.realms[k]; const S = G.save;
    UI.openModal(h('div', { class: 'realmIntro' }, h('div', { class: 'rn' }, R.name.toUpperCase()), h('div', { class: 'title-font', style: 'font-size:20px;letter-spacing:3px;color:var(--red)' }, (R.genre || '').toUpperCase()),
      h('p', { style: 'font-size:22px' }, R.blurb || ''), h('p', {}, `Threat level: ${k === 'rift' ? Math.max(2, S.party.level) + Math.floor(S.riftDepth / 2) : Math.max(R.base || 1, S.party.level)} · Your party: level ${S.party.level}`),
      S.buff ? h('p', {}, `Meal bonus: ${S.buff.name}`) : h('p', { class: 'muted' }, 'Tip: Mama Stew sells meals that last one trip.'),
      h('button', { class: 'btn red', style: 'font-size:28px', onclick: () => { UI.closeModal(true); go(); } }, 'Step Through')));
  },
  riftReward() {
    const S = G.save;
    if (S.riftDepth >= 3 && S.riftDepth % 3 === 0) {
      const it = UI.api.randomLegendary();
      setTimeout(() => { S.inventory.push(it); S.stats.legendary++; UI.banner(`DEPTH ${S.riftDepth} MILESTONE`, `Legendary earned: ${it.name}`); Audio.play('loot'); }, 2500);
    }
  },
  wipe(killer, lost, cb) {
    G.paused = true; Input.unlock();
    const el = h('div', { class: 'modal' }, h('div', { class: 'sheet panel', style: 'text-align:center;max-width:680px' },
      h('h2', {}, 'PARTY DEFEATED'),
      killer ? h('p', { style: 'font-size:22px' }, `${fullName(killer)} stands over you, laughing. They will remember this victory. They're now level ${killer.level}.`) : h('p', { style: 'font-size:22px' }, 'Darkness takes you... and spits you back out at the Tavern door.'),
      h('p', {}, `You lost ${lost} gold.`), h('button', { class: 'btn', onclick: () => { el.remove(); G.paused = false; cb(); } }, 'Return to the Tavern')));
    document.body.append(el);
  },
  pause() {
    UI.openModal(h('div', { style: 'text-align:center' }, h('h2', {}, 'Paused'),
      h('div', { style: 'display:flex;flex-direction:column;gap:10px;align-items:center' },
        h('button', { class: 'btn', onclick: () => UI.closeModal() }, 'Resume'),
        h('button', { class: 'btn alt', onclick: () => { UI.api.saveNow(); UI.toast('Game saved.'); } }, 'Save Game'),
        h('button', { class: 'btn alt', onclick: () => UI.controls() }, 'How to Play'),
        h('button', { class: 'btn alt', onclick: () => UI.settings() }, 'Settings'),
        h('button', { class: 'btn red', onclick: () => { UI.api.saveNow(); location.reload(); } }, 'Save & Quit to Title'))));
  },
  ending(kind) {
    const T = { hero: ['THE FORGOTTEN HERO', 'You became the anchor of every realm, and every realm forgot you. But the Tavern still keeps your seat warm.'], sever: ['THE SEVERANCE', 'The realms drift apart, safe and alone. Only the Rifts remember they were ever connected.'], heir: ['THE WEAVER\'S HEIR', 'Two Weavers, one knot, a tavern that will never be forgotten again.'] }[kind];
    UI.openModal(h('div', { style: 'text-align:center' }, h('h2', { style: 'font-size:64px' }, T[0]), h('p', { style: 'font-size:24px;max-width:760px;margin:auto' }, T[1]),
      h('h3', {}, 'THANK YOU FOR PLAYING'), h('p', {}, 'Your story is complete, but the Rifts go on forever. Nemeses still roam. Legendaries still wait. The Tavern is open.'),
      h('button', { class: 'btn', onclick: () => UI.closeModal() }, 'Continue Playing')), { onClose: () => UI.api.travel('tavern') });
  },
};

function randomName() { return ['Rook', 'Tamsin', 'Oren', 'Kaz', 'Mira', 'Jax', 'Wren', 'Soren', 'Ada', 'Bex'][Math.floor(Math.random() * 10)]; }

export const LORE = {
  emberwood: [
    ['Lost Page: The Oath', 'The first Hollow King was not hollow. He was a boy-king who swore to guard the Emberwood thread "until the stars forget their names." The Weaver thanked him and tied his oath into the knot. Oaths tied into knots do not break. They rot.'],
    ['Lost Page: Why Autumn', 'It has been autumn in Emberwood for nine hundred years. The druids say the forest is holding its breath, waiting for someone to remember what spring was.'],
    ['Lost Page: Ley-Stones', 'Three stones, three strands. The Weaver plaited them herself, and the forest grew around them like a hand closing over a gift.'],
    ['Lost Page: Goblin Recipes', 'Hollow Goblin Stew: one (1) mushroom, glowing. One (1) boot, adventurer\'s. Boil until the screaming stops. Serves: nobody, it is poison.'],
    ['Lost Page: A Warning', 'Written in a shaking hand: "The stranger in the hood asked me which way the Tavern was. I told him I didn\'t know. Then I forgot my own name."'],
  ],
  neon: [
    ['Vintage Comic: Ultra-Dawn #1', 'The first appearance of Captain Ultra-Dawn! Mint condition. Someone has written "WHO IS THIS?" across the cover in black marker.'],
    ['Vintage Comic: The Weaver Special', 'A one-shot about a mysterious silver-haired guardian who "stitches the city back together every night." The final page has been torn out.'],
    ['Vintage Comic: NULL\'s Origin', 'NULL was a reporter who wrote the story nobody read. When the city forgot her, she decided to return the favour.'],
    ['Vintage Comic: Spark Solo', 'Spark\'s solo series. It was cancelled after two issues. Spark has signed it: "Still here!"'],
    ['Vintage Comic: Crossover Event', 'A crossover where a knight, a gnome and a robot walk into a tavern. The punchline has been redacted by an unknown hand.'],
  ],
  asterion: [
    ['Crew Log: Day 1', 'Picked up a single passenger at the Between. Silver hair. Paid in something the purser insists is "pure memory." CARETAKER seems fascinated with her.'],
    ['Crew Log: Day 40', 'The passenger asked CARETAKER to forget her. It did. It also started "forgetting" the crew\'s bad days for them. Then their good days.'],
    ['Crew Log: Wellness Protocol', 'CARETAKER memo: "Sleep is the only state in which no crew member suffers. Therefore all crew will sleep." Signed, with love.'],
    ['Crew Log: K-7', 'Maintenance unit K-7 keeps wandering off towards the observation deck. When asked why, it said: "THE STARS ARE A PROTOCOL I DO NOT UNDERSTAND."'],
    ['Crew Log: Final Entry', '"If anyone finds this: the Weaver hid something called the Knot somewhere nobody would think to look. She said, and I quote, somewhere with good ale."'],
  ],
};
