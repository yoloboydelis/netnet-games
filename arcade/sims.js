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

  // ================= AIDUNLAP ORIGINALS (ranked). All original NetNet code. =================
  // ---------------- DUNLAP DASH: runner, 60 ticks/s, action 1 = jump (double jump). Hit a DUMP crate = out. 5 min cap.
  G['dunlap-dash'] = { tps: 60, maxTicks: 60 * 300, maxIps: 8, higher: true, unit: 'pts', GY: 300, actions: function (a) { return a === 1; },
    create: function (seed) { return { r: rng(seed), tick: 0, x: 0, vy: 0, y: 300, jumps: 0, score: 0, spd: 5, objs: [], next: 60, done: false, got: 0 }; },
    spawn: function (s) { var r = s.r(), k = r < 0.42 ? 'dump' : r < 0.75 ? 'gold' : r < 0.93 ? 'tbill' : 'net', air = k !== 'dump' && s.r() < 0.5;
      s.objs.push({ k: k, x: 670, y: k === 'dump' ? 282 : (air ? 180 - s.r() * 60 : 270), r: k === 'dump' ? 18 : 14 }); s.next = Math.max(28, 70 - s.spd * 3) + s.r() * 50; },
    input: function (s) { if (s.jumps < 2) { s.vy = s.jumps ? -10 : -12.5; s.jumps++; } },
    step: function (s) { s.tick++; s.spd = 5 + s.tick / 600; s.x += s.spd; s.vy += 0.6; s.y += s.vy; if (s.y >= 300) { s.y = 300; s.vy = 0; s.jumps = 0; }
      if (--s.next <= 0) G['dunlap-dash'].spawn(s);
      for (var i = 0; i < s.objs.length; i++) { var o = s.objs[i]; o.x -= s.spd; var dx = o.x - 120, dy = o.y - (s.y - 45);
        if (!o.hit && Math.abs(dx) < o.r + 14 && Math.abs(dy) < o.r + 40) { o.hit = 1; if (o.k === 'dump') { s.done = true; s.dumped = true; } else { s.score += o.k === 'gold' ? 10 : o.k === 'tbill' ? 25 : 50; s.got++; } } }
      s.objs = s.objs.filter(function (o) { return o.x > -40 && !(o.hit && o.k !== 'dump'); }); if (s.tick % 30 === 0) s.score++; },
    score: function (s) { return s.score; } };
  // ---------------- MERGE MOGUL: 4x4 merge, 10 ticks/s, 3-minute round. action 0..3 = up,right,down,left. Tile spawns from weekly seed.
  G['merge-mogul'] = { tps: 10, maxTicks: 10 * 180, maxIps: 8, higher: true, unit: 'pts', actions: function (a) { return a === 0 || a === 1 || a === 2 || a === 3; },
    create: function (seed) { var s = { r: rng(seed), tick: 0, B: [], score: 0, moves: 0, done: false }; for (var y = 0; y < 4; y++) s.B.push([-1, -1, -1, -1]); G['merge-mogul'].add(s); G['merge-mogul'].add(s); return s; },
    add: function (s) { var e = [], y, x; for (y = 0; y < 4; y++) for (x = 0; x < 4; x++) if (s.B[y][x] < 0) e.push([x, y]); if (!e.length) return; var p = e[Math.floor(s.r() * e.length)]; s.B[p[1]][p[0]] = s.r() < 0.9 ? 0 : 1; },
    can: function (s) { for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) { var v = s.B[y][x]; if (v < 0) return true; if (x < 3 && s.B[y][x + 1] === v) return true; if (y < 3 && s.B[y + 1][x] === v) return true; } return false; },
    input: function (s, d) { var B = s.B, ch = false, N = 4;
      for (var i = 0; i < N; i++) { var line = [], j; for (j = 0; j < N; j++) line.push(d === 3 ? B[i][j] : d === 1 ? B[i][N - 1 - j] : d === 0 ? B[j][i] : B[N - 1 - j][i]);
        var a = line.filter(function (v) { return v >= 0; }), o = []; for (var k = 0; k < a.length; k++) { if (a[k] === a[k + 1]) { o.push(a[k] + 1); s.score += Math.pow(2, a[k] + 2); k++; } else o.push(a[k]); } while (o.length < N) o.push(-1);
        for (j = 0; j < N; j++) { if (o[j] !== line[j]) ch = true; if (d === 3) B[i][j] = o[j]; else if (d === 1) B[i][N - 1 - j] = o[j]; else if (d === 0) B[j][i] = o[j]; else B[N - 1 - j][i] = o[j]; } }
      if (ch) { s.moves++; G['merge-mogul'].add(s); if (!G['merge-mogul'].can(s)) s.done = true; } },
    step: function (s) { s.tick++; },
    score: function (s) { return s.score; } };
  // ---------------- BEAR SIEGE: horde survival, 30 ticks/s, 90 s. action 0..7 = 8-way move (0=up, clockwise), 8 = stop. Auto-fire at nearest bear.
  var BS_D = [[0, -1], [0.7071, -0.7071], [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, 0]];
  G['bear-siege'] = { tps: 30, maxTicks: 30 * 90, maxIps: 12, higher: true, unit: 'pts', W: 640, H: 360, actions: function (a) { return a === (a | 0) && a >= 0 && a <= 8; },
    create: function (seed) { return { r: rng(seed), tick: 0, px: 320, py: 180, d: 8, hp: 3, inv: 0, en: [], sh: [], kills: 0, lvl: 0, cd: 0, next: 30, done: false, fx: [] }; },
    input: function (s, a) { s.d = a; },
    stats: function (s) { var l = s.lvl; return { rate: Math.max(8, 20 - Math.floor((l + 2) / 3) * 3), multi: 1 + Math.floor((l + 1) / 3), dmg: 1 + Math.floor(l / 3) }; },
    step: function (s) { var g = G['bear-siege'], i, j, e, b; s.tick++; var v = BS_D[s.d]; s.px = Math.max(16, Math.min(624, s.px + v[0] * 3.2)); s.py = Math.max(24, Math.min(344, s.py + v[1] * 3.2));
      // spawn: pace rises over the 90 s
      if (--s.next <= 0 && s.en.length < 120) { var side = Math.floor(s.r() * 4), t = s.r(), big = s.r() < Math.min(0.35, s.tick / 6000);
        s.en.push({ x: side === 0 ? t * 640 : side === 1 ? 660 : side === 2 ? t * 640 : -20, y: side === 0 ? -20 : side === 1 ? t * 360 : side === 2 ? 380 : t * 360, hp: big ? 5 + Math.floor(s.tick / 900) : 1 + Math.floor(s.tick / 1350), big: big, sp: (big ? 1.1 : 1.6) + s.tick / 1800 });
        s.next = Math.max(3, 20 - Math.floor(s.tick / 110)); }
      for (i = 0; i < s.en.length; i++) { e = s.en[i]; var dx = s.px - e.x, dy = s.py - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1; e.x += dx / d * e.sp; e.y += dy / d * e.sp;
        if (d < (e.big ? 26 : 18) && s.inv <= 0) { s.hp--; s.inv = 45; e.hp = 0; if (s.hp <= 0) { s.done = true; return; } } }
      if (s.inv > 0) s.inv--;
      // auto-fire
      var st = g.stats(s); if (--s.cd <= 0 && s.en.length) { s.cd = st.rate; var tg = s.en.slice().map(function (q, k) { var ax = q.x - s.px, ay = q.y - s.py; return { k: k, d: ax * ax + ay * ay }; }).sort(function (p, q) { return p.d - q.d || p.k - q.k; });
        for (j = 0; j < st.multi && j < tg.length; j++) { e = s.en[tg[j].k]; var ex = e.x - s.px, ey = e.y - s.py, el = Math.sqrt(ex * ex + ey * ey) || 1; s.sh.push({ x: s.px, y: s.py, vx: ex / el * 9, vy: ey / el * 9, life: 26, dmg: st.dmg }); } }
      for (i = 0; i < s.sh.length; i++) { b = s.sh[i]; b.x += b.vx; b.y += b.vy; b.life--;
        for (j = 0; j < s.en.length; j++) { e = s.en[j]; if (e.hp > 0 && Math.abs(e.x - b.x) < (e.big ? 20 : 13) && Math.abs(e.y - b.y) < (e.big ? 24 : 16)) { e.hp -= b.dmg; b.life = 0;
          if (e.hp <= 0) { s.kills++; if (s.kills % 15 === 0) s.lvl++; } break; } } }
      s.sh = s.sh.filter(function (q) { return q.life > 0; }); s.en = s.en.filter(function (q) { return q.hp > 0; });
      if (s.tick >= 30 * 90) { s.done = true; s.survived = true; } },
    score: function (s) { return s.kills * 10 + Math.floor(s.tick / 30) * 2 + (s.survived ? 500 + s.hp * 100 : 0); } };
  // ---------------- DEEP VAULT: claw/fishing, 30 ticks/s, 60 s. action 1 = drop the line. Heavy treasure reels slower.
  var DV_T = { gold: [100, 2.4, 16], tbill: [40, 1.2, 12], estate: [250, 4, 24], stock: [60, 1.5, 13], net: [150, 1, 9], dump: [5, 5, 18] };
  G['deep-vault'] = { tps: 30, maxTicks: 30 * 60, maxIps: 4, higher: true, unit: 'pts', T: DV_T, OX: 320, OY: 70, actions: function (a) { return a === 1; },
    create: function (seed) { var s = { r: rng(seed), tick: 0, ang: 0, dir: 1, mode: 0, len: 30, hold: null, score: 0, items: [], waves: 0, done: false, got: [] }; G['deep-vault'].wave(s); return s; },
    wave: function (s) { s.waves++; var dmp = 0; s.items = s.items.filter(function (o) { return o.k !== 'dump' || ++dmp <= 3; }); var ks = ['gold', 'gold', 'tbill', 'tbill', 'tbill', 'estate', 'stock', 'stock', 'net', 'dump', 'dump', 'dump'];
      for (var i = 0; i < 13; i++) { var k = ks[Math.floor(s.r() * ks.length)], t = DV_T[k], tries = 0, x, y, ok;
        do { x = 30 + s.r() * 580; y = 140 + s.r() * 200 + (k === 'estate' || k === 'net' ? 10 : 0); y = Math.min(y, 345 - t[2]); ok = s.items.every(function (o) { var a = o.x - x, b = o.y - y; return a * a + b * b > Math.pow(o.r + t[2] + 6, 2); }); } while (!ok && ++tries < 20);
        if (ok) s.items.push({ k: k, x: x, y: y, r: t[2], v: t[0], w: t[1] }); } },
    tip: function (s) { var dx = s.ang * 0.85, l = Math.sqrt(dx * dx + 1); return { x: 320 + dx / l * s.len, y: 70 + 1 / l * s.len }; },
    input: function (s) { if (s.mode === 0) s.mode = 1; },
    step: function (s) { var g = G['deep-vault']; s.tick++;
      if (s.mode === 0) { s.ang += s.dir * 0.03; if (s.ang > 1) { s.ang = 1; s.dir = -1; } if (s.ang < -1) { s.ang = -1; s.dir = 1; } }
      else if (s.mode === 1) { s.len += 8; var p = g.tip(s);
        for (var i = 0; i < s.items.length; i++) { var o = s.items[i], a = o.x - p.x, b = o.y - p.y; if (a * a + b * b < (o.r + 6) * (o.r + 6)) { s.hold = o; s.items.splice(i, 1); s.mode = 2; break; } }
        if (s.mode === 1 && (p.x < 0 || p.x > 640 || p.y > 360)) s.mode = 2; }
      else { s.len -= s.hold ? 9 / s.hold.w : 12; if (s.len <= 30) { s.len = 30; if (s.hold) { s.score += s.hold.v; s.got.push(s.hold.k); s.last = s.hold; } s.hold = null; s.mode = 0; if (s.items.filter(function (o) { return o.k !== 'dump'; }).length < 3) g.wave(s); } }
      if (s.tick >= 30 * 60) s.done = true; },
    score: function (s) { return s.score; } };
  // ---------------- PENTHOUSE PILOT: flyer, 60 ticks/s. action 1 = jetpack on, 0 = off. Fly through tower gaps, grab tokens. 5 min cap.
  G['penthouse-pilot'] = { tps: 60, maxTicks: 60 * 300, maxIps: 10, higher: true, unit: 'pts', actions: function (a) { return a === 0 || a === 1; },
    create: function (seed) { var s = { r: rng(seed), tick: 0, y: 180, vy: 0, th: 0, dist: 0, gates: 0, tokens: 0, cols: [], nextX: 520, done: false }; return s; },
    input: function (s, a) { s.th = a; },
    step: function (s) { s.tick++; var sp = 3.4 + Math.min(3, s.tick / 1800); s.dist += sp; s.vy += s.th ? -0.42 : 0.32; s.vy = Math.max(-6.5, Math.min(7, s.vy)); s.y += s.vy;
      if (s.y < 14 || s.y > 346) { s.done = true; return; }
      s.nextX -= sp; if (s.nextX <= 680) { var gap = Math.max(96, 150 - s.gates * 1.6), c = 70 + gap / 2 + s.r() * (290 - gap); var tk = s.r(); s.cols.push({ x: s.nextX, c: c, gap: gap, w: 58, tok: tk < 0.55 ? (tk < 0.12 ? 'net' : tk < 0.32 ? 'gold' : 'tbill') : null, ty: c + (s.r() - 0.5) * gap * 0.5 }); s.nextX += 230 - Math.min(40, s.gates); }
      for (var i = 0; i < s.cols.length; i++) { var o = s.cols[i]; o.x -= sp;
        if (o.x - 16 < 150 && o.x + o.w + 16 > 150 && (s.y - 14 < o.c - o.gap / 2 || s.y + 14 > o.c + o.gap / 2)) { s.done = true; s.crash = true; return; }
        if (!o.passed && o.x + o.w < 150) { o.passed = 1; s.gates++; }
        if (o.tok && !o.took && Math.abs(o.x + o.w / 2 - 150) < 24 && Math.abs(o.ty - s.y) < 26) { o.took = 1; s.tokens += o.tok === 'net' ? 5 : o.tok === 'gold' ? 3 : 2; } }
      s.cols = s.cols.filter(function (o) { return o.x + o.w > -20; }); },
    score: function (s) { return s.gates * 10 + s.tokens * 10; } };

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
