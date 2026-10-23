# NetNet Arcade score server (Cloudflare Worker)

**Status: LIVE** at https://netnet-arcade-verifier.netnetarcade.workers.dev (deployed 2026-10-21). KV namespace `RUNS`, secret `SIGNING_KEY` set, per-IP rate limits via Cloudflare Rate Limiting bindings (writes 30/min, reads 240/min). CORS allows https://yoloboydelis.github.io (+ localhost:8765 for testing).

It re-simulates every submitted run with the *same* game code the cabinets run in the browser
(`arcade/sims.js` + `dip-dash/engine.js` + `portfolio-league/engine.js`, bundled by `build.mjs`),
so a faked score cannot get on the board.

## Checks
| Check | Where |
|---|---|
| Score = re-simulation of seed + input log (claimed score ignored) | `NNS.verify` |
| Weekly seed only, current UTC week only (Sun 00:00 → Sun 00:00) | `NNS.verify(..., {currentWeekOnly:true})` |
| Legal actions, ordered ticks, no inputs after game over | `NNS.verify` |
| Inputs-per-second cap per game (snake 12, gold-bar 8, rent-rush 15, rebalance 10, dip-dash 6) | `NNS.verify` |
| Real-time pacing: wall time ≈ simulated time (no speed-hack), no pause/stall, tab not hidden | `NNS.verify` |
| **Server clock**: `/v1/start` issues an HMAC-signed start time; submit is rejected if the client claims more or less time than the server saw | `src/index.js` |

## Server-side TEST-credit ledger
Each browser has a random secret; the server stores `acct:<sha(secret)>` with handle, credits (10,000, topped back up every 24 h), entries.
A ranked `/v1/start` charges 100: 10 to the treasury first, 90 to `pool:<game>:<week>`. Start tokens are HMAC-signed over game|week|seed|t0|account|ranked and single-use.

## API
- `POST /v1/account {secret, handle}` → `{handle, credits, nextRefill, entries}`
- `POST /v1/start {game, ranked, secret, handle}` → `{game, week, seed, t0, sig}`
- `POST /v1/runs {game, week, seed, t0, sig, ranked, log, wallMs, hidden, secret}` → `{id, verified, score, reasons}`
- `GET /v1/board?game=rent-rush[&week=20261018]` → best verified score per handle
- `GET /v1/run/<id>` → full run (for the replay viewer)
- `GET /v1/stats[?week=]` → runs / verified per game

## Redeploy
`CLOUDFLARE_API_TOKEN=… npm run deploy` (runs build.mjs first). Rotate the key: `openssl rand -hex 32 | npx wrangler secret put SIGNING_KEY`.

## Original go-live steps (done)
1. Create a free Cloudflare account (use a project/team email, not a personal one).
2. `cd server && npm install`
3. `npx wrangler login`
4. `npx wrangler kv namespace create RUNS` → paste the id into `wrangler.toml`.
5. `npx wrangler secret put SIGNING_KEY` → paste a long random string (`openssl rand -hex 32`).
6. `npm test` (offline test) then `npm run deploy` → you get `https://netnet-arcade-verifier.<subdomain>.workers.dev`.
7. Turn it on in the site: add `<script>window.NN_SCORE_SERVER="https://…workers.dev"</script>` before `arcade/core.js`
   (or set `localStorage.nna_server='"https://…"'` to test on one device). Cabinets then call `/v1/start` + `/v1/runs` automatically.
8. Next step after that: switch `boards/` and `stats/` to read `/v1/board` and `/v1/stats` (today they read this device's local runs).

## Known limits
- KV board update is read-modify-write: fine for a prototype; use a Durable Object or D1 when traffic grows.
- Replay verification proves the score came from *legal inputs at human speed*; it can't fully stop a well-built bot that plays at human speed. Add rate limits per IP, wallet-linked accounts and outlier review before real prizes.
- Credits/pools are still local (test credits). A server ledger is needed before anything has value.
- Portfolio League is a one-shot pick (no real-time element), so only rule validation + re-scoring apply.

## Voices (creator leaderboard) — LIVE
Stored in one SQLite-backed Durable Object `VoicesDO` (free tier, strongly consistent, no KV writes per vote).
Account = the same arcade secret. Rate limited by the same per-IP limiter (30 writes/min).
- `POST /v1/voices/posts {secret, url, bounty?}` — X link; existence + author + text via X's public oEmbed (server-side). Max 5/account/day. Views/likes are deterministic EXAMPLE metrics (X metrics need an X API key).
- `POST /v1/voices/vote {secret, post}` — one vote per account per post, no self-votes, max 30/day.
- `POST /v1/voices/myvotes {secret}`, `GET /v1/voices/posts[?week|handle]`, `GET /v1/voices/board[?week]`, `GET /v1/voices/raid`, `GET /v1/voices/creator?handle=`
- `GET /v1/voices/bounties`, `POST /v1/voices/bounties/vote {secret, bounty, post}` — one winner pick per account per bounty.
