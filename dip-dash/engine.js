/* NetNet Arcade · Cabinet 04 · DIP DASH — deterministic engine.
   The "tape" is SIMULATED price action generated from a public daily seed.
   Same tape + same inputs = same score, always. No randomness during play. */
(function (root) {
  'use strict';
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  var TPS = 30;                 // simulation ticks per second
  var SEG = 180;                // 6 seconds per asset
  var CFG = { start: 10000, lev: 3, fee: 0.0015, cooldown: 6, liq: 0.5, cashYield: 0.00002 };
  // Real-world-asset tapes (simulated). kind drives the event pattern players learn.
  var ASSETS = [
    { id: 'tGOLD', name: 'Tokenized Gold',  emoji: '🥇', color: '#ffd23f', vol: 0.0016, dip: 0.05, kind: 'dip'  },
    { id: 'tNVDA', name: 'Tokenized NVIDIA', emoji: '📈', color: '#39ff14', vol: 0.0030, dip: 0.09, kind: 'dip'  },
    { id: 'tBOND', name: '10Y Treasury Bond', emoji: '🏛️', color: '#38f5ff', vol: 0.0012, dip: 0.05, kind: 'cpi'  },
    { id: 'tREIT', name: 'Tokenized Real Estate', emoji: '🏢', color: '#ff2bd6', vol: 0.0012, dip: 0.04, kind: 'rent' }
  ];
  var TICKS = SEG * ASSETS.length;

  function utcDay(d) { d = d || new Date(); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
  function tapeNo(day) { var y = Math.floor(day / 10000), m = Math.floor(day / 100) % 100, dd = day % 100;
    return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(2026, 9, 17)) / 864e5) + 1; }

  // Build the daily tape: price per tick per segment (each segment starts at 100).
  function makeTape(day) {
    var r = mulberry32((day * 2654435761) >>> 0), segs = [];
    ASSETS.forEach(function (a) {
      var p = [100], ar = 0, ev = new Float64Array(SEG + 1);
      var nDips = a.kind === 'rent' ? 1 : 2;
      for (var k = 0; k < nDips; k++) {           // scheduled dip + V-recovery events
        var at = 25 + Math.floor(r() * (SEG - 80)) + k * 10, depth = a.dip * (0.7 + 0.6 * r()), down = 12 + Math.floor(r() * 8), up = 24 + Math.floor(r() * 16);
        for (var i = 0; i < down && at + i <= SEG; i++) ev[at + i] -= depth / down;
        for (var j = 0; j < up && at + down + j <= SEG; j++) ev[at + down + j] += depth * 1.1 / up;
      }
      if (a.kind === 'cpi') { var c = 60 + Math.floor(r() * 70); ev[c] -= 0.03; ev[c + 1] -= 0.015; }   // hot-CPI gap down
      if (a.kind === 'rent') for (var t0 = 40; t0 <= SEG; t0 += 45) ev[t0] += 0.012;                       // rent day, every 1.5 s
      var drift = (r() - 0.4) * a.vol * 0.25;
      for (var t = 1; t <= SEG; t++) { ar = 0.75 * ar + 0.25 * a.vol * 1.5 * gauss(r); p.push(p[t - 1] * Math.exp(drift + ar + ev[t])); }
      segs.push(p);
    });
    return { day: day, no: tapeNo(day), segs: segs };
  }

  // Stepper used by both the live game and the verifier, so they can never disagree.
  function createRun(tape) {
    var st = { g: 0, eq: CFG.start, pos: 0, last: -1e9, liquidated: false, done: false, segRet: [], segStart: CFG.start, trades: 0, path: [CFG.start], peak: CFG.start, maxDD: 0 };
    st.step = function (want) {
      if (st.done) return st;
      var g = ++st.g;
      if (want !== st.pos && g - st.last >= CFG.cooldown) { st.eq *= 1 - CFG.fee * Math.abs(want - st.pos); st.pos = want; st.last = g; st.trades++; }
      var s = Math.floor((g - 1) / SEG), i = (g - 1) % SEG + 1, P = tape.segs[s], ret = P[i] / P[i - 1] - 1;
      st.eq *= st.pos === 0 ? 1 + CFG.cashYield : Math.max(0, 1 + st.pos * CFG.lev * ret);
      st.peak = Math.max(st.peak, st.eq); st.maxDD = Math.max(st.maxDD, 1 - st.eq / st.peak); st.path.push(st.eq);
      if (st.eq < CFG.start * CFG.liq) { st.liquidated = true; st.segRet.push(st.eq / st.segStart - 1); st.done = true; }
      else if (i === SEG) { st.segRet.push(st.eq / st.segStart - 1); st.segStart = st.eq; if (g >= TICKS) st.done = true; }
      return st;
    };
    st.result = function () { return { equity: st.eq, score: Math.round((st.eq / CFG.start - 1) * 10000) / 100, liquidated: st.liquidated, segRet: st.segRet.slice(), trades: st.trades, maxDD: st.maxDD, path: st.path }; };
    return st;
  }
  // Inputs: array of [tick, pos] changes (pos -1/0/1). Cooldown is enforced by the engine.
  function simulate(tape, changes) {
    var run = createRun(tape), ci = 0, want = 0;
    while (!run.done) { var g = run.g + 1; while (ci < changes.length && changes[ci][0] <= g) { want = changes[ci][1]; ci++; } run.step(want); }
    return run.result();
  }

  function encode(changes) { return changes.map(function (c) { return c[0].toString(36) + (c[1] > 0 ? 'L' : c[1] < 0 ? 'S' : 'F'); }).join('.'); }
  function decode(s) { if (!s) return []; var out = [], prev = 0;
    s.split('.').forEach(function (x) { var m = /^([0-9a-z]+)([LSF])$/.exec(x); if (!m) throw new Error('bad replay');
      var t = parseInt(m[1], 36); if (t < prev || t > TICKS) throw new Error('bad replay'); prev = t; out.push([t, m[2] === 'L' ? 1 : m[2] === 'S' ? -1 : 0]); });
    return out; }
  function strip(res) { var e = res.segRet.map(function (x) { return x > 0.0005 ? '🟩' : x < -0.0005 ? '🟥' : '⬜'; });
    if (res.liquidated) e[e.length - 1] = '💀'; while (e.length < ASSETS.length) e.push('⬛'); return e.join(''); }

  // Demo bots (simulated players): rule-based strategies with human-ish reaction delays.
  function botChanges(tape, kind, k, delay) {
    var ch = [], cur = 0;
    for (var g = 1; g <= TICKS; g++) {
      var s = Math.floor((g - 1) / SEG), i = (g - 1) % SEG + 1, P = tape.segs[s], j = Math.max(0, i - delay), j0 = Math.max(0, j - k);
      var m = P[j] / P[j0] - 1, want = 0;
      if (kind === 'hold') want = 1;
      else if (kind === 'mom') want = m > 0.004 ? 1 : m < -0.004 ? -1 : 0;
      else if (kind === 'dip') want = m < -0.01 ? 1 : (m > 0.01 ? 0 : cur);
      else if (kind === 'long') want = m > 0.002 ? 1 : 0;
      if (want !== cur) { ch.push([g, want]); cur = want; }
    }
    return ch;
  }
  var BOTS = [['TapeReaderTom','mom',20,9],['GoldBugGerd','dip',15,10],['BondVigilante','mom',30,12],['RentSeeker','long',10,8],['DiamondHands','hold',0,0],
    ['DipBuyer_BE','dip',25,9],['ScalpQueen','mom',10,7],['CPI_Sniper','mom',15,8],['REIT_Ruben','long',20,11],['Macro_Mira','mom',40,14],
    ['ThetaTom','dip',10,12],['QuantQuinn','mom',25,10],['VolSeller','dip',30,13],['T-Bill_Tess','long',30,15],['LiquidationLarry','mom',6,6],
    ['BuffettFan88','hold',0,0],['NasdaqNina','mom',18,9],['AlphaAnya','long',14,9],['SharpeShooter','dip',20,11],['CarryTradeCo','mom',35,13]];
  function demoBoard(tape) {
    return BOTS.map(function (b, idx) { var r = simulate(tape, botChanges(tape, b[1], b[2], b[3]));
      return { name: b[0], score: r.score, liquidated: r.liquidated, strip: strip(r), at: idx }; });
  }
  function rank(rows) { return rows.slice().sort(function (a, b) { return (b.score - a.score) || (a.at - b.at); }).map(function (r, i) { r.rank = i + 1; return r; }); }

  // Economics (real version, not live): treasury cut first, prizes only from entries.
  var ECON = { prize: 0.70, treasury: 0.25, seed: 0.05, winnersPct: 0.10, tiers: [30, 18, 12, 6, 6, 4, 4, 4, 3, 3], duelRake: 0.10 };
  function payoutTable(W) { if (W <= 0) return []; var w = [];
    for (var i = 0; i < W; i++) w.push(i < ECON.tiers.length ? ECON.tiers[i] : 10 / (W - ECON.tiers.length));
    var tot = w.reduce(function (a, b) { return a + b; }, 0); return w.map(function (x) { return x / tot * 100; }); }
  function economics(entries, fee) { var g = entries * fee, W = entries <= 0 ? 0 : Math.max(1, Math.ceil(entries * ECON.winnersPct - 1e-9)), pz = g * ECON.prize;
    return { gross: g, prize: pz, treasury: g * ECON.treasury, seed: g * ECON.seed, winners: W, payouts: payoutTable(W).map(function (p) { return pz * p / 100; }) }; }

  var api = { TPS: TPS, SEG: SEG, TICKS: TICKS, CFG: CFG, ASSETS: ASSETS, ECON: ECON, utcDay: utcDay, tapeNo: tapeNo, makeTape: makeTape, createRun: createRun,
    simulate: simulate, encode: encode, decode: decode, strip: strip, demoBoard: demoBoard, rank: rank, payoutTable: payoutTable, economics: economics, botChanges: botChanges };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DD = api;
})(this);
