// Offline test of the Worker with an in-memory KV. Run: npm test
import worker from './src/index.js';
import NNS from './src/sims.bundle.js';
const store = new Map();
const env = { SIGNING_KEY: 'test-key', RUNS: { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }) } };
const call = async (path, body) => (await worker.fetch(new Request('https://x' + path, body ? { method: 'POST', body: JSON.stringify(body) } : {}), env)).json();
const st = await call('/v1/start', { game: 'rent-rush' });
const log = [[0, 0], [5, 0], [10, 0], [40, 1]];
// pretend the run took 45 s on both clocks
const good = await call('/v1/runs', { ...st, log, wallMs: 45000, handle: 'tester', t0: st.t0 - 45000, sig: undefined });
console.log('no token ->', good.verified, good.reasons);
const st2 = await call('/v1/start', { game: 'rent-rush' });
// re-sign with a t0 45 s in the past to simulate a real 45 s run
const { createHmac } = await import('node:crypto');
const t0 = st2.t0 - 45000, sig = createHmac('sha256', 'test-key').update(`rent-rush|${st2.week}|${st2.seed}|${t0}`).digest('hex');
const ok = await call('/v1/runs', { ...st2, t0, sig, log, wallMs: 45000, handle: 'tester' });
console.log('real-time run ->', ok.verified, ok.score, ok.reasons);
const fast = await call('/v1/runs', { ...st2, t0, sig, log, wallMs: 4000, handle: 'speedy' });
console.log('speed-hack ->', fast.verified, fast.reasons);
const bot = await call('/v1/runs', { ...st2, t0, sig, log: Array.from({ length: 40 }, (_, i) => [i >> 2, 0]), wallMs: 45000, handle: 'bot' });
console.log('bot spam ->', bot.verified, bot.reasons);
console.log('board ->', JSON.stringify(await call('/v1/board?game=rent-rush')));
console.log('stats ->', JSON.stringify(await call('/v1/stats')));
if (!ok.verified || fast.verified || bot.verified) { console.error('FAIL'); process.exit(1); } console.log('PASS');
