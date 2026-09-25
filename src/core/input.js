// Keyboard + mouse state with per-frame "pressed" edges and pointer lock.
const held = new Set();
const pressed = new Set();
const mouse = { dx: 0, dy: 0, wheel: 0, buttons: new Set(), clicked: new Set(), locked: false };
let canvasEl = null;
let captureEnabled = true;

export const Input = {
  init(canvas) {
    canvasEl = canvas;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!held.has(e.code)) pressed.add(e.code);
      held.add(e.code);
    });
    addEventListener('keyup', (e) => held.delete(e.code));
    addEventListener('blur', () => { held.clear(); mouse.buttons.clear(); });
    addEventListener('mousemove', (e) => {
      if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!mouse.locked && captureEnabled) { Input.lock(); return; }
      mouse.buttons.add(e.button); mouse.clicked.add(e.button);
    });
    addEventListener('mouseup', (e) => mouse.buttons.delete(e.button));
    addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { mouse.locked = document.pointerLockElement === canvasEl; });
  },
  lock() { try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} },
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); },
  setCapture(on) { captureEnabled = on; if (!on) Input.unlock(); },
  down: (c) => held.has(c),
  hit: (c) => pressed.has(c),
  consume: (c) => { const h = pressed.has(c); pressed.delete(c); return h; },
  mouse,
  mouseDown: (b) => mouse.buttons.has(b),
  mouseHit: (b) => mouse.clicked.has(b),
  endFrame() { pressed.clear(); mouse.clicked.clear(); mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0; },
  get locked() { return mouse.locked; },
};
