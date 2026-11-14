# NetNet Studio Playbook: the hit factory ("Playway for NetNet")

**Principle:** ship many cheap, small, skill-only games. Measure them honestly, kill fast, and double down on what sticks. A hit earns iterations, sequels, genre clones and, last of all, a Net Forge coin.

## 1. Weekly cadence (3 micro-games a week)
| Day | Work |
|---|---|
| Mon | Pick 3 ideas from the genre matrix plus the Ideas board. Write a one-line pitch, a "fun in 5 seconds" hook and the RWA theme for each. |
| Tue–Wed | Build each game from `_template/` (≤1h for v0, ≤4h polish). Preview image, card on the index, push. |
| Thu | Launch: X post with a share card and challenge link, pin in the community. |
| Fri | Review last week's games against the KPIs below. Decide **kill / keep / scale**. |
| Rolling | Hits get a v2 within 7 days. |

## 2. Genre matrix (pick unexplored cells first)
| Genre ↓ / Theme → | Gold & commodities | Tokenized stocks | T-bills / bonds | Real estate | Charts / markets |
|---|---|---|---|---|---|
| Arcade reflex | **GOLD BAR** ✅ | DIP DASH ✅ | | | Snake ✅ |
| Idle / tycoon | | | | **RENT RUSH** ✅ | |
| Puzzle | | | | | **REBALANCE** ✅ |
| PvP duel (async challenge link) | | | | | HOT SEAT ✅ |
| Strategy / league | | Portfolio League ✅ | | | |

Every game needs a challenge link and a daily same-for-everyone level. All games are **skill-only and deterministic** (no chance elements): no `Math.random()` in gameplay, no paid loot or chance.

## 3. Shared template (`/netnet-site/_template/`)
`arcade.css` + `arcade.js` provide the seeded RNG and daily seed, result modal, share card PNG, challenge link (`?seed=&vs=`), DEMO leaderboard, Net Forge SIMULATION panel, analytics hook and the footer. A new game = copy, write one loop, call `NN.end({score})`.

## 4. KPIs and kill/scale thresholds (first 7 days, ≥300 unique players)
| KPI | Event source | Kill if | Scale if |
|---|---|---|---|
| D1 retention | `view` by local id on day N+1 | < 15% | ≥ 30% |
| D7 retention | `view` on day N+7 | < 4% | ≥ 10% |
| Plays per user per day | `start` / users | < 1.5 | ≥ 4 |
| Share rate | `share` / `end` | < 2% | ≥ 8% |
| Challenge-link conversion | `start` with `?vs` / challenge `view` | < 15% | ≥ 35% |
| Median session length | `leave.ms` | < 45 s | ≥ 3 min |

Rule: **kill** a game if 3 or more KPIs are in the kill zone. **Scale** it if D1, share rate and challenge conversion are all in the scale zone. Everything else stays in the arcade, gets no more effort, and is reviewed again in 2 weeks. The thresholds are starting guesses; recalibrate after the first 10 games.

## 5. What to do with a hit
1. **Iterate (week 1):** tune difficulty using the score distribution, add a daily streak, improve the share card.
2. **Sequel or season (weeks 2–3):** new tapes or levels, a weekly tournament paid from NetNet Prizes.
3. **Genre clones:** reskin the same mechanic across RWA themes (GOLD BAR → OIL BAR, NVDA BAR). Ship 2 or 3 and keep whichever wins.
4. **Net Forge coin launch (only after D7 is proven):** game coin capped at 10M on the wsNET bonding curve. At graduation, 50% goes to the LP (LP tokens burned) and 50% to a 12h buyback and burn. Tax is ≤5% with NetNet's 1% inside it. Prizes come from a finite reward jar, refilled from the creator's share when it drops below the low mark. Prizes are for skill scores only.
5. **Cabinet Kit:** open the mechanic to external devs. Remixes in Forge Hub pay a royalty to the original creator.

## 6. Anti-bot rules (lessons from the letter)
- **No prize without verification:** a server or worker re-simulates the input log from the seed (deterministic games make this cheap). Scores that can't be replayed are void.
- Humanity signals: input-timing variance, impossible reaction times (< 120 ms sustained), identical input logs across wallets.
- **One wallet ≠ one human.** Gate prize eligibility on wsNET holding duration or a proof-of-personhood check, and cap payouts per address per day.
- Rewards always come from a **finite jar**, never from unlimited emissions. If a farmer drains it, the jar is empty, not the protocol.
- Delay payouts 24h for review, keep the leaderboard publicly auditable, and use clawback rules for cheated scores.
- Don't put a coin on a game until real-human retention is proven. Bots inflate plays but not D7.

## 7. Roles and tooling
One builder plus the AI agent per game. Analytics come from the `NN.track` events (off until an endpoint is set; see `_template/README.md`). Kill/scale decisions are logged weekly in this repo.

## 8. Gaps & blind spots (plain language, for non-game-devs)
Each item lists the **risk** (what goes wrong if we ignore it) and the **fix** (what we actually do).

| # | Topic | Risk | Concrete fix |
|---|---|---|---|
| 1 | **Game feel & "juice"** | A game that works but feels dead: taps with no feedback, players leave in 10 seconds. | Every action gets instant feedback within 100 ms: a flash, a small shake, a number popping up, a vibration, a sound. Put a "juice checklist" in the template and check it before shipping. |
| 2 | **Onboarding / first 30 seconds** | People don't understand the game and bounce before they play once. | No text walls. One big START button, a one-line rule, and the first round that is almost impossible to lose. Show the score within 5 seconds. Target: first play starts in under 3 seconds. |
| 3 | **Difficulty curve** | Too easy is boring and too hard is frustrating. Either way nobody comes back. | Ramp slowly: easy, then a bit harder, then a short breather. Tune using the real score distribution (aim for the median player losing at 60–90 seconds). Look at it weekly. |
| 4 | **Retention loops** | People play once and forget the game exists. | Daily tape (new level each day, already built), a streak counter with a 1-day grace, weekly seasons with a NetNet Prizes leaderboard, and challenge links that pull friends in. |
| 5 | **Monetization ethics** | Pay-to-win, loot boxes or FOMO tricks get us banned in many markets and hurt trust. | Never sell gameplay advantage or randomness. Charge only for entry to skill tournaments (after legal sign-off), cosmetics, and Net Forge coins. Be clear about every fee. No dark patterns or fake timers. |
| 6 | **Anti-cheat & bots** | Bots farm the prizes and real players feel robbed. The reward jar gets drained. | Server-side replay verification of every prize score, payout delays, per-wallet caps, a minimum wsNET hold age, and human-signal checks (see section 6). Leaderboards for fun can stay open; leaderboards for prizes are verified. |
| 7 | **Server & chain-read costs** | Success becomes a bill: RPC calls per page view, leaderboard servers and indexers get expensive or rate-limited. | Keep games static (GitHub Pages / CDN, free). Read the chain through a cached indexer or subgraph, never directly per player. Batch payouts. Set a monthly budget alert and a cost-per-1k-players KPI. |
| 8 | **Accessibility** | We exclude colour-blind players, one-handed players, slow readers and screen-reader users. | Don't rely on colour alone (add icons and text), 44px+ tap targets (done), respect reduced motion (done), keyboard support, contrast ≥ 4.5:1, and an option for slower speed in non-prize mode. |
| 9 | **Mobile performance** | Lag on cheap Android phones ruins timing games and battery. | Budget each page under 200 KB with no frameworks. Use canvas and requestAnimationFrame, and test on a €100 Android plus Chrome's 4× CPU throttle. Fixed-step simulation so slow phones are fair (done in RENT RUSH). |
| 10 | **Sound** | Silent games feel cheap. Loud ones annoy people on the bus. | A small set of short sound effects (tap, hit, miss, win) through WebAudio, muted by default with a 🔊 toggle that is remembered. Use only CC0 sounds (e.g. Kenney.nl). |
| 11 | **Localization (NL/EN)** | Non-English players feel it's not for them, and translated text breaks layouts. | Put all strings in one `t()` dictionary in the template with EN and NL, auto-picked from browser language with a toggle. Keep copy short. A native speaker checks it before launch. |
| 12 | **Forge Hub moderation** | Spam remixes (one-pixel changes to farm royalties), stolen art, scam coins, offensive content. | Remixes need a minimum diff and a playtest before they get a coin. Report button and a takedown process. Stake wsNET to publish, which is slashed for proven theft. A curated "featured" list. Clear rules page. |
| 13 | **IP & licensing of remixed code** | Unclear rights, so lawsuits or "you stole my game" drama. A brand (NVIDIA, gold ETF names) complains. | **Default license: MIT for code, CC BY 4.0 for art**, chosen at publish time and stored in the manifest. Remixes keep the credit chain automatically. No real company logos; use tickers as text only, with a "not affiliated" line. A DMCA-style takedown email. |
| 14 | **Creator support** | Builders get stuck, leave, or ship broken games. | Template docs plus a 10-minute video, a "first game in 1 hour" tutorial, office hours in Discord/Telegram, starter bounties, and a public payout dashboard so they trust they'll be paid. |
| 15 | **Playtesting process** | We ship games only we understand. | 5-person test before each launch: watch silently, note where people hesitate, and count "one more try" moments. Use a fixed 5-question survey. Have a tester group of about 30 community members on Telegram. |
| 16 | **Analytics privacy (GDPR)** | Fines and trust loss for tracking people without a legal basis. | Off by default (already done). Use cookie-less EU tools (Plausible/GoatCounter) and aggregate only, with no wallet-to-IP linking. Add a privacy page, set a data retention limit, and do a DPA with the provider. Ask consent before any local ID used for D1/D7. |
| 17 | **Legal: gaming rules** | Anything with stake + chance + prize is gambling in many jurisdictions. Prizes for paid entry are risky even when skill-based. | Skill-only, deterministic games (done). Free entry for prize games until a gaming lawyer signs off. No randomness in anything paid. Document the "why it's skill" reasoning per game. |
| 18 | **Legal: MiCA & coins** | Game coins and the vaults may count as crypto-asset offerings or services. Marketing claims can be misleading. | Get a legal opinion before any Net Forge launch. Publish white papers if needed. Don't promise returns. Consider geofencing. |
| 19 | **Age gate** | Minors trading coins or winning prizes is a legal and reputational disaster. | Games stay free to play for all. Any wallet, coin or prize feature sits behind an 18+ confirmation, plus KYC through the prize provider for larger payouts. |
| 20 | **Team roles to hire or recruit** | A tiny core team plus AI can't do art, sound, community, legal and security alone. | Recruit (bounties first, hire later): 1) a game designer/tuner, 2) a pixel/2D artist (art packs as bounties), 3) a community moderator (NL/EN), 4) a smart-contract dev plus auditor relationship, 5) part-time legal counsel (BE gaming + MiCA), 6) a sound designer (one-off pack). |

Prototype for the NetNet community & devs, feedback welcome.
