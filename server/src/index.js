// NetNet Arcade score server (Cloudflare Worker).
// Re-simulates every submitted run with the exact code the cabinets run (sims.bundle.js),
// keeps a server-side TEST-credit ledger, and applies basic per-IP rate limits.
import NNS from './sims.bundle.js';

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
  let a = await getJ(env, k, null);
  if (!a) a = { id, handle: cleanHandle(handle), credits: CFG.start, lastRefill: now, created: now, entries: 0 };
  if (now - a.lastRefill >= CFG.day) { if (a.credits < CFG.start) a.credits = CFG.start; a.lastRefill = now; }
  if (handle) a.handle = cleanHandle(handle);
  await putJ(env, k, a); return a;
}
const pub = a => ({ handle: a.handle, credits: a.credits, nextRefill: a.lastRefill + CFG.day, entries: a.entries });

export default {
  async fetch(req, env) {
    const C = cors(req), json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...C } });
    const url = new URL(req.url), p = url.pathname, ip = req.headers.get('cf-connecting-ip') || 'local';
    if (req.method === 'OPTIONS') return new Response(null, { headers: C });
    try {
      const bucket = p === '/v1/start' ? 'start' : p === '/v1/runs' ? 'runs' : p === '/v1/account' ? 'account' : 'read';
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
      if (p === '/' || p === '/v1/health') return json({ ok: true, service: 'netnet-arcade-verifier', version: NNS.VERSION, week: NNS.weekId(), credits: 'TEST credits only' });
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: 'bad request', detail: String(e && e.message || e) }, 400); }
  }
};
