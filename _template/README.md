# NetNet Arcade game template

Copy-and-ship kit for new cabinets. The target is **under 1 hour from idea to live**.

```
cp -r _template my-game && edit my-game/index.html   # set NN_GAME, write the game loop, call NN.end({score})
```
Then add a card to `/index.html` and an `og/my-game.png.b64` preview image, and push.

## API (`arcade.js`)
| Call | What it does |
|---|---|
| `NN.seed()` / `NN.rng(seed)` | Deterministic level. The daily UTC seed means everyone plays the same tape, and a challenge link reuses the sender's seed. **No chance element**: never use `Math.random()` in gameplay. |
| `NN.end({score,detail,line})` | Result modal with a share card PNG, a challenge link (`?seed=…&vs=score`), win/lose against the challenge, and a **DEMO** leaderboard. |
| `NN.forge(el,{coin,…})` | Net Forge economics panel, clearly labelled SIMULATION (10M cap, wsNET bonding curve, 50/50 LP-burn/buyback at graduation, tax ≤5% incl. NetNet 1%, finite reward jar). |
| `NN.track(event,data)` | Analytics hook. Events: `view, start, end, share, restart, challenge_result, leave`. |
| `NN.footer()` | Required footer line. |

## Analytics: off by default
With no endpoint, events are only written to `localStorage` (`nn_an_<game>`, last 500) and the console. **Nothing leaves the device.** There are no cookies, no fingerprinting and no user IDs.

To turn analytics on (one line per page, or once in `arcade.js`), choose an option:
- **Plausible** (EU-hosted, cookie-less): add its script tag, then `window.NN_ANALYTICS_PROVIDER="plausible"; window.NN_ANALYTICS_ENDPOINT="plausible";`. Events arrive as custom events with a `game` prop.
- **GoatCounter** (free for non-commercial use, open source, cookie-less): add its `count.js` tag, then `NN_ANALYTICS_PROVIDER="goatcounter"; NN_ANALYTICS_ENDPOINT="goatcounter";`.
- **Your own endpoint**: `NN_ANALYTICS_ENDPOINT="https://…/collect"`. Each event is sent as a JSON beacon (`{ev,game,t,d}`). A Cloudflare Worker plus D1 works for this.

KPIs come from these events (D1/D7 need a random local id; add one only after a privacy review). See `/workspace/netnet-studio/PLAYBOOK.md`.

Prototype for the NetNet community & devs, feedback welcome.

## 2026-10 upgrade: replay-verified cabinets (use this for every new game)
1. Add your game as a pure simulation in `arcade/sims.js` (`create(seed)`, `input(state, action)`, `step(state)`, `score(state)`, `tps`, `maxTicks`, `maxIps`, `actions()` validator). No `Math.random()`, no `Date` inside the sim.
2. In the page load `../arcade/sims.js` + `../arcade/core.js` and drive the game with `NNA.runner(GAME,{onFrame,onInput,onEnd})`: `R.start(ranked)`, `R.input(action)`. The runner records the input log, steps at a fixed rate, and at game over the verifier re-simulates it; only verified scores go on the weekly board.
3. Weekly seed: `NNS.seedFor(game)` (UTC Sunday → Sunday). Account, test credits, achievements, boards and replays come for free.
4. Run `node server/build.mjs` so the Worker uses the same code. See `server/README.md`.
