# NetNet Arcade

Free play-money arcade cabinets from NetNet Capital, on NetNet rails with real-world assets at the core.

- `/hot-seat/` — HOT SEAT (play money, no randomness)
- `/snake/` — Retro Snake with replay-verified scores
- `/portfolio-league/` — Portfolio League: weekly risk-adjusted portfolio competition (simulated demo data, engine in `engine.js`)
- `/dip-dash/` — Cabinet 04 DIP DASH: 24-second buy-the-dip reflex game on tokenized RWAs (daily deterministic tape, replay-verified challenge links, engine in `engine.js`)

Live: https://yoloboydelis.github.io/netnet-games/

`main` holds the source (preview images stored as base64 in `og/*.png.b64`). The workflow in `.github/workflows/publish.yml` decodes them and publishes the site to the `gh-pages` branch, which GitHub Pages serves.

Prototype for the NetNet community & devs, feedback welcome. Play money. No deposits, no prizes.

## aidunlap originals (casual / unranked)
- /dunlap-dash/ runner, /merge-mogul/ merge puzzle, /dunlap-empire/ idle tycoon
- arcade/dunlap.js: reusable character pack. `NND.draw(ctx,x,y,h,{v,pose,t,flip})`, variants dunlap/trader/banker/boss/bear, poses stand/run/win/fail; `NND.badge(ctx,x,y,r,kind)` for gold/tbill/estate/stock/net/dump icons.
