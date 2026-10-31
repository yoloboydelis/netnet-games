// NetNet Arcade score server (Cloudflare Worker).
// Re-simulates every submitted run with the exact code the cabinets run (sims.bundle.js),
// keeps a server-side TEST-credit ledger, and applies basic per-IP rate limits.
import NNS from './sims.bundle.js';
import DGAMES from './discover-games.js';

const ALLOWED = ['https://yoloboydelis.github.io', 'http://localhost:8765', 'http://127.0.0.1:8765'];
const CFG = { start: 10000, fee: 100, treasury: 0.10, day: 864e5 };
const enc = new TextEncoder();
function cors(req) { const o = req.headers.get('origin'); return { 'access-control-allow-origin': ALLOWED.includes(o) ? o : ALLOWED[0], 'vary': 'origin', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' }; }
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }
const cleanHandle = h => String(h || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15) || 'anon';
const getJ = async (env, k, d) => { const v = await env.RUNS.get(k); return v ? JSON.parse(v) : d; };
const putJ = (env, k, v, ttl) => env.RUNS.put(k, JSON.stringify(v), ttl ? { expirationTtl: ttl } : undefined);
const TTL = 60 * 60 * 24 * 120;

// basic per-IP limits via Cloudflare's Rate Limiting binding (no KV writes, free). Write endpoints 30/min, reads 240/min.
async function limited(env, ip, bucket) {
  const rl = bucket === 'read' ? env.RL_READ : env.RL_WRITE; if (!rl) return false;
  const { success } = await rl.limit({ key: bucket + ':' + ip }); return !success;
}
// ---- ledger: account = sha(client secret). Credits are TEST credits only.
async function account(env, secret, handle) {
  if (!secret || String(secret).length < 16) return null;
  const id = await sha('acct:' + secret), k = 'acct:' + id, now = Date.now();
  let a = await getJ(env, k, null), dirty = false;
  if (!a) { a = { id, handle: cleanHandle(handle), credits: CFG.start, lastRefill: now, created: now, entries: 0 }; dirty = true; }
  if (now - a.lastRefill >= CFG.day) { if (a.credits < CFG.start) a.credits = CFG.start; a.lastRefill = now; dirty = true; }
  if (handle && cleanHandle(handle) !== a.handle) { a.handle = cleanHandle(handle); dirty = true; }
  if (dirty) await putJ(env, k, a); // only write when something changed (free-tier KV write budget)
  return a;
}
const pub = a => ({ handle: a.handle, credits: a.credits, nextRefill: a.lastRefill + CFG.day, entries: a.entries });

export default {
  async fetch(req, env) {
    const C = cors(req), json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...C } });
    const url = new URL(req.url), p = url.pathname, ip = req.headers.get('cf-connecting-ip') || 'local';
    if (req.method === 'OPTIONS') return new Response(null, { headers: C });
    try {
      const bucket = req.method === 'POST' ? 'write' : 'read';
      if (await limited(env, ip, bucket)) return json({ error: 'rate limited, slow down' }, 429);

      if (p === '/v1/account' && req.method === 'POST') {
        const b = await req.json(), a = await account(env, b.secret, b.handle);
        return a ? json(pub(a)) : json({ error: 'bad account secret' }, 400);
      }
      // 1) start a run: server stamps start time; ranked runs pay the entry here (treasury cut FIRST, rest to the weekly pool)
      if (p === '/v1/start' && req.method === 'POST') {
        const b = await req.json(); if (!NNS.games[b.game]) return json({ error: 'unknown game' }, 400);
        const a = await account(env, b.secret, b.handle); if (!a) return json({ error: 'bad account secret' }, 400);
        const week = NNS.weekId(), seed = NNS.seedFor(b.game, week), t0 = Date.now();
        let ranked = false;
        if (b.ranked && a.credits >= CFG.fee) {
          a.credits -= CFG.fee; a.entries++; await putJ(env, 'acct:' + a.id, a);
          const pk = `pool:${b.game}:${week}`, pool = await getJ(env, pk, { entries: 0, pool: 0, treasury: 0 });
          pool.entries++; pool.treasury += CFG.fee * CFG.treasury; pool.pool += CFG.fee * (1 - CFG.treasury); await putJ(env, pk, pool, TTL);
          ranked = true;
        }
        const msg = `${b.game}|${week}|${seed}|${t0}|${a.id}|${ranked ? 1 : 0}`;
        return json({ game: b.game, week, seed, t0, ranked, sig: await hmac(env.SIGNING_KEY, msg), account: pub(a) });
      }
      // 2) submit: re-simulate, anti-bot, server-clock pacing, store; board only for ranked + verified
      if (p === '/v1/runs' && req.method === 'POST') {
        const raw = await req.text(); if (raw.length > 400000) return json({ error: 'too large' }, 413);
        const b = JSON.parse(raw), g = NNS.games[b.game]; if (!g) return json({ error: 'unknown game' }, 400);
        const a = await account(env, b.secret); if (!a) return json({ error: 'bad account secret' }, 400);
        const reasons = [], tokOk = !!b.sig && b.sig === await hmac(env.SIGNING_KEY, `${b.game}|${b.week}|${b.seed}|${b.t0}|${a.id}|${b.ranked ? 1 : 0}`);
        if (!tokOk) reasons.push('missing/invalid start token');
        const used = tokOk && await env.RUNS.get('used:' + b.sig); if (used) reasons.push('start token already used');
        if (tokOk && !g.noPacing) {
          const serverMs = Date.now() - b.t0;
          if (serverMs + 1500 < b.wallMs * 0.95) reasons.push('client clock ran ahead of server clock');
          if (b.wallMs > serverMs + 1500) reasons.push('claimed more play time than the server saw');
          if (serverMs + 1500 < b.wallMs) {} // covered above
        }
        const v = NNS.verify({ game: b.game, week: b.week, seed: b.seed, log: b.log, wallMs: b.wallMs, hidden: b.hidden, claimed: null }, { currentWeekOnly: true });
        const all = reasons.concat(v.reasons), verified = all.length === 0;
        if (tokOk) await env.RUNS.put('used:' + b.sig, '1', { expirationTtl: 60 * 60 * 24 * 8 });
        const id = crypto.randomUUID(), handle = a.handle, ranked = tokOk && !!b.ranked;
        await putJ(env, 'run:' + id, { id, game: b.game, week: b.week, seed: b.seed, log: b.log, wallMs: b.wallMs, handle, score: v.score, verified, ranked, reasons: all, at: Date.now() }, TTL);
        const sk = `stats:${b.week}`, st = await getJ(env, sk, {}); st[b.game] = st[b.game] || { runs: 0, verified: 0, rejected: 0 };
        st[b.game].runs++; st[b.game][verified ? 'verified' : 'rejected']++; await putJ(env, sk, st, TTL);
        let rank = null;
        if (verified && ranked && !(g.higher === false && v.score >= 9999)) {
          const bk = `board:${b.game}:${b.week}`, board = await getJ(env, bk, []);
          const i = board.findIndex(r => r.acct === a.id), better = (x, y) => g.higher ? x > y : x < y;
          if (i < 0) board.push({ acct: a.id, handle, score: v.score, id, at: Date.now() }); else if (better(v.score, board[i].score)) board[i] = { acct: a.id, handle, score: v.score, id, at: Date.now() };
          board.sort((x, y) => (g.higher ? y.score - x.score : x.score - y.score) || x.at - y.at);
          await putJ(env, bk, board.slice(0, 500), TTL); rank = board.findIndex(r => r.acct === a.id) + 1;
        }
        return json({ id, verified, ranked, score: v.score, rank, reasons: all });
      }
      if (p === '/v1/board' && req.method === 'GET') {
        const game = url.searchParams.get('game'), week = +url.searchParams.get('week') || NNS.weekId();
        if (!NNS.games[game]) return json({ error: 'unknown game' }, 400);
        const rows = (await getJ(env, `board:${game}:${week}`, [])).slice(0, 100).map(({ acct, ...r }) => r);
        return json({ game, week, unit: NNS.games[game].unit, rows, pool: await getJ(env, `pool:${game}:${week}`, { entries: 0, pool: 0, treasury: 0 }) });
      }
      if (p.startsWith('/v1/run/')) { const r = await getJ(env, 'run:' + p.slice(8).replace(/[^a-f0-9-]/g, ''), null); return r ? json(r) : json({ error: 'not found' }, 404); }
      if (p === '/v1/stats') {
        const week = +url.searchParams.get('week') || NNS.weekId(), st = await getJ(env, `stats:${week}`, {}), out = {};
        for (const game of Object.keys(NNS.games)) out[game] = Object.assign({ runs: 0, verified: 0, rejected: 0 }, st[game], { pool: await getJ(env, `pool:${game}:${week}`, { entries: 0, pool: 0, treasury: 0 }) });
        return json({ week, games: out });
      }
      // Voices: posts, votes, bounties live in one SQLite Durable Object (no KV writes, strongly consistent)
      if (p.startsWith('/v1/voices/') || p.startsWith('/v1/discover/')) {
        let body = null, acct = null;
        if (req.method === 'POST') { body = await req.json(); acct = await account(env, body.secret); if (!acct) return json({ error: 'bad account secret' }, 400); }
        const stub = env.VOICES.get(env.VOICES.idFromName('voices-v1'));
        if (body && p === '/v1/voices/posts') body.oembed = await oembed(body.url);
        if (body && p.startsWith('/v1/discover/claim/')) body.code = await claimCode(env, acct.id, String(body.game || ''));
        if (body && p === '/v1/discover/claim/verify') { body.proof = await claimProof(body); if (body.proof.ok) body.proof.text = String(body.proof.text).includes(body.code) ? body.code : String(body.proof.text).slice(0, 300); }
        if (p === '/v1/discover/takedown' && req.method === 'POST' && !acct) return json({ error: 'need account' }, 400);
        const r = await stub.fetch('https://do' + p + url.search, { method: req.method, body: body ? JSON.stringify({ ...body, secret: undefined, acct: acct && { id: acct.id, handle: acct.handle } }) : undefined });
        return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json', ...C } });
      }
      if (p === '/' || p === '/v1/health') return json({ ok: true, service: 'netnet-arcade-verifier', version: NNS.VERSION, week: NNS.weekId(), credits: 'TEST credits only' });
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: 'bad request', detail: String(e && e.message || e) }, 400); }
  }
};

// ---------------- Voices ----------------
const X_RE = /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/;
async function oembed(u) { // public X oEmbed: proves the post exists + gives author/text. No metrics (those are EXAMPLE values).
  const m = X_RE.exec(String(u || '')); if (!m) return null;
  try { const r = await fetch('https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=' + encodeURIComponent('https://x.com/' + m[1] + '/status/' + m[2]), { cf: { cacheTtl: 3600 } });
    if (!r.ok) return { ok: false, status: r.status };
    const j = await r.json(), text = String(j.html || '').replace(/<a[^>]*>(.*?)<\/a>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&mdash;.*$/s, '').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
    return { ok: true, author: j.author_name || m[1], authorHandle: String(j.author_url || '').split('/').pop().toLowerCase(), text };
  } catch (e) { return { ok: false, status: 0 }; } }
const weekOf = ms => NNS.weekId(ms);
// ---------------- Discover: claim proof (server-side fetches only; nothing of the creator's code is copied or hosted)
const claimCode = async (env, acctId, slug) => 'NETNET-CLAIM-' + (await hmac(env.SIGNING_KEY, 'claim|' + acctId + '|' + slug)).slice(0, 8).toUpperCase();
async function claimProof(b) {
  const g = DGAMES.find(x => x.slug === b.game); if (!g) return { ok: false, why: 'unknown game' };
  if (b.method === 'x') { const o = await oembed(b.url); if (!o || !o.ok) return { ok: false, why: 'could not read that X post (public posts only)' };
    return { ok: true, handle: o.authorHandle, text: o.text, expect: g.handle.toLowerCase(), kind: 'x' }; }
  if (b.method === 'site') { // the code must appear on the game's own page (or /netnet-claim.txt on the same host)
    const base = new URL(g.play), urls = [g.play, base.origin + '/netnet-claim.txt'];
    for (const u of urls) { try { const r = await fetch(u, { headers: { 'user-agent': 'NetNetDiscoverClaim/1.0' }, redirect: 'follow' }); if (r.ok) { const t = (await r.text()).slice(0, 2000000); if (t) return { ok: true, text: t.slice(0, 2000000), kind: 'site', where: u, scanned: true }; } } catch (e) {} }
    return { ok: false, why: 'could not load the game page' }; }
  return { ok: false, why: 'unknown method' }; }
const BOUNTIES = [
  { id: 'net-backing', title: "Best thread explaining NET's backing", brief: 'Explain in plain words what backs NET (USDG + tokenized RWAs in the treasury) and why it matters. Thread, no shilling, no price talk.', reward: 5000, ends: '2026-11-01' },
  { id: 'arcade-clip', title: 'Best NetNet Arcade clip', brief: 'Post a short clip or screenshot of your best verified run with the replay link.', reward: 2500, ends: '2026-11-01' },
  { id: 'tradfi-eli5', title: 'Explain RWAs to your bank-app friend', brief: 'One post a TradFi person would understand: tokenized gold/T-bills/real estate on NetNet, no jargon.', reward: 3000, ends: '2026-11-08' }
];
function exampleMetrics(id) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const r = n => { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; return h % n; };
  const views = 400 + r(24000), likes = Math.round(views * (0.01 + r(50) / 1000)), reposts = Math.round(likes * (0.1 + r(30) / 100)), replies = Math.round(likes * (0.05 + r(20) / 100));
  return { views, likes, reposts, replies, example: true }; }

export class VoicesDO {
  constructor(state) { this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY, url TEXT, xuser TEXT, text TEXT, acct TEXT, handle TEXT, week INTEGER, at INTEGER, votes INTEGER DEFAULT 0, bounty TEXT, verified INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS votes(post TEXT, acct TEXT, at INTEGER, PRIMARY KEY(post, acct));
      CREATE TABLE IF NOT EXISTS bvotes(bounty TEXT, acct TEXT, post TEXT, at INTEGER, PRIMARY KEY(bounty, acct));
      CREATE INDEX IF NOT EXISTS pw ON posts(week);
      CREATE TABLE IF NOT EXISTS claims(game TEXT PRIMARY KEY, acct TEXT, handle TEXT, method TEXT, at INTEGER, optin INTEGER DEFAULT 0, accrued INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS hidden(game TEXT PRIMARY KEY, reason TEXT, at INTEGER);`); }
  rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  post(r) { const { acct, ...o } = r; return { ...o, metrics: exampleMetrics(r.id) }; }
  async fetch(req) {
    if (new URL(req.url).pathname.startsWith('/v1/discover/')) return this.discover(req);
    const u = new URL(req.url), p = u.pathname.replace('/v1/voices', ''), j = (o, s = 200) => new Response(JSON.stringify(o), { status: s }), now = Date.now(), wk = weekOf(now);
    const b = req.method === 'POST' ? await req.json() : null;
    if (p === '/posts' && req.method === 'POST') {
      const m = X_RE.exec(String(b.url || '')); if (!m) return j({ error: 'Paste a link like https://x.com/name/status/123…' }, 400);
      const id = m[2]; if (this.rows('SELECT id FROM posts WHERE id=?', id).length) return j({ error: 'This post is already on Voices', id }, 409);
      const mine = this.rows('SELECT COUNT(*) n FROM posts WHERE acct=? AND at>?', b.acct.id, now - 864e5)[0].n; if (mine >= 5) return j({ error: 'Max 5 posts per account per day' }, 429);
      const o = b.oembed, bounty = BOUNTIES.some(x => x.id === b.bounty) ? b.bounty : null;
      if (o && o.ok === false && o.status === 404) return j({ error: 'X says this post does not exist (or is private/deleted)' }, 400);
      this.sql.exec('INSERT INTO posts(id,url,xuser,text,acct,handle,week,at,votes,bounty,verified) VALUES(?,?,?,?,?,?,?,?,0,?,?)', id, 'https://x.com/' + m[1] + '/status/' + id, o && o.ok ? o.author : m[1], o && o.ok ? o.text : '', b.acct.id, b.acct.handle, wk, now, bounty, o && o.ok ? 1 : 0);
      return j({ ok: true, post: this.post(this.rows('SELECT * FROM posts WHERE id=?', id)[0]) });
    }
    if (p === '/posts') { const w = +u.searchParams.get('week') || wk, by = u.searchParams.get('handle');
      const r = by ? this.rows('SELECT * FROM posts WHERE handle=? ORDER BY at DESC LIMIT 50', by) : this.rows('SELECT * FROM posts WHERE week=? ORDER BY votes DESC, at ASC LIMIT 200', w);
      return j({ week: w, posts: r.map(x => this.post(x)) }); }
    if (p === '/vote' && req.method === 'POST') {
      const post = this.rows('SELECT * FROM posts WHERE id=?', String(b.post))[0]; if (!post) return j({ error: 'unknown post' }, 404);
      if (post.acct === b.acct.id) return j({ error: "You can't vote for your own post" }, 403);
      if (this.rows('SELECT 1 FROM votes WHERE post=? AND acct=?', post.id, b.acct.id).length) return j({ error: 'Already voted for this post (one vote per account)' }, 409);
      const today = this.rows('SELECT COUNT(*) n FROM votes WHERE acct=? AND at>?', b.acct.id, now - 864e5)[0].n; if (today >= 30) return j({ error: 'Max 30 votes per account per day' }, 429);
      this.sql.exec('INSERT INTO votes VALUES(?,?,?)', post.id, b.acct.id, now); this.sql.exec('UPDATE posts SET votes=votes+1 WHERE id=?', post.id);
      return j({ ok: true, votes: post.votes + 1 }); }
    if (p === '/myvotes' && req.method === 'POST') return j({ posts: this.rows('SELECT post FROM votes WHERE acct=?', b.acct.id).map(r => r.post), bounties: this.rows('SELECT bounty, post FROM bvotes WHERE acct=?', b.acct.id) });
    if (p === '/board') { const w = +u.searchParams.get('week') || wk;
      return j({ week: w, rows: this.rows('SELECT handle, SUM(votes) votes, COUNT(*) posts, MAX(votes) best FROM posts WHERE week=? GROUP BY acct ORDER BY votes DESC, MIN(at) ASC LIMIT 100', w) }); }
    if (p === '/raid') { const r = this.rows('SELECT * FROM posts WHERE at>? ORDER BY votes DESC, at DESC LIMIT 3', now - 2 * 864e5);
      return j({ posts: (r.length ? r : this.rows('SELECT * FROM posts ORDER BY at DESC LIMIT 3')).map(x => this.post(x)) }); }
    if (p === '/bounties') return j({ bounties: BOUNTIES.map(x => ({ ...x, entries: this.rows('SELECT p.id,p.url,p.handle,p.xuser,p.text,p.votes, (SELECT COUNT(*) FROM bvotes v WHERE v.bounty=? AND v.post=p.id) bvotes FROM posts p WHERE p.bounty=? ORDER BY bvotes DESC, p.at ASC', x.id, x.id) })) });
    if (p === '/bounties/vote' && req.method === 'POST') {
      const e = this.rows('SELECT * FROM posts WHERE id=? AND bounty=?', String(b.post), String(b.bounty))[0]; if (!e) return j({ error: 'unknown entry' }, 404);
      if (e.acct === b.acct.id) return j({ error: "You can't vote for your own entry" }, 403);
      if (this.rows('SELECT 1 FROM bvotes WHERE bounty=? AND acct=?', e.bounty, b.acct.id).length) return j({ error: 'You already picked a winner for this bounty (one per account)' }, 409);
      this.sql.exec('INSERT INTO bvotes VALUES(?,?,?,?)', e.bounty, b.acct.id, e.id, now); return j({ ok: true }); }
    if (p === '/creator') { const h = u.searchParams.get('handle'), ps = this.rows('SELECT * FROM posts WHERE handle=? ORDER BY votes DESC', h);
      return j({ handle: h, posts: ps.length, votes: ps.reduce((a, x) => a + x.votes, 0), best: ps[0] ? this.post(ps[0]) : null, weekVotes: ps.filter(x => x.week === wk).reduce((a, x) => a + x.votes, 0) }); }
    return j({ error: 'not found' }, 404);
  }
  async discover(req) {
    const u = new URL(req.url), p = u.pathname.replace('/v1/discover', ''), j = (o, s = 200) => new Response(JSON.stringify(o), { status: s }), now = Date.now();
    const b = req.method === 'POST' ? await req.json() : null, game = b && DGAMES.find(x => x.slug === b.game);
    if (p === '/state') { const c = {}; this.rows('SELECT game, handle, optin, accrued, at FROM claims').forEach(r => c[r.game] = r);
      return j({ claims: c, hidden: this.rows('SELECT game FROM hidden').map(r => r.game), split: { creator: 85, treasury: 5, pool: 10, label: 'launch rate', example: true } }); }
    if (!b) return j({ error: 'not found' }, 404);
    if (p !== '/takedown' && !game) return j({ error: 'unknown game' }, 404);
    if (p === '/claim/start') { const c = this.rows('SELECT * FROM claims WHERE game=?', game.slug)[0]; if (c) return j({ error: 'Already claimed by @' + c.handle }, 409);
      return j({ code: b.code, handle: game.handle, play: game.play }); }
    if (p === '/claim/verify') {
      const c = this.rows('SELECT * FROM claims WHERE game=?', game.slug)[0]; if (c) return j({ error: 'Already claimed' }, 409);
      const pr = b.proof || {}; if (!pr.ok) return j({ error: pr.why || 'proof failed' }, 400);
      if (pr.kind === 'x' && pr.handle !== game.handle.toLowerCase()) return j({ error: 'That post is by @' + pr.handle + ', but this game was posted by @' + game.handle + '. Post the code from the same account.' }, 403);
      if (!String(pr.text || '').includes(b.code)) return j({ error: 'Code ' + b.code + ' not found ' + (pr.kind === 'x' ? 'in that post' : 'on the game page or /netnet-claim.txt') }, 403);
      this.sql.exec('INSERT INTO claims(game,acct,handle,method,at) VALUES(?,?,?,?,?)', game.slug, b.acct.id, game.handle, pr.kind, now);
      return j({ ok: true, claimed: game.slug, handle: game.handle }); }
    if (p === '/optin') { const c = this.rows('SELECT * FROM claims WHERE game=?', game.slug)[0]; if (!c || c.acct !== b.acct.id) return j({ error: 'Only the verified creator can change this' }, 403);
      this.sql.exec('UPDATE claims SET optin=? WHERE game=?', b.on ? 1 : 0, game.slug); return j({ ok: true, optin: !!b.on }); }
    if (p === '/takedown') { // instant: hidden immediately, no questions; restoring needs the creator to claim + ask
      const slug = String(b.game || ''); if (!DGAMES.some(x => x.slug === slug)) return j({ error: 'unknown game' }, 404);
      this.sql.exec('INSERT OR REPLACE INTO hidden VALUES(?,?,?)', slug, String(b.reason || '').slice(0, 300), now); return j({ ok: true, hidden: slug }); }
    if (p === '/restore') { const c = this.rows('SELECT * FROM claims WHERE game=?', game.slug)[0]; if (!c || c.acct !== b.acct.id) return j({ error: 'Only the verified creator can restore' }, 403);
      this.sql.exec('DELETE FROM hidden WHERE game=?', game.slug); return j({ ok: true }); }
    return j({ error: 'not found' }, 404);
  }
}
