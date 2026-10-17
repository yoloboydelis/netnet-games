# NetNet Games

Free play-money prototypes from NetNet Capital, rebuilt OG games on NetNet rails.

- `/hot-seat/` — HOT SEAT (play money, no randomness)
- `/snake/` — Retro Snake with replay-verified scores + waitlist
- `/portfolio-league/` — Portfolio League: weekly risk-adjusted portfolio competition (simulated demo data, engine in `engine.js`)

Live: https://yoloboydelis.github.io/netnet-games/

`main` holds the source (preview images stored as base64 in `og/*.png.b64`). The workflow in `.github/workflows/publish.yml` decodes them and publishes the site to the `gh-pages` branch, which GitHub Pages serves.

Prototype only. Play money. No deposits, no prizes.
