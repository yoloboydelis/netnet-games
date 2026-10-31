// Offline test with in-memory KV. Run: npm test
import worker from './src/index.js';
import { createHmac } from 'node:crypto';
const store = new Map();
const mk = n => { const m = new Map(); return { limit: async ({ key }) => { const c = (m.get(key) || 0) + 1; m.set(key, c); return { success: c <= n }; } }; };
const env = { RL_WRITE: mk(30), RL_READ: mk(240), SIGNING_KEY: 'test-key', RUNS: { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, list: async () => ({ keys: [] }) } };
const call = async (path, body, ip = '1.1.1.1') => { const r = await worker.fetch(new Request('https://x' + path, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined, headers: { 'cf-connecting-ip': ip, origin: 'https://yoloboydelis.github.io' } }), env); return Object.assign(await r.json(), { _s: r.status, _o: r.headers.get('access-control-allow-origin') }); };
const secret = 'a'.repeat(32), log = [[0, 0], [5, 0], [10, 0], [40, 1]];
const acct = await call('/v1/account', { secret, handle: 'tester' });
const st = await call('/v1/start', { game: 'rent-rush', secret, ranked: true });
console.log('account', acct.credits, '-> after entry', st.account.credits, 'cors', st._o);
// fake a 45 s run: re-sign token with t0 45 s earlier (same as the server would have issued)
const acctId = JSON.parse([...store.entries()].find(([k]) => k.startsWith('acct:'))[1]).id;
const resign = (t0, ranked = true) => createHmac('sha256', 'test-key').update(`rent-rush|${st.week}|${st.seed}|${t0}|${acctId}|${ranked ? 1 : 0}`).digest('hex');
const t0 = st.t0 - 45000;
const ok = await call('/v1/runs', { ...st, t0, sig: resign(t0), log, wallMs: 45000, secret });
console.log('real-time run ->', ok.verified, ok.score, 'rank', ok.rank, ok.reasons);
const reuse = await call('/v1/runs', { ...st, t0, sig: resign(t0), log, wallMs: 45000, secret });
console.log('token reuse ->', reuse.verified, reuse.reasons);
const t1 = st.t0 - 45001;
const fast = await call('/v1/runs', { ...st, t0: t1, sig: resign(t1), log, wallMs: 4000, secret });
console.log('speed-hack ->', fast.verified, fast.reasons);
const nosig = await call('/v1/runs', { ...st, log, wallMs: 45000, secret, sig: 'x' });
console.log('forged token ->', nosig.verified, nosig.reasons);
const board = await call('/v1/board?game=rent-rush');
console.log('board ->', JSON.stringify(board.rows), JSON.stringify(board.pool));
let rl = 0; for (let i = 0; i < 40; i++) if ((await call('/v1/account', { secret }, '9.9.9.9'))._s === 429) rl++;
console.log('rate limited after 30/min ->', rl, 'of 40 blocked');
console.log('stats ->', JSON.stringify((await call('/v1/stats')).games['rent-rush']));
const pass = ok.verified && ok.rank === 1 && !reuse.verified && !fast.verified && !nosig.verified && rl === 10 && st.account.credits === 9900 && board.rows.length === 1;
console.log(pass ? 'PASS' : 'FAIL'); if (!pass) process.exit(1);
// aidunlap originals: each new ranked cabinet must be known to the worker bundle and verify a simple run
{ const NNS = (await import('./src/sims.bundle.js')).default; let okAll = true;
  for (const game of ['dunlap-dash', 'merge-mogul', 'bear-siege', 'deep-vault', 'penthouse-pilot', 'aidunlap-playbox']) { const g = NNS.games[game], seed = NNS.seedFor(game), log = game === 'merge-mogul' ? [[0, 2], [5, 3], [10, 2]] : game === 'bear-siege' ? [[0, 2], [30, 4]] : game === 'aidunlap-playbox' ? [[0,7],[40,22],[70,23],[100,24]].concat(Array.from({ length: 19 }, (_, i) => [(i + 1) * 500, 7])) : [[30, 1]];
    const s = NNS.simulate(game, seed, log), v = NNS.verify({ game, week: NNS.weekId(), seed, log, wallMs: s.tick / g.tps * 1000 });
    const forged = NNS.verify({ game, week: NNS.weekId(), seed: seed + 1, log, wallMs: s.tick / g.tps * 1000 });
    console.log(game, '->', v.ok, v.score, v.reasons.join(';'), '| wrong seed rejected:', !forged.ok); okAll = okAll && v.ok && !forged.ok; }
  const st2 = await call('/v1/start', { game: 'bear-siege', secret, ranked: true }); console.log('bear-siege start ->', !!st2.sig, st2.account.credits);
  if (!okAll || !st2.sig) { console.log('FAIL originals'); process.exit(1); } console.log('PASS originals'); }
