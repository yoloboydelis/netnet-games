// NetNet Arcade score server (Cloudflare Worker). NOT DEPLOYED YET.
// Re-simulates every submitted run with the exact code the cabinets run (sims.bundle.js)
// and only stores scores that verify. Adds server-side timing on top of the client checks.
import NNS from './sims.bundle.js';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS } });
const enc = new TextEncoder();
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const cleanHandle = h => String(h || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15) || 'anon';

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      // 1) start a run: server stamps the start time so pacing can be checked against the SERVER clock
      if (p === '/v1/start' && req.method === 'POST') {
        const b = await req.json(); if (!NNS.games[b.game]) return json({ error: 'unknown game' }, 400);
        const week = NNS.weekId(), seed = NNS.seedFor(b.game, week), t0 = Date.now();
        const msg = `${b.game}|${week}|${seed}|${t0}`; return json({ game: b.game, week, seed, t0, sig: await hmac(env.SIGNING_KEY, msg) });
      }
      // 2) submit: re-simulate, anti-bot checks, store if verified
      if (p === '/v1/runs' && req.method === 'POST') {
        const b = await req.json(); if (JSON.stringify(b).length > 400000) return json({ error: 'too large' }, 413);
        const g = NNS.games[b.game]; if (!g) return json({ error: 'unknown game' }, 400);
        const reasons = [];
        if (!g.noPacing) {
          const ok = b.sig && b.sig === await hmac(env.SIGNING_KEY, `${b.game}|${b.week}|${b.seed}|${b.t0}`);
          if (!ok) reasons.push('missing/invalid start token');
          const serverMs = Date.now() - b.t0; if (ok && serverMs + 1500 < b.wallMs * 0.95) reasons.push('client clock ran ahead of server clock');
          if (ok && b.wallMs > serverMs + 1500) reasons.push('wall time longer than server saw');
        }
        const v = NNS.verify({ game: b.game, week: b.week, seed: b.seed, log: b.log, wallMs: b.wallMs, hidden: b.hidden, claimed: null }, { currentWeekOnly: true });
        const all = reasons.concat(v.reasons), verified = all.length === 0;
        const id = crypto.randomUUID(), handle = cleanHandle(b.handle);
        const rec = { id, game: b.game, week: b.week, seed: b.seed, log: b.log, wallMs: b.wallMs, handle, score: v.score, verified, reasons: all, at: Date.now() };
        await env.RUNS.put('run:' + id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 120 });
        await env.RUNS.put(`stat:${b.game}:${b.week}:${verified ? 'ok' : 'bad'}:${id}`, '1', { expirationTtl: 60 * 60 * 24 * 120 });
        if (verified && !(g.higher === false && v.score >= 9999)) {
          // best score per handle per game per week; KV is fine for a prototype, use a Durable Object or D1 at scale
          const bk = `board:${b.game}:${b.week}`, board = JSON.parse(await env.RUNS.get(bk) || '[]');
          const i = board.findIndex(r => r.handle === handle), better = (a, c) => g.higher ? a > c : a < c;
          if (i < 0) board.push({ handle, score: v.score, id }); else if (better(v.score, board[i].score)) board[i] = { handle, score: v.score, id };
          board.sort((a, c) => g.higher ? c.score - a.score : a.score - c.score);
          await env.RUNS.put(bk, JSON.stringify(board.slice(0, 500)));
        }
        return json({ id, verified, score: v.score, reasons: all });
      }
      if (p === '/v1/board' && req.method === 'GET') {
        const game = url.searchParams.get('game'), week = +url.searchParams.get('week') || NNS.weekId();
        return json({ game, week, rows: JSON.parse(await env.RUNS.get(`board:${game}:${week}`) || '[]').slice(0, 100) });
      }
      if (p.startsWith('/v1/run/')) { const r = await env.RUNS.get('run:' + p.slice(8)); return r ? json(JSON.parse(r)) : json({ error: 'not found' }, 404); }
      if (p === '/v1/stats') {
        const week = +url.searchParams.get('week') || NNS.weekId(), out = {};
        for (const game of Object.keys(NNS.games)) { const l = await env.RUNS.list({ prefix: `stat:${game}:${week}:` }); out[game] = { runs: l.keys.length, verified: l.keys.filter(k => k.name.includes(':ok:')).length }; }
        return json({ week, games: out });
      }
      if (p === '/' || p === '/v1/health') return json({ ok: true, service: 'netnet-arcade-verifier', version: NNS.VERSION, week: NNS.weekId() });
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: 'bad request', detail: String(e && e.message || e) }, 400); }
  }
};
