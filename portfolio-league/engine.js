/* NetNet Portfolio League — deterministic engine (prototype).
   All prices are SIMULATED demo data from a seeded generator. Not real prices. */
(function (root) {
  'use strict';
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // Annualised drift / vol / correlation to a common market factor (illustrative only)
  var ASSETS = [
    { id: 'US500', name: 'US 500 Index', cls: 'Index',     mu: 0.09, vol: 0.16, rho: 1.00, color: '#9fb3c8' },
    { id: 'AAPL',  name: 'Apple',        cls: 'Stock',     mu: 0.11, vol: 0.26, rho: 0.70, color: '#cfd8e3' },
    { id: 'MSFT',  name: 'Microsoft',    cls: 'Stock',     mu: 0.11, vol: 0.25, rho: 0.72, color: '#4fa3ff' },
    { id: 'NVDA',  name: 'NVIDIA',       cls: 'Stock',     mu: 0.20, vol: 0.50, rho: 0.62, color: '#76d672' },
    { id: 'AMZN',  name: 'Amazon',       cls: 'Stock',     mu: 0.12, vol: 0.32, rho: 0.66, color: '#f5a623' },
    { id: 'TSLA',  name: 'Tesla',        cls: 'Stock',     mu: 0.12, vol: 0.58, rho: 0.50, color: '#ff6b6b' },
    { id: 'GOLD',  name: 'Gold',         cls: 'Commodity', mu: 0.05, vol: 0.15, rho: -0.10, color: '#e8c547' },
    { id: 'TBILL', name: 'US T-Bill',    cls: 'Cash-like', mu: 0.045, vol: 0.004, rho: 0.00, color: '#7fd1c7' },
    { id: 'NET',   name: 'NetNet NET',   cls: 'Crypto',    mu: 0.25, vol: 0.90, rho: 0.30, color: '#b18cff' }
  ];
  var DAYS = 5, STEPS_PER_DAY = 8, STEPS = DAYS * STEPS_PER_DAY;
  var RULES = { maxPicks: 5, minWeight: 5, maxWeight: 60, step: 5, ddPenalty: 0.5,
    split: { prize: 0.75, treasury: 0.20, seed: 0.05 }, winnersPct: 0.10,
    tiers: [25, 15, 10, 4, 4, 4, 4, 4, 4, 4], restShare: 22 };

  // Deterministic price paths for a season seed. Same seed => identical paths, always.
  function pricePaths(seed) {
    var r = mulberry32(seed >>> 0), dt = 1 / (252 * STEPS_PER_DAY), paths = {};
    ASSETS.forEach(function (a) { paths[a.id] = [100]; });
    for (var t = 1; t <= STEPS; t++) {
      var zm = gauss(r);
      ASSETS.forEach(function (a) {
        var z = a.rho * zm + Math.sqrt(1 - a.rho * a.rho) * gauss(r);
        var p = paths[a.id][t - 1] * Math.exp((a.mu - 0.5 * a.vol * a.vol) * dt + a.vol * Math.sqrt(dt) * z);
        paths[a.id].push(p);
      });
    }
    return paths;
  }

  function validate(w) {
    var ids = Object.keys(w).filter(function (k) { return w[k] > 0; }), sum = 0, errs = [];
    ids.forEach(function (k) { sum += w[k];
      if (!ASSETS.some(function (a) { return a.id === k; })) errs.push('Unknown asset ' + k);
      if (w[k] % RULES.step) errs.push(k + ' must be a multiple of ' + RULES.step + '%');
      if (w[k] < RULES.minWeight) errs.push(k + ' below ' + RULES.minWeight + '% minimum');
      if (w[k] > RULES.maxWeight) errs.push(k + ' above ' + RULES.maxWeight + '% cap');
    });
    if (ids.length < 1 || ids.length > RULES.maxPicks) errs.push('Pick 1 to ' + RULES.maxPicks + ' assets');
    if (sum !== 100) errs.push('Weights must total 100% (now ' + sum + '%)');
    return { ok: errs.length === 0, errors: errs, sum: sum, picks: ids.length };
  }

  // Buy-and-hold valuation; score = return% - 0.5 x max drawdown%
  function evaluate(w, paths) {
    var v = [];
    for (var t = 0; t <= STEPS; t++) { var s = 0;
      for (var k in w) if (w[k] > 0) s += (w[k] / 100) * paths[k][t] / paths[k][0];
      v.push(s); }
    var peak = v[0], mdd = 0, rets = [];
    for (var i = 1; i < v.length; i++) { peak = Math.max(peak, v[i]); mdd = Math.max(mdd, (peak - v[i]) / peak); rets.push(v[i] / v[i - 1] - 1); }
    var mean = rets.reduce(function (a, b) { return a + b; }, 0) / rets.length;
    var sd = Math.sqrt(rets.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / rets.length);
    var ret = (v[v.length - 1] - 1) * 100, dd = mdd * 100;
    return { values: v, ret: ret, maxDD: dd, score: ret - RULES.ddPenalty * dd,
      sharpe: sd > 0 ? mean / sd * Math.sqrt(252 * STEPS_PER_DAY) : 0 };
  }

  // Ranking: score desc, then lower drawdown, then earlier lock-in. No random tie-break.
  function rank(entries) {
    return entries.slice().sort(function (a, b) {
      return (b.score - a.score) || (a.maxDD - b.maxDD) || (a.lockedAt - b.lockedAt);
    }).map(function (e, i) { e.rank = i + 1; return e; });
  }

  function winnersCount(n) { return n <= 0 ? 0 : Math.max(1, Math.ceil(n * RULES.winnersPct - 1e-9)); }

  // Tiered payout weights for W winners (percent of prize pool, sums to 100)
  function payoutTable(W) {
    if (W <= 0) return [];
    var w = [];
    for (var i = 0; i < W; i++) w.push(i < RULES.tiers.length ? RULES.tiers[i] : RULES.restShare / (W - RULES.tiers.length));
    var tot = w.reduce(function (a, b) { return a + b; }, 0);
    return w.map(function (x) { return x / tot * 100; });
  }

  function economics(players, fee) {
    var gross = players * fee, W = winnersCount(players), tbl = payoutTable(W), prize = gross * RULES.split.prize;
    return { players: players, fee: fee, gross: gross, prize: prize,
      treasury: gross * RULES.split.treasury, seed: gross * RULES.split.seed,
      winners: W, payouts: tbl.map(function (p) { return prize * p / 100; }) };
  }

  // 20 simulated players with seeded, rule-compliant portfolios
  var NAMES = ['QuantKarel', 'BondDesk_Ann', 'GhentValue', 'DividendDad', 'MacroMira', 'ThetaTom', 'IndexIris',
    'VolSeller', 'BuffettFan88', 'GoldBugGerd', 'CFA_Level3', 'DeltaNeutral', 'NasdaqNina', 'RiskParityRik',
    'TreasuryTess', 'AlphaAntwerp', 'SharpeShooter', 'LongOnlyLeo', 'CarryTradeCo', 'MomentumMo'];
  function botPortfolios(seed) {
    var r = mulberry32((seed ^ 0x9E3779B9) >>> 0);
    return NAMES.map(function (name, idx) {
      var n = 2 + Math.floor(r() * 4), pool = ASSETS.map(function (a) { return a.id; }), picks = [];
      while (picks.length < n) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
      var w = {}; picks.forEach(function (p) { w[p] = RULES.minWeight; });
      var left = 100 - n * RULES.minWeight;
      while (left > 0) { var p = picks[Math.floor(r() * n)]; if (w[p] + RULES.step <= RULES.maxWeight) { w[p] += RULES.step; left -= RULES.step; }
        else if (picks.every(function (q) { return w[q] + RULES.step > RULES.maxWeight; })) break; }
      return { name: name, weights: w, lockedAt: 1000 + idx * 37 };
    });
  }

  var api = { mulberry32: mulberry32, ASSETS: ASSETS, RULES: RULES, DAYS: DAYS, STEPS: STEPS, STEPS_PER_DAY: STEPS_PER_DAY,
    pricePaths: pricePaths, validate: validate, evaluate: evaluate, rank: rank, winnersCount: winnersCount,
    payoutTable: payoutTable, economics: economics, botPortfolios: botPortfolios };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PL = api;
})(this);
