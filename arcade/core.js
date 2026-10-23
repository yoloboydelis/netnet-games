/* NetNet Arcade · account, test credits, runner, verified leaderboards, achievements.
 * Everything is stored locally in this browser for now. TEST CREDITS ONLY, not money. */
(function (W) {
  'use strict';
  var S = W.NNS, LS = W.localStorage, DAY = 864e5;
  var CFG = { start: 10000, fee: 100, treasury: 0.10, payout: [0.5, 0.3, 0.2] };
  var GAMES = {
    'snake': { n: 'SNAKE', no: '02', c: '#39ff14', tag: 'Arcade classic · same food for everyone', path: 'snake/' },
    'gold-bar': { n: 'GOLD BAR', no: '05', c: '#f5c542', tag: 'Tokenized gold · timing', path: 'gold-bar/' },
    'rent-rush': { n: 'RENT RUSH', no: '06', c: '#39ff88', tag: 'Tokenized real estate · build order', path: 'rent-rush/' },
    'rebalance': { n: 'REBALANCE', no: '07', c: '#38f5ff', tag: 'Portfolio rebalancing · speed', path: 'rebalance/' },
    'dip-dash': { n: 'DIP DASH', no: '04', c: '#ff2bd6', tag: 'RWA tape trading · long/short', path: 'dip-dash/' },
    'portfolio-league': { n: 'PORTFOLIO LEAGUE', no: '03', c: '#f5a623', tag: 'Weekly fantasy portfolio', path: 'portfolio-league/' }
  };
  function J(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function P(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var A = {};
  A.CFG = CFG; A.GAMES = GAMES; A.esc = esc;
  A.root = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/arcade\/core\.js.*$/, '') : '../'; })();
  // ---------------- account
  A.acct = function () {
    var a = J('nna_acct', null), now = Date.now();
    if (!a) { a = { handle: 'player' + Math.floor(1000 + Math.random() * 9000), created: now, credits: CFG.start, lastRefill: now, ach: {}, wallet: null }; P('nna_acct', a); }
    if (!a.secret) { var u = new Uint8Array(16); (W.crypto || {}).getRandomValues ? crypto.getRandomValues(u) : u.forEach(function (_, i) { u[i] = Math.random() * 256; }); a.secret = Array.prototype.map.call(u, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); P('nna_acct', a); }
    if (now - a.lastRefill >= DAY) { if (a.credits < CFG.start) a.credits = CFG.start; a.lastRefill = now; P('nna_acct', a); }
    return a;
  };
  A.save = function (a) { P('nna_acct', a); A.bar(); };
  A.setHandle = function (h) { var a = A.acct(); h = String(h || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15); if (h.length < 3) return false; a.handle = h; A.save(a); A.sync(); return true; };
  A.nextRefill = function () { var a = A.acct(); return a.lastRefill + DAY; };
  // ---------------- ledger: entry fee -> treasury cut FIRST, rest to that game's weekly pool (pools funded only by entries)
  A.pools = function () { return J('nna_pools', {}); };
  A.enter = function (game) {
    var a = A.acct(); if (a.credits < CFG.fee) return false;
    a.credits -= CFG.fee; var t = CFG.fee * CFG.treasury, k = game + ':' + S.weekId(), p = A.pools();
    p[k] = p[k] || { entries: 0, pool: 0, treasury: 0 }; p[k].entries++; p[k].treasury += t; p[k].pool += CFG.fee - t; P('nna_pools', p); A.save(a); return true;
  };
  // ---------------- runs
  A.runs = function () { return J('nna_runs', []); };
  A.store = function (r) { var rs = A.runs(); rs.push(r); if (rs.length > 400) rs = rs.slice(-400); P('nna_runs', rs); };
  A.find = function (id) { return A.runs().filter(function (r) { return r.id === id; })[0]; };
  A.submit = function (game, rec) {
    var a = A.acct(), run = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), game: game, week: rec.week || S.weekId(), seed: rec.seed, log: rec.log, wallMs: Math.round(rec.wallMs || 0), hidden: !!rec.hidden, claimed: rec.claimed, ranked: !!rec.ranked, handle: a.handle, at: Date.now() };
    var v = S.verify(run); run.v = v; run.score = v.score; A.store(run); A.award(run); A.bar();
    if (rec.tok) run.srv = Promise.resolve(rec.tok).then(function (t) { return A.srvSubmit(t, run); }).then(function (x) { if (x) { var rs = A.runs(); rs.forEach(function (q) { if (q.id === run.id) { q.srv = { id: x.id, verified: x.verified, rank: x.rank, reasons: x.reasons }; q.ranked = x.ranked; } }); P('nna_runs', rs); } A.sync(); return x; });
    return run;
  };
  A.encode = function (r) { return btoa(unescape(encodeURIComponent(JSON.stringify({ g: r.game, w: r.week, s: r.seed, l: r.log, m: r.wallMs, h: r.handle, c: r.score })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  A.decode = function (x) { var o = JSON.parse(decodeURIComponent(escape(atob(x.replace(/-/g, '+').replace(/_/g, '/'))))); return { game: o.g, week: o.w, seed: o.s, log: o.l, wallMs: o.m, handle: o.h, claimed: o.c }; };
  A.replayURL = function (r) { return A.root + 'replay/?r=' + A.encode(r); };
  // ---------------- weekly leaderboard: verified ranked runs only, best per handle
  A.board = function (game, week) {
    week = week || S.weekId(); var g = S.games[game], best = {};
    A.runs().forEach(function (r) { if (r.game !== game || r.week !== week || !r.ranked || !r.v || !r.v.ok) return; if (!g.higher && r.score >= 9999) return;
      var b = best[r.handle]; if (!b || (g.higher ? r.score > b.score : r.score < b.score)) best[r.handle] = r; });
    return Object.keys(best).map(function (k) { return best[k]; }).sort(function (x, y) { return g.higher ? y.score - x.score : x.score - y.score; });
  };
  A.weekLabel = function (week) { week = week || S.weekId(); var s = S.weekStart(Date.UTC(Math.floor(week / 1e4), Math.floor(week / 100) % 100 - 1, week % 100) + 1000), e = new Date(s + 7 * DAY);
    return 'Week of ' + new Date(s).toISOString().slice(0, 10) + ' (Sun 00:00 UTC → ' + e.toISOString().slice(0, 10) + ')'; };
  A.boardHTML = function (game) {
    var rows = A.board(game), g = S.games[game], p = A.pools()[game + ':' + S.weekId()] || { entries: 0, pool: 0, treasury: 0 }, me = A.acct().handle;
    var h = '<div class="nna-board"><div class="nna-bh"><b>WEEKLY BOARD</b> <span class="nna-mut">' + A.weekLabel() + '</span></div>' +
      '<div class="nna-mut">Pool ' + Math.round(p.pool).toLocaleString() + ' test credits from ' + p.entries + ' entries · treasury cut taken first: ' + Math.round(p.treasury).toLocaleString() + '</div><table class="nn-lb">';
    if (!rows.length) h += '<tr><td class="nna-mut">No verified ranked runs yet this week. Be first.</td></tr>';
    rows.slice(0, 20).forEach(function (r, i) { h += '<tr class="' + (r.handle === me ? 'me' : '') + '"><td>#' + (i + 1) + '</td><td>' + esc(r.handle) + ' <span class="nna-ok" title="Score re-simulated from the input log">✔ Verified</span></td><td style="text-align:right">' + r.score + ' ' + g.unit + '</td><td><a href="' + A.replayURL(r) + '">replay ▶</a></td></tr>'; });
    return h + '</table><div class="nna-mut" style="font-size:11px">Only replay-verified scores are listed. Board is on this device until the score server goes live.</div></div>';
  };
  // ---------------- achievements
  var ACH = [
    ['first', '🎮 First credit', 'Finish any run', function (r) { return true; }],
    ['verified', '✔ Verified', 'Get a replay-verified ranked score', function (r) { return r.ranked && r.v.ok; }],
    ['ten', '🔟 Regular', 'Finish 10 runs', function (r, all) { return all.length >= 10; }],
    ['allsix', '🕹 Full arcade', 'Finish a run in all 6 cabinets', function (r, all) { var s = {}; all.forEach(function (x) { s[x.game] = 1; }); return Object.keys(s).length >= 6; }],
    ['snake20', '🐍 Long boi', 'Snake: 20+ pts', function (r) { return r.game === 'snake' && r.v.ok && r.score >= 20; }],
    ['gold30', '🥇 Goldsmith', 'Gold Bar: 30+ pts', function (r) { return r.game === 'gold-bar' && r.v.ok && r.score >= 30; }],
    ['rent2500', '🌆 Landlord', 'Rent Rush: 2,500+ USDG', function (r) { return r.game === 'rent-rush' && r.v.ok && r.score >= 2500; }],
    ['reb60', '⚖ Quant', 'Rebalance under 60s', function (r) { return r.game === 'rebalance' && r.v.ok && r.score < 60; }],
    ['dip5', '📉 Dip buyer', 'Dip Dash: +5% or better', function (r) { return r.game === 'dip-dash' && r.v.ok && r.score >= 5; }],
    ['pl2', '📊 Allocator', 'Portfolio League score 2+', function (r) { return r.game === 'portfolio-league' && r.v.ok && r.score >= 2; }],
    ['top1', '👑 Week leader', 'Hold #1 on a weekly board', function (r) { var b = A.board(r.game); return b[0] && b[0].id === r.id; }]
  ];
  A.ACH = ACH;
  A.award = function (r) { var a = A.acct(), all = A.runs(), got = [];
    ACH.forEach(function (x) { if (!a.ach[x[0]] && x[3](r, all)) { a.ach[x[0]] = Date.now(); got.push(x); } }); A.save(a);
    got.forEach(function (x) { A.toast('Achievement unlocked: ' + x[1]); }); return got; };
  A.toast = function (t) { var d = document.createElement('div'); d.className = 'nna-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3500); };
  // ---------------- score server (Cloudflare Worker in /server). Credits + boards are authoritative there.
  A.SERVER = J('nna_server', null) || W.NN_SCORE_SERVER || null;
  function post(path, body) { return fetch(A.SERVER + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
  A.online = null;
  A.sync = function () { if (!A.SERVER) return Promise.resolve(null); var a = A.acct();
    return post('/v1/account', { secret: a.secret, handle: a.handle }).then(function (x) { if (x && x.credits != null) { var b = A.acct(); b.credits = x.credits; b.lastRefill = x.nextRefill - DAY; A.online = true; A.save(b); } return x; }).catch(function () { A.online = false; A.bar(); return null; }); };
  A.srvStart = function (game, ranked) { if (!A.SERVER) return Promise.resolve(null); var a = A.acct();
    return post('/v1/start', { game: game, ranked: !!ranked, secret: a.secret, handle: a.handle }).then(function (t) { if (!t || !t.sig) return null; var b = A.acct(); b.credits = t.account.credits; A.save(b); return t; }).catch(function () { return null; }); };
  A.srvSubmit = function (tok, run) { if (!A.SERVER || !tok) return Promise.resolve(null); var a = A.acct();
    return post('/v1/runs', { game: run.game, week: tok.week, seed: tok.seed, t0: tok.t0, sig: tok.sig, ranked: tok.ranked, log: run.log, wallMs: run.wallMs, hidden: run.hidden, secret: a.secret }).catch(function () { return null; }); };
  A.fetchBoard = function (game) { return fetch(A.SERVER + '/v1/board?game=' + game).then(function (r) { if (!r.ok) throw 0; return r.json(); }); };
  A.boardServerHTML = function (game, d) { var g = S.games[game], me = A.acct().handle, p = d.pool || { entries: 0, pool: 0, treasury: 0 };
    var h = '<div class="nna-board"><div class="nna-bh"><b>WEEKLY BOARD <span class="nna-ok">🌐 GLOBAL</span></b> <span class="nna-mut">' + A.weekLabel() + '</span></div>' +
      '<div class="nna-mut">Pool ' + Math.round(p.pool).toLocaleString() + ' test credits from ' + p.entries + ' entries · treasury cut taken first: ' + Math.round(p.treasury).toLocaleString() + '</div><table class="nn-lb">';
    if (!d.rows.length) h += '<tr><td class="nna-mut">No verified ranked runs yet this week. Be first.</td></tr>';
    d.rows.slice(0, 20).forEach(function (r, i) { h += '<tr class="' + (r.handle === me ? 'me' : '') + '"><td>#' + (i + 1) + '</td><td>' + esc(r.handle) + ' <span class="nna-ok" title="Re-simulated by the score server">✔ Verified</span></td><td style="text-align:right">' + r.score + ' ' + g.unit + '</td><td><a href="' + A.root + 'replay/?id=' + encodeURIComponent(r.id) + '">replay ▶</a></td></tr>'; });
    return h + '</table><div class="nna-mut" style="font-size:11px">Shared board from the NetNet Arcade score server. Every score was re-simulated server-side.</div></div>'; };
  // render the global board into el, falling back to this device's board
  A.renderBoard = function (game, el) { if (!el) return; el.innerHTML = A.boardHTML(game); if (!A.SERVER) return;
    A.fetchBoard(game).then(function (d) { el.innerHTML = A.boardServerHTML(game, d); }).catch(function () { el.insertAdjacentHTML('afterbegin', '<div class="nna-mut">⚠ Score server unreachable, showing this device only.</div>'); }); };
  // ---------------- real-time runner (fixed-step, same stepping as the verifier)
  A.runner = function (game, o) {
    var g = S.games[game], R = { game: game, state: null, log: [], on: false };
    R.start = function (ranked) {
      R.week = S.weekId(); R.seed = S.seedFor(game, R.week); R.state = g.create(R.seed); R.log = []; R.hidden = false;
      R.ranked = false; var want = ranked !== false; R.tok = A.srvStart(game, want).then(function (t) { if (t) R.ranked = t.ranked; else R.ranked = want && A.enter(game); return t; }); R.t0 = performance.now(); R.on = true; R.raf = requestAnimationFrame(loop); A.bar(); return R;
    };
    R.input = function (a) { if (!R.on || R.state.done) return; R.log.push([R.state.tick, a]); g.input(R.state, a); if (o.onInput) o.onInput(R.state, a); if (R.state.done) end(); };
    function loop(t) { if (!R.on) return; var want = Math.floor((performance.now() - R.t0) / 1000 * g.tps);
      while (R.state.tick < want && !R.state.done) { g.step(R.state); if (R.state.tick >= g.maxTicks) R.state.done = true; }
      if (o.onFrame) o.onFrame(R.state); if (R.state.done) return end(); R.raf = requestAnimationFrame(loop); }
    function end() { if (!R.on) return; R.on = false; cancelAnimationFrame(R.raf); var wall = performance.now() - R.t0;
      var run = A.submit(game, { week: R.week, seed: R.seed, log: R.log, wallMs: wall, hidden: R.hidden, claimed: g.score(R.state), ranked: R.ranked, tok: R.tok });
      if (o.onFrame) o.onFrame(R.state); if (o.onEnd) o.onEnd(run, R.state); A.result(run); }
    document.addEventListener('visibilitychange', function () { if (document.hidden && R.on) { R.hidden = true; } });
    return R;
  };
  // ---------------- result modal
  A.result = function (run) {
    var g = S.games[run.game], G = GAMES[run.game], m = document.getElementById('nna-modal'), rows = A.board(run.game), rk = rows.indexOf(rows.filter(function (r) { return r.id === run.id; })[0]) + 1;
    if (!m) { m = document.createElement('div'); m.id = 'nna-modal'; m.className = 'nn-modal'; document.body.appendChild(m); }
    var dnf = !g.higher && run.score >= 9999;
    var status = run.v.ok ? (run.ranked ? '<span class="nna-ok">✔ VERIFIED</span> replay re-simulated: ' + run.score + ' ' + g.unit + (rk ? ' · weekly rank #' + rk : '') : '<span class="nna-ok">✔ VERIFIED</span> practice run (unranked, no credits left for an entry)')
      : '<span class="nna-bad">✘ NOT VERIFIED</span> ' + esc(run.v.reasons.join('; '));
    m.innerHTML = '<div class="box"><div class="nn-sub">' + G.n + '</div><div class="nn-big">' + (dnf ? 'DNF' : run.score) + '</div><div class="nn-sub">' + g.unit + ' · ' + run.log.length + ' inputs</div><p style="font-size:13px">' + status + '</p>' +
      (run.srv ? '<p style="font-size:13px" id="nna-srv">🌐 Checking with the score server…</p>' : '') + '<div class="nn-row"><button class="nn-btn" id="nna-again">Play again</button><a class="nn-btn ghost" href="' + A.replayURL(run) + '">Watch replay ▶</a><button class="nn-btn ghost" id="nna-copy">Copy replay link</button></div><div id="nna-mboard">' + A.boardHTML(run.game) + '</div></div>';
    m.classList.add('on');
    if (run.srv) run.srv.then(function (x) { var e = document.getElementById('nna-srv'); if (!e) return;
      e.innerHTML = !x ? '⚠ Score server unreachable: kept on this device only.' : x.verified ? (x.ranked ? '🌐 <span class="nna-ok">✔ SERVER VERIFIED</span> ' + x.score + ' ' + g.unit + (x.rank ? ' · global weekly rank #' + x.rank : '') : '🌐 <span class="nna-ok">✔ SERVER VERIFIED</span> practice run (unranked)') : '🌐 <span class="nna-bad">✘ SERVER REJECTED</span> ' + esc((x.reasons || []).join('; '));
      A.renderBoard(run.game, document.getElementById('nna-mboard')); });
    document.getElementById('nna-again').onclick = function () { m.classList.remove('on'); if (A.onAgain) A.onAgain(); };
    document.getElementById('nna-copy').onclick = function () { var u = new URL(A.replayURL(run), location.href).toString(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { A.toast('Replay link copied'); }, function () { prompt('Replay link', u); }); };
  };
  // ---------------- shared top bar, 18+ gate, wallet (beta)
  A.bar = function () {
    var b = document.getElementById('nna-bar'); if (!b) return; var a = A.acct();
    b.innerHTML = '<a class="nna-logo" href="' + A.root + '">NETNET<b>ARCADE</b></a><span class="nna-sp"></span>' +
      '<a href="' + A.root + 'profile/" title="Your profile">👤 ' + esc(a.handle) + '</a><a href="' + A.root + 'profile/" title="Test credits, refill to ' + CFG.start.toLocaleString() + ' every 24h. Not money.">🪙 ' + Math.floor(a.credits).toLocaleString() + ' <small>TEST</small></a>' +
      (A.online === true ? '<span title="Score server online" style="color:#39ff88">🌐</span>' : A.online === false ? '<span title="Score server offline, local mode" style="color:#ff5f6d">⚠</span>' : '') + '<a href="' + A.root + 'apps/">🧩 Apps</a><a href="' + A.root + 'boards/">🏆 Boards</a><a href="' + A.root + 'stats/">📊 Stats</a>';
  };
  A.gate = function () {
    if (J('nna_gate', 0)) return; var m = document.createElement('div'); m.className = 'nn-modal on'; m.id = 'nna-gate';
    m.innerHTML = '<div class="box" style="text-align:left"><h3 style="margin-top:0">Welcome to NetNet Arcade</h3><p class="nn-sub" style="font-size:14px">Prototype for the NetNet community &amp; devs. Skill-only games: every player gets the same weekly level, no chance, no house edge. You play with <b>free test credits</b>, not money.</p>' +
      '<label style="display:block;margin:8px 0"><input type="checkbox" id="nna-18"> I am 18 or older.</label><label style="display:block;margin:8px 0"><input type="checkbox" id="nna-geo"> I am not in a country where skill-prize competitions are prohibited or that is under sanctions (OFAC/EU/UN lists).</label>' +
      '<button class="nn-btn full" id="nna-in" disabled>Enter the arcade</button></div>';
    document.body.appendChild(m); var c1 = m.querySelector('#nna-18'), c2 = m.querySelector('#nna-geo'), go = m.querySelector('#nna-in');
    c1.onchange = c2.onchange = function () { go.disabled = !(c1.checked && c2.checked); };
    go.onclick = function () { P('nna_gate', Date.now()); m.remove(); };
  };
  A.wallet = async function () { var a = A.acct();
    if (!W.ethereum) { A.toast('No wallet found in this browser (beta).'); return null; }
    try { var acc = await W.ethereum.request({ method: 'eth_requestAccounts' }); a.wallet = acc[0]; A.save(a); A.toast('Wallet linked (beta, read-only): ' + a.wallet.slice(0, 6) + '…'); return a.wallet; } catch (e) { A.toast('Wallet connect cancelled'); return null; } };
  A.foot = function () { var f = document.createElement('footer'); f.className = 'nn-foot';
    f.innerHTML = 'NetNet Arcade prototype for the community &amp; devs · <b>Test credits only, not money, no cash value</b> · Skill-only, same weekly level for everyone · 18+ · Not available in prohibited or sanctioned regions · <a href="' + A.root + '">All cabinets</a>'; document.body.appendChild(f); };
  A.boot = function () { A.acct(); var b = document.createElement('nav'); b.id = 'nna-bar'; document.body.insertBefore(b, document.body.firstChild); A.bar(); A.gate(); A.sync(); };
  W.NNA = A;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.boot); else A.boot();
})(window);
