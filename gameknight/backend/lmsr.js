// Logarithmic Market Scoring Rule (Hanson) — the automated market maker behind
// every GameKnight market. Each outcome has an outstanding share quantity q_i;
// a winning share pays out 1 coin. Liquidity parameter b controls depth:
// the house's worst-case loss per market is b * ln(n).
//
//   C(q)      = b * ln( Σ exp(q_i / b) )
//   price_i   = exp(q_i / b) / Σ exp(q_j / b)       (always sums to 1)
//   buy cost  = C(q + Δ·e_i) − C(q)
//
// All exponentials are shifted by max(q) (log-sum-exp) for numerical stability.

function lse(qs, b) {
  const m = Math.max(...qs.map(q => q / b));
  return m + Math.log(qs.reduce((s, q) => s + Math.exp(q / b - m), 0));
}

function cost(qs, b) {
  return b * lse(qs, b);
}

function prices(qs, b) {
  const m = Math.max(...qs.map(q => q / b));
  const ex = qs.map(q => Math.exp(q / b - m));
  const sum = ex.reduce((a, c) => a + c, 0);
  return ex.map(e => e / sum);
}

// Coins needed to buy `shares` of outcome i (negative shares = sell, returns negative cost)
function costToTrade(qs, b, i, shares) {
  const next = qs.slice();
  next[i] += shares;
  return cost(next, b) - cost(qs, b);
}

// Shares received for spending `amount` coins on outcome i (closed form).
//   Δ = b · ln( 1 + (e^{A/b} − 1) / p_i )
function sharesForAmount(qs, b, i, amount) {
  const p = prices(qs, b)[i];
  return b * Math.log(1 + Math.expm1(amount / b) / p);
}

// Initial quantities that make the market open at the given probabilities.
function initialQuantities(probs, b) {
  const total = probs.reduce((a, c) => a + c, 0);
  const qs = probs.map(p => b * Math.log(p / total));
  const min = Math.min(...qs);
  return qs.map(q => q - min); // shift so all q >= 0; prices are shift-invariant
}

module.exports = { cost, prices, costToTrade, sharesForAmount, initialQuantities };
