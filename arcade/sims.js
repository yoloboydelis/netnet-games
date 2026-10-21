/* NetNet Arcade · shared deterministic simulations + replay verifier.
 * ONE file used by (a) every cabinet to run the live game, (b) the browser verifier,
 * (c) the Cloudflare Worker in /server. Same seed + same input log => same score, everywhere.
 * Input log format: [[tick, action], ...] ticks strictly non-decreasing, action is game-specific.
 * Depends on DD (dip-dash/engine.js) and PL (portfolio-league/engine.js) for those two cabinets. */
(function (root) {
  'use strict';
  var DD = root.DD, PL = root.PL;
  function hash(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(a) { a = a >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // ---- weekly window: UTC Sunday 00:00 -> next Sunday 00:00
  function weekStart(ms) { var d = new Date(ms == null ? Date.now() : ms); var s = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - d.getUTCDay() * 864e5; return s; }
  function weekId(ms) { var d = new Date(weekStart(ms)); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
  function seedFor(game, wk) { wk = wk || weekId(); if (game === 'dip-dash' || game === 'portfolio-league') return wk; return hash(game + ':' + wk); }

  var G = {};
  // ---------------- SNAKE: 20x20 grid, 9 ticks/s. action 0..3 = up,right,down,left
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  G.snake = { tps: 9, maxTicks: 9 * 600, maxIps: 12, higher: true, unit: 'pts', actions: function (a) { return a === 0 || a === 1 || a === 2 || a === 3; },
    create: function (seed) { var s = { r: rng(seed), sn: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], d: 1, tick: 0, score: 0, done: false }; G.snake.food(s); return s; },
    food: function (s) { do { s.food = { x: Math.floor(s.r() * 20), y: Math.floor(s.r() * 20) }; } while (s.sn.some(function (p) { return p.x === s.food.x && p.y === s.food.y; })); },
    input: function (s, a) { if ((a + 2) % 4 !== s.d) s.nd = a; },
    step: function (s) { if (s.nd != null) { s.d = s.nd; s.nd = null; } s.tick++; var v = DIRS[s.d], h = { x: s.sn[0].x + v[0], y: s.sn[0].y + v[1] };
      if (h.x < 0 || h.y < 0 || h.x >= 20 || h.y >= 20 || s.sn.some(function (p) { return p.x === h.x && p.y === h.y; })) { s.done = true; return; }
      s.sn.unshift(h); if (h.x === s.food.x && h.y === s.food.y) { s.score++; G.snake.food(s); } else s.sn.pop(); },
    score: function (s) { return s.score; } };
  // ---------------- GOLD BAR: 60 ticks/s needle; action 1 = tap. 3 misses = out.
  G['gold-bar'] = { tps: 60, maxTicks: 60 * 600, maxIps: 8, higher: true, unit: 'pts', actions: function (a) { return a === 1; },
    create: function (seed) { var s = { r: rng(seed), tick: 0, score: 0, lives: 3, streak: 0, round: 0, pos: 0, dir: 1, speed: 0.55, done: false, msg: '' }; G['gold-bar'].zone(s); return s; },
    zone: function (s) { var w = Math.max(0.05, 0.22 - s.round * 0.012); s.zone = { c: w / 2 + 0.03 + s.r() * (1 - w - 0.06), w: w }; },
    input: function (s) { s.idle = 0; var d = Math.abs(s.pos - s.zone.c);
      if (d <= s.zone.w / 2) { var p = d < s.zone.w * 0.12 ? 3 : 1; s.score += p; s.streak++; s.msg = p === 3 ? 'PERFECT +3' : '+1'; s.last = 'hit'; }
      else { s.lives--; s.streak = 0; s.msg = 'MISS'; s.last = 'miss'; }
      s.round++; s.speed = 0.55 + s.round * 0.09; G['gold-bar'].zone(s); if (s.lives <= 0) s.done = true; },
    step: function (s) { s.tick++; s.idle = (s.idle || 0) + 1; if (s.idle >= 300) { s.idle = 0; s.pos = -1; G['gold-bar'].input(s); s.msg = 'TOO SLOW'; if (s.done) return; s.pos = 0; s.dir = 1; } s.pos += s.dir * s.speed / 60; if (s.pos > 1) { s.pos = 1; s.dir = -1; } if (s.pos < 0) { s.pos = 0; s.dir = 1; } },
    score: function (s) { return s.score; } };
  // ---------------- RENT RUSH: 10 ticks/s, 45 s. action 0..3 = buy flat/shop/office/tower
  var RR = [{ k: 'flat', n: '🏠 Studio flat', c: 10, r: 2 }, { k: 'shop', n: '🏪 Corner shop', c: 80, r: 14 }, { k: 'office', n: '🏢 Office floor', c: 600, r: 85 }, { k: 'tower', n: '🌆 Tower', c: 4000, r: 450 }];
  G['rent-rush'] = { tps: 10, maxTicks: 450, maxIps: 15, higher: true, unit: '$ rent', P: RR, actions: function (a) { return a >= 0 && a <= 3 && a === (a | 0); },
    create: function () { return { tick: 0, cash: 20, earned: 0, own: [0, 0, 0, 0], done: false }; },
    cost: function (s, i) { return Math.round(RR[i].c * Math.pow(1.13, s.own[i])); },
    rate: function (s) { var r = 0; for (var i = 0; i < 4; i++) r += RR[i].r * s.own[i]; return r; },
    input: function (s, a) { var c = G['rent-rush'].cost(s, a); if (s.cash >= c) { s.cash -= c; s.own[a]++; } },
    step: function (s) { var r = G['rent-rush'].rate(s) / 10; s.cash += r; s.earned += r; s.tick++; if (s.tick >= 450) s.done = true; },
    score: function (s) { return Math.floor(s.earned); } };
  // ---------------- REBALANCE: 10 ticks/s; action = from*10+to (move 5% from asset to asset). Score = seconds + 2s per extra move (lower wins)
  var RB_A = ['🥇 Gold', '📈 Equities', '🏛 Bonds', '🏢 Real estate', '💵 Cash'];
  function rbSplit(s, n) { var u = [], i, left = 20 - n; for (i = 0; i < n; i++) u.push(1); while (left > 0) { u[Math.floor(s.r() * n)]++; left--; } return u.map(function (v) { return v * 5; }); }
  function rbLevel(s) { var n = Math.min(5, 3 + Math.floor(s.lv / 2)); do { s.w = rbSplit(s, n); s.tgt = rbSplit(s, n); } while (s.w.every(function (v, i) { return v === s.tgt[i]; }));
    s.moves = 0; s.minMoves = s.w.reduce(function (a, v, i) { return a + Math.max(0, v - s.tgt[i]); }, 0) / 5; }
  G.rebalance = { tps: 10, maxTicks: 3000, maxIps: 10, higher: false, unit: 's', A: RB_A, actions: function (a) { return a === (a | 0) && a >= 0 && a < 50 && Math.floor(a / 10) !== a % 10; },
    create: function (seed) { var s = { r: rng(seed), tick: 0, lv: 0, extra: 0, done: false }; rbLevel(s); return s; },
    input: function (s, a) { var f = Math.floor(a / 10), t = a % 10; if (f >= s.w.length || t >= s.w.length || s.w[f] <= 0) return; s.w[f] -= 5; s.w[t] += 5; s.moves++;
      if (s.w.every(function (v, k) { return v === s.tgt[k]; })) { s.extra += Math.max(0, s.moves - s.minMoves); s.lv++; if (s.lv >= 5) { s.done = true; s.won = true; } else rbLevel(s); } },
    step: function (s) { s.tick++; if (s.tick >= 3000) s.done = true; },
    score: function (s) { return s.won ? Math.round((s.tick / 10 + s.extra * 2) * 10) / 10 : 9999; } };
  // ---------------- DIP DASH (wraps dip-dash/engine.js). 30 ticks/s, action -1/0/1 = short/flat/long
  if (DD) G['dip-dash'] = { tps: DD.TPS, maxTicks: DD.TICKS, maxIps: 6, higher: true, unit: '%', actions: function (a) { return a === -1 || a === 0 || a === 1; },
    create: function (seed) { var s = DD.createRun(DD.makeTape(seed)); s.want = 0; s.tick = 0; return s; },
    input: function (s, a) { s.want = a; }, step: function (s) { s.step(s.want); s.tick = s.g; }, score: function (s) { return s.result().score; } };
  // ---------------- PORTFOLIO LEAGUE (wraps engine). Not real-time: one action at tick 0 = weights object.
  if (PL) G['portfolio-league'] = { tps: 0, maxTicks: 0, maxIps: 0, higher: true, unit: 'score', noPacing: true,
    actions: function (w) { return w && typeof w === 'object' && PL.validate(w).ok; },
    create: function (seed) { return { seed: seed, tick: 0, done: false }; },
    input: function (s, w) { s.res = PL.evaluate(w, PL.pricePaths(s.seed)); s.done = true; }, step: function (s) { s.done = true; },
    score: function (s) { return s.res ? Math.round(s.res.score * 100) / 100 : -9999; } };

  // ---------------- run a log -> final state (also used by replay viewers with onTick)
  function simulate(game, seed, log, onTick) {
    var g = G[game]; if (!g) throw new Error('unknown game ' + game);
    var s = g.create(seed), i = 0, guard = (g.maxTicks || 1) + 2;
    if (g.noPacing) { if (log[0]) g.input(s, log[0][1]); return s; }
    while (!s.done && s.tick < guard) {
      while (i < log.length && log[i][0] <= s.tick && !s.done) { g.input(s, log[i][1]); i++; }
      if (s.done) break; g.step(s); if (onTick) onTick(s);
      if (s.tick >= g.maxTicks) s.done = true;
    }
    s.unused = log.length - i; return s;
  }
  // ---------------- verifier: re-simulate + anti-bot. run = {game, week, seed, log, wallMs, hidden}
  function verify(run, opts) {
    opts = opts || {}; var reasons = [], g = G[run.game];
    if (!g) return { ok: false, reasons: ['unknown game'] };
    var wk = run.week, now = opts.now || Date.now();
    if (run.seed !== seedFor(run.game, wk)) reasons.push('seed is not the weekly seed');
    if (opts.currentWeekOnly && wk !== weekId(now)) reasons.push('run is not from the current week');
    var log = run.log;
    if (!Array.isArray(log) || log.length > 20000) return { ok: false, reasons: ['bad log'] };
    var prev = -1;
    for (var k = 0; k < log.length; k++) { var e = log[k];
      if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'number' || e[0] !== (e[0] | 0) || e[0] < prev) { reasons.push('malformed/out-of-order input at #' + k); break; }
      if (!g.actions(e[1])) { reasons.push('illegal action at #' + k); break; } prev = e[0]; }
    if (reasons.length) return { ok: false, reasons: reasons };
    var s = simulate(run.game, run.seed, log), score = g.score(s), ticks = s.tick;
    if (!g.noPacing) {
      // inputs-per-second cap (sliding window of tps ticks)
      for (var a = 0, b = 0; b < log.length; b++) { while (log[b][0] - log[a][0] >= g.tps) a++; if (b - a + 1 > g.maxIps) { reasons.push('input rate > ' + g.maxIps + '/s (bot-like)'); break; } }
      // real-time pacing: wall clock must match simulated time (no speed-hack, no pause)
      var simMs = ticks / g.tps * 1000, w = +run.wallMs;
      if (!(w >= simMs * 0.95 - 300)) reasons.push('ran faster than real time (' + Math.round(w) + 'ms for ' + Math.round(simMs) + 'ms of play)');
      if (w > simMs * 1.15 + 2000) reasons.push('paused / stalled (' + Math.round(w) + 'ms for ' + Math.round(simMs) + 'ms of play)');
      if (run.hidden) reasons.push('tab was hidden during play (no pause allowed)');
      if (s.unused > 0) reasons.push(s.unused + ' inputs after game over');
      if (!s.done) reasons.push('run did not finish');
    }
    if (run.claimed != null && Math.abs(run.claimed - score) > 1e-6) reasons.push('claimed ' + run.claimed + ' but replay gives ' + score);
    return { ok: reasons.length === 0, score: score, ticks: ticks, reasons: reasons };
  }
  var api = { hash: hash, rng: rng, weekStart: weekStart, weekId: weekId, seedFor: seedFor, games: G, simulate: simulate, verify: verify, VERSION: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; root.NNS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
