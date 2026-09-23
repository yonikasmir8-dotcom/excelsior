const test = require('node:test');
const assert = require('node:assert/strict');
const lmsr = require('../lmsr');

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

test('prices sum to 1 and match opening probabilities', () => {
  const probs = [0.45, 0.27, 0.28];
  const qs = lmsr.initialQuantities(probs, 250);
  const ps = lmsr.prices(qs, 250);
  close(ps.reduce((a, c) => a + c, 0), 1);
  ps.forEach((p, i) => close(p, probs[i]));
});

test('sharesForAmount is the inverse of costToTrade', () => {
  const qs = lmsr.initialQuantities([0.5, 0.25, 0.25], 100);
  for (const amt of [1, 25, 500, 5000]) {
    const shares = lmsr.sharesForAmount(qs, 100, 1, amt);
    close(lmsr.costToTrade(qs, 100, 1, shares), amt, 1e-6);
  }
});

test('buying raises price, each share costs between 0 and 1', () => {
  const qs = [0, 0];
  const shares = lmsr.sharesForAmount(qs, 100, 0, 30);
  assert.ok(shares > 30 && shares < 60); // avg price between 0.5 and 1
  const after = lmsr.prices([shares, 0], 100);
  assert.ok(after[0] > 0.5);
});

test('buy then sell same shares round-trips to zero cost', () => {
  const qs = [10, 3, 7];
  const shares = lmsr.sharesForAmount(qs, 250, 2, 80);
  const next = [10, 3, 7 + shares];
  close(-lmsr.costToTrade(next, 250, 2, -shares), 80, 1e-6);
});

test('stable with huge quantities', () => {
  const ps = lmsr.prices([1e6, 1e6 - 50, 0], 100);
  assert.ok(ps.every(Number.isFinite));
  close(ps.reduce((a, c) => a + c, 0), 1);
});
